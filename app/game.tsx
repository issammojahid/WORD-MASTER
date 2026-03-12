import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Keyboard,
  Platform,
  Modal,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";
import { getSocket } from "@/services/socket";
import { GAME_CATEGORIES, GameCategory } from "@/constants/i18n";

const ROUND_TIME = 50;

const QUICK_MESSAGES = [
  "برافو! 👏",
  "حظ سعيد! 🍀",
  "هههه 😂",
  "سهلة! 😎",
  "ماشاء الله 🌟",
  "اوف 😬",
];

type CategoryStatus = "idle" | "correct" | "duplicate" | "empty" | "invalid";

type RoundResult = {
  playerId: string;
  playerName: string;
  answers: Record<string, string>;
  scores: Record<string, number>;
  roundTotal: number;
  status: Record<string, CategoryStatus>;
};

type ChatBubble = {
  id: string;
  message: string;
  playerName: string;
  isMe: boolean;
};

export default function GameScreen() {
  const { roomId, letter, round, totalRounds, coinEntry: coinEntryParam } = useLocalSearchParams<{
    roomId: string;
    letter: string;
    round: string;
    totalRounds: string;
    coinEntry?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { profile, playerId, updateProfile, addCoins, addXp, reportGameResult } = usePlayer();
  const gameCoinEntry = coinEntryParam ? parseInt(coinEntryParam, 10) : 0;
  const socket = getSocket();

  const [answers, setAnswers] = useState<Record<GameCategory, string>>({} as Record<GameCategory, string>);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [submitted, setSubmitted] = useState(false);
  const [submittedPlayers, setSubmittedPlayers] = useState<string[]>([]);
  const [currentLetter, setCurrentLetter] = useState(letter || "أ");
  const [currentRound, setCurrentRound] = useState(parseInt(round || "1", 10));
  const [numTotalRounds] = useState(parseInt(totalRounds || "5", 10));
  const [roundResults, setRoundResults] = useState<RoundResult[] | null>(null);
  const [gamePlayers, setGamePlayers] = useState<{ id: string; name: string; score: number }[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverPlayers, setGameOverPlayers] = useState<
    { id: string; name: string; score: number; coins: number; skin: string }[]
  >([]);

  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatBubbles, setChatBubbles] = useState<ChatBubble[]>([]);
  const [streakReward, setStreakReward] = useState<{ streakBonus: number; coinEntryReward: number } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const letterAnim = useRef(new Animated.Value(0)).current;
  const answersRef = useRef<Record<GameCategory, string>>({} as Record<GameCategory, string>);
  const submittedRef = useRef(false);
  const socketId = socket.id;

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { submittedRef.current = submitted; }, [submitted]);

  useEffect(() => {
    letterAnim.setValue(0);
    Animated.spring(letterAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }).start();
  }, [currentLetter]);

  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, [currentRound]);

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const startTimer = () => {
    stopTimer();
    setTimeLeft(ROUND_TIME);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          if (!submittedRef.current) doSubmit(answersRef.current);
          return 0;
        }
        if (prev <= 5) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return prev - 1;
      });
    }, 1000);
  };

  const doSubmit = (currentAnswers: Record<GameCategory, string>) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    socket.emit("submit_answers", { roomId, answers: currentAnswers });
  };

  const handleSubmit = () => {
    if (submittedRef.current) return;
    stopTimer();
    doSubmit(answersRef.current);
  };

  const sendQuickChat = (message: string) => {
    setShowChatPanel(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const bubbleId = Date.now().toString();
    const bubble: ChatBubble = { id: bubbleId, message, playerName: profile.name, isMe: true };
    addChatBubble(bubble);
    socket.emit("quick_chat", { roomId, message, playerName: profile.name });
  };

  const addChatBubble = (bubble: ChatBubble) => {
    setChatBubbles((prev) => [...prev, bubble]);
    setTimeout(() => {
      setChatBubbles((prev) => prev.filter((b) => b.id !== bubble.id));
    }, 3500);
  };

  useEffect(() => {
    socket.on("player_submitted", ({ playerId }: { playerId: string }) => {
      setSubmittedPlayers((prev) => prev.includes(playerId) ? prev : [...prev, playerId]);
    });

    socket.on("round_results", (data: {
      results: RoundResult[];
      round: number;
      totalRounds: number;
      players: { id: string; name: string; score: number }[];
    }) => {
      stopTimer();
      setRoundResults(data.results);
      setGamePlayers(data.players);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });

    socket.on("new_round", (data: { letter: string; round: number; totalRounds: number }) => {
      setCurrentLetter(data.letter);
      setCurrentRound(data.round);
      setAnswers({} as Record<GameCategory, string>);
      setSubmitted(false);
      submittedRef.current = false;
      setSubmittedPlayers([]);
      setRoundResults(null);
      setTimeLeft(ROUND_TIME);
      setChatBubbles([]);
      letterAnim.setValue(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });

    socket.on("game_over", (data: {
      players: { id: string; name: string; score: number; coins: number; skin?: string }[];
      tournamentId?: string | null;
      tournamentMatchId?: string | null;
    }) => {
      stopTimer();
      setIsGameOver(true);
      setGameOverPlayers(data.players.map((p) => ({ ...p, skin: p.skin || "default" })));
      const me = data.players.find((p) => p.id === socketId);
      if (me) {
        const sorted = [...data.players].sort((a, b) => b.score - a.score);
        const rank = sorted.findIndex((p) => p.id === socketId);
        const won = rank === 0;
        reportGameResult(won, me.score, me.coins, Math.floor(me.score / 2), gameCoinEntry).then((result) => {
          if (result.streakBonus > 0 || result.coinEntryReward > 0) {
            setStreakReward({ streakBonus: result.streakBonus, coinEntryReward: result.coinEntryReward });
          }
        }).catch(() => {
          addCoins(me.coins);
          addXp(Math.floor(me.score / 2));
          updateProfile({
            gamesPlayed: profile.gamesPlayed + 1,
            wins: won ? profile.wins + 1 : profile.wins,
            totalScore: profile.totalScore + me.score,
          });
        });

        if (data.tournamentId && data.tournamentMatchId && won && playerId) {
          socket.emit("tournament_match_result", {
            tournamentId: data.tournamentId,
            matchId: data.tournamentMatchId,
            winnerId: playerId,
            winnerName: sorted[0].name,
            roomId,
          });
        }
      }
    });

    socket.on("quick_chat", (data: { message: string; playerName: string }) => {
      const bubbleId = Date.now().toString() + Math.random();
      addChatBubble({ id: bubbleId, message: data.message, playerName: data.playerName, isMe: false });
    });

    return () => {
      socket.off("player_submitted");
      socket.off("round_results");
      socket.off("new_round");
      socket.off("game_over");
      socket.off("quick_chat");
    };
  }, [socketId]);

  const handleNextRound = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    socket.emit("next_round", { roomId }, (_res: { isGameOver: boolean }) => {});
  };

  const handlePlayAgain = () => {
    socket.emit("play_again", { roomId });
    router.replace("/lobby");
  };

  const timerColor = timeLeft > 15 ? Colors.timerGreen : timeLeft > 8 ? Colors.timerYellow : Colors.timerRed;
  const timerProgress = timeLeft / ROUND_TIME;

  // Game over screen
  if (isGameOver) {
    const sortedPlayers = [...gameOverPlayers].sort((a, b) => b.score - a.score);
    const medals = ["🥇", "🥈", "🥉"];
    const myIdx = sortedPlayers.findIndex((p) => p.id === socketId);
    const amWinner = myIdx === 0;
    const podiumPlayers = sortedPlayers.slice(0, 3);
    const podiumOrder = [1, 0, 2];
    const podiumHeights = [90, 130, 70];

    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <ScrollView contentContainerStyle={styles.gameOverContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.gameOverTitle}>{t.gameOver}</Text>
          {amWinner ? <Text style={styles.gameOverSub}>🏆 أنت الفائز!</Text>
            : myIdx === 1 ? <Text style={styles.gameOverSub}>🥈 المركز الثاني — أحسنت!</Text>
            : myIdx === 2 ? <Text style={styles.gameOverSub}>🥉 المركز الثالث — لا بأس!</Text>
            : <Text style={styles.gameOverSub}>حاول مرة أخرى!</Text>}

          {podiumPlayers.length >= 2 && (
            <View style={styles.podiumRow}>
              {podiumOrder.map((pIdx) => {
                const p = podiumPlayers[pIdx];
                if (!p) return null;
                const isMe = p.id === socketId;
                const skin = SKINS.find((s) => s.id === p.skin) || SKINS[0];
                const h = podiumHeights[pIdx];
                const isFirst = pIdx === 0;
                return (
                  <View key={p.id} style={styles.podiumSlot}>
                    <Text style={styles.podiumMedal}>{medals[pIdx] || "🎖️"}</Text>
                    <View style={[styles.podiumAvatar, isFirst && styles.podiumAvatarFirst, { backgroundColor: skin.color + "33" }]}>
                      <Text style={[styles.podiumEmoji, isFirst && styles.podiumEmojiFirst]}>{skin.emoji}</Text>
                    </View>
                    <Text style={[styles.podiumName, isMe && { color: Colors.gold }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.podiumScore}>{p.score}</Text>
                    <View style={[styles.podiumBase, { height: h }, isFirst && styles.podiumBaseFirst]}>
                      <Text style={styles.podiumRank}>{pIdx + 1}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.finalRankings}>
            {sortedPlayers.map((p, idx) => {
              const isMe = p.id === socketId;
              const rankColors = [Colors.rank1, Colors.rank2, Colors.rank3];
              const skin = SKINS.find((s) => s.id === p.skin) || SKINS[0];
              return (
                <View key={p.id} style={[styles.finalRankRow, isMe && styles.finalRankRowMe]}>
                  <Text style={[styles.finalRankNum, { color: rankColors[idx] || Colors.textMuted }]}>{medals[idx] || `${idx + 1}`}</Text>
                  <View style={[styles.finalRankAvatar, { backgroundColor: skin.color + "22" }]}>
                    <Text style={styles.finalRankEmoji}>{skin.emoji}</Text>
                  </View>
                  <Text style={[styles.finalRankName, isMe && { color: Colors.gold }]} numberOfLines={1}>
                    {p.name}{isMe ? " (أنت)" : ""}
                  </Text>
                  <View style={styles.finalRankRight}>
                    <Text style={styles.finalRankScore}>{p.score}</Text>
                    <View style={styles.coinRewardBadge}>
                      <Ionicons name="star" size={10} color={Colors.gold} />
                      <Text style={styles.coinRewardText}>+{p.coins}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {streakReward && (streakReward.streakBonus > 0 || streakReward.coinEntryReward > 0) && (
            <View style={styles.bonusBanner}>
              {streakReward.streakBonus > 0 && (
                <View style={styles.bonusRow}>
                  <Ionicons name="flame" size={18} color={Colors.ruby} />
                  <Text style={styles.bonusText}>مكافأة السلسلة: +{streakReward.streakBonus} 🪙</Text>
                </View>
              )}
              {streakReward.coinEntryReward > 0 && (
                <View style={styles.bonusRow}>
                  <Ionicons name="trophy" size={18} color={Colors.gold} />
                  <Text style={styles.bonusText}>جائزة المباراة: +{streakReward.coinEntryReward} 🪙</Text>
                </View>
              )}
            </View>
          )}

          {gameCoinEntry > 0 && (
            <View style={styles.coinEntryInfo}>
              <Ionicons name="star" size={14} color={Colors.gold} />
              <Text style={styles.coinEntryInfoText}>مباراة بدخول {gameCoinEntry} عملة</Text>
            </View>
          )}

          <TouchableOpacity style={styles.playAgainBtn} onPress={handlePlayAgain}>
            <Ionicons name="refresh" size={18} color={Colors.background} style={{ marginRight: 8 }} />
            <Text style={styles.playAgainBtnText}>{t.playAgain}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace("/")}>
            <Text style={styles.homeBtnText}>{t.backToHome}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Round results screen
  if (roundResults) {
    const isHost = socketId && gamePlayers.length > 0 && gamePlayers[0].id === socketId;
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.roundResultsHeader}>
          <Text style={styles.roundResultsTitle}>{t.results} - {t.round} {currentRound}/{numTotalRounds}</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.roundResultsContent} showsVerticalScrollIndicator={false}>
          {roundResults.map((result) => {
            const isMe = result.playerId === socketId;
            return (
              <View key={result.playerId} style={[styles.resultPlayerCard, isMe && styles.resultPlayerCardMe]}>
                <View style={styles.resultPlayerHeader}>
                  <Text style={styles.resultPlayerName}>{result.playerName}{isMe ? " (أنت)" : ""}</Text>
                  <View style={styles.resultTotalBadge}>
                    <Text style={styles.resultTotalText}>+{result.roundTotal}</Text>
                  </View>
                </View>
                {GAME_CATEGORIES.map((cat) => {
                  const ans = result.answers[cat] || "";
                  const sc = result.scores[cat] || 0;
                  const st = result.status[cat] || "empty";
                  const statusColor = st === "correct" ? Colors.scoreCorrect : st === "duplicate" ? Colors.scoreDuplicate : Colors.scoreEmpty;
                  return (
                    <View key={cat} style={styles.resultCatRow}>
                      <Text style={styles.resultCatName}>{t[cat as keyof typeof t] as string}</Text>
                      <Text style={[styles.resultAnswer, !ans && styles.resultAnswerEmpty]}>{ans || "—"}</Text>
                      <View style={[styles.resultScoreBadge, { backgroundColor: statusColor + "22" }]}>
                        <Text style={[styles.resultScoreText, { color: statusColor }]}>{sc > 0 ? `+${sc}` : "0"}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
          <View style={styles.scoreSummary}>
            <Text style={styles.scoreSummaryTitle}>المجموع الكلي</Text>
            {[...gamePlayers].sort((a, b) => b.score - a.score).map((p, idx) => (
              <View key={p.id} style={styles.scoreSummaryRow}>
                <Text style={styles.scoreSummaryRank}>{idx + 1}</Text>
                <Text style={styles.scoreSummaryName}>{p.name}</Text>
                <Text style={styles.scoreSummaryTotal}>{p.score}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        {isHost ? (
          <TouchableOpacity style={styles.nextRoundBtn} onPress={handleNextRound}>
            <Text style={styles.nextRoundBtnText}>{currentRound >= numTotalRounds ? t.gameOver : t.nextRound}</Text>
            <Ionicons name="arrow-forward" size={20} color={Colors.black} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        ) : (
          <View style={styles.waitingNextRound}>
            <Text style={styles.waitingNextRoundText}>في انتظار المضيف...</Text>
          </View>
        )}
      </View>
    );
  }

  // Game play screen
  return (
    <View style={[styles.container, { paddingTop: topInset }]}>

      {/* ─── CHAT BUBBLES OVERLAY ─── */}
      {chatBubbles.length > 0 && (
        <View style={styles.bubblesOverlay} pointerEvents="none">
          {chatBubbles.map((bubble) => (
            <ChatBubbleView key={bubble.id} bubble={bubble} />
          ))}
        </View>
      )}

      <View style={styles.gameTopBar}>
        <Animated.View
          style={[styles.letterDisplay, {
            transform: [
              { scale: letterAnim },
              { rotate: letterAnim.interpolate({ inputRange: [0, 1], outputRange: ["20deg", "0deg"] }) },
            ],
          }]}
        >
          <Text style={styles.letterText}>{currentLetter}</Text>
        </Animated.View>

        <View style={styles.gameInfoRight}>
          <Text style={styles.roundLabel}>{t.round} {currentRound}/{numTotalRounds}</Text>
          <View style={styles.timerContainer}>
            <View style={styles.timerTrack}>
              <View style={[styles.timerFill, { width: `${timerProgress * 100}%` as any, backgroundColor: timerColor }]} />
            </View>
            <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}</Text>
          </View>
        </View>

        {/* Quick chat button */}
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => setShowChatPanel(true)}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {submittedPlayers.length > 0 && (
        <View style={styles.submittedBar}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.emerald} />
          <Text style={styles.submittedText}>{submittedPlayers.length} {t.players} أرسلوا إجاباتهم</Text>
        </View>
      )}

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.inputsContent, { paddingBottom: bottomInset + 80 }]}
        showsVerticalScrollIndicator={false}
        bottomOffset={80}
        keyboardShouldPersistTaps="handled"
      >
        {GAME_CATEGORIES.map((cat, idx) => (
          <View key={cat} style={styles.categoryInputRow}>
            <Text style={styles.categoryLabel}>{t[cat as keyof typeof t] as string}</Text>
            <TextInput
              style={[
                styles.categoryInput,
                submitted && styles.categoryInputSubmitted,
                !!(answers[cat]) && styles.categoryInputFilled,
              ]}
              value={answers[cat] || ""}
              onChangeText={(val) => { if (!submitted) setAnswers((prev) => ({ ...prev, [cat]: val })); }}
              placeholder={`${currentLetter}...`}
              placeholderTextColor={Colors.inputPlaceholder}
              editable={!submitted}
              textAlign="right"
              returnKeyType={idx < GAME_CATEGORIES.length - 1 ? "next" : "done"}
              autoCorrect={false}
            />
          </View>
        ))}
      </KeyboardAwareScrollView>

      {!submitted ? (
        <TouchableOpacity style={[styles.submitBtn, { bottom: bottomInset + 12 }]} onPress={handleSubmit}>
          <Ionicons name="send" size={20} color={Colors.black} style={{ marginRight: 8 }} />
          <Text style={styles.submitBtnText}>{t.submit}</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.submittedState, { bottom: bottomInset + 12 }]}>
          <Ionicons name="checkmark-circle" size={22} color={Colors.emerald} />
          <Text style={styles.submittedStateText}>تم الإرسال! في انتظار اللاعبين الآخرين...</Text>
        </View>
      )}

      {/* ─── QUICK CHAT PANEL ─── */}
      <Modal visible={showChatPanel} transparent animationType="slide" onRequestClose={() => setShowChatPanel(false)}>
        <TouchableOpacity style={styles.chatPanelOverlay} activeOpacity={1} onPress={() => setShowChatPanel(false)}>
          <View style={styles.chatPanel}>
            <Text style={styles.chatPanelTitle}>رسالة سريعة</Text>
            <View style={styles.chatMessagesGrid}>
              {QUICK_MESSAGES.map((msg) => (
                <TouchableOpacity key={msg} style={styles.chatMessageBtn} onPress={() => sendQuickChat(msg)}>
                  <Text style={styles.chatMessageText}>{msg}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function ChatBubbleView({ bubble }: { bubble: ChatBubble }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View
      style={[
        styles.chatBubble,
        bubble.isMe ? styles.chatBubbleMe : styles.chatBubbleOther,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.chatBubbleSender}>{bubble.playerName}</Text>
      <Text style={styles.chatBubbleMessage}>{bubble.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Chat bubbles overlay
  bubblesOverlay: {
    position: "absolute", top: 100, left: 16, right: 16, zIndex: 100,
    flexDirection: "column", gap: 8, alignItems: "flex-end",
  },
  chatBubble: {
    maxWidth: "60%", borderRadius: 16, padding: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  chatBubbleMe: { backgroundColor: Colors.gold, alignSelf: "flex-end" },
  chatBubbleOther: { backgroundColor: Colors.card, alignSelf: "flex-start", borderWidth: 1, borderColor: Colors.cardBorder },
  chatBubbleSender: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: Colors.black + "88", marginBottom: 2 },
  chatBubbleMessage: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.black },

  // Game top bar
  gameTopBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 12, backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  letterDisplay: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.gold,
    justifyContent: "center", alignItems: "center", marginRight: 12,
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  letterText: { fontFamily: "Cairo_700Bold", fontSize: 36, color: Colors.black, lineHeight: 48 },
  gameInfoRight: { flex: 1 },
  roundLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.textSecondary, marginBottom: 8, textAlign: "right" },
  timerContainer: { flexDirection: "row", alignItems: "center", gap: 10 },
  timerTrack: { flex: 1, height: 8, backgroundColor: Colors.cardBorder, borderRadius: 4, overflow: "hidden" },
  timerFill: { height: "100%", borderRadius: 4 },
  timerText: { fontFamily: "Cairo_700Bold", fontSize: 22, minWidth: 32, textAlign: "center" },
  chatBtn: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.card,
    justifyContent: "center", alignItems: "center", marginLeft: 8,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },

  submittedBar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.emerald + "15", paddingHorizontal: 16, paddingVertical: 8,
  },
  submittedText: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.emerald },
  inputsContent: { padding: 12, gap: 8 },
  categoryInputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  categoryLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.textSecondary, width: 72, textAlign: "right" },
  categoryInput: {
    flex: 1, backgroundColor: Colors.inputBg, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.inputBorder, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 16, fontFamily: "Cairo_400Regular", color: Colors.inputText,
  },
  categoryInputFilled: { borderColor: Colors.gold + "80", backgroundColor: Colors.gold + "10" },
  categoryInputSubmitted: { opacity: 0.6 },
  submitBtn: {
    position: "absolute", left: 16, right: 16, backgroundColor: Colors.gold,
    borderRadius: 16, paddingVertical: 16, flexDirection: "row",
    justifyContent: "center", alignItems: "center",
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  submitBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.black },
  submittedState: {
    position: "absolute", left: 16, right: 16, backgroundColor: Colors.emerald + "22",
    borderRadius: 16, paddingVertical: 16, flexDirection: "row",
    justifyContent: "center", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: Colors.emerald + "40",
  },
  submittedStateText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.emerald },

  // Quick chat panel
  chatPanelOverlay: {
    flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)",
  },
  chatPanel: {
    backgroundColor: Colors.backgroundSecondary, borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 20, paddingBottom: 40,
    borderTopWidth: 1, borderColor: Colors.cardBorder,
  },
  chatPanelTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textPrimary, textAlign: "center", marginBottom: 16 },
  chatMessagesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  chatMessageBtn: {
    backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 10, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  chatMessageText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textPrimary },

  // Round results
  roundResultsHeader: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder, backgroundColor: Colors.backgroundSecondary },
  roundResultsTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary, textAlign: "center" },
  roundResultsContent: { padding: 12, gap: 12, paddingBottom: 100 },
  resultPlayerCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  resultPlayerCardMe: { borderColor: Colors.gold + "60" },
  resultPlayerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  resultPlayerName: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.textPrimary },
  resultTotalBadge: { backgroundColor: Colors.gold + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  resultTotalText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.gold },
  resultCatRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5, borderTopWidth: 1, borderTopColor: Colors.cardBorder + "50" },
  resultCatName: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textMuted, width: 64, textAlign: "right" },
  resultAnswer: { flex: 1, fontFamily: "Cairo_400Regular", fontSize: 14, color: Colors.textPrimary, textAlign: "center", paddingHorizontal: 6 },
  resultAnswerEmpty: { color: Colors.textMuted },
  resultScoreBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, minWidth: 32, alignItems: "center" },
  resultScoreText: { fontFamily: "Cairo_700Bold", fontSize: 13 },
  scoreSummary: { backgroundColor: Colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  scoreSummaryTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.textPrimary, textAlign: "center", marginBottom: 10 },
  scoreSummaryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  scoreSummaryRank: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.gold, width: 30, textAlign: "center" },
  scoreSummaryName: { flex: 1, fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textPrimary, paddingHorizontal: 10 },
  scoreSummaryTotal: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textPrimary },
  nextRoundBtn: {
    backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 16,
    marginHorizontal: 16, marginVertical: 12, flexDirection: "row",
    justifyContent: "center", alignItems: "center",
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  nextRoundBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.black },
  waitingNextRound: { paddingVertical: 16, paddingHorizontal: 16, backgroundColor: Colors.card, marginHorizontal: 16, marginVertical: 12, borderRadius: 16, alignItems: "center" },
  waitingNextRoundText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textSecondary },

  // Game over
  gameOverContent: { padding: 20, alignItems: "center", paddingBottom: 40 },
  gameOverTitle: { fontFamily: "Cairo_700Bold", fontSize: 28, color: Colors.textPrimary, textAlign: "center", marginBottom: 6 },
  gameOverSub: { fontFamily: "Cairo_600SemiBold", fontSize: 16, color: Colors.textSecondary, textAlign: "center", marginBottom: 20 },
  podiumRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 8, width: "100%", marginBottom: 24 },
  podiumSlot: { alignItems: "center", flex: 1 },
  podiumMedal: { fontSize: 24, marginBottom: 4 },
  podiumAvatar: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  podiumAvatarFirst: { width: 64, height: 64, borderRadius: 32 },
  podiumEmoji: { fontSize: 26 },
  podiumEmojiFirst: { fontSize: 32 },
  podiumName: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: Colors.textPrimary, textAlign: "center", marginBottom: 2 },
  podiumScore: { fontFamily: "Cairo_700Bold", fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  podiumBase: { width: "100%", borderTopLeftRadius: 8, borderTopRightRadius: 8, justifyContent: "center", alignItems: "center", backgroundColor: Colors.cardBorder },
  podiumBaseFirst: { backgroundColor: Colors.gold + "60" },
  podiumRank: { fontFamily: "Cairo_700Bold", fontSize: 22, color: Colors.textPrimary },
  finalRankings: { width: "100%", gap: 10, marginBottom: 24 },
  finalRankRow: { backgroundColor: Colors.card, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: Colors.cardBorder, gap: 10 },
  finalRankRowMe: { borderColor: Colors.gold + "60", backgroundColor: Colors.gold + "08" },
  finalRankNum: { fontFamily: "Cairo_700Bold", fontSize: 20, width: 32, textAlign: "center" },
  finalRankAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  finalRankEmoji: { fontSize: 18 },
  finalRankName: { flex: 1, fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textPrimary },
  finalRankRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  finalRankScore: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary },
  bonusBanner: {
    backgroundColor: Colors.gold + "15", borderRadius: 14, padding: 14,
    width: "100%", gap: 8, borderWidth: 1, borderColor: Colors.gold + "30", marginBottom: 16,
  },
  bonusRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  bonusText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.gold },
  coinEntryInfo: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    marginBottom: 16,
  },
  coinEntryInfoText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textSecondary },
  coinRewardBadge: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.gold + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 3 },
  coinRewardText: { fontFamily: "Cairo_700Bold", fontSize: 12, color: Colors.gold },
  playAgainBtn: {
    backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 16,
    paddingHorizontal: 40, marginBottom: 12,
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  playAgainBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.black },
  homeBtn: { backgroundColor: Colors.card, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 40, borderWidth: 1, borderColor: Colors.cardBorder },
  homeBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 16, color: Colors.textSecondary },
});
