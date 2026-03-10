import React, { useState, useEffect, useCallback } from "react";
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

type TabMode = "select" | "create" | "join" | "waiting";

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

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const equippedSkin = SKINS.find((s) => s.id === profile.equippedSkin) || SKINS[0];

  useEffect(() => {
    const socket = getSocket();
    setSocketId(socket.id || null);

    socket.on("connect", () => {
      setSocketId(socket.id || null);
    });

    socket.on("room_updated", (roomData: RoomData) => {
      setRoom(roomData);
    });

    socket.on("player_joined", ({ playerName }: { playerName: string }) => {
      // Could show a toast here
    });

    socket.on("player_left", () => {
      // Handle player leaving
    });

    socket.on("game_started", (data: { letter: string; round: number; totalRounds: number }) => {
      if (room) {
        router.replace({
          pathname: "/game",
          params: {
            roomId: room.id,
            letter: data.letter,
            round: String(data.round),
            totalRounds: String(data.totalRounds),
            isHost: isMyTurn(room) ? "true" : "false",
          },
        });
      }
    });

    return () => {
      socket.off("room_updated");
      socket.off("player_joined");
      socket.off("player_left");
      socket.off("game_started");
    };
  }, [room]);

  // Re-check game_started with updated room
  useEffect(() => {
    const socket = getSocket();
    const handleGameStarted = (data: { letter: string; round: number; totalRounds: number }) => {
      if (room) {
        router.replace({
          pathname: "/game",
          params: {
            roomId: room.id,
            letter: data.letter,
            round: String(data.round),
            totalRounds: String(data.totalRounds),
          },
        });
      }
    };
    socket.on("game_started", handleGameStarted);
    return () => { socket.off("game_started", handleGameStarted); };
  }, [room]);

  const isMyTurn = (r: RoomData | null) => {
    if (!r || !socketId) return false;
    const me = r.players.find((p) => p.id === socketId);
    return me?.isHost || false;
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    setError(null);
    const socket = getSocket();
    socket.emit(
      "create_room",
      { playerName: profile.name, playerSkin: profile.equippedSkin },
      (res: { success: boolean; roomId?: string; error?: string }) => {
        setLoading(false);
        if (res.success && res.roomId) {
          setTab("waiting");
        } else {
          setError(res.error || "خطأ في إنشاء الغرفة");
        }
      }
    );
  };

  const handleJoinRoom = async () => {
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
          setRoom(res.room);
          setTab("waiting");
        } else {
          setError(
            res.error === "room_not_found"
              ? t.roomNotFound
              : res.error === "room_full"
              ? t.roomFull
              : t.connectionError
          );
        }
      }
    );
  };

  const handleStartGame = () => {
    if (!room) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const socket = getSocket();
    socket.emit("start_game", { roomId: room.id }, (res: { success: boolean; error?: string }) => {
      if (!res.success) {
        Alert.alert(t.error, res.error || "فشل البدء");
      }
    });
  };

  const handleBack = () => {
    setTab("select");
    setRoom(null);
    setError(null);
    setJoinCode("");
  };

  const copyRoomCode = () => {
    if (!room) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Simple alert since clipboard varies
    Alert.alert(t.roomCode, room.id);
  };

  if (tab === "waiting" && room) {
    const amHost = isMyTurn(room);
    const canStart = room.players.length >= 2;

    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        {/* Header */}
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

        {/* Room code display */}
        <View style={styles.roomCodeCard}>
          <Text style={styles.roomCodeLabel}>{t.roomCode}</Text>
          <Text style={styles.roomCodeBig}>{room.id}</Text>
          <Text style={styles.roomCodeHint}>شارك الرمز مع أصدقائك</Text>
        </View>

        {/* Players list */}
        <Text style={styles.playersTitle}>
          {t.players}: {room.players.length}/8
        </Text>
        <ScrollView style={styles.playersList} showsVerticalScrollIndicator={false}>
          {room.players.map((player, i) => {
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
          <Text style={styles.minPlayersText}>{t.minPlayers}</Text>
        </View>

        {amHost ? (
          <TouchableOpacity
            style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
            onPress={handleStartGame}
            disabled={!canStart}
          >
            <Ionicons name="play" size={20} color={Colors.black} style={{ marginRight: 8 }} />
            <Text style={styles.startBtnText}>{t.startGame}</Text>
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

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {tab === "create" ? t.createRoom : tab === "join" ? t.joinRoom : t.playOnline}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.selectContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile mini */}
        <View style={styles.miniProfile}>
          <View style={[styles.miniAvatarCircle, { backgroundColor: equippedSkin.color + "33" }]}>
            <Text style={styles.miniAvatarEmoji}>{equippedSkin.emoji}</Text>
          </View>
          <Text style={styles.miniPlayerName}>{profile.name}</Text>
        </View>

        {tab === "select" && (
          <View style={styles.selectButtons}>
            <Text style={styles.sectionTitle}>كيف تريد اللعب؟</Text>

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
                <Ionicons name="add-circle" size={32} color={Colors.gold} />
              </View>
              <View style={styles.lobbyOptionText}>
                <Text style={styles.lobbyOptionTitle}>{t.createRoom}</Text>
                <Text style={styles.lobbyOptionSubtitle}>أنشئ غرفة وادعو أصدقاءك</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.lobbyOptionCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setTab("join");
              }}
              activeOpacity={0.85}
            >
              <View style={styles.lobbyOptionIcon}>
                <Ionicons name="enter" size={32} color={Colors.emerald} />
              </View>
              <View style={styles.lobbyOptionText}>
                <Text style={styles.lobbyOptionTitle}>{t.joinRoom}</Text>
                <Text style={styles.lobbyOptionSubtitle}>انضم لغرفة موجودة بالرمز</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {(tab === "create" || loading) && (
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
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              placeholder="XXXX"
              placeholderTextColor={Colors.inputPlaceholder}
              maxLength={4}
              autoCapitalize="characters"
              autoFocus
              textAlign="center"
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            <TouchableOpacity
              style={[styles.startBtn, loading && styles.startBtnDisabled]}
              onPress={handleJoinRoom}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.black} />
              ) : (
                <Text style={styles.startBtnText}>{t.joinRoom}</Text>
              )}
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    color: Colors.textPrimary,
  },
  codeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  codeText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.gold,
    letterSpacing: 2,
  },
  selectContent: {
    padding: 20,
    paddingBottom: 40,
  },
  miniProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  miniAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  miniAvatarEmoji: {
    fontSize: 24,
  },
  miniPlayerName: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.textPrimary,
  },
  sectionTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
    textAlign: "center",
  },
  selectButtons: {
    gap: 14,
  },
  lobbyOptionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  lobbyOptionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.backgroundTertiary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  lobbyOptionText: {
    flex: 1,
  },
  lobbyOptionTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  lobbyOptionSubtitle: {
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  joinContainer: {
    gap: 16,
  },
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
  errorText: {
    fontFamily: "Cairo_400Regular",
    fontSize: 14,
    color: Colors.ruby,
    textAlign: "center",
  },
  roomCodeCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.gold + "40",
  },
  roomCodeLabel: {
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  roomCodeBig: {
    fontFamily: "Cairo_700Bold",
    fontSize: 48,
    color: Colors.gold,
    letterSpacing: 12,
    marginBottom: 4,
  },
  roomCodeHint: {
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  playersTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  playersList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  playerRowMe: {
    borderColor: Colors.gold + "60",
    backgroundColor: Colors.card,
  },
  playerAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  playerAvatarEmoji: {
    fontSize: 20,
  },
  playerRowName: {
    flex: 1,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 15,
    color: Colors.textPrimary,
  },
  playerRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hostBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.gold + "20",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  hostBadgeText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 10,
    color: Colors.gold,
  },
  minPlayersHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  minPlayersText: {
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
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
  startBtnDisabled: {
    backgroundColor: Colors.card,
    shadowOpacity: 0,
    elevation: 0,
  },
  startBtnText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    color: Colors.black,
  },
  waitingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    borderRadius: 16,
  },
  waitingText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
