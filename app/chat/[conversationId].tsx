import { displayError } from "@/lib/display-error";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GameIcon } from "@/components/GameIcon";
import { gameDesign } from "@/constants/game-design";
import { GameHeader, GameScreenBackground } from "@/components/GameUi";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Socket } from "socket.io-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { connectOnlineSocket } from "@/services/socket";
import { socialApi, type SocialMessage } from "@/services/social";
import type { SocialServerToClientEvents } from "@shared/social-events";

const CYAN = gameDesign.colors.chat;
const GREEN = gameDesign.colors.success;
const RED = gameDesign.colors.danger;

function isSocialMessage(value: unknown): value is SocialMessage {
  return typeof value === "object" && value !== null
    && "id" in value && typeof value.id === "string"
    && "conversationId" in value && typeof value.conversationId === "string"
    && "senderId" in value && typeof value.senderId === "string"
    && "content" in value && typeof value.content === "string"
    && "createdAt" in value && typeof value.createdAt === "string";
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { isRTL } = useLanguage();
  const { profile } = usePlayer();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ conversationId: string; playerId?: string; displayName?: string }>();
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : "";
  const friendId = typeof params.playerId === "string" ? params.playerId : "";
  const friendName = typeof params.displayName === "string" && params.displayName
    ? params.displayName
    : isRTL ? "لاعب" : "Player";
  const text = isRTL ? {
    title: "محادثة خاصة",
    placeholder: "اكتب رسالة…",
    send: "إرسال",
    loading: "جار تحميل المحادثة…",
    empty: "ابدأ المحادثة برسالة لطيفة.",
    typing: "يكتب الآن…",
    read: "تمت القراءة",
    error: "تعذر إرسال الرسالة",
    loadOlder: "رسائل أقدم",
    back: "رجوع",
    connection: "جار الاتصال…",
  } : {
    title: "Private chat",
    placeholder: "Write a message…",
    send: "Send",
    loading: "Loading conversation…",
    empty: "Start the conversation with a friendly message.",
    typing: "Typing…",
    read: "Read",
    error: "Could not send message",
    loadOlder: "Older messages",
    back: "Back",
    connection: "Connecting…",
  };
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [selfId, setSelfId] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      socialApi.profile(),
      socialApi.messages(conversationId),
      connectOnlineSocket(profile.name),
    ]).then(([player, page, connectedSocket]) => {
      if (!active) return;
      setSelfId(player.playerId);
      setMessages(page.messages);
      setNextCursor(page.nextCursor);
      setSocket(connectedSocket);
      connectedSocket.connect();
      connectedSocket.emit("social:read", { conversationId });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : text.error);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (incomingTypingTimerRef.current) clearTimeout(incomingTypingTimerRef.current);
    };
  }, [conversationId, profile.name, text.error]);

  useEffect(() => {
    if (!socket) return;
    const updateConnection = () => setSocketConnected(socket.connected);
    socket.on("connect", updateConnection);
    socket.on("disconnect", updateConnection);
    updateConnection();
    const onMessage: SocialServerToClientEvents["social:new_message"] = (payload) => {
      if (payload.conversationId !== conversationId) return;
      setMessages((current) => current.some((message) => message.id === payload.id)
        ? current
        : [...current, payload]);
      if (payload.senderId !== selfId) socket.emit("social:read", { conversationId });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 40);
    };
    const onTyping: SocialServerToClientEvents["social:typing"] = (payload) => {
      if (payload.playerId !== friendId) return;
      setTyping(payload.active);
      if (incomingTypingTimerRef.current) clearTimeout(incomingTypingTimerRef.current);
      if (payload.active) {
        incomingTypingTimerRef.current = setTimeout(() => setTyping(false), 2500);
      }
    };
    const onReceipt: SocialServerToClientEvents["social:read_receipt"] = (payload) => {
      if (payload.conversationId !== conversationId || payload.readerId !== friendId) return;
      setMessages((current) => current.map((message) =>
        message.senderId === selfId ? { ...message, readAt: payload.readAt } : message,
      ));
    };
    socket.on("social:new_message", onMessage);
    socket.on("social:typing", onTyping);
    socket.on("social:read_receipt", onReceipt);
    return () => {
      socket.off("connect", updateConnection);
      socket.off("disconnect", updateConnection);
      socket.off("social:new_message", onMessage);
      socket.off("social:typing", onTyping);
      socket.off("social:read_receipt", onReceipt);
    };
  }, [conversationId, friendId, selfId, socket]);

  const loadOlder = async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await socialApi.messages(conversationId, nextCursor);
      setMessages((current) => [...page.messages, ...current]);
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.error);
    } finally {
      setLoadingOlder(false);
    }
  };

  const updateDraft = (value: string) => {
    setDraft(value.slice(0, 1000));
    const activeSocket = socket;
    if (!activeSocket?.connected || !friendId) return;
    activeSocket.emit("social:typing", { playerId: friendId });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      activeSocket.emit("social:typing-stop", { playerId: friendId });
    }, 1400);
  };

  const send = () => {
    const content = draft.trim();
    const activeSocket = socket;
    if (!content || sending || !socketConnected || !activeSocket || !friendId) return;
    const idempotencyKey = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;
    setSending(true);
    setError("");
    activeSocket.emit("social:message", { playerId: friendId, content, idempotencyKey }, (result: unknown) => {
      setSending(false);
      if (typeof result !== "object" || result === null || !("ok" in result) || result.ok !== true
        || !("message" in result)) {
        const code = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : text.error;
        setError(code);
        return;
      }
      const message = result.message;
      if (!isSocialMessage(message)) {
        setError(text.error);
        return;
      }
      setMessages((current) => current.some((item) => item.id === message.id)
        ? current
        : [...current, message]);
      setDraft("");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 40);
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 8) }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 6 : 0}
    >
      <GameScreenBackground accent="online" />
      <GameHeader
        title={friendName}
        subtitle={text.title}
        onBack={() => router.back()}
        icon={<GameIcon name="chat" size={23} color={CYAN} />}
        trailing={<View style={styles.headerLock}><Ionicons name="lock-closed-outline" size={17} color={theme.textMuted} /></View>}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.messageScroll}
        contentContainerStyle={styles.messageContent}
        keyboardShouldPersistTaps="handled"
      >
        {loading && <ActivityIndicator color={CYAN} />}
        {!loading && nextCursor && (
          <Pressable onPress={() => void loadOlder()} style={styles.olderButton}>
            {loadingOlder
              ? <ActivityIndicator color={CYAN} />
              : <Text style={{ color: CYAN, fontWeight: "700" }}>{text.loadOlder}</Text>}
          </Pressable>
        )}
        {!loading && messages.length === 0 && (
          <Text style={[styles.empty, { color: theme.textSecondary }]}>{text.empty}</Text>
        )}
        {messages.map((message) => {
          const own = message.senderId === selfId;
          return (
            <View key={message.id} style={[styles.messageRow, { alignSelf: own ? "flex-end" : "flex-start" }]}>
              <View style={[
                styles.bubble,
                own
                  ? [styles.ownBubble, { backgroundColor: `${CYAN}24` }]
                  : [styles.friendBubble, { backgroundColor: theme.card, borderColor: theme.cardBorder }],
                { borderColor: own ? `${GREEN}55` : theme.cardBorder },
              ]}>
                <Text selectable style={[styles.messageText, { color: theme.textPrimary }]}>{message.content}</Text>
                <View style={styles.messageMeta}>
                  <Text style={[styles.time, { color: own ? "#A4DCC8" : theme.textMuted }]}>
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  {own && message.readAt ? <Text style={styles.readReceipt}>{text.read}</Text> : null}
                </View>
              </View>
            </View>
          );
        })}
        {typing && <Text style={[styles.typingText, { color: theme.textSecondary }]}>{text.typing}</Text>}
      </ScrollView>

      {!!error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={RED} />
          <Text style={styles.errorText}>{displayError(error,isRTL)}</Text>
        </View>
      )}
      {!socketConnected && (
        <Text style={[styles.connectionText, { color: theme.textMuted }]}>{text.connection}</Text>
      )}

      <View style={[styles.composer, { borderColor: theme.cardBorder, paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          accessibilityLabel={text.placeholder}
          editable={!sending && socketConnected}
          maxLength={1000}
          multiline
          onChangeText={updateDraft}
          onSubmitEditing={send}
          placeholder={text.placeholder}
          placeholderTextColor={theme.textMuted}
          returnKeyType="send"
          style={[styles.input, { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.textPrimary, textAlign: isRTL ? "right" : "left" }]}
          value={draft}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text.send}
          disabled={!draft.trim() || sending || !socketConnected}
          onPress={send}
          style={({ pressed }) => [styles.sendButton, { opacity: !draft.trim() || sending || !socketConnected ? 0.45 : pressed ? 0.72 : 1 }]}
        >
          {sending ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="send" size={19} color="#FFFFFF" />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { minHeight: 65, borderBottomWidth: 1, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerAvatar: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${CYAN}20` },
  headerCopy: { flex: 1 },
  headerLock: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  friendName: { fontSize: 15, fontWeight: "800" },
  headerSub: { fontSize: 11 },
  messageScroll: { flex: 1 },
  messageContent: { flexGrow: 1, justifyContent: "flex-end", padding: 14, gap: 10 },
  olderButton: { alignSelf: "center", minHeight: 40, justifyContent: "center", paddingHorizontal: 12 },
  empty: { alignSelf: "center", textAlign: "center", marginVertical: 28 },
  messageRow: { maxWidth: "86%" },
  bubble: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 7 },
  ownBubble: { backgroundColor: "#123B34", borderBottomRightRadius: 5 },
  friendBubble: { backgroundColor: "#17243A", borderBottomLeftRadius: 5 },
  messageText: { fontSize: 15, lineHeight: 21 },
  messageMeta: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 7, marginTop: 4 },
  time: { fontSize: 10 },
  readReceipt: { color: GREEN, fontSize: 10, fontWeight: "700" },
  typingText: { alignSelf: "flex-start", fontSize: 12, paddingHorizontal: 6 },
  errorBanner: { backgroundColor: "#5A2938", marginHorizontal: 12, marginBottom: 6, borderRadius: 12, padding: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { color: "#FFC0CB", flex: 1, fontSize: 12 },
  connectionText: { textAlign: "center", fontSize: 11, paddingBottom: 3 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 9, paddingHorizontal: 12, paddingTop: 9, borderTopWidth: 1 },
  input: { flex: 1, maxHeight: 120, minHeight: 46, borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15 },
  sendButton: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: CYAN },
});
