import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Alert,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import Colors from "@/constants/colors";
import { getSocket } from "@/services/socket";
import { getApiUrl } from "@/lib/query-client";

const SPECTATE_BG: [string, string, string] = ["#050010", "#0A0020", "#050010"];

type PlayerState = {
  id: string;
  name: string;
  skin: string;
  score: number;
};

type BetAmounts = 50 | 100 | 200;
const BET_OPTIONS: BetAmounts[] = [50, 100, 200];

type RoundResultEntry = {
  playerId: string;
  playerName: string;
  roundTotal: number;
};

type BetSettledEvent = {
  result: "win" | "lose" | "draw";
  payout?: number;
  refund?: number;
};

export default function SpectateScreen() {
  const { roomId, roomIdParam } = useLocalSearchParams<{ roomId?: string; roomIdParam?: string }>();
  const targetRoomId = roomId || roomIdParam || "";

  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { profile, playerId, addCoins } = usePlayer();
  const socket = getSocket();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [currentLetter, setCurrentLetter] = useState("");
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(5);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<RoundResultEntry[]>([]);

  const [betTotals, setBetTotals] = useState<Record<string, number>>({});
  const [bettorNames, setBettorNames] = useState<Record<string, { id: string; name: string }[]>>({});
  const [myBetSocketId, setMyBetSocketId] = useState<string | null>(null);
  const [betSettled, setBetSettled] = useState<BetSettledEvent | null>(null);
  const [betLoading, setBetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveTimer, setLiveTimer] = useState<number | null>(null);
  const [liveWords, setLiveWords] = useState<{ playerName: string; word: string; playerId: string }[]>([]);

  const letterAnim = useRef(new Animated.Value(0)).current;
  const joinedRef = useRef(false);
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const animateLetter = useCallback(() => {
    letterAnim.setValue(0);
    Animated.spring(letterAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!targetRoomId) { setError("معرف الغرفة مفقود"); return; }
    if (joinedRef.current) return;
    joinedRef.current = true;

    socket.emit("spectate_join", { roomId: targetRoomId }, (res: {
      success: boolean;
      error?: string;
      state?: {
        currentLetter: string;
        currentRound: number;
        totalRounds: number;
        players: PlayerState[];
      };
      spectatorCount?: number;
    }) => {
      if (!res.success) {
        setError(res.error === "room_not_active" ? "المباراة غير نشطة حالياً" :
          res.error === "spectators_full" ? "وصل عدد المشاهدين للحد الأقصى (10)" :
          "تعذر الانضمام كمشاهد");
        return;
      }
      if (res.state) {
        setPlayers(res.state.players || []);
        setCurrentLetter(res.state.currentLetter || "");
        setCurrentRound(res.state.currentRound || 1);
        setTotalRounds(res.state.totalRounds || 5);
        animateLetter();
      }
      setSpectatorCount(res.spectatorCount || 0);
    });

    // Load current bet totals + bettor identities
    (async () => {
      try {
        const url = new URL(`/api/spectate/${targetRoomId}/bets`, getApiUrl());
        const r = await fetch(url.toString());
        if (r.ok) {
          const data = await r.json();
          setBetTotals(data.betTotals || {});
          if (data.bettors) setBettorNames(data.bettors);
        }
      } catch {}
    })();

    return () => {
      socket.emit("spectate_leave", { roomId: targetRoomId });
      joinedRef.current = false;
    };
  }, [targetRoomId]);

  useEffect(() => {
    const handleSpectateUpdate = (data: { type: string; payload: unknown }) => {
      if (data.type === "round_results") {
        const payload = data.payload as {
          players: PlayerState[];
          round: number;
          totalRounds: number;
          results: RoundResultEntry[];
        };
        setPlayers(payload.players || []);
        setCurrentRound(payload.round || 1);
        setTotalRounds(payload.totalRounds || 5);
        if (Array.isArray(payload.results)) {
          setLastResults(payload.results.map((r: RoundResultEntry) => ({
            playerId: r.playerId,
            playerName: r.playerName,
            roundTotal: r.roundTotal,
          })));
        }
      } else if (data.type === "new_round") {
        const payload = data.payload as { letter: string; round: number; totalRounds: number };
        setCurrentLetter(payload.letter || "");
        setCurrentRound(payload.round || 1);
        setTotalRounds(payload.totalRounds || 5);
        setLastResults([]);
        animateLetter();
      } else if (data.type === "game_over") {
        const payload = data.payload as { players: PlayerState[] };
        const sorted = [...(payload.players || [])].sort((a, b) => b.score - a.score);
        setPlayers(sorted);
        setGameOver(true);
        if (sorted.length >= 2 && sorted[0].score > sorted[1].score) {
          setWinnerName(sorted[0].name);
        } else {
          setWinnerName(null);
        }
      }
    };

    const handleSpectatorCount = (data: { count: number }) => {
      setSpectatorCount(data.count);
    };

    const handleBetUpdate = (data: { betTotals: Record<string, number>; bettors?: Record<string, { id: string; name: string }[]>; totalBets: number }) => {
      setBetTotals(data.betTotals || {});
      if (data.bettors) setBettorNames(data.bettors);
    };

    const handleBetSettled = (data: BetSettledEvent) => {
      setBetSettled(data);
      if (data.result === "win" && data.payout) {
        addCoins(data.payout);
      } else if (data.result === "draw" && data.refund) {
        addCoins(data.refund);
      }
    };

    // Authoritative full-state sync when joining mid-game
    const handleStateSyncEvent = (data: {
      state: { currentLetter: string; currentRound: number; totalRounds: number; players: PlayerState[] };
      spectatorCount: number;
    }) => {
      if (data.state) {
        setPlayers(data.state.players || []);
        setCurrentLetter(data.state.currentLetter || "");
        setCurrentRound(data.state.currentRound || 1);
        setTotalRounds(data.state.totalRounds || 5);
        animateLetter();
      }
      setSpectatorCount(data.spectatorCount || 0);
    };

    // Live word submission feed from players inside the room
    const handleLiveWord = (data: { playerName: string; word: string; playerId: string }) => {
      setLiveWords(prev => [...prev.slice(-19), data]);
    };

    // Round timer broadcast from server
    const handleRoundTimer = (data: { secondsLeft: number }) => {
      setLiveTimer(data.secondsLeft);
    };

    socket.on("spectate_update", handleSpectateUpdate);
    socket.on("spectator_count", handleSpectatorCount);
    socket.on("bet_update", handleBetUpdate);
    socket.on("bet_settled", handleBetSettled);
    socket.on("spectate_state_sync", handleStateSyncEvent);
    socket.on("spectate_live_word", handleLiveWord);
    socket.on("spectate_timer", handleRoundTimer);

    return () => {
      socket.off("spectate_update", handleSpectateUpdate);
      socket.off("spectator_count", handleSpectatorCount);
      socket.off("bet_update", handleBetUpdate);
      socket.off("bet_settled", handleBetSettled);
      socket.off("spectate_state_sync", handleStateSyncEvent);
      socket.off("spectate_live_word", handleLiveWord);
      socket.off("spectate_timer", handleRoundTimer);
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    };
  }, [socket, addCoins, animateLetter]);

  const placeBet = useCallback(async (betOnSocketId: string, amount: BetAmounts) => {
    if (myBetSocketId || betLoading || gameOver) return;
    if (profile.coins < amount) {
      Alert.alert("", "رصيدك غير كافٍ للمراهنة");
      return;
    }
    setBetLoading(true);
    socket.emit("spectate_place_bet", { roomId: targetRoomId, betOnSocketId, amount },
      (res: { success: boolean; error?: string; newCoins?: number }) => {
        setBetLoading(false);
        if (res.success) {
          setMyBetSocketId(betOnSocketId);
          addCoins(-amount);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (res.error === "already_bet") {
          Alert.alert("", "لقد راهنت مسبقاً في هذه المباراة");
        } else if (res.error === "insufficient_coins") {
          Alert.alert("", "رصيدك غير كافٍ");
        } else if (res.error === "room_not_active") {
          Alert.alert("", "انتهت المباراة");
        } else if (res.error === "unauthorized") {
          Alert.alert("", "يجب تسجيل الدخول أولاً");
        } else {
          Alert.alert("", "حدث خطأ، حاول مرة أخرى");
        }
      });
  }, [myBetSocketId, betLoading, gameOver, profile.coins, targetRoomId, addCoins, socket]);

  const letterScale = letterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <ImageBackground source={require("../assets/images/bg_spectate.png")} style={StyleSheet.absoluteFillObject} resizeMode="cover">
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.60)" }]} />
        </ImageBackground>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#E8E8FF" />
        </TouchableOpacity>
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>👁️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.errorBtn} onPress={() => router.back()}>
            <Text style={styles.errorBtnText}>رجوع</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <ImageBackground source={require("../assets/images/bg_spectate.png")} style={StyleSheet.absoluteFillObject} resizeMode="cover">
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.60)" }]} />
      </ImageBackground>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          socket.emit("spectate_leave", { roomId: targetRoomId });
          router.back();
        }}>
          <Ionicons name="arrow-back" size={22} color="#E8E8FF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>👁️ مشاهد</Text>
          <Text style={styles.headerSub}>
            الجولة {currentRound}/{totalRounds} · {spectatorCount} مشاهد
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Letter Display + Live Timer */}
        {!gameOver && (
          <View style={styles.letterBox}>
            <Text style={styles.letterLabel}>حرف الجولة</Text>
            <Animated.Text style={[styles.letterText, { transform: [{ scale: letterScale }] }]}>
              {currentLetter}
            </Animated.Text>
            {liveTimer !== null && (
              <View style={[styles.liveTimerBadge, { borderColor: liveTimer <= 5 ? "#EF4444" : "#22C55E" }]}>
                <Text style={[styles.liveTimerText, { color: liveTimer <= 5 ? "#EF4444" : "#22C55E" }]}>
                  {liveTimer}ث
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Game Over Banner */}
        {gameOver && (
          <View style={[styles.gameOverBanner, { backgroundColor: Colors.gold + "22", borderColor: Colors.gold + "55" }]}>
            <Text style={styles.gameOverTitle}>🏆 انتهت المباراة</Text>
            <Text style={styles.gameOverSub}>
              {winnerName ? `الفائز: ${winnerName}` : "تعادل!"}
            </Text>
            {betSettled && (
              <View style={[styles.betResultBox, {
                backgroundColor: betSettled.result === "win" ? Colors.emerald + "22" :
                  betSettled.result === "draw" ? Colors.gold + "22" : Colors.ruby + "22"
              }]}>
                <Text style={[styles.betResultText, {
                  color: betSettled.result === "win" ? Colors.emerald :
                    betSettled.result === "draw" ? Colors.gold : Colors.ruby
                }]}>
                  {betSettled.result === "win"
                    ? `✅ ربحت! +${betSettled.payout} عملة`
                    : betSettled.result === "draw"
                    ? `🤝 تعادل — استرجعت ${betSettled.refund} عملة`
                    : "❌ خسرت رهانك"}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Player Cards */}
        <View style={styles.playersRow}>
          {players.map((player, idx) => {
            const skin = SKINS.find(s => s.id === player.skin) || SKINS[0];
            const isWinner = gameOver && winnerName === player.name;
            const betOnThis = myBetSocketId === player.id;
            const betPool = betTotals[player.id] || 0;
            return (
              <View key={player.id} style={[
                styles.playerCard,
                { borderColor: isWinner ? Colors.gold : betOnThis ? Colors.emerald : "#1E1E3A" },
              ]}>
                {isWinner && <Text style={styles.winnerBadge}>👑</Text>}
                <View style={[styles.playerAvatar, { backgroundColor: skin.color + "33" }]}>
                  <Text style={styles.playerAvatarEmoji}>{skin.emoji}</Text>
                </View>
                <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
                <Text style={styles.playerScore}>{player.score}</Text>
                <Text style={styles.playerScoreLabel}>نقطة</Text>
                {betPool > 0 && (
                  <View style={styles.betPoolBadge}>
                    <Ionicons name="star" size={10} color={Colors.gold} />
                    <Text style={styles.betPoolText}>{betPool} 🪙</Text>
                  </View>
                )}
                {(bettorNames[player.id] || []).length > 0 && (
                  <View style={[styles.betPoolBadge, { backgroundColor: "#8B5CF618", marginTop: 2, flexDirection: "column", alignItems: "flex-start", paddingVertical: 4 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Ionicons name="people" size={10} color="#8B5CF6" />
                      <Text style={[styles.betPoolText, { color: "#8B5CF6" }]}>
                        {(bettorNames[player.id] || []).length} مراهن
                      </Text>
                    </View>
                    {(bettorNames[player.id] || []).slice(0, 3).map((b, i) => (
                      <Text key={i} style={styles.bettorNameText} numberOfLines={1}>{b.name}</Text>
                    ))}
                  </View>
                )}
                {betOnThis && (
                  <View style={[styles.myBetBadge, { backgroundColor: Colors.emerald + "22" }]}>
                    <Text style={styles.myBetBadgeText}>رهانك ✅</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* VS Divider */}
        {players.length >= 2 && (
          <View style={styles.vsRow}>
            <View style={[styles.vsDivider, { backgroundColor: "#1E1E3A" }]} />
            <Text style={styles.vsText}>VS</Text>
            <View style={[styles.vsDivider, { backgroundColor: "#1E1E3A" }]} />
          </View>
        )}

        {/* Last Round Results */}
        {lastResults.length > 0 && !gameOver && (
          <View style={[styles.resultsBox, { backgroundColor: "#12122A", borderColor: "#1E1E3A" }]}>
            <Text style={styles.resultsTitle}>نتائج الجولة الأخيرة</Text>
            {lastResults.map((r) => (
              <View key={r.playerId} style={styles.resultRow}>
                <Text style={styles.resultName} numberOfLines={1}>{r.playerName}</Text>
                <Text style={styles.resultScore}>+{r.roundTotal}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Live Words Feed */}
        {!gameOver && liveWords.length > 0 && (
          <View style={[styles.resultsBox, { backgroundColor: "#0A001A", borderColor: "#8B5CF630" }]}>
            <Text style={[styles.resultsTitle, { color: "#8B5CF6" }]}>🟣 كلمات حية</Text>
            {liveWords.slice(-5).reverse().map((w, i) => (
              <View key={i} style={styles.liveWordRow}>
                <Text style={styles.liveWordPlayer} numberOfLines={1}>{w.playerName}:</Text>
                <Text style={styles.liveWordText}>{w.word}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Bet Panel */}
        {!gameOver && players.length >= 2 && (
          <View style={[styles.betPanel, { backgroundColor: "#12122A", borderColor: Colors.gold + "30" }]}>
            <Text style={styles.betPanelTitle}>💰 راهن على اللاعب</Text>
            {myBetSocketId ? (
              <View style={styles.betPlaced}>
                <Text style={[styles.betPlacedText, { color: Colors.emerald }]}>
                  ✅ تم وضع رهانك على {players.find(p => p.id === myBetSocketId)?.name}
                </Text>
                <Text style={[styles.betPlacedSub, { color: "#9898CC" }]}>انتظر نهاية المباراة</Text>
              </View>
            ) : (
              players.map((player) => (
                <View key={player.id} style={styles.betPlayerRow}>
                  <Text style={styles.betPlayerName} numberOfLines={1}>{player.name}</Text>
                  <View style={styles.betAmountRow}>
                    {BET_OPTIONS.map((amt) => (
                      <TouchableOpacity
                        key={amt}
                        style={[styles.betBtn, { borderColor: Colors.gold + "50", opacity: betLoading ? 0.5 : 1 }]}
                        onPress={() => placeBet(player.id, amt)}
                        disabled={betLoading}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.betBtnText}>{amt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))
            )}
            <Text style={styles.betBalance}>
              رصيدك: {profile.coins} <Ionicons name="star" size={11} color={Colors.gold} />
            </Text>
          </View>
        )}

        {gameOver && (
          <TouchableOpacity style={styles.backToFriendsBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={18} color="#E8E8FF" />
            <Text style={styles.backToFriendsBtnText}>رجوع</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050010" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, justifyContent: "space-between",
  },
  headerCenter: { alignItems: "center" },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#E8E8FF" },
  headerSub: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#9898CC", marginTop: 2 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#12122A", justifyContent: "center", alignItems: "center",
  },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  letterBox: { alignItems: "center", paddingVertical: 20 },
  letterLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#9898CC", marginBottom: 8 },
  letterText: { fontFamily: "Cairo_700Bold", fontSize: 96, color: Colors.gold, textAlign: "center" },
  gameOverBanner: {
    borderRadius: 16, padding: 20, alignItems: "center",
    borderWidth: 1.5,
  },
  gameOverTitle: { fontFamily: "Cairo_700Bold", fontSize: 22, color: Colors.gold, marginBottom: 4 },
  gameOverSub: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "#E8E8FF" },
  betResultBox: { marginTop: 12, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  betResultText: { fontFamily: "Cairo_700Bold", fontSize: 14, textAlign: "center" },
  playersRow: { flexDirection: "row", gap: 12 },
  playerCard: {
    flex: 1, borderRadius: 16, padding: 14, alignItems: "center",
    backgroundColor: "#12122A", borderWidth: 1.5, gap: 4,
    position: "relative",
  },
  winnerBadge: { position: "absolute", top: -10, fontSize: 22 },
  playerAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center" },
  playerAvatarEmoji: { fontSize: 28 },
  playerName: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#E8E8FF", textAlign: "center" },
  playerScore: { fontFamily: "Cairo_700Bold", fontSize: 30, color: Colors.gold },
  playerScoreLabel: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#9898CC" },
  betPoolBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: Colors.gold + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4,
  },
  betPoolText: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: Colors.gold },
  myBetBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
  myBetBadgeText: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: Colors.emerald },
  vsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  vsDivider: { flex: 1, height: 1 },
  vsText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#5A5A88" },
  resultsBox: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 8 },
  resultsTitle: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#9898CC", marginBottom: 4 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultName: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#E8E8FF", flex: 1 },
  resultScore: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.emerald },
  betPanel: { borderRadius: 16, padding: 16, borderWidth: 1.5, gap: 10 },
  betPanelTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.gold, marginBottom: 4 },
  betPlayerRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  betPlayerName: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#E8E8FF", flex: 1, minWidth: 80 },
  betAmountRow: { flexDirection: "row", gap: 6 },
  betBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1.5, backgroundColor: Colors.gold + "12",
  },
  betBtnText: { fontFamily: "Cairo_700Bold", fontSize: 12, color: Colors.gold },
  betPlaced: { alignItems: "center", gap: 4, paddingVertical: 8 },
  betPlacedText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, textAlign: "center" },
  betPlacedSub: { fontFamily: "Cairo_400Regular", fontSize: 11 },
  betBalance: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#9898CC", textAlign: "center" },
  errorBox: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  errorIcon: { fontSize: 48 },
  errorText: { fontFamily: "Cairo_600SemiBold", fontSize: 16, color: "#E8E8FF", textAlign: "center" },
  errorBtn: {
    backgroundColor: Colors.gold + "22", borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 10, borderWidth: 1, borderColor: Colors.gold + "40",
  },
  errorBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.gold },
  backToFriendsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#12122A", borderRadius: 14, paddingVertical: 14, marginTop: 8,
    borderWidth: 1, borderColor: "#1E1E3A",
  },
  backToFriendsBtnText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#E8E8FF" },
  liveTimerBadge: {
    marginTop: 8, paddingHorizontal: 16, paddingVertical: 4, borderRadius: 20, borderWidth: 2,
  },
  liveTimerText: { fontFamily: "Cairo_700Bold", fontSize: 18 },
  liveWordRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveWordPlayer: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#9898CC", maxWidth: "40%" },
  liveWordText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#C4B5FD" },
  bettorNameText: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "#C4B5FD", marginTop: 1 },
});
