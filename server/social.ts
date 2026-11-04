import { createHash } from "node:crypto";
import { setInterval as setNodeInterval, clearInterval as clearNodeInterval } from "node:timers";
import type { Express, Request, Response } from "express";
import { and, desc, eq, gt, gte, ilike, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { Server as SocketServer, type Socket } from "socket.io";
import {
  onlineGuestSessions,
  socialBlocks,
  socialConversations,
  socialFriendRequests,
  socialFriendships,
  socialGameInvites,
  socialMessages,
  socialNotifications,
  socialProfiles,
} from "@shared/schema";
import type { SocialMessagePayload, SocialNotificationPayload, SocialPresence } from "@shared/social-events";
import { db } from "./db";
import {
  canMessage,
  canSendFriendRequest,
  normalizeMessageContent,
  normalizePlayerPair as pairFor,
} from "./social-logic";

type SocialSocket = Socket & { data: { playerId?: string; displayName?: string } };
type RoomValidation = (roomCode: string, playerId: string) =>
  "ok" | "not_found" | "full" | "not_waiting" | "already_in_match";
type PresenceState = Exclude<SocialPresence, "hidden">;
type PresenceEntry = { sockets: Set<string>; inGame: boolean };

const presenceByPlayer = new Map<string, PresenceEntry>();
const rateBuckets = new Map<string, { startedAt: number; count: number }>();
const MAX_PAGE_SIZE = 50;
const PAGE_SIZE_SCHEMA = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20);
const uuidSchema = z.string().uuid();
const friendRequestSchema = z.object({ playerId: uuidSchema }).strict();
const profileSchema = z.object({ displayName: z.string().trim().min(1).max(24) }).strict();
const blockSchema = z.object({ playerId: uuidSchema }).strict();
const messageSchema = z.object({
  content: z.string().transform(normalizeMessageContent).pipe(z.string().min(1).max(1000)),
  idempotencyKey: z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();
const inviteSchema = z.object({
  playerId: uuidSchema,
  roomCode: z.string().trim().regex(/^[A-HJ-NP-Z2-9]{6}$/i),
}).strict();
const invitationResponseSchema = z.object({
  inviteId: uuidSchema,
  accept: z.boolean(),
}).strict();
const socketMessageSchema = z.object({
  playerId: uuidSchema,
  ...messageSchema.shape,
}).strict();
const typingSchema = z.object({ playerId: uuidSchema }).strict();
const readSchema = z.object({ conversationId: uuidSchema }).strict();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

function getPresence(playerId: string): PresenceState {
  const entry = presenceByPlayer.get(playerId);
  if (!entry || entry.sockets.size === 0) return "offline";
  return entry.inGame ? "in_game" : "online";
}

async function ensureProfile(playerId: string, displayName?: string): Promise<void> {
  await db.insert(socialProfiles).values({
    playerId,
    ...(displayName ? { displayName: displayName.replace(/[<>]/g, "") } : {}),
  }).onConflictDoNothing();
}

async function authorizedPlayer(req: Request): Promise<string | null> {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (token.length < 40 || token.length > 128) return null;
  const [session] = await db.select({ id: onlineGuestSessions.id })
    .from(onlineGuestSessions)
    .where(and(
      eq(onlineGuestSessions.tokenHash, hashToken(token)),
      gte(onlineGuestSessions.expiresAt, new Date()),
    ))
    .limit(1);
  return session?.id ?? null;
}

function withAuth(
  handler: (req: Request, res: Response, playerId: string) => Promise<void>,
) {
  return async (req: Request, res: Response) => {
    try {
      const playerId = await authorizedPlayer(req);
      if (!playerId) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      await handler(req, res, playerId);
    } catch (error) {
      console.error("[social] Request failed:", error);
      if (!res.headersSent) res.status(500).json({ error: "social_unavailable" });
    }
  };
}

async function getPlayerProfile(playerId: string) {
  const [profile] = await db.select({
    playerId: socialProfiles.playerId,
    displayName: socialProfiles.displayName,
  }).from(socialProfiles).where(eq(socialProfiles.playerId, playerId)).limit(1);
  return profile ?? { playerId, displayName: "لاعب" };
}

async function areFriends(first: string, second: string): Promise<boolean> {
  const [playerLow, playerHigh] = pairFor(first, second);
  const [friendship] = await db.select({ playerLow: socialFriendships.playerLow })
    .from(socialFriendships)
    .where(and(
      eq(socialFriendships.playerLow, playerLow),
      eq(socialFriendships.playerHigh, playerHigh),
    ))
    .limit(1);
  return !!friendship;
}

async function isBlockedEitherWay(first: string, second: string): Promise<boolean> {
  const [block] = await db.select({ blockerId: socialBlocks.blockerId })
    .from(socialBlocks)
    .where(or(
      and(eq(socialBlocks.blockerId, first), eq(socialBlocks.blockedId, second)),
      and(eq(socialBlocks.blockerId, second), eq(socialBlocks.blockedId, first)),
    ))
    .limit(1);
  return !!block;
}

async function createNotification(
  playerId: string,
  type: "friend_request" | "friend_accepted" | "message" | "game_invite" | "invite_response",
  actorId: string | null,
  entityId: string | null,
  payload: Record<string, string> = {},
): Promise<void> {
  try {
    const [notification] = await db.insert(socialNotifications).values({
      playerId,
      type,
      actorId,
      entityId,
      payload,
    }).returning({
      id: socialNotifications.id,
      type: socialNotifications.type,
      actorId: socialNotifications.actorId,
      entityId: socialNotifications.entityId,
      createdAt: socialNotifications.createdAt,
    });
    const event: SocialNotificationPayload = {
      id: notification.id,
      type: notification.type as SocialNotificationPayload["type"],
      actorId: notification.actorId,
      entityId: notification.entityId,
      createdAt: notification.createdAt.toISOString(),
    };
    ioForPresence?.to(`social:${playerId}`).emit("social:notification", event);
  } catch (error) {
    console.error("[social] Notification persistence failed:", error);
    ioForPresence?.to(`social:${playerId}`).emit("social:error", { code: "notification_unavailable" });
  }
}

function parsePageSize(value: unknown): number {
  const parsed = PAGE_SIZE_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : 20;
}

function parsePageOffset(value: unknown): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 0;
  return Math.min(Number(value), 10_000);
}

function parseCursor(value: unknown): { createdAt: Date; id: string } | null {
  if (typeof value !== "string" || value.length > 512) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" && parsed !== null
      && "createdAt" in parsed && typeof parsed.createdAt === "string"
      && "id" in parsed && typeof parsed.id === "string"
    ) {
      const createdAt = new Date(parsed.createdAt);
      if (!Number.isNaN(createdAt.getTime())) return { createdAt, id: parsed.id };
    }
  } catch {
    return null;
  }
  return null;
}

function makeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), "utf8").toString("base64url");
}

export function registerSocialRoutes(app: Express): void {
  app.get("/api/social/profile", withAuth(async (_req, res, playerId) => {
    await ensureProfile(playerId);
    const profile = await getPlayerProfile(playerId);
    res.json({ ...profile, playerCode: playerId });
  }));

  app.put("/api/social/profile", withAuth(async (req, res, playerId) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    await db.insert(socialProfiles).values({
      playerId,
      displayName: parsed.data.displayName.replace(/[<>]/g, ""),
    }).onConflictDoUpdate({
      target: socialProfiles.playerId,
      set: { displayName: parsed.data.displayName.replace(/[<>]/g, ""), updatedAt: new Date() },
    });
    res.json(await getPlayerProfile(playerId));
  }));

  app.put("/api/social/privacy", withAuth(async (req, res, playerId) => {
    await ensureProfile(playerId);
    const parsed = z.object({
      allowFriendRequests: z.boolean(),
      allowGameInvites: z.boolean(),
      showPresence: z.boolean(),
    }).strict().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    await db.update(socialProfiles)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(socialProfiles.playerId, playerId));
    await broadcastPresence(playerId);
    res.json({ success: true });
  }));

  app.get("/api/social/privacy", withAuth(async (_req, res, playerId) => {
    await ensureProfile(playerId);
    const [privacy] = await db.select({
      allowFriendRequests: socialProfiles.allowFriendRequests,
      allowGameInvites: socialProfiles.allowGameInvites,
      showPresence: socialProfiles.showPresence,
    }).from(socialProfiles).where(eq(socialProfiles.playerId, playerId)).limit(1);
    res.json(privacy ?? {
      allowFriendRequests: true,
      allowGameInvites: true,
      showPresence: true,
    });
  }));

  app.get("/api/social/search", withAuth(async (req, res, playerId) => {
    if (isRateLimited(`search:${playerId}`, 30, 60_000)) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 40) : "";
    if (query.length < 2) {
      res.json({ players: [] });
      return;
    }
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    const matches = await db.select({
      playerId: socialProfiles.playerId,
      displayName: socialProfiles.displayName,
      showPresence: socialProfiles.showPresence,
    }).from(socialProfiles).where(and(
      ne(socialProfiles.playerId, playerId),
      or(ilike(socialProfiles.displayName, pattern), sql`lower(${socialProfiles.playerId}) = lower(${query})`),
      sql`NOT EXISTS (
        SELECT 1 FROM social_blocks b
        WHERE (b.blocker_id = ${playerId} AND b.blocked_id = ${socialProfiles.playerId})
           OR (b.blocker_id = ${socialProfiles.playerId} AND b.blocked_id = ${playerId})
      )`,
    )).limit(20);
    const friendships = matches.length ? await db.select().from(socialFriendships).where(and(
      or(eq(socialFriendships.playerLow, playerId), eq(socialFriendships.playerHigh, playerId)),
      or(
        inArray(socialFriendships.playerLow, matches.map((match) => match.playerId)),
        inArray(socialFriendships.playerHigh, matches.map((match) => match.playerId)),
      ),
    )) : [];
    const friendIds = new Set(friendships.map((friendship) =>
      friendship.playerLow === playerId ? friendship.playerHigh : friendship.playerLow,
    ));
    res.json({
      players: matches.map(({ showPresence, ...profile }) => ({
        ...profile,
        presence: showPresence && friendIds.has(profile.playerId) ? getPresence(profile.playerId) : "hidden",
      })),
    });
  }));

  app.post("/api/social/friend-requests", withAuth(async (req, res, playerId) => {
    await ensureProfile(playerId);
    if (isRateLimited(`friend-request:${playerId}`, 10, 60_000)) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    const parsed = friendRequestSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.playerId === playerId) {
      res.status(400).json({ error: "invalid_player" });
      return;
    }
    const targetId = parsed.data.playerId;
    const [target] = await db.select().from(socialProfiles)
      .where(eq(socialProfiles.playerId, targetId)).limit(1);
    if (!target) {
      res.status(404).json({ error: "player_not_found" });
      return;
    }
    const [alreadyFriends, blocked] = await Promise.all([
      areFriends(playerId, targetId),
      isBlockedEitherWay(playerId, targetId),
    ]);
    if (!canSendFriendRequest({
      samePlayer: playerId === targetId,
      alreadyFriends,
      blocked,
      requestsAllowed: target.allowFriendRequests,
    })) {
      res.status(blocked || !target.allowFriendRequests ? 403 : 409).json({
        error: blocked || !target.allowFriendRequests ? "contact_not_allowed" : "already_friends",
      });
      return;
    }
    const [pairLow, pairHigh] = pairFor(playerId, targetId);
    const [existing] = await db.select()
      .from(socialFriendRequests)
      .where(and(
        eq(socialFriendRequests.pairLow, pairLow),
        eq(socialFriendRequests.pairHigh, pairHigh),
        eq(socialFriendRequests.status, "pending"),
      )).limit(1);
    if (existing) {
      res.status(409).json({ error: "request_already_pending" });
      return;
    }
    let request: typeof socialFriendRequests.$inferSelect | undefined;
    try {
      [request] = await db.insert(socialFriendRequests).values({
        senderId: playerId,
        receiverId: targetId,
        pairLow,
        pairHigh,
      }).returning();
    } catch (insertError) {
      if (typeof insertError === "object" && insertError !== null && "code" in insertError && insertError.code === "23505") {
        res.status(409).json({ error: "request_already_pending" });
        return;
      }
      throw insertError;
    }
    if (!request) {
      res.status(500).json({ error: "social_unavailable" });
      return;
    }
    await createNotification(targetId, "friend_request", playerId, request.id);
    res.status(201).json({ requestId: request.id });
  }));

  app.get("/api/social/friend-requests", withAuth(async (req, res, playerId) => {
    const direction = req.query.direction === "outgoing" ? "outgoing" : "incoming";
    const limit = parsePageSize(req.query.limit);
    const offset = parsePageOffset(req.query.offset);
    const requests = await db.select().from(socialFriendRequests).where(and(
      eq(direction === "incoming" ? socialFriendRequests.receiverId : socialFriendRequests.senderId, playerId),
      eq(socialFriendRequests.status, "pending"),
    )).orderBy(desc(socialFriendRequests.createdAt)).limit(limit + 1).offset(offset);
    const hasMore = requests.length > limit;
    const page = requests.slice(0, limit);
    const ids = page.map((request) => direction === "incoming" ? request.senderId : request.receiverId);
    const profiles = ids.length ? await db.select({
      playerId: socialProfiles.playerId,
      displayName: socialProfiles.displayName,
    }).from(socialProfiles).where(inArray(socialProfiles.playerId, ids)) : [];
    const profileById = new Map(profiles.map((profile) => [profile.playerId, profile]));
    res.json({
      requests: page.map((request) => ({
        id: request.id,
        createdAt: request.createdAt,
        player: profileById.get(direction === "incoming" ? request.senderId : request.receiverId),
      })),
      nextOffset: hasMore ? offset + limit : null,
    });
  }));

  app.post("/api/social/friend-requests/:id/respond", withAuth(async (req, res, playerId) => {
    const requestId = uuidSchema.safeParse(req.params.id);
    const parsed = z.object({ accept: z.boolean() }).strict().safeParse(req.body);
    if (!requestId.success || !parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const [result] = await db.transaction(async (tx) => {
      const [request] = await tx.select().from(socialFriendRequests).where(and(
        eq(socialFriendRequests.id, requestId.data),
        eq(socialFriendRequests.receiverId, playerId),
        eq(socialFriendRequests.status, "pending"),
      )).limit(1).for("update");
      if (!request) return [];
      const [block] = await tx.select({ blockerId: socialBlocks.blockerId })
        .from(socialBlocks).where(or(
          and(eq(socialBlocks.blockerId, playerId), eq(socialBlocks.blockedId, request.senderId)),
          and(eq(socialBlocks.blockerId, request.senderId), eq(socialBlocks.blockedId, playerId)),
        )).limit(1);
      if (block) return [];
      await tx.update(socialFriendRequests).set({
        status: parsed.data.accept ? "accepted" : "declined",
        updatedAt: new Date(),
      }).where(eq(socialFriendRequests.id, request.id));
      if (parsed.data.accept) {
        await tx.insert(socialFriendships).values({
          playerLow: request.pairLow,
          playerHigh: request.pairHigh,
        }).onConflictDoNothing();
      }
      return [request];
    });
    if (!result) {
      res.status(404).json({ error: "request_not_found" });
      return;
    }
    if (parsed.data.accept) {
      await createNotification(result.senderId, "friend_accepted", playerId, result.id);
    }
    res.json({ success: true, accepted: parsed.data.accept });
  }));

  app.delete("/api/social/friend-requests/:id", withAuth(async (req, res, playerId) => {
    const requestId = uuidSchema.safeParse(req.params.id);
    if (!requestId.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const deleted = await db.delete(socialFriendRequests).where(and(
      eq(socialFriendRequests.id, requestId.data),
      eq(socialFriendRequests.senderId, playerId),
      eq(socialFriendRequests.status, "pending"),
    )).returning({ id: socialFriendRequests.id });
    res.status(deleted.length ? 200 : 404).json({ success: deleted.length > 0 });
  }));

  app.get("/api/social/friends", withAuth(async (req, res, playerId) => {
    const limit = parsePageSize(req.query.limit);
    const offset = parsePageOffset(req.query.offset);
    const rows = await db.select().from(socialFriendships).where(or(
      eq(socialFriendships.playerLow, playerId),
      eq(socialFriendships.playerHigh, playerId),
    )).orderBy(desc(socialFriendships.createdAt)).limit(limit + 1).offset(offset);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const ids = page.map((row) => row.playerLow === playerId ? row.playerHigh : row.playerLow);
    const profiles = ids.length ? await db.select({
      playerId: socialProfiles.playerId,
      displayName: socialProfiles.displayName,
      showPresence: socialProfiles.showPresence,
    }).from(socialProfiles).where(inArray(socialProfiles.playerId, ids)) : [];
    const profileById = new Map(profiles.map((profile) => [profile.playerId, profile]));
    res.json({
      friends: page.flatMap((row) => {
        const id = row.playerLow === playerId ? row.playerHigh : row.playerLow;
        const profile = profileById.get(id);
        return profile ? [{
          playerId: id,
          displayName: profile.displayName,
          since: row.createdAt,
          presence: profile.showPresence ? getPresence(id) : "hidden",
        }] : [];
      }),
      nextOffset: hasMore ? offset + limit : null,
    });
  }));

  app.delete("/api/social/friends/:playerId", withAuth(async (req, res, playerId) => {
    const target = uuidSchema.safeParse(req.params.playerId);
    if (!target.success || target.data === playerId) {
      res.status(400).json({ error: "invalid_player" });
      return;
    }
    const [low, high] = pairFor(playerId, target.data);
    await db.delete(socialFriendships).where(and(
      eq(socialFriendships.playerLow, low),
      eq(socialFriendships.playerHigh, high),
    ));
    res.json({ success: true });
  }));

  app.post("/api/social/blocks", withAuth(async (req, res, playerId) => {
    await ensureProfile(playerId);
    if (isRateLimited(`block:${playerId}`, 10, 60_000)) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    const parsed = blockSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.playerId === playerId) {
      res.status(400).json({ error: "invalid_player" });
      return;
    }
    const targetId = parsed.data.playerId;
    await db.transaction(async (tx) => {
      await tx.insert(socialBlocks).values({ blockerId: playerId, blockedId: targetId }).onConflictDoNothing();
      const [low, high] = pairFor(playerId, targetId);
      await tx.delete(socialFriendships).where(and(
        eq(socialFriendships.playerLow, low),
        eq(socialFriendships.playerHigh, high),
      ));
      await tx.update(socialFriendRequests).set({ status: "cancelled", updatedAt: new Date() }).where(and(
        or(
          and(eq(socialFriendRequests.senderId, playerId), eq(socialFriendRequests.receiverId, targetId)),
          and(eq(socialFriendRequests.senderId, targetId), eq(socialFriendRequests.receiverId, playerId)),
        ),
        eq(socialFriendRequests.status, "pending"),
      ));
      await tx.update(socialGameInvites).set({ status: "expired" }).where(and(
        or(
          and(eq(socialGameInvites.senderId, playerId), eq(socialGameInvites.receiverId, targetId)),
          and(eq(socialGameInvites.senderId, targetId), eq(socialGameInvites.receiverId, playerId)),
        ),
        eq(socialGameInvites.status, "pending"),
      ));
    });
    res.json({ success: true });
  }));

  app.delete("/api/social/blocks/:playerId", withAuth(async (req, res, playerId) => {
    const target = uuidSchema.safeParse(req.params.playerId);
    if (!target.success) {
      res.status(400).json({ error: "invalid_player" });
      return;
    }
    await db.delete(socialBlocks).where(and(
      eq(socialBlocks.blockerId, playerId),
      eq(socialBlocks.blockedId, target.data),
    ));
    res.json({ success: true });
  }));

  app.get("/api/social/blocks", withAuth(async (_req, res, playerId) => {
    const rows = await db.select({
      playerId: socialBlocks.blockedId,
      displayName: socialProfiles.displayName,
      createdAt: socialBlocks.createdAt,
    }).from(socialBlocks)
      .innerJoin(socialProfiles, eq(socialProfiles.playerId, socialBlocks.blockedId))
      .where(eq(socialBlocks.blockerId, playerId))
      .orderBy(desc(socialBlocks.createdAt)).limit(MAX_PAGE_SIZE);
    res.json({ blocks: rows });
  }));

  app.post("/api/social/conversations", withAuth(async (req, res, playerId) => {
    await ensureProfile(playerId);
    if (isRateLimited(`conversation:${playerId}`, 20, 60_000)) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    const parsed = friendRequestSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.playerId === playerId) {
      res.status(400).json({ error: "invalid_player" });
      return;
    }
    const otherId = parsed.data.playerId;
    if (!await areFriends(playerId, otherId) || await isBlockedEitherWay(playerId, otherId)) {
      res.status(403).json({ error: "chat_not_allowed" });
      return;
    }
    const [playerLow, playerHigh] = pairFor(playerId, otherId);
    await db.insert(socialConversations).values({ playerLow, playerHigh }).onConflictDoNothing();
    const [conversation] = await db.select().from(socialConversations).where(and(
      eq(socialConversations.playerLow, playerLow),
      eq(socialConversations.playerHigh, playerHigh),
    )).limit(1);
    if (!conversation) {
      res.status(500).json({ error: "social_unavailable" });
      return;
    }
    res.json({ conversationId: conversation.id });
  }));

  app.get("/api/social/conversations", withAuth(async (_req, res, playerId) => {
    const result = await db.execute(sql`
      SELECT c.id AS "conversationId",
             p.player_id AS "playerId",
             p.display_name AS "displayName",
             latest.content AS "lastMessage",
             latest.created_at AS "lastMessageAt",
             COALESCE(unread.total, 0)::int AS "unreadCount"
      FROM social_conversations c
      JOIN social_profiles p ON p.player_id = CASE
        WHEN c.player_low = ${playerId} THEN c.player_high ELSE c.player_low END
      LEFT JOIN LATERAL (
        SELECT m.content, m.created_at
        FROM social_messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS total
        FROM social_messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id <> ${playerId}
          AND m.read_at IS NULL
      ) unread ON true
      WHERE (c.player_low = ${playerId} OR c.player_high = ${playerId})
        AND EXISTS (
          SELECT 1 FROM social_friendships f
          WHERE f.player_low = c.player_low AND f.player_high = c.player_high
        )
        AND NOT EXISTS (
          SELECT 1 FROM social_blocks b
          WHERE (b.blocker_id = c.player_low AND b.blocked_id = c.player_high)
             OR (b.blocker_id = c.player_high AND b.blocked_id = c.player_low)
        )
      ORDER BY COALESCE(latest.created_at, c.created_at) DESC, c.id DESC
      LIMIT 50
    `);
    res.json({ conversations: result.rows });
  }));

  app.get("/api/social/conversations/:id/messages", withAuth(async (req, res, playerId) => {
    const conversationId = uuidSchema.safeParse(req.params.id);
    if (!conversationId.success) {
      res.status(400).json({ error: "invalid_conversation" });
      return;
    }
    const [conversation] = await db.select().from(socialConversations).where(and(
      eq(socialConversations.id, conversationId.data),
      or(eq(socialConversations.playerLow, playerId), eq(socialConversations.playerHigh, playerId)),
    )).limit(1);
    if (!conversation) {
      res.status(404).json({ error: "conversation_not_found" });
      return;
    }
    const otherId = conversation.playerLow === playerId ? conversation.playerHigh : conversation.playerLow;
    if (!await areFriends(playerId, otherId) || await isBlockedEitherWay(playerId, otherId)) {
      res.status(403).json({ error: "chat_not_allowed" });
      return;
    }
    const limit = parsePageSize(req.query.limit);
    const cursor = req.query.cursor ? parseCursor(req.query.cursor) : null;
    if (req.query.cursor && !cursor) {
      res.status(400).json({ error: "invalid_cursor" });
      return;
    }
    const conditions = [
      eq(socialMessages.conversationId, conversation.id),
      ...(cursor ? [or(
        lt(socialMessages.createdAt, cursor.createdAt),
        and(eq(socialMessages.createdAt, cursor.createdAt), lt(socialMessages.id, cursor.id)),
      )!] : []),
    ];
    const page = await db.select().from(socialMessages).where(and(...conditions))
      .orderBy(desc(socialMessages.createdAt), desc(socialMessages.id)).limit(limit + 1);
    const hasMore = page.length > limit;
    const messages = page.slice(0, limit);
    const oldest = messages.at(-1);
    res.json({
      messages: messages.reverse(),
      nextCursor: hasMore && oldest ? makeCursor(oldest.createdAt, oldest.id) : null,
    });
  }));

  app.get("/api/social/notifications", withAuth(async (req, res, playerId) => {
    const limit = parsePageSize(req.query.limit);
    const notifications = await db.select({
      id: socialNotifications.id,
      type: socialNotifications.type,
      actorId: socialNotifications.actorId,
      actorName: socialProfiles.displayName,
      entityId: socialNotifications.entityId,
      payload: socialNotifications.payload,
      readAt: socialNotifications.readAt,
      createdAt: socialNotifications.createdAt,
    }).from(socialNotifications)
      .leftJoin(socialProfiles, eq(socialProfiles.playerId, socialNotifications.actorId))
      .where(eq(socialNotifications.playerId, playerId))
      .orderBy(desc(socialNotifications.createdAt), desc(socialNotifications.id))
      .limit(limit);
    res.json({ notifications });
  }));

  app.post("/api/social/notifications/:id/read", withAuth(async (req, res, playerId) => {
    const notificationId = uuidSchema.safeParse(req.params.id);
    if (!notificationId.success) {
      res.status(400).json({ error: "invalid_notification" });
      return;
    }
    await db.update(socialNotifications).set({ readAt: new Date() }).where(and(
      eq(socialNotifications.id, notificationId.data),
      eq(socialNotifications.playerId, playerId),
      isNull(socialNotifications.readAt),
    ));
    res.json({ success: true });
  }));

  app.get("/api/social/invitations", withAuth(async (_req, res, playerId) => {
    await db.update(socialGameInvites).set({ status: "expired" }).where(and(
      eq(socialGameInvites.receiverId, playerId),
      eq(socialGameInvites.status, "pending"),
      lte(socialGameInvites.expiresAt, new Date()),
    ));
    const invitations = await db.select({
      id: socialGameInvites.id,
      senderId: socialGameInvites.senderId,
      roomCode: socialGameInvites.roomCode,
      expiresAt: socialGameInvites.expiresAt,
      createdAt: socialGameInvites.createdAt,
      displayName: socialProfiles.displayName,
    }).from(socialGameInvites)
      .innerJoin(socialProfiles, eq(socialProfiles.playerId, socialGameInvites.senderId))
      .where(and(
        eq(socialGameInvites.receiverId, playerId),
        eq(socialGameInvites.status, "pending"),
        gt(socialGameInvites.expiresAt, new Date()),
      ))
      .orderBy(desc(socialGameInvites.createdAt)).limit(20);
    res.json({ invitations });
  }));
}

