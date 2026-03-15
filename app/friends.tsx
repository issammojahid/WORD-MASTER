import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { fetch } from "expo/fetch";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { ScreenErrorBoundary } from "@/components/ScreenErrorBoundary";
import { getDisplayCode } from "@/lib/player-code";

type PlayerResult = { id: string; name: string; playerCode?: string | null; playerTag?: number | null; skin: string; level: number; wins: number };
type FriendEntry = {
  requestId: string;
  status: "pending" | "accepted" | "rejected";
  isSender: boolean;
  player: PlayerResult;
};

type TabType = "friends" | "search" | "requests" | "gifts";

type ApiFetchOptions = { method?: string; body?: BodyInit; headers?: HeadersInit };
async function apiFetch(url: string, options?: ApiFetchOptions) {
  try {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

type GiftModalState = { visible: boolean; targetId: string; targetName: string };

function FriendsScreenInner() {
  const insets = useSafeAreaInsets();
  const { playerId, profile, addCoins } = usePlayer();
  const { theme } = useTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabType>("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [copiedToast, setCopiedToast] = useState(false);
  const [giftModal, setGiftModal] = useState<GiftModalState>({ visible: false, targetId: "", targetName: "" });
  const [giftSending, setGiftSending] = useState(false);
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const myDisplayCode = getDisplayCode(profile.name, playerId, profile.playerTag);

  const copyToClipboard = useCallback(async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setCopiedToast(false), 2000);
  }, []);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: friendRowsRaw, isLoading: loadingFriends } = useQuery<FriendEntry[]>({
    queryKey: ["/api/friends", playerId],
    queryFn: async () => {
      const url = new URL(`/api/friends/${playerId}`, getApiUrl());
      const result = await apiFetch(url.toString());
      return Array.isArray(result) ? result : [];
    },
    enabled: !!playerId,
    refetchInterval: 10_000,
    initialData: [],
  });

  const { data: pendingGiftsRaw } = useQuery({
    queryKey: ["/api/friends/gifts/pending", playerId],
    queryFn: async () => {
      const url = new URL(`/api/friends/gifts/pending/${playerId}`, getApiUrl());
      const result = await apiFetch(url.toString());
      return Array.isArray(result) ? result : [];
    },
    enabled: !!playerId,
    refetchInterval: 15_000,
    initialData: [],
  });
  const pendingGiftsCount = Array.isArray(pendingGiftsRaw) ? pendingGiftsRaw.length : 0;

  const { data: giftHistoryRaw, isLoading: loadingGifts } = useQuery({
    queryKey: ["/api/friends/gifts/history", playerId],
    queryFn: async () => {
      const url = new URL(`/api/friends/gifts/history/${playerId}`, getApiUrl());
      const result = await apiFetch(url.toString());
      return Array.isArray(result) ? result : [];
    },
    enabled: !!playerId && tab === "gifts",
    initialData: [],
  });
  const giftHistory: any[] = Array.isArray(giftHistoryRaw) ? giftHistoryRaw : [];

  const allFriendRows: FriendEntry[] = Array.isArray(friendRowsRaw) ? friendRowsRaw : [];

  const acceptedFriends = allFriendRows.filter((r) => r.status === "accepted");
  const pendingReceived = allFriendRows.filter((r) => r.status === "pending" && !r.isSender);
  const pendingSent = allFriendRows.filter((r) => r.status === "pending" && r.isSender);

  const { data: searchResultsRaw, isLoading: loadingSearch } = useQuery<PlayerResult[]>({
    queryKey: ["/api/players/search", debouncedQ],
    queryFn: async () => {
      if (debouncedQ.length < 2) return [];
      const url = new URL(`/api/players/search?q=${encodeURIComponent(debouncedQ)}&playerId=${playerId}`, getApiUrl());
      const result = await apiFetch(url.toString());
      return Array.isArray(result) ? result : [];
    },
    enabled: debouncedQ.length >= 2,
    initialData: [],
  });

  const searchResults: PlayerResult[] = Array.isArray(searchResultsRaw) ? searchResultsRaw : [];

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQ(text), 500);
  }, []);

  const sendRequest = useMutation({
    mutationFn: async (targetId: string) => {
      const url = new URL(`/api/friends/${playerId}/request/${targetId}`, getApiUrl());
      return apiFetch(url.toString(), { method: "POST" });
    },
    onSuccess: (data) => {
      if (!data) {
        Alert.alert("", "حدث خطأ، حاول مرة أخرى");
        return;
      }
      if (data.error === "already_exists") {
        const msg = data.status === "accepted" ? "أنتم أصدقاء بالفعل ✓" : "طلب الصداقة تم إرساله مسبقاً";
        Alert.alert("", msg);
      } else if (data.success) {
        const msg = data.resent ? "تمت إعادة إرسال طلب الصداقة ✓" : "تم إرسال طلب الصداقة ✓";
        Alert.alert("", msg);
      }
      qc.invalidateQueries({ queryKey: ["/api/friends", playerId] });
    },
    onError: () => {
      Alert.alert("", "حدث خطأ، حاول مرة أخرى");
    },
  });

  const respondRequest = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: "accept" | "reject" }) => {
      const url = new URL(`/api/friends/request/${requestId}/${action}`, getApiUrl());
      return apiFetch(url.toString(), { method: "PUT" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/friends", playerId] }),
  });

  const removeFriend = useMutation({
    mutationFn: async (friendId: string) => {
      const url = new URL(`/api/friends/${playerId}/${friendId}`, getApiUrl());
      return apiFetch(url.toString(), { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/friends", playerId] }),
  });

  const sendGift = async (amount: number) => {
    if (!giftModal.targetId || giftSending) return;
    setGiftSending(true);
    try {
      const url = new URL("/api/friends/gift", getApiUrl());
      const result = await apiFetch(url.toString(), {
        method: "POST",
        body: JSON.stringify({ fromPlayerId: playerId, toPlayerId: giftModal.targetId, amount }),
      });
      if (result?.success) {
        addCoins(-amount);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("", `تم إرسال ${amount} عملة إلى ${giftModal.targetName} 🎁`);
      } else if (result?.error === "already_gifted_today") {
        Alert.alert("", "لقد أرسلت هدية لهذا اللاعب اليوم بالفعل");
      } else if (result?.error === "insufficient_coins") {
        Alert.alert("", "رصيدك غير كافٍ");
      } else {
        Alert.alert("", "حدث خطأ، حاول مرة أخرى");
      }
    } catch {
      Alert.alert("", "حدث خطأ، حاول مرة أخرى");
    }
    setGiftSending(false);
    setGiftModal({ visible: false, targetId: "", targetName: "" });
  };

  const getRelationship = (playerId2: string) => {
    return allFriendRows.find((r) => r.player.id === playerId2);
  };

  const renderPlayerCard = (player: PlayerResult, extra?: React.ReactNode) => {
    const skin = SKINS.find((s) => s.id === player.skin) || SKINS[0];
    const codeLabel = player.playerCode || (player.playerTag ? `#${player.playerTag.toString().padStart(4, "0")}` : "");
    return (
      <View key={player.id} style={[styles.playerCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={[styles.avatar, { backgroundColor: skin.color + "33" }]}>
          <Text style={styles.avatarEmoji}>{skin.emoji}</Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={[styles.playerName, { color: theme.textPrimary }]}>{player.name}</Text>
          <Text style={[styles.playerSub, { color: theme.textMuted }]}>
            {codeLabel ? `${codeLabel} · ` : ""}المستوى {player.level} · {player.wins} انتصار
          </Text>
        </View>
        {extra}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>الأصدقاء</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Player Code Banner */}
      <TouchableOpacity
        style={[styles.codeBanner, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => copyToClipboard(myDisplayCode)}
        activeOpacity={0.7}
      >
        <View style={styles.codeBannerLeft}>
          <Ionicons name="id-card" size={18} color={Colors.gold} />
          <Text style={[styles.codeBannerLabel, { color: theme.textMuted }]}>كودك:</Text>
          <Text style={styles.codeBannerValue}>{myDisplayCode}</Text>
        </View>
        <Ionicons name="copy-outline" size={18} color={theme.textMuted} />
      </TouchableOpacity>

      {copiedToast && (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.emerald} />
          <Text style={styles.toastText}>تم نسخ المعرف</Text>
        </View>
      )}

      {/* Play Section */}
      <View style={[styles.playSection, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={styles.playBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push({ pathname: "/lobby", params: { action: "create" } }); }}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={22} color={Colors.emerald} />
          <Text style={[styles.playBtnText, { color: Colors.emerald }]}>إنشاء غرفة</Text>
        </TouchableOpacity>
        <View style={[styles.playDivider, { backgroundColor: theme.cardBorder }]} />
        <TouchableOpacity
          style={styles.playBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: "/lobby", params: { action: "join" } }); }}
          activeOpacity={0.8}
        >
          <Ionicons name="enter" size={22} color={Colors.gold} />
          <Text style={[styles.playBtnText, { color: Colors.gold }]}>الانضمام لغرفة</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.tabs, { backgroundColor: theme.card }]}>
        {(["friends", "search", "requests", "gifts"] as TabType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={[styles.tabText, { color: theme.textMuted }, tab === t && styles.tabTextActive]}>
                {t === "friends" ? `الأصدقاء (${acceptedFriends.length})` : t === "search" ? "بحث" : t === "requests" ? `الطلبات (${pendingReceived.length})` : "🎁"}
              </Text>
              {t === "gifts" && pendingGiftsCount > 0 && (
                <View style={styles.giftBadge}>
                  <Text style={styles.giftBadgeText}>{pendingGiftsCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "friends" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {loadingFriends ? (
            <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />
          ) : acceptedFriends.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>ليس لديك أصدقاء بعد</Text>
              <Text style={[styles.emptySubText, { color: theme.textMuted }]}>ابحث عن لاعبين وأضفهم كأصدقاء</Text>
            </View>
          ) : (
            acceptedFriends.map((row) =>
              renderPlayerCard(
                row.player,
                <View style={styles.friendActions}>
                  <TouchableOpacity
                    style={styles.giftBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setGiftModal({ visible: true, targetId: row.player.id, targetName: row.player.name });
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>🎁</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.inviteBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({ pathname: "/lobby", params: { action: "create" } });
                    }}
                  >
                    <Ionicons name="game-controller" size={14} color={Colors.sapphire} />
                    <Text style={styles.inviteBtnText}>العب معه</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => Alert.alert("إزالة صديق", `هل تريد إزالة ${row.player.name}؟`, [
                      { text: "إلغاء", style: "cancel" },
                      { text: "إزالة", style: "destructive", onPress: () => removeFriend.mutate(row.player.id) },
                    ])}
                  >
                    <Ionicons name="person-remove" size={18} color={Colors.ruby} />
                  </TouchableOpacity>
                </View>
              )
            )
          )}
          {pendingSent.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>طلبات أرسلتها</Text>
              {pendingSent.map((row) =>
                renderPlayerCard(
                  row.player,
                  <View style={styles.sentBadge}>
                    <Text style={styles.sentBadgeText}>بانتظار القبول</Text>
                  </View>
                )
              )}
            </>
          )}
        </ScrollView>
      )}

      {tab === "search" && (
        <View style={{ flex: 1 }}>
          <View style={[styles.searchBox, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
            <Ionicons name="search" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.inputText }]}
              placeholder="ابحث بالاسم أو الكود (WM-XXXXXX)..."
              placeholderTextColor={theme.inputPlaceholder}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoFocus
            />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {loadingSearch ? (
              <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />
            ) : debouncedQ.length < 2 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>ابحث عن لاعب</Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>لا توجد نتائج</Text>
              </View>
            ) : (
              searchResults.map((player) => {
                const rel = getRelationship(player.id);
                let actionBtn: React.ReactNode;
                if (!rel) {
                  actionBtn = (
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => sendRequest.mutate(player.id)}
                      disabled={sendRequest.isPending}
                    >
                      <Ionicons name="person-add" size={18} color={Colors.emerald} />
                    </TouchableOpacity>
                  );
                } else if (rel.status === "accepted") {
                  actionBtn = (
                    <View style={styles.friendBadge}>
                      <Text style={styles.friendBadgeText}>صديق</Text>
                    </View>
                  );
                } else {
                  actionBtn = (
                    <View style={styles.sentBadge}>
                      <Text style={styles.sentBadgeText}>تم الإرسال</Text>
                    </View>
                  );
                }
                return renderPlayerCard(player, actionBtn);
              })
            )}
          </ScrollView>
        </View>
      )}

      {tab === "requests" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {loadingFriends ? (
            <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />
          ) : pendingReceived.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>لا توجد طلبات جديدة</Text>
            </View>
          ) : (
            pendingReceived.map((row) =>
              renderPlayerCard(
                row.player,
                <View style={styles.requestBtns}>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => respondRequest.mutate({ requestId: row.requestId, action: "accept" })}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => respondRequest.mutate({ requestId: row.requestId, action: "reject" })}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              )
            )
          )}
        </ScrollView>
      )}

      {tab === "gifts" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {loadingGifts ? (
            <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />
          ) : giftHistory.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎁</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>لا توجد هدايا بعد</Text>
              <Text style={[styles.emptySubText, { color: theme.textMuted }]}>أرسل هدية لأصدقائك من تبويب الأصدقاء</Text>
            </View>
          ) : (
            giftHistory.map((gift: any, idx: number) => (
              <View key={gift.id || idx} style={[styles.giftHistoryRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <View style={[styles.giftHistoryIcon, { backgroundColor: gift.type === "sent" ? Colors.ruby + "18" : Colors.emerald + "18" }]}>
                  <Ionicons name={gift.type === "sent" ? "arrow-up" : "arrow-down"} size={16} color={gift.type === "sent" ? Colors.ruby : Colors.emerald} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.giftHistoryName, { color: theme.textPrimary }]}>
                    {gift.type === "sent" ? `أرسلت إلى ${gift.playerName}` : `استلمت من ${gift.playerName}`}
                  </Text>
                  <Text style={[styles.giftHistoryDate, { color: theme.textMuted }]}>
                    {new Date(gift.sentAt).toLocaleDateString("ar-MA")}
                  </Text>
                </View>
                <View style={styles.giftHistoryAmount}>
                  <Ionicons name="star" size={12} color={Colors.gold} />
                  <Text style={styles.giftHistoryAmountText}>{gift.type === "sent" ? "-" : "+"}{gift.amount}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Gift Modal */}
      {giftModal.visible && (
        <View style={styles.giftOverlay}>
          <View style={[styles.giftCard, { backgroundColor: theme.card, borderColor: Colors.gold + "40" }]}>
            <Text style={styles.giftTitle}>🎁 أهدِ عملات</Text>
            <Text style={[styles.giftSubtitle, { color: theme.textSecondary }]}>إلى {giftModal.targetName}</Text>
            <View style={styles.giftAmountRow}>
              {[50, 100, 200].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[styles.giftAmountBtn, { borderColor: Colors.gold + "40" }]}
                  onPress={() => sendGift(amount)}
                  disabled={giftSending}
                  activeOpacity={0.7}
                >
                  <Ionicons name="star" size={14} color={Colors.gold} />
                  <Text style={styles.giftAmountText}>{amount}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.giftCancelBtn, { backgroundColor: theme.cardBorder + "40" }]}
              onPress={() => setGiftModal({ visible: false, targetId: "", targetName: "" })}
            >
              <Text style={[styles.giftCancelText, { color: theme.textMuted }]}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, justifyContent: "space-between",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#12122A", justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#E8E8FF" },
  tabs: {
    flexDirection: "row", backgroundColor: "#12122A",
    borderRadius: 12, padding: 4, marginHorizontal: 16, marginBottom: 12,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: "#14142E" },
  tabText: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: "#5A5A88" },
  tabTextActive: { color: Colors.gold },
  list: { padding: 16, gap: 10 },
  playerCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#12122A", borderRadius: 14,
    padding: 12, borderWidth: 1, borderColor: "#1E1E3A",
  },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  avatarEmoji: { fontSize: 22 },
  playerInfo: { flex: 1, marginLeft: 10 },
  playerName: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#E8E8FF" },
  playerSub: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#5A5A88", marginTop: 2 },
  addBtn: { padding: 8, borderRadius: 10, backgroundColor: Colors.emerald + "20" },
  removeBtn: { padding: 8, borderRadius: 10, backgroundColor: Colors.ruby + "20" },
  requestBtns: { flexDirection: "row", gap: 8 },
  acceptBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.emerald, justifyContent: "center", alignItems: "center" },
  rejectBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.ruby, justifyContent: "center", alignItems: "center" },
  friendBadge: { backgroundColor: Colors.emerald + "20", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  friendBadgeText: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: Colors.emerald },
  sentBadge: { backgroundColor: "#5A5A88" + "20", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  sentBadgeText: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#5A5A88" },
  codeBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#12122A", borderRadius: 14, marginHorizontal: 16, marginBottom: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.gold + "30",
  },
  codeBannerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  codeBannerLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#9898CC" },
  codeBannerValue: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.gold },
  toast: {
    position: "absolute", top: 120, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#14142E", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.emerald + "40",
    zIndex: 100,
  },
  toastText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.emerald },
  friendActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  inviteBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: Colors.sapphire + "20" },
  inviteBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: Colors.sapphire },
  sectionLabel: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#9898CC", marginTop: 8, marginBottom: 4 },
  playSection: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#12122A", borderRadius: 16,
    marginHorizontal: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#1E1E3A", overflow: "hidden",
  },
  playBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, gap: 8,
  },
  playBtnText: { fontFamily: "Cairo_700Bold", fontSize: 14 },
  playDivider: { width: 1, height: 40, backgroundColor: "#1E1E3A" },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#12122A", borderRadius: 12,
    marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: "#1E1E3A",
  },
  searchInput: { flex: 1, fontFamily: "Cairo_400Regular", fontSize: 14, color: "#E8E8FF" },
  empty: { alignItems: "center", paddingTop: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "#9898CC" },
  emptySubText: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#5A5A88", textAlign: "center" },
  giftBtn: {
    padding: 8, borderRadius: 10, backgroundColor: Colors.gold + "18",
    borderWidth: 1, borderColor: Colors.gold + "30",
  },
  giftOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center", alignItems: "center",
    paddingHorizontal: 24, zIndex: 100,
  },
  giftCard: {
    width: "100%", maxWidth: 340, borderRadius: 20,
    padding: 24, alignItems: "center",
    borderWidth: 1.5, backgroundColor: "#12122A",
  },
  giftTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, color: Colors.gold, marginBottom: 4 },
  giftSubtitle: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#9898CC", marginBottom: 16 },
  giftAmountRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  giftAmountBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1.5,
    backgroundColor: Colors.gold + "12",
  },
  giftAmountText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.gold },
  giftCancelBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  giftCancelText: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
  giftBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.ruby, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 4,
  },
  giftBadgeText: { fontFamily: "Cairo_700Bold", fontSize: 10, color: "#fff" },
  giftHistoryRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 14, borderWidth: 1,
    backgroundColor: "#12122A", borderColor: "#1E1E3A",
  },
  giftHistoryIcon: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
  },
  giftHistoryName: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#E8E8FF" },
  giftHistoryDate: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#5A5A88", marginTop: 2 },
  giftHistoryAmount: { flexDirection: "row", alignItems: "center", gap: 4 },
  giftHistoryAmountText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.gold },
});

export default function FriendsScreen() {
  return (
    <ScreenErrorBoundary screenName="الأصدقاء">
      <FriendsScreenInner />
    </ScreenErrorBoundary>
  );
}
