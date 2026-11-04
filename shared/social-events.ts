import type { SocialMessage } from "@shared/schema";

export type SocialPresence = "offline" | "online" | "in_game" | "hidden";

export type SocialMessagePayload = Omit<
  Pick<SocialMessage, "id" | "conversationId" | "senderId" | "content" | "createdAt" | "readAt">,
  "createdAt" | "readAt"
> & {
  createdAt: string;
  readAt: string | null;
};

export type SocialNotificationPayload = {
  id: string;
  type: "friend_request" | "friend_accepted" | "message" | "game_invite" | "invite_response";
  actorId: string | null;
  entityId: string | null;
  createdAt: string;
};

export type SocialClientToServerEvents = {
  "social:message": (
    payload: { playerId: string; content: string; idempotencyKey: string },
    ack: (result: { ok: boolean; error?: string; message?: SocialMessagePayload; duplicate?: boolean }) => void,
  ) => void;
  "social:typing": (payload: { playerId: string }) => void;
  "social:typing-stop": (payload: { playerId: string }) => void;
  "social:read": (
    payload: { conversationId: string },
    ack: (result: { ok: boolean; error?: string; readAt?: string }) => void,
  ) => void;
  "social:game_invite": (
    payload: { playerId: string; roomCode: string },
    ack: (result: { ok: boolean; error?: string; inviteId?: string }) => void,
  ) => void;
  "social:game_invite:respond": (
    payload: { inviteId: string; accept: boolean },
    ack: (result: { ok: boolean; error?: string; status?: string; roomCode?: string }) => void,
  ) => void;
};

export type SocialServerToClientEvents = {
  "social:new_message": (message: SocialMessagePayload) => void;
  "social:presence": (payload: { playerId: string; status: SocialPresence }) => void;
  "social:typing": (payload: { playerId: string; active: boolean }) => void;
  "social:read_receipt": (payload: { conversationId: string; readerId: string; readAt: string }) => void;
  "social:game_invite": (payload: {
    id: string;
    senderId: string;
    displayName: string;
    roomCode: string;
    expiresAt: string;
    createdAt: string;
  }) => void;
  "social:invite_response": (payload: {
    inviteId: string;
    playerId: string;
    status: "accepted" | "declined";
    roomCode: string;
  }) => void;
  "social:notification": (notification: SocialNotificationPayload) => void;
  "social:notification_read": (payload: { conversationId: string }) => void;
  "social:error": (payload: { code: string }) => void;
};
