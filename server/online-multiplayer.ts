import {isEntryFee,isQueueFee} from "../shared/coin-entry";
import {reserveCoinEntry,settleCoinEntry,refundInterruptedCoinEntries} from "./coin-entry-ledger";
import {coinDatabase} from "./coin-entry-postgres";
import { createRoomVoice } from "./room-voice";
import { safeOnlineDisplayName } from "./online-display-name";
import { PublicMatchmaking,getPublicMatchBaseRewards } from "./public-matchmaking";
import { PUBLIC_QUEUE_MODES,isPublicQueueMode,publicQueueSize } from "../shared/public-game";
import { friendRoomSettingsSchema, roomTeamAssignment, roomTeamScores, roomTeamsValid, isQuickMessageId, type TeamId, type QuickRoomMessage } from "../shared/friends-room";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { clearInterval as clearNodeInterval, setInterval as setNodeInterval } from "node:timers";
import type { Express } from "express";
import type { Server as HttpServer } from "node:http";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { Server as SocketServer, type Socket } from "socket.io";
import {
  onlineDailyMatchCounters,
  onlineGuestSessions,
  onlineGuestWallets,
  onlineMatchFlags,
  onlineMatchParticipants,
  onlineMatches,
  onlineRewardClaims,
} from "@shared/schema";
import { db } from "./db";
import {
  applyDailyRewardLimit,
  createRoomCode,
  getRandomLetter,
  scoreOnlineRound,
  type OnlineMode,
  type OnlinePlayerAnswer,
  type OnlineRoomSettings,
} from "./online-game-logic";
import { GAME_CATEGORIES } from "../constants/i18n";
import { attachSocialSocket, initializeSocial, setSocialPlayerInGame } from "./social";

const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const READY_TIMEOUT_MS = 30_000;
const RECONNECT_GRACE_MS = 30_000;
const COUNTDOWN_SECONDS = 3;
const RESULT_DISPLAY_MS = 4_000;
const MAX_SOCKET_PAYLOAD_BYTES = 16 * 1024;
const displayNameSchema = z.string().trim().min(1).max(24);
const roomSettingsSchema=friendRoomSettingsSchema;
const matchIdSchema = z.string().uuid();
const matchEventSchema = z.object({ matchId: matchIdSchema }).strict();
const submitSchema = z.object({
  matchId: matchIdSchema,
  answers: z.record(z.string().max(80)),
}).strict();
const roomJoinSchema = z.object({ roomCode: z.string().trim().regex(/^[A-HJ-NP-Z2-9]{6}$/i) }).strict();
const settingsEventSchema = z.object({
  roomCode: z.string().trim().regex(/^[A-HJ-NP-Z2-9]{6}$/i),
  settings: roomSettingsSchema,
}).strict();

type OnlineSocket = Socket & { data: { playerId?: string; displayName?: string } };
type PlayerSlot = {
  teamId?:TeamId|null;
  id: string;
  name: string;
  socketId: string | null;
  ready: boolean;
  score: number;
  abandoned: boolean;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
};
type QueueEntry = { player: PlayerSlot; queuedAt: number; timeout: ReturnType<typeof setTimeout> };
type MatchPhase = "waiting" | "match_found" | "countdown" | "playing" | "results" | "finished" | "settling";
type FinalMatchPlayer = {
  playerId: string;
  name: string;
  score: number;
  rank: number;
  abandoned: boolean;
  coinsAwarded: number;
  walletBalance: number;
};
type MatchState = {
  messages:QuickRoomMessage[];
  id: string;
  mode: OnlineMode;
  phase: MatchPhase;
  roomCode: string | null;
  hostId: string;
  settings: OnlineRoomSettings;
  players: PlayerSlot[];
  round: number;
  letter: string;
  deadline: number;
  answers: Map<string, OnlinePlayerAnswer>;
  roundResults: { round: number; letter: string; results: ReturnType<typeof scoreOnlineRound> }[];
  timer: ReturnType<typeof setTimeout> | null;
  readyTimer: ReturnType<typeof setTimeout> | null;
  countdownTimer: ReturnType<typeof setInterval> | null;
  resultsTimer: ReturnType<typeof setTimeout> | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  startedAt: number;
  finalResults: FinalMatchPlayer[] | null;
};

const waitingQueue = new PublicMatchmaking<QueueEntry>();
const activeMatchByPlayer = new Map<string, MatchState>();
const finishedMatchByPlayer = new Map<string, MatchState>();
const matchesById = new Map<string, MatchState>();
const roomsByCode = new Map<string, MatchState>();
const socketByPlayer = new Map<string, string>();
const socketsByPlayer = new Map<string, Set<string>>();
const rateBuckets = new Map<string, { startedAt: number; count: number }>();