export function setSocialPlayerInGame(playerId: string, inGame: boolean): void {
  const entry = presenceByPlayer.get(playerId);
  if (!entry || entry.inGame === inGame) return;
  entry.inGame = inGame;
  void broadcastPresence(playerId)
    .catch((error: unknown) => console.error("[social] Presence broadcast failed:", error));
}

async function broadcastPresence(playerId: string): Promise<void> {
  const entry = presenceByPlayer.get(playerId);
  const state = getPresence(playerId);
  if (state === "offline" && entry?.inGame) return;
  const friendships = await db.select().from(socialFriendships).where(or(
    eq(socialFriendships.playerLow, playerId),
    eq(socialFriendships.playerHigh, playerId),
  ));
  const friendIds = friendships.map((row) => row.playerLow === playerId ? row.playerHigh : row.playerLow);
  if (friendIds.length === 0) return;
  const friends = await db.select({
    playerId: socialProfiles.playerId,
    showPresence: socialProfiles.showPresence,
  }).from(socialProfiles).where(inArray(socialProfiles.playerId, friendIds));
  for (const friend of friends) {
    ioForPresence?.to(`social:${friend.playerId}`).emit("social:presence", {
      playerId,
      status: friend.showPresence ? state : "hidden",
    });
  }
}

let ioForPresence: SocketServer | null = null;
const invitationTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function canChat(playerId: string, otherId: string): Promise<boolean> {
  const [friends, blocked] = await Promise.all([
    areFriends(playerId, otherId),
    isBlockedEitherWay(playerId, otherId),
  ]);
  return canMessage({ samePlayer: playerId === otherId, friends, blocked });
}

