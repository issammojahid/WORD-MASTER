import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";
import { getSocket } from "@/services/socket";

type Player = {
  id: string;
  name: string;
  skin: string;
  score: number;
  isHost: boolean;
  isReady: boolean;
};

type RoomData = {
  id: string;
  state: string;
  players: Player[];
  currentLetter: string;
  currentRound: number;
  totalRounds: number;
};

type TabMode = "select" | "create" | "join" | "waiting" | "matchmaking";

export default function LobbyScreen() {
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { profile } = usePlayer();
  const [tab, setTab] = useState<TabMode>("select");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [matchmakingStatus, setMatchmakingStatus] = useState("جاري البحث عن لاعبين...");

  // Store roomId in a ref so game_started handler never has stale closure
  const roomIdRef = useRef<string | null>(null);
  // Guard against double-tap on matchmaking/create buttons
  const actionInProgressRef = useRef(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const equippedSkin = SKINS.find((s) => s.id === profile.equippedSkin) || SKINS[0];

  useEffect(() => {
    const socket = getSocket();
    setSocketId(socket.id || null);

    const handleConnect = () => {
      setSocketId(socket.id || null);
      // If we were in a room before reconnecting, rejoin it
      const currentRoomId = roomIdRef.current;
      if (currentRoomId) {
        socket.emit(
          "join_room",
          { roomId: currentRoomId, playerName: profile.name, playerSkin: profile.equippedSkin },
          (res: { success: boolean; room?: RoomData; error?: string }) => {
            if (res.success && res.room) {
              setRoom(res.room);
            } else {
              roomIdRef.current = null;
              setRoom(null);
              setTab("select");
            }
          }
        );
      }
    };

    const handleRoomUpdated = (roomData: RoomData) => setRoom(roomData);

    // Legacy: manual room start
    const handleGameStarted = (data: { letter: string; round: number; totalRounds: number }) => {
      const currentRoomId = roomIdRef.current;
      if (!currentRoomId) return;
      router.replace({
        pathname: "/game",
        params: {
          roomId: currentRoomId,
          letter: data.letter,
          round: String(data.round),
          totalRounds: String(data.totalRounds),
        },
      });
    };

    // New matchmaking: navigate straight to game when match is found
    const handleMatchFound = (data: {
      roomId: string;
      letter: string;
      round: number;
      totalRounds: number;
    }) => {
      actionInProgressRef.current = false;
      roomIdRef.current = data.roomId;
      router.replace({
        pathname: "/game",
        params: {
          roomId: data.roomId,
          letter: data.letter,
          round: String(data.round),
          totalRounds: String(data.totalRounds),
        },
      });
    };

    socket.on("connect", handleConnect);
    socket.on("room_updated", handleRoomUpdated);
    socket.on("game_started", handleGameStarted);
    socket.on("matchFound", handleMatchFound);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("room_updated", handleRoomUpdated);
      socket.off("game_started", handleGameStarted);
      socket.off("matchFound", handleMatchFound);
    };
  }, []);

  const isHost = (r: RoomData | null) => {
    if (!r || !socketId) return false;
    const me = r.players.find((p) => p.id === socketId);
    return me?.isHost || false;
  };

  const handleCreateRoom = () => {
    if (actionInProgressRef.current) return;
    actionInProgressRef.current = true;
    setLoading(true);
    setError(null);
    const socket = getSocket();
    socket.emit(
      "create_room",
      { playerName: profile.name, playerSkin: profile.equippedSkin },
      (res: { success: boolean; roomId?: string; room?: RoomData; error?: string }) => {
        actionInProgressRef.current = false;
        setLoading(false);
        if (res.success && res.roomId) {
          roomIdRef.current = res.roomId;
          // Get room data via get_room since create_room only returns roomId
          socket.emit("get_room", { roomId: res.roomId }, (roomRes: { room?: RoomData }) => {
            if (roomRes.room) {
              setRoom(roomRes.room);
            }
          });
          setTab("waiting");
        } else {
          setTab("select");
          setError(res.error || "خطأ في إنشاء الغرفة");
        }
      }
    );
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim() || joinCode.length < 4) {
      setError("الرجاء إدخال رمز صحيح");
      return;
    }
    setLoading(true);
    setError(null);
    const socket = getSocket();
    socket.emit(
      "join_room",
      {
        roomId: joinCode.trim().toUpperCase(),
        playerName: profile.name,
        playerSkin: profile.equippedSkin,
      },
      (res: { success: boolean; room?: RoomData; error?: string }) => {
        setLoading(false);
        if (res.success && res.room) {
          roomIdRef.current = res.room.id;
          setRoom(res.room);
          setTab("waiting");
        } else {
          setError(
            res.error === "room_not_found"
              ? t.roomNotFound
              : res.error === "room_full"
              ? t.roomFull
              : res.error === "game_in_progress"
              ? "اللعبة جارية بالفعل"
              : t.connectionError
          );
        }
      }
    );
  };

  const handleQuickMatch = () => {
    if (actionInProgressRef.current) return;
    actionInProgressRef.current = true;
    setTab("matchmaking");
    setMatchmakingStatus("جاري البحث عن لاعب...");
    setLoading(true);
    const socket = getSocket();
    // New queue-based matchmaking: emit once, wait for matchFound event
    socket.emit("findMatch", { playerName: profile.name, playerSkin: profile.equippedSkin });
  };

  const handleCancelMatchmaking = () => {
    const socket = getSocket();
    socket.emit("cancelMatch");
    actionInProgressRef.current = false;
    setTab("select");
    setLoading(false);
  };

  const handleStartGame = () => {
    if (!room) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const socket = getSocket();
    socket.emit("start_game", { roomId: room.id }, (res: { success: boolean; error?: string }) => {
      if (!res.success) {
        Alert.alert(t.error, res.error === "need_more_players" ? "تحتاج لاعبَين على الأقل" : "فشل البدء");
      }
    });
  };

  const handleBack = () => {
    if (room) {
      const socket = getSocket();
      socket.emit("leave_room", { roomId: room.id });
    }
    setTab("select");
    setRoom(null);
    roomIdRef.current = null;
    setError(null);
    setJoinCode("");
    setLoading(false);
  };

  const copyRoomCode = () => {
    if (!room) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(t.roomCode, room.id);
  };

  // Waiting room screen
  if (tab === "waiting" && room) {
    const amHost = isHost(room);
    const canStart = room.players.length >= 2;

    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.waitingForPlayers}</Text>
          <TouchableOpacity style={styles.codeBtn} onPress={copyRoomCode}>
            <Text style={styles.codeText}>{room.id}</Text>
            <Ionicons name="copy-outline" size={14} color={Colors.gold} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.roomCodeCard}>
          <Text style={styles.roomCodeLabel}>{t.roomCode}</Text>
          <Text style={styles.roomCodeBig}>{room.id}</Text>
          <Text style={styles.roomCodeHint}>شارك الرمز مع أصدقائك</Text>
        </View>

        <Text style={styles.playersTitle}>
          {t.players}: {room.players.length}/8
        </Text>

        <ScrollView style={styles.playersList} showsVerticalScrollIndicator={false}>
          {room.players.map((player) => {
            const skin = SKINS.find((s) => s.id === player.skin) || SKINS[0];
            const isMe = player.id === socketId;
            return (
              <View key={player.id} style={[styles.playerRow, isMe && styles.playerRowMe]}>
                <View style={[styles.playerAvatarSmall, { backgroundColor: skin.color + "33" }]}>
                  <Text style={styles.playerAvatarEmoji}>{skin.emoji}</Text>
                </View>
                <Text style={styles.playerRowName}>
                  {player.name}{isMe ? " (أنت)" : ""}
                </Text>
                <View style={styles.playerRowRight}>
                  {player.isHost && (
                    <View style={styles.hostBadge}>
                      <Ionicons name="star" size={10} color={Colors.gold} />
                      <Text style={styles.hostBadgeText}>مضيف</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.minPlayersHint}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.minPlayersText}>الحد الأدنى ٢ لاعبين للبدء</Text>
        </View>

        {amHost ? (
          <TouchableOpacity
            style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
            onPress={handleStartGame}
            disabled={!canStart}
          >
            {!canStart ? (
              <Text style={[styles.startBtnText, { color: Colors.textMuted }]}>في انتظار لاعبين...</Text>
            ) : (
              <>
                <Ionicons name="play" size={20} color={Colors.black} style={{ marginRight: 8 }} />
                <Text style={styles.startBtnText}>{t.startGame}</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.waitingBar}>
            <ActivityIndicator size="small" color={Colors.gold} />
            <Text style={styles.waitingText}>في انتظار المضيف لبدء اللعبة...</Text>
          </View>
        )}
      </View>
    );
  }

  // Matchmaking searching screen
  if (tab === "matchmaking") {
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleCancelMatchmaking}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>المباراة السريعة</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.matchmakingContainer}>
          <View style={styles.matchmakingCircle}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
          <Text style={styles.matchmakingTitle}>جاري البحث...</Text>
          <Text style={styles.matchmakingStatus}>{matchmakingStatus}</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelMatchmaking}>
            <Text style={styles.cancelBtnText}>{t.cancel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main select screen
  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {tab === "join" ? t.joinRoom : t.playOnline}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.selectContent} showsVerticalScrollIndicator={false}>
        {/* Profile mini */}
        <View style={styles.miniProfile}>
          <View style={[styles.miniAvatarCircle, { backgroundColor: equippedSkin.color + "33" }]}>
            <Text style={styles.miniAvatarEmoji}>{equippedSkin.emoji}</Text>
          </View>
          <View>
            <Text style={styles.miniPlayerName}>{profile.name}</Text>
            <Text style={styles.miniPlayerLevel}>المستوى {profile.level}</Text>
          </View>
        </View>

        {tab === "select" && (
          <View style={styles.selectButtons}>
            <Text style={styles.sectionTitle}>كيف تريد اللعب؟</Text>

            {/* Quick Match */}
            <TouchableOpacity
              style={[styles.lobbyOptionCard, styles.lobbyOptionCardPrimary]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleQuickMatch(); }}
              activeOpacity={0.85}
            >
              <View style={[styles.lobbyOptionIcon, { backgroundColor: Colors.gold + "22" }]}>
                <Ionicons name="flash" size={32} color={Colors.gold} />
              </View>
              <View style={styles.lobbyOptionText}>
                <Text style={styles.lobbyOptionTitle}>مباراة سريعة</Text>
                <Text style={styles.lobbyOptionSubtitle}>انضم فوراً لأقرب مباراة متاحة</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>

            {/* Create Room */}
            <TouchableOpacity
              style={styles.lobbyOptionCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setTab("create");
                handleCreateRoom();
              }}
              activeOpacity={0.85}
            >
              <View style={styles.lobbyOptionIcon}>
                <Ionicons name="add-circle" size={32} color={Colors.emerald} />
              </View>
              <View style={styles.lobbyOptionText}>
                <Text style={styles.lobbyOptionTitle}>{t.createRoom}</Text>
                <Text style={styles.lobbyOptionSubtitle}>أنشئ غرفة وادعو أصدقاءك</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>

            {/* Join Room */}
            <TouchableOpacity
              style={styles.lobbyOptionCard}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setTab("join"); }}
              activeOpacity={0.85}
            >
              <View style={styles.lobbyOptionIcon}>
                <Ionicons name="enter" size={32} color={Colors.sapphire} />
              </View>
              <View style={styles.lobbyOptionText}>
                <Text style={styles.lobbyOptionTitle}>{t.joinRoom}</Text>
                <Text style={styles.lobbyOptionSubtitle}>انضم لغرفة موجودة بالرمز</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {tab === "create" && loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.loadingText}>جاري إنشاء الغرفة...</Text>
          </View>
        )}

        {tab === "join" && (
          <View style={styles.joinContainer}>
            <Text style={styles.sectionTitle}>{t.enterRoomCode}</Text>
            <TextInput
              style={styles.codeInput}
              value={joinCode}
              onChangeText={(v) => { setJoinCode(v.toUpperCase()); setError(null); }}
              placeholder="XXXX"
              placeholderTextColor={Colors.inputPlaceholder}
              maxLength={4}
              autoCapitalize="characters"
              autoFocus
              textAlign="center"
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            <TouchableOpacity
              style={[styles.startBtn, (loading || joinCode.length < 4) && styles.startBtnDisabled]}
              onPress={handleJoinRoom}
              disabled={loading || joinCode.length < 4}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.black} />
              ) : (
                <Text style={[styles.startBtnText, joinCode.length < 4 && { color: Colors.textMuted }]}>
                  {t.joinRoom}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.backLinkBtn} onPress={() => { setTab("select"); setError(null); setJoinCode(""); }}>
              <Ionicons name="arrow-back" size={16} color={Colors.textMuted} />
              <Text style={styles.backLinkText}>رجوع</Text>
            </TouchableOpacity>
          </View>
        )}

        {error && tab !== "join" && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.card, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary },
  codeBtn: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.card, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  codeText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.gold, letterSpacing: 2 },
  selectContent: { padding: 20, paddingBottom: 40 },
  miniProfile: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  miniAvatarCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  miniAvatarEmoji: { fontSize: 24 },
  miniPlayerName: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textPrimary },
  miniPlayerLevel: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted },
  sectionTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textSecondary, marginBottom: 16, textAlign: "center" },
  selectButtons: { gap: 14 },
  lobbyOptionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  lobbyOptionCardPrimary: { borderColor: Colors.gold + "40", backgroundColor: Colors.gold + "08" },
  lobbyOptionIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.backgroundTertiary, justifyContent: "center", alignItems: "center", marginRight: 14 },
  lobbyOptionText: { flex: 1 },
  lobbyOptionTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textPrimary, marginBottom: 2 },
  lobbyOptionSubtitle: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted },
  loadingContainer: { alignItems: "center", paddingVertical: 60, gap: 16 },
  loadingText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  joinContainer: { gap: 16 },
  codeInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 24,
    paddingVertical: 18,
    fontSize: 32,
    fontFamily: "Cairo_700Bold",
    color: Colors.gold,
    textAlign: "center",
    letterSpacing: 8,
  },
  errorText: { fontFamily: "Cairo_400Regular", fontSize: 14, color: Colors.ruby, textAlign: "center" },
  backLinkBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  backLinkText: { fontFamily: "Cairo_400Regular", fontSize: 14, color: Colors.textMuted },
  roomCodeCard: { backgroundColor: Colors.card, borderRadius: 20, padding: 20, alignItems: "center", marginHorizontal: 16, marginBottom: 20, borderWidth: 2, borderColor: Colors.gold + "40" },
  roomCodeLabel: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted, marginBottom: 8 },
  roomCodeBig: { fontFamily: "Cairo_700Bold", fontSize: 48, color: Colors.gold, letterSpacing: 12, marginBottom: 4 },
  roomCodeHint: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted },
  playersTitle: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.textSecondary, paddingHorizontal: 16, marginBottom: 10 },
  playersList: { flex: 1, paddingHorizontal: 16 },
  playerRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.cardBorder },
  playerRowMe: { borderColor: Colors.gold + "60" },
  playerAvatarSmall: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginRight: 12 },
  playerAvatarEmoji: { fontSize: 20 },
  playerRowName: { flex: 1, fontFamily: "Cairo_600SemiBold", fontSize: 15, color: Colors.textPrimary },
  playerRowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  hostBadge: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.gold + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 3 },
  hostBadgeText: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: Colors.gold },
  minPlayersHint: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 16, paddingVertical: 8 },
  minPlayersText: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted },
  startBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 16,
    paddingVertical: 16,
    marginHorizontal: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  startBtnDisabled: { backgroundColor: Colors.card, shadowOpacity: 0, elevation: 0 },
  startBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.black },
  waitingBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 16, backgroundColor: Colors.card, marginHorizontal: 16, borderRadius: 16 },
  waitingText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  matchmakingContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 20 },
  matchmakingCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.gold + "15", borderWidth: 2, borderColor: Colors.gold + "30", justifyContent: "center", alignItems: "center" },
  matchmakingTitle: { fontFamily: "Cairo_700Bold", fontSize: 24, color: Colors.textPrimary },
  matchmakingStatus: { fontFamily: "Cairo_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  cancelBtn: { backgroundColor: Colors.card, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32, borderWidth: 1, borderColor: Colors.cardBorder },
  cancelBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: Colors.textSecondary },
});
