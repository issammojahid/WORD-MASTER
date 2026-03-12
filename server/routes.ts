import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import {
  createRoom,
  joinRoom,
  removePlayer,
  startGame,
  submitAnswers,
  calculateRoundScores,
  nextRound,
  getRoom,
  resetRoom,
  findAvailableRoom,
  type PlayerAnswers,
} from "./gameLogic";
import { validateWord, CATEGORY_MAP, type WordCategory } from "./wordDatabase";
import { ARABIC_LETTERS } from "./gameLogic";
import { db } from "./db";
import { playerProfiles, dailySpins, winStreaks } from "@shared/schema";
import { eq } from "drizzle-orm";

// Track which room each socket is currently in
const socketRoomMap = new Map<string, string>();

const MIN_PLAYERS = 2;

// ── RAPID MODE ─────────────────────────────────────────────────────────
const RAPID_CATEGORIES = ["girlName", "boyName", "animal", "fruit", "vegetable", "object", "city", "country"];
const RAPID_ROUND_TIME = 10;
const RAPID_TOTAL_ROUNDS = 5;
const RAPID_COINS_WIN = 15;
const RAPID_COINS_LOSE = 5;
const RAPID_XP_WIN = 30;
const RAPID_XP_LOSE = 10;

type RapidQueueEntry = { id: string; name: string; skin: string; playerId?: string };
let rapidQueue: RapidQueueEntry[] = [];

type RapidRoom = {
  id: string;
  players: { socketId: string; name: string; skin: string; playerId?: string }[];
  scores: Record<string, number>;
  currentRound: number;
  currentLetter: string;
  currentCategory: string;
  roundTimer: ReturnType<typeof setTimeout> | null;
  roundWon: boolean;
};

const rapidRooms = new Map<string, RapidRoom>();

function pickRapidLetter(usedLetters: string[] = []): string {
  const available = ARABIC_LETTERS.filter((l) => !usedLetters.includes(l));
  const pool = available.length > 0 ? available : ARABIC_LETTERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRapidCategory(usedCategories: string[] = []): string {
  const available = RAPID_CATEGORIES.filter((c) => !usedCategories.includes(c));
  const pool = available.length > 0 ? available : RAPID_CATEGORIES;
  return pool[Math.floor(Math.random() * pool.length)];
}
// ────────────────────────────────────────────────────────────────────────

// Countdown then emit game_started — used by both join_room and findMatch flows
function emitCountdownThenStart(
  io: SocketIOServer,
  roomId: string,
  players: { id: string; name: string; skin: string }[],
  onStart: () => void
) {
  let count = 3;
  io.to(roomId).emit("countdown", { count, players });
  const tick = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(tick);
      onStart();
    } else {
      io.to(roomId).emit("countdown", { count, players });
    }
  }, 1000);
}

// Global matchmaking queue
type QueueEntry = { id: string; name: string; skin: string; coinEntry?: number; playerId?: string };
let matchmakingQueue: QueueEntry[] = [];

const COIN_ENTRY_OPTIONS = [
  { entry: 50, reward: 100 },
  { entry: 100, reward: 200 },
  { entry: 500, reward: 1000 },
  { entry: 1000, reward: 2500 },
];

const SPIN_REWARDS = [
  { type: "coins" as const, amount: 25, label: "25 عملة", weight: 25 },
  { type: "coins" as const, amount: 50, label: "50 عملة", weight: 20 },
  { type: "coins" as const, amount: 100, label: "100 عملة", weight: 15 },
  { type: "coins" as const, amount: 200, label: "200 عملة", weight: 8 },
  { type: "coins" as const, amount: 500, label: "500 عملة", weight: 3 },
  { type: "xp" as const, amount: 50, label: "50 XP", weight: 15 },
  { type: "xp" as const, amount: 100, label: "100 XP", weight: 10 },
  { type: "xp" as const, amount: 200, label: "200 XP", weight: 4 },
];

const STREAK_MILESTONES = [
  { wins: 3, reward: 50 },
  { wins: 5, reward: 100 },
  { wins: 10, reward: 300 },
];

function pickSpinReward() {
  const totalWeight = SPIN_REWARDS.reduce((s, r) => s + r.weight, 0);
  let rnd = Math.random() * totalWeight;
  for (const reward of SPIN_REWARDS) {
    rnd -= reward.weight;
    if (rnd <= 0) return reward;
  }
  return SPIN_REWARDS[0];
}

