import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Alert,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { getSocket } from "@/services/socket";

const ROUND_LABELS: Record<string, string> = {
  quarter: "ربع النهائي",
  semi: "نصف النهائي",
  final: "النهائي",
  completed: "انتهت",
};

type TournamentListItem = {
  id: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  entryFee: number;
  prizePool: number;
  joined?: boolean;
};

type TournamentMatch = {
  id: string;
  roundName: string;
  matchIndex: number;
  player1Id: string | null;
  player1Name: string | null;
  player2Id: string | null;
  player2Name: string | null;
  winnerId: string | null;
  winnerName: string | null;
  status: string;
};

type TournamentDetail = {
  id: string;
  status: string;
  currentRound: string;
  players: { playerId: string; name: string; skin: string; eliminated: boolean }[];
  matches: TournamentMatch[];
  prizes: Record<string, number>;
};

type ViewMode = "list" | "detail";

export default function TournamentScreen() {
  const insets = useSafeAreaInsets();
  const { profile, playerId } = usePlayer();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [activeTournament, setActiveTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const fetchTournaments = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL("/api/tournaments/open", baseUrl).toString());
      if (res.ok) {
        const data = await res.json();
        let myTournaments: string[] = [];
        try {
          const myRes = await fetch(new URL(`/api/player/${playerId}/tournaments`, baseUrl).toString());
          if (myRes.ok) {
            const myData = await myRes.json();
            myTournaments = myData.map((t: any) => t.id);
          }
        } catch {}
        const enriched = data.map((t: TournamentListItem) => ({
          ...t,
          joined: myTournaments.includes(t.id),
        }));
        setTournaments(enriched);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [playerId]);

  const fetchTournamentDetail = useCallback(async (id: string) => {
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL(`/api/tournament/${id}`, baseUrl).toString());
      if (res.ok) {
        const data = await res.json();
        setActiveTournament(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchTournaments();
    const socket = getSocket();
    socket.emit("tournament_register_socket", { playerId });
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleMatchFound = (data: {
      roomId: string;
      letter: string;
      round: number;
      totalRounds: number;
      tournamentId?: string;
      tournamentRound?: string;
    }) => {
      if (data.tournamentId) {
        router.replace({
          pathname: "/game",
          params: {
            roomId: data.roomId,
            letter: data.letter,
            round: String(data.round),
            totalRounds: String(data.totalRounds),
            coinEntry: "0",
          },
        });
      }
    };

    socket.on("matchFound", handleMatchFound);

    const handleCountdown = (data: { count: number }) => {
      setActiveTournament(prev => prev ? { ...prev, status: `match_starting_${data.count}` } : prev);
    };
    socket.on("countdown", handleCountdown);

    const handleTournamentUpdate = (data: {
      tournamentId: string;
      matches: TournamentMatch[];
      currentRound: string;
      status: string;
      winnerId: string | null;
      winnerName: string | null;
    }) => {
      if (activeTournament && activeTournament.id === data.tournamentId) {
        setActiveTournament(prev => prev ? {
          ...prev,
          matches: data.matches,
          currentRound: data.currentRound,
          status: data.status,
        } : null);
      }
    };

    const handlePlayerJoined = (data: { tournamentId: string; playerCount: number }) => {
      setTournaments(prev => prev.map(t =>
        t.id === data.tournamentId ? { ...t, playerCount: data.playerCount } : t
      ));
      if (activeTournament && activeTournament.id === data.tournamentId) {
        fetchTournamentDetail(data.tournamentId);
      }
    };

    const handleTournamentStarted = (data: { tournamentId: string }) => {
      if (activeTournament && activeTournament.id === data.tournamentId) {
        fetchTournamentDetail(data.tournamentId);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const handleTournamentCancelled = (data: { tournamentId: string }) => {
      setTournaments(prev => prev.filter(t => t.id !== data.tournamentId));
      if (activeTournament && activeTournament.id === data.tournamentId) {
        setActiveTournament(null);
        setViewMode("list");
        Alert.alert("تم إلغاء البطولة", "تم حذف هذه البطولة لعدم اكتمال اللاعبين.");
        fetchTournaments();
      }
    };

    socket.on("tournament_update", handleTournamentUpdate);
    socket.on("tournament_player_joined", handlePlayerJoined);
    socket.on("tournament_started", handleTournamentStarted);
    socket.on("tournament_cancelled", handleTournamentCancelled);

    return () => {
      socket.off("matchFound", handleMatchFound);
      socket.off("countdown", handleCountdown);
      socket.off("tournament_update", handleTournamentUpdate);
      socket.off("tournament_player_joined", handlePlayerJoined);
      socket.off("tournament_started", handleTournamentStarted);
      socket.off("tournament_cancelled", handleTournamentCancelled);
    };
  }, [activeTournament]);

  const handleJoinTournament = async (tournamentId: string) => {
    if (tournamentId === "__create__") {
      try {
        setJoining(true);
        const baseUrl = getApiUrl();
        const createRes = await fetch(new URL("/api/tournament/create", baseUrl).toString(), { method: "POST" });
        if (createRes.ok) {
          const created = await createRes.json();
          await handleJoinTournament(created.id);
        }
      } catch {
        Alert.alert("خطأ", "فشل إنشاء البطولة");
      } finally {
        setJoining(false);
      }
      return;
    }

    setSelectedTournamentId(tournamentId);
    setShowConfirmModal(true);
  };

  const confirmJoin = async () => {
    if (!selectedTournamentId) return;
    setShowConfirmModal(false);
    setJoining(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const baseUrl = getApiUrl();
      const socket = getSocket();
      const res = await fetch(new URL(`/api/tournament/${selectedTournamentId}/join`, baseUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          playerName: profile.name,
          playerSkin: profile.equippedSkin,
          socketId: socket.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setViewMode("detail");
        fetchTournamentDetail(selectedTournamentId);
      } else {
        const errorMsg =
          data.error === "insufficient_coins" ? "رصيدك غير كافي" :
          data.error === "already_joined" ? "أنت مسجل بالفعل" :
          data.error === "tournament_full" ? "البطولة ممتلئة" :
          "فشل الانضمام";
        Alert.alert("خطأ", errorMsg);
      }
    } catch {
      Alert.alert("خطأ", "فشل الانضمام");
    } finally {
      setJoining(false);
    }
  };

  const openTournamentDetail = (id: string) => {
    setViewMode("detail");
    fetchTournamentDetail(id);
  };

  const getMatchesForRound = (round: string) => {
    if (!activeTournament) return [];
    return activeTournament.matches.filter(m => m.roundName === round);
  };

  const isMyMatch = (match: TournamentMatch) => {
    return match.player1Id === playerId || match.player2Id === playerId;
  };

  const amInTournament = activeTournament?.players.some(p => p.playerId === playerId) || false;

  if (viewMode === "detail" && activeTournament) {
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => { setViewMode("list"); setActiveTournament(null); fetchTournaments(); }}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>البطولة</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchTournamentDetail(activeTournament.id)}>
            <Ionicons name="refresh" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.detailContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statusCard}>
            <View style={[styles.statusDot, { backgroundColor: activeTournament.status === "in_progress" ? Colors.emerald : activeTournament.status === "completed" ? Colors.gold : Colors.sapphire }]} />
            <Text style={styles.statusText}>
              {activeTournament.status === "open" ? `في انتظار اللاعبين (${activeTournament.players.length}/8)` :
               activeTournament.status === "in_progress" ? `${ROUND_LABELS[activeTournament.currentRound] || activeTournament.currentRound} جارٍ` :
               "البطولة انتهت"}
            </Text>
          </View>

          {activeTournament.status === "completed" && activeTournament.matches.find(m => m.roundName === "final")?.winnerId && (
            <View style={styles.winnerBanner}>
              <Text style={styles.winnerEmoji}>🏆</Text>
              <Text style={styles.winnerTitle}>الفائز بالبطولة</Text>
              <Text style={styles.winnerName}>
                {activeTournament.matches.find(m => m.roundName === "final")?.winnerName}
              </Text>
            </View>
          )}

          <View style={styles.prizesCard}>
            <Text style={styles.prizesTitle}>الجوائز</Text>
            <View style={styles.prizeRow}>
              <Text style={styles.prizeEmoji}>🥇</Text>
              <Text style={styles.prizeText}>المركز الأول: 500 🪙 + 150 XP</Text>
            </View>
            <View style={styles.prizeRow}>
              <Text style={styles.prizeEmoji}>🥈</Text>
              <Text style={styles.prizeText}>المركز الثاني: 200 🪙 + 75 XP</Text>
            </View>
            <View style={styles.prizeRow}>
              <Text style={styles.prizeEmoji}>🥉</Text>
              <Text style={styles.prizeText}>المركز الثالث: 100 🪙 + 50 XP</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>اللاعبون</Text>
          <View style={styles.playersGrid}>
            {activeTournament.players.map((p) => {
              const skin = SKINS.find(s => s.id === p.skin) || SKINS[0];
              const isMe = p.playerId === playerId;
              return (
                <View key={p.playerId} style={[styles.playerChip, p.eliminated && styles.playerChipEliminated, isMe && styles.playerChipMe]}>
                  <Text style={styles.playerChipEmoji}>{skin.emoji}</Text>
                  <Text style={[styles.playerChipName, p.eliminated && styles.playerChipNameEliminated]} numberOfLines={1}>
                    {p.name}{isMe ? " (أنت)" : ""}
                  </Text>
                  {p.eliminated && <Ionicons name="close-circle" size={14} color={Colors.ruby} />}
                </View>
              );
            })}
          </View>

          {activeTournament.status !== "open" && (
            <>
              {(["quarter", "semi", "final"] as const).map((round) => {
                const roundMatches = getMatchesForRound(round);
                if (roundMatches.length === 0) return null;
                return (
                  <View key={round} style={styles.bracketRound}>
                    <View style={styles.roundHeader}>
                      <View style={[styles.roundDot, {
                        backgroundColor: activeTournament.currentRound === round ? Colors.gold :
                          roundMatches.every(m => m.status === "completed") ? Colors.emerald : Colors.textMuted
                      }]} />
                      <Text style={styles.roundTitle}>{ROUND_LABELS[round]}</Text>
                    </View>
                    {roundMatches.map((match) => {
                      const isMine = isMyMatch(match);
                      return (
                        <View key={match.id} style={[styles.matchCard, isMine && styles.matchCardMine]}>
                          <MatchSlot
                            name={match.player1Name}
                            isWinner={match.winnerId === match.player1Id && match.winnerId !== null}
                            isLoser={match.winnerId !== null && match.winnerId !== match.player1Id}
                            isMe={match.player1Id === playerId}
                          />
                          <View style={styles.matchVs}>
                            <Text style={styles.matchVsText}>VS</Text>
                          </View>
                          <MatchSlot
                            name={match.player2Name}
                            isWinner={match.winnerId === match.player2Id && match.winnerId !== null}
                            isLoser={match.winnerId !== null && match.winnerId !== match.player2Id}
                            isMe={match.player2Id === playerId}
                          />
                          {match.status === "completed" && (
                            <View style={styles.matchResultBadge}>
                              <Ionicons name="checkmark-circle" size={14} color={Colors.emerald} />
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>البطولات</Text>
        <View style={styles.coinsBadge}>
          <Ionicons name="star" size={14} color={Colors.gold} />
          <Text style={styles.coinsText}>{profile.coins}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTournaments(); }} tintColor={Colors.gold} />}
      >
        <View style={styles.infoCard}>
          <Ionicons name="trophy" size={28} color={Colors.gold} />
          <Text style={styles.infoTitle}>بطولات حروف المغرب</Text>
          <Text style={styles.infoSub}>انضم إلى بطولة من 8 لاعبين وتنافس عبر 3 جولات إقصائية!</Text>
          <View style={styles.infoDetails}>
            <View style={styles.infoDetailItem}>
              <Text style={styles.infoDetailLabel}>رسم الدخول</Text>
              <Text style={styles.infoDetailValue}>100 🪙</Text>
            </View>
            <View style={styles.infoDetailItem}>
              <Text style={styles.infoDetailLabel}>جائزة الأول</Text>
              <Text style={styles.infoDetailValue}>500 🪙</Text>
            </View>
            <View style={styles.infoDetailItem}>
              <Text style={styles.infoDetailLabel}>اللاعبون</Text>
              <Text style={styles.infoDetailValue}>8</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={styles.listTitle}>البطولات المتاحة</Text>
            {tournaments.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.tournamentCard, t.status === "create" && styles.tournamentCardCreate, t.joined && styles.tournamentCardJoined]}
                onPress={() => {
                  if (t.status === "create") {
                    handleJoinTournament("__create__");
                  } else if (t.joined) {
                    openTournamentDetail(t.id);
                  } else {
                    handleJoinTournament(t.id);
                  }
                }}
                activeOpacity={0.85}
                disabled={joining}
              >
                {t.status === "create" ? (
                  <>
                    <Ionicons name="add-circle" size={32} color={Colors.gold} />
                    <Text style={styles.createText}>إنشاء بطولة جديدة</Text>
                    <Text style={styles.createSub}>رسم الدخول: 100 🪙</Text>
                  </>
                ) : (
                  <>
                    <View style={styles.tournamentCardHeader}>
                      <Ionicons name="trophy" size={20} color={Colors.gold} />
                      <Text style={styles.tournamentCardTitle}>
                        {t.joined ? "بطولتك" : "بطولة مفتوحة"}
                      </Text>
                      {t.joined && (
                        <View style={styles.joinedBadge}>
                          <Text style={styles.joinedBadgeText}>مشترك</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.tournamentCardStats}>
                      <View style={styles.tournamentStat}>
                        <Ionicons name="people" size={16} color={Colors.sapphire} />
                        <Text style={styles.tournamentStatText}>{t.playerCount}/{t.maxPlayers}</Text>
                      </View>
                      <View style={styles.tournamentStat}>
                        <Ionicons name="star" size={16} color={Colors.gold} />
                        <Text style={styles.tournamentStatText}>{t.entryFee} دخول</Text>
                      </View>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${(t.playerCount / t.maxPlayers) * 100}%` }]} />
                    </View>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={showConfirmModal} transparent animationType="fade" onRequestClose={() => setShowConfirmModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="trophy" size={40} color={Colors.gold} style={{ marginBottom: 12 }} />
            <Text style={styles.modalTitle}>الانضمام للبطولة</Text>
            <Text style={styles.modalSub}>سيتم خصم 100 🪙 من رصيدك</Text>
            <Text style={styles.modalBalance}>رصيدك الحالي: {profile.coins} 🪙</Text>
            {profile.coins < 100 && (
              <Text style={styles.modalWarning}>رصيدك غير كافي!</Text>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowConfirmModal(false)}>
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, profile.coins < 100 && { opacity: 0.5 }]}
                onPress={confirmJoin}
                disabled={profile.coins < 100}
              >
                <Text style={styles.modalConfirmText}>ادفع وانضم</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {joining && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      )}
    </View>
  );
}

function MatchSlot({ name, isWinner, isLoser, isMe }: { name: string | null; isWinner: boolean; isLoser: boolean; isMe: boolean }) {
  return (
    <View style={[styles.matchSlot, isWinner && styles.matchSlotWinner, isLoser && styles.matchSlotLoser, isMe && styles.matchSlotMe]}>
      <Text style={[styles.matchSlotName, isLoser && styles.matchSlotNameLoser, isMe && { color: Colors.gold }]} numberOfLines={1}>
        {name || "—"}
      </Text>
      {isWinner && <Ionicons name="checkmark-circle" size={14} color={Colors.emerald} />}
      {isLoser && <Ionicons name="close-circle" size={14} color={Colors.ruby} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.card,
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.card,
    justifyContent: "center", alignItems: "center",
  },
  coinsBadge: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.card,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 5,
    borderWidth: 1, borderColor: Colors.gold + "30",
  },
  coinsText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.gold },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  detailContent: { paddingHorizontal: 16, paddingBottom: 40 },

  infoCard: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 24, alignItems: "center",
    marginBottom: 20, borderWidth: 1, borderColor: Colors.gold + "25",
  },
  infoTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, color: Colors.gold, marginTop: 8 },
  infoSub: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center", marginTop: 6 },
  infoDetails: { flexDirection: "row", marginTop: 16, gap: 16 },
  infoDetailItem: { alignItems: "center" },
  infoDetailLabel: { fontFamily: "Cairo_400Regular", fontSize: 11, color: Colors.textMuted },
  infoDetailValue: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.textPrimary, marginTop: 2 },

  listTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.textSecondary, textAlign: "right", marginBottom: 12 },

  tournamentCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  tournamentCardCreate: {
    borderStyle: "dashed", borderColor: Colors.gold + "50", alignItems: "center",
    paddingVertical: 24,
  },
  tournamentCardJoined: { borderColor: Colors.emerald + "50" },
  joinedBadge: {
    backgroundColor: Colors.emerald + "22", paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8, marginLeft: "auto",
  },
  joinedBadgeText: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: Colors.emerald },
  createText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.gold, marginTop: 8 },
  createSub: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  tournamentCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  tournamentCardTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textPrimary },
  tournamentCardStats: { flexDirection: "row", gap: 16, marginBottom: 10 },
  tournamentStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  tournamentStatText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.textSecondary },

  progressBar: {
    height: 6, backgroundColor: Colors.backgroundTertiary, borderRadius: 3, overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: Colors.emerald, borderRadius: 3 },

  statusCard: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.card,
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textPrimary },

  winnerBanner: {
    backgroundColor: Colors.gold + "18", borderRadius: 16, padding: 20, alignItems: "center",
    marginBottom: 16, borderWidth: 1, borderColor: Colors.gold + "40",
  },
  winnerEmoji: { fontSize: 40, marginBottom: 8 },
  winnerTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.gold },
  winnerName: { fontFamily: "Cairo_700Bold", fontSize: 22, color: Colors.textPrimary, marginTop: 4 },

  prizesCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  prizesTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.gold, marginBottom: 10 },
  prizeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  prizeEmoji: { fontSize: 18 },
  prizeText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.textSecondary },

  sectionTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.textSecondary, textAlign: "right", marginBottom: 10 },

  playersGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  playerChip: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.card,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  playerChipEliminated: { opacity: 0.5 },
  playerChipMe: { borderColor: Colors.gold + "50" },
  playerChipEmoji: { fontSize: 16 },
  playerChipName: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textPrimary, maxWidth: 80 },
  playerChipNameEliminated: { textDecorationLine: "line-through", color: Colors.textMuted },

  bracketRound: { marginBottom: 20 },
  roundHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  roundDot: { width: 8, height: 8, borderRadius: 4 },
  roundTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textPrimary },

  matchCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  matchCardMine: { borderColor: Colors.gold + "50" },
  matchVs: { alignItems: "center", paddingVertical: 4 },
  matchVsText: { fontFamily: "Cairo_700Bold", fontSize: 12, color: Colors.textMuted },
  matchSlot: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: Colors.backgroundTertiary,
  },
  matchSlotWinner: { backgroundColor: Colors.emerald + "18" },
  matchSlotLoser: { backgroundColor: Colors.ruby + "12" },
  matchSlotMe: { borderWidth: 1, borderColor: Colors.gold + "40" },
  matchSlotName: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textPrimary, flex: 1 },
  matchSlotNameLoser: { textDecorationLine: "line-through", color: Colors.textMuted },
  matchResultBadge: { position: "absolute", top: 8, right: 8 },

  modalOverlay: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: Colors.overlay,
  },
  modalCard: {
    backgroundColor: Colors.backgroundSecondary, borderRadius: 24, padding: 28,
    width: "85%", alignItems: "center", borderWidth: 1, borderColor: Colors.cardBorder,
  },
  modalTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary, marginBottom: 8 },
  modalSub: { fontFamily: "Cairo_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  modalBalance: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.gold, marginTop: 8 },
  modalWarning: { fontFamily: "Cairo_700Bold", fontSize: 13, color: Colors.ruby, marginTop: 8 },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 20, width: "100%" },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.card,
    alignItems: "center",
  },
  modalCancelText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  modalConfirm: {
    flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.gold,
    alignItems: "center",
  },
  modalConfirmText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.black },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center",
  },
});
