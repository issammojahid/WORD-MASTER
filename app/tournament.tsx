import React, { useState, useEffect, useCallback, useRef } from "react";
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

// ─── Bracket layout constants ────────────────────────────────────────────────
const BK_MATCH_H = 62;
const BK_MATCH_W = 112;
const BK_QF_GAP = 46;
const BK_LABEL_H = 26;
const BK_CONN_W = 20;
const BK_COL_H = BK_MATCH_H * 2 + BK_QF_GAP;      // 170
const BK_SEC_H = BK_LABEL_H + BK_COL_H;            // 196
const BK_QF0_CY = BK_LABEL_H + BK_MATCH_H / 2;     // 57
const BK_QF1_CY = BK_LABEL_H + BK_MATCH_H + BK_QF_GAP + BK_MATCH_H / 2; // 165
const BK_CONN_TOP = BK_QF0_CY;                      // 57
const BK_CONN_H = BK_QF1_CY - BK_QF0_CY;           // 108
const BK_SF_CY = BK_LABEL_H + BK_COL_H / 2;        // 111  (must == connector center)
const BK_CENTER_LINE_MT = BK_SF_CY - 1;             // 110

const BK_LINE = Colors.gold;
const BK_LINE_OP = 0.8;
// ─────────────────────────────────────────────────────────────────────────────

const ROUND_LABELS: Record<string, string> = {
  round1: "الدور الأول",
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
  hostPlayerName?: string | null;
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
  maxPlayers: number;
  players: { playerId: string; name: string; skin: string; eliminated: boolean }[];
  matches: TournamentMatch[];
  prizes: Record<string, number>;
};

type ViewMode = "list" | "detail";