async function getOrCreateConversation(first: string, second: string) {
  const [playerLow, playerHigh] = pairFor(first, second);
  await db.insert(socialConversations).values({ playerLow, playerHigh }).onConflictDoNothing();
  const [conversation] = await db.select().from(socialConversations).where(and(
    eq(socialConversations.playerLow, playerLow),
    eq(socialConversations.playerHigh, playerHigh),
  )).limit(1);
  return conversation;
}

async function saveMessage(
  senderId: string,
  receiverId: string,
  content: string,
  idempotencyKey: string,
) {
  const conversation = await getOrCreateConversation(senderId, receiverId);
  if (!conversation) throw new Error("conversation_unavailable");
  const [inserted] = await db.insert(socialMessages).values({
    conversationId: conversation.id,
    senderId,
    idempotencyKey,
    content,
  }).onConflictDoNothing().returning();
  if (!inserted) {
    const [existing] = await db.select().from(socialMessages).where(and(
      eq(socialMessages.senderId, senderId),
      eq(socialMessages.idempotencyKey, idempotencyKey),
    )).limit(1);
    if (existing && existing.conversationId !== conversation.id) {
      throw new Error("idempotency_conflict");
    }
    return { conversation, message: existing, duplicate: true };
  }
  await db.update(socialConversations).set({ updatedAt: inserted.createdAt })
    .where(eq(socialConversations.id, conversation.id));
  return { conversation, message: inserted, duplicate: false };
}

