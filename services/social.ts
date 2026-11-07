import { getApiUrl } from "@/lib/query-client";
import { getOnlineGuestToken } from "@/services/socket";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
};

async function socialRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getOnlineGuestToken();
  const response = await fetch(new URL(path, getApiUrl()), {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  if (!response.ok) {
    let code = "social_unavailable";
    try {
      const result = await response.json() as { error?: unknown };
      if (typeof result.error === "string") code = result.error;
    } catch (error) {
      console.warn("[social] Could not decode API error:", error);
    }
    throw new Error(code);
  }
  return response.json() as Promise<T>;
}

export type SocialPlayer = {
  playerId: string;
  displayName: string;
  presence?: "offline" | "online" | "in_game" | "hidden";
};

export type SocialRequest = {
  id: string;
  createdAt: string;
  player?: SocialPlayer;
};

export type SocialMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
};

export type SocialInvite = {
  id: string;
  senderId: string;
  displayName: string;
  roomCode: string;
  expiresAt: string;
  createdAt: string;
};

export type SocialConversation = {
  conversationId: string;
  playerId: string;
  displayName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

export const socialApi = {
  profile: () => socialRequest<SocialPlayer & { playerCode: string }>("/api/social/profile"),
  updateProfile: (displayName: string) => socialRequest<SocialPlayer>("/api/social/profile", {
    method: "PUT",
    body: { displayName },
  }),
  search: (query: string) => socialRequest<{ players: SocialPlayer[] }>(
    `/api/social/search?q=${encodeURIComponent(query)}`,
  ),
  friends: (offset = 0) => socialRequest<{
    friends: (SocialPlayer & { since: string })[];
    nextOffset: number | null;
  }>(`/api/social/friends?limit=30&offset=${offset}`),
  requests: (direction: "incoming" | "outgoing", offset = 0) => socialRequest<{
    requests: SocialRequest[];
    nextOffset: number | null;
  }>(
    `/api/social/friend-requests?direction=${direction}&limit=30&offset=${offset}`,
  ),
  sendRequest: (playerId: string) => socialRequest<{ requestId: string }>("/api/social/friend-requests", {
    method: "POST",
    body: { playerId },
  }),
  respondRequest: (id: string, accept: boolean) => socialRequest<{ success: boolean }>(
    `/api/social/friend-requests/${encodeURIComponent(id)}/respond`,
    { method: "POST", body: { accept } },
  ),
  cancelRequest: (id: string) => socialRequest<{ success: boolean }>(
    `/api/social/friend-requests/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  ),
  removeFriend: (playerId: string) => socialRequest<{ success: boolean }>(
    `/api/social/friends/${encodeURIComponent(playerId)}`,
    { method: "DELETE" },
  ),
  block: (playerId: string) => socialRequest<{ success: boolean }>("/api/social/blocks", {
    method: "POST",
    body: { playerId },
  }),
  unblock: (playerId: string) => socialRequest<{ success: boolean }>(
    `/api/social/blocks/${encodeURIComponent(playerId)}`,
    { method: "DELETE" },
  ),
  blocks: () => socialRequest<{ blocks: (SocialPlayer & { createdAt: string })[] }>("/api/social/blocks"),
  privacy: () => socialRequest<{
    allowFriendRequests: boolean;
    allowGameInvites: boolean;
    showPresence: boolean;
  }>("/api/social/privacy"),
  updatePrivacy: (privacy: {
    allowFriendRequests: boolean;
    allowGameInvites: boolean;
    showPresence: boolean;
  }) => socialRequest<{ success: boolean }>("/api/social/privacy", {
    method: "PUT",
    body: privacy,
  }),
  conversation: (playerId: string) => socialRequest<{ conversationId: string }>(
    "/api/social/conversations",
    { method: "POST", body: { playerId } },
  ),
  conversations: () => socialRequest<{ conversations: SocialConversation[] }>("/api/social/conversations"),
  messages: (conversationId: string, cursor?: string | null) => socialRequest<{
    messages: SocialMessage[];
    nextCursor: string | null;
  }>(
    `/api/social/conversations/${encodeURIComponent(conversationId)}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  ),
  notifications: () => socialRequest<{ notifications: {
    id: string;
    type: string;
    actorId: string | null;
    actorName: string | null;
    entityId: string | null;
    payload: Record<string, string>;
    readAt: string | null;
    createdAt: string;
  }[] }>("/api/social/notifications"),
  markNotificationRead: (id: string) => socialRequest<{ success: boolean }>(
    `/api/social/notifications/${encodeURIComponent(id)}/read`,
    { method: "POST" },
  ),
  invitations: () => socialRequest<{ invitations: SocialInvite[] }>("/api/social/invitations"),
};