export default function TournamentScreen() {
  const insets = useSafeAreaInsets();
  const { profile, playerId, addCoins } = usePlayer();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [activeTournament, setActiveTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSize, setSelectedSize] = useState<4 | 8 | 16>(8);
  const [creating, setCreating] = useState(false);

  // Mutable refs that always reflect the latest state values — used inside
  // socket handlers to avoid stale-closure bugs without re-registering listeners.
  const activeTournamentRef = useRef<TournamentDetail | null>(null);
  const tournamentsRef = useRef<TournamentListItem[]>([]);

  useEffect(() => {
    activeTournamentRef.current = activeTournament;
  }, [activeTournament]);

  useEffect(() => {
    tournamentsRef.current = tournaments;
  }, [tournaments]);

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

    // Periodic fallback refresh — keeps the list fresh even if a socket
    // event is missed due to a brief disconnect or race condition.
    const refreshInterval = setInterval(() => {
      // Only refresh the list if we're not in detail view — avoids
      // overwriting activeTournament state while the player is watching.
      if (!activeTournamentRef.current) {
        fetchTournaments();
      }
    }, 15_000);

    return () => clearInterval(refreshInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Use ref so we never read a stale activeTournament value
      if (activeTournamentRef.current && activeTournamentRef.current.id === data.tournamentId) {
        setActiveTournament(prev => prev ? {
          ...prev,
          matches: data.matches,
          currentRound: data.currentRound,
          status: data.status,
        } : null);
      }
    };

    const handleTournamentCreated = (data: { id: string; status: string; playerCount: number; maxPlayers: number; entryFee: number; prizePool: number; createdAt: string; hostPlayerName?: string | null }) => {
      // Add the new tournament to the list if it's not already there.
      // The creator's own event also arrives here — the setTournaments check
      // prevents duplicates.
      setTournaments(prev => {
        if (prev.some(t => t.id === data.id)) return prev;
        const newTournament: TournamentListItem = {
          id: data.id,
          status: data.status,
          playerCount: data.playerCount,
          maxPlayers: data.maxPlayers,
          entryFee: data.entryFee,
          prizePool: data.prizePool,
          joined: false,
          hostPlayerName: data.hostPlayerName ?? null,
        };
        return [...prev.filter(t => t.status !== "create"), newTournament];
      });
    };

    const handlePlayerJoined = (data: { tournamentId: string; playerCount: number; maxPlayers: number; playerName: string }) => {
      // Update the count in the open-tournaments list.
      // We read from the ref to decide if a full re-fetch is needed, then
      // apply the proper state update outside the updater to avoid side effects.
      setTournaments(prev => {
        const exists = prev.some(t => t.id === data.tournamentId);
        if (!exists) return prev; // Full re-fetch triggered below
        return prev.map(t => {
          if (t.id !== data.tournamentId) return t;
          const hostName = t.hostPlayerName ?? (data.playerCount === 1 ? data.playerName : null);
          return { ...t, playerCount: data.playerCount, hostPlayerName: hostName };
        });
      });

      // If the tournament wasn't in our local list yet, refresh the full list
      // so it appears with the correct count. We do this outside the updater.
      // We check the current ref value to avoid an extra closure.
      if (!tournamentsRef.current.some(t => t.id === data.tournamentId)) {
        fetchTournaments();
      }

      // If this tournament's detail is open, re-fetch to show the new player slot
      if (activeTournamentRef.current?.id === data.tournamentId) {
        fetchTournamentDetail(data.tournamentId);
      }
    };

    const handleTournamentStarted = (data: { tournamentId: string }) => {
      // Remove the now-full tournament from the open list
      setTournaments(prev => prev.filter(t => t.id !== data.tournamentId));
      // Refresh detail view so the bracket is shown
      if (activeTournamentRef.current?.id === data.tournamentId) {
        fetchTournamentDetail(data.tournamentId);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const handlePlayerLeft = (data: { tournamentId: string; playerCount: number; maxPlayers: number; playerName: string }) => {
      // Update the count in the open-tournaments list
      setTournaments(prev => prev.map(t =>
        t.id === data.tournamentId ? { ...t, playerCount: data.playerCount } : t
      ));
      // If this tournament's detail is open, re-fetch to update player slots
      if (activeTournamentRef.current?.id === data.tournamentId) {
        fetchTournamentDetail(data.tournamentId);
      }
    };

    const handleTournamentCancelled = (data: { tournamentId: string }) => {
      setTournaments(prev => prev.filter(t => t.id !== data.tournamentId));
      if (activeTournamentRef.current?.id === data.tournamentId) {
        setActiveTournament(null);
        setViewMode("list");
        Alert.alert("تم إلغاء البطولة", "تم حذف هذه البطولة لعدم اكتمال اللاعبين.");
        fetchTournaments();
      }
    };

    socket.on("tournament_created", handleTournamentCreated);
    socket.on("tournament_update", handleTournamentUpdate);
    socket.on("tournament_player_joined", handlePlayerJoined);
    socket.on("tournament_player_left", handlePlayerLeft);
    socket.on("tournament_started", handleTournamentStarted);
    socket.on("tournament_cancelled", handleTournamentCancelled);

    return () => {
      socket.off("matchFound", handleMatchFound);
      socket.off("countdown", handleCountdown);
      socket.off("tournament_created", handleTournamentCreated);
      socket.off("tournament_update", handleTournamentUpdate);
      socket.off("tournament_player_joined", handlePlayerJoined);
      socket.off("tournament_player_left", handlePlayerLeft);
      socket.off("tournament_started", handleTournamentStarted);
      socket.off("tournament_cancelled", handleTournamentCancelled);
    };
  // Empty dependency array: register listeners exactly once.
  // activeTournamentRef.current is always current so no re-registration needed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateAndJoin = async (size: 4 | 8 | 16) => {
    setShowCreateModal(false);
    setCreating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const baseUrl = getApiUrl();
      const socket = getSocket();

      const createRes = await fetch(
        new URL("/api/tournament/create", baseUrl).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxPlayers: size }),
        }
      );
      if (!createRes.ok) {
        Alert.alert("خطأ", "فشل إنشاء الغرفة");
        return;
      }
      const created = await createRes.json();

      const joinRes = await fetch(
        new URL(`/api/tournament/${created.id}/join`, baseUrl).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            playerName: profile.name,
            playerSkin: profile.equippedSkin,
            socketId: socket.id,
          }),
        }
      );
      const joinData = await joinRes.json();
      if (joinRes.ok) {
        addCoins(-100);
        setViewMode("detail");
        fetchTournamentDetail(created.id);
      } else {
        const msg =
          joinData.error === "insufficient_coins" ? "رصيدك غير كافي" :
          joinData.error === "already_joined" ? "أنت مسجل بالفعل" :
          "فشل الانضمام للغرفة";
        Alert.alert("خطأ", msg);
      }
    } catch {
      Alert.alert("خطأ", "فشل الاتصال بالخادم");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinTournament = (tournamentId: string) => {
    // Always show the confirm modal first — the actual API call (and tournament
    // creation if needed) happens in confirmJoin. This prevents the 0-player
    // window where a freshly-created tournament could get cleaned up before the
    // player confirms the entry fee.
    setSelectedTournamentId(tournamentId);
    setShowConfirmModal(true);
  };

  const confirmJoin = async () => {
    if (!selectedTournamentId) return;
    setShowConfirmModal(false);
    setJoining(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const tournamentId = selectedTournamentId;

    try {
      const baseUrl = getApiUrl();
      const socket = getSocket();

      // ── Join the tournament ────────────────────────────────────────────────
      const res = await fetch(
        new URL(`/api/tournament/${tournamentId}/join`, baseUrl).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            playerName: profile.name,
            playerSkin: profile.equippedSkin,
            socketId: socket.id,
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        // Reflect the entry fee deduction immediately so the coin balance
        // is correct before the server profile is re-synced at game end.
        // The server always deducts TOURNAMENT_ENTRY_FEE (100) on join.
        addCoins(-100);
        setViewMode("detail");
        fetchTournamentDetail(tournamentId);
      } else {
        const errorMsg =
          data.error === "insufficient_coins" ? "رصيدك غير كافي" :
          data.error === "already_joined" ? "أنت مسجل بالفعل" :
          data.error === "tournament_full" ? "البطولة ممتلئة" :
          data.error === "tournament_closed" ? "البطولة بدأت بالفعل" :
          "فشل الانضمام";
        Alert.alert("خطأ", errorMsg);
      }
    } catch {
      Alert.alert("خطأ", "فشل الاتصال بالخادم");
    } finally {
      setJoining(false);
    }
  };

  const openTournamentDetail = (id: string) => {
    setViewMode("detail");
    fetchTournamentDetail(id);
  };

  const confirmLeaveTournament = async () => {
    if (!activeTournament) return;
    setShowLeaveModal(false);
    setLeaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(
        new URL(`/api/tournament/${activeTournament.id}/leave`, baseUrl).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        // Refund reflected locally
        addCoins(100);
        // Go back to list
        setActiveTournament(null);
        setViewMode("list");
        fetchTournaments();
      } else {
        const msg =
          data.error === "tournament_already_started" ? "البطولة بدأت بالفعل" :
          data.error === "not_in_tournament" ? "أنت لست مسجلاً في هذه البطولة" :
          "فشل مغادرة البطولة";
        Alert.alert("خطأ", msg);
      }
    } catch {
      Alert.alert("خطأ", "فشل الاتصال بالخادم");
    } finally {
      setLeaving(false);
    }
  };

  const amInTournament = activeTournament?.players.some(p => p.playerId === playerId) || false;

  // ─── Detail View ────────────────────────────────────────────────────────────
  if (viewMode === "detail" && activeTournament) {
    const isOpen = activeTournament.status === "open";
    const isCompleted = activeTournament.status === "completed";
    const finalMatch = activeTournament.matches.find(m => m.roundName === "final");
    const currentRoundLabel = ROUND_LABELS[activeTournament.currentRound] || activeTournament.currentRound;

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

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Status Card */}
          <View style={[styles.statusCard, { marginHorizontal: 16 }]}>
            <View style={[styles.statusDot, {
              backgroundColor: isCompleted ? Colors.gold : isOpen ? Colors.sapphire : Colors.emerald,
            }]} />
            <Text style={styles.statusText}>
              {isOpen
                ? `في انتظار اللاعبين (${activeTournament.players.length}/${activeTournament.maxPlayers ?? 8})`
                : isCompleted
                ? "انتهت البطولة"
                : `${currentRoundLabel} — جارٍ الآن`}
            </Text>
          </View>

          {/* Winner Banner */}
          {isCompleted && finalMatch?.winnerName && (
            <View style={[styles.winnerBanner, { marginHorizontal: 16 }]}>
              <Text style={styles.winnerEmoji}>🏆</Text>
              <Text style={styles.winnerTitle}>بطل البطولة</Text>
              <Text style={styles.winnerName}>{finalMatch.winnerName}</Text>
            </View>
          )}

          {/* ── Visual Bracket (in_progress or completed) ── */}
          {!isOpen && activeTournament.matches.length > 0 && (
            <View style={styles.bracketSection}>
              <Text style={styles.bracketSectionTitle}>جدول البطولة</Text>
              <TournamentBracket matches={activeTournament.matches} myId={playerId} maxPlayers={activeTournament.maxPlayers} />
            </View>
          )}

          {/* Waiting state for open tournaments */}
          {isOpen && (
            <View style={[styles.waitingCard, { marginHorizontal: 16 }]}>
              <Text style={styles.waitingTitle}>في انتظار اللاعبين</Text>
              <View style={styles.waitingSlots}>
                {Array.from({ length: activeTournament.maxPlayers ?? 8 }).map((_, i) => {
                  const player = activeTournament.players[i];
                  const skin = player ? (SKINS.find(s => s.id === player.skin) || SKINS[0]) : null;
                  return (
                    <View key={i} style={[styles.waitingSlot, player && styles.waitingSlotFilled]}>
                      {player ? (
                        <>
                          <Text style={styles.waitingSlotEmoji}>{skin?.emoji}</Text>
                          <Text style={styles.waitingSlotName} numberOfLines={1}>
                            {player.playerId === playerId ? `${player.name} ✓` : player.name}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.waitingSlotEmpty}>انتظار...</Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Leave button — only for registered players while tournament is still open */}
              {amInTournament && (
                <TouchableOpacity
                  style={styles.leaveBtn}
                  onPress={() => setShowLeaveModal(true)}
                  disabled={leaving}
                >
                  {leaving ? (
                    <ActivityIndicator size="small" color={Colors.ruby} />
                  ) : (
                    <>
                      <Ionicons name="exit-outline" size={16} color={Colors.ruby} />
                      <Text style={styles.leaveBtnText}>مغادرة البطولة</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Players Grid */}
          {!isOpen && (
            <View style={{ marginHorizontal: 16, marginTop: 8 }}>
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
            </View>
          )}

          {/* Prizes */}
          <View style={[styles.prizesCard, { marginHorizontal: 16, marginTop: 12 }]}>
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

        </ScrollView>

        {/* ── Leave Tournament Confirmation Modal ── */}
        <Modal visible={showLeaveModal} transparent animationType="fade" onRequestClose={() => setShowLeaveModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>مغادرة البطولة؟</Text>
              <Text style={styles.modalDesc}>
                سيتم استرداد رسم الدخول (100 🪙) إلى رصيدك.{"\n"}
                إذا غادر جميع اللاعبين، سيتم حذف البطولة تلقائياً.
              </Text>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowLeaveModal(false)}>
                  <Text style={styles.modalCancelText}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmLeaveBtn} onPress={confirmLeaveTournament}>
                  <Text style={styles.modalConfirmLeaveText}>مغادرة</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ─── List View ───────────────────────────────────────────────────────────────
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

        {/* Create Room Button */}
        <TouchableOpacity
          style={styles.createRoomBtn}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.85}
          disabled={creating || joining}
        >
          {creating ? (
            <ActivityIndicator size="small" color={Colors.black} />
          ) : (
            <>
              <Ionicons name="add-circle" size={22} color={Colors.black} />
              <Text style={styles.createRoomBtnText}>إنشاء غرفة بطولة</Text>
            </>
          )}
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={styles.listTitle}>الغرف المتاحة</Text>
            {tournaments.filter(t => t.status !== "create").length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyStateText}>لا توجد بطولات حالياً</Text>
                <Text style={styles.emptyStateSub}>أنشئ غرفة وادعُ أصدقاءك!</Text>
              </View>
            ) : (
              tournaments.filter(t => t.status !== "create").map((t) => (
                <View key={t.id} style={[styles.tournamentCard, t.joined && styles.tournamentCardJoined]}>
                  <View style={styles.tournamentCardHeader}>
                    <Ionicons name="trophy" size={20} color={Colors.gold} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tournamentCardTitle}>
                        {t.hostPlayerName ? `غرفة ${t.hostPlayerName}` : "بطولة مفتوحة"}
                      </Text>
                      <Text style={styles.tournamentCardSub}>
                        رسم الدخول: {t.entryFee} 🪙
                      </Text>
                    </View>
                    {t.joined && (
                      <View style={styles.joinedBadge}>
                        <Text style={styles.joinedBadgeText}>مشترك</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.tournamentCardStats}>
                    <View style={styles.tournamentStat}>
                      <Ionicons name="people" size={16} color={Colors.sapphire} />
                      <Text style={styles.tournamentStatText}>
                        {t.playerCount} / {t.maxPlayers} لاعب
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: Colors.emerald + "22" }]}>
                      <View style={[styles.statusDotSmall, { backgroundColor: Colors.emerald }]} />
                      <Text style={[styles.statusPillText, { color: Colors.emerald }]}>في انتظار اللاعبين</Text>
                    </View>
                  </View>

                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${Math.min((t.playerCount / Math.max(t.maxPlayers, 1)) * 100, 100)}%` as any }]} />
                  </View>

                  {t.joined ? (
                    <TouchableOpacity
                      style={styles.viewRoomBtn}
                      onPress={() => openTournamentDetail(t.id)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="eye-outline" size={16} color={Colors.gold} />
                      <Text style={styles.viewRoomBtnText}>عرض الغرفة</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.joinRoomBtn, joining && { opacity: 0.6 }]}
                      onPress={() => handleJoinTournament(t.id)}
                      disabled={joining}
                      activeOpacity={0.85}
                    >
                      {joining && selectedTournamentId === t.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="enter-outline" size={16} color="#fff" />
                          <Text style={styles.joinRoomBtnText}>انضم للغرفة</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* ── Create Room Modal ── */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="add-circle" size={40} color={Colors.gold} style={{ marginBottom: 12 }} />
            <Text style={styles.modalTitle}>إنشاء غرفة بطولة</Text>
            <Text style={styles.modalSub}>اختر حجم البطولة</Text>
            <Text style={styles.modalBalance}>رصيدك: {profile.coins} 🪙 · رسم الدخول: 100 🪙</Text>
            {profile.coins < 100 && (
              <Text style={styles.modalWarning}>رصيدك غير كافي!</Text>
            )}
            <View style={styles.sizePickerRow}>
              {([4, 8, 16] as const).map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[styles.sizeOption, selectedSize === size && styles.sizeOptionSelected]}
                  onPress={() => setSelectedSize(size)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sizeOptionNum, selectedSize === size && styles.sizeOptionNumSelected]}>
                    {size}
                  </Text>
                  <Text style={[styles.sizeOptionLabel, selectedSize === size && styles.sizeOptionLabelSelected]}>
                    لاعب
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, profile.coins < 100 && { opacity: 0.5 }]}
                onPress={() => handleCreateAndJoin(selectedSize)}
                disabled={profile.coins < 100}
              >
                <Text style={styles.modalConfirmText}>إنشاء والانضمام</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

// ─── Bracket Match Card ───────────────────────────────────────────────────────
function BracketMatchCard({ match, myId }: { match: TournamentMatch | undefined; myId: string }) {
  if (!match) return <View style={{ width: BK_MATCH_W, height: BK_MATCH_H }} />;

  const p1Won = match.winnerId === match.player1Id && match.winnerId != null;
  const p2Won = match.winnerId === match.player2Id && match.winnerId != null;
  const p1IsMe = match.player1Id === myId;
  const p2IsMe = match.player2Id === myId;
  const isMyMatch = (p1IsMe || p2IsMe) && (!!match.player1Id || !!match.player2Id);
  const isCompleted = match.status === "completed";

  return (
    <View style={[bk.card, isMyMatch && bk.myCard]}>
      <View style={[bk.slot, p1Won && bk.slotWin, !p1Won && isCompleted && bk.slotLose]}>
        {p1Won && <Text style={bk.crown}>👑</Text>}
        <Text
          style={[bk.name, p1IsMe && bk.meText, p1Won && bk.winName, !p1Won && isCompleted && bk.loseName]}
          numberOfLines={1}
        >
          {match.player1Name || "؟"}
        </Text>
      </View>
      <View style={bk.divider} />
      <View style={[bk.slot, p2Won && bk.slotWin, !p2Won && isCompleted && bk.slotLose]}>
        {p2Won && <Text style={bk.crown}>👑</Text>}
        <Text
          style={[bk.name, p2IsMe && bk.meText, p2Won && bk.winName, !p2Won && isCompleted && bk.loseName]}
          numberOfLines={1}
        >
          {match.player2Name || "؟"}
        </Text>
      </View>
    </View>
  );
}

// ─── Tournament Bracket Visualization ────────────────────────────────────────
function TournamentBracket({ matches, myId, maxPlayers }: { matches: TournamentMatch[]; myId: string; maxPlayers?: number }) {
  const size = maxPlayers ?? 8;
  const getM = (round: string, idx: number) =>
    matches.find(m => m.roundName === round && m.matchIndex === idx);

  // ── 8-player standard bracket ────────────────────────────────────────────
  if (size === 8) {
    const qf0 = getM("quarter", 0);
    const qf1 = getM("quarter", 1);
    const qf2 = getM("quarter", 2);
    const qf3 = getM("quarter", 3);
    const sf0 = getM("semi", 0);
    const sf1 = getM("semi", 1);
    const fin = getM("final", 0);

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ width: BK_MATCH_W }}>
            <Text style={bk.colLabel}>ربع النهائي</Text>
            <BracketMatchCard match={qf0} myId={myId} />
            <View style={{ height: BK_QF_GAP }} />
            <BracketMatchCard match={qf1} myId={myId} />
          </View>
          <View style={{ width: BK_CONN_W, height: BK_CONN_H, marginTop: BK_CONN_TOP }}>
            <View style={{ flex: 1, borderTopWidth: 2, borderRightWidth: 2, borderColor: BK_LINE, opacity: BK_LINE_OP }} />
            <View style={{ flex: 1, borderBottomWidth: 2, borderRightWidth: 2, borderColor: BK_LINE, opacity: BK_LINE_OP }} />
          </View>
          <View style={{ width: BK_MATCH_W, height: BK_SEC_H }}>
            <Text style={bk.colLabel}>نصف النهائي</Text>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <BracketMatchCard match={sf0} myId={myId} />
            </View>
          </View>
          <View style={{ width: BK_CONN_W, height: 2, backgroundColor: BK_LINE, opacity: BK_LINE_OP, marginTop: BK_CENTER_LINE_MT }} />
          <View style={{ width: BK_MATCH_W, height: BK_SEC_H }}>
            <Text style={bk.colLabel}>النهائي</Text>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <BracketMatchCard match={fin} myId={myId} />
            </View>
          </View>
          <View style={{ width: BK_CONN_W, height: 2, backgroundColor: BK_LINE, opacity: BK_LINE_OP, marginTop: BK_CENTER_LINE_MT }} />
          <View style={{ width: BK_MATCH_W, height: BK_SEC_H }}>
            <Text style={bk.colLabel}>نصف النهائي</Text>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <BracketMatchCard match={sf1} myId={myId} />
            </View>
          </View>
          <View style={{ width: BK_CONN_W, height: BK_CONN_H, marginTop: BK_CONN_TOP }}>
            <View style={{ flex: 1, borderTopWidth: 2, borderLeftWidth: 2, borderColor: BK_LINE, opacity: BK_LINE_OP }} />
            <View style={{ flex: 1, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: BK_LINE, opacity: BK_LINE_OP }} />
          </View>
          <View style={{ width: BK_MATCH_W }}>
            <Text style={bk.colLabel}>ربع النهائي</Text>
            <BracketMatchCard match={qf2} myId={myId} />
            <View style={{ height: BK_QF_GAP }} />
            <BracketMatchCard match={qf3} myId={myId} />
          </View>
        </View>
      </ScrollView>
    );
  }

  // ── Generic bracket for 4 or 16 players ─────────────────────────────────
  const allRounds = Array.from(new Set(matches.map(m => m.roundName)))
    .sort((a, b) => {
      const countA = matches.filter(m => m.roundName === a).length;
      const countB = matches.filter(m => m.roundName === b).length;
      return countB - countA; // more matches = earlier round
    });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4 }}>
        {allRounds.map((roundName, colIdx) => {
          const roundMatches = matches
            .filter(m => m.roundName === roundName)
            .sort((a, b) => a.matchIndex - b.matchIndex);
          const label = ROUND_LABELS[roundName] || roundName;
          return (
            <React.Fragment key={roundName}>
              <View style={{ width: BK_MATCH_W }}>
                <Text style={bk.colLabel}>{label}</Text>
                {roundMatches.map((m, i) => (
                  <React.Fragment key={m.id}>
                    <BracketMatchCard match={m} myId={myId} />
                    {i < roundMatches.length - 1 && <View style={{ height: BK_QF_GAP }} />}
                  </React.Fragment>
                ))}
              </View>
              {colIdx < allRounds.length - 1 && (
                <View style={{ width: BK_CONN_W, height: 2, backgroundColor: BK_LINE, opacity: BK_LINE_OP, marginTop: BK_CENTER_LINE_MT }} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Bracket StyleSheet ───────────────────────────────────────────────────────
const bk = StyleSheet.create({
  card: {
    width: BK_MATCH_W,
    height: BK_MATCH_H,
    backgroundColor: Colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: "hidden",
  },
  myCard: {
    borderColor: Colors.gold + "70",
    borderWidth: 1.5,
  },
  slot: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  slotWin: {
    backgroundColor: Colors.emerald + "22",
  },
  slotLose: {
    backgroundColor: Colors.ruby + "12",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
  },
  crown: {
    fontSize: 10,
  },
  name: {
    flex: 1,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 11,
    color: Colors.textPrimary,
  },
  meText: {
    color: Colors.gold,
  },
  winName: {
    color: Colors.emerald,
    fontFamily: "Cairo_700Bold",
  },
  loseName: {
    textDecorationLine: "line-through",
    color: Colors.textMuted,
  },
  colLabel: {
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
    marginBottom: 6,
    height: BK_LABEL_H - 6,
    textAlignVertical: "bottom",
  },
});

// ─── Main StyleSheet ──────────────────────────────────────────────────────────
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
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textPrimary },

  winnerBanner: {
    backgroundColor: Colors.gold + "18", borderRadius: 16, padding: 20, alignItems: "center",
    marginBottom: 12, borderWidth: 1, borderColor: Colors.gold + "40",
  },
  winnerEmoji: { fontSize: 40, marginBottom: 8 },
  winnerTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.gold },
  winnerName: { fontFamily: "Cairo_700Bold", fontSize: 22, color: Colors.textPrimary, marginTop: 4 },

  bracketSection: {
    marginBottom: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  bracketSectionTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    textAlign: "right",
  },

  waitingCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  waitingTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.textPrimary,
    textAlign: "center", marginBottom: 14,
  },
  waitingSlots: { gap: 8 },
  waitingSlot: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.backgroundTertiary, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  waitingSlotFilled: { borderColor: Colors.sapphire + "50" },
  waitingSlotEmoji: { fontSize: 18 },
  waitingSlotName: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.textPrimary, flex: 1 },
  waitingSlotEmpty: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted, flex: 1 },

  prizesCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  prizesTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.gold, marginBottom: 10 },
  prizeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  prizeEmoji: { fontSize: 18 },
  prizeText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.textSecondary },

  sectionTitle: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.textSecondary, textAlign: "right", marginBottom: 10 },

  playersGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
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
    ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay,
    justifyContent: "center", alignItems: "center",
  },

  // Leave button (inside waiting card)
  leaveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 16, paddingVertical: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.ruby + "60",
    backgroundColor: Colors.ruby + "12",
  },
  leaveBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.ruby },

  // Leave confirmation modal
  modalBox: {
    backgroundColor: Colors.backgroundSecondary, borderRadius: 24, padding: 28,
    width: "85%", alignItems: "center", borderWidth: 1, borderColor: Colors.cardBorder,
  },
  modalDesc: {
    fontFamily: "Cairo_400Regular", fontSize: 14, color: Colors.textSecondary,
    textAlign: "center", lineHeight: 22, marginTop: 4,
  },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 20, width: "100%" },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.card,
    alignItems: "center",
  },
  modalConfirmLeaveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.ruby, alignItems: "center",
  },
  modalConfirmLeaveText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#fff" },

  // Create Room button
  createRoomBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: Colors.gold, borderRadius: 16,
    paddingVertical: 14, marginBottom: 16,
  },
  createRoomBtnText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.black },

  // Empty state
  emptyState: {
    alignItems: "center", paddingVertical: 48, gap: 8,
  },
  emptyStateText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textMuted },
  emptyStateSub: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.textMuted },

  // Room card sub-text
  tournamentCardSub: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  // Status pill
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  statusDotSmall: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontFamily: "Cairo_600SemiBold", fontSize: 11 },

  // Join / View room buttons
  joinRoomBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 10, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.sapphire,
  },
  joinRoomBtnText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#fff" },
  viewRoomBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 10, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.gold + "60",
    backgroundColor: Colors.gold + "10",
  },
  viewRoomBtnText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.gold },

  // Size picker in create modal
  sizePickerRow: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 4 },
  sizeOption: {
    flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.cardBorder,
  },
  sizeOptionSelected: {
    borderColor: Colors.gold, backgroundColor: Colors.gold + "18",
  },
  sizeOptionNum: { fontFamily: "Cairo_700Bold", fontSize: 22, color: Colors.textMuted },
  sizeOptionNumSelected: { color: Colors.gold },
  sizeOptionLabel: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  sizeOptionLabelSelected: { color: Colors.gold },
});
