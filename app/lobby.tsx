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
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
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

    const handleRoomUpdated = (roomData: RoomData) => setRoom(roomData);

    const handleGameStarted = (data: { letter: string; round: number; totalRounds: number }) => {
      const currentRoomId = roomIdRef.current;
      if (!currentRoomId) return;
      stopRecordingLoop();
      router.replace({
        pathname: "/game",
        params: { roomId: currentRoomId, letter: data.letter, round: String(data.round), totalRounds: String(data.totalRounds) },
      });
    };

    const handleMatchFound = (data: { roomId: string; letter: string; round: number; totalRounds: number }) => {
      actionInProgressRef.current = false;
      roomIdRef.current = data.roomId;
      router.replace({
        pathname: "/game",
        params: { roomId: data.roomId, letter: data.letter, round: String(data.round), totalRounds: String(data.totalRounds) },
      });
    };

    const handleCountdown = (data: { count: number; players?: { id: string; name: string; skin: string }[] }) => {
      setCountdown(data.count);
      if (data.players) setCountdownPlayers(data.players);
    };

    socket.on("connect", handleConnect);
    socket.on("room_updated", handleRoomUpdated);
    socket.on("game_started", handleGameStarted);
    socket.on("matchFound", handleMatchFound);
    socket.on("countdown", handleCountdown);
    socket.on("voice_data", handleVoiceData);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("room_updated", handleRoomUpdated);
      socket.off("game_started", handleGameStarted);
      socket.off("matchFound", handleMatchFound);
      socket.off("countdown", handleCountdown);
      socket.off("voice_data", handleVoiceData);
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
    setTab("matchmaking");
    setMatchmakingStatus("جاري البحث عن لاعب...");
    setLoading(true);
    const socket = getSocket();
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

  // Countdown overlay
  if (countdown !== null) {
    const countColors: Record<number, string> = { 3: Colors.emerald, 2: Colors.gold, 1: Colors.ruby };
    const color = countColors[countdown] || Colors.gold;
    return (
      <View style={[styles.container, styles.countdownContainer, { paddingTop: topInset, paddingBottom: bottomInset }]}>
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

        {/* ─── VOICE CHAT PANEL (friend rooms only) ─── */}
        <View style={styles.voiceChatCard}>
          <View style={styles.voiceChatHeader}>
            <Ionicons name="mic" size={16} color={voiceEnabled ? Colors.emerald : Colors.textMuted} />
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
                      color={isMuted ? Colors.ruby : Colors.white}
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
          {room.players.map((player) => {
            const skin = SKINS.find((s) => s.id === player.skin) || SKINS[0];
            const isMe = player.id === socketId;
            const isSpeaking = speakingPlayers.has(player.id);
            return (
              <View key={player.id} style={[styles.playerRow, isMe && styles.playerRowMe]}>
                <View style={[styles.playerAvatarSmall, { backgroundColor: skin.color + "33" }]}>
                  <Text style={styles.playerAvatarEmoji}>{skin.emoji}</Text>
                </View>
                <Text style={styles.playerRowName}>{player.name}{isMe ? " (أنت)" : ""}</Text>
                <View style={styles.playerRowRight}>
                  {isSpeaking && voiceEnabled && (
                    <Ionicons name="volume-high" size={14} color={Colors.emerald} />
                  )}
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
        <Text style={styles.headerTitle}>{tab === "join" ? t.joinRoom : t.playOnline}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.selectContent} showsVerticalScrollIndicator={false}>
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

            <TouchableOpacity
              style={styles.lobbyOptionCard}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setTab("create"); handleCreateRoom(); }}
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
                <Text style={[styles.startBtnText, joinCode.length < 4 && { color: Colors.textMuted }]}>{t.joinRoom}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.backLinkBtn} onPress={() => { setTab("select"); setError(null); setJoinCode(""); }}>
              <Ionicons name="arrow-back" size={16} color={Colors.textMuted} />
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
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
    backgroundColor: Colors.backgroundSecondary,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { flex: 1, fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary, textAlign: "center" },
  codeBtn: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.gold + "20", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  codeText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.gold },

  // Lobby select
  selectContent: { padding: 16, gap: 16 },
  miniProfile: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  miniAvatarCircle: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center" },
  miniAvatarEmoji: { fontSize: 24 },
  miniPlayerName: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textPrimary },
  miniPlayerLevel: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted },
  sectionTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textPrimary, textAlign: "right", marginBottom: 4 },
  selectButtons: { gap: 12 },
  lobbyOptionCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.card,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.cardBorder, gap: 14,
  },
  lobbyOptionCardPrimary: { borderColor: Colors.gold + "40", backgroundColor: Colors.gold + "08" },
  lobbyOptionIcon: { width: 58, height: 58, borderRadius: 16, backgroundColor: Colors.backgroundTertiary, justifyContent: "center", alignItems: "center" },
  lobbyOptionText: { flex: 1 },
  lobbyOptionTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textPrimary, marginBottom: 2 },
  lobbyOptionSubtitle: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted },

  loadingContainer: { alignItems: "center", paddingVertical: 40, gap: 16 },
  loadingText: { fontFamily: "Cairo_400Regular", fontSize: 14, color: Colors.textSecondary },

  joinContainer: { gap: 12 },
  codeInput: {
    backgroundColor: Colors.inputBg, borderRadius: 16, borderWidth: 2, borderColor: Colors.inputBorder,
    paddingVertical: 20, fontSize: 32, fontFamily: "Cairo_700Bold", color: Colors.gold,
    letterSpacing: 12,
  },
  errorText: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.ruby, textAlign: "center" },
  backLinkBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  backLinkText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textMuted },

  // Waiting room
  roomCodeCard: { backgroundColor: Colors.card, borderRadius: 20, padding: 20, alignItems: "center", marginHorizontal: 16, marginBottom: 12, borderWidth: 2, borderColor: Colors.gold + "40" },
  roomCodeLabel: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted, marginBottom: 8 },
  roomCodeBig: { fontFamily: "Cairo_700Bold", fontSize: 48, color: Colors.gold, letterSpacing: 12, marginBottom: 4 },
  roomCodeHint: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted },

  // Voice chat
  voiceChatCard: {
    backgroundColor: Colors.card + "80", borderRadius: 16, marginHorizontal: 16,
    marginBottom: 12, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  voiceChatHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  voiceChatTitle: { flex: 1, fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.textPrimary },
  voiceToggleBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12,
    backgroundColor: Colors.backgroundTertiary, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  voiceToggleBtnActive: { backgroundColor: Colors.emerald + "22", borderColor: Colors.emerald + "60" },
  voiceToggleText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textMuted },
  voiceToggleTextActive: { color: Colors.emerald },
  voiceControls: { marginTop: 12, gap: 10 },
  speakingList: { gap: 6 },
  speakingPlayerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  speakingAvatar: { width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center", position: "relative" },
  speakingEmoji: { fontSize: 16 },
  speakingDot: { position: "absolute", bottom: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.emerald, borderWidth: 1, borderColor: Colors.background },
  speakingName: { flex: 1, fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.textPrimary },
  speakingBadge: { backgroundColor: Colors.emerald + "22", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  micControls: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  micBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.backgroundTertiary,
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Colors.cardBorder,
  },
  micBtnActive: { backgroundColor: Colors.emerald, borderColor: Colors.emerald },
  micLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textSecondary },

  playersTitle: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.textSecondary, paddingHorizontal: 16, marginBottom: 8 },
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
    backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 16, marginHorizontal: 16,
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  startBtnDisabled: { backgroundColor: Colors.card, shadowOpacity: 0, elevation: 0 },
  startBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.black },
  waitingBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 16, backgroundColor: Colors.card, marginHorizontal: 16, borderRadius: 16 },
  waitingText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textSecondary },

  // Matchmaking
  matchmakingContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 20 },
  matchmakingCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.gold + "15", borderWidth: 2, borderColor: Colors.gold + "30", justifyContent: "center", alignItems: "center" },
  matchmakingTitle: { fontFamily: "Cairo_700Bold", fontSize: 24, color: Colors.textPrimary },
  matchmakingStatus: { fontFamily: "Cairo_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  cancelBtn: { backgroundColor: Colors.card, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32, borderWidth: 1, borderColor: Colors.cardBorder },
  cancelBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: Colors.textSecondary },

  // Countdown
  countdownContainer: { alignItems: "center", justifyContent: "center", gap: 20 },
  countdownLabel: { fontFamily: "Cairo_700Bold", fontSize: 20, color: Colors.textSecondary },
  countdownCircle: { width: 160, height: 160, borderRadius: 80, borderWidth: 4, justifyContent: "center", alignItems: "center", backgroundColor: Colors.backgroundSecondary },
  countdownNumber: { fontFamily: "Cairo_700Bold", fontSize: 72, lineHeight: 80 },
  countdownSub: { fontFamily: "Cairo_700Bold", fontSize: 20, color: Colors.textPrimary },
  vsRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 8 },
  vsPlayer: { alignItems: "center", gap: 8 },
  vsAvatar: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  vsEmoji: { fontSize: 36 },
  vsName: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.textPrimary, textAlign: "center", maxWidth: 100 },
  vsText: { fontFamily: "Cairo_700Bold", fontSize: 22, color: Colors.ruby },
});