export function attachSocialSocket(
  io: SocketServer,
  socket: SocialSocket,
  playerId: string,
  validateRoom: RoomValidation,
  initiallyInGame = false,
): void {
  ioForPresence = io;
  socket.join(`social:${playerId}`);
  const presence = presenceByPlayer.get(playerId) ?? { sockets: new Set<string>(), inGame: initiallyInGame };
  presence.sockets.add(socket.id);
  presenceByPlayer.set(playerId, presence);
  void ensureProfile(playerId, socket.data.displayName)
    .then(() => broadcastPresence(playerId))
    .catch((error: unknown) => console.error("[social] Could not initialize profile:", error));

  const rateLimitSocketEvent = (event: string, limit: number, windowMs: number) => {
    if (!isRateLimited(`socket:${playerId}:${event}`, limit, windowMs)) return true;
    socket.emit("social:error", { code: "rate_limited" });
    return false;
  };

  const createInvite = async (targetId: string, roomCode: string) => {
    if (targetId === playerId || !await canChat(playerId, targetId)) return { error: "contact_not_allowed" };
    if (getPresence(targetId) === "offline") return { error: "player_offline" };
    const [target] = await db.select({ allowGameInvites: socialProfiles.allowGameInvites })
      .from(socialProfiles).where(eq(socialProfiles.playerId, targetId)).limit(1);
    if (!target?.allowGameInvites) return { error: "contact_not_allowed" };
    const roomState = validateRoom(roomCode, targetId);
    if (roomState !== "ok") {
      return { error: roomState === "full" ? "room_full" : roomState === "already_in_match" ? "already_in_match" : "room_not_available" };
    }
    const now = new Date();
    const [pairLow, pairHigh] = pairFor(playerId, targetId);
    await db.update(socialGameInvites).set({ status: "expired" }).where(and(
      eq(socialGameInvites.status, "pending"),
      lte(socialGameInvites.expiresAt, now),
    ));
    const [duplicate] = await db.select().from(socialGameInvites).where(and(
      eq(socialGameInvites.pairLow, pairLow),
      eq(socialGameInvites.pairHigh, pairHigh),
      eq(socialGameInvites.roomCode, roomCode.toUpperCase()),
      eq(socialGameInvites.status, "pending"),
      gt(socialGameInvites.expiresAt, now),
    )).limit(1);
    if (duplicate) return { error: "invite_already_sent" };
    const [invite] = await db.insert(socialGameInvites).values({
      senderId: playerId,
      receiverId: targetId,
      pairLow,
      pairHigh,
      roomCode: roomCode.toUpperCase(),
      expiresAt: new Date(Date.now() + 60_000),
    }).returning();
    const sender = await getPlayerProfile(playerId);
    await createNotification(targetId, "game_invite", playerId, invite.id, { roomCode: invite.roomCode });
    io.to(`social:${targetId}`).emit("social:game_invite", {
      id: invite.id,
      senderId: playerId,
      displayName: sender.displayName,
      roomCode: invite.roomCode,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    });
    const timer = setTimeout(() => {
      void db.update(socialGameInvites).set({ status: "expired" }).where(and(
        eq(socialGameInvites.id, invite.id),
        eq(socialGameInvites.status, "pending"),
      )).catch((error: unknown) => console.error("[social] Invite expiry failed:", error));
      invitationTimers.delete(invite.id);
    }, 60_000);
    invitationTimers.set(invite.id, timer);
    return { inviteId: invite.id };
  };

  socket.on("social:message", async (payload: unknown, ack?: (result: unknown) => void) => {
    if (!rateLimitSocketEvent("message", 30, 60_000)) return;
    const parsed = socketMessageSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: false, error: "invalid_payload" });
      return;
    }
    try {
      if (!await canChat(playerId, parsed.data.playerId)) {
        ack?.({ ok: false, error: "chat_not_allowed" });
        return;
      }
      const saved = await saveMessage(playerId, parsed.data.playerId, parsed.data.content, parsed.data.idempotencyKey);
      if (!saved.message) {
        ack?.({ ok: false, error: "message_unavailable" });
        return;
      }
      const message: SocialMessagePayload = {
        id: saved.message.id,
        conversationId: saved.conversation.id,
        senderId: playerId,
        content: saved.message.content,
        createdAt: saved.message.createdAt.toISOString(),
        readAt: saved.message.readAt?.toISOString() ?? null,
      };
      if (!saved.duplicate) {
        await createNotification(parsed.data.playerId, "message", playerId, saved.message.id, {
          conversationId: saved.conversation.id,
        });
        io.to(`social:${parsed.data.playerId}`).emit("social:new_message", message);
      }
      ack?.({ ok: true, message, duplicate: saved.duplicate });
    } catch (error) {
      console.error("[social] Message persistence failed:", error);
      ack?.({ ok: false, error: "message_unavailable" });
    }
  });

  socket.on("social:typing", async (payload: unknown) => {
    if (!rateLimitSocketEvent("typing", 20, 10_000)) return;
    const parsed = typingSchema.safeParse(payload);
    if (!parsed.success) return;
    try {
      if (await canChat(playerId, parsed.data.playerId)) {
        io.to(`social:${parsed.data.playerId}`).emit("social:typing", { playerId, active: true });
      }
    } catch (error) {
      console.error("[social] Typing authorization failed:", error);
    }
  });

  socket.on("social:typing-stop", async (payload: unknown) => {
    if (!rateLimitSocketEvent("typing-stop", 20, 10_000)) return;
    const parsed = typingSchema.safeParse(payload);
    if (!parsed.success) return;
    try {
      if (await canChat(playerId, parsed.data.playerId)) {
        io.to(`social:${parsed.data.playerId}`).emit("social:typing", { playerId, active: false });
      }
    } catch (error) {
      console.error("[social] Typing-stop authorization failed:", error);
    }
  });

  socket.on("social:read", async (payload: unknown, ack?: (result: unknown) => void) => {
    if (!rateLimitSocketEvent("read", 30, 60_000)) return;
    const parsed = readSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: false, error: "invalid_payload" });
      return;
    }
    try {
      const [conversation] = await db.select().from(socialConversations).where(and(
        eq(socialConversations.id, parsed.data.conversationId),
        or(eq(socialConversations.playerLow, playerId), eq(socialConversations.playerHigh, playerId)),
      )).limit(1);
      if (!conversation) {
        ack?.({ ok: false, error: "conversation_not_found" });
        return;
      }
      const otherId = conversation.playerLow === playerId ? conversation.playerHigh : conversation.playerLow;
      if (!await canChat(playerId, otherId)) {
        ack?.({ ok: false, error: "chat_not_allowed" });
        return;
      }
      const readAt = new Date();
      const readMessages = await db.update(socialMessages).set({ readAt }).where(and(
        eq(socialMessages.conversationId, conversation.id),
        ne(socialMessages.senderId, playerId),
        isNull(socialMessages.readAt),
      )).returning({ id: socialMessages.id });
      if (readMessages.length > 0) {
        await db.update(socialNotifications).set({ readAt }).where(and(
          eq(socialNotifications.playerId, playerId),
          eq(socialNotifications.type, "message"),
          inArray(socialNotifications.entityId, readMessages.map((message) => message.id)),
          isNull(socialNotifications.readAt),
        ));
        io.to(`social:${playerId}`).emit("social:notification_read", {
          conversationId: conversation.id,
        });
      }
      io.to(`social:${otherId}`).emit("social:read_receipt", {
        conversationId: conversation.id,
        readerId: playerId,
        readAt: readAt.toISOString(),
      });
      ack?.({ ok: true, readAt: readAt.toISOString() });
    } catch (error) {
      console.error("[social] Mark-read failed:", error);
      ack?.({ ok: false, error: "social_unavailable" });
    }
  });

  socket.on("social:game_invite", async (payload: unknown, ack?: (result: unknown) => void) => {
    if (!rateLimitSocketEvent("invite", 5, 60_000)) return;
    const parsed = inviteSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: false, error: "invalid_payload" });
      return;
    }
    try {
      const result = await createInvite(parsed.data.playerId, parsed.data.roomCode);
      ack?.("error" in result ? { ok: false, error: result.error } : { ok: true, ...result });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        ack?.({ ok: false, error: "invite_already_sent" });
        return;
      }
      console.error("[social] Game invitation failed:", error);
      ack?.({ ok: false, error: "social_unavailable" });
    }
  });

  socket.on("social:game_invite:respond", async (payload: unknown, ack?: (result: unknown) => void) => {
    if (!rateLimitSocketEvent("invite-response", 10, 60_000)) return;
    const parsed = invitationResponseSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: false, error: "invalid_payload" });
      return;
    }
    try {
    const now = new Date();
    await db.update(socialGameInvites).set({ status: "expired" }).where(and(
      eq(socialGameInvites.receiverId, playerId),
      eq(socialGameInvites.status, "pending"),
      lte(socialGameInvites.expiresAt, now),
    ));
    const [invite] = await db.select().from(socialGameInvites).where(and(
      eq(socialGameInvites.id, parsed.data.inviteId),
      eq(socialGameInvites.receiverId, playerId),
      eq(socialGameInvites.status, "pending"),
      gt(socialGameInvites.expiresAt, now),
    )).limit(1);
    if (!invite || await isBlockedEitherWay(playerId, invite.senderId)) {
      ack?.({ ok: false, error: "invite_expired" });
      return;
    }
    if (parsed.data.accept) {
      const roomState = validateRoom(invite.roomCode, playerId);
      const [targetPrivacy] = await db.select({
        allowGameInvites: socialProfiles.allowGameInvites,
      }).from(socialProfiles).where(eq(socialProfiles.playerId, playerId)).limit(1);
      if (!targetPrivacy?.allowGameInvites) {
        await db.update(socialGameInvites).set({ status: "expired" }).where(eq(socialGameInvites.id, invite.id));
        ack?.({ ok: false, error: "contact_not_allowed" });
        return;
      }
      if (roomState !== "ok") {
        await db.update(socialGameInvites).set({ status: "expired" }).where(eq(socialGameInvites.id, invite.id));
        ack?.({
          ok: false,
          error: roomState === "full" ? "room_full" : roomState === "already_in_match" ? "already_in_match" : "room_not_available",
        });
        return;
      }
    }
    const status = parsed.data.accept ? "accepted" : "declined";
    const [updatedInvite] = await db.update(socialGameInvites).set({ status }).where(and(
      eq(socialGameInvites.id, invite.id),
      eq(socialGameInvites.status, "pending"),
    )).returning({ id: socialGameInvites.id });
    if (!updatedInvite) {
      ack?.({ ok: false, error: "invite_expired" });
      return;
    }
    const timer = invitationTimers.get(invite.id);
    if (timer) clearTimeout(timer);
    invitationTimers.delete(invite.id);
    await createNotification(invite.senderId, "invite_response", playerId, invite.id, {
      status,
      roomCode: invite.roomCode,
    });
    io.to(`social:${invite.senderId}`).emit("social:invite_response", {
      inviteId: invite.id,
      playerId,
      status,
      roomCode: invite.roomCode,
    });
    ack?.({
      ok: true,
      status,
      ...(parsed.data.accept ? { roomCode: invite.roomCode } : {}),
    });
    } catch (error) {
      console.error("[social] Invitation response failed:", error);
      ack?.({ ok: false, error: "social_unavailable" });
    }
  });

  socket.on("disconnect", () => {
    const current = presenceByPlayer.get(playerId);
    current?.sockets.delete(socket.id);
    if (current && current.sockets.size === 0) {
      presenceByPlayer.delete(playerId);
    }
    void broadcastPresence(playerId)
      .catch((error: unknown) => console.error("[social] Presence update failed:", error));
  });
}

export function initializeSocial(io: SocketServer, httpServer: import("node:http").Server): void {
  ioForPresence = io;
  void db.update(socialGameInvites).set({ status: "expired" }).where(and(
    eq(socialGameInvites.status, "pending"),
    lte(socialGameInvites.expiresAt, new Date()),
  )).catch((error: unknown) => console.error("[social] Startup invite cleanup failed:", error));
  const cleanup = setNodeInterval(() => {
    const cutoff = Date.now() - 10 * 60_000;
    for (const [key, bucket] of rateBuckets) {
      if (bucket.startedAt < cutoff) rateBuckets.delete(key);
    }
  }, 60_000);
  httpServer.once("close", () => {
    clearNodeInterval(cleanup);
    for (const timer of invitationTimers.values()) clearTimeout(timer);
    invitationTimers.clear();
    presenceByPlayer.clear();
    ioForPresence = null;
  });
}
