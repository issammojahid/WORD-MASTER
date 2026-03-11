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

// Track which room each socket is currently in
const socketRoomMap = new Map<string, string>();

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
          socket.join(data.roomId);
          socketRoomMap.set(socket.id, data.roomId);
          console.log(`[join_room] Socket ${socket.id} joined room ${data.roomId}. Players: ${result.room.players.map(p => p.name).join(", ")}`);
          cb({ success: true, room: sanitizeRoom(result.room) });
          io.to(data.roomId).emit("room_updated", sanitizeRoom(result.room));
          io.to(data.roomId).emit("player_joined", {
            playerName: data.playerName,
          });
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

    // Disconnect
    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);

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
