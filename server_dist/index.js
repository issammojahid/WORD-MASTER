var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

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
function loadLetterDatabase() {
  const cwd = process.cwd();
  const candidatePaths = [
    join(cwd, "server", "data", "words.json"),
    join(cwd, "server_dist", "data", "words.json"),
    join(cwd, "data", "words.json")
  ];
  for (const dbPath of candidatePaths) {
    try {
      const raw = readFileSync(dbPath, "utf-8");
      return JSON.parse(raw);
    } catch {
    }
  }
  console.warn("words.json not found \u2014 per-letter fallback disabled");
  return {};
}
var rawDatabase = loadWordDatabase();
var letterDatabase = loadLetterDatabase();
function normalize(word) {
  return word.trim().replace(/\s+/g, " ").replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "\u0627").replace(/[ؤ]/g, "\u0648").replace(/[ئ]/g, "\u064A").replace(/ى/g, "\u064A").replace(/ة/g, "\u0647").toLowerCase();
}
var exactSets = {};
var normalizedSets = {};
for (const cat of Object.keys(rawDatabase)) {
  const words = rawDatabase[cat];
  exactSets[cat] = new Set(words);
  normalizedSets[cat] = new Set(words.map(normalize));
}
var letterNormalizedSets = {};
for (const [letter, words] of Object.entries(letterDatabase)) {
  letterNormalizedSets[normalize(letter)] = new Set(words.map(normalize));
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
  const letterSet = letterNormalizedSets[normLetter];
  if (letterSet) {
    if (letterSet.has(normWord) || letterSet.has(stripped)) {
      return { valid: true };
    }
  }
  return { valid: false, reason: "not_in_database" };
}
function getWordsForLetter(category, letter) {
  const normLetter = normalizeLetter(letter);
  return rawDatabase[category].filter((w) => normalize(w).startsWith(normLetter));
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
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function getNextLetter(room) {
  if (room.letterIndex >= room.letterQueue.length) {
    room.letterQueue = shuffleArray(ARABIC_LETTERS);
    room.letterIndex = 0;
  }
  return room.letterQueue[room.letterIndex++];
}
function createRoom(hostId, hostName, hostSkin) {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }
  const initialQueue = shuffleArray(ARABIC_LETTERS);
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
    currentLetter: initialQueue[0],
    currentRound: 0,
    totalRounds: 5,
    roundResults: [],
    submittedAnswers: /* @__PURE__ */ new Map(),
    roundStartTime: 0,
    timer: null,
    letterQueue: initialQueue,
    letterIndex: 1
  };
  rooms.set(code, room);
  return room;
}
function makeUniqueName(existingNames, desiredName) {
  if (!existingNames.includes(desiredName)) return desiredName;
  let counter = 2;
  while (existingNames.includes(`${desiredName}_${counter}`)) {
    counter++;
  }
  return `${desiredName}_${counter}`;
}
function joinRoom(roomId, playerId, playerName, playerSkin) {
  const room = rooms.get(roomId);
  if (!room) return { success: false, error: "room_not_found" };
  if (room.players.length >= 8) return { success: false, error: "room_full" };
  if (room.state !== "waiting") return { success: false, error: "game_in_progress" };
  if (room.players.find((p) => p.id === playerId)) {
    return { success: true, room };
  }
  const existingNames = room.players.map((p) => p.name);
  const uniqueName = makeUniqueName(existingNames, playerName);
  room.players.push({
    id: playerId,
    name: uniqueName,
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
  const uniqueIds = new Set(room.players.map((p) => p.id));
  room.players = room.players.filter((p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx);
  console.log(`[startGame] Room ${roomId}: ${room.players.length} unique players (${uniqueIds.size} unique IDs)`);
  if (room.players.length < 2) return { success: false, error: "need_more_players" };
  room.letterQueue = shuffleArray(ARABIC_LETTERS);
  room.letterIndex = 0;
  room.state = "playing";
  room.currentRound = 1;
  room.currentLetter = getNextLetter(room);
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
            scores[cat] = 5;
            status[cat] = "duplicate";
          } else {
            scores[cat] = 10;
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
  room.currentRound += 1;
  room.currentLetter = getNextLetter(room);
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
  room.letterQueue = shuffleArray(ARABIC_LETTERS);
  room.letterIndex = 0;
  room.state = "waiting";
  room.currentRound = 0;
  room.currentLetter = getNextLetter(room);
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

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  achievementDefs: () => achievementDefs,
  dailySpins: () => dailySpins,
  dailyTaskDefs: () => dailyTaskDefs,
  friends: () => friends,
  insertUserSchema: () => insertUserSchema,
  playerAchievements: () => playerAchievements,
  playerDailyTasks: () => playerDailyTasks,
  playerProfiles: () => playerProfiles,
  roomInvites: () => roomInvites,
  tournamentMatches: () => tournamentMatches,
  tournamentPlayers: () => tournamentPlayers,
  tournaments: () => tournaments,
  users: () => users,
  winStreaks: () => winStreaks
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var playerProfiles = pgTable("player_profiles", {
  id: varchar("id").primaryKey(),
  playerCode: text("player_code").unique(),
  playerTag: integer("player_tag"),
  name: text("name").notNull().default("\u0644\u0627\u0639\u0628"),
  coins: integer("coins").notNull().default(100),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  equippedSkin: text("equipped_skin").notNull().default("student"),
  ownedSkins: jsonb("owned_skins").$type().notNull().default(sql`'["student"]'::jsonb`),
  equippedTitle: text("equipped_title").default("beginner"),
  ownedTitles: jsonb("owned_titles").$type().notNull().default(sql`'["beginner"]'::jsonb`),
  totalScore: integer("total_score").notNull().default(0),
  gamesPlayed: integer("games_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  winStreak: integer("win_streak").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  lastStreakReward: integer("last_streak_reward").notNull().default(0),
  lastSpinAt: timestamp("last_spin_at"),
  powerCards: jsonb("power_cards").$type().default(sql`'{"time":3,"freeze":3,"hint":3}'::jsonb`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});
var dailySpins = pgTable("daily_spins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  rewardType: text("reward_type").notNull(),
  rewardAmount: integer("reward_amount").notNull(),
  spunAt: timestamp("spun_at").notNull().default(sql`now()`)
});
var winStreaks = pgTable("win_streaks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  streakLength: integer("streak_length").notNull(),
  bonusAwarded: integer("bonus_awarded").notNull().default(0),
  milestone: integer("milestone").notNull().default(0),
  awardedAt: timestamp("awarded_at").notNull().default(sql`now()`)
});
var tournaments = pgTable("tournaments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").notNull().default("open"),
  entryFee: integer("entry_fee").notNull().default(100),
  prizePool: integer("prize_pool").notNull().default(0),
  maxPlayers: integer("max_players").notNull().default(8),
  winnerId: varchar("winner_id"),
  winnerName: text("winner_name"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at")
});
var tournamentPlayers = pgTable("tournament_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: varchar("tournament_id").notNull(),
  playerId: varchar("player_id").notNull(),
  playerName: text("player_name").notNull(),
  playerSkin: text("player_skin").notNull().default("student"),
  seed: integer("seed").notNull().default(0),
  eliminated: integer("eliminated").notNull().default(0),
  placement: integer("placement"),
  joinedAt: timestamp("joined_at").notNull().default(sql`now()`)
});
var tournamentMatches = pgTable("tournament_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: varchar("tournament_id").notNull(),
  roundName: text("round_name").notNull(),
  matchIndex: integer("match_index").notNull(),
  player1Id: varchar("player1_id"),
  player1Name: text("player1_name"),
  player2Id: varchar("player2_id"),
  player2Name: text("player2_name"),
  winnerId: varchar("winner_id"),
  winnerName: text("winner_name"),
  roomId: varchar("room_id"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at")
});
var friends = pgTable("friends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull(),
  receiverId: varchar("receiver_id").notNull(),
  status: text("status").notNull().default("pending"),
  // pending | accepted | rejected
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});
var dailyTaskDefs = pgTable("daily_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  titleAr: text("title_ar").notNull(),
  descAr: text("desc_ar").notNull(),
  icon: text("icon").notNull().default("\u{1F4CB}"),
  target: integer("target").notNull(),
  type: text("type").notNull(),
  rewardCoins: integer("reward_coins").notNull().default(0),
  rewardXp: integer("reward_xp").notNull().default(0)
});
var achievementDefs = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  titleAr: text("title_ar").notNull(),
  descAr: text("desc_ar").notNull(),
  icon: text("icon").notNull().default("\u{1F3C6}"),
  target: integer("target").notNull(),
  type: text("type").notNull(),
  rewardCoins: integer("reward_coins").notNull().default(0),
  rewardXp: integer("reward_xp").notNull().default(0)
});
var playerDailyTasks = pgTable("player_daily_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  taskKey: text("task_key").notNull(),
  progress: integer("progress").notNull().default(0),
  completed: integer("completed").notNull().default(0),
  claimed: integer("claimed").notNull().default(0),
  assignedDate: text("assigned_date").notNull(),
  // YYYY-MM-DD
  claimedAt: timestamp("claimed_at"),
  baselineWins: integer("baseline_wins").notNull().default(0),
  baselineGames: integer("baseline_games").notNull().default(0),
  baselineScore: integer("baseline_score").notNull().default(0)
});
var playerAchievements = pgTable("player_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  achievementKey: text("achievement_key").notNull(),
  progress: integer("progress").notNull().default(0),
  unlocked: integer("unlocked").notNull().default(0),
  claimed: integer("claimed").notNull().default(0),
  unlockedAt: timestamp("unlocked_at"),
  claimedAt: timestamp("claimed_at")
});
var roomInvites = pgTable("room_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromPlayerId: varchar("from_player_id").notNull(),
  toPlayerId: varchar("to_player_id").notNull(),
  roomId: varchar("room_id").notNull(),
  fromPlayerName: text("from_player_name").notNull(),
  status: text("status").notNull().default("pending"),
  // pending | accepted | declined
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// server/db.ts
var pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
var db = drizzle(pool, { schema: schema_exports });

// server/routes.ts
import { eq, and, desc, asc, or, ilike, ne, isNotNull, sql as sql2 } from "drizzle-orm";
var TASK_POOL = [
  { key: "win_2", titleAr: "\u0627\u0631\u0628\u062D \u0645\u0628\u0627\u0631\u064A\u062A\u064A\u0646", descAr: "\u0641\u064F\u0632 \u0628\u0640 2 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u0627\u0644\u064A\u0648\u0645", icon: "\u{1F3C6}", target: 2, type: "wins", rewardCoins: 30, rewardXp: 15 },
  { key: "win_3", titleAr: "\u0627\u0631\u0628\u062D 3 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", descAr: "\u0641\u064F\u0632 \u0628\u0640 3 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u0627\u0644\u064A\u0648\u0645", icon: "\u{1F3C6}", target: 3, type: "wins", rewardCoins: 50, rewardXp: 0 },
  { key: "win_5", titleAr: "\u0627\u0631\u0628\u062D 5 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", descAr: "\u0641\u064F\u0632 \u0628\u0640 5 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u0627\u0644\u064A\u0648\u0645", icon: "\u{1F3C6}", target: 5, type: "wins", rewardCoins: 80, rewardXp: 40 },
  { key: "play_3", titleAr: "\u0627\u0644\u0639\u0628 3 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", descAr: "\u0634\u0627\u0631\u0643 \u0641\u064A 3 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u0627\u0644\u064A\u0648\u0645", icon: "\u{1F3AE}", target: 3, type: "games", rewardCoins: 20, rewardXp: 10 },
  { key: "play_5", titleAr: "\u0627\u0644\u0639\u0628 5 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", descAr: "\u0634\u0627\u0631\u0643 \u0641\u064A 5 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u0627\u0644\u064A\u0648\u0645", icon: "\u{1F3AE}", target: 5, type: "games", rewardCoins: 30, rewardXp: 20 },
  { key: "play_10", titleAr: "\u0627\u0644\u0639\u0628 10 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", descAr: "\u0634\u0627\u0631\u0643 \u0641\u064A 10 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u0627\u0644\u064A\u0648\u0645", icon: "\u{1F3AE}", target: 10, type: "games", rewardCoins: 60, rewardXp: 40 },
  { key: "score_100", titleAr: "\u0627\u0643\u0633\u0628 100 \u0646\u0642\u0637\u0629", descAr: "\u062D\u0635\u0651\u0644 100 \u0646\u0642\u0637\u0629 \u0641\u064A \u0645\u0628\u0627\u0631\u064A\u0627\u062A\u0643", icon: "\u2B50", target: 100, type: "score", rewardCoins: 25, rewardXp: 15 },
  { key: "score_200", titleAr: "\u0627\u0643\u0633\u0628 200 \u0646\u0642\u0637\u0629", descAr: "\u062D\u0635\u0651\u0644 200 \u0646\u0642\u0637\u0629 \u0641\u064A \u0645\u0628\u0627\u0631\u064A\u0627\u062A\u0643", icon: "\u2B50", target: 200, type: "score", rewardCoins: 40, rewardXp: 30 },
  { key: "score_500", titleAr: "\u0627\u0643\u0633\u0628 500 \u0646\u0642\u0637\u0629", descAr: "\u062D\u0635\u0651\u0644 500 \u0646\u0642\u0637\u0629 \u0641\u064A \u0645\u0628\u0627\u0631\u064A\u0627\u062A\u0643", icon: "\u2B50", target: 500, type: "score", rewardCoins: 80, rewardXp: 60 },
  { key: "emoji_5", titleAr: "\u0623\u0631\u0633\u0644 5 \u0631\u0645\u0648\u0632", descAr: "\u0623\u0631\u0633\u0644 5 \u0631\u0633\u0627\u0626\u0644 \u0633\u0631\u064A\u0639\u0629 \u0627\u0644\u064A\u0648\u0645", icon: "\u{1F60A}", target: 5, type: "emojis", rewardCoins: 20, rewardXp: 10 },
  { key: "emoji_10", titleAr: "\u0623\u0631\u0633\u0644 10 \u0631\u0645\u0648\u0632", descAr: "\u0623\u0631\u0633\u0644 10 \u0631\u0633\u0627\u0626\u0644 \u0633\u0631\u064A\u0639\u0629 \u0627\u0644\u064A\u0648\u0645", icon: "\u{1F60A}", target: 10, type: "emojis", rewardCoins: 35, rewardXp: 20 }
];
var TASKS_PER_PLAYER = 3;
var DAILY_TASK_DEFS = TASK_POOL;
var ACHIEVEMENT_DEFS = [
  { key: "first_win", titleAr: "\u0623\u0648\u0644 \u0627\u0646\u062A\u0635\u0627\u0631", descAr: "\u0641\u064F\u0632 \u0628\u0623\u0648\u0644 \u0645\u0628\u0627\u0631\u0627\u0629 \u0644\u0643", target: 1, type: "wins", rewardCoins: 50, rewardXp: 50, icon: "\u{1F947}" },
  { key: "win_10", titleAr: "10 \u0627\u0646\u062A\u0635\u0627\u0631\u0627\u062A", descAr: "\u0627\u0631\u0628\u062D 10 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", target: 10, type: "wins", rewardCoins: 200, rewardXp: 100, icon: "\u{1F3C6}" },
  { key: "win_50", titleAr: "50 \u0627\u0646\u062A\u0635\u0627\u0631\u0627\u064B", descAr: "\u0627\u0631\u0628\u062D 50 \u0645\u0628\u0627\u0631\u0627\u0629", target: 50, type: "wins", rewardCoins: 500, rewardXp: 300, icon: "\u{1F451}" },
  { key: "play_10", titleAr: "10 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", descAr: "\u0634\u0627\u0631\u0643 \u0641\u064A 10 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", target: 10, type: "games", rewardCoins: 100, rewardXp: 50, icon: "\u{1F3AE}" },
  { key: "play_100", titleAr: "100 \u0645\u0628\u0627\u0631\u0627\u0629", descAr: "\u0634\u0627\u0631\u0643 \u0641\u064A 100 \u0645\u0628\u0627\u0631\u0627\u0629", target: 100, type: "games", rewardCoins: 300, rewardXp: 200, icon: "\u{1F4AF}" },
  { key: "level_5", titleAr: "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 5", descAr: "\u0627\u0628\u0644\u063A \u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062E\u0627\u0645\u0633", target: 5, type: "level", rewardCoins: 150, rewardXp: 0, icon: "\u26A1" },
  { key: "level_10", titleAr: "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 10", descAr: "\u0627\u0628\u0644\u063A \u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0639\u0627\u0634\u0631", target: 10, type: "level", rewardCoins: 500, rewardXp: 0, icon: "\u{1F31F}" },
  { key: "streak_3", titleAr: "3 \u0627\u0646\u062A\u0635\u0627\u0631\u0627\u062A \u0645\u062A\u062A\u0627\u0644\u064A\u0629", descAr: "\u0627\u0631\u0628\u062D 3 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u062A\u0648\u0627\u0644\u064A", target: 3, type: "streak", rewardCoins: 100, rewardXp: 75, icon: "\u{1F525}" }
];
var RANDOM_NAME_WORDS = [
  "Lion",
  "Atlas",
  "Falcon",
  "Wolf",
  "Eagle",
  "Tiger",
  "Storm",
  "Blaze",
  "Cobra",
  "Shark",
  "Hawk",
  "Bear",
  "Fox",
  "Lynx",
  "Viper",
  "Phoenix",
  "Raven",
  "Drake",
  "Orion",
  "Zephyr",
  "Titan",
  "Nova",
  "Rex",
  "Ace"
];
function generatePlayerCode() {
  const num = Math.floor(1e5 + Math.random() * 9e5);
  return `WM-${num}`;
}
function generateRandomPlayerName() {
  const word = RANDOM_NAME_WORDS[Math.floor(Math.random() * RANDOM_NAME_WORDS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${word}_${num}`;
}
async function ensurePlayerCode(playerId) {
  let code = generatePlayerCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.select({ id: playerProfiles.id }).from(playerProfiles).where(eq(playerProfiles.playerCode, code));
    if (existing.length === 0) break;
    code = generatePlayerCode();
    attempts++;
  }
  return code;
}
async function generateUniquePlayerTag() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const tag = Math.floor(1e3 + Math.random() * 9e3);
    const existing = await db.select({ id: playerProfiles.id }).from(playerProfiles).where(eq(playerProfiles.playerTag, tag)).limit(1);
    if (existing.length === 0) return tag;
  }
  return Math.floor(1e3 + Math.random() * 9e3);
}
function pickDailyTasks() {
  const shuffled = [...TASK_POOL].sort(() => Math.random() - 0.5);
  const picked = [];
  const usedTypes = /* @__PURE__ */ new Set();
  for (const t of shuffled) {
    if (picked.length >= TASKS_PER_PLAYER) break;
    if (!usedTypes.has(t.type)) {
      picked.push(t);
      usedTypes.add(t.type);
    }
  }
  for (const t of shuffled) {
    if (picked.length >= TASKS_PER_PLAYER) break;
    if (!picked.includes(t)) picked.push(t);
  }
  return picked;
}
async function fixMissingPlayerCodes() {
  try {
    const missing = await db.select({ id: playerProfiles.id }).from(playerProfiles).where(sql2`player_code IS NULL OR player_tag IS NULL`);
    if (missing.length === 0) return;
    console.log(`[fix] Assigning playerCode/playerTag to ${missing.length} players...`);
    for (const { id } of missing) {
      const updates = {};
      updates.playerCode = await ensurePlayerCode(id);
      updates.playerTag = await generateUniquePlayerTag();
      await db.update(playerProfiles).set(updates).where(eq(playerProfiles.id, id));
    }
    console.log(`[fix] Done assigning codes to ${missing.length} players.`);
  } catch (e) {
    console.error("[fix] Failed to fix missing player codes:", e);
  }
}
async function seedTaskAndAchievementDefs() {
  try {
    const existingTasks = await db.select().from(dailyTaskDefs);
    if (existingTasks.length === 0) {
      await db.insert(dailyTaskDefs).values([
        { key: "win_3", titleAr: "\u0627\u0631\u0628\u062D 3 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", descAr: "\u0641\u064F\u0632 \u0628\u0640 3 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u0627\u0644\u064A\u0648\u0645", icon: "\u{1F3C6}", target: 3, type: "wins", rewardCoins: 50, rewardXp: 0 },
        { key: "play_5", titleAr: "\u0627\u0644\u0639\u0628 5 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", descAr: "\u0634\u0627\u0631\u0643 \u0641\u064A 5 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u0627\u0644\u064A\u0648\u0645", icon: "\u{1F3AE}", target: 5, type: "games", rewardCoins: 30, rewardXp: 20 },
        { key: "score_200", titleAr: "\u0627\u0643\u0633\u0628 200 \u0646\u0642\u0637\u0629", descAr: "\u062D\u0635\u0651\u0644 200 \u0646\u0642\u0637\u0629 \u0641\u064A \u0645\u0628\u0627\u0631\u064A\u0627\u062A\u0643", icon: "\u2B50", target: 200, type: "score", rewardCoins: 40, rewardXp: 30 }
      ]);
      console.log("[seed] Inserted default daily task definitions");
    }
    const existingAch = await db.select().from(achievementDefs);
    if (existingAch.length === 0) {
      await db.insert(achievementDefs).values([
        { key: "first_win", titleAr: "\u0623\u0648\u0644 \u0627\u0646\u062A\u0635\u0627\u0631", descAr: "\u0641\u064F\u0632 \u0628\u0623\u0648\u0644 \u0645\u0628\u0627\u0631\u0627\u0629 \u0644\u0643", icon: "\u{1F947}", target: 1, type: "wins", rewardCoins: 50, rewardXp: 50 },
        { key: "win_10", titleAr: "10 \u0627\u0646\u062A\u0635\u0627\u0631\u0627\u062A", descAr: "\u0627\u0631\u0628\u062D 10 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", icon: "\u{1F3C6}", target: 10, type: "wins", rewardCoins: 200, rewardXp: 100 },
        { key: "win_50", titleAr: "50 \u0627\u0646\u062A\u0635\u0627\u0631\u0627\u064B", descAr: "\u0627\u0631\u0628\u062D 50 \u0645\u0628\u0627\u0631\u0627\u0629", icon: "\u{1F451}", target: 50, type: "wins", rewardCoins: 500, rewardXp: 300 },
        { key: "play_10", titleAr: "10 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", descAr: "\u0634\u0627\u0631\u0643 \u0641\u064A 10 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", icon: "\u{1F3AE}", target: 10, type: "games", rewardCoins: 100, rewardXp: 50 },
        { key: "play_100", titleAr: "100 \u0645\u0628\u0627\u0631\u0627\u0629", descAr: "\u0634\u0627\u0631\u0643 \u0641\u064A 100 \u0645\u0628\u0627\u0631\u0627\u0629", icon: "\u{1F4AF}", target: 100, type: "games", rewardCoins: 300, rewardXp: 200 },
        { key: "level_5", titleAr: "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 5", descAr: "\u0627\u0628\u0644\u063A \u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062E\u0627\u0645\u0633", icon: "\u26A1", target: 5, type: "level", rewardCoins: 150, rewardXp: 0 },
        { key: "level_10", titleAr: "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 10", descAr: "\u0627\u0628\u0644\u063A \u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0639\u0627\u0634\u0631", icon: "\u{1F31F}", target: 10, type: "level", rewardCoins: 500, rewardXp: 0 },
        { key: "streak_3", titleAr: "3 \u0627\u0646\u062A\u0635\u0627\u0631\u0627\u062A \u0645\u062A\u062A\u0627\u0644\u064A\u0629", descAr: "\u0627\u0631\u0628\u062D 3 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u062A\u0648\u0627\u0644\u064A", icon: "\u{1F525}", target: 3, type: "streak", rewardCoins: 100, rewardXp: 75 }
      ]);
      console.log("[seed] Inserted default achievement definitions");
    }
  } catch (e) {
    console.error("[seed] Failed to seed task/achievement definitions:", e);
  }
}
var socketRoomMap = /* @__PURE__ */ new Map();
var RAPID_CATEGORIES = ["girlName", "boyName", "animal", "fruit", "vegetable", "object", "city", "country"];
var RAPID_ROUND_TIME = 10;
var RAPID_TOTAL_ROUNDS = 5;
var RAPID_COINS_WIN = 15;
var RAPID_COINS_LOSE = 5;
var RAPID_XP_WIN = 30;
var RAPID_XP_LOSE = 10;
var rapidQueue = [];
var rapidRooms = /* @__PURE__ */ new Map();
function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function getNextRapidLetter(room) {
  if (room.letterIndex >= room.letterQueue.length) {
    room.letterQueue = shuffleArr(ARABIC_LETTERS);
    room.letterIndex = 0;
  }
  return room.letterQueue[room.letterIndex++];
}
function pickRapidCategory(usedCategories = []) {
  const available = RAPID_CATEGORIES.filter((c) => !usedCategories.includes(c));
  const pool2 = available.length > 0 ? available : RAPID_CATEGORIES;
  return pool2[Math.floor(Math.random() * pool2.length)];
}
var TOURNAMENT_SIZE = 8;
var TOURNAMENT_ENTRY_FEE = 100;
var TOURNAMENT_PRIZES = { 1: 500, 2: 200, 3: 100 };
var TOURNAMENT_XP = { 1: 150, 2: 75, 3: 50 };
function getTournamentRounds(maxPlayers) {
  if (maxPlayers === 4) return ["semi", "final"];
  if (maxPlayers === 16) return ["round1", "quarter", "semi", "final"];
  return ["quarter", "semi", "final"];
}
var activeTournaments = /* @__PURE__ */ new Map();
var playerTournamentMap = /* @__PURE__ */ new Map();
var roomTournamentMap = /* @__PURE__ */ new Map();
var tournamentPlayerSocketMap = /* @__PURE__ */ new Map();
function generateTournamentBracket(tournamentId, players, maxPlayers = 8) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const rounds = getTournamentRounds(maxPlayers);
  const matches = [];
  for (let r = 0; r < rounds.length; r++) {
    const roundName = rounds[r];
    const matchCount = maxPlayers / Math.pow(2, r + 1);
    const isFirstRound = r === 0;
    const prefix = roundName === "final" ? "f" : roundName === "semi" ? "s" : roundName === "quarter" ? "q" : "r";
    for (let i = 0; i < matchCount; i++) {
      matches.push({
        id: `${tournamentId}_${prefix}${i}`,
        roundName,
        matchIndex: i,
        player1Id: isFirstRound ? shuffled[i * 2]?.playerId || null : null,
        player1Name: isFirstRound ? shuffled[i * 2]?.name || null : null,
        player2Id: isFirstRound ? shuffled[i * 2 + 1]?.playerId || null : null,
        player2Name: isFirstRound ? shuffled[i * 2 + 1]?.name || null : null,
        winnerId: null,
        winnerName: null,
        roomId: null,
        status: "pending"
      });
    }
  }
  return matches;
}
function advanceTournamentWinner(tournament, matchId, winnerId, winnerName) {
  const match = tournament.matches.find((m) => m.id === matchId);
  if (!match) return;
  match.winnerId = winnerId;
  match.winnerName = winnerName;
  match.status = "completed";
  const loserId = match.player1Id === winnerId ? match.player2Id : match.player1Id;
  if (loserId) {
    const loserPlayer = tournament.players.find((p) => p.playerId === loserId);
    if (loserPlayer) loserPlayer.eliminated = true;
  }
  const rounds = getTournamentRounds(tournament.maxPlayers);
  const currentRoundIdx = rounds.indexOf(match.roundName);
  if (match.roundName === "final") {
    tournament.status = "completed";
    tournament.currentRound = "completed";
  } else if (currentRoundIdx >= 0 && currentRoundIdx < rounds.length - 1) {
    const nextRoundName = rounds[currentRoundIdx + 1];
    const nextMatchIndex = Math.floor(match.matchIndex / 2);
    const nextMatch = tournament.matches.find((m) => m.roundName === nextRoundName && m.matchIndex === nextMatchIndex);
    if (nextMatch) {
      if (match.matchIndex % 2 === 0) {
        nextMatch.player1Id = winnerId;
        nextMatch.player1Name = winnerName;
      } else {
        nextMatch.player2Id = winnerId;
        nextMatch.player2Name = winnerName;
      }
    }
  }
  const currentRoundMatches = tournament.matches.filter((m) => m.roundName === tournament.currentRound);
  const allDone = currentRoundMatches.every((m) => m.status === "completed");
  if (allDone && tournament.status !== "completed") {
    const currentIdx = rounds.indexOf(tournament.currentRound);
    if (currentIdx >= 0 && currentIdx < rounds.length - 1) {
      tournament.currentRound = rounds[currentIdx + 1];
    }
  }
}
async function handleTournamentMatchResult(io, tournamentId, matchId, winnerId, winnerName) {
  const active = activeTournaments.get(tournamentId);
  if (!active) return;
  const match = active.matches.find((m) => m.id === matchId);
  if (!match || match.status === "completed") return;
  if (winnerId !== match.player1Id && winnerId !== match.player2Id) return;
  advanceTournamentWinner(active, matchId, winnerId, winnerName);
  await db.update(tournamentMatches).set({
    winnerId,
    winnerName,
    status: "completed",
    completedAt: /* @__PURE__ */ new Date()
  }).where(eq(tournamentMatches.id, matchId)).catch(() => {
  });
  if (match.roundName === "quarter" || match.roundName === "semi") {
    const nextRoundName = match.roundName === "quarter" ? "semi" : "final";
    const nextIdx = match.roundName === "quarter" ? Math.floor(match.matchIndex / 2) : 0;
    const slot = match.roundName === "quarter" ? match.matchIndex % 2 === 0 ? "player1" : "player2" : match.matchIndex === 0 ? "player1" : "player2";
    const nextMatch = active.matches.find((m) => m.roundName === nextRoundName && m.matchIndex === nextIdx);
    if (nextMatch) {
      const p1Update = slot === "player1" ? { player1Id: winnerId, player1Name: winnerName } : {};
      const p2Update = slot === "player2" ? { player2Id: winnerId, player2Name: winnerName } : {};
      await db.update(tournamentMatches).set({ ...p1Update, ...p2Update }).where(eq(tournamentMatches.id, nextMatch.id)).catch(() => {
      });
    }
  }
  if (active.status === "completed") {
    await db.update(tournaments).set({
      status: "completed",
      winnerId,
      winnerName,
      completedAt: /* @__PURE__ */ new Date()
    }).where(eq(tournaments.id, tournamentId)).catch(() => {
    });
    const finalMatch = active.matches.find((m) => m.roundName === "final");
    const finalLoserId = finalMatch ? finalMatch.player1Id === winnerId ? finalMatch.player2Id : finalMatch.player1Id : null;
    const semiLosers = active.matches.filter((m) => m.roundName === "semi" && m.winnerId).map((m) => m.player1Id === m.winnerId ? m.player2Id : m.player1Id).filter(Boolean);
    const placements = [
      { pid: winnerId, rank: 1 }
    ];
    if (finalLoserId) placements.push({ pid: finalLoserId, rank: 2 });
    for (const sl of semiLosers) {
      if (sl !== winnerId && sl !== finalLoserId) {
        placements.push({ pid: sl, rank: 3 });
      }
    }
    for (const { pid, rank } of placements) {
      const prize = TOURNAMENT_PRIZES[rank] || 0;
      const xp = TOURNAMENT_XP[rank] || 0;
      try {
        const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, pid));
        if (profile) {
          await db.update(playerProfiles).set({
            coins: profile.coins + prize,
            xp: profile.xp + xp,
            level: Math.floor((profile.xp + xp) / 100) + 1,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq(playerProfiles.id, pid));
        }
      } catch {
      }
      await db.update(tournamentPlayers).set({ placement: rank }).where(
        and(eq(tournamentPlayers.tournamentId, tournamentId), eq(tournamentPlayers.playerId, pid))
      ).catch(() => {
      });
    }
    for (const p of active.players) {
      playerTournamentMap.delete(p.playerId);
      tournamentPlayerSocketMap.delete(p.playerId);
    }
    activeTournaments.delete(tournamentId);
  } else {
    const readyMatches = active.matches.filter(
      (m) => m.roundName === active.currentRound && m.status === "pending" && m.player1Id && m.player2Id
    );
    if (readyMatches.length > 0) {
      setTimeout(() => startTournamentRoundMatches(io, active), 5e3);
    }
  }
  io.emit("tournament_update", {
    tournamentId,
    matches: active.matches,
    currentRound: active.currentRound,
    status: active.status,
    winnerId: active.status === "completed" ? winnerId : null,
    winnerName: active.status === "completed" ? winnerName : null
  });
}
function startTournamentRoundMatches(io, tournament) {
  const roundMatches = tournament.matches.filter(
    (m) => m.roundName === tournament.currentRound && m.status === "pending" && m.player1Id && m.player2Id
  );
  for (const match of roundMatches) {
    const p1 = tournament.players.find((p) => p.playerId === match.player1Id);
    const p2 = tournament.players.find((p) => p.playerId === match.player2Id);
    if (!p1 || !p2) continue;
    const room = createRoom(p1.socketId, p1.name, p1.skin);
    joinRoom(room.id, p2.socketId, p2.name, p2.skin);
    match.roomId = room.id;
    match.status = "in_progress";
    roomTournamentMap.set(room.id, { tournamentId: tournament.id, matchId: match.id });
    const s1 = io.sockets.sockets.get(p1.socketId);
    const s2 = io.sockets.sockets.get(p2.socketId);
    if (s1) {
      s1.join(room.id);
      socketRoomMap.set(p1.socketId, room.id);
    }
    if (s2) {
      s2.join(room.id);
      socketRoomMap.set(p2.socketId, room.id);
    }
    const roomPlayers = room.players.map((p) => ({ id: p.id, name: p.name, skin: p.skin }));
    emitCountdownThenStart(io, room.id, roomPlayers, () => {
      const gameResult = startGame(room.id);
      if (!gameResult.success || !gameResult.room) return;
      const gameData = {
        roomId: room.id,
        letter: gameResult.room.currentLetter,
        round: gameResult.room.currentRound,
        totalRounds: gameResult.room.totalRounds,
        players: gameResult.room.players.map((p) => ({ id: p.id, name: p.name, skin: p.skin })),
        coinEntry: 0,
        tournamentId: tournament.id,
        tournamentRound: match.roundName
      };
      io.to(room.id).emit("matchFound", gameData);
      gameResult.room.timer = setTimeout(() => {
        const results = calculateRoundScores(room.id);
        const updatedRoom = getRoom(room.id);
        if (!updatedRoom) return;
        io.to(room.id).emit("round_results", {
          results,
          round: updatedRoom.currentRound,
          totalRounds: updatedRoom.totalRounds,
          players: updatedRoom.players.map((p) => ({ id: p.id, name: p.name, score: p.score }))
        });
      }, 51e3);
    });
  }
}
function emitCountdownThenStart(io, roomId, players, onStart) {
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
  }, 1e3);
}
var matchmakingQueue = [];
var COIN_ENTRY_OPTIONS = [
  { entry: 50, reward: 100 },
  { entry: 100, reward: 200 },
  { entry: 500, reward: 1e3 },
  { entry: 1e3, reward: 2500 }
];
var SPIN_REWARDS = [
  { type: "coins", amount: 50, label: "50 \u0639\u0645\u0644\u0629", weight: 25 },
  { type: "coins", amount: 100, label: "100 \u0639\u0645\u0644\u0629", weight: 18 },
  { type: "coins", amount: 200, label: "200 \u0639\u0645\u0644\u0629", weight: 10 },
  { type: "coins", amount: 500, label: "500 \u0639\u0645\u0644\u0629", weight: 3 },
  { type: "xp", amount: 100, label: "100 XP", weight: 20 },
  { type: "xp", amount: 200, label: "200 XP", weight: 10 },
  { type: "powerCard", amount: 1, label: "\u0628\u0637\u0627\u0642\u0629 \u0642\u0648\u0629", weight: 14 }
];
var STREAK_MILESTONES = [
  { wins: 3, reward: 50 },
  { wins: 5, reward: 100 },
  { wins: 10, reward: 300 }
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
var roomCoinEntries = /* @__PURE__ */ new Map();
var roomPendingDeductions = /* @__PURE__ */ new Map();
async function registerRoutes(app2) {
  const httpServer = createServer(app2);
  seedTaskAndAchievementDefs();
  fixMissingPlayerCodes();
  app2.get("/api/words", (req, res) => {
    const letter = req.query.letter;
    if (!letter) return res.status(400).json({ error: "letter required" });
    const result = {};
    for (const [gameKey, dbCategory] of Object.entries(CATEGORY_MAP)) {
      result[gameKey] = getWordsForLetter(dbCategory, letter);
    }
    return res.json(result);
  });
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
          socketRoomMap.set(socket.id, room.id);
          console.log(`[create_room] Socket ${socket.id} created room ${room.id}. Players: ${room.players.map((p) => p.name).join(", ")}`);
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
          const uniquePlayers = result.room.players.filter(
            (p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx
          );
          result.room.players = uniquePlayers;
          socket.join(data.roomId);
          socketRoomMap.set(socket.id, data.roomId);
          console.log(`[join_room] Socket ${socket.id} joined room ${data.roomId}. Players (${result.room.players.length}): ${result.room.players.map((p) => p.name).join(", ")}`);
          cb({ success: true, room: sanitizeRoom(result.room) });
          io.to(data.roomId).emit("room_updated", sanitizeRoom(result.room));
          io.to(data.roomId).emit("player_joined", { playerName: data.playerName });
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
            const tournamentInfo = roomTournamentMap.get(data.roomId);
            io.to(data.roomId).emit("game_over", {
              players: room.players.map((p) => ({
                id: p.id,
                name: p.name,
                score: p.score,
                coins: p.coins,
                skin: p.skin
              })),
              tournamentId: tournamentInfo?.tournamentId || null,
              tournamentMatchId: tournamentInfo?.matchId || null
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
          const existingRoomId = socketRoomMap.get(socket.id);
          if (existingRoomId) {
            const existingRoom = getRoom(existingRoomId);
            if (existingRoom && existingRoom.state === "waiting") {
              console.log(`[quick_match] Socket ${socket.id} already in room ${existingRoomId}, skipping duplicate join. Players: ${existingRoom.players.map((p) => p.name).join(", ")}`);
              cb({ success: true, roomId: existingRoomId, room: sanitizeRoom(existingRoom), created: false });
              return;
            }
            socketRoomMap.delete(socket.id);
          }
          const availableRoom = findAvailableRoom();
          if (availableRoom) {
            const result = joinRoom(availableRoom.id, socket.id, data.playerName, data.playerSkin);
            if (result.success && result.room) {
              socket.join(availableRoom.id);
              socketRoomMap.set(socket.id, availableRoom.id);
              console.log(`[quick_match] Socket ${socket.id} joined existing room ${availableRoom.id}. Players: ${result.room.players.map((p) => p.name).join(", ")}`);
              cb({ success: true, roomId: availableRoom.id, room: sanitizeRoom(result.room), created: false });
              io.to(availableRoom.id).emit("room_updated", sanitizeRoom(result.room));
              io.to(availableRoom.id).emit("player_joined", { playerName: data.playerName });
            } else {
              const newRoom = createRoom(socket.id, data.playerName, data.playerSkin);
              socket.join(newRoom.id);
              socketRoomMap.set(socket.id, newRoom.id);
              console.log(`[quick_match] Socket ${socket.id} created new room ${newRoom.id} (fallback). Players: ${newRoom.players.map((p) => p.name).join(", ")}`);
              cb({ success: true, roomId: newRoom.id, room: sanitizeRoom(newRoom), created: true });
              io.to(newRoom.id).emit("room_updated", sanitizeRoom(newRoom));
            }
          } else {
            const newRoom = createRoom(socket.id, data.playerName, data.playerSkin);
            socket.join(newRoom.id);
            socketRoomMap.set(socket.id, newRoom.id);
            console.log(`[quick_match] Socket ${socket.id} created new room ${newRoom.id}. Players: ${newRoom.players.map((p) => p.name).join(", ")}`);
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
        socketRoomMap.delete(socket.id);
        console.log(`[leave_room] Socket ${socket.id} left room ${data.roomId}. Remaining: ${room ? room.players.map((p) => p.name).join(", ") : "room deleted"}`);
        if (room) {
          io.to(data.roomId).emit("room_updated", sanitizeRoom(room));
          io.to(data.roomId).emit("player_left", { playerId: socket.id });
        }
      }
    );
    socket.on("forfeit_match", (data) => {
      const room = getRoom(data.roomId);
      if (!room) return;
      console.log(`[forfeit_match] Socket ${socket.id} forfeited room ${data.roomId}`);
      const gameOverPlayers = room.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.id === socket.id ? 0 : Math.max(p.score || 0, 50),
        coins: p.id === socket.id ? 0 : 30,
        skin: p.skin || "student",
        forfeited: p.id === socket.id
      }));
      io.to(data.roomId).emit("game_over", { players: gameOverPlayers, forfeitedBy: socket.id });
      removePlayer(data.roomId, socket.id);
      socket.leave(data.roomId);
      socketRoomMap.delete(socket.id);
    });
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
    socket.on(
      "findMatch",
      async (data) => {
        if (data.mode === "rapid") {
          handleRapidJoin(socket.id, data.playerName, data.playerSkin, data.playerId);
          return;
        }
        if (matchmakingQueue.find((p) => p.id === socket.id)) {
          console.log(`[findMatch] Socket ${socket.id} already in queue \u2013 ignored`);
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
          } catch {
          }
        }
        const entry = { id: socket.id, name: data.playerName, skin: data.playerSkin, coinEntry: requestedEntry, playerId: data.playerId };
        matchmakingQueue.push(entry);
        console.log(`[findMatch] Queue: ${matchmakingQueue.map((p) => `${p.name}(${p.coinEntry || 0})`).join(", ")} (${matchmakingQueue.length} players)`);
        const myCoinEntry = entry.coinEntry || 0;
        const matchIdx = matchmakingQueue.findIndex((p) => p.id !== socket.id && (p.coinEntry || 0) === myCoinEntry);
        if (matchIdx !== -1) {
          const opponent = matchmakingQueue[matchIdx];
          matchmakingQueue = matchmakingQueue.filter((p) => p.id !== socket.id && p.id !== opponent.id);
          const matched = [entry, opponent];
          console.log(`[findMatch] Match created: ${matched.map((p) => p.name).join(" vs ")} (entry: ${myCoinEntry})`);
          const room = createRoom(matched[0].id, matched[0].name, matched[0].skin);
          joinRoom(room.id, matched[1].id, matched[1].name, matched[1].skin);
          if (myCoinEntry > 0) {
            roomCoinEntries.set(room.id, myCoinEntry);
            roomPendingDeductions.set(room.id, matched.filter((p) => !!p.playerId).map((p) => p.playerId));
          }
          for (const player of matched) {
            const s = io.sockets.sockets.get(player.id);
            if (s) {
              s.join(room.id);
              socketRoomMap.set(player.id, room.id);
            }
          }
          const roomPlayers = room.players.map((p) => ({ id: p.id, name: p.name, skin: p.skin }));
          console.log(`[findMatch] Countdown starting for room ${room.id}`);
          emitCountdownThenStart(io, room.id, roomPlayers, async () => {
            const pendingPlayerIds = roomPendingDeductions.get(room.id);
            if (pendingPlayerIds && myCoinEntry > 0) {
              for (const pid of pendingPlayerIds) {
                try {
                  const [p] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, pid));
                  if (p) {
                    await db.update(playerProfiles).set({ coins: Math.max(0, p.coins - myCoinEntry), updatedAt: /* @__PURE__ */ new Date() }).where(eq(playerProfiles.id, pid));
                  }
                } catch {
                }
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
              coinEntry: myCoinEntry
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
                players: updatedRoom.players.map((p) => ({ id: p.id, name: p.name, score: p.score }))
              });
            }, 51e3);
          });
        }
      }
    );
    socket.on("cancelMatch", () => {
      matchmakingQueue = matchmakingQueue.filter((p) => p.id !== socket.id);
      console.log(`[cancelMatch] Socket ${socket.id} removed from queue. Queue: ${matchmakingQueue.length}`);
    });
    socket.on("quick_chat", (data) => {
      socket.to(data.roomId).emit("quick_chat", { message: data.message, playerName: data.playerName });
    });
    socket.on("power_card", (data) => {
      socket.to(data.roomId).emit("power_card", { type: data.type, playerName: data.playerName });
    });
    socket.on("voice_data", (data) => {
      socket.to(data.roomId).emit("voice_data", { audio: data.audio, from: socket.id, isSpeaking: data.isSpeaking });
    });
    socket.on("tournament_register_socket", (data) => {
      tournamentPlayerSocketMap.set(data.playerId, socket.id);
      const tournamentId = playerTournamentMap.get(data.playerId);
      if (tournamentId) {
        const active = activeTournaments.get(tournamentId);
        if (active) {
          const player = active.players.find((p) => p.playerId === data.playerId);
          if (player) player.socketId = socket.id;
        }
      }
    });
    socket.on("tournament_match_result", async (data) => {
      try {
        const active = activeTournaments.get(data.tournamentId);
        if (!active) return;
        const match = active.matches.find((m) => m.id === data.matchId);
        if (!match || match.status === "completed") return;
        if (data.winnerId !== match.player1Id && data.winnerId !== match.player2Id) return;
        await handleTournamentMatchResult(io, data.tournamentId, data.matchId, data.winnerId, data.winnerName);
        roomTournamentMap.delete(data.roomId);
      } catch (e) {
        console.error("tournament_match_result error:", e);
      }
    });
    function handleRapidJoin(socketId, playerName, playerSkin, playerId) {
      if (rapidQueue.find((p) => p.id === socketId)) return;
      const entry = { id: socketId, name: playerName, skin: playerSkin, playerId };
      rapidQueue.push(entry);
      console.log(`[rapid_join] Queue: ${rapidQueue.length}`);
      const matchIdx = rapidQueue.findIndex((p) => p.id !== socketId);
      if (matchIdx === -1) return;
      const opponent = rapidQueue[matchIdx];
      rapidQueue = rapidQueue.filter((p) => p.id !== socketId && p.id !== opponent.id);
      const roomId = "rapid_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      const rapidRoom = {
        id: roomId,
        players: [
          { socketId: entry.id, name: entry.name, skin: entry.skin, playerId: entry.playerId },
          { socketId: opponent.id, name: opponent.name, skin: opponent.skin, playerId: opponent.playerId }
        ],
        scores: { [entry.id]: 0, [opponent.id]: 0 },
        currentRound: 0,
        currentLetter: "",
        currentCategory: "",
        roundTimer: null,
        roundWon: false,
        lastAttempts: {},
        letterQueue: shuffleArr(ARABIC_LETTERS),
        letterIndex: 0
      };
      rapidRooms.set(roomId, rapidRoom);
      const s1 = io.sockets.sockets.get(entry.id);
      const s2 = io.sockets.sockets.get(opponent.id);
      if (s1) s1.join(roomId);
      if (s2) s2.join(roomId);
      io.to(entry.id).emit("rapid_start", {
        rapidRoomId: roomId,
        opponent: { id: opponent.id, name: opponent.name, skin: opponent.skin }
      });
      io.to(opponent.id).emit("rapid_start", {
        rapidRoomId: roomId,
        opponent: { id: entry.id, name: entry.name, skin: entry.skin }
      });
      console.log(`[rapid] Match: ${entry.name} vs ${opponent.name} in ${roomId}`);
      setTimeout(() => startRapidRound(io, roomId), 3500);
    }
    socket.on("rapid_join", (data) => {
      handleRapidJoin(socket.id, data.playerName, data.playerSkin, data.playerId);
    });
    socket.on("rapid_cancel", () => {
      rapidQueue = rapidQueue.filter((p) => p.id !== socket.id);
      console.log(`[rapid_cancel] Socket ${socket.id} removed from rapid queue`);
    });
    socket.on("rapid_word", (data) => {
      const room = rapidRooms.get(data.rapidRoomId);
      if (!room || room.roundWon) return;
      if (!room.players.some((p) => p.socketId === socket.id)) return;
      if (data.category !== room.currentCategory) {
        socket.emit("rapid_word_result", { valid: false, reason: "wrong_category" });
        return;
      }
      const dbCategory = CATEGORY_MAP[room.currentCategory];
      if (!dbCategory) {
        socket.emit("rapid_word_result", { valid: false, reason: "unknown_category" });
        return;
      }
      room.lastAttempts[socket.id] = data.word;
      const validation = validateWord(data.word, dbCategory, room.currentLetter);
      if (!validation.valid) {
        socket.emit("rapid_word_result", { valid: false, reason: validation.reason });
        return;
      }
      room.roundWon = true;
      socket.emit("rapid_word_result", { valid: true });
      room.scores[socket.id] = (room.scores[socket.id] || 0) + 1;
      if (room.roundTimer) {
        clearTimeout(room.roundTimer);
        room.roundTimer = null;
      }
      const resultData = {
        round: room.currentRound,
        winnerId: socket.id,
        winnerName: room.players.find((p) => p.socketId === socket.id)?.name || "",
        word: data.word,
        category: data.category,
        scores: { ...room.scores },
        isDraw: false,
        attempts: { ...room.lastAttempts }
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
    socket.on("rapid_leave", (data) => {
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
    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
      matchmakingQueue = matchmakingQueue.filter((p) => p.id !== socket.id);
      rapidQueue = rapidQueue.filter((p) => p.id !== socket.id);
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
      const trackedRoomId = socketRoomMap.get(socket.id);
      socketRoomMap.delete(socket.id);
      const roomsToUpdate = /* @__PURE__ */ new Set();
      if (trackedRoomId) {
        roomsToUpdate.add(trackedRoomId);
      }
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          roomsToUpdate.add(roomId);
        }
      }
      for (const roomId of roomsToUpdate) {
        const room = removePlayer(roomId, socket.id);
        console.log(`[disconnect] Removed socket ${socket.id} from room ${roomId}. Remaining: ${room ? room.players.map((p) => p.name).join(", ") : "room deleted"}`);
        if (room) {
          io.to(roomId).emit("room_updated", sanitizeRoom(room));
          io.to(roomId).emit("player_left", { playerId: socket.id });
        }
      }
    });
  });
  function startRapidRound(ioRef, roomId) {
    const room = rapidRooms.get(roomId);
    if (!room) return;
    room.currentRound += 1;
    room.currentLetter = getNextRapidLetter(room);
    room.currentCategory = pickRapidCategory();
    room.roundWon = false;
    room.lastAttempts = {};
    ioRef.to(roomId).emit("rapid_letter", {
      round: room.currentRound,
      letter: room.currentLetter,
      category: room.currentCategory,
      timeLimit: RAPID_ROUND_TIME
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
        attempts: { ...room.lastAttempts }
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
    }, RAPID_ROUND_TIME * 1e3);
  }
  function endRapidGame(ioRef, roomId) {
    const room = rapidRooms.get(roomId);
    if (!room) return;
    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = null;
    }
    const scores = room.scores;
    const playerIds = Object.keys(scores);
    let winnerId = null;
    if (playerIds.length === 2) {
      if (scores[playerIds[0]] > scores[playerIds[1]]) winnerId = playerIds[0];
      else if (scores[playerIds[1]] > scores[playerIds[0]]) winnerId = playerIds[1];
    }
    const rewards = {};
    for (const pid of playerIds) {
      if (pid === winnerId) {
        rewards[pid] = { coins: RAPID_COINS_WIN, xp: RAPID_XP_WIN };
      } else {
        rewards[pid] = { coins: RAPID_COINS_LOSE, xp: RAPID_XP_LOSE };
      }
    }
    if (!winnerId) {
      for (const pid of playerIds) {
        rewards[pid] = { coins: RAPID_COINS_LOSE, xp: RAPID_XP_LOSE };
      }
    }
    for (const pid of playerIds) {
      const s = ioRef.sockets.sockets.get(pid);
      if (s) {
        s.emit("rapid_game_over", {
          winnerId,
          scores: { ...scores },
          coinsEarned: rewards[pid].coins,
          xpEarned: rewards[pid].xp
        });
      }
    }
    console.log(`[rapid] Game over in ${roomId}: winner=${winnerId || "draw"}`);
    rapidRooms.delete(roomId);
  }
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
  app2.get("/api/daily-tasks", async (_req, res) => {
    try {
      const tasks = await db.select().from(dailyTaskDefs);
      if (tasks.length === 0) {
        await seedTaskAndAchievementDefs();
        const seeded = await db.select().from(dailyTaskDefs);
        return res.json(seeded);
      }
      res.json(tasks);
    } catch (e) {
      console.error("GET /api/daily-tasks error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/achievements", async (_req, res) => {
    try {
      const achievements = await db.select().from(achievementDefs);
      if (achievements.length === 0) {
        await seedTaskAndAchievementDefs();
        const seeded = await db.select().from(achievementDefs);
        return res.json(seeded);
      }
      res.json(achievements);
    } catch (e) {
      console.error("GET /api/achievements error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/player/:id", async (req, res) => {
    try {
      let [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, req.params.id));
      if (!profile) {
        const playerCode = await ensurePlayerCode(req.params.id);
        const randomName = generateRandomPlayerName();
        const playerTag = await generateUniquePlayerTag();
        [profile] = await db.insert(playerProfiles).values({
          id: req.params.id,
          playerCode,
          playerTag,
          name: randomName
        }).returning();
      } else {
        const updates = {};
        if (!profile.playerCode) updates.playerCode = await ensurePlayerCode(req.params.id);
        if (!profile.playerTag) updates.playerTag = await generateUniquePlayerTag();
        if (Object.keys(updates).length > 0) {
          [profile] = await db.update(playerProfiles).set(updates).where(eq(playerProfiles.id, req.params.id)).returning();
        }
      }
      res.json(profile);
    } catch (e) {
      console.error("GET /api/player error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.put("/api/player/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const data = req.body;
      const [existing] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, id));
      if (!existing) {
        const playerCode = await ensurePlayerCode(id);
        const playerTag = await generateUniquePlayerTag();
        const [created] = await db.insert(playerProfiles).values({
          id,
          playerCode,
          playerTag,
          name: data.name || generateRandomPlayerName(),
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
          lastStreakReward: data.lastStreakReward ?? 0
        }).returning();
        return res.json(created);
      }
      const updateData = { updatedAt: /* @__PURE__ */ new Date() };
      if (!existing.playerCode) updateData.playerCode = await ensurePlayerCode(id);
      if (!existing.playerTag) updateData.playerTag = await generateUniquePlayerTag();
      const allowedFields = ["name", "coins", "xp", "level", "equippedSkin", "ownedSkins", "equippedTitle", "ownedTitles", "totalScore", "gamesPlayed", "wins", "winStreak", "bestStreak", "lastStreakReward", "powerCards"];
      for (const key of allowedFields) {
        if (data[key] !== void 0) updateData[key] = data[key];
      }
      const [updated] = await db.update(playerProfiles).set(updateData).where(eq(playerProfiles.id, id)).returning();
      res.json(updated);
    } catch (e) {
      console.error("PUT /api/player error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.patch("/api/player/change-name", async (req, res) => {
    try {
      const { player_id, new_name } = req.body;
      if (!player_id || !new_name || new_name.trim().length === 0) {
        return res.status(400).json({ error: "missing_fields" });
      }
      const trimmed = new_name.trim();
      const [updated] = await db.update(playerProfiles).set({ name: trimmed, updatedAt: /* @__PURE__ */ new Date() }).where(eq(playerProfiles.id, player_id)).returning();
      if (!updated) return res.status(404).json({ error: "player_not_found" });
      res.json({ success: true, name: updated.name });
    } catch (e) {
      console.error("PATCH /api/player/change-name error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/player/:id/spin", async (req, res) => {
    try {
      const id = req.params.id;
      let [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, id));
      if (!profile) {
        [profile] = await db.insert(playerProfiles).values({ id }).returning();
      }
      if (profile.lastSpinAt) {
        const elapsed = Date.now() - new Date(profile.lastSpinAt).getTime();
        if (elapsed < 24 * 60 * 60 * 1e3) {
          const nextSpinAt = new Date(profile.lastSpinAt).getTime() + 24 * 60 * 60 * 1e3;
          return res.status(429).json({ error: "too_early", nextSpinAt });
        }
      }
      const reward = pickSpinReward();
      const updates = { lastSpinAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() };
      if (reward.type === "coins") {
        updates.coins = profile.coins + reward.amount;
      } else if (reward.type === "xp") {
        updates.xp = profile.xp + reward.amount;
        updates.level = Math.floor((profile.xp + reward.amount) / 100) + 1;
      } else if (reward.type === "powerCard") {
        const currentCards = profile.powerCards || {};
        const cardKeys = ["time", "freeze", "hint"];
        const randomCard = cardKeys[Math.floor(Math.random() * cardKeys.length)];
        updates.powerCards = { ...currentCards, [randomCard]: (currentCards[randomCard] || 0) + 1 };
      }
      const [updated] = await db.update(playerProfiles).set(updates).where(eq(playerProfiles.id, id)).returning();
      await db.insert(dailySpins).values({
        playerId: id,
        rewardType: reward.type,
        rewardAmount: reward.amount
      }).catch(() => {
      });
      res.json({ reward, profile: updated });
    } catch (e) {
      console.error("POST /api/player/:id/spin error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/player/:id/streak", async (req, res) => {
    try {
      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, req.params.id));
      if (!profile) {
        return res.json({ winStreak: 0, bestStreak: 0, lastStreakReward: 0, milestones: STREAK_MILESTONES });
      }
      res.json({
        winStreak: profile.winStreak,
        bestStreak: profile.bestStreak,
        lastStreakReward: profile.lastStreakReward,
        milestones: STREAK_MILESTONES
      });
    } catch (e) {
      console.error("GET /api/player/:id/streak error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/player/:id/game-result", async (req, res) => {
    try {
      const id = req.params.id;
      const { won, coinEntry } = req.body;
      const score = Number(req.body.score) || 0;
      const coinsEarned = Number(req.body.coinsEarned) || 0;
      const xpEarned = Number(req.body.xpEarned) || 0;
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
          milestone: newLastReward
        }).catch(() => {
        });
      }
      const coinEntryReward = won && coinEntry ? COIN_ENTRY_OPTIONS.find((o) => o.entry === coinEntry)?.reward || 0 : 0;
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
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(playerProfiles.id, id)).returning();
      res.json({ profile: updated, streakBonus, coinEntryReward });
      Promise.all([
        syncTaskProgress(id, updated).catch(() => {
        }),
        syncAchievementProgress(id, updated).catch(() => {
        })
      ]).catch(() => {
      });
    } catch (e) {
      console.error("POST /api/player/:id/game-result error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/coin-entries", (_req, res) => {
    res.json(COIN_ENTRY_OPTIONS);
  });
  app2.get("/api/spin-rewards", (_req, res) => {
    res.json(SPIN_REWARDS.map((r) => ({ type: r.type, amount: r.amount, label: r.label })));
  });
  app2.get("/api/tournaments/open", async (_req, res) => {
    try {
      const openTournaments = await db.select().from(tournaments).where(eq(tournaments.status, "open")).orderBy(desc(tournaments.createdAt));
      const result = [];
      for (const t of openTournaments) {
        const players = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, t.id)).orderBy(asc(tournamentPlayers.joinedAt));
        const maxP = t.maxPlayers ?? TOURNAMENT_SIZE;
        result.push({
          ...t,
          playerCount: players.length,
          maxPlayers: maxP,
          entryFee: t.entryFee,
          hostPlayerName: players[0]?.playerName ?? null
        });
      }
      res.json(result);
    } catch (e) {
      console.error("GET /api/tournaments/open error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/tournament/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const active = activeTournaments.get(id);
      if (active) {
        return res.json({
          id: active.id,
          status: active.status,
          currentRound: active.currentRound,
          maxPlayers: active.maxPlayers,
          players: active.players.map((p) => ({ playerId: p.playerId, name: p.name, skin: p.skin, eliminated: p.eliminated })),
          matches: active.matches,
          prizes: TOURNAMENT_PRIZES
        });
      }
      const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id));
      if (!t) return res.status(404).json({ error: "not_found" });
      const players = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, id));
      const matches = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
      res.json({
        ...t,
        players: players.map((p) => ({ playerId: p.playerId, name: p.playerName, skin: p.playerSkin, eliminated: p.eliminated === 1 })),
        matches: matches.map((m) => ({
          id: m.id,
          roundName: m.roundName,
          matchIndex: m.matchIndex,
          player1Id: m.player1Id,
          player1Name: m.player1Name,
          player2Id: m.player2Id,
          player2Name: m.player2Name,
          winnerId: m.winnerId,
          winnerName: m.winnerName,
          roomId: m.roomId,
          status: m.status
        })),
        prizes: TOURNAMENT_PRIZES
      });
    } catch (e) {
      console.error("GET /api/tournament/:id error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/tournament/create", async (req, res) => {
    try {
      const rawSize = Number(req.body?.maxPlayers);
      const maxPlayers = [4, 8, 16].includes(rawSize) ? rawSize : 8;
      const [t] = await db.insert(tournaments).values({
        entryFee: TOURNAMENT_ENTRY_FEE,
        prizePool: 0,
        status: "open",
        maxPlayers
      }).returning();
      io.emit("tournament_created", {
        id: t.id,
        status: "open",
        playerCount: 0,
        maxPlayers,
        entryFee: TOURNAMENT_ENTRY_FEE,
        prizePool: 0,
        createdAt: t.createdAt,
        hostPlayerName: null
      });
      res.json(t);
    } catch (e) {
      console.error("POST /api/tournament/create error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/tournament/:id/join", async (req, res) => {
    try {
      const tournamentId = req.params.id;
      const { playerId, playerName, playerSkin, socketId } = req.body;
      const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
      if (!t) return res.status(404).json({ error: "not_found" });
      if (t.status !== "open") return res.status(400).json({ error: "tournament_closed" });
      const existingPlayers = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, tournamentId));
      if (existingPlayers.some((p) => p.playerId === playerId)) return res.status(400).json({ error: "already_joined" });
      const maxCapacity = t.maxPlayers ?? TOURNAMENT_SIZE;
      if (existingPlayers.length >= maxCapacity) return res.status(400).json({ error: "tournament_full" });
      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (!profile || profile.coins < TOURNAMENT_ENTRY_FEE) return res.status(400).json({ error: "insufficient_coins" });
      await db.update(playerProfiles).set({ coins: profile.coins - TOURNAMENT_ENTRY_FEE, updatedAt: /* @__PURE__ */ new Date() }).where(eq(playerProfiles.id, playerId));
      const seed = existingPlayers.length + 1;
      await db.insert(tournamentPlayers).values({ tournamentId, playerId, playerName, playerSkin, seed });
      tournamentPlayerSocketMap.set(playerId, socketId);
      const newPrizePool = t.prizePool + TOURNAMENT_ENTRY_FEE;
      await db.update(tournaments).set({ prizePool: newPrizePool }).where(eq(tournaments.id, tournamentId));
      const allPlayers = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, tournamentId));
      const maxP = t.maxPlayers ?? TOURNAMENT_SIZE;
      if (allPlayers.length >= maxP) {
        await db.update(tournaments).set({ status: "in_progress", startedAt: /* @__PURE__ */ new Date() }).where(eq(tournaments.id, tournamentId));
        const bracket = generateTournamentBracket(tournamentId, allPlayers.map((p) => ({ playerId: p.playerId, name: p.playerName })), maxP);
        for (const m of bracket) {
          await db.insert(tournamentMatches).values({
            id: m.id,
            tournamentId,
            roundName: m.roundName,
            matchIndex: m.matchIndex,
            player1Id: m.player1Id,
            player1Name: m.player1Name,
            player2Id: m.player2Id,
            player2Name: m.player2Name,
            status: m.status
          });
        }
        const activePlayers = allPlayers.map((p) => ({
          playerId: p.playerId,
          socketId: tournamentPlayerSocketMap.get(p.playerId) || "",
          name: p.playerName,
          skin: p.playerSkin,
          eliminated: false
        }));
        const rounds = getTournamentRounds(maxP);
        const active = {
          id: tournamentId,
          maxPlayers: maxP,
          players: activePlayers,
          matches: bracket,
          currentRound: rounds[0],
          status: "in_progress"
        };
        activeTournaments.set(tournamentId, active);
        for (const p of allPlayers) {
          playerTournamentMap.set(p.playerId, tournamentId);
        }
        io.emit("tournament_started", { tournamentId, bracket, players: activePlayers.map((p) => ({ playerId: p.playerId, name: p.name, skin: p.skin })) });
        setTimeout(() => startTournamentRoundMatches(io, active), 3e3);
      }
      io.emit("tournament_player_joined", { tournamentId, playerCount: allPlayers.length, maxPlayers: maxP, playerName });
      res.json({ success: true, playerCount: allPlayers.length, coins: profile.coins - TOURNAMENT_ENTRY_FEE });
    } catch (e) {
      console.error("POST /api/tournament/:id/join error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/tournament/:id/leave", async (req, res) => {
    try {
      const tournamentId = req.params.id;
      const { playerId } = req.body;
      const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
      if (!t) return res.status(404).json({ error: "not_found" });
      if (t.status !== "open") return res.status(400).json({ error: "tournament_already_started" });
      const [existing] = await db.select().from(tournamentPlayers).where(
        and(eq(tournamentPlayers.tournamentId, tournamentId), eq(tournamentPlayers.playerId, playerId))
      );
      if (!existing) return res.status(400).json({ error: "not_in_tournament" });
      const playerName = existing.playerName;
      await db.delete(tournamentPlayers).where(
        and(eq(tournamentPlayers.tournamentId, tournamentId), eq(tournamentPlayers.playerId, playerId))
      );
      tournamentPlayerSocketMap.delete(playerId);
      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (profile) {
        await db.update(playerProfiles).set({
          coins: profile.coins + TOURNAMENT_ENTRY_FEE,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(playerProfiles.id, playerId));
      }
      const remainingPlayers = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, tournamentId));
      if (remainingPlayers.length === 0) {
        await db.delete(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournamentId)).catch(() => {
        });
        await db.delete(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, tournamentId)).catch(() => {
        });
        await db.delete(tournaments).where(eq(tournaments.id, tournamentId)).catch(() => {
        });
        activeTournaments.delete(tournamentId);
        io.emit("tournament_cancelled", { tournamentId });
        console.log(`[leave] Tournament ${tournamentId} deleted \u2014 no players remaining`);
      } else {
        const newPrizePool = Math.max(0, t.prizePool - TOURNAMENT_ENTRY_FEE);
        await db.update(tournaments).set({ prizePool: newPrizePool }).where(eq(tournaments.id, tournamentId));
        io.emit("tournament_player_left", {
          tournamentId,
          playerCount: remainingPlayers.length,
          maxPlayers: t.maxPlayers ?? TOURNAMENT_SIZE,
          playerName
        });
        console.log(`[leave] Player ${playerName} left tournament ${tournamentId} \u2014 ${remainingPlayers.length}/${t.maxPlayers ?? TOURNAMENT_SIZE} remaining`);
      }
      const [updatedProfile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      res.json({
        success: true,
        playerCount: remainingPlayers.length,
        coins: updatedProfile?.coins ?? (profile ? profile.coins + TOURNAMENT_ENTRY_FEE : 0)
      });
    } catch (e) {
      console.error("POST /api/tournament/:id/leave error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/tournament/:id/match-result", async (req, res) => {
    try {
      const tournamentId = req.params.id;
      const { matchId, winnerId, winnerName } = req.body;
      const active = activeTournaments.get(tournamentId);
      if (!active) return res.status(404).json({ error: "tournament_not_active" });
      const match = active.matches.find((m) => m.id === matchId);
      if (!match) return res.status(404).json({ error: "match_not_found" });
      if (match.status === "completed") return res.status(400).json({ error: "match_already_completed" });
      if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
        return res.status(400).json({ error: "winner_not_in_match" });
      }
      await handleTournamentMatchResult(io, tournamentId, matchId, winnerId, winnerName);
      const updatedActive = activeTournaments.get(tournamentId);
      res.json({ success: true, status: updatedActive?.status || "unknown", currentRound: updatedActive?.currentRound || "unknown" });
    } catch (e) {
      console.error("POST /api/tournament/:id/match-result error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/player/:id/tournaments", async (req, res) => {
    try {
      const playerId = req.params.id;
      const entries = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.playerId, playerId));
      const result = [];
      for (const entry of entries) {
        const [t] = await db.select().from(tournaments).where(eq(tournaments.id, entry.tournamentId));
        if (t) {
          result.push({ ...t, placement: entry.placement, eliminated: entry.eliminated === 1 });
        }
      }
      res.json(result);
    } catch (e) {
      console.error("GET /api/player/:id/tournaments error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/leaderboard", async (req, res) => {
    try {
      const type = req.query.type || "score";
      let players;
      if (type === "wins") {
        players = await db.select().from(playerProfiles).orderBy(desc(playerProfiles.wins)).limit(50);
      } else if (type === "xp") {
        players = await db.select().from(playerProfiles).orderBy(desc(playerProfiles.xp)).limit(50);
      } else {
        players = await db.select().from(playerProfiles).orderBy(desc(playerProfiles.totalScore)).limit(50);
      }
      const result = players.map((p, idx) => ({
        rank: idx + 1,
        id: p.id,
        name: p.name,
        skin: p.equippedSkin,
        equippedTitle: p.equippedTitle || "beginner",
        level: p.level,
        wins: p.wins,
        score: p.totalScore,
        xp: p.xp,
        gamesPlayed: p.gamesPlayed
      }));
      res.json(result);
    } catch (e) {
      console.error("GET /api/leaderboard error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/players/search", async (req, res) => {
    try {
      const q = (req.query.q || "").trim();
      const myId = req.query.playerId || "";
      if (q.length < 2) return res.json([]);
      const selectFields = {
        id: playerProfiles.id,
        playerCode: playerProfiles.playerCode,
        playerTag: playerProfiles.playerTag,
        name: playerProfiles.name,
        skin: playerProfiles.equippedSkin,
        level: playerProfiles.level,
        wins: playerProfiles.wins
      };
      if (q.includes("#")) {
        const hashIdx = q.lastIndexOf("#");
        const namePart = q.slice(0, hashIdx).trim();
        const tagStr = q.slice(hashIdx + 1).trim();
        const tagNum = parseInt(tagStr, 10);
        if (isNaN(tagNum)) return res.json([]);
        let whereClause2;
        if (namePart) {
          const nameCondition = ilike(playerProfiles.name, namePart);
          const tagCondition = eq(playerProfiles.playerTag, tagNum);
          whereClause2 = myId ? and(nameCondition, tagCondition, ne(playerProfiles.id, myId)) : and(nameCondition, tagCondition);
        } else {
          const tagCondition = eq(playerProfiles.playerTag, tagNum);
          whereClause2 = myId ? and(tagCondition, ne(playerProfiles.id, myId)) : tagCondition;
        }
        const rows2 = await db.select(selectFields).from(playerProfiles).where(whereClause2).limit(10);
        return res.json(rows2);
      }
      const searchCondition = or(
        ilike(playerProfiles.name, `%${q}%`),
        and(isNotNull(playerProfiles.playerCode), ilike(playerProfiles.playerCode, `%${q}%`))
      );
      const excludeSelf = myId ? ne(playerProfiles.id, myId) : void 0;
      const whereClause = excludeSelf ? and(searchCondition, excludeSelf) : searchCondition;
      const rows = await db.select(selectFields).from(playerProfiles).where(whereClause).orderBy(desc(playerProfiles.wins)).limit(20);
      const missing = rows.filter((r) => !r.playerCode);
      if (missing.length > 0) {
        Promise.all(missing.map(async (r) => {
          const code = await ensurePlayerCode(r.id);
          await db.update(playerProfiles).set({ playerCode: code }).where(eq(playerProfiles.id, r.id));
        })).catch(() => {
        });
      }
      res.json(rows);
    } catch (e) {
      console.error("GET /api/players/search error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/friends/:playerId", async (req, res) => {
    try {
      const playerId = req.params.playerId;
      const rows = await db.select().from(friends).where(
        or(eq(friends.requesterId, playerId), eq(friends.receiverId, playerId))
      );
      const result = [];
      for (const row of rows) {
        const otherId = row.requesterId === playerId ? row.receiverId : row.requesterId;
        const [profile] = await db.select({
          id: playerProfiles.id,
          playerCode: playerProfiles.playerCode,
          playerTag: playerProfiles.playerTag,
          name: playerProfiles.name,
          skin: playerProfiles.equippedSkin,
          level: playerProfiles.level,
          wins: playerProfiles.wins
        }).from(playerProfiles).where(eq(playerProfiles.id, otherId));
        if (profile) {
          result.push({
            requestId: row.id,
            status: row.status,
            isSender: row.requesterId === playerId,
            player: profile
          });
        }
      }
      res.json(result);
    } catch (e) {
      console.error("GET /api/friends error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/friends/:playerId/request/:targetId", async (req, res) => {
    try {
      const { playerId, targetId } = req.params;
      if (playerId === targetId) return res.status(400).json({ error: "cannot_add_self" });
      const existing = await db.select().from(friends).where(
        or(
          and(eq(friends.requesterId, playerId), eq(friends.receiverId, targetId)),
          and(eq(friends.requesterId, targetId), eq(friends.receiverId, playerId))
        )
      );
      if (existing.length > 0) {
        const ex = existing[0];
        if (ex.status === "rejected" && ex.requesterId === playerId) {
          await db.update(friends).set({ status: "pending", updatedAt: /* @__PURE__ */ new Date() }).where(eq(friends.id, ex.id));
          return res.json({ success: true, resent: true });
        }
        return res.json({ error: "already_exists", status: ex.status });
      }
      const [row] = await db.insert(friends).values({ requesterId: playerId, receiverId: targetId, status: "pending" }).returning();
      res.json({ success: true, requestId: row.id });
    } catch (e) {
      console.error("POST /api/friends/request error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/friends/request", async (req, res) => {
    try {
      const { requesterId, receiverId } = req.body;
      if (!requesterId || !receiverId) return res.status(400).json({ error: "missing_fields" });
      if (requesterId === receiverId) return res.status(400).json({ error: "cannot_add_self" });
      const existing = await db.select().from(friends).where(
        or(
          and(eq(friends.requesterId, requesterId), eq(friends.receiverId, receiverId)),
          and(eq(friends.requesterId, receiverId), eq(friends.receiverId, requesterId))
        )
      );
      if (existing.length > 0) return res.status(400).json({ error: "already_exists", status: existing[0].status });
      const [row] = await db.insert(friends).values({ requesterId, receiverId, status: "pending" }).returning();
      res.json({ success: true, requestId: row.id });
    } catch (e) {
      console.error("POST /api/friends/request (body) error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/friends/accept", async (req, res) => {
    try {
      const { requester_id, receiver_id } = req.body;
      if (!requester_id || !receiver_id) return res.status(400).json({ error: "missing_fields" });
      const [updated] = await db.update(friends).set({ status: "accepted", updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(friends.requesterId, requester_id), eq(friends.receiverId, receiver_id))).returning();
      if (!updated) return res.status(404).json({ error: "request_not_found" });
      res.json({ success: true });
    } catch (e) {
      console.error("POST /api/friends/accept error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.put("/api/friends/request/:requestId/:action", async (req, res) => {
    try {
      const { requestId, action } = req.params;
      if (action !== "accept" && action !== "reject") return res.status(400).json({ error: "invalid_action" });
      const newStatus = action === "accept" ? "accepted" : "rejected";
      await db.update(friends).set({ status: newStatus, updatedAt: /* @__PURE__ */ new Date() }).where(eq(friends.id, requestId));
      res.json({ success: true });
    } catch (e) {
      console.error("PUT /api/friends/request error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.delete("/api/friends/:playerId/:friendId", async (req, res) => {
    try {
      const { playerId, friendId } = req.params;
      await db.delete(friends).where(
        or(
          and(eq(friends.requesterId, playerId), eq(friends.receiverId, friendId)),
          and(eq(friends.requesterId, friendId), eq(friends.receiverId, playerId))
        )
      );
      res.json({ success: true });
    } catch (e) {
      console.error("DELETE /api/friends error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  function getTodayDate() {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  async function syncTaskProgress(playerId, profile) {
    const today = getTodayDate();
    const rows = await db.select().from(playerDailyTasks).where(and(eq(playerDailyTasks.playerId, playerId), eq(playerDailyTasks.assignedDate, today)));
    for (const row of rows) {
      if (row.claimed === 1) continue;
      const def = TASK_POOL.find((d) => d.key === row.taskKey);
      if (!def) continue;
      let newProgress = row.progress ?? 0;
      if (def.type === "wins") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.wins - (row.baselineWins ?? 0)), def.target));
      if (def.type === "games") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.gamesPlayed - (row.baselineGames ?? 0)), def.target));
      if (def.type === "score") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.totalScore - (row.baselineScore ?? 0)), def.target));
      if (newProgress !== (row.progress ?? 0)) {
        await db.update(playerDailyTasks).set({ progress: newProgress }).where(eq(playerDailyTasks.id, row.id));
      }
    }
  }
  async function syncAchievementProgress(playerId, profile) {
    for (const def of ACHIEVEMENT_DEFS) {
      let progress = 0;
      if (def.type === "wins") progress = Math.min(profile.wins, def.target);
      if (def.type === "games") progress = Math.min(profile.gamesPlayed, def.target);
      if (def.type === "level") progress = Math.min(profile.level, def.target);
      if (def.type === "streak") progress = Math.min(profile.bestStreak, def.target);
      const unlocked = progress >= def.target;
      const [existing] = await db.select().from(playerAchievements).where(and(eq(playerAchievements.playerId, playerId), eq(playerAchievements.achievementKey, def.key)));
      if (existing) {
        if (existing.progress !== progress || existing.unlocked !== (unlocked ? 1 : 0)) {
          await db.update(playerAchievements).set({
            progress,
            unlocked: unlocked ? 1 : 0,
            unlockedAt: unlocked && !existing.unlockedAt ? /* @__PURE__ */ new Date() : existing.unlockedAt
          }).where(eq(playerAchievements.id, existing.id));
        }
      } else {
        await db.insert(playerAchievements).values({
          playerId,
          achievementKey: def.key,
          progress,
          unlocked: unlocked ? 1 : 0,
          unlockedAt: unlocked ? /* @__PURE__ */ new Date() : void 0
        });
      }
    }
  }
  app2.get("/api/tasks/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const today = getTodayDate();
      let [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (!profile) {
        const playerCode = await ensurePlayerCode(playerId);
        const randomName = generateRandomPlayerName();
        [profile] = await db.insert(playerProfiles).values({ id: playerId, playerCode, playerTag: await generateUniquePlayerTag(), name: randomName }).returning();
      }
      let todayRows = await db.select().from(playerDailyTasks).where(and(eq(playerDailyTasks.playerId, playerId), eq(playerDailyTasks.assignedDate, today)));
      if (todayRows.length === 0) {
        const chosen = pickDailyTasks();
        for (const def of chosen) {
          await db.insert(playerDailyTasks).values({
            playerId,
            taskKey: def.key,
            assignedDate: today,
            progress: 0,
            baselineWins: profile.wins,
            baselineGames: profile.gamesPlayed,
            baselineScore: profile.totalScore
          });
        }
        todayRows = await db.select().from(playerDailyTasks).where(and(eq(playerDailyTasks.playerId, playerId), eq(playerDailyTasks.assignedDate, today)));
      }
      const result = todayRows.map((row) => {
        const def = TASK_POOL.find((d) => d.key === row.taskKey);
        if (!def) return null;
        let progress = row.progress ?? 0;
        if (def.type === "wins") progress = Math.max(progress, Math.min(Math.max(0, profile.wins - (row.baselineWins ?? 0)), def.target));
        if (def.type === "games") progress = Math.max(progress, Math.min(Math.max(0, profile.gamesPlayed - (row.baselineGames ?? 0)), def.target));
        if (def.type === "score") progress = Math.max(progress, Math.min(Math.max(0, profile.totalScore - (row.baselineScore ?? 0)), def.target));
        return {
          ...def,
          rowId: row.id,
          progress,
          completed: progress >= def.target,
          claimed: row.claimed === 1
        };
      }).filter(Boolean);
      res.json(result);
    } catch (e) {
      console.error("GET /api/tasks error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/tasks/:playerId/:taskKey/claim", async (req, res) => {
    try {
      const { playerId, taskKey } = req.params;
      const today = getTodayDate();
      const def = DAILY_TASK_DEFS.find((d) => d.key === taskKey);
      if (!def) return res.json({ success: false, error: "unknown_task" });
      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (!profile) return res.json({ success: false, error: "player_not_found" });
      let [row] = await db.select().from(playerDailyTasks).where(and(
        eq(playerDailyTasks.playerId, playerId),
        eq(playerDailyTasks.taskKey, taskKey),
        eq(playerDailyTasks.assignedDate, today)
      ));
      if (!row) {
        const [inserted] = await db.insert(playerDailyTasks).values({
          playerId,
          taskKey,
          assignedDate: today,
          progress: 0,
          baselineWins: profile.wins,
          baselineGames: profile.gamesPlayed,
          baselineScore: profile.totalScore
        }).returning();
        row = inserted;
      }
      if (row.claimed === 1) return res.json({ success: false, error: "already_claimed" });
      let progress = row.progress ?? 0;
      if (def.type === "wins") progress = Math.max(progress, Math.min(Math.max(0, profile.wins - (row.baselineWins ?? 0)), def.target));
      if (def.type === "games") progress = Math.max(progress, Math.min(Math.max(0, profile.gamesPlayed - (row.baselineGames ?? 0)), def.target));
      if (def.type === "score") progress = Math.max(progress, Math.min(Math.max(0, profile.totalScore - (row.baselineScore ?? 0)), def.target));
      if (progress < def.target) return res.json({ success: false, error: "not_completed" });
      await db.update(playerDailyTasks).set({ claimed: 1, claimedAt: /* @__PURE__ */ new Date(), progress }).where(eq(playerDailyTasks.id, row.id));
      await db.update(playerProfiles).set({
        coins: sql2`coins + ${def.rewardCoins}`,
        xp: sql2`xp + ${def.rewardXp}`,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(playerProfiles.id, playerId));
      res.json({ success: true, coinsEarned: def.rewardCoins, xpEarned: def.rewardXp });
    } catch (e) {
      console.error("POST /api/tasks/claim error:", e);
      res.json({ success: false, error: "server_error" });
    }
  });
  app2.get("/api/achievements/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      let [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (!profile) {
        const playerCode = await ensurePlayerCode(playerId);
        const randomName = generateRandomPlayerName();
        [profile] = await db.insert(playerProfiles).values({ id: playerId, playerCode, playerTag: await generateUniquePlayerTag(), name: randomName }).returning();
      }
      const rows = await db.select().from(playerAchievements).where(eq(playerAchievements.playerId, playerId));
      const result = ACHIEVEMENT_DEFS.map((def) => {
        const row = rows.find((r) => r.achievementKey === def.key);
        let progress = 0;
        if (def.type === "wins") progress = Math.min(profile.wins, def.target);
        if (def.type === "games") progress = Math.min(profile.gamesPlayed, def.target);
        if (def.type === "level") progress = Math.min(profile.level, def.target);
        if (def.type === "streak") progress = Math.min(profile.bestStreak, def.target);
        const unlocked = progress >= def.target;
        return {
          ...def,
          rowId: row?.id,
          progress,
          unlocked,
          claimed: row?.claimed === 1
        };
      });
      res.json(result);
    } catch (e) {
      console.error("GET /api/achievements error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  async function processAchievementClaim(playerId, key) {
    const def = ACHIEVEMENT_DEFS.find((d) => d.key === key);
    if (!def) return { success: false, error: "unknown_achievement" };
    const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
    if (!profile) return { success: false, error: "player_not_found" };
    const [existing] = await db.select().from(playerAchievements).where(and(eq(playerAchievements.playerId, playerId), eq(playerAchievements.achievementKey, key)));
    if (existing?.claimed === 1) return { success: false, error: "already_claimed" };
    let liveProgress = 0;
    if (def.type === "wins") liveProgress = profile.wins;
    if (def.type === "games") liveProgress = profile.gamesPlayed;
    if (def.type === "level") liveProgress = profile.level;
    if (def.type === "streak") liveProgress = profile.bestStreak;
    const storedUnlocked = existing?.unlocked === 1;
    const liveUnlocked = liveProgress >= def.target;
    if (!storedUnlocked && !liveUnlocked) return { success: false, error: "not_unlocked" };
    const finalProgress = Math.max(liveProgress, existing?.progress ?? 0);
    if (existing) {
      await db.update(playerAchievements).set({
        claimed: 1,
        claimedAt: /* @__PURE__ */ new Date(),
        unlocked: 1,
        unlockedAt: existing.unlockedAt ?? /* @__PURE__ */ new Date(),
        progress: finalProgress
      }).where(eq(playerAchievements.id, existing.id));
    } else {
      await db.insert(playerAchievements).values({
        playerId,
        achievementKey: key,
        progress: finalProgress,
        unlocked: 1,
        claimed: 1,
        unlockedAt: /* @__PURE__ */ new Date(),
        claimedAt: /* @__PURE__ */ new Date()
      });
    }
    await db.update(playerProfiles).set({
      coins: sql2`coins + ${def.rewardCoins}`,
      xp: sql2`xp + ${def.rewardXp}`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(playerProfiles.id, playerId));
    return { success: true, coinsEarned: def.rewardCoins, xpEarned: def.rewardXp };
  }
  app2.post("/api/achievements/:playerId/claim/:key", async (req, res) => {
    try {
      const result = await processAchievementClaim(req.params.playerId, req.params.key);
      res.json(result);
    } catch (e) {
      console.error("POST /api/achievements/claim error:", e);
      res.json({ success: false, error: "server_error" });
    }
  });
  app2.post("/api/claim-achievement", async (req, res) => {
    try {
      const { playerId, achievementKey } = req.body;
      if (!playerId || !achievementKey) return res.json({ success: false, error: "missing_fields" });
      const result = await processAchievementClaim(playerId, achievementKey);
      res.json(result);
    } catch (e) {
      console.error("POST /api/claim-achievement error:", e);
      res.json({ success: false, error: "server_error" });
    }
  });
  app2.post("/api/task-progress", async (req, res) => {
    try {
      const { playerId, taskType, increment = 1 } = req.body;
      if (!playerId || !taskType) return res.status(400).json({ error: "missing_fields" });
      const today = getTodayDate();
      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (!profile) return res.status(404).json({ error: "player_not_found" });
      const todayRows = await db.select().from(playerDailyTasks).where(and(eq(playerDailyTasks.playerId, playerId), eq(playerDailyTasks.assignedDate, today)));
      const updated = [];
      for (const row of todayRows) {
        const def = TASK_POOL.find((d) => d.key === row.taskKey && d.type === taskType);
        if (!def || row.claimed === 1) continue;
        let newProgress = row.progress ?? 0;
        if (def.type === "wins") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.wins - (row.baselineWins ?? 0)), def.target));
        if (def.type === "games") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.gamesPlayed - (row.baselineGames ?? 0)), def.target));
        if (def.type === "score") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.totalScore - (row.baselineScore ?? 0)), def.target));
        if (def.type === "emojis") newProgress = Math.min(newProgress + increment, def.target);
        await db.update(playerDailyTasks).set({ progress: newProgress }).where(eq(playerDailyTasks.id, row.id));
        updated.push({ taskKey: row.taskKey, progress: newProgress, completed: newProgress >= def.target });
      }
      res.json({ updated });
    } catch (e) {
      console.error("POST /api/task-progress error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/achievement-progress", async (req, res) => {
    try {
      const { playerId, achievementType } = req.body;
      if (!playerId || !achievementType) return res.status(400).json({ error: "missing_fields" });
      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (!profile) return res.status(404).json({ error: "player_not_found" });
      const relevantDefs = ACHIEVEMENT_DEFS.filter((d) => d.type === achievementType);
      const updated = [];
      for (const def of relevantDefs) {
        let progress = 0;
        if (def.type === "wins") progress = Math.min(profile.wins, def.target);
        if (def.type === "games") progress = Math.min(profile.gamesPlayed, def.target);
        if (def.type === "level") progress = Math.min(profile.level, def.target);
        if (def.type === "streak") progress = Math.min(profile.bestStreak, def.target);
        const unlocked = progress >= def.target;
        const [existing] = await db.select().from(playerAchievements).where(and(eq(playerAchievements.playerId, playerId), eq(playerAchievements.achievementKey, def.key)));
        if (existing) {
          if (existing.progress !== progress || existing.unlocked !== (unlocked ? 1 : 0)) {
            await db.update(playerAchievements).set({
              progress,
              unlocked: unlocked ? 1 : 0,
              unlockedAt: unlocked && !existing.unlockedAt ? /* @__PURE__ */ new Date() : existing.unlockedAt
            }).where(eq(playerAchievements.id, existing.id));
          }
        } else {
          await db.insert(playerAchievements).values({
            playerId,
            achievementKey: def.key,
            progress,
            unlocked: unlocked ? 1 : 0,
            unlockedAt: unlocked ? /* @__PURE__ */ new Date() : void 0
          });
        }
        updated.push({ achievementKey: def.key, progress, unlocked });
      }
      res.json({ updated });
    } catch (e) {
      console.error("POST /api/achievement-progress error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/room-invites", async (req, res) => {
    try {
      const { fromPlayerId, toPlayerId, roomId, fromPlayerName } = req.body;
      if (!fromPlayerId || !toPlayerId || !roomId || !fromPlayerName) {
        return res.status(400).json({ error: "missing_fields" });
      }
      await db.update(roomInvites).set({ status: "cancelled" }).where(and(eq(roomInvites.fromPlayerId, fromPlayerId), eq(roomInvites.toPlayerId, toPlayerId), eq(roomInvites.status, "pending")));
      const [invite] = await db.insert(roomInvites).values({ fromPlayerId, toPlayerId, roomId, fromPlayerName, status: "pending" }).returning();
      res.json({ success: true, inviteId: invite.id });
    } catch (e) {
      console.error("POST /api/room-invites error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/room-invites/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const pending = await db.select().from(roomInvites).where(and(eq(roomInvites.toPlayerId, playerId), eq(roomInvites.status, "pending"))).orderBy(desc(roomInvites.createdAt)).limit(5);
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1e3;
      const fresh = pending.filter((i) => new Date(i.createdAt).getTime() > fiveMinutesAgo);
      res.json(fresh);
    } catch (e) {
      console.error("GET /api/room-invites error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.put("/api/room-invites/:inviteId/respond", async (req, res) => {
    try {
      const { inviteId } = req.params;
      const { action } = req.body;
      const status = action === "accept" ? "accepted" : "declined";
      const [invite] = await db.update(roomInvites).set({ status }).where(eq(roomInvites.id, inviteId)).returning();
      if (!invite) return res.status(404).json({ error: "not_found" });
      res.json({ success: true, roomId: invite.roomId, action });
    } catch (e) {
      console.error("PUT /api/room-invites respond error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  async function cleanupAbandonedTournaments() {
    try {
      const openTournaments = await db.select().from(tournaments).where(eq(tournaments.status, "open"));
      const now = Date.now();
      for (const t of openTournaments) {
        const players = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, t.id));
        const ageMs = now - new Date(t.createdAt).getTime();
        const shouldDelete = players.length === 0 && ageMs >= 2e4 || players.length < 2 && ageMs >= 6e4;
        if (shouldDelete) {
          await db.delete(tournamentMatches).where(eq(tournamentMatches.tournamentId, t.id)).catch(() => {
          });
          await db.delete(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, t.id)).catch(() => {
          });
          await db.delete(tournaments).where(eq(tournaments.id, t.id)).catch(() => {
          });
          activeTournaments.delete(t.id);
          console.log(`[cleanup] Deleted abandoned tournament ${t.id} (players: ${players.length}, age: ${Math.round(ageMs / 1e3)}s)`);
          io.emit("tournament_cancelled", { tournamentId: t.id });
        }
      }
    } catch (e) {
      console.error("[cleanup] Tournament cleanup error:", e);
    }
  }
  cleanupAbandonedTournaments();
  setInterval(() => cleanupAbandonedTournaments(), 3e4);
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
