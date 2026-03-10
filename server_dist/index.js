// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

// server/wordDatabase.ts
import { readFileSync } from "fs";
import { join } from "path";
var CATEGORY_MAP = {
  girlName: "girl_names",
  boyName: "boy_names",
  animal: "animals",
  fruit: "fruits",
  vegetable: "vegetables",
  object: "objects",
  city: "cities",
  country: "countries"
};
function loadWordDatabase() {
  const cwd = process.cwd();
  const candidatePaths = [
    join(cwd, "server", "data", "wordDatabase.json"),
    join(cwd, "server_dist", "data", "wordDatabase.json"),
    join(cwd, "data", "wordDatabase.json")
  ];
  for (const dbPath of candidatePaths) {
    try {
      const raw = readFileSync(dbPath, "utf-8");
      return JSON.parse(raw);
    } catch {
    }
  }
  throw new Error(
    `wordDatabase.json not found. Tried: ${candidatePaths.join(", ")}`
  );
}
var rawDatabase = loadWordDatabase();
function normalize(word) {
  return word.trim().replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآٱ]/g, "\u0627").replace(/ى/g, "\u064A").replace(/ة/g, "\u0647").toLowerCase();
}
var exactSets = {};
var normalizedSets = {};
for (const cat of Object.keys(rawDatabase)) {
  const words = rawDatabase[cat];
  exactSets[cat] = new Set(words);
  normalizedSets[cat] = new Set(words.map(normalize));
}
function normalizeLetter(letter) {
  return letter.trim().replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآٱ]/g, "\u0627").toLowerCase();
}
function stripArticle(normWord) {
  if (normWord.startsWith("\u0627\u0644")) return normWord.slice(2);
  return normWord;
}
function validateWord(word, category, letter) {
  if (!word || word.trim().length < 2) {
    return { valid: false, reason: "too_short" };
  }
  const normWord = normalize(word);
  const normLetter = normalizeLetter(letter);
  const wordRoot = stripArticle(normWord);
  if (!normWord.startsWith(normLetter) && !wordRoot.startsWith(normLetter)) {
    return { valid: false, reason: "wrong_letter" };
  }
  if (exactSets[category].has(word.trim())) {
    return { valid: true };
  }
  if (normalizedSets[category].has(normWord)) {
    return { valid: true };
  }
  const stripped = stripArticle(normWord);
  if (stripped !== normWord) {
    if (normalizedSets[category].has(stripped)) {
      return { valid: true };
    }
  } else {
    if (normalizedSets[category].has("\u0627\u0644" + normWord)) {
      return { valid: true };
    }
  }
  return { valid: false, reason: "not_in_database" };
}

