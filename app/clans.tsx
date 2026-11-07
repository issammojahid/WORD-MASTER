import { FantasySectionBanner } from "@/components/FantasySectionBanner";
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
import { CoinBalance, GameHeader, GameScreenBackground } from "@/components/GameUi";
import { GameIcon as FeatureIcon } from "@/components/GameIcon";
import { gameDesign } from "@/constants/game-design";

// ── Types ─────────────────────────────────────────────────────────────────────
type ClanMemberInfo = {
  id: string;
  playerId: string;
  warScore: number;
  role: string;
  joinedAt: string;
  name: string;
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
};

type ClanListItem = {
  id: string;
  name: string;
  emoji: string;
  leaderId: string;
  totalWarScore: number;
  memberCount: number;
};

// ── EMOJI PICKER ─────────────────────────────────────────────────────────────
const CLAN_EMOJIS = ["⚔️", "🛡️", "🔥", "💀", "🦁", "🐉", "🦅", "🌙", "⚡", "🌊", "🏹", "💎", "🌟", "🎯", "🗡️", "👑", "🦊", "🐺", "🦇", "🌑"];

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function ClansScreen() {
  const { theme } = useTheme();
  const { profile, playerId } = usePlayer();
  const insets = useSafeAreaInsets();

  // My clan state
  const [myClan, setMyClan] = useState<ClanDetail | null>(null);
  const [loadingMyClan, setLoadingMyClan] = useState(true);

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
    }
  }, [playerId, BASE]);

  useEffect(() => { fetchMyClan(); }, [fetchMyClan]);

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
              const res = await fetch(new URL(`/api/clans/${myClan.id}/leave`, BASE).toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerId }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                Alert.alert("خطأ", data.error === "not_a_member" ? "أنت لست عضواً في هذه العصابة" : "تعذرت المغادرة، حاول مرة أخرى");
              } else {
                setMyClan(null);
              }
            } catch {
              Alert.alert("خطأ", "تعذر الاتصال بالخادم");
            }
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
        const errMsg = data.error === "not_leader" ? "أنت لست القائد"
          : data.error === "name_taken" ? "هذا الاسم مستخدم بالفعل"
          : "حدث خطأ، حاول مرة أخرى";
        Alert.alert("خطأ", errMsg);
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
              const res = await fetch(new URL(`/api/clans/${myClan.id}/kick`, BASE).toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leaderId: playerId, targetPlayerId: targetId }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                const msg = data.error === "not_leader" ? "أنت لست القائد"
                  : data.error === "not_a_member" ? "هذا اللاعب ليس في عصابتك"
                  : "تعذر الطرد، حاول مرة أخرى";
                Alert.alert("خطأ", msg);
              } else {
                await fetchMyClan();
              }
            } catch {
              Alert.alert("خطأ", "تعذر الاتصال بالخادم");
            }
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
      <GameScreenBackground accent="online" />
      <View style={{ paddingTop: insets.top + 8 }}>
        <GameHeader
          title="العشائر"
          onBack={() => router.back()}
          icon={<FeatureIcon name="clans" size={23} color={gameDesign.colors.clans} />}
          trailing={<View style={styles.headerBalance}><CoinBalance amount={profile.coins} /></View>}
        />
        <FantasySectionBanner kind="clans" />
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {loadingMyClan ? (
          <ActivityIndicator size="large" color={gameDesign.colors.clans} style={{ marginTop: 60 }} />
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
            onRefresh={fetchMyClan}
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

      {/* Create Clan Modal */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>إنشاء عصابة جديدة</Text>
            <View style={styles.modalCost}>
              <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>التكلفة: 500 عملة</Text>
              <FeatureIcon name="coins" size={18} color={gameDesign.colors.coins} />
            </View>

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
                {creating ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="shield-outline" size={17} color="#fff" /><Text style={styles.confirmBtnText}>إنشاء</Text></>}
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
                {renaming ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="checkmark" size={17} color="#fff" /><Text style={styles.confirmBtnText}>حفظ</Text></>}
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
            {searching && <ActivityIndicator size="small" color={gameDesign.colors.clans} style={{ marginVertical: 8 }} />}
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
                    <ActivityIndicator size="small" color={gameDesign.colors.clans} />
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
      <View style={styles.noClanIcon}>
        <FeatureIcon name="clans" size={54} color={gameDesign.colors.clans} />
      </View>
      <Text style={[styles.noClanTitle, { color: theme.textPrimary }]}>لست في أي عصابة</Text>
      <Text style={[styles.noClanDesc, { color: theme.textSecondary }]}>
        انضم لعصابة أو أنشئ عصابتك الخاصة وشارك في حروب العصابات الأسبوعية!
      </Text>

      <View style={styles.rewardInfo}>
        <View style={styles.rewardInfoTitle}>
          <Ionicons name="trophy-outline" size={18} color={gameDesign.colors.coins} />
          <Text style={styles.rewardInfoTitleText}>مكافآت أسبوعية</Text>
        </View>
        <View style={styles.rewardRow}>
          <Text style={[styles.rewardItem, { color: theme.textSecondary }]}>المركز الأول: <Text style={{ color: gameDesign.colors.coins, fontFamily: "Cairo_700Bold" }}>300 عملة للعضو</Text></Text>
        </View>
        <View style={styles.rewardRow}>
          <FeatureIcon name="achievements" size={17} color="#C0C0C0" />
          <Text style={[styles.rewardItem, { color: theme.textSecondary }]}>المركز الثاني: <Text style={{ color: "#C0C0C0", fontFamily: "Cairo_700Bold" }}>150 عملة للعضو</Text></Text>
        </View>
        <View style={styles.rewardRow}>
          <FeatureIcon name="achievements" size={17} color="#D59A3F" />
          <Text style={[styles.rewardItem, { color: theme.textSecondary }]}>المركز الثالث: <Text style={{ color: "#D59A3F", fontFamily: "Cairo_700Bold" }}>75 عملة للعضو</Text></Text>
        </View>
      </View>

      <TouchableOpacity style={styles.createBtn} onPress={onCreate} activeOpacity={0.85}>
        <LinearGradient colors={[gameDesign.colors.clans, "#966BC4"]} style={styles.createBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.createBtnText}>إنشاء عصابة (500 عملة)</Text>
          <FeatureIcon name="coins" size={18} color={gameDesign.colors.coins} />
        </LinearGradient>
      </TouchableOpacity>
      <Text style={[styles.orText, { color: theme.textMuted }]}>— أو —</Text>
      <TouchableOpacity style={[styles.joinBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} onPress={onJoin} activeOpacity={0.85}>
        <Ionicons name="search" size={18} color={gameDesign.colors.clans} />
        <Text style={[styles.joinBtnTextLarge, { color: gameDesign.colors.clans }]}>البحث عن عصابة والانضمام</Text>
      </TouchableOpacity>

      <View style={styles.balanceNote}>
        <Text style={[styles.coinsNote, { color: theme.textMuted }]}>رصيدك الحالي: {profile.coins}</Text>
        <FeatureIcon name="coins" size={16} color={gameDesign.colors.coins} />
      </View>
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
        colors={["#087C91", "#24559A", "#7046A3"]}
        style={styles.clanCard}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <Text style={styles.clanEmoji}>{clan.emoji}</Text>
        <Text style={styles.clanName}>{clan.name}</Text>
        <View style={styles.clanStatsRow}>
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
              <Ionicons name="ribbon-outline" size={16} color={gameDesign.colors.coins} />
              <Text style={styles.leaderBadgeText}>القائد</Text>
            </View>
            <TouchableOpacity style={styles.renameBtn} onPress={onRename} activeOpacity={0.8}>
              <Ionicons name="pencil" size={14} color={gameDesign.colors.clans} />
              <Text style={styles.renameBtnText}>تغيير الاسم</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.myWarScoreRow}>
          <Ionicons name="flash-outline" size={16} color="#FFB454" />
          <Text style={styles.myWarScore}>نقاطك: {myWarScore}</Text>
        </View>
      </LinearGradient>

      {/* Weekly war info */}
      <View style={[styles.warInfoCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.warTitleRow}>
          <Ionicons name="time-outline" size={17} color={gameDesign.colors.coins} />
          <Text style={[styles.warInfoTitle, { color: gameDesign.colors.coins }]}>حرب هذا الأسبوع</Text>
        </View>
        <Text style={[styles.warInfoDesc, { color: theme.textSecondary }]}>
          كل انتصار يُضيف نقطة لعصابتك. العصابة الأولى تفوز بـ 300 عملة لكل عضو!
        </Text>
      </View>

      {/* Members list */}
      <Text style={[styles.membersTitle, { color: theme.textPrimary }]}>الأعضاء ({clan.members.length})</Text>
      {clan.members.map((m) => (
        <View key={m.id} style={[styles.memberRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.memberInfo}>
            <Text style={[styles.memberName, { color: theme.textPrimary }]}>
              {m.role === "leader" ? "القائد · " : ""}{m.name}
            </Text>
            <Text style={[styles.memberLevel, { color: theme.textSecondary }]}>مستوى {m.level}</Text>
          </View>
          <View style={styles.memberScoreCol}>
            <Ionicons name="flash-outline" size={15} color="#FFB454" />
            <Text style={styles.memberWarScore}>{m.warScore}</Text>
            {isLeader && m.playerId !== playerId && (
              <TouchableOpacity onPress={() => onKick(m.playerId, m.name)} style={styles.kickBtn}>
                <Ionicons name="remove-circle" size={18} color={gameDesign.colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      {/* Leave button */}
      <TouchableOpacity style={styles.leaveBtn} onPress={onLeave} activeOpacity={0.8}>
        <Ionicons name="exit-outline" size={18} color={gameDesign.colors.danger} />
        <Text style={styles.leaveBtnText}>مغادرة العصابة</Text>
      </TouchableOpacity>
    </View>
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
  headerBalance: { minWidth: 48, alignItems: "flex-end" },
  modalCost: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  noClanIcon: { width: 86, height: 86, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: `${gameDesign.colors.clans}18`, marginBottom: 12 },
  balanceNote: { flexDirection: "row", alignItems: "center", gap: 6 },

  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

  // No Clan
  noClanContainer: { alignItems: "center", paddingTop: 30 },
  noClanEmoji: { fontSize: 60, marginBottom: 12 },
  noClanTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, marginBottom: 8 },
  noClanDesc: { fontFamily: "Cairo_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 24, paddingHorizontal: 20 },
  rewardInfo: {
    width: "100%", borderRadius: 16, backgroundColor: `${gameDesign.colors.coins}15`,
    borderWidth: 1, borderColor: `${gameDesign.colors.coins}30`, padding: 16, marginBottom: 24,
  },
  rewardInfoTitle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 8 },
  rewardInfoTitleText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: gameDesign.colors.coins },
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
    marginBottom: 16, borderWidth: 1.5, borderColor: `${gameDesign.colors.clans}40`,
    shadowColor: gameDesign.colors.clans, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
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
    backgroundColor: `${gameDesign.colors.coins}20`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: `${gameDesign.colors.coins}40`, flexDirection: "row", alignItems: "center", gap: 5,
  },
  leaderBadgeText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: gameDesign.colors.coins },
  renameBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: `${gameDesign.colors.clans}15`, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: `${gameDesign.colors.clans}30`,
  },
  renameBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: gameDesign.colors.clans },
  warTitleRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 },
  myWarScore: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "rgba(255,255,255,0.75)" },
  myWarScoreRow: { flexDirection: "row", alignItems: "center", gap: 6 },

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
  memberInfo: { flex: 1 },
  memberName: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
  memberLevel: { fontFamily: "Cairo_400Regular", fontSize: 12, marginTop: 2 },
  memberScoreCol: { flexDirection: "row", alignItems: "center", gap: 8 },
  memberWarScore: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#FFB454" },
  kickBtn: { padding: 4 },
  leaveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: `${gameDesign.colors.danger}40`,
    backgroundColor: `${gameDesign.colors.danger}12`, marginTop: 16,
  },
  leaveBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: gameDesign.colors.danger },

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
  emojiSelected: { borderColor: gameDesign.colors.clans, backgroundColor: `${gameDesign.colors.clans}20` },
  emojiText: { fontSize: 22 },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  cancelBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 15 },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: gameDesign.colors.clans },
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
  joinBtnText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: gameDesign.colors.clans },
  emptyText: { fontFamily: "Cairo_400Regular", fontSize: 14, textAlign: "center", marginTop: 20 },
});