const emptySettings: OnlineRoomSettings = {
  maxPlayers: 2,
  rounds: 5,
  secondsPerRound: 60,
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getClientAddress(socket: Socket): string {
  return socket.handshake.address || "unknown";
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

function cleanRateBuckets(): void {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [key, bucket] of rateBuckets) {
    if (bucket.startedAt < cutoff) rateBuckets.delete(key);
  }
}

function safeDisplayName(value: unknown): string {
  const parsed = displayNameSchema.safeParse(value);
  if (!parsed.success) return "لاعب";
  return parsed.data.replace(/[<>]/g, "");
}

function getPlayer(match: MatchState, playerId: string): PlayerSlot | undefined {
  return match.players.find((player) => player.id === playerId);
}

function snapshot(match: MatchState) {
  return {
    matchId: match.id,
    mode: match.mode,
    phase: match.phase,
    roomCode: match.roomCode,
    hostId: match.hostId,
    settings: match.settings,
    queueMode:match.mode==="random"?match.settings.matchmakingMode??"solo":undefined,
    round: match.round,
    totalRounds: match.settings.rounds,
    letter: match.letter,
    deadline: match.deadline,
    teams:roomTeamScores(match.players,match.settings.teamMode),
    messages:match.messages,
    players: match.players.map((player) => ({
      id: player.id,
      teamId:player.teamId??null,
      name: player.name,
      ready: player.ready,
      host: player.id === match.hostId,
      connected: player.socketId !== null,
      abandoned:player.abandoned,
      score: player.score,
    })),
  };
}

function emitRoomUpdate(io: SocketServer, match: MatchState): void {
  if(match.mode==="private"&&match.phase==="waiting"){const assignments=roomTeamAssignment(match.players,match.settings.teamMode);for(const player of match.players)player.teamId=assignments.get(player.id); }
  io.to(match.id).emit("room:update", snapshot(match));
}

function emitError(socket: Socket, code: string): void {
  socket.emit("online:error", { code });
}

function clearMatchTimers(match: MatchState): void {
  if (match.timer) clearTimeout(match.timer);
  if (match.readyTimer) clearTimeout(match.readyTimer);
  if (match.countdownTimer) clearInterval(match.countdownTimer);
  if (match.resultsTimer) clearTimeout(match.resultsTimer);
  if (match.cleanupTimer) clearTimeout(match.cleanupTimer);
  for (const player of match.players) {
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
  }
  match.timer = null;
  match.readyTimer = null;
  match.countdownTimer = null;
  match.resultsTimer = null;
  match.cleanupTimer = null;
}

function notifyPublicQueues(io:SocketServer){
 for(const mode of PUBLIC_QUEUE_MODES){const entries=waitingQueue.entriesFor(mode);for(const [id,entry] of entries)for(const sid of socketsByPlayer.get(id)??new Set(entry.player.socketId?[entry.player.socketId]:[]))io.to(sid).emit("match:queued",{mode,entryFee:waitingQueue.feeFor(id)??0,players:waitingQueue.entriesFor(mode,waitingQueue.feeFor(id)??0).length,needed:publicQueueSize(mode)});}
}
function removeFromQueue(playerId: string): boolean {
  const entry = waitingQueue.cancel(playerId);
  if (!entry) return false;
  clearTimeout(entry.timeout);
  return true;
}

function releaseMatchPlayers(match: MatchState): void {
  for (const player of match.players) {
    if (activeMatchByPlayer.get(player.id) === match) activeMatchByPlayer.delete(player.id);
  }
}

function deleteMatch(match: MatchState): void {
  clearMatchTimers(match);
  releaseMatchPlayers(match);
  for (const player of match.players) {
    if (finishedMatchByPlayer.get(player.id) === match) finishedMatchByPlayer.delete(player.id);
  }
  matchesById.delete(match.id);
  if (match.roomCode && roomsByCode.get(match.roomCode) === match) {
    roomsByCode.delete(match.roomCode);
  }
}

function makePlayer(id: string, name: string, socketId: string): PlayerSlot {
  return {
    id,
    name: safeDisplayName(name),
    socketId,
    ready: false,
    score: 0,
    abandoned: false,
    disconnectTimer: null,
  };
}

function makeMatch(mode: OnlineMode, host: PlayerSlot, settings: OnlineRoomSettings): MatchState {
  const match: MatchState = {
    id: randomUUID(),
    messages:[],
    mode,
    phase: mode === "random" ? "match_found" : "waiting",
    roomCode: null,
    hostId: host.id,
    settings,
    players: [host],
    round: 0,
    letter: "",
    deadline: 0,
    answers: new Map(),
    roundResults: [],
    timer: null,
    readyTimer: null,
    countdownTimer: null,
    resultsTimer: null,
    cleanupTimer: null,
    startedAt: 0,
    finalResults: null,
  };
  matchesById.set(match.id, match);
  activeMatchByPlayer.set(host.id, match);
  return match;
}

function attachPlayer(io: SocketServer, match: MatchState, player: PlayerSlot, socket: OnlineSocket): void {
  player.socketId = socket.id;
  socket.data.playerId = player.id;
  socket.join(match.id);
  socketByPlayer.set(player.id, socket.id);
}

async function persistMatchStart(match: MatchState): Promise<void> {
  if(match.players.some(p=>!p.socketId||p.abandoned))throw Error("players_not_ready");
  if(match.mode==="random"&&isEntryFee(match.settings.entryFee)){await reserveCoinEntry(coinDatabase,match);return;}
  await db.transaction(async (tx) => {
    await tx.insert(onlineMatches).values({
      id: match.id,
      mode: match.mode,
      status: "active",
      settings: match.settings,
    });
    await tx.insert(onlineMatchParticipants).values(
      match.players.map((player) => ({
        matchId: match.id,
        playerId: player.id,
        displayName: player.name,
        active: true,
      })),
    );
  });
}

async function persistAndPayMatch(match: MatchState, forfeitedPlayerId?: string): Promise<FinalMatchPlayer[]> {
  let priorScore: number | null = null;
  let priorRank = 0;
  const results = [...match.players]
    .sort((a, b) => Number(a.abandoned)-Number(b.abandoned)||b.score - a.score)
    .map((player, index) => {
      if (priorScore !== player.score) priorRank = index + 1;
      priorScore = player.score;
      return {
        playerId: player.id,
        name: player.name,
        score: player.score,
        rank:match.settings.teamMode==="duo"?roomTeamScores(match.players,"duo").find(team=>team.playerIds.includes(player.id))!.rank:player.abandoned?match.players.length:priorRank,
        abandoned: player.abandoned,
      };
    }).sort((a,b)=>a.rank-b.rank||b.score-a.score);

  if(match.mode==="random"&&isEntryFee(match.settings.entryFee)){
    const payments=await settleCoinEntry(coinDatabase,match,{rounds:match.roundResults,final:results,forfeitedPlayerId:forfeitedPlayerId??null});
    return results.map(result=>({...result,coinsAwarded:payments.get(result.playerId)?.amount??0,walletBalance:payments.get(result.playerId)?.balance??0}));
  }
  const payouts = match.mode === "random"
    ? getPublicMatchBaseRewards(match.players,match.settings.matchmakingMode??"solo")
    : new Map(match.players.map((player) => [player.id, 0]));
  const rewardDate = new Date().toISOString().slice(0, 10);
  const wallets = new Map<string, { coinsAwarded: number; balance: number }>();

  await db.transaction(async (tx) => {
    if (match.mode === "random") {
      for (const player of match.players) {
        await tx.insert(onlineGuestWallets).values({ playerId: player.id }).onConflictDoNothing();

        const [counter] = await tx.insert(onlineDailyMatchCounters).values({
          playerId: player.id,
          rewardDate,
          completedMatches: 1,
        }).onConflictDoUpdate({
          target: [onlineDailyMatchCounters.playerId, onlineDailyMatchCounters.rewardDate],
          set: {
            completedMatches: sql`${onlineDailyMatchCounters.completedMatches} + 1`,
          },
        }).returning({ completedMatches: onlineDailyMatchCounters.completedMatches });

        const matchCountBeforeThisOne = counter.completedMatches - 1;
        const baseReward = payouts.get(player.id) ?? 0;
        const amount = player.abandoned
          ? 0
          : applyDailyRewardLimit(baseReward, matchCountBeforeThisOne);

        const [claim] = await tx.insert(onlineRewardClaims).values({
          matchId: match.id,
          playerId: player.id,
          rewardType: "random_match",
          amount,
          rewardDate,
        }).onConflictDoNothing().returning({ id: onlineRewardClaims.id });

        if (claim && amount > 0) {
          const [wallet] = await tx.update(onlineGuestWallets)
            .set({ coins: sql`${onlineGuestWallets.coins} + ${amount}`, updatedAt: new Date() })
            .where(eq(onlineGuestWallets.playerId, player.id))
            .returning({ coins: onlineGuestWallets.coins });
          wallets.set(player.id, { coinsAwarded: amount, balance: wallet.coins });
        } else {
          const [wallet] = await tx.select({ coins: onlineGuestWallets.coins })
            .from(onlineGuestWallets)
            .where(eq(onlineGuestWallets.playerId, player.id))
            .limit(1);
          wallets.set(player.id, { coinsAwarded: 0, balance: wallet?.coins ?? 0 });
        }
      }
    }

    await tx.update(onlineMatches)
      .set({
        status: "completed",
        results: { rounds: match.roundResults, final: results, forfeitedPlayerId: forfeitedPlayerId ?? null },
        completedAt: new Date(),
      })
      .where(eq(onlineMatches.id, match.id));

    for (const result of results) {
      await tx.update(onlineMatchParticipants)
        .set({
          score: result.score,
          active: false,
          abandoned: result.abandoned,
          finalRank: result.rank,
        })
        .where(and(
          eq(onlineMatchParticipants.matchId, match.id),
          eq(onlineMatchParticipants.playerId, result.playerId),
        ));
    }

    if (match.mode === "random" && Date.now() - match.startedAt < 25_000) {
      for (const player of match.players) {
        await tx.insert(onlineMatchFlags).values({
          matchId: match.id,
          playerId: player.id,
          reason: "unusually_fast_match",
          details: { durationMs: Date.now() - match.startedAt },
        });
      }
    }

    if (match.mode === "random" && match.players.length === 2) {
      const since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      const priorMatches = await tx.select({ matchId: onlineMatchParticipants.matchId })
        .from(onlineMatchParticipants)
        .innerJoin(onlineMatches, eq(onlineMatches.id, onlineMatchParticipants.matchId))
        .where(and(
          eq(onlineMatchParticipants.playerId, match.players[0].id),
          eq(onlineMatches.mode, "random"),
          eq(onlineMatches.status, "completed"),
          gte(onlineMatches.completedAt, since),
        ));
      if (priorMatches.length > 0) {
        const repeatedPairs = await tx.select({ matchId: onlineMatchParticipants.matchId })
          .from(onlineMatchParticipants)
          .where(and(
            eq(onlineMatchParticipants.playerId, match.players[1].id),
            inArray(onlineMatchParticipants.matchId, priorMatches.map((row) => row.matchId)),
          ));
        if (repeatedPairs.length >= 2) {
          for (const player of match.players) {
            await tx.insert(onlineMatchFlags).values({
              matchId: match.id,
              playerId: player.id,
              reason: "repeated_opponent_pairing",
              details: { recentPairMatches: repeatedPairs.length + 1 },
            });
          }
        }
        for (const player of match.players.filter((candidate) => candidate.abandoned)) {
          const recentForfeits = await tx.select({ matchId: onlineMatchParticipants.matchId })
            .from(onlineMatchParticipants)
            .innerJoin(onlineMatches, eq(onlineMatches.id, onlineMatchParticipants.matchId))
            .where(and(
              eq(onlineMatchParticipants.playerId, player.id),
              eq(onlineMatchParticipants.abandoned, true),
              eq(onlineMatches.mode, "random"),
              eq(onlineMatches.status, "completed"),
              gte(onlineMatches.completedAt, since),
            ));
          if (recentForfeits.length >= 2) {
            await tx.insert(onlineMatchFlags).values({
              matchId: match.id,
              playerId: player.id,
              reason: "repeated_forfeits",
              details: { recentForfeits: recentForfeits.length + 1 },
            });
          }
        }
      }
    }
  });

  return results.map((result) => ({
    ...result,
    coinsAwarded: wallets.get(result.playerId)?.coinsAwarded ?? 0,
    walletBalance: wallets.get(result.playerId)?.balance ?? 0,
  }));
}

function beginRound(io: SocketServer, match: MatchState): void {
  if (match.phase === "finished" || match.phase === "settling") return;
  match.phase = "playing";
  for (const player of match.players) setSocialPlayerInGame(player.id, true);
  match.round += 1;
  match.letter = getRandomLetter();
  match.answers.clear();
  match.deadline = Date.now() + match.settings.secondsPerRound * 1000;
  match.timer = setTimeout(() => {
    void finishRound(io, match);
  }, match.settings.secondsPerRound * 1000);
  io.to(match.id).emit("match:round", {
    ...snapshot(match),
    deadline: match.deadline,
    categories: GAME_CATEGORIES,
  });
}

async function finishMatch(
  io: SocketServer,
  match: MatchState,
  forfeitedPlayerId?: string,
): Promise<void> {
  if (match.phase === "settling" || match.phase === "finished") return;
  clearMatchTimers(match);
  match.phase = "settling";
  try {
    const finalPlayers = await persistAndPayMatch(match, forfeitedPlayerId);
    match.phase = "finished";
    for (const player of match.players) setSocialPlayerInGame(player.id, false);
    match.finalResults = finalPlayers;
    releaseMatchPlayers(match);
    for (const player of match.players) finishedMatchByPlayer.set(player.id, match);
    const publicPlayers = finalPlayers.map(({ walletBalance: _walletBalance, ...player }) => player);
    io.to(match.id).emit("match:finished", {
      matchId: match.id,
      mode: match.mode,
      entryFee:match.settings.entryFee??0,
      teams:roomTeamScores(match.players,match.settings.teamMode),
      players: publicPlayers,
      forfeitedPlayerId: forfeitedPlayerId ?? null,
      coinsAwarded: match.mode === "private" ? 0 : undefined,
    });
    for (const player of finalPlayers) {
      const socketId = getPlayer(match, player.playerId)?.socketId;
      if (socketId) {
        io.to(socketId).emit("match:wallet", {
          matchId: match.id,
          entryFee:match.settings.entryFee??0,
          coinsAwarded: player.coinsAwarded,
          balance: player.walletBalance,
        });
      }
    }
    emitRoomUpdate(io, match);
    match.cleanupTimer = setTimeout(() => deleteMatch(match), match.mode === "private" ? 15 * 60_000 : 60_000);
  } catch (error) {
    if(isEntryFee(match.settings.entryFee)){
      console.error("[online] Entry payout pending; keeping the pot reserved:",error);
      io.to(match.id).emit("online:error",{code:"settlement_pending"});emitRoomUpdate(io,match);
      match.cleanupTimer=setTimeout(()=>{match.phase="results";void finishMatch(io,match,forfeitedPlayerId);},5000);return;
    }
    console.error("[online] Match settlement failed; canceling without rewards:", error);
    await db.update(onlineMatches)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(and(eq(onlineMatches.id, match.id), eq(onlineMatches.status, "active")))
      .catch((updateError: unknown) => {
        console.error("[online] Failed to mark match cancelled:", updateError);
      });
    match.phase = "finished";
    for (const player of match.players) setSocialPlayerInGame(player.id, false);
    releaseMatchPlayers(match);
    io.to(match.id).emit("match:cancelled", { reason: "settlement_failed" });
    emitRoomUpdate(io, match);
    match.cleanupTimer = setTimeout(() => deleteMatch(match), 60_000);
  }
}

async function finishRound(io: SocketServer, match: MatchState): Promise<void> {
  if (match.phase !== "playing") return;
  if (Date.now() < match.deadline && match.players.filter(player=>!player.abandoned).every((player) => match.answers.has(player.id))) {
    // All players submitted; finish immediately.
  } else if (Date.now() < match.deadline) {
    return;
  }
  if (match.timer) clearTimeout(match.timer);
  const results = scoreOnlineRound(
    match.players.map((player) => ({
      id: player.id,
      name: player.name,
      answers: match.answers.get(player.id) ?? {},
    })),
    match.letter,
  );
  for (const result of results) {
    const player = getPlayer(match, result.playerId);
    if (player) player.score += result.roundTotal;
  }
  match.roundResults.push({ round: match.round, letter: match.letter, results });
  match.phase = "results";
  io.to(match.id).emit("match:round-results", {
    matchId: match.id,
    round: match.round,
    letter: match.letter,
    teams:roomTeamScores(match.players,match.settings.teamMode),
    results: results.map((result) => ({
      ...result,
      totalScore: getPlayer(match, result.playerId)?.score ?? result.roundTotal,
    })),
  });
  match.resultsTimer = setTimeout(() => {
    if (match.round >= match.settings.rounds) {
      void finishMatch(io, match);
    } else {
      beginRound(io, match);
    }
  }, RESULT_DISPLAY_MS);
}

function beginCountdown(io: SocketServer, match: MatchState): void {
  if (match.phase === "countdown") return;
  if (match.readyTimer) clearTimeout(match.readyTimer);
  match.phase = "countdown";
  let count = COUNTDOWN_SECONDS;
  io.to(match.id).emit("match:countdown", { count, matchId: match.id });
  match.countdownTimer = setInterval(() => {
    count -= 1;
    if (count > 0) {
      io.to(match.id).emit("match:countdown", { count, matchId: match.id });
      return;
    }
    if (match.countdownTimer) clearInterval(match.countdownTimer);
    match.countdownTimer = null;
    void (async () => {
      try {
        await persistMatchStart(match);
        for(const player of match.players){try{const [wallet]=await db.select({coins:onlineGuestWallets.coins}).from(onlineGuestWallets).where(eq(onlineGuestWallets.playerId,player.id)).limit(1);for(const sid of socketsByPlayer.get(player.id)??[])io.to(sid).emit("match:balance",{balance:wallet?.coins??0});}catch{}}
        match.startedAt = Date.now();
        beginRound(io, match);
      } catch (error) {
        console.error("[online] Could not reserve match players:", error);
        io.to(match.id).emit("match:cancelled", { reason: error instanceof Error&&error.message==="insufficient_online_coins"?"insufficient_online_coins":"active_match_conflict" });
        deleteMatch(match);
      }
    })();
  }, 1000);
}

function cancelUnreadyMatch(io: SocketServer, match: MatchState, reason="ready_timeout"): void {
  io.to(match.id).emit("match:cancelled", { reason });
  deleteMatch(match);
}

function startReadyTimeout(io: SocketServer, match: MatchState): void {
  match.readyTimer = setTimeout(() => {
    if (match.phase === "match_found" || match.phase === "waiting") {
      cancelUnreadyMatch(io, match);
    }
  }, READY_TIMEOUT_MS);
}

function makeRoomSnapshot(match: MatchState) {
  return snapshot(match);
}

function setRoomHost(match: MatchState): void {
  const nextHost = match.players.find((player) => player.socketId !== null) ?? match.players[0];
  if (nextHost) match.hostId = nextHost.id;
}

function markDisconnected(io: SocketServer, playerId: string, socketId: string): void {
  const match = activeMatchByPlayer.get(playerId);
  if (!match) return;
  const player = getPlayer(match, playerId);
  if (!player || player.socketId !== socketId) return;
  player.socketId = null;
  socketByPlayer.delete(playerId);
  io.to(match.id).emit("match:reconnecting", {
    playerId,
    deadline: Date.now() + RECONNECT_GRACE_MS,
  });
  emitRoomUpdate(io, match);
  player.disconnectTimer = setTimeout(() => {
    if (player.socketId !== null || match.phase === "finished" || match.phase === "settling") return;
    player.abandoned = true;
    if (match.mode === "private" && match.phase === "waiting") {
      match.players = match.players.filter((candidate) => candidate.id !== playerId);
      activeMatchByPlayer.delete(playerId);
      if (playerId === match.hostId) setRoomHost(match);
      if (match.players.length === 0) {
        deleteMatch(match);
      } else {
        emitRoomUpdate(io, match);
      }
      return;
    }
    if(match.mode==="random"&&match.settings.matchmakingMode==="four"&&isEntryFee(match.settings.entryFee)&&match.players.filter(p=>!p.abandoned).length>1){emitRoomUpdate(io,match);return;}
    if(match.startedAt===0){cancelUnreadyMatch(io,match);return;}
    void finishMatch(io, match, playerId);
  }, RECONNECT_GRACE_MS);
}

async function createGuestSession(app: Express): Promise<void> {
  app.post("/api/online/guest-session", async (req, res) => {
    cleanRateBuckets();
    const address = req.ip || req.socket.remoteAddress || "unknown";
    if (isRateLimited(`guest:${address}`, 30, 60_000)) {
      return res.status(429).json({ error: "rate_limited" });
    }
    if (req.body && Object.keys(req.body).length > 0) {
      return res.status(400).json({ error: "unexpected_payload" });
    }
    const token = randomBytes(32).toString("base64url");
    const playerId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    try {
      await db.insert(onlineGuestSessions).values({
        id: playerId,
        tokenHash: hashToken(token),
        expiresAt,
      });
      return res.status(201).json({ token, expiresAt: expiresAt.toISOString() });
    } catch (error) {
      console.error("[online] Guest session creation failed:", error);
      return res.status(503).json({ error: "online_unavailable" });
    }
  });

  app.get("/api/online/wallet", async (req, res) => {
    const address = req.ip || req.socket.remoteAddress || "unknown";
    if (isRateLimited(`wallet:${address}`, 60, 60_000)) {
      return res.status(429).json({ error: "rate_limited" });
    }
    const token = req.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{40,128})$/)?.[1];
    if (!token) return res.status(401).json({ error: "unauthorized" });
    try {
      const [session] = await db.select({ id: onlineGuestSessions.id })
        .from(onlineGuestSessions)
        .where(and(
          eq(onlineGuestSessions.tokenHash, hashToken(token)),
          gte(onlineGuestSessions.expiresAt, new Date()),
        ))
        .limit(1);
      if (!session) return res.status(401).json({ error: "unauthorized" });

      const [wallet] = await db.select({ coins: onlineGuestWallets.coins })
        .from(onlineGuestWallets)
        .where(eq(onlineGuestWallets.playerId, session.id))
        .limit(1);
      const claims = await db.select({
        matchId: onlineRewardClaims.matchId,
        amount: onlineRewardClaims.amount,
      })
        .from(onlineRewardClaims)
        .where(and(eq(onlineRewardClaims.playerId, session.id),eq(onlineRewardClaims.rewardType,"random_match")))
        .orderBy(desc(onlineRewardClaims.createdAt))
        .limit(100);
      return res.json({
        coins: wallet?.coins ?? 0,
        entryFees:true,
        claims: claims.filter((claim) => claim.amount > 0),
      });
    } catch (error) {
      console.error("[online] Wallet lookup failed:", error);
      return res.status(503).json({ error: "online_unavailable" });
    }
  });
}

