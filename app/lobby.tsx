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
  Animated,
  Modal,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
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
  const { profile, playerId, addCoins } = usePlayer();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ coinEntry?: string; action?: string; join?: string }>();
  const coinEntry = params.coinEntry ? parseInt(params.coinEntry, 10) : 0;
  // Quick match mode: opened from league screen with a coin entry amount
  const isQuickMatchMode = params.coinEntry !== undefined && !isNaN(coinEntry) && coinEntry >= 0;
  // Start directly in matchmaking tab when coming from league — no "select" screen flash
  const [tab, setTab] = useState<TabMode>(isQuickMatchMode ? "matchmaking" : "select");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite Friend modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState<{ id: string; name: string; skin: string; level: number }[]>([]);
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState<Set<string>>(new Set());
  const [socketId, setSocketId] = useState<string | null>(null);
  const [matchmakingStatus, setMatchmakingStatus] = useState("جاري البحث عن لاعبين...");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownPlayers, setCountdownPlayers] = useState<{ id: string; name: string; skin: string }[]>([]);

  // Voice chat state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingPlayers, setSpeakingPlayers] = useState<Set<string>>(new Set());
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakPulse = useRef(new Animated.Value(1)).current;

  const roomIdRef = useRef<string | null>(null);
  const actionInProgressRef = useRef(false);
  // Tracks active matchmaking so we can re-queue after a socket reconnect
  const isInMatchmakingRef = useRef(isQuickMatchMode);
  // Coin-safety refs: prevent refund once match has started, and prevent double-refund
  const matchStartedRef = useRef(false);
  const refundProcessedRef = useRef(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const equippedSkin = SKINS.find((s) => s.id === profile.equippedSkin) || SKINS[0];

  // Request mic permissions
  useEffect(() => {
    if (Platform.OS !== "web") {
      Audio.requestPermissionsAsync().then(({ status }) => {
        setHasMicPermission(status === "granted");
      });
    }
  }, []);

  // Speaking pulse animation
  useEffect(() => {
    if (isRecording && !isMuted) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(speakPulse, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(speakPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      speakPulse.setValue(1);
    }
  }, [isRecording, isMuted]);

  // Start/stop recording loop when voice is enabled
  useEffect(() => {
    if (voiceEnabled && !isMuted && hasMicPermission && roomIdRef.current) {
      startRecordingLoop();
    } else {
      stopRecordingLoop();
    }
    return () => stopRecordingLoop();
  }, [voiceEnabled, isMuted, hasMicPermission]);

  const startRecordingLoop = async () => {
    if (Platform.OS === "web") return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      setIsRecording(true);
      recordChunk();
      recordIntervalRef.current = setInterval(recordChunk, 1500);
    } catch (e) {
      console.log("Voice start error:", e);
    }
  };

  const stopRecordingLoop = () => {
    setIsRecording(false);
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
  };

  const recordChunk = async () => {
    if (!roomIdRef.current) return;
    try {
      if (recordingRef.current) {
        const uri = recordingRef.current.getURI();
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
        if (uri) {
          const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          getSocket().emit("voice_data", { roomId: roomIdRef.current, audio: base64, isSpeaking: true });
          FileSystem.deleteAsync(uri, { idempotent: true });
        }
      }
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.LOW_QUALITY
      );
      recordingRef.current = recording;
    } catch (e) {
      // Silently ignore recording errors
    }
  };

  const handleVoiceData = async (data: { audio: string; from: string; isSpeaking: boolean }) => {
    if (Platform.OS === "web") return;
    setSpeakingPlayers((prev) => {
      const next = new Set(prev);
      if (data.isSpeaking) next.add(data.from);
      else next.delete(data.from);
      return next;
    });
    setTimeout(() => {
      setSpeakingPlayers((prev) => { const next = new Set(prev); next.delete(data.from); return next; });
    }, 2000);

    try {
      if (!data.audio) return;
      const tmpUri = FileSystem.cacheDirectory + `voice_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(tmpUri, data.audio, { encoding: FileSystem.EncodingType.Base64 });
      const { sound } = await Audio.Sound.createAsync({ uri: tmpUri });
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded || status.didJustFinish) {
          sound.unloadAsync();
          FileSystem.deleteAsync(tmpUri, { idempotent: true });
        }
      });
    } catch (e) {
      // Silently ignore playback errors
    }
  };

  const toggleVoice = async () => {
    if (!hasMicPermission && Platform.OS !== "web") {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("إذن الميكروفون", "تحتاج إلى الإذن للوصول إلى الميكروفون");
        return;
      }
      setHasMicPermission(true);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVoiceEnabled((v) => !v);
  };

  const toggleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted((m) => !m);
  };

  useEffect(() => {
    const socket = getSocket();
    setSocketId(socket.id || null);

    const handleConnect = () => {
      setSocketId(socket.id || null);
      // If we were in the matchmaking queue, re-register with the new socket ID
      // (server removes the player from the queue on socket disconnect)
      if (isInMatchmakingRef.current) {
        socket.emit("findMatch", { playerName: profile.name, playerSkin: profile.equippedSkin, coinEntry, playerId });
        return;
      }
      const currentRoomId = roomIdRef.current;
      if (currentRoomId) {
        socket.emit(
          "join_room",
          { roomId: currentRoomId, playerName: profile.name, playerSkin: profile.equippedSkin },
          (res: { success: boolean; room?: RoomData; error?: string }) => {
            if (res.success && res.room) setRoom(res.room);
            else { roomIdRef.current = null; setRoom(null); setTab("select"); }
          }
        );
      }
    };

    const handleRoomUpdated = (roomData: RoomData) => {
      setRoom(roomData);
    };

    const handleGameStarted = (data: { letter: string; round: number; totalRounds: number }) => {
      const currentRoomId = roomIdRef.current;
      if (!currentRoomId) return;
      stopRecordingLoop();
      router.replace({
        pathname: "/game",
        params: { roomId: currentRoomId, letter: data.letter, round: String(data.round), totalRounds: String(data.totalRounds) },
      });
    };

    const handleMatchFound = (data: { roomId: string; letter: string; round: number; totalRounds: number; coinEntry?: number }) => {
      actionInProgressRef.current = false;
      isInMatchmakingRef.current = false;
      // Match has started — lock out any coin refund
      matchStartedRef.current = true;
      roomIdRef.current = data.roomId;
      router.replace({
        pathname: "/game",
        params: { roomId: data.roomId, letter: data.letter, round: String(data.round), totalRounds: String(data.totalRounds), coinEntry: String(data.coinEntry || coinEntry || 0) },
      });
    };

    const handleCountdown = (data: { count: number; players?: { id: string; name: string; skin: string }[] }) => {
      setCountdown(data.count);
      if (data.players) setCountdownPlayers(data.players);
    };

    const handleMatchError = (data: { error: string }) => {
      setLoading(false);
      actionInProgressRef.current = false;
      isInMatchmakingRef.current = false;
      const errorMsg = data.error === "insufficient_coins"
        ? "رصيدك غير كافي لهذه المباراة"
        : "خطأ في المطابقة، اضغط إلغاء للعودة";
      setMatchmakingStatus(errorMsg);
      // When in quick match mode (from league screen), stay on the matchmaking screen
      // so the user sees the error and can press Cancel — do NOT auto-navigate away.
      if (!isQuickMatchMode) {
        setTab("select");
      }
    };

    socket.on("connect", handleConnect);
    socket.on("room_updated", handleRoomUpdated);
    socket.on("game_started", handleGameStarted);
    socket.on("matchFound", handleMatchFound);
    socket.on("countdown", handleCountdown);
    socket.on("voice_data", handleVoiceData);
    socket.on("matchError", handleMatchError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("room_updated", handleRoomUpdated);
      socket.off("game_started", handleGameStarted);
      socket.off("matchFound", handleMatchFound);
      socket.off("countdown", handleCountdown);
      socket.off("voice_data", handleVoiceData);
      socket.off("matchError", handleMatchError);
    };
  }, []);

  // Auto-start matchmaking when opened from league screen with a coin entry amount.
  // Tab is already initialized as "matchmaking" so there is no "select" screen flash.
  useEffect(() => {
    if (isQuickMatchMode) {
      handleQuickMatch();
    }
  }, []);

  // Auto-create room when action=create, or show join tab when action=join
  useEffect(() => {
    if (params.action === "create") {
      setTab("create");
      setLoading(true);
      const t = setTimeout(() => handleCreateRoom(), 300);
      return () => clearTimeout(t);
    } else if (params.action === "join") {
      setTab("join");
    }
  }, []);

  // Auto-join room when join=ROOMID (from invite accept)
  useEffect(() => {
    if (params.join) {
      const roomCode = params.join.toUpperCase();
      const t = setTimeout(() => {
        setLoading(true);
        setError(null);
        const socket = getSocket();
        socket.emit(
          "join_room",
          { roomId: roomCode, playerName: profile.name, playerSkin: profile.equippedSkin },
          (res: { success: boolean; room?: RoomData; error?: string }) => {
            setLoading(false);
            if (res.success && res.room) {
              roomIdRef.current = res.room.id;
              setRoom(res.room);
              setTab("waiting");
            } else {
              setError(res.error === "room_not_found" ? "الغرفة غير موجودة أو انتهت"
                : res.error === "room_full" ? "الغرفة ممتلئة"
                : "فشل الانضمام للغرفة");
            }
          }
        );
      }, 300);
      return () => clearTimeout(t);
    }
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
          socket.emit("get_room", { roomId: res.roomId }, (roomRes: { room?: RoomData }) => {
            if (roomRes.room) setRoom(roomRes.room);
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
    if (!joinCode.trim() || joinCode.length < 4) { setError("الرجاء إدخال رمز صحيح"); return; }
    setLoading(true);
    setError(null);
    const socket = getSocket();
    socket.emit(
      "join_room",
      { roomId: joinCode.trim().toUpperCase(), playerName: profile.name, playerSkin: profile.equippedSkin },
      (res: { success: boolean; room?: RoomData; error?: string }) => {
        setLoading(false);
        if (res.success && res.room) {
          roomIdRef.current = res.room.id;
          setRoom(res.room);
          setTab("waiting");
        } else {
          setError(
            res.error === "room_not_found" ? t.roomNotFound
              : res.error === "room_full" ? t.roomFull
              : res.error === "game_in_progress" ? "اللعبة جارية بالفعل"
              : t.connectionError
          );
        }
      }
    );
  };

  const handleQuickMatch = () => {
    if (actionInProgressRef.current) return;
    actionInProgressRef.current = true;
    isInMatchmakingRef.current = true;
    setTab("matchmaking");
    setMatchmakingStatus("جاري البحث عن لاعب...");
    setLoading(true);
    const socket = getSocket();
    socket.emit("findMatch", { playerName: profile.name, playerSkin: profile.equippedSkin, coinEntry, playerId });
  };

  const handleCancelMatchmaking = () => {
    const socket = getSocket();
    socket.emit("cancelMatch");
    actionInProgressRef.current = false;
    isInMatchmakingRef.current = false;
    setLoading(false);

    // Refund entry fee only if:
    //  – there was an entry fee
    //  – the match has NOT started yet (matchStartedRef guards post-countdown state)
    //  – we haven't already processed a refund for this session
    if (coinEntry > 0 && !matchStartedRef.current && !refundProcessedRef.current) {
      refundProcessedRef.current = true;
      addCoins(coinEntry);
      setMatchmakingStatus("تم إلغاء البحث – تم إعادة العملات ✅");
      // Brief pause so the player can read the confirmation, then navigate away
      setTimeout(() => {
        if (params.coinEntry !== undefined) {
          router.back();
        } else {
          setTab("select");
        }
      }, 1400);
      return;
    }

    if (params.coinEntry !== undefined) {
      router.back();
    } else {
      setTab("select");
    }
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
    stopRecordingLoop();
    setVoiceEnabled(false);
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

  const loadFriends = async () => {
    try {
      const { getApiUrl } = await import("@/lib/query-client");
      const url = new URL(`/api/friends/${playerId}`, getApiUrl());
      const res = await fetch(url.toString());
      const data = await res.json();
      const accepted = (Array.isArray(data) ? data : [])
        .filter((f: { status: string }) => f.status === "accepted")
        .map((f: { player: { id: string; name: string; skin: string; level: number } }) => f.player);
      setFriends(accepted);
    } catch {}
  };

  const openInviteModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setInviteSent(new Set());
    setShowInviteModal(true);
    loadFriends();
  };

  const sendInvite = async (friendId: string) => {
    if (!room || inviteSending === friendId) return;
    setInviteSending(friendId);
    try {
      const { getApiUrl } = await import("@/lib/query-client");
      const url = new URL("/api/room-invites", getApiUrl());
      await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromPlayerId: playerId, toPlayerId: friendId, roomId: room.id, fromPlayerName: profile.name }),
      });
      setInviteSent((prev) => { const next = new Set(prev); next.add(friendId); return next; });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("خطأ", "فشل إرسال الدعوة");
    } finally {
      setInviteSending(null);
    }
  };

  // Countdown overlay (only for matchmaking, not friend rooms)
  if (countdown !== null && tab === "matchmaking") {
    const countColors: Record<number, string> = { 3: Colors.emerald, 2: Colors.gold, 1: Colors.ruby };
    const color = countColors[countdown] || Colors.gold;
    return (
      <View style={[styles.container, styles.countdownContainer, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
        {countdownPlayers.length >= 2 && (
          <View style={styles.vsRow}>
            {countdownPlayers.map((p, idx) => {
              const skin = SKINS.find((s) => s.id === p.skin) || SKINS[0];
              const isMe = p.id === socketId;
              return (
                <React.Fragment key={p.id}>
                  {idx === 1 && <Text style={styles.vsText}>VS</Text>}
                  <View style={styles.vsPlayer}>
                    <View style={[styles.vsAvatar, { backgroundColor: skin.color + "33" }]}>
                      <Text style={styles.vsEmoji}>{skin.emoji}</Text>
                    </View>
                    <Text style={[styles.vsName, isMe && { color: Colors.gold }]}>{p.name}{isMe ? " (أنت)" : ""}</Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        )}
        <Text style={styles.countdownLabel}>اللعبة تبدأ في</Text>
        <View style={[styles.countdownCircle, { borderColor: color }]}>
          <Text style={[styles.countdownNumber, { color }]}>{countdown}</Text>
        </View>
        <Text style={styles.countdownSub}>استعد!</Text>
      </View>
    );
  }

  // Waiting room (friend room)
  if (tab === "waiting" && room) {
    const amHost = isHost(room);
    const canStart = room.players.length >= 2;
    const filledSlots = room.players;
    const emptySlots = Math.max(0, 2 - filledSlots.length);

    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
        {/* ─── Invite Friend Modal ─── */}
        <Modal visible={showInviteModal} transparent animationType="slide" onRequestClose={() => setShowInviteModal(false)}>
          <View style={[styles.inviteOverlay, { backgroundColor: theme.overlay }]}>
            <View style={[styles.inviteSheet, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
              <View style={styles.inviteHeader}>
                <Text style={[styles.inviteTitle, { color: theme.textPrimary }]}>دعوة صديق</Text>
                <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                  <Ionicons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              {friends.length === 0 ? (
                <View style={styles.inviteEmpty}>
                  <Text style={styles.inviteEmptyText}>لا يوجد أصدقاء مضافون بعد</Text>
                  <Text style={styles.inviteEmptyHint}>أضف أصدقاء من قائمة الأصدقاء</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {friends.map((friend) => {
                    const skin = SKINS.find((s) => s.id === friend.skin) || SKINS[0];
                    const sent = inviteSent.has(friend.id);
                    const sending = inviteSending === friend.id;
                    return (
                      <View key={friend.id} style={styles.inviteFriendRow}>
                        <View style={[styles.inviteAvatar, { backgroundColor: skin.color + "33" }]}>
                          <Text style={styles.inviteAvatarEmoji}>{skin.emoji}</Text>
                        </View>
                        <View style={styles.inviteFriendInfo}>
                          <Text style={styles.inviteFriendName}>{friend.name}</Text>
                          <Text style={styles.inviteFriendLevel}>المستوى {friend.level}</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.inviteBtn, sent && styles.inviteBtnSent]}
                          onPress={() => sendInvite(friend.id)}
                          disabled={sent || sending}
                        >
                          {sending ? (
                            <ActivityIndicator size="small" color={"#000000"} />
                          ) : sent ? (
                            <>
                              <Ionicons name="checkmark" size={14} color={Colors.emerald} />
                              <Text style={[styles.inviteBtnText, { color: Colors.emerald }]}>أُرسلت</Text>
                            </>
                          ) : (
                            <>
                              <Ionicons name="paper-plane" size={14} color={"#000000"} />
                              <Text style={styles.inviteBtnText}>دعوة</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.card }]} onPress={handleBack}>
            <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>غرفة الأصدقاء</Text>
          <TouchableOpacity style={styles.codeBtn} onPress={copyRoomCode}>
            <Text style={styles.codeText}>{room.id}</Text>
            <Ionicons name="copy-outline" size={14} color={Colors.gold} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        <View style={[styles.roomCodeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.roomCodeLabel, { color: theme.textSecondary }]}>رمز الغرفة</Text>
          <Text style={[styles.roomCodeBig, { color: theme.textPrimary }]}>{room.id}</Text>
          <TouchableOpacity style={styles.copyCodeBtn} onPress={copyRoomCode}>
            <Ionicons name="copy-outline" size={16} color={Colors.gold} />
            <Text style={styles.copyCodeText}>نسخ الرمز</Text>
          </TouchableOpacity>
        </View>

        {/* Player Slots */}
        <View style={styles.playerSlotsContainer}>
          {filledSlots.map((player) => {
            const skin = SKINS.find((s) => s.id === player.skin) || SKINS[0];
            const isMe = player.id === socketId;
            return (
              <View key={player.id} style={styles.playerSlot}>
                <View style={[styles.playerSlotAvatar, { backgroundColor: skin.color + "33", borderColor: player.isHost ? Colors.gold : skin.color + "60" }]}>
                  <Text style={styles.playerSlotEmoji}>{skin.emoji}</Text>
                  {player.isHost && <View style={styles.hostCrown}><Text style={{ fontSize: 10 }}>👑</Text></View>}
                </View>
                <Text style={[styles.playerSlotName, isMe && { color: Colors.gold }]} numberOfLines={1}>
                  {player.name}{isMe ? " (أنت)" : ""}
                </Text>
                <Text style={styles.playerSlotStatus}>{player.isHost ? "مضيف" : "لاعب"}</Text>
              </View>
            );
          })}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <TouchableOpacity key={`empty-${i}`} style={styles.playerSlotEmpty} onPress={amHost ? openInviteModal : undefined} activeOpacity={amHost ? 0.7 : 1}>
              <View style={styles.playerSlotEmptyAvatar}>
                <Ionicons name="person-add" size={28} color={theme.textMuted} />
              </View>
              <Text style={styles.playerSlotEmptyText}>{amHost ? "اضغط لدعوة" : "في الانتظار..."}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Invite Friend button (host only) */}
        {amHost && (
          <TouchableOpacity style={styles.inviteFriendBtn} onPress={openInviteModal}>
            <Ionicons name="person-add" size={18} color={Colors.sapphire} />
            <Text style={styles.inviteFriendBtnText}>دعوة صديق</Text>
          </TouchableOpacity>
        )}


        {/* ─── VOICE CHAT PANEL (friend rooms only) ─── */}
        <View style={styles.voiceChatCard}>
          <View style={styles.voiceChatHeader}>
            <Ionicons name="mic" size={16} color={voiceEnabled ? Colors.emerald : theme.textMuted} />
            <Text style={styles.voiceChatTitle}>دردشة صوتية</Text>
            <TouchableOpacity
              style={[styles.voiceToggleBtn, voiceEnabled && styles.voiceToggleBtnActive]}
              onPress={toggleVoice}
            >
              <Text style={[styles.voiceToggleText, voiceEnabled && styles.voiceToggleTextActive]}>
                {voiceEnabled ? "متصل" : "تشغيل"}
              </Text>
            </TouchableOpacity>
          </View>

          {voiceEnabled && (
            <View style={styles.voiceControls}>
              {/* Speaking players indicators */}
              <View style={styles.speakingList}>
                {room.players.map((player) => {
                  const isSpeaking = speakingPlayers.has(player.id);
                  const skin = SKINS.find((s) => s.id === player.skin) || SKINS[0];
                  const isMe = player.id === socketId;
                  return (
                    <View key={player.id} style={styles.speakingPlayerRow}>
                      <View style={[styles.speakingAvatar, { backgroundColor: skin.color + "33" }]}>
                        <Text style={styles.speakingEmoji}>{skin.emoji}</Text>
                        {isSpeaking && (
                          <View style={styles.speakingDot} />
                        )}
                      </View>
                      <Text style={[styles.speakingName, isMe && { color: Colors.gold }]} numberOfLines={1}>
                        {player.name}{isMe ? " (أنت)" : ""}
                      </Text>
                      {isSpeaking && (
                        <View style={styles.speakingBadge}>
                          <Ionicons name="volume-high" size={12} color={Colors.emerald} />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Mic controls */}
              <View style={styles.micControls}>
                <Animated.View style={{ transform: [{ scale: isRecording && !isMuted ? speakPulse : 1 }] }}>
                  <TouchableOpacity
                    style={[styles.micBtn, isRecording && !isMuted && styles.micBtnActive]}
                    onPress={toggleMute}
                  >
                    <Ionicons
                      name={isMuted ? "mic-off" : "mic"}
                      size={24}
                      color={isMuted ? Colors.ruby : "#FFFFFF"}
                    />
                  </TouchableOpacity>
                </Animated.View>
                <Text style={styles.micLabel}>{isMuted ? "صوت مكتوم" : isRecording ? "يتم الإرسال..." : "ميكروفون"}</Text>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.playersTitle}>{t.players}: {room.players.length}/8</Text>

        <ScrollView style={styles.playersList} showsVerticalScrollIndicator={false}>
          {room.players.map((player, idx) => {
            const skin = SKINS.find((s) => s.id === player.skin) || SKINS[0];
            const isMe = player.id === socketId;
            const isSpeaking = speakingPlayers.has(player.id);
            const rarityRingColors: Record<string, string> = { common: "#00F5FF", rare: "#BF00FF", epic: "#FF006E", legendary: "#F5C842" };
            const ringColor = rarityRingColors[skin.rarity] || "#00F5FF";
            const isSpecialRarity = skin.rarity !== "common";
            return (
              <View key={player.id} style={[
                styles.playerRow,
                isMe && styles.playerRowMe,
                isMe && { borderColor: Colors.gold + "70", shadowColor: Colors.gold, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 },
              ]}>
                <View style={[
                  styles.playerAvatarSmall,
                  { backgroundColor: skin.color + "33" },
                  { borderWidth: isSpecialRarity ? 2 : 1.5, borderColor: ringColor + (isSpecialRarity ? "90" : "50") },
                  isSpecialRarity && { shadowColor: ringColor, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
                ]}>
                  <Text style={styles.playerAvatarEmoji}>{skin.emoji}</Text>
                  {isSpeaking && voiceEnabled && (
                    <View style={styles.speakingRing} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.playerRowName, isMe && { color: Colors.gold }]}>{player.name}{isMe ? " (أنت)" : ""}</Text>
                  {player.isHost && (
                    <Text style={styles.playerRoleText}>مضيف الغرفة</Text>
                  )}
                </View>
                <View style={styles.playerRowRight}>
                  {isSpeaking && voiceEnabled && (
                    <View style={styles.speakingActiveBadge}>
                      <Ionicons name="volume-high" size={12} color={Colors.emerald} />
                    </View>
                  )}
                  {player.isHost && (
                    <View style={styles.hostBadge}>
                      <Ionicons name="star" size={10} color={Colors.gold} />
                    </View>
                  )}
                  <View style={[styles.playerIndexBadge, { backgroundColor: "#1E1E3A" }]}>
                    <Text style={styles.playerIndexText}>{idx + 1}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.minPlayersHint}>
          <Ionicons name="information-circle-outline" size={14} color={theme.textMuted} />
          <Text style={styles.minPlayersText}>الحد الأدنى ٢ لاعبين للبدء</Text>
        </View>

        {amHost ? (
          <TouchableOpacity
            style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
            onPress={handleStartGame}
            disabled={!canStart}
          >
            {!canStart ? (
              <Text style={[styles.startBtnText, { color: theme.textMuted }]}>في انتظار لاعبين...</Text>
            ) : (
              <>
                <Ionicons name="play" size={20} color={"#000000"} style={{ marginRight: 8 }} />
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
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.card }]} onPress={handleCancelMatchmaking}>
            <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>المباراة السريعة</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.matchmakingContainer}>
          <View style={styles.matchmakingCircle}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
          <Text style={[styles.matchmakingTitle, { color: theme.textPrimary }]}>جاري البحث...</Text>
          <Text style={[styles.matchmakingStatus, { color: theme.textSecondary }]}>{matchmakingStatus}</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelMatchmaking}>
            <Text style={styles.cancelBtnText}>{t.cancel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main select screen
  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{tab === "join" ? t.joinRoom : "اللعب مع الأصدقاء"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.selectContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.miniProfile, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={[styles.miniAvatarCircle, { backgroundColor: equippedSkin.color + "33" }]}>
            <Text style={styles.miniAvatarEmoji}>{equippedSkin.emoji}</Text>
          </View>
          <View>
            <Text style={[styles.miniPlayerName, { color: theme.textPrimary }]}>{profile.name}</Text>
            <Text style={[styles.miniPlayerLevel, { color: theme.textMuted }]}>المستوى {profile.level}</Text>
          </View>
        </View>

        {tab === "select" && (
          <View style={styles.selectButtons}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>اختر طريقة اللعب</Text>

            <TouchableOpacity
              style={styles.lobbyOptionCard}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setTab("create"); handleCreateRoom(); }}
              activeOpacity={0.85}
            >
              <View style={styles.lobbyOptionIcon}>
                <Ionicons name="add-circle" size={32} color={Colors.emerald} />
              </View>
              <View style={styles.lobbyOptionText}>
                <Text style={[styles.lobbyOptionTitle, { color: theme.textPrimary }]}>{t.createRoom}</Text>
                <Text style={[styles.lobbyOptionSubtitle, { color: theme.textSecondary }]}>أنشئ غرفة وادعو أصدقاءك</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.lobbyOptionCard}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setTab("join"); }}
              activeOpacity={0.85}
            >
              <View style={styles.lobbyOptionIcon}>
                <Ionicons name="enter" size={32} color={Colors.sapphire} />
              </View>
              <View style={styles.lobbyOptionText}>
                <Text style={[styles.lobbyOptionTitle, { color: theme.textPrimary }]}>{t.joinRoom}</Text>
                <Text style={[styles.lobbyOptionSubtitle, { color: theme.textSecondary }]}>انضم لغرفة موجودة بالرمز</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
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
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.enterRoomCode}</Text>
            <TextInput
              style={[styles.codeInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
              value={joinCode}
              onChangeText={(v) => { setJoinCode(v.toUpperCase()); setError(null); }}
              placeholder="XXXX"
              placeholderTextColor={theme.inputPlaceholder}
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
                <ActivityIndicator size="small" color={"#000000"} />
              ) : (
                <Text style={[styles.startBtnText, joinCode.length < 4 && { color: theme.textMuted }]}>{t.joinRoom}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.backLinkBtn} onPress={() => { setTab("select"); setError(null); setJoinCode(""); }}>
              <Ionicons name="arrow-back" size={16} color={theme.textMuted} />
              <Text style={styles.backLinkText}>رجوع</Text>
            </TouchableOpacity>
          </View>
        )}

        {error && tab !== "join" && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1E1E3A",
    backgroundColor: "#0E0E24",
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { flex: 1, fontFamily: "Cairo_700Bold", fontSize: 18, color: "#E8E8FF", textAlign: "center" },
  codeBtn: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.gold + "20", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  codeText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.gold },

  // Lobby select
  selectContent: { padding: 16, gap: 16 },
  miniProfile: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#12122A", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#1E1E3A" },
  miniAvatarCircle: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center" },
  miniAvatarEmoji: { fontSize: 24 },
  miniPlayerName: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#E8E8FF" },
  miniPlayerLevel: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#5A5A88" },
  sectionTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#E8E8FF", textAlign: "right", marginBottom: 4 },
  selectButtons: { gap: 12 },
  lobbyOptionCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#12122A",
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#1E1E3A", gap: 14,
  },
  lobbyOptionCardPrimary: { borderColor: Colors.gold + "40", backgroundColor: Colors.gold + "08" },
  lobbyOptionIcon: { width: 58, height: 58, borderRadius: 16, backgroundColor: "#0E0E24", justifyContent: "center", alignItems: "center" },
  lobbyOptionText: { flex: 1 },
  lobbyOptionTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#E8E8FF", marginBottom: 2 },
  lobbyOptionSubtitle: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#5A5A88" },

  loadingContainer: { alignItems: "center", paddingVertical: 40, gap: 16 },
  loadingText: { fontFamily: "Cairo_400Regular", fontSize: 14, color: "#9898CC" },

  joinContainer: { gap: 12 },
  codeInput: {
    backgroundColor: "#0E0E24", borderRadius: 16, borderWidth: 2, borderColor: "#1E1E3A",
    paddingVertical: 20, fontSize: 32, fontFamily: "Cairo_700Bold", color: Colors.gold,
    letterSpacing: 12,
  },
  errorText: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.ruby, textAlign: "center" },
  backLinkBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  backLinkText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#5A5A88" },

  // Waiting room
  roomCodeCard: { backgroundColor: "#12122A", borderRadius: 20, padding: 20, alignItems: "center", marginHorizontal: 16, marginBottom: 12, borderWidth: 2, borderColor: Colors.gold + "40" },
  roomCodeLabel: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#5A5A88", marginBottom: 8 },
  roomCodeBig: { fontFamily: "Cairo_700Bold", fontSize: 48, color: Colors.gold, letterSpacing: 12, marginBottom: 4 },
  roomCodeHint: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#5A5A88" },

  // Voice chat
  voiceChatCard: {
    backgroundColor: "#12122A" + "80", borderRadius: 16, marginHorizontal: 16,
    marginBottom: 12, padding: 14, borderWidth: 1, borderColor: "#1E1E3A",
  },
  voiceChatHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  voiceChatTitle: { flex: 1, fontFamily: "Cairo_700Bold", fontSize: 14, color: "#E8E8FF" },
  voiceToggleBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12,
    backgroundColor: "#0E0E24", borderWidth: 1, borderColor: "#1E1E3A",
  },
  voiceToggleBtnActive: { backgroundColor: Colors.emerald + "22", borderColor: Colors.emerald + "60" },
  voiceToggleText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#5A5A88" },
  voiceToggleTextActive: { color: Colors.emerald },
  voiceControls: { marginTop: 12, gap: 10 },
  speakingList: { gap: 6 },
  speakingPlayerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  speakingAvatar: { width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center", position: "relative" },
  speakingEmoji: { fontSize: 16 },
  speakingDot: { position: "absolute", bottom: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.emerald, borderWidth: 1, borderColor: "#0A0A1A" },
  speakingName: { flex: 1, fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#E8E8FF" },
  speakingBadge: { backgroundColor: Colors.emerald + "22", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  micControls: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#1E1E3A" },
  micBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#0E0E24",
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#1E1E3A",
  },
  micBtnActive: { backgroundColor: Colors.emerald, borderColor: Colors.emerald },
  micLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#9898CC" },

  playersTitle: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#9898CC", paddingHorizontal: 16, marginBottom: 8 },
  playersList: { flex: 1, paddingHorizontal: 16 },
  playerRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#12122A", borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#1E1E3A" },
  playerRowMe: { borderColor: Colors.gold + "60", backgroundColor: Colors.gold + "06" },
  playerAvatarSmall: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center", marginRight: 12, position: "relative" },
  speakingRing: { position: "absolute", top: -3, left: -3, right: -3, bottom: -3, borderRadius: 26, borderWidth: 2, borderColor: Colors.emerald + "CC" },
  speakingActiveBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.emerald + "22", justifyContent: "center", alignItems: "center" },
  playerRoleText: { fontFamily: "Cairo_400Regular", fontSize: 10, color: Colors.gold + "AA", marginTop: 1 },
  playerIndexBadge: { width: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  playerIndexText: { fontFamily: "Cairo_700Bold", fontSize: 10, color: "#9898CC" },
  playerAvatarEmoji: { fontSize: 22 },
  playerRowName: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "#E8E8FF" },
  playerRowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  hostBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.gold + "22", justifyContent: "center", alignItems: "center" },
  hostBadgeText: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: Colors.gold },
  minPlayersHint: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 16, paddingVertical: 8 },
  minPlayersText: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#5A5A88" },
  startBtn: {
    backgroundColor: Colors.gold, borderRadius: 16, minHeight: 48, marginHorizontal: 16,
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  startBtnDisabled: { backgroundColor: "#12122A", shadowOpacity: 0, elevation: 0 },
  startBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#000000" },
  waitingBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 16, backgroundColor: "#12122A", marginHorizontal: 16, borderRadius: 16 },
  waitingText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#9898CC" },

  // Matchmaking
  matchmakingContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 20 },
  matchmakingCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.gold + "15", borderWidth: 2, borderColor: Colors.gold + "30", justifyContent: "center", alignItems: "center" },
  matchmakingTitle: { fontFamily: "Cairo_700Bold", fontSize: 24, color: "#E8E8FF" },
  matchmakingStatus: { fontFamily: "Cairo_400Regular", fontSize: 14, color: "#9898CC", textAlign: "center" },
  cancelBtn: { backgroundColor: "#12122A", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32, borderWidth: 1, borderColor: "#1E1E3A" },
  cancelBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "#9898CC" },

  // Countdown
  countdownContainer: { alignItems: "center", justifyContent: "center", gap: 20 },
  countdownLabel: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#9898CC" },
  countdownCircle: { width: 160, height: 160, borderRadius: 80, borderWidth: 4, justifyContent: "center", alignItems: "center", backgroundColor: "#0E0E24" },
  countdownNumber: { fontFamily: "Cairo_700Bold", fontSize: 72, lineHeight: 80 },
  countdownSub: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#E8E8FF" },
  vsRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 8 },
  vsPlayer: { alignItems: "center", gap: 8 },
  vsAvatar: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  vsEmoji: { fontSize: 36 },
  vsName: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#E8E8FF", textAlign: "center", maxWidth: 100 },
  vsText: { fontFamily: "Cairo_700Bold", fontSize: 22, color: Colors.ruby },

  // Room code copy button
  copyCodeBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: Colors.gold + "15", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  copyCodeText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.gold },

  // Player Slots
  playerSlotsContainer: { flexDirection: "row", justifyContent: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 12 },
  playerSlot: { flex: 1, alignItems: "center", backgroundColor: "#12122A", borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: "#1E1E3A" },
  playerSlotAvatar: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", borderWidth: 2, marginBottom: 8, position: "relative" },
  playerSlotEmoji: { fontSize: 30 },
  hostCrown: { position: "absolute", top: -6, right: -6 },
  playerSlotName: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#E8E8FF", textAlign: "center" },
  playerSlotStatus: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "#5A5A88", marginTop: 2 },
  playerSlotEmpty: { flex: 1, alignItems: "center", backgroundColor: "#0E0E24", borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: "#1E1E3A", borderStyle: "dashed" },
  playerSlotEmptyAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#14142E", justifyContent: "center", alignItems: "center", marginBottom: 8 },
  playerSlotEmptyText: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#5A5A88", textAlign: "center" },

  // Invite Friend button
  inviteFriendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, marginBottom: 4, paddingVertical: 12, borderRadius: 14, backgroundColor: Colors.sapphire + "18", borderWidth: 1, borderColor: Colors.sapphire + "40" },
  inviteFriendBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: Colors.sapphire },

  // Invite Friend Modal
  inviteOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  inviteSheet: { backgroundColor: "#0E0E24", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: "70%" },
  inviteHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  inviteTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#E8E8FF" },
  inviteEmpty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  inviteEmptyText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "#9898CC" },
  inviteEmptyHint: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#5A5A88" },
  inviteFriendRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1E1E3A", gap: 12 },
  inviteAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  inviteAvatarEmoji: { fontSize: 22 },
  inviteFriendInfo: { flex: 1 },
  inviteFriendName: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#E8E8FF" },
  inviteFriendLevel: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#5A5A88" },
  inviteBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.gold, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  inviteBtnSent: { backgroundColor: Colors.emerald + "20", borderWidth: 1, borderColor: Colors.emerald + "40" },
  inviteBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#000000" },
});