// server/gameLogic.ts
var GAME_CATEGORIES = [
  "girlName",
  "boyName",
  "animal",
  "fruit",
  "vegetable",
  "object",
  "city",
  "country"
];
var ARABIC_LETTERS = [
  "\u0623",
  "\u0628",
  "\u062A",
  "\u062B",
  "\u062C",
  "\u062D",
  "\u062E",
  "\u062F",
  "\u0630",
  "\u0631",
  "\u0632",
  "\u0633",
  "\u0634",
  "\u0635",
  "\u0636",
  "\u0637",
  "\u0638",
  "\u0639",
  "\u063A",
  "\u0641",
  "\u0642",
  "\u0643",
  "\u0644",
  "\u0645",
  "\u0646",
  "\u0647",
  "\u0648",
  "\u064A"
];
var rooms = /* @__PURE__ */ new Map();
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
function pickRandomLetter(usedLetters = []) {
  const available = ARABIC_LETTERS.filter((l) => !usedLetters.includes(l));
  const pool = available.length > 0 ? available : ARABIC_LETTERS;
  return pool[Math.floor(Math.random() * pool.length)];
}
function createRoom(hostId, hostName, hostSkin) {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }
  const room = {
    id: code,
    players: [
      {
        id: hostId,
        name: hostName,
        skin: hostSkin,
        score: 0,
        roundScores: [],
        coins: 0,
        isReady: false,
        isHost: true
      }
    ],
    state: "waiting",
    currentLetter: pickRandomLetter(),
    currentRound: 0,
    totalRounds: 5,
    roundResults: [],
    submittedAnswers: /* @__PURE__ */ new Map(),
    roundStartTime: 0,
    timer: null
  };
  rooms.set(code, room);
  return room;
}
function joinRoom(roomId, playerId, playerName, playerSkin) {
  const room = rooms.get(roomId);
  if (!room) return { success: false, error: "room_not_found" };
  if (room.players.length >= 8) return { success: false, error: "room_full" };
  if (room.state !== "waiting") return { success: false, error: "game_in_progress" };
  if (room.players.find((p) => p.id === playerId)) {
    return { success: true, room };
  }
  room.players.push({
    id: playerId,
    name: playerName,
    skin: playerSkin,
    score: 0,
    roundScores: [],
    coins: 0,
    isReady: false,
    isHost: false
  });
  return { success: true, room };
}
function removePlayer(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.players = room.players.filter((p) => p.id !== playerId);
  if (room.players.length === 0) {
    if (room.timer) clearTimeout(room.timer);
    rooms.delete(roomId);
    return null;
  }
  if (!room.players.find((p) => p.isHost)) {
    room.players[0].isHost = true;
  }
  return room;
}
function startGame(roomId) {
  const room = rooms.get(roomId);
  if (!room) return { success: false, error: "room_not_found" };
  if (room.players.length < 2) return { success: false, error: "need_more_players" };
  const usedLetters = [];
  room.state = "playing";
  room.currentRound = 1;
  room.currentLetter = pickRandomLetter(usedLetters);
  room.submittedAnswers.clear();
  room.roundStartTime = Date.now();
  return { success: true, room };
}
function submitAnswers(roomId, playerId, answers) {
  const room = rooms.get(roomId);
  if (!room || room.state !== "playing") return { allSubmitted: false, room: null };
  room.submittedAnswers.set(playerId, answers);
  const allSubmitted = room.players.every((p) => room.submittedAnswers.has(p.id));
  return { allSubmitted, room };
}
function calculateRoundScores(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  const letter = room.currentLetter;
  const results = [];
  const answersByCategory = {};
  for (const cat of GAME_CATEGORIES) {
    answersByCategory[cat] = [];
  }
  for (const [, answers] of room.submittedAnswers) {
    for (const cat of GAME_CATEGORIES) {
      const ans = answers[cat]?.trim().toLowerCase() || "";
      if (ans) {
        answersByCategory[cat].push(ans);
      }
    }
  }
  const duplicateCounts = {};
  for (const cat of GAME_CATEGORIES) {
    const counts = /* @__PURE__ */ new Map();
    for (const ans of answersByCategory[cat]) {
      counts.set(ans, (counts.get(ans) || 0) + 1);
    }
    duplicateCounts[cat] = counts;
  }
  for (const player of room.players) {
    const answers = room.submittedAnswers.get(player.id) || {};
    const scores = {};
    const status = {};
    let roundTotal = 0;
    for (const cat of GAME_CATEGORIES) {
      const ans = answers[cat]?.trim() || "";
      if (!ans) {
        scores[cat] = 0;
        status[cat] = "empty";
      } else {
        const dbCategory = CATEGORY_MAP[cat];
        const validation = validateWord(ans, dbCategory, letter);
        if (!validation.valid) {
          scores[cat] = 0;
          status[cat] = "invalid";
        } else {
          const ansLower = ans.toLowerCase();
          const count = duplicateCounts[cat].get(ansLower) || 0;
          if (count > 1) {
            scores[cat] = 0;
            status[cat] = "duplicate";
          } else {
            scores[cat] = 3;
            status[cat] = "correct";
          }
        }
      }
      roundTotal += scores[cat];
    }
    results.push({
      playerId: player.id,
      playerName: player.name,
      answers,
      scores,
      roundTotal,
      status
    });
    player.score += roundTotal;
    player.roundScores.push(roundTotal);
  }
  room.roundResults.push(results);
  room.state = "results";
  return results;
}
function nextRound(roomId) {
  const room = rooms.get(roomId);
  if (!room) return { isGameOver: false, room: null };
  if (room.currentRound >= room.totalRounds) {
    room.state = "finished";
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    const coinRewards = [20, 15, 10, 5];
    for (let i = 0; i < sorted.length; i++) {
      sorted[i].coins = coinRewards[Math.min(i, coinRewards.length - 1)];
    }
    return { isGameOver: true, room };
  }
  const usedLetters = room.roundResults.map((_, i) => room.currentLetter);
  room.currentRound += 1;
  room.currentLetter = pickRandomLetter(usedLetters);
  room.submittedAnswers.clear();
  room.state = "playing";
  room.roundStartTime = Date.now();
  return { isGameOver: false, room };
}
function getRoom(roomId) {
  return rooms.get(roomId);
}
function findAvailableRoom() {
  for (const [, room] of rooms) {
    if (room.state === "waiting" && room.players.length > 0 && room.players.length < 8) {
      return room;
    }
  }
  return null;
}
function resetRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const usedLetters = [];
  room.state = "waiting";
  room.currentRound = 0;
  room.currentLetter = pickRandomLetter(usedLetters);
  room.submittedAnswers.clear();
  room.roundResults = [];
  for (const player of room.players) {
    player.score = 0;
    player.roundScores = [];
    player.coins = 0;
    player.isReady = false;
  }
  return room;
}