async function cancelInterruptedMatches(): Promise<void> {
  await refundInterruptedCoinEntries(coinDatabase);
  const interrupted = await db.select({ id: onlineMatches.id })
    .from(onlineMatches)
    .where(eq(onlineMatches.status, "active"));
  if (interrupted.length === 0) return;
  await db.transaction(async (tx) => {
    await tx.update(onlineMatches)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(eq(onlineMatches.status, "active"));
    await tx.update(onlineMatchParticipants)
      .set({ active: false })
      .where(eq(onlineMatchParticipants.active, true));
  });
  console.warn(`[online] Cancelled ${interrupted.length} in-memory match(es) left by a server restart; no rewards issued.`);
}

export async function registerOnlineMultiplayer(app: Express, httpServer: HttpServer): Promise<void> {
  await createGuestSession(app);
  try {
    await cancelInterruptedMatches();
  } catch (error) {
    console.error("[online] Could not clean interrupted matches:", error);
    throw error;
  }

  const configuredOrigins = new Set(
    (process.env.ALLOWED_ORIGIN ?? "").split(",").map((origin) => origin.trim()).filter(Boolean),
  );
  if (process.env.RENDER_EXTERNAL_URL) configuredOrigins.add(new URL(process.env.RENDER_EXTERNAL_URL).origin);
  if (process.env.REPLIT_DEV_DOMAIN) configuredOrigins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);

  const io = new SocketServer(httpServer, {
    maxHttpBufferSize: MAX_SOCKET_PAYLOAD_BYTES,
    cors: {
      credentials: true,
      origin(origin, callback) {
        const local = origin?.startsWith("http://localhost:")
          || origin?.startsWith("http://127.0.0.1:");
        const hosted = origin?.endsWith(".replit.app");
        if (!origin || local || hosted || configuredOrigins.has(origin)) {
          callback(null, true);
        } else {
          callback(new Error("origin_not_allowed"), false);
        }
      },
    },
  });
  initializeSocial(io, httpServer);
  const bucketCleanup = setNodeInterval(cleanRateBuckets, 60_000);
  httpServer.once("close", () => clearNodeInterval(bucketCleanup));

  const voice=createRoomVoice(io,(socket,matchId)=>{const room=matchesById.get(matchId),player=room&&getPlayer(room,socket.data.playerId);return !!room&&room.mode==="private"&&!!player&&!player.abandoned&&socket.rooms.has(matchId)&&(activeMatchByPlayer.get(player.id)===room||finishedMatchByPlayer.get(player.id)===room);});
  io.use((socket, next) => {
    const ip = getClientAddress(socket);
    cleanRateBuckets();
    if (isRateLimited(`socket-auth:${ip}`, 60, 60_000)) {
      next(new Error("rate_limited"));
      return;
    }
    const auth = z.object({
      token: z.string().min(40).max(128),
      displayName: displayNameSchema.optional(),
    }).safeParse(socket.handshake.auth);
    if (!auth.success) {
      next(new Error("unauthorized"));
      return;
    }
    void db.select({ id: onlineGuestSessions.id })
      .from(onlineGuestSessions)
      .where(and(
        eq(onlineGuestSessions.tokenHash, hashToken(auth.data.token)),
        gte(onlineGuestSessions.expiresAt, new Date()),
      ))
      .then(async ([session]) => {
        if (!session) {
          next(new Error("unauthorized"));
          return;
        }
        socket.data.playerId = session.id;
        socket.data.displayName = await safeOnlineDisplayName(session.id,safeDisplayName(auth.data.displayName));
        next();
      })
      .catch((error: unknown) => {
        console.error("[online] Socket authentication lookup failed:", error);
        next(new Error("online_unavailable"));
      });
  });

  io.on("connection", (rawSocket) => {
    const socket = rawSocket as OnlineSocket;
    const playerId = socket.data.playerId;
    if (!playerId) {
      socket.disconnect(true);
      return;
    }
    voice.attach(socket,playerId);
    socketByPlayer.set(playerId, socket.id);
    const playerSockets = socketsByPlayer.get(playerId) ?? new Set<string>();
    playerSockets.add(socket.id);
    socketsByPlayer.set(playerId, playerSockets);
    const activeMatch = activeMatchByPlayer.get(playerId);
    attachSocialSocket(io, socket, playerId, (roomCode, invitedPlayerId) => {
      if (activeMatchByPlayer.has(invitedPlayerId)) return "already_in_match";
      const room = roomsByCode.get(roomCode.toUpperCase());
      if (!room || room.mode !== "private") return "not_found";
      if (room.phase !== "waiting") return "not_waiting";
      if (room.players.length >= room.settings.maxPlayers) return "full";
      return "ok";
    }, activeMatch?.phase === "playing");
    socket.emit("session:ready", { playerId, displayName: socket.data.displayName });

    const existingMatch = activeMatchByPlayer.get(playerId) ?? finishedMatchByPlayer.get(playerId);
    if (existingMatch) {
      const player = getPlayer(existingMatch, playerId);
      if (player) {
        if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
        player.disconnectTimer = null;
        attachPlayer(io, existingMatch, player, socket);
        socket.emit("match:restored", {
          ...snapshot(existingMatch),
          roundResults: existingMatch.roundResults.at(-1) ?? null,
        });
        if (existingMatch.phase === "finished" && existingMatch.finalResults) {
          const publicPlayers = existingMatch.finalResults.map(({ walletBalance: _walletBalance, ...result }) => result);
          socket.emit("match:finished", {
            matchId: existingMatch.id,
            mode: existingMatch.mode,
            entryFee:existingMatch.settings.entryFee??0,
            teams:roomTeamScores(existingMatch.players,existingMatch.settings.teamMode),
            players: publicPlayers,
          });
          const ownResult = existingMatch.finalResults.find((result) => result.playerId === playerId);
          if (ownResult) {
            socket.emit("match:wallet", {
              matchId: existingMatch.id,
              entryFee:existingMatch.settings.entryFee??0,
              coinsAwarded: ownResult.coinsAwarded,
              balance: ownResult.walletBalance,
            });
          }
        }
        emitRoomUpdate(io, existingMatch);
      }
    }

    function eventAllowed(event: string, limit: number, windowMs: number): boolean {
      if (!isRateLimited(`event:${playerId}:${event}`, limit, windowMs)) return true;
      emitError(socket, "rate_limited");
      return false;
    }

    function parsePayload<T>(
      schema: z.ZodType<T>,
      payload: unknown,
    ): T | null {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, "invalid_payload");
        return null;
      }
      return parsed.data;
    }

    socket.on("match:find",async(payload?:unknown)=>{
      if(!eventAllowed("match:find",5,60000))return;
      const requested=payload===undefined?"solo":payload&&typeof payload==="object"?(payload as {mode?:unknown}).mode:undefined;
      const entryFee=payload&&typeof payload==="object"?(payload as {entryFee?:unknown}).entryFee??0:0;
      if(!isPublicQueueMode(requested)||!isQueueFee(entryFee)){emitError(socket,"invalid_payload");return;}
      if(entryFee>0){try{const [wallet]=await db.select({coins:onlineGuestWallets.coins}).from(onlineGuestWallets).where(eq(onlineGuestWallets.playerId,playerId)).limit(1);if((wallet?.coins??0)<entryFee){emitError(socket,"insufficient_online_coins");return;}}catch{emitError(socket,"online_unavailable");return;}}
      if(!socket.connected)return;
      if(activeMatchByPlayer.has(playerId)){emitError(socket,"already_in_match");return;}
      const prior=waitingQueue.modeFor(playerId);if(prior&&(prior!==requested||waitingQueue.feeFor(playerId)!==entryFee)){emitError(socket,"already_in_queue");return;}
      if(prior){notifyPublicQueues(io);return;}
      for(const [queuedId,entry] of waitingQueue.entriesList()){if(!entry.player.socketId||!io.sockets.sockets.get(entry.player.socketId)?.connected)removeFromQueue(queuedId);}
      const currentEntry:QueueEntry={player:makePlayer(playerId,socket.data.displayName??"",socket.id),queuedAt:Date.now(),timeout:setTimeout(()=>{removeFromQueue(playerId);for(const sid of socketsByPlayer.get(playerId)??[])io.to(sid).emit("match:queue-timeout");notifyPublicQueues(io);},120000)};
      const result=waitingQueue.enqueue(playerId,currentEntry,requested,entryFee);
      if(result.status!=="matched"){notifyPublicQueues(io);return;}
      const settings:OnlineRoomSettings={...emptySettings,maxPlayers:publicQueueSize(requested),teamMode:requested==="team"?"duo":"solo",matchmakingMode:requested,entryFee};
      const players=result.entries.map(([,entry])=>{clearTimeout(entry.timeout);return entry.player;});
      const match=makeMatch("random",players[0],settings);match.players=players;
      const assignments=roomTeamAssignment(players,settings.teamMode);
      for(const player of players){player.teamId=assignments.get(player.id);activeMatchByPlayer.set(player.id,match);const member=io.sockets.sockets.get(player.socketId!);if(member)attachPlayer(io,match,player,member as OnlineSocket);for(const sid of socketsByPlayer.get(player.id)??[])io.sockets.sockets.get(sid)?.join(match.id);}
      startReadyTimeout(io,match);io.to(match.id).emit("match:found",snapshot(match));notifyPublicQueues(io);
    });

    socket.on("match:cancel-search", () => {
      if (!eventAllowed("match:cancel-search", 10, 60_000)) return;
      removeFromQueue(playerId);for(const sid of socketsByPlayer.get(playerId)??[])io.to(sid).emit("match:search-cancelled");
      notifyPublicQueues(io);
    });

    socket.on("match:decline",(payload:unknown)=>{
      const data=parsePayload(matchEventSchema,payload);if(!data)return;const match=matchesById.get(data.matchId);
      if(!match||match.mode!=="random"||match.phase!=="match_found"||!getPlayer(match,playerId))return;
      cancelUnreadyMatch(io,match,"match_cancelled");
    });

    socket.on("match:ready", (payload: unknown) => {
      if (!eventAllowed("match:ready", 8, 30_000)) return;
      const data = parsePayload(matchEventSchema, payload);
      if (!data) return;
      const match = matchesById.get(data.matchId);
      const player = match && getPlayer(match, playerId);
      if (!match || !player || match.phase !== "match_found") {
        emitError(socket, "match_not_ready");
        return;
      }
      player.ready = true;
      emitRoomUpdate(io, match);
      if (match.players.length === match.settings.maxPlayers && match.players.every((item) => item.ready&&item.socketId!==null)) {
        beginCountdown(io, match);
      }
    });

    socket.on("room:create", (payload: unknown, ack?: (response: unknown) => void) => {
      if (!eventAllowed("room:create", 3, 60_000)) return;
      const parsedSettings = roomSettingsSchema.safeParse(payload ?? emptySettings);
      if (!parsedSettings.success) {
        emitError(socket, "invalid_settings");
        ack?.({ ok: false, error: "invalid_settings" });
        return;
      }
      if (activeMatchByPlayer.has(playerId)) {
        ack?.({ ok: false, error: "already_in_match" });
        return;
      }
      if(waitingQueue.has(playerId)){ack?.({ok:false,error:"already_in_queue"});return;}
      let code = createRoomCode();
      while (roomsByCode.has(code)) code = createRoomCode();
      const host = makePlayer(playerId, socket.data.displayName ?? "", socket.id);
      const match = makeMatch("private", host, parsedSettings.data);
      match.roomCode = code;
      roomsByCode.set(code, match);
      attachPlayer(io, match, host, socket);
      emitRoomUpdate(io, match);
      ack?.({ ok: true, roomCode: code, match: makeRoomSnapshot(match) });
    });

    socket.on("room:join", (payload: unknown, ack?: (response: unknown) => void) => {
      if (!eventAllowed("room:join", 10, 60_000)) return;
      const data = parsePayload(roomJoinSchema, payload);
      if (!data) {
        ack?.({ ok: false, error: "invalid_room_code" });
        return;
      }
      const code = data.roomCode.toUpperCase();
      const match = roomsByCode.get(code);
      if (!match) {
        ack?.({ ok: false, error: "room_not_found" });
        return;
      }
      const existing = getPlayer(match, playerId);
      if (existing) {
        attachPlayer(io, match, existing, socket);
        ack?.({ ok: true, roomCode: code, match: makeRoomSnapshot(match) });
        return;
      }
      if (match.phase !== "waiting") {
        ack?.({ ok: false, error: "game_in_progress" });
        return;
      }
      if (activeMatchByPlayer.has(playerId)) {
        ack?.({ ok: false, error: "already_in_match" });
        return;
      }
      if (match.players.length >= match.settings.maxPlayers) {
        ack?.({ ok: false, error: "room_full" });
        return;
      }
      if(waitingQueue.has(playerId)){ack?.({ok:false,error:"already_in_queue"});return;}
      const player = makePlayer(playerId, socket.data.displayName ?? "", socket.id);
      match.players.push(player);
      activeMatchByPlayer.set(playerId, match);
      attachPlayer(io, match, player, socket);
      emitRoomUpdate(io, match);
      ack?.({ ok: true, roomCode: code, match: makeRoomSnapshot(match) });
    });

    socket.on("room:update-settings", (payload: unknown) => {
      if (!eventAllowed("room:update-settings", 10, 60_000)) return;
      const data = parsePayload(settingsEventSchema, payload);
      if (!data) return;
      const match = roomsByCode.get(data.roomCode.toUpperCase());
      if (!match || match.hostId !== playerId || match.phase !== "waiting") {
        emitError(socket, "host_only");
        return;
      }
      if (match.players.length > data.settings.maxPlayers) {
        emitError(socket, "capacity_below_current_players");
        return;
      }
      match.settings = data.settings;
      for (const player of match.players) player.ready = false;
      emitRoomUpdate(io, match);
    });

    socket.on("room:quick-message",(payload:unknown)=>{
      if(!eventAllowed("room:quick-message",3,5000))return;
      if(!payload||typeof payload!=="object")return;
      const data=payload as {matchId?:unknown;messageId?:unknown};
      if(typeof data.matchId!=="string"||!isQuickMessageId(data.messageId)){emitError(socket,"invalid_payload");return;}
      const room=matchesById.get(data.matchId),player=room&&getPlayer(room,playerId);
      if(!room||room.mode!=="private"||!player||!socket.rooms.has(room.id)||player.abandoned){emitError(socket,"not_in_room");return;}
      const message:QuickRoomMessage={id:randomUUID(),matchId:room.id,playerId,playerName:player.name,messageId:data.messageId,createdAt:Date.now()};
      room.messages=[...room.messages,message].slice(-20);io.to(room.id).emit("room:quick-message",message);
    });

    socket.on("room:ready", (payload: unknown) => {
      if (!eventAllowed("room:ready", 12, 30_000)) return;
      const data = parsePayload(matchEventSchema, payload);
      if (!data) return;
      const match = matchesById.get(data.matchId);
      const player = match && getPlayer(match, playerId);
      if (!match || match.mode !== "private" || !player || match.phase !== "waiting") {
        emitError(socket, "room_not_waiting");
        return;
      }
      player.ready = !player.ready;
      emitRoomUpdate(io, match);
    });

    socket.on("room:start", (payload: unknown) => {
      if (!eventAllowed("room:start", 5, 60_000)) return;
      const data = parsePayload(matchEventSchema, payload);
      if (!data) return;
      const match = matchesById.get(data.matchId);
      if (!match || match.mode !== "private" || match.hostId !== playerId || match.phase !== "waiting") {
        emitError(socket, "host_only");
        return;
      }
      if(match.settings.teamMode==="duo"&&!roomTeamsValid(match.players)){emitError(socket,"teams_require_four");return;}
      if (match.players.length < 2) {
        emitError(socket, "need_more_players");
        return;
      }
      if (match.players.length > match.settings.maxPlayers) {
        emitError(socket, "room_full");
        return;
      }
      if (!match.players.every((player) => player.ready && player.socketId !== null)) {
        emitError(socket, "players_not_ready");
        return;
      }
      beginCountdown(io, match);
    });

    socket.on("room:rematch", (payload: unknown) => {
      if (!eventAllowed("room:rematch", 3, 60_000)) return;
      const data = parsePayload(matchEventSchema, payload);
      if (!data) return;
      const match = matchesById.get(data.matchId);
      if (!match || match.mode !== "private" || match.hostId !== playerId || match.phase !== "finished") {
        emitError(socket, "host_only");
        return;
      }
      if (match.cleanupTimer) clearTimeout(match.cleanupTimer);
      const previousMatchId = match.id;
      io.to(previousMatchId).emit("room:rematch-started", { roomCode: match.roomCode });
      io.in(previousMatchId).socketsLeave(previousMatchId);
      matchesById.delete(previousMatchId);
      for (const player of match.players.filter((candidate) => candidate.socketId === null)) {
        activeMatchByPlayer.delete(player.id);
      }
      match.players = match.players.filter((player) => player.socketId !== null);
      setRoomHost(match);
      match.id = randomUUID();
      match.phase = "waiting";
      match.round = 0;
      match.letter = "";
      match.deadline = 0;
      match.answers.clear();
      match.roundResults = [];
      match.messages=[];
      match.timer = null;
      match.readyTimer = null;
      match.countdownTimer = null;
      match.resultsTimer = null;
      match.cleanupTimer = null;
      match.startedAt = 0;
      match.finalResults = null;
      for (const player of match.players) {
        player.ready = false;
        player.score = 0;
        player.abandoned = false;
        activeMatchByPlayer.set(player.id, match);
        const playerSocketId = socketByPlayer.get(player.id);
        const playerSocket = playerSocketId ? io.sockets.sockets.get(playerSocketId) : undefined;
        if (playerSocket) playerSocket.join(match.id);
      }
      matchesById.set(match.id, match);
      if (match.roomCode) roomsByCode.set(match.roomCode, match);
      emitRoomUpdate(io, match);
    });

    socket.on("match:submit", (payload: unknown) => {
      if (!eventAllowed("match:submit", 10, 60_000)) return;
      const data = parsePayload(submitSchema, payload);
      if (!data) return;
      const match = matchesById.get(data.matchId);
      if (!match || match.phase !== "playing" || !getPlayer(match, playerId)||getPlayer(match,playerId)!.abandoned) {
        emitError(socket, "match_not_playing");
        return;
      }
      if (Date.now() >= match.deadline) {
        void finishRound(io, match);
        emitError(socket, "round_expired");
        return;
      }
      if (match.answers.has(playerId)) {
        emitError(socket, "already_submitted");
        return;
      }
      const answers: OnlinePlayerAnswer = {};
      for (const category of GAME_CATEGORIES) {
        const answer = data.answers[category];
        if (answer !== undefined) answers[category] = answer.trim();
      }
      match.answers.set(playerId, answers);
      io.to(match.id).emit("match:player-submitted", { playerId });
      if (match.players.every((player) => match.answers.has(player.id))) {
        void finishRound(io, match);
      }
    });

    socket.on("match:forfeit", (payload: unknown) => {
      if (!eventAllowed("match:forfeit", 3, 60_000)) return;
      const data = parsePayload(matchEventSchema, payload);
      if (!data) return;
      const match = matchesById.get(data.matchId);
      const player = match && getPlayer(match, playerId);
      if (!match || !player || match.mode !== "random" || !["playing", "results"].includes(match.phase)) {
        emitError(socket, "cannot_forfeit");
        return;
      }
      player.abandoned = true;
      if(match.settings.matchmakingMode==="four"&&isEntryFee(match.settings.entryFee)&&match.players.filter(p=>!p.abandoned).length>1){emitRoomUpdate(io,match);return;}
      void finishMatch(io, match, playerId);
    });

    socket.on("room:leave", (payload: unknown) => {
      if (!eventAllowed("room:leave", 8, 60_000)) return;
      const data = parsePayload(matchEventSchema, payload);
      if (!data) return;
      const match = matchesById.get(data.matchId);
      const player = match && getPlayer(match, playerId);
      if (!match || !player || match.mode !== "private") return;
      if(["playing","results","countdown"].includes(match.phase)){player.abandoned=true;void finishMatch(io,match,playerId);return;}
      if(match.phase==="finished"){socket.leave(match.id);player.socketId=null;if(finishedMatchByPlayer.get(playerId)===match)finishedMatchByPlayer.delete(playerId);if(match.hostId===playerId)setRoomHost(match);emitRoomUpdate(io,match);return;}
      if(match.phase!=="waiting")return;
      match.players = match.players.filter((candidate) => candidate.id !== playerId);
      activeMatchByPlayer.delete(playerId);
      socket.leave(match.id);
      if (playerId === match.hostId) setRoomHost(match);
      if (match.players.length === 0) {
        deleteMatch(match);
      } else {
        emitRoomUpdate(io, match);
      }
    });

    socket.on("disconnect", () => {
      const playerSockets = socketsByPlayer.get(playerId);
      playerSockets?.delete(socket.id);
      if (playerSockets?.size === 0) socketsByPlayer.delete(playerId);
      if (socketByPlayer.get(playerId) !== socket.id) return;

      const fallbackSocketId = [...(playerSockets ?? [])]
        .find((socketId) => io.sockets.sockets.get(socketId)?.connected);
      if (fallbackSocketId) {
        socketByPlayer.set(playerId, fallbackSocketId);
        const queueMode=waitingQueue.modeFor(playerId);const queued=queueMode?waitingQueue.entriesFor(queueMode).find(([id])=>id===playerId)?.[1]:undefined;if(queued)queued.player.socketId=fallbackSocketId;
        const match = activeMatchByPlayer.get(playerId) ?? finishedMatchByPlayer.get(playerId);
        const player = match && getPlayer(match, playerId);
        if (player?.socketId === socket.id) {
          if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
          player.disconnectTimer = null;
          player.socketId = fallbackSocketId;
        }
        return;
      }

      socketByPlayer.delete(playerId);
      const queued = removeFromQueue(playerId);
      if (queued){notifyPublicQueues(io);return;}
      markDisconnected(io, playerId, socket.id);
    });
  });
}
