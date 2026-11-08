import {ScaledText as Text} from "@/components/ScaledText";
import { displayError } from "@/lib/display-error";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GameIcon, GameIllustration } from "@/components/GameIcon";
import { GameCard, GameHeader, GameScreenBackground } from "@/components/GameUi";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { connectOnlineSocket } from "@/services/socket";
import {
  socialApi,
  type SocialInvite,
  type SocialConversation,
  type SocialPlayer,
  type SocialRequest,
} from "@/services/social";
import type { SocialServerToClientEvents } from "@shared/social-events";
import { gameDesign } from "@/constants/game-design";

const CYAN = gameDesign.colors.friends;
const GREEN = gameDesign.colors.success;
const RED = gameDesign.colors.danger;
const GOLD = gameDesign.colors.coins;

type Privacy = {
  allowFriendRequests: boolean;
  allowGameInvites: boolean;
  showPresence: boolean;
};
type SocialNotification = {
  id: string;
  type: string;
  actorId: string | null;
  actorName: string | null;
  entityId: string | null;
  payload: Record<string, string>;
  readAt: string | null;
  createdAt: string;
};

function playerName(player?: SocialPlayer): string {
  return player?.displayName || "Player";
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const { isRTL } = useLanguage();
  const { profile } = usePlayer();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ roomCode?: string; section?: "inbox" | "notifications" }>();
  const roomCode = typeof params.roomCode === "string" ? params.roomCode.toUpperCase() : "";
  const labels = useMemo(() => isRTL ? {
    title: "الأصدقاء",
    search: "ابحث بالاسم أو معرّف اللاعب",
    friends: "الأصدقاء",
    incoming: "طلبات واردة",
    outgoing: "طلبات مرسلة",
    inbox: "دعوات الغرف",
    notifications: "الإشعارات",
    chats: "المحادثات",
    privacy: "الخصوصية",
    noFriends: "لا توجد صداقات بعد. ابحث عن لاعب لإرسال طلب.",
    noChats: "لا توجد محادثات بعد.",
    noResults: "لا توجد نتائج.",
    noRequests: "لا توجد طلبات معلّقة.",
    send: "إضافة",
    accept: "قبول",
    decline: "رفض",
    cancel: "إلغاء",
    chat: "محادثة",
    invite: "دعوة للغرفة",
    createRoom: "أنشئ غرفة خاصة أولاً، ثم ارجع لدعوة أصدقائك.",
    remove: "إزالة",
    block: "حظر",
    unblock: "إلغاء الحظر",
    blocked: "المحظورون",
    requestsPrivacy: "السماح بطلبات الصداقة",
    invitesPrivacy: "السماح بدعوات اللعب",
    presencePrivacy: "إظهار حالة الاتصال للأصدقاء",
    allow: "قبول الدعوة",
    declineInvite: "رفض الدعوة",
    emptyInvites: "لا توجد دعوات جديدة.",
    online: "متصل",
    offline: "غير متصل",
    inGame: "داخل مباراة",
    hidden: "مخفي",
    playerId: "معرّف اللاعب",
    yourId: "معرّفك الفريد",
    copied: "تم نسخ المعرّف",
    notification: "إشعار",
    notificationEmpty: "لا توجد إشعارات جديدة.",
    roomAccepted: "تم قبول الدعوة. يجري فتح الغرفة.",
    loadMore: "عرض المزيد",
    loading: "جار التحميل…",
    back: "رجوع",
    error: "تعذر إكمال العملية",
    inviteSent: "تم إرسال الدعوة",
    update: "حفظ",
  } : {
    title: "Friends",
    search: "Search by name or Player ID",
    friends: "Friends",
    incoming: "Incoming requests",
    outgoing: "Sent requests",
    inbox: "Room invites",
    notifications: "Notifications",
    chats: "Chats",
    privacy: "Privacy",
    noFriends: "No friends yet. Search for a player to send a request.",
    noChats: "No conversations yet.",
    noResults: "No players found.",
    noRequests: "No pending requests.",
    send: "Add",
    accept: "Accept",
    decline: "Decline",
    cancel: "Cancel",
    chat: "Chat",
    invite: "Invite to room",
    createRoom: "Create a private room first, then return to invite friends.",
    remove: "Remove",
    block: "Block",
    unblock: "Unblock",
    blocked: "Blocked players",
    requestsPrivacy: "Allow friend requests",
    invitesPrivacy: "Allow game invitations",
    presencePrivacy: "Show my status to friends",
    allow: "Accept invite",
    declineInvite: "Decline invite",
    emptyInvites: "No new invitations.",
    online: "Online",
    offline: "Offline",
    inGame: "In game",
    hidden: "Hidden",
    playerId: "Player ID",
    yourId: "Your unique Player ID",
    copied: "Player ID copied",
    notification: "Notification",
    notificationEmpty: "No new notifications.",
    roomAccepted: "Invite accepted. Opening the room.",
    loadMore: "Load more",
    loading: "Loading…",
    back: "Back",
    error: "Could not complete the action",
    inviteSent: "Invitation sent",
    update: "Save",
  }, [isRTL]);

  const [friends, setFriends] = useState<(SocialPlayer & { since: string })[]>([]);
  const [friendsOffset, setFriendsOffset] = useState<number | null>(null);
  const [incoming, setIncoming] = useState<SocialRequest[]>([]);
  const [outgoing, setOutgoing] = useState<SocialRequest[]>([]);
  const [incomingOffset, setIncomingOffset] = useState<number | null>(null);
  const [outgoingOffset, setOutgoingOffset] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SocialPlayer[]>([]);
  const [invitations, setInvitations] = useState<SocialInvite[]>([]);
  const [blocks, setBlocks] = useState<(SocialPlayer & { createdAt: string })[]>([]);
  const [privacy, setPrivacy] = useState<Privacy>({
    allowFriendRequests: true,
    allowGameInvites: true,
    showPresence: true,
  });
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [conversations, setConversations] = useState<SocialConversation[]>([]);
  const [activeSection, setActiveSection] = useState<"friends" | "chats" | "requests" | "inbox" | "notifications" | "privacy">(
    params.section === "inbox" || params.section === "notifications" ? params.section : "friends",
  );
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [myPlayerId, setMyPlayerId] = useState("");
  const [socket, setSocket] = useState<Awaited<ReturnType<typeof connectOnlineSocket>> | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [friendPage, received, sent, inviteResult, blockResult, savedPrivacy, notificationResult, conversationResult] = await Promise.all([
        socialApi.friends(),
        socialApi.requests("incoming"),
        socialApi.requests("outgoing"),
        socialApi.invitations(),
        socialApi.blocks(),
        socialApi.privacy(),
        socialApi.notifications(),
        socialApi.conversations(),
      ]);
      setFriends(friendPage.friends);
      setFriendsOffset(friendPage.nextOffset);
      setIncoming(received.requests);
      setOutgoing(sent.requests);
      setIncomingOffset(received.nextOffset);
      setOutgoingOffset(sent.nextOffset);
      setInvitations(inviteResult.invitations);
      setBlocks(blockResult.blocks);
      setPrivacy(savedPrivacy);
      setNotifications(notificationResult.notifications);
      setUnreadNotifications(notificationResult.notifications.filter((item) => !item.readAt).length);
      setConversations(conversationResult.conversations);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : labels.error);
    } finally {
      setLoading(false);
    }
  }, [labels.error]);

  useEffect(() => {
    let active = true;
    void connectOnlineSocket(profile.name).then(async (connectedSocket) => {
      if (!active) return;
      setSocket(connectedSocket);
      connectedSocket.connect();
      try {
        const player = await socialApi.updateProfile(profile.name);
        setMyPlayerId(player.playerId);
      } catch (profileError) {
        console.error("[social] Could not sync display name:", profileError);
        setError(profileError instanceof Error ? profileError.message : labels.error);
      }
    }).catch((connectError: unknown) => {
      if (active) setError(connectError instanceof Error ? connectError.message : labels.error);
    });
    return () => {
      active = false;
    };
  }, [labels.error, profile.name]);

  useFocusEffect(useCallback(() => {
    void loadData();
  }, [loadData]));

  useEffect(() => {
    const timer = setTimeout(() => {
      const value = search.trim();
      if (value.length < 2) {
        setSearchResults([]);
        return;
      }
      void socialApi.search(value)
        .then((result) => setSearchResults(result.players))
        .catch((searchError: unknown) => {
          setError(searchError instanceof Error ? searchError.message : labels.error);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [labels.error, search]);

  useEffect(() => {
    if (!socket) return;
    const updateConnection = () => setSocketConnected(socket.connected);
    socket.on("connect", updateConnection);
    socket.on("disconnect", updateConnection);
    updateConnection();
    const onInvite: SocialServerToClientEvents["social:game_invite"] = (invite) => {
      setInvitations((current) => [invite, ...current.filter((item) => item.id !== invite.id)]);
      setActiveSection("inbox");
    };
    const onPresence: SocialServerToClientEvents["social:presence"] = ({ playerId, status }) => {
      setFriends((current) => current.map((friend) =>
        friend.playerId === playerId ? { ...friend, presence: status } : friend,
      ));
      setSearchResults((current) => current.map((friend) =>
        friend.playerId === playerId ? { ...friend, presence: status } : friend,
      ));
    };
    const onNotification: SocialServerToClientEvents["social:notification"] = () => {
      setUnreadNotifications((count) => count + 1);
      void loadData();
    };
    const onNotificationRead: SocialServerToClientEvents["social:notification_read"] = () => {
      void loadData();
    };
    socket.on("social:game_invite", onInvite);
    socket.on("social:presence", onPresence);
    socket.on("social:notification", onNotification);
    socket.on("social:notification_read", onNotificationRead);
    return () => {
      socket.off("connect", updateConnection);
      socket.off("disconnect", updateConnection);
      socket.off("social:game_invite", onInvite);
      socket.off("social:presence", onPresence);
      socket.off("social:notification", onNotification);
      socket.off("social:notification_read", onNotificationRead);
    };
  }, [loadData, socket]);

  const perform = async (id: string, action: () => Promise<unknown>, after?: () => void) => {
    setBusyId(id);
    setError("");
    try {
      await action();
      after?.();
      await loadData();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : labels.error;
      setError(message);
      Alert.alert(labels.error, displayError(message,isRTL));
    } finally {
      setBusyId("");
    }
  };

  const loadMoreFriends = async () => {
    if (friendsOffset === null) return;
    try {
      const page = await socialApi.friends(friendsOffset);
      setFriends((current) => [...current, ...page.friends]);
      setFriendsOffset(page.nextOffset);
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : labels.error);
    }
  };

  const loadMoreRequests = async (direction: "incoming" | "outgoing") => {
    const offset = direction === "incoming" ? incomingOffset : outgoingOffset;
    if (offset === null) return;
    try {
      const page = await socialApi.requests(direction, offset);
      if (direction === "incoming") {
        setIncoming((current) => [...current, ...page.requests]);
        setIncomingOffset(page.nextOffset);
      } else {
        setOutgoing((current) => [...current, ...page.requests]);
        setOutgoingOffset(page.nextOffset);
      }
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : labels.error);
    }
  };

  const openChat = async (playerId: string) => {
    try {
      const result = await socialApi.conversation(playerId);
      const friend = friends.find((item) => item.playerId === playerId);
      router.push({
        pathname: "/chat/[conversationId]",
        params: {
          conversationId: result.conversationId,
          playerId,
          displayName: friend?.displayName ?? "",
        },
      });
    } catch (chatError) {
      const message = chatError instanceof Error ? chatError.message : labels.error;
      setError(message);
      Alert.alert(labels.error, displayError(message,isRTL));
    }
  };

  const openConversation = (conversation: SocialConversation) => {
    router.push({
      pathname: "/chat/[conversationId]",
      params: {
        conversationId: conversation.conversationId,
        playerId: conversation.playerId,
        displayName: conversation.displayName,
      },
    });
  };

  const sendInvite = (friend: SocialPlayer) => {
    if (!roomCode) {
      Alert.alert(labels.invite, labels.createRoom);
      return;
    }
    const activeSocket = socket;
    if (!socketConnected || !activeSocket) {
      Alert.alert(labels.error, displayError("online_unavailable",isRTL));
      return;
    }
    setBusyId(friend.playerId);
    activeSocket.emit("social:game_invite", {
      playerId: friend.playerId,
      roomCode,
    }, (result: unknown) => {
      setBusyId("");
      if (typeof result === "object" && result !== null && "ok" in result && result.ok === true) {
        Alert.alert(labels.inviteSent);
      } else {
        const code = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : labels.error;
        Alert.alert(labels.error, displayError(code,isRTL));
      }
    });
  };

  const respondInvite = (invite: SocialInvite, accept: boolean) => {
    const activeSocket = socket;
    if (!socketConnected || !activeSocket) {
      Alert.alert(labels.error, displayError("online_unavailable",isRTL));
      return;
    }
    setBusyId(invite.id);
    activeSocket.emit("social:game_invite:respond", { inviteId: invite.id, accept }, (result: unknown) => {
      setBusyId("");
      if (typeof result !== "object" || result === null || !("ok" in result) || result.ok !== true) {
        const code = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : labels.error;
        Alert.alert(labels.error, displayError(code,isRTL));
        return;
      }
      setInvitations((current) => current.filter((item) => item.id !== invite.id));
      if (accept) {
        const room = "roomCode" in result && typeof result.roomCode === "string" ? result.roomCode : invite.roomCode;
        Alert.alert(labels.roomAccepted);
        router.push({ pathname: "/private-room", params: { roomCode: room } });
      } else {
        void loadData();
      }
    });
  };

  const savePrivacy = (next: Privacy) => {
    setPrivacy(next);
    void perform("privacy", () => socialApi.updatePrivacy(next));
  };

  const openNotification = async (item: SocialNotification) => {
    try {
      if (!item.readAt) await socialApi.markNotificationRead(item.id);
      setNotifications((current) => current.map((notification) =>
        notification.id === item.id ? { ...notification, readAt: new Date().toISOString() } : notification,
      ));
      setUnreadNotifications((count) => Math.max(0, count - (item.readAt ? 0 : 1)));
      if (item.type === "friend_request") setActiveSection("requests");
      else if (item.type === "game_invite") setActiveSection("inbox");
      else if (item.type === "friend_accepted") setActiveSection("friends");
      else if (item.type === "message" && item.payload.conversationId) {
        router.push({
          pathname: "/chat/[conversationId]",
          params: {
            conversationId: item.payload.conversationId,
            playerId: item.actorId ?? "",
          },
        });
      }
    } catch (notificationError) {
      setError(notificationError instanceof Error ? notificationError.message : labels.error);
    }
  };

  const notificationText = (type: string) => {
    if (type === "friend_request") return isRTL ? "أرسل لك طلب صداقة" : "sent you a friend request";
    if (type === "friend_accepted") return isRTL ? "قبل طلب الصداقة" : "accepted your friend request";
    if (type === "message") return isRTL ? "أرسل لك رسالة جديدة" : "sent you a message";
    if (type === "game_invite") return isRTL ? "دعاك إلى غرفة لعب" : "invited you to a game room";
    if (type === "invite_response") return isRTL ? "ردّ على دعوة الغرفة" : "responded to your room invite";
    return labels.notification;
  };

  const statusLabel = (presence?: SocialPlayer["presence"]) => {
    if (presence === "online") return labels.online;
    if (presence === "in_game") return labels.inGame;
    if (presence === "hidden") return labels.hidden;
    return labels.offline;
  };

  const button = (
    title: string,
    action: () => void,
    color: string = CYAN,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={action}
      style={({ pressed }) => [styles.actionButton, { borderColor: `${color}66`, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.actionText, { color }]}>{title}</Text>
    </Pressable>
  );

  const personCard = (person: SocialPlayer, actions: React.ReactNode, subline?: string) => (
    <GameCard key={person.playerId} style={[styles.personCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <View style={[styles.avatar, { backgroundColor: `${CYAN}20` }]}>
        <GameIcon name="profile" size={22} color={CYAN} />
      </View>
      <View style={styles.personDetails}>
        <Text style={[styles.personName, { color: theme.textPrimary }]} numberOfLines={1}>{playerName(person)}</Text>
        <Text style={[styles.subline, { color: theme.textSecondary }]} numberOfLines={1}>
          {subline ?? `${statusLabel(person.presence)} · ${labels.playerId}: ${person.playerId.slice(0, 8).toUpperCase()}`}
        </Text>
      </View>
      <View style={styles.actions}>{actions}</View>
    </GameCard>
  );

  const sectionButton = (
    key: typeof activeSection,
    title: string,
    badge?: number,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="tab"
      accessibilityState={{selected:activeSection===key}}
      onPress={() => setActiveSection(key)}
      style={[styles.tabButton, { backgroundColor: theme.card, borderColor: activeSection === key ? CYAN : theme.cardBorder }]}
    >
      <Text style={{ color: activeSection === key ? CYAN : theme.textSecondary, fontWeight: "700" }}>
        {title}{badge ? ` (${badge})` : ""}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 12) }]}>
      <GameScreenBackground accent="online" />

      <GameHeader
        title={activeSection==="notifications"?labels.notifications:labels.title}
        subtitle={activeSection==="notifications"?"دعواتك وآخر أخبار أصدقائك":"تواصل والعب مع أصدقائك"}
        onBack={() => router.back()}
        icon={activeSection==="notifications"?<Ionicons name="notifications-outline" size={24} color={GOLD}/>:<GameIcon name="friends" size={24} color={CYAN} />}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {myPlayerId && activeSection!=="notifications" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void Clipboard.setStringAsync(myPlayerId).then(() => Alert.alert(labels.copied))}
            style={[styles.playerCode, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          >
            <View style={styles.personDetails}>
              <Text style={[styles.subline, { color: theme.textSecondary }]}>{labels.yourId}</Text>
              <Text selectable style={[styles.playerCodeText, { color: theme.textPrimary }]}>{myPlayerId}</Text>
            </View>
            <Ionicons name="copy-outline" size={18} color={CYAN} />
          </Pressable>
        ) : null}

        {activeSection!=="notifications" && <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Ionicons name="search" size={19} color={theme.textMuted} />
          <TextInput
            accessibilityLabel={labels.search}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder={labels.search}
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.textPrimary, textAlign: isRTL ? "right" : "left" }]}
            value={search}
          />
        </View>}

        {activeSection!=="notifications" && search.trim().length >= 2 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{labels.search}</Text>
            {searchResults.length === 0
              ? <Text style={[styles.empty, { color: theme.textSecondary }]}>{labels.noResults}</Text>
              : searchResults.map((person) => personCard(person, button(labels.send, () =>
                void perform(person.playerId, () => socialApi.sendRequest(person.playerId), () => setSearch("")),
                GREEN, busyId === person.playerId)))}
          </View>
        )}

        {!!error && activeSection!=="notifications" && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={RED} />
            <Text style={styles.errorText}>{displayError(error,isRTL)}</Text>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {sectionButton("notifications", labels.notifications, unreadNotifications)}
          {sectionButton("friends", labels.friends)}
          {sectionButton("chats", labels.chats, conversations.reduce((sum, item) => sum + item.unreadCount, 0))}
          {sectionButton("requests", `${labels.incoming}/${labels.outgoing}`, incoming.length)}
          {sectionButton("inbox", labels.inbox, invitations.length + unreadNotifications)}
          {sectionButton("privacy", labels.privacy)}
        </ScrollView>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={CYAN} />
            <Text style={{ color: theme.textSecondary }}>{labels.loading}</Text>
          </View>
        ) : null}

        {!loading && activeSection === "friends" && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{labels.friends}</Text>
            {friends.length === 0
              ? (
                <View style={styles.emptyState}>
                  <GameIllustration name="social" size={108} />
                  <Text style={[styles.empty, { color: theme.textSecondary }]}>{labels.noFriends}</Text>
                </View>
              )
              : friends.map((friend) => personCard(friend, (
                <>
                  {button(labels.chat, () => void openChat(friend.playerId), CYAN)}
                  {button(labels.invite, () => sendInvite(friend), GOLD, busyId === friend.playerId)}
                  {button(labels.remove, () => void perform(friend.playerId, () => socialApi.removeFriend(friend.playerId)), RED)}
                  {button(labels.block, () => void perform(friend.playerId, () => socialApi.block(friend.playerId)), RED)}
                </>
              )))}
            {friendsOffset !== null && button(labels.loadMore, () => void loadMoreFriends())}
          </View>
        )}

        {!loading && activeSection === "chats" && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{labels.chats}</Text>
            {conversations.length === 0
              ? <Text style={[styles.empty, { color: theme.textSecondary }]}>{labels.noChats}</Text>
              : conversations.map((conversation) => personCard({
                playerId: conversation.playerId,
                displayName: conversation.displayName,
              }, button(
                conversation.unreadCount ? `${labels.chat} (${conversation.unreadCount})` : labels.chat,
                () => openConversation(conversation),
                conversation.unreadCount ? GREEN : CYAN,
              ), conversation.lastMessage || labels.noChats))}
          </View>
        )}

        {!loading && activeSection === "requests" && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{labels.incoming}</Text>
            {incoming.length === 0
              ? <Text style={[styles.empty, { color: theme.textSecondary }]}>{labels.noRequests}</Text>
              : incoming.map((request: SocialRequest) => personCard(request.player ?? { playerId: "", displayName: "Player" }, (
                <>
                  {button(labels.accept, () => void perform(request.id, () => socialApi.respondRequest(request.id, true)), GREEN)}
                  {button(labels.decline, () => void perform(request.id, () => socialApi.respondRequest(request.id, false)), RED)}
                </>
              ), request.createdAt))}
            {incomingOffset !== null && button(labels.loadMore, () => void loadMoreRequests("incoming"))}

            <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 18 }]}>{labels.outgoing}</Text>
            {outgoing.length === 0
              ? <Text style={[styles.empty, { color: theme.textSecondary }]}>{labels.noRequests}</Text>
              : outgoing.map((request: SocialRequest) => personCard(request.player ?? { playerId: "", displayName: "Player" }, (
                button(labels.cancel, () => void perform(request.id, () => socialApi.cancelRequest(request.id)), RED)
              ), request.createdAt))}
            {outgoingOffset !== null && button(labels.loadMore, () => void loadMoreRequests("outgoing"))}
          </View>
        )}

        {!loading && activeSection === "inbox" && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{labels.inbox}</Text>
            {invitations.length === 0
              ? (
                <View style={styles.emptyState}>
                  <GameIllustration name="invitation" size={92} />
                  <Text style={[styles.empty, { color: theme.textSecondary }]}>{labels.emptyInvites}</Text>
                </View>
              )
              : invitations.map((invite) => personCard({
                playerId: invite.senderId,
                displayName: invite.displayName,
              }, (
                <>
                  {button(labels.allow, () => respondInvite(invite, true), GREEN, busyId === invite.id)}
                  {button(labels.declineInvite, () => respondInvite(invite, false), RED, busyId === invite.id)}
                </>
              ), `${labels.invite}: ${invite.roomCode}`))}
          </View>
        )}

        {!loading && activeSection === "notifications" && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{labels.notifications}</Text>
            {notifications.length === 0
              ? <View style={[styles.notificationEmpty,{backgroundColor:theme.card,borderColor:theme.cardBorder}]}><View style={styles.bellCircle}><Ionicons name="notifications-outline" size={36} color={GOLD}/></View><Text style={[styles.notificationTitle,{color:theme.textPrimary}]}>{error?"تعذر تحميل الإشعارات":"أنت مطّلع على كل جديد"}</Text><Text style={[styles.notificationHint,{color:theme.textSecondary}]}>{error?"تحقق من اتصالك، ثم أعد المحاولة.":labels.notificationEmpty}</Text><Text style={[styles.notificationHint,{color:theme.textSecondary}]}>ستظهر هنا دعوات اللعب وطلبات الصداقة.</Text>{error?<Pressable accessibilityRole="button" onPress={()=>void loadData()} style={[styles.actionButton,{minHeight:44,justifyContent:"center",borderColor:GOLD}]}><Text style={{color:GOLD}}>إعادة المحاولة</Text></Pressable>:null}</View>
              : notifications.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => void openNotification(item)}
                  style={[styles.notificationCard, { backgroundColor: theme.card, borderColor: item.readAt ? theme.cardBorder : `${CYAN}66` }]}
                >
                  <Ionicons name={item.readAt ? "notifications-outline" : "notifications"} size={19} color={item.readAt ? theme.textMuted : CYAN} />
                  <View style={styles.personDetails}>
                    <Text style={[styles.personName, { color: theme.textPrimary }]}>
                      {item.actorName ? `${item.actorName} ` : ""}{notificationText(item.type)}
                    </Text>
                    <Text style={[styles.subline, { color: theme.textSecondary }]}>
                      {new Date(item.createdAt).toLocaleString(isRTL?"ar":"en")}
                    </Text>
                  </View>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={16} color={theme.textMuted} />
                </Pressable>
              ))}
          </View>
        )}

        {!loading && activeSection === "privacy" && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{labels.privacy}</Text>
            {([
              ["allowFriendRequests", labels.requestsPrivacy],
              ["allowGameInvites", labels.invitesPrivacy],
              ["showPresence", labels.presencePrivacy],
            ] as const).map(([key, title]) => (
              <View key={key} style={[styles.privacyRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <Text style={[styles.privacyLabel, { color: theme.textPrimary }]}>{title}</Text>
                <Switch
                  value={privacy[key]}
                  onValueChange={(value) => savePrivacy({ ...privacy, [key]: value })}
                  trackColor={{ true: `${CYAN}88`, false: theme.cardBorder }}
                  thumbColor={privacy[key] ? CYAN : theme.textMuted}
                />
              </View>
            ))}
            <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 18 }]}>{labels.blocked}</Text>
            {blocks.length === 0
              ? <Text style={[styles.empty, { color: theme.textSecondary }]}>{labels.noResults}</Text>
              : blocks.map((person) => personCard(person, button(labels.unblock, () =>
                void perform(person.playerId, () => socialApi.unblock(person.playerId)), GREEN)))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 10 },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 22, fontWeight: "900" },
  headerIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${CYAN}18` },
  content: { width: "100%", maxWidth: 592, alignSelf: "center", padding: 18, paddingBottom: 36, gap: 14 },
  searchBox: { minHeight: 52, borderWidth: 1, borderRadius: 17, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  playerCode: { minHeight: 60, borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 },
  playerCodeText: { fontSize: 11, fontWeight: "700" },
  searchInput: { flex: 1, fontSize: 15 },
  tabs: { gap: 8, paddingVertical: 3 },
  tabButton: { minHeight:44, justifyContent:"center", paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderRadius: 999, backgroundColor: "#2D1B3A" },
  section: { gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 12 },
  empty: { paddingVertical: 14, lineHeight: 22 },
  loading: { paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 },
  personCard: { minHeight: 68, borderWidth: 1, borderRadius: 17, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  personDetails: { flex: 1, minWidth: 90 },
  personName: { fontSize: 14, fontWeight: "800" },
  subline: { fontSize: 11, marginTop: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 5, maxWidth: "55%" },
  actionButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 7 },
  actionText: { fontSize: 11, fontWeight: "800" },
  errorBanner: { backgroundColor: "#5A2938", borderRadius: 13, padding: 11, flexDirection: "row", gap: 8, alignItems: "center" },
  errorText: { color: "#FFC0CB", flex: 1, fontSize: 12 },
  privacyRow: { minHeight: 58, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  notificationEmpty:{alignItems:"center",padding:28,gap:10,borderRadius:22,borderWidth:1},bellCircle:{width:76,height:76,borderRadius:38,backgroundColor:"#CBA47018",alignItems:"center",justifyContent:"center"},notificationTitle:{fontFamily:"Cairo_700Bold",fontSize:19,textAlign:"center"},notificationHint:{fontFamily:"Cairo_400Regular",fontSize:12,lineHeight:22,textAlign:"center"},
  notificationCard: { minHeight: 64, borderWidth: 1, borderRadius: 15, padding: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  privacyLabel: { flex: 1, fontSize: 14, fontWeight: "700" },
});