// server/routes.ts
async function registerRoutes(app2) {
  const httpServer = createServer(app2);
  app2.post("/api/validate-round", (req, res) => {
    try {
      const { letter, participantsAnswers } = req.body;
      if (!letter || !Array.isArray(participantsAnswers)) {
        res.status(400).json({ error: "invalid_request" });
        return;
      }
      const results = participantsAnswers.map((answers) => {
        const validation = {};
        for (const [gameCategory, word] of Object.entries(answers)) {
          const dbCategory = CATEGORY_MAP[gameCategory];
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
  const allowedOrigins = /* @__PURE__ */ new Set();
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
        const isLocalhost = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
        if (isLocalhost || allowedOrigins.has(origin)) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["websocket", "polling"]
  });
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    socket.on(
      "create_room",
      (data, cb) => {
        try {
          const room = createRoom(socket.id, data.playerName, data.playerSkin);
          socket.join(room.id);
          cb({ success: true, roomId: room.id });
          io.to(room.id).emit("room_updated", sanitizeRoom(room));
        } catch (e) {
          cb({ success: false, error: "server_error" });
        }
      }
    );
    socket.on(
      "join_room",
      (data, cb) => {
        try {
          const result = joinRoom(data.roomId, socket.id, data.playerName, data.playerSkin);
          if (!result.success || !result.room) {
            cb({ success: false, error: result.error });
            return;
          }
          socket.join(data.roomId);
          cb({ success: true, room: sanitizeRoom(result.room) });
          io.to(data.roomId).emit("room_updated", sanitizeRoom(result.room));
          io.to(data.roomId).emit("player_joined", {
            playerName: data.playerName
          });
        } catch (e) {
          cb({ success: false, error: "server_error" });
        }
      }
    );
    socket.on(
      "start_game",
      (data, cb) => {
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
            totalRounds: result.room.totalRounds
          });
          const room = result.room;
          room.timer = setTimeout(() => {
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
                score: p.score
              }))
            });
          }, 51e3);
        } catch (e) {
          cb({ success: false, error: "server_error" });
        }
      }
    );
    socket.on(
      "submit_answers",
      (data) => {
        try {
          const { allSubmitted, room } = submitAnswers(
            data.roomId,
            socket.id,
            data.answers
          );
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
                score: p.score
              })) || []
            });
          }
        } catch (e) {
          console.error("submit_answers error:", e);
        }
      }
    );
    socket.on(
      "next_round",
      (data, cb) => {
        try {
          const { isGameOver, room } = nextRound(data.roomId);
          if (isGameOver && room) {
            io.to(data.roomId).emit("game_over", {
              players: room.players.map((p) => ({
                id: p.id,
                name: p.name,
                score: p.score,
                coins: p.coins
              }))
            });
            cb?.({ isGameOver: true });
          } else if (room) {
            io.to(data.roomId).emit("new_round", {
              letter: room.currentLetter,
              round: room.currentRound,
              totalRounds: room.totalRounds
            });
            cb?.({ isGameOver: false, letter: room.currentLetter });
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
                  score: p.score
                }))
              });
            }, 51e3);
          }
        } catch (e) {
          console.error("next_round error:", e);
        }
      }
    );
    socket.on(
      "quick_match",
      (data, cb) => {
        try {
          const availableRoom = findAvailableRoom();
          if (availableRoom) {
            const result = joinRoom(availableRoom.id, socket.id, data.playerName, data.playerSkin);
            if (result.success && result.room) {
              socket.join(availableRoom.id);
              cb({ success: true, roomId: availableRoom.id, room: sanitizeRoom(result.room), created: false });
              io.to(availableRoom.id).emit("room_updated", sanitizeRoom(result.room));
              io.to(availableRoom.id).emit("player_joined", { playerName: data.playerName });
            } else {
              const newRoom = createRoom(socket.id, data.playerName, data.playerSkin);
              socket.join(newRoom.id);
              cb({ success: true, roomId: newRoom.id, room: sanitizeRoom(newRoom), created: true });
              io.to(newRoom.id).emit("room_updated", sanitizeRoom(newRoom));
            }
          } else {
            const newRoom = createRoom(socket.id, data.playerName, data.playerSkin);
            socket.join(newRoom.id);
            cb({ success: true, roomId: newRoom.id, room: sanitizeRoom(newRoom), created: true });
            io.to(newRoom.id).emit("room_updated", sanitizeRoom(newRoom));
          }
        } catch (e) {
          cb({ success: false, error: "server_error" });
        }
      }
    );
    socket.on(
      "leave_room",
      (data) => {
        const room = removePlayer(data.roomId, socket.id);
        socket.leave(data.roomId);
        if (room) {
          io.to(data.roomId).emit("room_updated", sanitizeRoom(room));
          io.to(data.roomId).emit("player_left", { playerId: socket.id });
        }
      }
    );
    socket.on(
      "play_again",
      (data) => {
        const room = resetRoom(data.roomId);
        if (room) {
          io.to(data.roomId).emit("room_updated", sanitizeRoom(room));
        }
      }
    );
    socket.on(
      "get_room",
      (data, cb) => {
        const room = getRoom(data.roomId);
        if (!room) {
          cb({ error: "room_not_found" });
        } else {
          cb({ room: sanitizeRoom(room) });
        }
      }
    );
    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
      const roomsToUpdate = [];
      for (const [roomId] of socket.rooms || []) {
        if (roomId !== socket.id) {
          roomsToUpdate.push(roomId);
        }
      }
      for (const roomId of roomsToUpdate) {
        const room = removePlayer(roomId, socket.id);
        if (room) {
          io.to(roomId).emit("room_updated", sanitizeRoom(room));
          io.to(roomId).emit("player_left", { playerId: socket.id });
        }
      }
    });
  });
  app2.get("/api/room/:id", (req, res) => {
    const room = getRoom(req.params.id);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(sanitizeRoom(room));
  });
  app2.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  return httpServer;
}
function sanitizeRoom(room) {
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
      isReady: p.isReady
    }))
  };
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    if (process.env.ALLOWED_ORIGIN) {
      process.env.ALLOWED_ORIGIN.split(",").forEach((d) => {
        origins.add(d.trim());
      });
    }
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      origins.add(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    const isRailwayDomain = origin?.endsWith(".railway.app") || origin?.endsWith(".up.railway.app");
    if (origin && (origins.has(origin) || isLocalhost || isRailwayDomain)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
