import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Animated,
  FlatList,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";

// ── Types ─────────────────────────────────────────────────────────────────────
type ClanMemberInfo = {
  id: string;
  playerId: string;
  warScore: number;
  role: string;
  joinedAt: string;
  name: string;
  equippedSkin: string;
  level: number;
};

type ClanDetail = {
  id: string;
  name: string;
  emoji: string;
  leaderId: string;
  totalWarScore: number;
  createdAt: string;
  members: ClanMemberInfo[];
  rank: number;
};

type ClanListItem = {
  id: string;
  name: string;
  emoji: string;
  leaderId: string;
  totalWarScore: number;
  rank: number;
  memberCount: number;
};

// ── Clan rank medal ───────────────────────────────────────────────────────────
function rankMedal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

// ── EMOJI PICKER ─────────────────────────────────────────────────────────────
const CLAN_EMOJIS = ["⚔️", "🛡️", "🔥", "💀", "🦁", "🐉", "🦅", "🌙", "⚡", "🌊", "🏹", "💎", "🌟", "🎯", "🗡️", "👑", "🦊", "🐺", "🦇", "🌑"];

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function ClansScreen() {
  const { theme, isDark } = useTheme();
  const { profile, playerId } = usePlayer();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<"mine" | "leaderboard">("mine");
  const tabAnim = useRef(new Animated.Value(0)).current;

  // My clan state
  const [myClan, setMyClan] = useState<ClanDetail | null>(null);
  const [loadingMyClan, setLoadingMyClan] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<ClanListItem[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);

  // Create clan modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmoji, setCreateEmoji] = useState("⚔️");
  const [creating, setCreating] = useState(false);

  // Join clan modal
  const [showJoin, setShowJoin] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<ClanListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const BASE = getApiUrl();

  const fetchMyClan = useCallback(async () => {
    if (!playerId) { setLoadingMyClan(false); return; }
    try {
      // First get player's clanId from server profile
      const pRes = await fetch(new URL(`/api/player/${playerId}`, BASE).toString());
      if (!pRes.ok) { setLoadingMyClan(false); return; }
      const pData = await pRes.json();
      const clanId: string | null = pData.clanId ?? null;
      if (!clanId) { setMyClan(null); setLoadingMyClan(false); return; }

      const cRes = await fetch(new URL(`/api/clans/${clanId}`, BASE).toString());
      if (!cRes.ok) { setMyClan(null); setLoadingMyClan(false); return; }
      const cData: ClanDetail = await cRes.json();
      setMyClan(cData);
    } catch {
      setMyClan(null);
    } finally {
      setLoadingMyClan(false);
      setRefreshing(false);
    }
  }, [playerId, BASE]);

  const fetchLeaderboard = useCallback(async () => {
    setLoadingBoard(true);
    try {
      const res = await fetch(new URL("/api/clans/leaderboard", BASE).toString());
      if (res.ok) setLeaderboard(await res.json());
    } catch {}
    setLoadingBoard(false);
  }, [BASE]);

  useEffect(() => { fetchMyClan(); }, [fetchMyClan]);
  useEffect(() => { if (activeTab === "leaderboard") fetchLeaderboard(); }, [activeTab, fetchLeaderboard]);

  const switchTab = (tab: "mine" | "leaderboard") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    Animated.spring(tabAnim, { toValue: tab === "mine" ? 0 : 1, useNativeDriver: false, tension: 60, friction: 10 }).start();
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (q: string) => {
    setSearchQ(q);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(new URL(`/api/clans/search?q=${encodeURIComponent(q)}`, BASE).toString());
        if (res.ok) setSearchResults(await res.json());
      } catch {}
      setSearching(false);
    }, 500);
  };

  // ── Create clan ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!createName.trim() || creating) return;
    setCreating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(new URL("/api/clans/create", BASE).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, name: createName.trim(), emoji: createEmoji }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msgs: Record<string, string> = {
          already_in_clan: "أنت بالفعل في عصابة",
          insufficient_coins: "تحتاج 500 عملة لإنشاء عصابة",
          name_taken: "هذا الاسم مأخوذ، جرب اسماً آخر",
          missing_params: "بيانات ناقصة",
        };
        Alert.alert("خطأ", msgs[data.error] || "حدث خطأ");
      } else {
        setShowCreate(false);
        setCreateName("");
        setCreateEmoji("⚔️");
        await fetchMyClan();
        Alert.alert("تهانينا!", `تم إنشاء عصابة "${createEmoji} ${createName.trim()}" بنجاح!`);
      }
    } catch {
      Alert.alert("خطأ", "تعذر الاتصال بالخادم");
    }
    setCreating(false);
  };

  // ── Join clan ─────────────────────────────────────────────────────────────
  const handleJoin = async (clanId: string, clanName: string) => {
    if (joining) return;
    setJoining(clanId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(new URL(`/api/clans/${clanId}/join`, BASE).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msgs: Record<string, string> = {
          already_in_clan: "أنت بالفعل في عصابة",
          clan_full: "العصابة ممتلئة (الحد الأقصى 20 عضو)",
          not_found: "لم يتم العثور على العصابة",
        };
        Alert.alert("خطأ", msgs[data.error] || "حدث خطأ");
      } else {
        setShowJoin(false);
        setSearchQ("");
        setSearchResults([]);
        await fetchMyClan();
        Alert.alert("أهلاً وسهلاً!", `انضممت إلى عصابة "${clanName}" 🎉`);
      }
    } catch {
      Alert.alert("خطأ", "تعذر الاتصال بالخادم");
    }
    setJoining(null);
  };

  // ── Leave clan ────────────────────────────────────────────────────────────
  const handleLeave = () => {
    if (!myClan) return;
    Alert.alert(
      "مغادرة العصابة",
      `هل تريد مغادرة "${myClan.emoji} ${myClan.name}"؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "مغادرة", style: "destructive",
          onPress: async () => {
            try {
              await fetch(new URL(`/api/clans/${myClan.id}/leave`, BASE).toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerId }),
              });
              setMyClan(null);
            } catch {}
          },
        },
      ]
    );
  };

  // ── Rename clan (leader only) ─────────────────────────────────────────────
  const [showRename, setShowRename] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [renaming, setRenaming] = useState(false);

  const handleRename = async () => {
    if (!myClan || !renameInput.trim() || renaming) return;
    setRenaming(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(new URL(`/api/clans/${myClan.id}/rename`, BASE).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaderId: playerId, name: renameInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("خطأ", data.error === "not_leader" ? "أنت لست القائد" : "حدث خطأ");
      } else {
        setShowRename(false);
        setRenameInput("");
        await fetchMyClan();
        Alert.alert("تم!", "تم تغيير اسم العصابة بنجاح ✅");
      }
    } catch {
      Alert.alert("خطأ", "تعذر الاتصال بالخادم");
    }
    setRenaming(false);
  };

  // ── Kick member ───────────────────────────────────────────────────────────
  const handleKick = (targetId: string, targetName: string) => {
    if (!myClan) return;
    Alert.alert(
      "طرد العضو",
      `هل تريد طرد "${targetName}" من العصابة؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "طرد", style: "destructive",
          onPress: async () => {
            try {
              await fetch(new URL(`/api/clans/${myClan.id}/kick`, BASE).toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leaderId: playerId, targetPlayerId: targetId }),
              });
              await fetchMyClan();
            } catch {}
          },
        },
      ]
    );
  };

  const isLeader = myClan?.leaderId === playerId;
  const myWarScore = myClan?.members.find(m => m.playerId === playerId)?.warScore ?? 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#0F0A2E", "#1A0A3E"] : ["#1A1040", "#2D1060"]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚔️ العصابات</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.card, borderBottomColor: theme.cardBorder }]}>
        {(["mine", "leaderboard"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => switchTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, { color: activeTab === tab ? "#BF00FF" : theme.textSecondary }]}>
              {tab === "mine" ? "⚔️ عصابتي" : "🏆 الترتيب"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === "mine" ? (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          {loadingMyClan ? (
            <ActivityIndicator size="large" color="#BF00FF" style={{ marginTop: 60 }} />
          ) : myClan ? (
            <MyClanView
              clan={myClan}
              playerId={playerId}
              isLeader={isLeader}
              myWarScore={myWarScore}
              theme={theme}
              onLeave={handleLeave}
              onKick={handleKick}
              onRename={() => { setRenameInput(myClan.name); setShowRename(true); }}
              onRefresh={async () => { setRefreshing(true); await fetchMyClan(); }}
            />
          ) : (
            <NoClanView
              profile={profile}
              theme={theme}
              onCreate={() => setShowCreate(true)}
              onJoin={() => setShowJoin(true)}
            />
          )}
        </ScrollView>
      ) : (
        <LeaderboardView
          data={leaderboard}
          loading={loadingBoard}
          playerId={playerId}
          myClanId={myClan?.id ?? null}
          theme={theme}
          insets={insets}
        />
      )}

      {/* Create Clan Modal */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>إنشاء عصابة جديدة</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>التكلفة: 500 عملة 🪙</Text>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>اسم العصابة</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
              value={createName}
              onChangeText={setCreateName}
              maxLength={20}
              textAlign="right"
              placeholder="اسم العصابة..."
              placeholderTextColor={theme.inputPlaceholder}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>الرمز التعبيري</Text>
            <View style={styles.emojiGrid}>
              {CLAN_EMOJIS.map((em) => (
                <TouchableOpacity
                  key={em}
                  style={[styles.emojiOption, createEmoji === em && styles.emojiSelected]}
                  onPress={() => setCreateEmoji(em)}
                >
                  <Text style={styles.emojiText}>{em}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.card }]} onPress={() => { setShowCreate(false); setCreateName(""); }}>
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (!createName.trim() || creating) && styles.confirmBtnDisabled]}
                onPress={handleCreate}
                disabled={!createName.trim() || creating}
              >
                {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmBtnText}>إنشاء 🗡️</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename Clan Modal (leader only) */}
      <Modal visible={showRename} transparent animationType="fade" onRequestClose={() => setShowRename(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>تغيير اسم العصابة</Text>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>الاسم الجديد</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
              value={renameInput}
              onChangeText={setRenameInput}
              maxLength={20}
              textAlign="right"
              placeholder="اسم العصابة..."
              placeholderTextColor={theme.inputPlaceholder}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.card }]} onPress={() => { setShowRename(false); setRenameInput(""); }}>
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (!renameInput.trim() || renaming) && styles.confirmBtnDisabled]}
                onPress={handleRename}
                disabled={!renameInput.trim() || renaming}
              >
                {renaming ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmBtnText}>حفظ ✅</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join Clan Modal */}
      <Modal visible={showJoin} transparent animationType="fade" onRequestClose={() => { setShowJoin(false); setSearchQ(""); setSearchResults([]); }}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>الانضمام لعصابة</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
              value={searchQ}
              onChangeText={handleSearch}
              placeholder="ابحث عن عصابة..."
              placeholderTextColor={theme.inputPlaceholder}
              textAlign="right"
              autoFocus
            />
            {searching && <ActivityIndicator size="small" color="#BF00FF" style={{ marginVertical: 8 }} />}
            <ScrollView style={styles.searchList} showsVerticalScrollIndicator={false}>
              {searchResults.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.searchItem, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                  onPress={() => handleJoin(c.id, `${c.emoji} ${c.name}`)}
                  disabled={joining === c.id}
                >
                  <Text style={styles.searchItemEmoji}>{c.emoji}</Text>
                  <View style={styles.searchItemInfo}>
                    <Text style={[styles.searchItemName, { color: theme.textPrimary }]}>{c.name}</Text>
                    <Text style={[styles.searchItemMeta, { color: theme.textSecondary }]}>{c.memberCount}/20 عضو · {c.totalWarScore} نقطة</Text>
                  </View>
                  {joining === c.id ? (
                    <ActivityIndicator size="small" color="#BF00FF" />
                  ) : (
                    <Text style={styles.joinBtnText}>انضم</Text>
                  )}
                </TouchableOpacity>
              ))}
              {searchResults.length === 0 && searchQ.trim().length >= 2 && !searching && (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>لا توجد نتائج</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.card, marginTop: 8 }]} onPress={() => { setShowJoin(false); setSearchQ(""); setSearchResults([]); }}>
              <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NoClanView({ profile, theme, onCreate, onJoin }: { profile: ReturnType<typeof usePlayer>["profile"]; theme: ReturnType<typeof useTheme>["theme"]; onCreate: () => void; onJoin: () => void }) {
  return (
    <View style={styles.noClanContainer}>
      <Text style={styles.noClanEmoji}>⚔️</Text>
      <Text style={[styles.noClanTitle, { color: theme.textPrimary }]}>لست في أي عصابة</Text>
      <Text style={[styles.noClanDesc, { color: theme.textSecondary }]}>
        انضم لعصابة أو أنشئ عصابتك الخاصة وشارك في حروب العصابات الأسبوعية!
      </Text>

      <View style={styles.rewardInfo}>
        <Text style={[styles.rewardInfoTitle, { color: "#F5C842" }]}>🏆 مكافآت أسبوعية</Text>
        <View style={styles.rewardRow}>
          <Text style={[styles.rewardItem, { color: theme.textSecondary }]}>🥇 المركز الأول: <Text style={{ color: "#F5C842", fontFamily: "Cairo_700Bold" }}>300 عملة للعضو</Text></Text>
        </View>
        <View style={styles.rewardRow}>
          <Text style={[styles.rewardItem, { color: theme.textSecondary }]}>🥈 المركز الثاني: <Text style={{ color: "#C0C0C0", fontFamily: "Cairo_700Bold" }}>150 عملة للعضو</Text></Text>
        </View>
        <View style={styles.rewardRow}>
          <Text style={[styles.rewardItem, { color: theme.textSecondary }]}>🥉 المركز الثالث: <Text style={{ color: "#CD7F32", fontFamily: "Cairo_700Bold" }}>75 عملة للعضو</Text></Text>
        </View>
      </View>

      <TouchableOpacity style={styles.createBtn} onPress={onCreate} activeOpacity={0.85}>
        <LinearGradient colors={["#8B00FF", "#BF00FF"]} style={styles.createBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.createBtnText}>إنشاء عصابة (500 🪙)</Text>
        </LinearGradient>
      </TouchableOpacity>
      <Text style={[styles.orText, { color: theme.textMuted }]}>— أو —</Text>
      <TouchableOpacity style={[styles.joinBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} onPress={onJoin} activeOpacity={0.85}>
        <Ionicons name="search" size={18} color="#BF00FF" />
        <Text style={[styles.joinBtnTextLarge, { color: "#BF00FF" }]}>البحث عن عصابة والانضمام</Text>
      </TouchableOpacity>

      <Text style={[styles.coinsNote, { color: theme.textMuted }]}>رصيدك الحالي: {profile.coins} 🪙</Text>
    </View>
  );
}

function MyClanView({
  clan, playerId, isLeader, myWarScore, theme, onLeave, onKick, onRename, onRefresh,
}: {
  clan: ClanDetail;
  playerId: string;
  isLeader: boolean;
  myWarScore: number;
  theme: ReturnType<typeof useTheme>["theme"];
  onLeave: () => void;
  onKick: (id: string, name: string) => void;
  onRename: () => void;
  onRefresh: () => Promise<void>;
}) {
  return (
    <View style={styles.myClanContainer}>
      {/* Clan header card */}
      <LinearGradient
        colors={["#1A003D", "#2D006B", "#1A003D"]}
        style={styles.clanCard}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <Text style={styles.clanEmoji}>{clan.emoji}</Text>
        <Text style={styles.clanName}>{clan.name}</Text>
        <View style={styles.clanStatsRow}>
          <View style={styles.clanStat}>
            <Text style={styles.clanStatValue}>{rankMedal(clan.rank)}</Text>
            <Text style={styles.clanStatLabel}>الترتيب</Text>
          </View>
          <View style={styles.clanStatDivider} />
          <View style={styles.clanStat}>
            <Text style={styles.clanStatValue}>{clan.totalWarScore}</Text>
            <Text style={styles.clanStatLabel}>نقاط الحرب</Text>
          </View>
          <View style={styles.clanStatDivider} />
          <View style={styles.clanStat}>
            <Text style={styles.clanStatValue}>{clan.members.length}/20</Text>
            <Text style={styles.clanStatLabel}>الأعضاء</Text>
          </View>
        </View>
        {isLeader && (
          <View style={styles.leaderRow}>
            <View style={styles.leaderBadge}>
              <Text style={styles.leaderBadgeText}>👑 القائد</Text>
            </View>
            <TouchableOpacity style={styles.renameBtn} onPress={onRename} activeOpacity={0.8}>
              <Ionicons name="pencil" size={14} color="#BF00FF" />
              <Text style={styles.renameBtnText}>تغيير الاسم</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.myWarScore}>نقاطك: {myWarScore} ⚔️</Text>
      </LinearGradient>

      {/* Weekly war info */}
      <View style={[styles.warInfoCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.warInfoTitle, { color: "#F5C842" }]}>⏱️ حرب هذا الأسبوع</Text>
        <Text style={[styles.warInfoDesc, { color: theme.textSecondary }]}>
          كل انتصار يُضيف نقطة لعصابتك. العصابة الأولى تفوز بـ 300 عملة لكل عضو!
        </Text>
      </View>

      {/* Members list */}
      <Text style={[styles.membersTitle, { color: theme.textPrimary }]}>الأعضاء ({clan.members.length})</Text>
      {clan.members.map((m, idx) => (
        <View key={m.id} style={[styles.memberRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={styles.memberRank}>{idx + 1}</Text>
          <View style={styles.memberInfo}>
            <Text style={[styles.memberName, { color: theme.textPrimary }]}>
              {m.role === "leader" ? "👑 " : ""}{m.name}
            </Text>
            <Text style={[styles.memberLevel, { color: theme.textSecondary }]}>مستوى {m.level}</Text>
          </View>
          <View style={styles.memberScoreCol}>
            <Text style={styles.memberWarScore}>{m.warScore} ⚔️</Text>
            {isLeader && m.playerId !== playerId && (
              <TouchableOpacity onPress={() => onKick(m.playerId, m.name)} style={styles.kickBtn}>
                <Ionicons name="remove-circle" size={18} color="#FF3B3B" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      {/* Leave button */}
      <TouchableOpacity style={styles.leaveBtn} onPress={onLeave} activeOpacity={0.8}>
        <Ionicons name="exit-outline" size={18} color="#FF3B3B" />
        <Text style={styles.leaveBtnText}>مغادرة العصابة</Text>
      </TouchableOpacity>
    </View>
  );
}

function LeaderboardView({
  data, loading, playerId, myClanId, theme, insets,
}: {
  data: ClanListItem[];
  loading: boolean;
  playerId: string;
  myClanId: string | null;
  theme: ReturnType<typeof useTheme>["theme"];
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  if (loading) return <ActivityIndicator size="large" color="#BF00FF" style={{ marginTop: 60 }} />;

  if (data.length === 0) {
    return (
      <View style={styles.emptyBoard}>
        <Text style={styles.noClanEmoji}>🏆</Text>
        <Text style={[styles.noClanTitle, { color: theme.textPrimary }]}>لا توجد عصابات بعد</Text>
        <Text style={[styles.noClanDesc, { color: theme.textSecondary }]}>كن أول من ينشئ عصابة!</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 24 }}
      renderItem={({ item }) => {
        const isMe = item.id === myClanId;
        return (
          <LinearGradient
            colors={item.rank === 1 ? ["#3D2900", "#2B1A00"] : item.rank === 2 ? ["#2B2B2B", "#1A1A1A"] : item.rank === 3 ? ["#2A1800", "#180E00"] : [theme.card, theme.card]}
            style={[styles.boardRow, { borderColor: isMe ? "#BF00FF" : theme.cardBorder, borderWidth: isMe ? 2 : 1 }]}
          >
            <Text style={styles.boardRank}>{rankMedal(item.rank)}</Text>
            <Text style={styles.boardEmoji}>{item.emoji}</Text>
            <View style={styles.boardInfo}>
              <Text style={[styles.boardName, { color: theme.textPrimary }]}>{item.name}{isMe ? " (عصابتي)" : ""}</Text>
              <Text style={[styles.boardMeta, { color: theme.textSecondary }]}>{item.memberCount} عضو</Text>
            </View>
            <View style={styles.boardScoreCol}>
              <Text style={styles.boardScore}>{item.totalWarScore}</Text>
              <Text style={[styles.boardScoreLabel, { color: theme.textSecondary }]}>نقطة</Text>
            </View>
          </LinearGradient>
        );
      }}
    />
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#fff" },

  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#BF00FF",
  },
  tabLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 15 },

  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

  // No Clan
  noClanContainer: { alignItems: "center", paddingTop: 30 },
  noClanEmoji: { fontSize: 60, marginBottom: 12 },
  noClanTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, marginBottom: 8 },
  noClanDesc: { fontFamily: "Cairo_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 24, paddingHorizontal: 20 },
  rewardInfo: {
    width: "100%", borderRadius: 16, backgroundColor: "#F5C84215",
    borderWidth: 1, borderColor: "#F5C84230", padding: 16, marginBottom: 24,
  },
  rewardInfoTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, marginBottom: 8, textAlign: "center" },
  rewardRow: { marginBottom: 4 },
  rewardItem: { fontFamily: "Cairo_400Regular", fontSize: 13 },
  createBtn: { width: "100%", borderRadius: 16, overflow: "hidden", marginBottom: 12 },
  createBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  createBtnText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#fff" },
  orText: { fontFamily: "Cairo_400Regular", fontSize: 13, marginVertical: 10 },
  joinBtn: {
    width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 16, borderWidth: 1.5, paddingVertical: 13, marginBottom: 20,
  },
  joinBtnTextLarge: { fontFamily: "Cairo_600SemiBold", fontSize: 15 },
  coinsNote: { fontFamily: "Cairo_400Regular", fontSize: 13 },

  // My Clan
  myClanContainer: { paddingBottom: 20 },
  clanCard: {
    borderRadius: 20, padding: 20, alignItems: "center",
    marginBottom: 16, borderWidth: 1.5, borderColor: "#BF00FF40",
    shadowColor: "#BF00FF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  clanEmoji: { fontSize: 52, marginBottom: 8 },
  clanName: { fontFamily: "Cairo_700Bold", fontSize: 22, color: "#fff", marginBottom: 14 },
  clanStatsRow: { flexDirection: "row", alignItems: "center", gap: 0, marginBottom: 12, width: "100%" },
  clanStat: { flex: 1, alignItems: "center" },
  clanStatValue: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#fff" },
  clanStatLabel: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  clanStatDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)" },
  leaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  leaderBadge: {
    backgroundColor: "#F5C84220", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: "#F5C84240",
  },
  leaderBadgeText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#F5C842" },
  renameBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#BF00FF15", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: "#BF00FF30",
  },
  renameBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#BF00FF" },
  myWarScore: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "rgba(255,255,255,0.75)" },

  warInfoCard: {
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 20,
  },
  warInfoTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, marginBottom: 6 },
  warInfoDesc: { fontFamily: "Cairo_400Regular", fontSize: 13, lineHeight: 20 },

  membersTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, marginBottom: 10 },
  memberRow: {
    flexDirection: "row", alignItems: "center", padding: 12,
    borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  memberRank: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#BF00FF", width: 26 },
  memberInfo: { flex: 1 },
  memberName: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
  memberLevel: { fontFamily: "Cairo_400Regular", fontSize: 12, marginTop: 2 },
  memberScoreCol: { flexDirection: "row", alignItems: "center", gap: 8 },
  memberWarScore: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#FF6B00" },
  kickBtn: { padding: 4 },
  leaveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: "#FF3B3B40",
    backgroundColor: "#FF3B3B12", marginTop: 16,
  },
  leaveBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "#FF3B3B" },

  // Leaderboard
  emptyBoard: { flex: 1, alignItems: "center", paddingTop: 60 },
  boardRow: {
    flexDirection: "row", alignItems: "center", padding: 14,
    borderRadius: 14, marginBottom: 10, gap: 4,
  },
  boardRank: { fontFamily: "Cairo_700Bold", fontSize: 18, width: 40, textAlign: "center" },
  boardEmoji: { fontSize: 28, marginRight: 4 },
  boardInfo: { flex: 1, marginLeft: 6 },
  boardName: { fontFamily: "Cairo_700Bold", fontSize: 15 },
  boardMeta: { fontFamily: "Cairo_400Regular", fontSize: 12, marginTop: 2 },
  boardScoreCol: { alignItems: "center" },
  boardScore: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#F5C842" },
  boardScoreLabel: { fontFamily: "Cairo_400Regular", fontSize: 11, marginTop: 1 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", borderRadius: 24, padding: 24, maxHeight: "90%" },
  modalTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, textAlign: "center", marginBottom: 4 },
  modalSubtitle: { fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "center", marginBottom: 16 },
  inputLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, fontFamily: "Cairo_400Regular", fontSize: 15, marginBottom: 16,
  },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20, justifyContent: "center" },
  emojiOption: {
    width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1.5, borderColor: "transparent",
  },
  emojiSelected: { borderColor: "#BF00FF", backgroundColor: "#BF00FF20" },
  emojiText: { fontSize: 22 },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  cancelBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 15 },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: "#BF00FF" },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#fff" },
  searchList: { maxHeight: 280, marginBottom: 8 },
  searchItem: {
    flexDirection: "row", alignItems: "center", padding: 12,
    borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  searchItemEmoji: { fontSize: 26, marginRight: 8 },
  searchItemInfo: { flex: 1 },
  searchItemName: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
  searchItemMeta: { fontFamily: "Cairo_400Regular", fontSize: 12, marginTop: 2 },
  joinBtnText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#BF00FF" },
  emptyText: { fontFamily: "Cairo_400Regular", fontSize: 14, textAlign: "center", marginTop: 20 },
});