const roomCoinEntries = new Map<string, number>();
const roomPendingDeductions = new Map<string, string[]>();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // REST endpoint: validate all answers for one round (used by offline mode)
  // POST /api/validate-round
  // Body: { letter: string, answers: Record<gameCategory, string>[] }
  // Returns: { results: { category, word, valid, reason }[] }[]
  app.post("/api/validate-round", (req, res) => {
    try {
      const { letter, participantsAnswers } = req.body as {
        letter: string;
        participantsAnswers: Array<Record<string, string>>;
      };

      if (!letter || !Array.isArray(participantsAnswers)) {
        res.status(400).json({ error: "invalid_request" });
        return;
      }

      const results = participantsAnswers.map((answers) => {
        const validation: Record<string, { valid: boolean; reason?: string }> = {};
        for (const [gameCategory, word] of Object.entries(answers)) {
          const dbCategory = CATEGORY_MAP[gameCategory] as WordCategory | undefined;
          if (!dbCategory) {
            validation[gameCategory] = { valid: false, reason: "unknown_category" };
          } else {
            validation[gameCategory] = validateWord(word || "", dbCategory, letter);
          }
        }
        return validation;
      });

      res.json({ results });
    } catch (e) {
      console.error("validate-round error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  const allowedOrigins = new Set<string>();

  if (process.env.REPLIT_DEV_DOMAIN) {
    allowedOrigins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }
  if (process.env.REPLIT_DOMAINS) {
    process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
      allowedOrigins.add(`https://${d.trim()}`);
    });
  }

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isLocalhost =
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:");
        if (isLocalhost || allowedOrigins.has(origin)) {
          return callback(null, true);
        }
        return callback(null, true); // Allow all for Expo
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Create a new room
    socket.on(
      "create_room",
      (
        data: { playerName: string; playerSkin: string },
        cb: (res: { success: boolean; roomId?: string; error?: string }) => void
      ) => {
        try {
          const room = createRoom(socket.id, data.playerName, data.playerSkin);
          socket.join(room.id);
          socketRoomMap.set(socket.id, room.id);
          console.log(`[create_room] Socket ${socket.id} created room ${room.id}. Players: ${room.players.map(p => p.name).join(", ")}`);
          cb({ success: true, roomId: room.id });
          io.to(room.id).emit("room_updated", sanitizeRoom(room));
        } catch (e) {
          cb({ success: false, error: "server_error" });
        }
      }
    );

    // Join a room
    socket.on(
      "join_room",
      (
        data: { roomId: string; playerName: string; playerSkin: string },
        cb: (res: { success: boolean; room?: ReturnType<typeof sanitizeRoom>; error?: string }) => void
      ) => {
        try {
          const result = joinRoom(data.roomId, socket.id, data.playerName, data.playerSkin);
          if (!result.success || !result.room) {
            cb({ success: false, error: result.error });
            return;
          }

          // Deduplicate by socket.id (safety net)
          const uniquePlayers = result.room.players.filter(
            (p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx
          );
          result.room.players = uniquePlayers;

          socket.join(data.roomId);
          socketRoomMap.set(socket.id, data.roomId);
          console.log(`[join_room] Socket ${socket.id} joined room ${data.roomId}. Players (${result.room.players.length}): ${result.room.players.map(p => p.name).join(", ")}`);

          cb({ success: true, room: sanitizeRoom(result.room) });
          io.to(data.roomId).emit("room_updated", sanitizeRoom(result.room));
          io.to(data.roomId).emit("player_joined", { playerName: data.playerName });

          // Auto-start when MIN_PLAYERS unique real players are in the room
          if (result.room.players.length >= MIN_PLAYERS && result.room.state === "waiting") {
            const players = result.room.players.map((p) => ({ id: p.id, name: p.name, skin: p.skin }));
            console.log(`[join_room] Countdown starting for room ${data.roomId}`);
            emitCountdownThenStart(io, data.roomId, players, () => {
              const gameResult = startGame(data.roomId);
              if (!gameResult.success || !gameResult.room) return;
              console.log(`[join_room] Game started in room ${data.roomId}`);
              io.to(data.roomId).emit("game_started", {
                letter: gameResult.room.currentLetter,
                round: gameResult.room.currentRound,
                totalRounds: gameResult.room.totalRounds,
              });
              gameResult.room.timer = setTimeout(() => {
                const results = calculateRoundScores(data.roomId);
                const updatedRoom = getRoom(data.roomId);
                if (!updatedRoom) return;
                io.to(data.roomId).emit("round_results", {
                  results,
                  round: updatedRoom.currentRound,
                  totalRounds: updatedRoom.totalRounds,
                  players: updatedRoom.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
                });
              }, 51000);
            });
          }
        } catch (e) {
          cb({ success: false, error: "server_error" });
        }
      }
    );

    // Start game
    socket.on(
      "start_game",
      (
        data: { roomId: string },
        cb: (res: { success: boolean; error?: string }) => void
      ) => {
        try {
          const result = startGame(data.roomId);
          if (!result.success || !result.room) {
            cb({ success: false, error: result.error });
            return;
          }
          cb({ success: true });
          io.to(data.roomId).emit("game_started", {
            letter: result.room.currentLetter,
            round: result.room.currentRound,
            totalRounds: result.room.totalRounds,
          });

          // Start 50-second timer
          const room = result.room;
          room.timer = setTimeout(() => {
            // Time's up - calculate scores for whoever has submitted
            const results = calculateRoundScores(data.roomId);
            const currentRoom = getRoom(data.roomId);
            if (!currentRoom) return;
            io.to(data.roomId).emit("round_results", {
              results,
              round: currentRoom.currentRound,
              totalRounds: currentRoom.totalRounds,
              players: currentRoom.players.map((p) => ({
                id: p.id,
                name: p.name,
                score: p.score,
              })),
            });
          }, 51000);
        } catch (e) {
          cb({ success: false, error: "server_error" });
        }
      }
    );

    // Submit answers
    socket.on(
      "submit_answers",
      (data: { roomId: string; answers: PlayerAnswers }) => {
        try {
          const { allSubmitted, room } = submitAnswers(
            data.roomId,
            socket.id,
            data.answers
          );

          // Notify room that this player submitted
          io.to(data.roomId).emit("player_submitted", { playerId: socket.id });

          if (allSubmitted && room) {
            if (room.timer) {
              clearTimeout(room.timer);
              room.timer = null;
            }
            const results = calculateRoundScores(data.roomId);
            const updatedRoom = getRoom(data.roomId);
            io.to(data.roomId).emit("round_results", {
              results,
              round: updatedRoom?.currentRound || 0,
              totalRounds: updatedRoom?.totalRounds || 5,
              players: updatedRoom?.players.map((p) => ({
                id: p.id,
                name: p.name,
                score: p.score,
              })) || [],
            });
          }
        } catch (e) {
          console.error("submit_answers error:", e);
        }
      }
    );

    // Next round
    socket.on(
      "next_round",
      (
        data: { roomId: string },
        cb?: (res: { isGameOver: boolean; letter?: string }) => void
      ) => {
        try {
          const { isGameOver, room } = nextRound(data.roomId);
          if (isGameOver && room) {
            io.to(data.roomId).emit("game_over", {
              players: room.players.map((p) => ({
                id: p.id,
                name: p.name,
                score: p.score,
                coins: p.coins,
                skin: p.skin,
              })),
            });
            cb?.({ isGameOver: true });
          } else if (room) {
            io.to(data.roomId).emit("new_round", {
              letter: room.currentLetter,
              round: room.currentRound,
              totalRounds: room.totalRounds,
            });
            cb?.({ isGameOver: false, letter: room.currentLetter });

            // Start new 50-second timer
            room.timer = setTimeout(() => {
              const results = calculateRoundScores(data.roomId);
              const updatedRoom = getRoom(data.roomId);
              if (!updatedRoom) return;
              io.to(data.roomId).emit("round_results", {
                results,
                round: updatedRoom.currentRound,
                totalRounds: updatedRoom.totalRounds,
                players: updatedRoom.players.map((p) => ({
                  id: p.id,
                  name: p.name,
                  score: p.score,
                })),
              });
            }, 51000);
          }
        } catch (e) {
          console.error("next_round error:", e);
        }
      }
    );

    // Quick match - find or create an available room
    socket.on(
      "quick_match",
      (
        data: { playerName: string; playerSkin: string },
        cb: (res: { success: boolean; roomId?: string; room?: ReturnType<typeof sanitizeRoom>; created?: boolean; error?: string }) => void
      ) => {
        try {
          // Prevent duplicate matchmaking: if this socket is already in a room, return it
          const existingRoomId = socketRoomMap.get(socket.id);
          if (existingRoomId) {
            const existingRoom = getRoom(existingRoomId);
            if (existingRoom && existingRoom.state === "waiting") {
              console.log(`[quick_match] Socket ${socket.id} already in room ${existingRoomId}, skipping duplicate join. Players: ${existingRoom.players.map(p => p.name).join(", ")}`);
              cb({ success: true, roomId: existingRoomId, room: sanitizeRoom(existingRoom), created: false });
              return;
            }
            // Room no longer valid (game started or gone), clear the mapping
            socketRoomMap.delete(socket.id);
          }

          // Find a waiting room with fewer than 8 players
          const availableRoom = findAvailableRoom();
          if (availableRoom) {
            const result = joinRoom(availableRoom.id, socket.id, data.playerName, data.playerSkin);
            if (result.success && result.room) {
              socket.join(availableRoom.id);
              socketRoomMap.set(socket.id, availableRoom.id);
              console.log(`[quick_match] Socket ${socket.id} joined existing room ${availableRoom.id}. Players: ${result.room.players.map(p => p.name).join(", ")}`);
              cb({ success: true, roomId: availableRoom.id, room: sanitizeRoom(result.room), created: false });
              io.to(availableRoom.id).emit("room_updated", sanitizeRoom(result.room));
              io.to(availableRoom.id).emit("player_joined", { playerName: data.playerName });
            } else {
              // That room became unavailable; create a new one
              const newRoom = createRoom(socket.id, data.playerName, data.playerSkin);
              socket.join(newRoom.id);
              socketRoomMap.set(socket.id, newRoom.id);
              console.log(`[quick_match] Socket ${socket.id} created new room ${newRoom.id} (fallback). Players: ${newRoom.players.map(p => p.name).join(", ")}`);
              cb({ success: true, roomId: newRoom.id, room: sanitizeRoom(newRoom), created: true });
              io.to(newRoom.id).emit("room_updated", sanitizeRoom(newRoom));
            }
          } else {
            const newRoom = createRoom(socket.id, data.playerName, data.playerSkin);
            socket.join(newRoom.id);
            socketRoomMap.set(socket.id, newRoom.id);
            console.log(`[quick_match] Socket ${socket.id} created new room ${newRoom.id}. Players: ${newRoom.players.map(p => p.name).join(", ")}`);
            cb({ success: true, roomId: newRoom.id, room: sanitizeRoom(newRoom), created: true });
            io.to(newRoom.id).emit("room_updated", sanitizeRoom(newRoom));
          }
        } catch (e) {
          cb({ success: false, error: "server_error" });
        }
      }
    );

    // Leave room
    socket.on(
      "leave_room",
      (data: { roomId: string }) => {
        const room = removePlayer(data.roomId, socket.id);
        socket.leave(data.roomId);
        socketRoomMap.delete(socket.id);
        console.log(`[leave_room] Socket ${socket.id} left room ${data.roomId}. Remaining: ${room ? room.players.map(p => p.name).join(", ") : "room deleted"}`);
        if (room) {
          io.to(data.roomId).emit("room_updated", sanitizeRoom(room));
          io.to(data.roomId).emit("player_left", { playerId: socket.id });
        }
      }
    );

    // Play again
    socket.on(
      "play_again",
      (data: { roomId: string }) => {
        const room = resetRoom(data.roomId);
        if (room) {
          io.to(data.roomId).emit("room_updated", sanitizeRoom(room));
        }
      }
    );

    // Get room info
    socket.on(
      "get_room",
      (
        data: { roomId: string },
        cb: (res: { room?: ReturnType<typeof sanitizeRoom>; error?: string }) => void
      ) => {
        const room = getRoom(data.roomId);
        if (!room) {
          cb({ error: "room_not_found" });
        } else {
          cb({ room: sanitizeRoom(room) });
        }
      }
    );

    // ── NEW MATCHMAKING SYSTEM ──────────────────────────────────────────
    // findMatch: add player to global queue; create room when 2 are ready
    socket.on(
      "findMatch",
      async (data: { playerName: string; playerSkin: string; coinEntry?: number; playerId?: string }) => {
        // Never add the same socket twice
        if (matchmakingQueue.find((p) => p.id === socket.id)) {
          console.log(`[findMatch] Socket ${socket.id} already in queue – ignored`);
          return;
        }

        const requestedEntry = data.coinEntry || 0;
        if (requestedEntry > 0 && data.playerId) {
          try {
            const [p] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, data.playerId));
            if (!p || p.coins < requestedEntry) {
              socket.emit("matchError", { error: "insufficient_coins" });
              return;
            }
          } catch {}
        }

        const entry: QueueEntry = { id: socket.id, name: data.playerName, skin: data.playerSkin, coinEntry: requestedEntry, playerId: data.playerId };
        matchmakingQueue.push(entry);
        console.log(`[findMatch] Queue: ${matchmakingQueue.map((p) => `${p.name}(${p.coinEntry || 0})`).join(", ")} (${matchmakingQueue.length} players)`);

        // Find a match with same coinEntry
        const myCoinEntry = entry.coinEntry || 0;
        const matchIdx = matchmakingQueue.findIndex((p) => p.id !== socket.id && (p.coinEntry || 0) === myCoinEntry);

        if (matchIdx !== -1) {
          const opponent = matchmakingQueue[matchIdx];
          matchmakingQueue = matchmakingQueue.filter((p) => p.id !== socket.id && p.id !== opponent.id);
          const matched = [entry, opponent];
          console.log(`[findMatch] Match created: ${matched.map((p) => p.name).join(" vs ")} (entry: ${myCoinEntry})`);

          // Create room with first player as host, join second
          const room = createRoom(matched[0].id, matched[0].name, matched[0].skin);
          joinRoom(room.id, matched[1].id, matched[1].name, matched[1].skin);

          if (myCoinEntry > 0) {
            roomCoinEntries.set(room.id, myCoinEntry);
            roomPendingDeductions.set(room.id, matched.filter(p => !!p.playerId).map(p => p.playerId!));
          }

          // Join both sockets to the Socket.io room
          for (const player of matched) {
            const s = io.sockets.sockets.get(player.id);
            if (s) {
              s.join(room.id);
              socketRoomMap.set(player.id, room.id);
            }
          }

          // Countdown then start
          const roomPlayers = room.players.map((p) => ({ id: p.id, name: p.name, skin: p.skin }));
          console.log(`[findMatch] Countdown starting for room ${room.id}`);
          emitCountdownThenStart(io, room.id, roomPlayers, async () => {
            const pendingPlayerIds = roomPendingDeductions.get(room.id);
            if (pendingPlayerIds && myCoinEntry > 0) {
              for (const pid of pendingPlayerIds) {
                try {
                  const [p] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, pid));
                  if (p) {
                    await db.update(playerProfiles).set({ coins: Math.max(0, p.coins - myCoinEntry), updatedAt: new Date() }).where(eq(playerProfiles.id, pid));
                  }
                } catch {}
              }
              roomPendingDeductions.delete(room.id);
            }
            const gameResult = startGame(room.id);
            if (!gameResult.success || !gameResult.room) {
              console.error(`[findMatch] startGame failed for room ${room.id}`);
              return;
            }
            const gameData = {
              roomId: room.id,
              letter: gameResult.room.currentLetter,
              round: gameResult.room.currentRound,
              totalRounds: gameResult.room.totalRounds,
              players: gameResult.room.players.map((p) => ({ id: p.id, name: p.name, skin: p.skin })),
              coinEntry: myCoinEntry,
            };
            io.to(room.id).emit("matchFound", gameData);
            console.log(`[findMatch] Room ${room.id}: matchFound emitted, letter=${gameData.letter}, coinEntry=${myCoinEntry}`);
            gameResult.room.timer = setTimeout(() => {
              const results = calculateRoundScores(room.id);
              const updatedRoom = getRoom(room.id);
              if (!updatedRoom) return;
              io.to(room.id).emit("round_results", {
                results,
                round: updatedRoom.currentRound,
                totalRounds: updatedRoom.totalRounds,
                players: updatedRoom.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
              });
            }, 51000);
          });
        }
      }
    );

    // cancelMatch: remove from queue (e.g. user pressed back)
    socket.on("cancelMatch", () => {
      matchmakingQueue = matchmakingQueue.filter((p) => p.id !== socket.id);
      console.log(`[cancelMatch] Socket ${socket.id} removed from queue. Queue: ${matchmakingQueue.length}`);
    });
    // ────────────────────────────────────────────────────────────────────

    // Quick chat relay — forward chat message to all players in the room
    socket.on("quick_chat", (data: { roomId: string; message: string; playerName: string }) => {
      socket.to(data.roomId).emit("quick_chat", { message: data.message, playerName: data.playerName });
    });

    // Voice data relay — forward audio chunks to all players in the room
    socket.on("voice_data", (data: { roomId: string; audio: string; isSpeaking: boolean }) => {
      socket.to(data.roomId).emit("voice_data", { audio: data.audio, from: socket.id, isSpeaking: data.isSpeaking });
    });

    // ── RAPID MODE SOCKET EVENTS ────────────────────────────────────────
    socket.on("rapid_join", (data: { playerName: string; playerSkin: string; playerId?: string }) => {
      if (rapidQueue.find((p) => p.id === socket.id)) return;
      const entry: RapidQueueEntry = { id: socket.id, name: data.playerName, skin: data.playerSkin, playerId: data.playerId };
      rapidQueue.push(entry);
      console.log(`[rapid_join] Queue: ${rapidQueue.length}`);

      const matchIdx = rapidQueue.findIndex((p) => p.id !== socket.id);
      if (matchIdx === -1) return;

      const opponent = rapidQueue[matchIdx];
      rapidQueue = rapidQueue.filter((p) => p.id !== socket.id && p.id !== opponent.id);

      const roomId = "rapid_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      const rapidRoom: RapidRoom = {
        id: roomId,
        players: [
          { socketId: entry.id, name: entry.name, skin: entry.skin, playerId: entry.playerId },
          { socketId: opponent.id, name: opponent.name, skin: opponent.skin, playerId: opponent.playerId },
        ],
        scores: { [entry.id]: 0, [opponent.id]: 0 },
        currentRound: 0,
        currentLetter: "",
        currentCategory: "",
        roundTimer: null,
        roundWon: false,
      };
      rapidRooms.set(roomId, rapidRoom);

      const s1 = io.sockets.sockets.get(entry.id);
      const s2 = io.sockets.sockets.get(opponent.id);
      if (s1) s1.join(roomId);
      if (s2) s2.join(roomId);

      io.to(entry.id).emit("rapid_matched", {
        rapidRoomId: roomId,
        opponent: { id: opponent.id, name: opponent.name, skin: opponent.skin },
      });
      io.to(opponent.id).emit("rapid_matched", {
        rapidRoomId: roomId,
        opponent: { id: entry.id, name: entry.name, skin: entry.skin },
      });

      console.log(`[rapid] Match: ${entry.name} vs ${opponent.name} in ${roomId}`);

      setTimeout(() => startRapidRound(io, roomId), 3500);
    });

    socket.on("rapid_cancel", () => {
      rapidQueue = rapidQueue.filter((p) => p.id !== socket.id);
      console.log(`[rapid_cancel] Socket ${socket.id} removed from rapid queue`);
    });

    socket.on("rapid_word", (data: { rapidRoomId: string; word: string; category: string }) => {
      const room = rapidRooms.get(data.rapidRoomId);
      if (!room || room.roundWon) return;

      if (!room.players.some((p) => p.socketId === socket.id)) return;

      if (data.category !== room.currentCategory) {
        socket.emit("rapid_word_result", { valid: false, reason: "wrong_category" });
        return;
      }

      const dbCategory = CATEGORY_MAP[room.currentCategory] as WordCategory | undefined;
      if (!dbCategory) {
        socket.emit("rapid_word_result", { valid: false, reason: "unknown_category" });
        return;
      }
      const validation = validateWord(data.word, dbCategory, room.currentLetter);
      if (!validation.valid) {
        socket.emit("rapid_word_result", { valid: false, reason: validation.reason });
        return;
      }

      room.roundWon = true;
      socket.emit("rapid_word_result", { valid: true });

      room.scores[socket.id] = (room.scores[socket.id] || 0) + 1;

      if (room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }

      const resultData = {
        round: room.currentRound,
        winnerId: socket.id,
        winnerName: room.players.find((p) => p.socketId === socket.id)?.name || "",
        word: data.word,
        category: data.category,
        scores: { ...room.scores },
        isDraw: false,
      };
      io.to(data.rapidRoomId).emit("rapid_round_result", resultData);
      console.log(`[rapid] Round ${room.currentRound} won by ${resultData.winnerName} with "${data.word}" in ${data.rapidRoomId}`);

      setTimeout(() => {
        if (room.currentRound >= RAPID_TOTAL_ROUNDS) {
          endRapidGame(io, data.rapidRoomId);
        } else {
          startRapidRound(io, data.rapidRoomId);
        }
      }, 2500);
    });

    socket.on("rapid_leave", (data: { rapidRoomId: string }) => {
      const room = rapidRooms.get(data.rapidRoomId);
      if (!room) return;
      if (room.roundTimer) clearTimeout(room.roundTimer);

      const remaining = room.players.find((p) => p.socketId !== socket.id);
      if (remaining) {
        room.scores[remaining.socketId] = RAPID_TOTAL_ROUNDS;
        endRapidGame(io, data.rapidRoomId);
      } else {
        rapidRooms.delete(data.rapidRoomId);
      }
    });
    // ────────────────────────────────────────────────────────────────────

    // Disconnect
    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);

      // Remove from matchmaking queue
      matchmakingQueue = matchmakingQueue.filter((p) => p.id !== socket.id);

      // Remove from rapid matchmaking queue
      rapidQueue = rapidQueue.filter((p) => p.id !== socket.id);

      // Handle rapid room disconnect
      for (const [roomId, room] of rapidRooms) {
        const isInRoom = room.players.some((p) => p.socketId === socket.id);
        if (isInRoom) {
          if (room.roundTimer) clearTimeout(room.roundTimer);
          const remaining = room.players.find((p) => p.socketId !== socket.id);
          if (remaining) {
            room.scores[remaining.socketId] = RAPID_TOTAL_ROUNDS;
            endRapidGame(io, roomId);
          } else {
            rapidRooms.delete(roomId);
          }
        }
      }

      // Clean up from socketRoomMap first
      const trackedRoomId = socketRoomMap.get(socket.id);
      socketRoomMap.delete(socket.id);

      // Build list of rooms to clean up: prefer our tracked map, fallback to socket rooms
      const roomsToUpdate = new Set<string>();
      if (trackedRoomId) {
        roomsToUpdate.add(trackedRoomId);
      }
      for (const [roomId] of (socket as any).rooms || []) {
        if (roomId !== socket.id) {
          roomsToUpdate.add(roomId);
        }
      }

      for (const roomId of roomsToUpdate) {
        const room = removePlayer(roomId, socket.id);
        console.log(`[disconnect] Removed socket ${socket.id} from room ${roomId}. Remaining: ${room ? room.players.map(p => p.name).join(", ") : "room deleted"}`);
        if (room) {
          io.to(roomId).emit("room_updated", sanitizeRoom(room));
          io.to(roomId).emit("player_left", { playerId: socket.id });
        }
      }
    });
  });

  // ── RAPID MODE HELPERS ────────────────────────────────────────────────
  function startRapidRound(ioRef: SocketIOServer, roomId: string) {
    const room = rapidRooms.get(roomId);
    if (!room) return;

    room.currentRound += 1;
    room.currentLetter = pickRapidLetter();
    room.currentCategory = pickRapidCategory();
    room.roundWon = false;

    ioRef.to(roomId).emit("rapid_round_start", {
      round: room.currentRound,
      letter: room.currentLetter,
      category: room.currentCategory,
      timeLimit: RAPID_ROUND_TIME,
    });
    console.log(`[rapid] Round ${room.currentRound} started in ${roomId}: letter=${room.currentLetter}, category=${room.currentCategory}`);

    room.roundTimer = setTimeout(() => {
      if (room.roundWon) return;
      room.roundWon = true;
      const resultData = {
        round: room.currentRound,
        winnerId: null,
        winnerName: "",
        word: "",
        category: room.currentCategory,
        scores: { ...room.scores },
        isDraw: true,
      };
      ioRef.to(roomId).emit("rapid_round_result", resultData);
      console.log(`[rapid] Round ${room.currentRound} timeout (draw) in ${roomId}`);

      setTimeout(() => {
        if (room.currentRound >= RAPID_TOTAL_ROUNDS) {
          endRapidGame(ioRef, roomId);
        } else {
          startRapidRound(ioRef, roomId);
        }
      }, 2500);
    }, RAPID_ROUND_TIME * 1000);
  }

  function endRapidGame(ioRef: SocketIOServer, roomId: string) {
    const room = rapidRooms.get(roomId);
    if (!room) return;
    if (room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }

    const scores = room.scores;
    const playerIds = Object.keys(scores);
    let winnerId: string | null = null;
    if (playerIds.length === 2) {
      if (scores[playerIds[0]] > scores[playerIds[1]]) winnerId = playerIds[0];
      else if (scores[playerIds[1]] > scores[playerIds[0]]) winnerId = playerIds[1];
    }

    ioRef.to(roomId).emit("rapid_game_over", {
      winnerId,
      scores: { ...scores },
      coinsEarned: RAPID_COINS_WIN,
      xpEarned: RAPID_XP_WIN,
    });
    console.log(`[rapid] Game over in ${roomId}: winner=${winnerId || "draw"}`);
    rapidRooms.delete(roomId);
  }
  // ────────────────────────────────────────────────────────────────────────

  // REST API routes
  app.get("/api/room/:id", (req, res) => {
    const room = getRoom(req.params.id);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(sanitizeRoom(room));
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/player/:id", async (req, res) => {
    try {
      let [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, req.params.id));
      if (!profile) {
        [profile] = await db.insert(playerProfiles).values({ id: req.params.id }).returning();
      }
      res.json(profile);
    } catch (e) {
      console.error("GET /api/player error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.put("/api/player/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const data = req.body;
      const [existing] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, id));
      if (!existing) {
        const [created] = await db.insert(playerProfiles).values({
          id,
          name: data.name || "لاعب",
          coins: data.coins ?? 100,
          xp: data.xp ?? 0,
          level: data.level ?? 1,
          equippedSkin: data.equippedSkin || "student",
          ownedSkins: data.ownedSkins || ["student"],
          totalScore: data.totalScore ?? 0,
          gamesPlayed: data.gamesPlayed ?? 0,
          wins: data.wins ?? 0,
          winStreak: data.winStreak ?? 0,
          bestStreak: data.bestStreak ?? 0,
          lastStreakReward: data.lastStreakReward ?? 0,
        }).returning();
        return res.json(created);
      }
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      const allowedFields = ["name", "coins", "xp", "level", "equippedSkin", "ownedSkins", "totalScore", "gamesPlayed", "wins", "winStreak", "bestStreak", "lastStreakReward"];
      for (const key of allowedFields) {
        if (data[key] !== undefined) updateData[key] = data[key];
      }
      const [updated] = await db.update(playerProfiles).set(updateData).where(eq(playerProfiles.id, id)).returning();
      res.json(updated);
    } catch (e) {
      console.error("PUT /api/player error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/player/:id/spin", async (req, res) => {
    try {
      const id = req.params.id;
      let [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, id));
      if (!profile) {
        [profile] = await db.insert(playerProfiles).values({ id }).returning();
      }
      if (profile.lastSpinAt) {
        const elapsed = Date.now() - new Date(profile.lastSpinAt).getTime();
        if (elapsed < 24 * 60 * 60 * 1000) {
          const nextSpinAt = new Date(profile.lastSpinAt).getTime() + 24 * 60 * 60 * 1000;
          return res.status(429).json({ error: "too_early", nextSpinAt });
        }
      }
      const reward = pickSpinReward();
      const updates: Record<string, unknown> = { lastSpinAt: new Date(), updatedAt: new Date() };
      if (reward.type === "coins") {
        updates.coins = profile.coins + reward.amount;
      } else {
        updates.xp = profile.xp + reward.amount;
        updates.level = Math.floor((profile.xp + reward.amount) / 100) + 1;
      }
      const [updated] = await db.update(playerProfiles).set(updates).where(eq(playerProfiles.id, id)).returning();
      await db.insert(dailySpins).values({
        playerId: id,
        rewardType: reward.type,
        rewardAmount: reward.amount,
      }).catch(() => {});
      res.json({ reward, profile: updated });
    } catch (e) {
      console.error("POST /api/player/:id/spin error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/player/:id/streak", async (req, res) => {
    try {
      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, req.params.id));
      if (!profile) {
        return res.json({ winStreak: 0, bestStreak: 0, lastStreakReward: 0, milestones: STREAK_MILESTONES });
      }
      res.json({
        winStreak: profile.winStreak,
        bestStreak: profile.bestStreak,
        lastStreakReward: profile.lastStreakReward,
        milestones: STREAK_MILESTONES,
      });
    } catch (e) {
      console.error("GET /api/player/:id/streak error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/player/:id/game-result", async (req, res) => {
    try {
      const id = req.params.id;
      const { won, score, coinsEarned, xpEarned, coinEntry } = req.body as {
        won: boolean; score: number; coinsEarned: number; xpEarned: number; coinEntry?: number;
      };
      let [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, id));
      if (!profile) {
        [profile] = await db.insert(playerProfiles).values({ id }).returning();
      }
      const newStreak = won ? profile.winStreak + 1 : 0;
      const newBest = Math.max(newStreak, profile.bestStreak);
      let streakBonus = 0;
      let newLastReward = profile.lastStreakReward;
      if (won) {
        for (const m of STREAK_MILESTONES) {
          if (newStreak >= m.wins && m.wins > profile.lastStreakReward) {
            streakBonus += m.reward;
            newLastReward = m.wins;
          }
        }
      } else {
        newLastReward = 0;
      }
      if (streakBonus > 0) {
        await db.insert(winStreaks).values({
          playerId: id,
          streakLength: newStreak,
          bonusAwarded: streakBonus,
          milestone: newLastReward,
        }).catch(() => {});
      }
      const coinEntryReward = won && coinEntry ? (COIN_ENTRY_OPTIONS.find(o => o.entry === coinEntry)?.reward || 0) : 0;
      const totalCoins = coinsEarned + streakBonus + coinEntryReward;
      const [updated] = await db.update(playerProfiles).set({
        coins: profile.coins + totalCoins,
        xp: profile.xp + xpEarned,
        level: Math.floor((profile.xp + xpEarned) / 100) + 1,
        totalScore: profile.totalScore + score,
        gamesPlayed: profile.gamesPlayed + 1,
        wins: won ? profile.wins + 1 : profile.wins,
        winStreak: newStreak,
        bestStreak: newBest,
        lastStreakReward: newLastReward,
        updatedAt: new Date(),
      }).where(eq(playerProfiles.id, id)).returning();
      res.json({ profile: updated, streakBonus, coinEntryReward });
    } catch (e) {
      console.error("POST /api/player/:id/game-result error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/coin-entries", (_req, res) => {
    res.json(COIN_ENTRY_OPTIONS);
  });

  app.get("/api/spin-rewards", (_req, res) => {
    res.json(SPIN_REWARDS.map(r => ({ type: r.type, amount: r.amount, label: r.label })));
  });

  return httpServer;
}

function sanitizeRoom(room: ReturnType<typeof getRoom>) {
  if (!room) return null;
  return {
    id: room.id,
    state: room.state,
    currentLetter: room.currentLetter,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      skin: p.skin,
      score: p.score,
      roundScores: p.roundScores,
      coins: p.coins,
      isHost: p.isHost,
      isReady: p.isReady,
    })),
  };
}
