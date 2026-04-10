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
function validateWord(word, category, letter, strict = false) {
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
  if (!strict) {
    const letterSet = letterNormalizedSets[normLetter];
    if (letterSet) {
      if (letterSet.has(normWord) || letterSet.has(stripped)) {
        return { valid: true };
      }
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
var WORD_CATEGORY_MAP = {
  general: [...GAME_CATEGORIES],
  animals: ["animal"],
  countries: ["country", "city"],
  food: ["fruit", "vegetable"],
  names: ["boyName", "girlName"],
  objects: ["object"],
  cities: ["city"]
};
function getActiveCategories(wordCategory) {
  return WORD_CATEGORY_MAP[wordCategory] || GAME_CATEGORIES;
}
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
function createRoom(hostId, hostName, hostSkin, wordCategory = "general") {
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
    letterIndex: 1,
    wordCategory
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
  const activeCategories = getActiveCategories(room.wordCategory);
  const answersByCategory = {};
  for (const cat of activeCategories) {
    answersByCategory[cat] = [];
  }
  for (const [, answers] of room.submittedAnswers) {
    for (const cat of activeCategories) {
      const ans = answers[cat]?.trim().toLowerCase() || "";
      if (ans) {
        answersByCategory[cat].push(ans);
      }
    }
  }
  const duplicateCounts = {};
  for (const cat of activeCategories) {
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
    const useStrict = !!room.wordCategory && room.wordCategory !== "general";
    for (const cat of activeCategories) {
      const ans = answers[cat]?.trim() || "";
      if (!ans) {
        scores[cat] = 0;
        status[cat] = "empty";
      } else {
        const dbCategory = CATEGORY_MAP[cat];
        const validation = validateWord(ans, dbCategory, letter, useStrict);
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
  battlePassTiers: () => battlePassTiers,
  clanMembers: () => clanMembers,
  clans: () => clans,
  coinGifts: () => coinGifts,
  dailyChallengeEntries: () => dailyChallengeEntries,
  dailyChallenges: () => dailyChallenges,
  dailySpins: () => dailySpins,
  dailyTaskDefs: () => dailyTaskDefs,
  friendRequests: () => friendRequests,
  friends: () => friends,
  insertUserSchema: () => insertUserSchema,
  playerAchievements: () => playerAchievements,
  playerBattlePass: () => playerBattlePass,
  playerDailyTasks: () => playerDailyTasks,
  playerProfiles: () => playerProfiles,
  roomInvites: () => roomInvites,
  seasons: () => seasons,
  spectatorBets: () => spectatorBets,
  tournamentMatches: () => tournamentMatches,
  tournamentPlayers: () => tournamentPlayers,
  tournaments: () => tournaments,
  users: () => users,
  winStreaks: () => winStreaks
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, uniqueIndex } from "drizzle-orm/pg-core";
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
  loginStreak: integer("login_streak").notNull().default(0),
  lastLoginDate: text("last_login_date"),
  longestLoginStreak: integer("longest_login_streak").notNull().default(0),
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by"),
  referralCount: integer("referral_count").notNull().default(0),
  expoPushToken: text("expo_push_token"),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  isVip: boolean("is_vip").notNull().default(false),
  vipExpiresAt: timestamp("vip_expires_at"),
  vipSubscriptionId: text("vip_subscription_id"),
  // ── Country ────────────────────────────────────────────────────────────────
  country: text("country").default("MA"),
  // ── Clan Wars ──────────────────────────────────────────────────────────────
  clanId: varchar("clan_id"),
  // ── Ranked Season System ───────────────────────────────────────────────────
  elo: integer("elo").notNull().default(1e3),
  division: text("division").notNull().default("silver"),
  peakElo: integer("peak_elo").notNull().default(1e3),
  seasonWins: integer("season_wins").notNull().default(0),
  seasonLosses: integer("season_losses").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});
var seasons = pgTable("seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
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
  playerId: varchar("player_id").notNull(),
  friendId: varchar("friend_id").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});
var friendRequests = pgTable("friend_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull(),
  receiverId: varchar("receiver_id").notNull(),
  status: text("status").notNull().default("pending"),
  // pending | accepted | declined
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
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
var coinGifts = pgTable("coin_gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromPlayerId: varchar("from_player_id").notNull(),
  toPlayerId: varchar("to_player_id").notNull(),
  amount: integer("amount").notNull(),
  seen: boolean("seen").notNull().default(false),
  sentAt: timestamp("sent_at").notNull().default(sql`now()`)
});
var battlePassTiers = pgTable("battle_pass_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seasonId: varchar("season_id").notNull(),
  tier: integer("tier").notNull(),
  freeRewardType: text("free_reward_type").notNull(),
  // "coins" | "skin" | "title" | "powerCard"
  freeRewardId: text("free_reward_id"),
  // skin/title id, null for coins/powerCard
  freeRewardAmount: integer("free_reward_amount").notNull().default(0),
  premiumRewardType: text("premium_reward_type").notNull(),
  premiumRewardId: text("premium_reward_id"),
  premiumRewardAmount: integer("premium_reward_amount").notNull().default(0)
}, (t) => ({
  uniqSeasonTier: uniqueIndex("battle_pass_tiers_season_tier_unique").on(t.seasonId, t.tier)
}));
var playerBattlePass = pgTable("player_battle_pass", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  seasonId: varchar("season_id").notNull(),
  passXp: integer("pass_xp").notNull().default(0),
  currentTier: integer("current_tier").notNull().default(0),
  premiumUnlocked: boolean("premium_unlocked").notNull().default(false),
  claimedTiers: jsonb("claimed_tiers").$type().notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
}, (t) => ({
  uniqPlayerSeason: uniqueIndex("player_battle_pass_player_season_unique").on(t.playerId, t.seasonId)
}));
var clans = pgTable("clans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("\u2694\uFE0F"),
  leaderId: varchar("leader_id").notNull(),
  totalWarScore: integer("total_war_score").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});
var clanMembers = pgTable("clan_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clanId: varchar("clan_id").notNull(),
  playerId: varchar("player_id").notNull(),
  warScore: integer("war_score").notNull().default(0),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").notNull().default(sql`now()`)
}, (t) => ({
  uniqMembership: uniqueIndex("clan_members_clan_player_unique").on(t.clanId, t.playerId)
}));
var spectatorBets = pgTable("spectator_bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull(),
  spectatorId: varchar("spectator_id").notNull(),
  betOnPlayerId: varchar("bet_on_player_id").notNull(),
  amount: integer("amount").notNull(),
  settled: boolean("settled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});
var dailyChallenges = pgTable("daily_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull().unique(),
  word: text("word").notNull(),
  letter: text("letter").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});
var dailyChallengeEntries = pgTable("daily_challenge_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  date: text("date").notNull(),
  guesses: jsonb("guesses").$type().notNull().default(sql`'[]'::jsonb`),
  completed: boolean("completed").notNull().default(false),
  won: boolean("won").notNull().default(false),
  guessCount: integer("guess_count").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  startedAt: timestamp("started_at").notNull().default(sql`now()`),
  finishedAt: timestamp("finished_at"),
  rank: integer("rank")
}, (t) => ({
  uniqPlayerDate: uniqueIndex("daily_challenge_entries_player_date_unique").on(t.playerId, t.date)
}));

// server/db.ts
var pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
var db = drizzle(pool, { schema: schema_exports });

// server/routes.ts
import { eq as eq2, and as and2, desc, asc, or, ilike, ne, isNotNull as isNotNull2, sql as sql3 } from "drizzle-orm";
import cron from "node-cron";

// server/notifications.ts
import { eq, and, isNotNull, sql as sql2 } from "drizzle-orm";
var EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
async function sendPushNotification(playerId, body, title, data) {
  try {
    const [profile] = await db.select({
      expoPushToken: playerProfiles.expoPushToken,
      notificationsEnabled: playerProfiles.notificationsEnabled
    }).from(playerProfiles).where(eq(playerProfiles.id, playerId)).limit(1);
    if (!profile?.expoPushToken || !profile.notificationsEnabled) return false;
    const message = {
      to: profile.expoPushToken,
      body,
      sound: "default",
      channelId: "default"
    };
    if (title) message.title = title;
    if (data) message.data = data;
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(message)
    });
    if (!res.ok) {
      console.error("[push] Expo API error:", res.status);
      return false;
    }
    const result = await res.json();
    if (result?.data?.status === "error") {
      console.error("[push] Ticket error:", result.data.message);
      if (result.data.details?.error === "DeviceNotRegistered") {
        await db.update(playerProfiles).set({ expoPushToken: null }).where(eq(playerProfiles.id, playerId));
        console.log("[push] Cleared stale token for player:", playerId);
      }
      return false;
    }
    return true;
  } catch (e) {
    console.error("[push] Failed to send notification:", e);
    return false;
  }
}
async function sendBulkPushNotifications(messages) {
  if (messages.length === 0) return;
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(chunk)
      });
    } catch (e) {
      console.error("[push] Bulk send error:", e);
    }
  }
}
async function sendDailyTaskReminders() {
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const players = await db.select({
      expoPushToken: playerProfiles.expoPushToken,
      lastLoginDate: playerProfiles.lastLoginDate,
      notificationsEnabled: playerProfiles.notificationsEnabled
    }).from(playerProfiles).where(
      and(
        isNotNull(playerProfiles.expoPushToken),
        eq(playerProfiles.notificationsEnabled, true)
      )
    );
    const messages = [];
    for (const p of players) {
      if (!p.expoPushToken || p.lastLoginDate === today) continue;
      messages.push({
        to: p.expoPushToken,
        title: "\u062D\u0631\u0648\u0641 \u0627\u0644\u0645\u063A\u0631\u0628",
        body: "\u0645\u0647\u0627\u0645\u0643 \u0627\u0644\u064A\u0648\u0645\u064A\u0629 \u062C\u0627\u0647\u0632\u0629! \u{1F3AF}",
        sound: "default",
        data: { type: "daily_tasks" }
      });
    }
    if (messages.length > 0) {
      await sendBulkPushNotifications(messages);
      console.log(`[cron] Sent ${messages.length} daily task reminders`);
    }
  } catch (e) {
    console.error("[cron] Daily task reminder error:", e);
  }
}
async function sendStreakResetWarnings() {
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const players = await db.select({
      expoPushToken: playerProfiles.expoPushToken,
      lastLoginDate: playerProfiles.lastLoginDate,
      loginStreak: playerProfiles.loginStreak,
      notificationsEnabled: playerProfiles.notificationsEnabled
    }).from(playerProfiles).where(
      and(
        isNotNull(playerProfiles.expoPushToken),
        eq(playerProfiles.notificationsEnabled, true),
        sql2`${playerProfiles.loginStreak} > 2`
      )
    );
    const messages = [];
    for (const p of players) {
      if (!p.expoPushToken || p.lastLoginDate === today) continue;
      messages.push({
        to: p.expoPushToken,
        title: "\u062D\u0631\u0648\u0641 \u0627\u0644\u0645\u063A\u0631\u0628",
        body: "\u0633\u0644\u0633\u0644\u062A\u0643 \u0633\u062A\u0646\u062A\u0647\u064A \u0627\u0644\u064A\u0648\u0645! \u{1F525}",
        sound: "default",
        data: { type: "streak_warning" }
      });
    }
    if (messages.length > 0) {
      await sendBulkPushNotifications(messages);
      console.log(`[cron] Sent ${messages.length} streak reset warnings`);
    }
  } catch (e) {
    console.error("[cron] Streak reset warning error:", e);
  }
}
async function sendSeasonEndingNotifications() {
  try {
    const now = /* @__PURE__ */ new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = lastDay - now.getDate();
    if (daysLeft !== 3 && daysLeft !== 1) return;
    const label = daysLeft === 3 ? "\u0627\u0644\u0645\u0648\u0633\u0645 \u064A\u0646\u062A\u0647\u064A \u062E\u0644\u0627\u0644 3 \u0623\u064A\u0627\u0645 \u23F3" : "\u0627\u0644\u0645\u0648\u0633\u0645 \u064A\u0646\u062A\u0647\u064A \u063A\u062F\u0627\u064B! \u23F3";
    const players = await db.select({
      expoPushToken: playerProfiles.expoPushToken,
      notificationsEnabled: playerProfiles.notificationsEnabled
    }).from(playerProfiles).where(
      and(
        isNotNull(playerProfiles.expoPushToken),
        eq(playerProfiles.notificationsEnabled, true)
      )
    );
    const messages = [];
    for (const p of players) {
      if (!p.expoPushToken) continue;
      messages.push({
        to: p.expoPushToken,
        title: "\u062D\u0631\u0648\u0641 \u0627\u0644\u0645\u063A\u0631\u0628",
        body: label,
        sound: "default",
        data: { type: "season_ending" }
      });
    }
    if (messages.length > 0) {
      await sendBulkPushNotifications(messages);
      console.log(`[cron] Sent ${messages.length} season ending notifications`);
    }
  } catch (e) {
    console.error("[cron] Season ending notification error:", e);
  }
}

// server/routes.ts
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
  { key: "win_25", titleAr: "25 \u0627\u0646\u062A\u0635\u0627\u0631\u0627\u064B", descAr: "\u0627\u0631\u0628\u062D 25 \u0645\u0628\u0627\u0631\u0627\u0629", target: 25, type: "wins", rewardCoins: 350, rewardXp: 200, icon: "\u{1F396}\uFE0F" },
  { key: "win_50", titleAr: "50 \u0627\u0646\u062A\u0635\u0627\u0631\u0627\u064B", descAr: "\u0627\u0631\u0628\u062D 50 \u0645\u0628\u0627\u0631\u0627\u0629", target: 50, type: "wins", rewardCoins: 500, rewardXp: 300, icon: "\u{1F451}" },
  { key: "win_100", titleAr: "100 \u0627\u0646\u062A\u0635\u0627\u0631", descAr: "\u0627\u0631\u0628\u062D 100 \u0645\u0628\u0627\u0631\u0627\u0629", target: 100, type: "wins", rewardCoins: 1e3, rewardXp: 500, icon: "\u{1F48E}" },
  { key: "play_10", titleAr: "10 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", descAr: "\u0634\u0627\u0631\u0643 \u0641\u064A 10 \u0645\u0628\u0627\u0631\u064A\u0627\u062A", target: 10, type: "games", rewardCoins: 100, rewardXp: 50, icon: "\u{1F3AE}" },
  { key: "play_50", titleAr: "50 \u0645\u0628\u0627\u0631\u0627\u0629", descAr: "\u0634\u0627\u0631\u0643 \u0641\u064A 50 \u0645\u0628\u0627\u0631\u0627\u0629", target: 50, type: "games", rewardCoins: 200, rewardXp: 120, icon: "\u{1F579}\uFE0F" },
  { key: "play_100", titleAr: "100 \u0645\u0628\u0627\u0631\u0627\u0629", descAr: "\u0634\u0627\u0631\u0643 \u0641\u064A 100 \u0645\u0628\u0627\u0631\u0627\u0629", target: 100, type: "games", rewardCoins: 300, rewardXp: 200, icon: "\u{1F4AF}" },
  { key: "play_500", titleAr: "500 \u0645\u0628\u0627\u0631\u0627\u0629", descAr: "\u0634\u0627\u0631\u0643 \u0641\u064A 500 \u0645\u0628\u0627\u0631\u0627\u0629", target: 500, type: "games", rewardCoins: 800, rewardXp: 400, icon: "\u{1F3AF}" },
  { key: "level_5", titleAr: "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 5", descAr: "\u0627\u0628\u0644\u063A \u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062E\u0627\u0645\u0633", target: 5, type: "level", rewardCoins: 150, rewardXp: 0, icon: "\u26A1" },
  { key: "level_10", titleAr: "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 10", descAr: "\u0627\u0628\u0644\u063A \u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0639\u0627\u0634\u0631", target: 10, type: "level", rewardCoins: 500, rewardXp: 0, icon: "\u{1F31F}" },
  { key: "level_15", titleAr: "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 15", descAr: "\u0627\u0628\u0644\u063A \u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062E\u0627\u0645\u0633 \u0639\u0634\u0631", target: 15, type: "level", rewardCoins: 750, rewardXp: 0, icon: "\u{1F52E}" },
  { key: "level_20", titleAr: "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 20", descAr: "\u0627\u0628\u0644\u063A \u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0639\u0634\u0631\u064A\u0646", target: 20, type: "level", rewardCoins: 1200, rewardXp: 0, icon: "\u{1F3F0}" },
  { key: "streak_3", titleAr: "3 \u0627\u0646\u062A\u0635\u0627\u0631\u0627\u062A \u0645\u062A\u062A\u0627\u0644\u064A\u0629", descAr: "\u0627\u0631\u0628\u062D 3 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u062A\u0648\u0627\u0644\u064A", target: 3, type: "streak", rewardCoins: 100, rewardXp: 75, icon: "\u{1F525}" },
  { key: "streak_5", titleAr: "5 \u0627\u0646\u062A\u0635\u0627\u0631\u0627\u062A \u0645\u062A\u062A\u0627\u0644\u064A\u0629", descAr: "\u0627\u0631\u0628\u062D 5 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u062A\u0648\u0627\u0644\u064A", target: 5, type: "streak", rewardCoins: 250, rewardXp: 150, icon: "\u26A1" },
  { key: "streak_10", titleAr: "10 \u0627\u0646\u062A\u0635\u0627\u0631\u0627\u062A \u0645\u062A\u062A\u0627\u0644\u064A\u0629", descAr: "\u0627\u0631\u0628\u062D 10 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u062A\u0648\u0627\u0644\u064A", target: 10, type: "streak", rewardCoins: 500, rewardXp: 300, icon: "\u{1F4A5}" },
  { key: "login_7", titleAr: "7 \u0623\u064A\u0627\u0645 \u0645\u062A\u062A\u0627\u0644\u064A\u0629", descAr: "\u0633\u062C\u0644 \u062F\u062E\u0648\u0644\u0643 7 \u0623\u064A\u0627\u0645 \u0645\u062A\u062A\u0627\u0644\u064A\u0629", target: 7, type: "login_streak", rewardCoins: 200, rewardXp: 100, icon: "\u{1F4C5}" },
  { key: "login_30", titleAr: "30 \u064A\u0648\u0645 \u0645\u062A\u062A\u0627\u0644\u064A", descAr: "\u0633\u062C\u0644 \u062F\u062E\u0648\u0644\u0643 30 \u064A\u0648\u0645 \u0645\u062A\u062A\u0627\u0644\u064A", target: 30, type: "login_streak", rewardCoins: 1e3, rewardXp: 500, icon: "\u{1F5D3}\uFE0F" },
  { key: "score_5000", titleAr: "5000 \u0646\u0642\u0637\u0629", descAr: "\u0627\u062C\u0645\u0639 5000 \u0646\u0642\u0637\u0629 \u0625\u062C\u0645\u0627\u0644\u064A\u0629", target: 5e3, type: "total_score", rewardCoins: 500, rewardXp: 250, icon: "\u2B50" },
  { key: "first_tournament", titleAr: "\u0623\u0648\u0644 \u0628\u0637\u0648\u0644\u0629", descAr: "\u0634\u0627\u0631\u0643 \u0641\u064A \u0628\u0637\u0648\u0644\u0629 \u0648\u0627\u062D\u062F\u0629", target: 1, type: "tournaments", rewardCoins: 150, rewardXp: 100, icon: "\u{1F3DF}\uFE0F" }
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
    const existing = await db.select({ id: playerProfiles.id }).from(playerProfiles).where(eq2(playerProfiles.playerCode, code));
    if (existing.length === 0) break;
    code = generatePlayerCode();
    attempts++;
  }
  return code;
}
async function generateUniqueReferralCode() {
  let code = "WM-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  for (let attempt = 0; attempt < 10; attempt++) {
    const dup = await db.select({ id: playerProfiles.id }).from(playerProfiles).where(eq2(playerProfiles.referralCode, code));
    if (dup.length === 0) break;
    code = "WM-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  return code;
}
async function ensureReferralCode(playerId) {
  const [existing] = await db.select({ referralCode: playerProfiles.referralCode }).from(playerProfiles).where(eq2(playerProfiles.id, playerId));
  if (existing?.referralCode) return existing.referralCode;
  const code = await generateUniqueReferralCode();
  await db.update(playerProfiles).set({ referralCode: code }).where(eq2(playerProfiles.id, playerId));
  return code;
}
async function generateUniquePlayerTag() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const tag = Math.floor(1e3 + Math.random() * 9e3);
    const existing = await db.select({ id: playerProfiles.id }).from(playerProfiles).where(eq2(playerProfiles.playerTag, tag)).limit(1);
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
    const missing = await db.select({ id: playerProfiles.id }).from(playerProfiles).where(sql3`player_code IS NULL OR player_tag IS NULL`);
    if (missing.length === 0) return;
    console.log(`[fix] Assigning playerCode/playerTag to ${missing.length} players...`);
    for (const { id } of missing) {
      const updates = {};
      updates.playerCode = await ensurePlayerCode(id);
      updates.playerTag = await generateUniquePlayerTag();
      await db.update(playerProfiles).set(updates).where(eq2(playerProfiles.id, id));
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
var socketPlayerIdMap = /* @__PURE__ */ new Map();
var reactionLastSentMap = /* @__PURE__ */ new Map();
async function incrementEmojiTaskProgress(playerId) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const emojiTaskDefs = TASK_POOL.filter((t) => t.type === "emojis");
  for (const def of emojiTaskDefs) {
    const rows = await db.select({ id: playerDailyTasks.id, progress: playerDailyTasks.progress, claimed: playerDailyTasks.claimed }).from(playerDailyTasks).where(and2(
      eq2(playerDailyTasks.playerId, playerId),
      eq2(playerDailyTasks.taskKey, def.key),
      eq2(playerDailyTasks.assignedDate, today)
    )).limit(1);
    if (rows.length > 0 && !rows[0].claimed) {
      const newProgress = Math.min((rows[0].progress ?? 0) + 1, def.target);
      await db.update(playerDailyTasks).set({ progress: newProgress }).where(eq2(playerDailyTasks.id, rows[0].id));
      console.log(`[emoji-task] player=${playerId} task=${def.key} progress=${newProgress}/${def.target}`);
    }
  }
}
var roomSpectators = /* @__PURE__ */ new Map();
var MAX_SPECTATORS = 10;
var MAIN_ROUND_SECONDS = 50;
var spectateTimerIntervals = /* @__PURE__ */ new Map();
function startSpectateTimer(roomId, ioRef) {
  if (spectateTimerIntervals.has(roomId)) {
    clearInterval(spectateTimerIntervals.get(roomId));
    spectateTimerIntervals.delete(roomId);
  }
  let secondsLeft = MAIN_ROUND_SECONDS;
  const interval = setInterval(() => {
    secondsLeft--;
    ioRef.to(`spectate:${roomId}`).emit("spectate_timer", { secondsLeft });
    if (secondsLeft <= 0) {
      clearInterval(interval);
      spectateTimerIntervals.delete(roomId);
    }
  }, 1e3);
  spectateTimerIntervals.set(roomId, interval);
}
function stopSpectateTimer(roomId) {
  const interval = spectateTimerIntervals.get(roomId);
  if (interval) {
    clearInterval(interval);
    spectateTimerIntervals.delete(roomId);
  }
}
var RAPID_CATEGORIES = ["girlName", "boyName", "animal", "fruit", "vegetable", "object", "city", "country"];
var RAPID_ROUND_TIME = 10;
var RAPID_TOTAL_ROUNDS = 5;
var RAPID_COINS_WIN = 15;
var RAPID_COINS_LOSE = 5;
var RAPID_XP_WIN = 30;
var RAPID_XP_LOSE = 10;
var rapidQueue = [];
var rapidRooms = /* @__PURE__ */ new Map();
var WORD_CHAIN_TURN_TIME = 15;
var WORD_CHAIN_ROUNDS_TO_WIN = 2;
var wordChainRooms = /* @__PURE__ */ new Map();
var wordChainQueue = [];
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
  }).where(eq2(tournamentMatches.id, matchId)).catch(() => {
  });
  if (match.roundName === "quarter" || match.roundName === "semi") {
    const nextRoundName = match.roundName === "quarter" ? "semi" : "final";
    const nextIdx = match.roundName === "quarter" ? Math.floor(match.matchIndex / 2) : 0;
    const slot = match.roundName === "quarter" ? match.matchIndex % 2 === 0 ? "player1" : "player2" : match.matchIndex === 0 ? "player1" : "player2";
    const nextMatch = active.matches.find((m) => m.roundName === nextRoundName && m.matchIndex === nextIdx);
    if (nextMatch) {
      const p1Update = slot === "player1" ? { player1Id: winnerId, player1Name: winnerName } : {};
      const p2Update = slot === "player2" ? { player2Id: winnerId, player2Name: winnerName } : {};
      await db.update(tournamentMatches).set({ ...p1Update, ...p2Update }).where(eq2(tournamentMatches.id, nextMatch.id)).catch(() => {
      });
    }
  }
  if (active.status === "completed") {
    await db.update(tournaments).set({
      status: "completed",
      winnerId,
      winnerName,
      completedAt: /* @__PURE__ */ new Date()
    }).where(eq2(tournaments.id, tournamentId)).catch(() => {
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
        const [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, pid));
        if (profile) {
          await db.update(playerProfiles).set({
            coins: profile.coins + prize,
            xp: profile.xp + xp,
            level: Math.floor((profile.xp + xp) / 100) + 1,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq2(playerProfiles.id, pid));
        }
      } catch {
      }
      await db.update(tournamentPlayers).set({ placement: rank }).where(
        and2(eq2(tournamentPlayers.tournamentId, tournamentId), eq2(tournamentPlayers.playerId, pid))
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
      clearHintsForRoom(room.id);
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
        tournamentRound: match.roundName,
        wordCategory: gameResult.room.wordCategory || "general"
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
var botRooms = /* @__PURE__ */ new Map();
var matchmakingTimeouts = /* @__PURE__ */ new Map();
var BOT_NAMES = ["\u0627\u0644\u0645\u062D\u062A\u0631\u0641", "\u0627\u0644\u0630\u0643\u0627\u0621", "\u0627\u0644\u0646\u062C\u0645", "\u0627\u0644\u0639\u0628\u0642\u0631\u064A", "\u0627\u0644\u062E\u0628\u064A\u0631", "\u0627\u0644\u0623\u0633\u062A\u0627\u0630", "\u0627\u0644\u0628\u0637\u0644", "\u0627\u0644\u0645\u062A\u0645\u064A\u0632"];
var BOT_SKINS = ["\u{1F916}", "\u{1F47E}", "\u{1F9E0}", "\u{1F3AD}"];
function generateBotAnswers(letter, categories) {
  const answers = {};
  for (const cat of categories) {
    const wordCat = CATEGORY_MAP[cat];
    const words = wordCat ? getWordsForLetter(wordCat, letter) : [];
    answers[cat] = words.length > 0 ? words[Math.floor(Math.random() * Math.min(words.length, 10))] : "";
  }
  return answers;
}
function scheduleBotSubmission(io, roomId, botId, delay) {
  setTimeout(() => {
    const room = getRoom(roomId);
    if (!room || room.state !== "playing") return;
    const activeCategories = getActiveCategories(room.wordCategory);
    const answers = generateBotAnswers(room.currentLetter, activeCategories);
    const { allSubmitted } = submitAnswers(roomId, botId, answers);
    io.to(roomId).emit("player_submitted", { playerId: botId });
    if (allSubmitted) {
      if (room.timer) {
        clearTimeout(room.timer);
        room.timer = null;
      }
      const results = calculateRoundScores(roomId);
      const updatedRoom = getRoom(roomId);
      if (!updatedRoom) return;
      io.to(roomId).emit("round_results", {
        results,
        round: updatedRoom.currentRound,
        totalRounds: updatedRoom.totalRounds,
        players: updatedRoom.players.map((p) => ({ id: p.id, name: p.name, score: p.score }))
      });
    }
  }, delay);
}
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
function calcDivision(elo) {
  if (elo < 800) return "bronze";
  if (elo < 1100) return "silver";
  if (elo < 1400) return "gold";
  if (elo < 1700) return "platinum";
  return "diamond";
}
function calcElo(winnerElo, loserElo, K = 32) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const newWinner = Math.round(winnerElo + K * (1 - expectedWinner));
  const newLoser = Math.max(100, Math.round(loserElo + K * (0 - (1 - expectedWinner))));
  return { winner: newWinner, loser: newLoser };
}
async function seedCurrentSeason() {
  try {
    const existing = await db.select().from(seasons).where(eq2(seasons.status, "active")).limit(1);
    if (existing.length > 0) return;
    const now = /* @__PURE__ */ new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);
    const monthNames = ["\u064A\u0646\u0627\u064A\u0631", "\u0641\u0628\u0631\u0627\u064A\u0631", "\u0645\u0627\u0631\u0633", "\u0623\u0628\u0631\u064A\u0644", "\u0645\u0627\u064A\u0648", "\u064A\u0648\u0646\u064A\u0648", "\u064A\u0648\u0644\u064A\u0648", "\u0623\u063A\u0633\u0637\u0633", "\u0633\u0628\u062A\u0645\u0628\u0631", "\u0623\u0643\u062A\u0648\u0628\u0631", "\u0646\u0648\u0641\u0645\u0628\u0631", "\u062F\u064A\u0633\u0645\u0628\u0631"];
    const name = `\u0645\u0648\u0633\u0645 ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    await db.insert(seasons).values({ name, startDate: now, endDate, status: "active" });
    console.log(`[ranked] Seeded new season: ${name}`);
  } catch (e) {
    console.error("[ranked] seedCurrentSeason error:", e);
  }
}
async function handleSeasonEnd() {
  try {
    const activeSeason = await db.select().from(seasons).where(eq2(seasons.status, "active")).limit(1);
    if (!activeSeason.length) return;
    const season = activeSeason[0];
    if (new Date(season.endDate) > /* @__PURE__ */ new Date()) return;
    console.log(`[ranked] Season ${season.name} ended \u2014 distributing rewards...`);
    const DIVISION_REWARDS = {
      diamond: { coins: 1e3, title: "morocco_legend" },
      platinum: { coins: 600, title: "champion_title" },
      gold: { coins: 350, title: "letter_king" },
      silver: { coins: 150, title: "word_master" },
      bronze: { coins: 50, title: null }
    };
    const players = await db.select({
      id: playerProfiles.id,
      division: playerProfiles.division,
      peakElo: playerProfiles.peakElo,
      ownedTitles: playerProfiles.ownedTitles
    }).from(playerProfiles);
    for (const p of players) {
      const reward = DIVISION_REWARDS[p.division ?? "bronze"] ?? DIVISION_REWARDS.bronze;
      const newElo = Math.max(800, Math.floor((p.peakElo ?? 1e3) * 0.75));
      const newDivision = calcDivision(newElo);
      const currentTitles = Array.isArray(p.ownedTitles) ? p.ownedTitles : [];
      const newTitles = reward.title && !currentTitles.includes(reward.title) ? [...currentTitles, reward.title] : currentTitles;
      await db.update(playerProfiles).set({
        coins: sql3`coins + ${reward.coins}`,
        elo: newElo,
        division: newDivision,
        peakElo: newElo,
        seasonWins: 0,
        seasonLosses: 0,
        ownedTitles: newTitles,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(playerProfiles.id, p.id));
    }
    await db.update(seasons).set({ status: "completed" }).where(eq2(seasons.id, season.id));
    const now = /* @__PURE__ */ new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);
    const monthNames = ["\u064A\u0646\u0627\u064A\u0631", "\u0641\u0628\u0631\u0627\u064A\u0631", "\u0645\u0627\u0631\u0633", "\u0623\u0628\u0631\u064A\u0644", "\u0645\u0627\u064A\u0648", "\u064A\u0648\u0646\u064A\u0648", "\u064A\u0648\u0644\u064A\u0648", "\u0623\u063A\u0633\u0637\u0633", "\u0633\u0628\u062A\u0645\u0628\u0631", "\u0623\u0643\u062A\u0648\u0628\u0631", "\u0646\u0648\u0641\u0645\u0628\u0631", "\u062F\u064A\u0633\u0645\u0628\u0631"];
    const name = `\u0645\u0648\u0633\u0645 ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const [newSeason] = await db.insert(seasons).values({ name, startDate: now, endDate, status: "active" }).returning({ id: seasons.id });
    console.log(`[ranked] New season created: ${name}`);
    if (newSeason?.id) {
      seedBattlePassTiers(newSeason.id).catch((e) => console.error("[battle-pass] season rollover seed error:", e));
    }
  } catch (e) {
    console.error("[ranked] handleSeasonEnd error:", e);
  }
}
var BP_XP_PER_TIER = 500;
var BP_PREMIUM_COST = 1e3;
var BP_XP_WIN = 20;
var BP_XP_GAME = 10;
var BP_TIER_DEFS = [
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 50, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 100 },
  { freeRewardType: "powerCard", freeRewardId: "hint", freeRewardAmount: 1, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 150 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 75, premiumRewardType: "skin", premiumRewardId: "djellaba", premiumRewardAmount: 0 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 100, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 200 },
  { freeRewardType: "powerCard", freeRewardId: "freeze", freeRewardAmount: 1, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 250 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 100, premiumRewardType: "powerCard", premiumRewardId: "time", premiumRewardAmount: 2 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 125, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 300 },
  { freeRewardType: "powerCard", freeRewardId: "hint", freeRewardAmount: 2, premiumRewardType: "skin", premiumRewardId: "sport", premiumRewardAmount: 0 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 150, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 350 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 150, premiumRewardType: "title", premiumRewardId: "eloquent", premiumRewardAmount: 0 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 200, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 400 },
  { freeRewardType: "powerCard", freeRewardId: "freeze", freeRewardAmount: 2, premiumRewardType: "powerCard", premiumRewardId: "hint", premiumRewardAmount: 3 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 200, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 450 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 225, premiumRewardType: "skin", premiumRewardId: "kaftan", premiumRewardAmount: 0 },
  { freeRewardType: "powerCard", freeRewardId: "time", freeRewardAmount: 2, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 500 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 250, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 550 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 250, premiumRewardType: "powerCard", premiumRewardId: "freeze", premiumRewardAmount: 3 },
  { freeRewardType: "powerCard", freeRewardId: "hint", freeRewardAmount: 3, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 600 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 300, premiumRewardType: "skin", premiumRewardId: "ninja", premiumRewardAmount: 0 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 300, premiumRewardType: "title", premiumRewardId: "lightning", premiumRewardAmount: 0 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 350, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 700 },
  { freeRewardType: "powerCard", freeRewardId: "time", freeRewardAmount: 3, premiumRewardType: "powerCard", premiumRewardId: "time", premiumRewardAmount: 3 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 400, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 750 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 400, premiumRewardType: "skin", premiumRewardId: "sahrawi", premiumRewardAmount: 0 },
  { freeRewardType: "powerCard", freeRewardId: "freeze", freeRewardAmount: 3, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 800 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 450, premiumRewardType: "title", premiumRewardId: "word_master", premiumRewardAmount: 0 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 500, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 900 },
  { freeRewardType: "powerCard", freeRewardId: "hint", freeRewardAmount: 3, premiumRewardType: "skin", premiumRewardId: "hacker", premiumRewardAmount: 0 },
  { freeRewardType: "coins", freeRewardId: null, freeRewardAmount: 500, premiumRewardType: "coins", premiumRewardId: null, premiumRewardAmount: 1e3 },
  { freeRewardType: "skin", freeRewardId: "champion", freeRewardAmount: 0, premiumRewardType: "title", premiumRewardId: "letter_king", premiumRewardAmount: 0 }
];
async function seedBattlePassTiers(seasonId) {
  try {
    const existing = await db.select({ id: battlePassTiers.id }).from(battlePassTiers).where(eq2(battlePassTiers.seasonId, seasonId)).limit(1);
    if (existing.length > 0) return;
    const rows = BP_TIER_DEFS.map((def, i) => ({
      seasonId,
      tier: i + 1,
      ...def
    }));
    await db.insert(battlePassTiers).values(rows);
    console.log(`[battle-pass] Seeded 30 tiers for season ${seasonId}`);
  } catch (e) {
    console.error("[battle-pass] seedBattlePassTiers error:", e);
  }
}
async function getOrCreatePlayerBattlePass(playerId, seasonId) {
  await db.insert(playerBattlePass).values({
    playerId,
    seasonId,
    passXp: 0,
    currentTier: 0,
    premiumUnlocked: false,
    claimedTiers: []
  }).onConflictDoNothing();
  const [pass] = await db.select().from(playerBattlePass).where(and2(eq2(playerBattlePass.playerId, playerId), eq2(playerBattlePass.seasonId, seasonId))).limit(1);
  return pass;
}
async function awardBattlePassXp(playerId, xpAmount) {
  try {
    const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq2(seasons.status, "active")).limit(1);
    if (!activeSeason) return;
    await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
    await db.update(playerBattlePass).set({
      passXp: sql3`pass_xp + ${xpAmount}`,
      currentTier: sql3`LEAST(30, FLOOR((pass_xp + ${xpAmount}) / ${BP_XP_PER_TIER})::int)`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and2(eq2(playerBattlePass.playerId, playerId), eq2(playerBattlePass.seasonId, activeSeason.id)));
  } catch (e) {
    console.error("[battle-pass] awardBattlePassXp error:", e);
  }
}
async function handleClanWarWeeklyEnd() {
  try {
    const allClans = await db.select().from(clans).orderBy(desc(clans.totalWarScore));
    if (allClans.length === 0) return;
    const rewardsByRank = { 1: 300, 2: 150, 3: 75 };
    for (let i = 0; i < allClans.length; i++) {
      const clan = allClans[i];
      const rank = i + 1;
      const rewardPerMember = rewardsByRank[rank] ?? 0;
      const members = await db.select({ playerId: clanMembers.playerId }).from(clanMembers).where(eq2(clanMembers.clanId, clan.id));
      if (rewardPerMember > 0) {
        for (const m of members) {
          const [prof] = await db.select({ coins: playerProfiles.coins }).from(playerProfiles).where(eq2(playerProfiles.id, m.playerId)).limit(1);
          if (prof) {
            await db.update(playerProfiles).set({ coins: prof.coins + rewardPerMember, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, m.playerId));
          }
        }
      }
      await db.update(clanMembers).set({ warScore: 0 }).where(eq2(clanMembers.clanId, clan.id));
      await db.update(clans).set({ totalWarScore: 0 }).where(eq2(clans.id, clan.id));
    }
    console.log(`[clan-war] Weekly rewards distributed to top ${Math.min(allClans.length, 3)} clans`);
  } catch (e) {
    console.error("[clan-war] handleClanWarWeeklyEnd error:", e);
  }
}
async function registerRoutes(app2) {
  const httpServer = createServer(app2);
  seedTaskAndAchievementDefs();
  fixMissingPlayerCodes();
  await seedCurrentSeason().catch(console.error);
  (async () => {
    try {
      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq2(seasons.status, "active")).limit(1);
      if (activeSeason) await seedBattlePassTiers(activeSeason.id);
    } catch (e) {
      console.error("[battle-pass] startup seed error:", e);
    }
  })();
  app2.get("/api/words", (req, res) => {
    const letter = req.query.letter;
    if (!letter) return res.status(400).json({ error: "letter required" });
    const result = {};
    for (const [gameKey, dbCategory] of Object.entries(CATEGORY_MAP)) {
      result[gameKey] = getWordsForLetter(dbCategory, letter);
    }
    return res.json(result);
  });
  const HINT_COST = 5;
  const MAX_HINTS_PER_GAME = 3;
  const hintUsage = /* @__PURE__ */ new Map();
  function clearHintsForRoom2(roomId) {
    for (const key of hintUsage.keys()) {
      if (key.startsWith(`${roomId}:`)) hintUsage.delete(key);
    }
  }
  function getPlayerHintsUsed(roomId, playerId) {
    return hintUsage.get(`${roomId}:${playerId}`) || 0;
  }
  app2.post("/api/game/hint", async (req, res) => {
    try {
      const { roomId, playerId } = req.body;
      if (!roomId || !playerId) return res.status(400).json({ error: "missing_params" });
      const room = getRoom(roomId);
      if (!room || room.state !== "playing") return res.status(400).json({ error: "no_active_game" });
      const playerInRoom = room.players.find((p) => {
        const mappedId = socketPlayerIdMap.get(p.id);
        return mappedId === playerId;
      });
      if (!playerInRoom) return res.status(403).json({ error: "not_in_room" });
      const globalKey = `${roomId}:${playerId}`;
      const globalUsed = hintUsage.get(globalKey) || 0;
      if (globalUsed >= MAX_HINTS_PER_GAME) return res.status(400).json({ error: "max_hints_reached" });
      const [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, playerId)).limit(1);
      if (!profile || profile.coins < HINT_COST) return res.status(400).json({ error: "not_enough_coins" });
      await db.update(playerProfiles).set({ coins: profile.coins - HINT_COST }).where(eq2(playerProfiles.id, playerId));
      const activeCategories = getActiveCategories(room.wordCategory);
      const letter = room.currentLetter;
      const candidates = [];
      for (const cat of activeCategories) {
        const dbCat = CATEGORY_MAP[cat];
        const words = getWordsForLetter(dbCat, letter);
        for (const w of words.slice(0, 10)) {
          candidates.push({ category: cat, word: w });
        }
      }
      if (candidates.length === 0) {
        await db.update(playerProfiles).set({ coins: profile.coins }).where(eq2(playerProfiles.id, playerId));
        return res.status(400).json({ error: "no_hints_available" });
      }
      const hint = candidates[Math.floor(Math.random() * candidates.length)];
      hintUsage.set(globalKey, globalUsed + 1);
      return res.json({
        category: hint.category,
        word: hint.word,
        hintsUsed: globalUsed + 1,
        hintsRemaining: MAX_HINTS_PER_GAME - (globalUsed + 1),
        newCoinBalance: profile.coins - HINT_COST
      });
    } catch (e) {
      console.error("[hint] Error:", e);
      return res.status(500).json({ error: "server_error" });
    }
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
  async function settleBets(roomId, winnerPlayerId) {
    try {
      const unsettled = await db.select().from(spectatorBets).where(and2(eq2(spectatorBets.roomId, roomId), eq2(spectatorBets.settled, false)));
      if (unsettled.length === 0) return;
      const emitToPlayer = (pid, event, payload) => {
        for (const [sid, mpid] of socketPlayerIdMap.entries()) {
          if (mpid === pid) {
            const s = io.sockets.sockets.get(sid);
            if (s) s.emit(event, payload);
          }
        }
      };
      if (!winnerPlayerId) {
        for (const bet of unsettled) {
          await db.update(playerProfiles).set({ coins: sql3`coins + ${bet.amount}` }).where(eq2(playerProfiles.id, bet.spectatorId));
          emitToPlayer(bet.spectatorId, "bet_settled", { result: "draw", refund: bet.amount });
        }
      } else {
        const winners = unsettled.filter((b) => b.betOnPlayerId === winnerPlayerId);
        const losers = unsettled.filter((b) => b.betOnPlayerId !== winnerPlayerId);
        const loserPool = losers.reduce((acc, b) => acc + b.amount, 0);
        const evenShare = winners.length > 0 ? Math.floor(loserPool / winners.length) : 0;
        for (const bet of winners) {
          const payout = bet.amount + evenShare;
          await db.update(playerProfiles).set({ coins: sql3`coins + ${payout}` }).where(eq2(playerProfiles.id, bet.spectatorId));
          emitToPlayer(bet.spectatorId, "bet_settled", { result: "win", payout });
        }
        for (const bet of losers) {
          emitToPlayer(bet.spectatorId, "bet_settled", { result: "lose", payout: 0 });
        }
      }
      await db.update(spectatorBets).set({ settled: true }).where(eq2(spectatorBets.roomId, roomId));
      roomSpectators.delete(roomId);
    } catch (err) {
      console.error("[settleBets] error:", err);
    }
  }
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    socket.on("register_player_id", (data) => {
      if (data.playerId) socketPlayerIdMap.set(socket.id, data.playerId);
    });
    socket.on(
      "create_room",
      (data, cb) => {
        try {
          const room = createRoom(socket.id, data.playerName, data.playerSkin, data.wordCategory || "general");
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
          clearHintsForRoom2(data.roomId);
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
            wordCategory: result.room.wordCategory || "general"
          });
          startSpectateTimer(data.roomId, io);
          const room = result.room;
          room.timer = setTimeout(() => {
            const results = calculateRoundScores(data.roomId);
            const currentRoom = getRoom(data.roomId);
            if (!currentRoom) return;
            const timerRoundPayload = {
              results,
              round: currentRoom.currentRound,
              totalRounds: currentRoom.totalRounds,
              players: currentRoom.players.map((p) => ({
                id: p.id,
                name: p.name,
                score: p.score
              }))
            };
            stopSpectateTimer(data.roomId);
            io.to(data.roomId).emit("round_results", timerRoundPayload);
            io.to(`spectate:${data.roomId}`).emit("spectate_update", { type: "round_results", payload: timerRoundPayload });
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
          if (data.answers) {
            const submitterName = room?.players.find((p) => p.id === socket.id)?.name || "";
            const submittedWords = Object.values(data.answers).filter((w) => w && w.trim());
            for (const word of submittedWords) {
              io.to(`spectate:${data.roomId}`).emit("spectate_live_word", {
                playerName: submitterName,
                word,
                playerId: socketPlayerIdMap.get(socket.id) || socket.id
              });
            }
          }
          if (allSubmitted && room) {
            if (room.timer) {
              clearTimeout(room.timer);
              room.timer = null;
            }
            stopSpectateTimer(data.roomId);
            const results = calculateRoundScores(data.roomId);
            const updatedRoom = getRoom(data.roomId);
            const roundResultsPayload = {
              results,
              round: updatedRoom?.currentRound || 0,
              totalRounds: updatedRoom?.totalRounds || 5,
              players: updatedRoom?.players.map((p) => ({
                id: p.id,
                name: p.name,
                score: p.score
              })) || []
            };
            io.to(data.roomId).emit("round_results", roundResultsPayload);
            io.to(`spectate:${data.roomId}`).emit("spectate_update", { type: "round_results", payload: roundResultsPayload });
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
            const sortedForBets = [...room.players].sort((a, b) => b.score - a.score);
            const winnerSocketIdForBets = sortedForBets.length >= 2 && sortedForBets[0].score > sortedForBets[1].score ? sortedForBets[0].id : null;
            const winnerPlayerIdForBets = winnerSocketIdForBets ? socketPlayerIdMap.get(winnerSocketIdForBets) || null : null;
            const gameOverPayload = {
              players: room.players.map((p) => {
                const pid = socketPlayerIdMap.get(p.id) || "";
                return {
                  id: p.id,
                  name: p.name,
                  score: p.score,
                  coins: p.coins,
                  skin: p.skin,
                  hintsUsed: getPlayerHintsUsed(data.roomId, pid)
                };
              }),
              tournamentId: tournamentInfo?.tournamentId || null,
              tournamentMatchId: tournamentInfo?.matchId || null
            };
            io.to(data.roomId).emit("game_over", gameOverPayload);
            io.to(`spectate:${data.roomId}`).emit("spectate_update", { type: "game_over", payload: gameOverPayload });
            settleBets(data.roomId, winnerPlayerIdForBets);
            cb?.({ isGameOver: true });
            const isBotMatch = room.players.some((p) => p.id.startsWith("bot:"));
            if (room.players.length === 2 && !isBotMatch) {
              const p1Id = socketPlayerIdMap.get(room.players[0].id);
              const p2Id = socketPlayerIdMap.get(room.players[1].id);
              if (p1Id && p2Id) {
                (async () => {
                  try {
                    const [prof1] = await db.select({ elo: playerProfiles.elo, peakElo: playerProfiles.peakElo, seasonWins: playerProfiles.seasonWins, seasonLosses: playerProfiles.seasonLosses }).from(playerProfiles).where(eq2(playerProfiles.id, p1Id));
                    const [prof2] = await db.select({ elo: playerProfiles.elo, peakElo: playerProfiles.peakElo, seasonWins: playerProfiles.seasonWins, seasonLosses: playerProfiles.seasonLosses }).from(playerProfiles).where(eq2(playerProfiles.id, p2Id));
                    if (!prof1 || !prof2) return;
                    const score1 = room.players[0].score;
                    const score2 = room.players[1].score;
                    const isDraw = score1 === score2;
                    let elo1 = prof1.elo ?? 1e3;
                    let elo2 = prof2.elo ?? 1e3;
                    let newElo1, newElo2;
                    let wins1 = prof1.seasonWins ?? 0;
                    let losses1 = prof1.seasonLosses ?? 0;
                    let wins2 = prof2.seasonWins ?? 0;
                    let losses2 = prof2.seasonLosses ?? 0;
                    if (isDraw) {
                      const K = 32;
                      const expected1 = 1 / (1 + Math.pow(10, (elo2 - elo1) / 400));
                      newElo1 = Math.round(elo1 + K * (0.5 - expected1));
                      newElo2 = Math.round(elo2 + K * (0.5 - (1 - expected1)));
                    } else if (score1 > score2) {
                      const { winner, loser } = calcElo(elo1, elo2);
                      newElo1 = winner;
                      newElo2 = loser;
                      wins1++;
                      losses2++;
                    } else {
                      const { winner, loser } = calcElo(elo2, elo1);
                      newElo2 = winner;
                      newElo1 = loser;
                      wins2++;
                      losses1++;
                    }
                    const peak1 = Math.max(prof1.peakElo ?? 1e3, newElo1);
                    const peak2 = Math.max(prof2.peakElo ?? 1e3, newElo2);
                    await db.update(playerProfiles).set({
                      elo: newElo1,
                      division: calcDivision(newElo1),
                      peakElo: peak1,
                      seasonWins: wins1,
                      seasonLosses: losses1,
                      updatedAt: /* @__PURE__ */ new Date()
                    }).where(eq2(playerProfiles.id, p1Id));
                    await db.update(playerProfiles).set({
                      elo: newElo2,
                      division: calcDivision(newElo2),
                      peakElo: peak2,
                      seasonWins: wins2,
                      seasonLosses: losses2,
                      updatedAt: /* @__PURE__ */ new Date()
                    }).where(eq2(playerProfiles.id, p2Id));
                    const sock1 = io.sockets.sockets.get(room.players[0].id);
                    const sock2 = io.sockets.sockets.get(room.players[1].id);
                    if (sock1) sock1.emit("elo_updated", { elo: newElo1, division: calcDivision(newElo1), delta: newElo1 - elo1 });
                    if (sock2) sock2.emit("elo_updated", { elo: newElo2, division: calcDivision(newElo2), delta: newElo2 - elo2 });
                  } catch (err) {
                    console.error("[ranked] Elo update error:", err);
                  }
                })();
              }
            }
            if (room.players.length >= 2) {
              const sortedByScore = [...room.players].sort((a, b) => b.score - a.score);
              const topScore = sortedByScore[0].score;
              const secondScore = sortedByScore[1].score;
              const hasClearWinner = topScore > secondScore;
              if (hasClearWinner) {
                const winnerId = socketPlayerIdMap.get(sortedByScore[0].id);
                if (winnerId) {
                  (async () => {
                    try {
                      const [winnerProf] = await db.select({ clanId: playerProfiles.clanId }).from(playerProfiles).where(eq2(playerProfiles.id, winnerId)).limit(1);
                      if (winnerProf?.clanId) {
                        await db.update(clanMembers).set({ warScore: sql3`war_score + 1` }).where(and2(eq2(clanMembers.clanId, winnerProf.clanId), eq2(clanMembers.playerId, winnerId)));
                        await db.update(clans).set({ totalWarScore: sql3`total_war_score + 1` }).where(eq2(clans.id, winnerProf.clanId));
                      }
                    } catch (err) {
                      console.error("[clan-war] warScore update error:", err);
                    }
                  })();
                }
              }
              (async () => {
                try {
                  const winnerSocketId = hasClearWinner ? sortedByScore[0].id : null;
                  for (const player of room.players) {
                    const pid = socketPlayerIdMap.get(player.id);
                    if (!pid) continue;
                    const xp = BP_XP_GAME + (hasClearWinner && player.id === winnerSocketId ? BP_XP_WIN - BP_XP_GAME : 0);
                    await awardBattlePassXp(pid, xp);
                  }
                } catch (err) {
                  console.error("[battle-pass] game xp award error:", err);
                }
              })();
            }
          } else if (room) {
            const newRoundPayload = {
              letter: room.currentLetter,
              round: room.currentRound,
              totalRounds: room.totalRounds
            };
            io.to(data.roomId).emit("new_round", newRoundPayload);
            io.to(`spectate:${data.roomId}`).emit("spectate_update", { type: "new_round", payload: newRoundPayload });
            cb?.({ isGameOver: false, letter: room.currentLetter });
            startSpectateTimer(data.roomId, io);
            const nextRoundBotId = botRooms.get(data.roomId);
            if (nextRoundBotId) {
              const botDelay = 6e3 + Math.random() * 6e3;
              scheduleBotSubmission(io, data.roomId, nextRoundBotId, botDelay);
            }
            room.timer = setTimeout(() => {
              const results = calculateRoundScores(data.roomId);
              const updatedRoom = getRoom(data.roomId);
              if (!updatedRoom) return;
              const nextTimerPayload = {
                results,
                round: updatedRoom.currentRound,
                totalRounds: updatedRoom.totalRounds,
                players: updatedRoom.players.map((p) => ({
                  id: p.id,
                  name: p.name,
                  score: p.score
                }))
              };
              stopSpectateTimer(data.roomId);
              io.to(data.roomId).emit("round_results", nextTimerPayload);
              io.to(`spectate:${data.roomId}`).emit("spectate_update", { type: "round_results", payload: nextTimerPayload });
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
    socket.on("request_hint", async (data, callback) => {
      const respond = (resp) => {
        if (callback) callback(resp);
      };
      try {
        const { roomId } = data;
        const playerId = socketPlayerIdMap.get(socket.id);
        if (!roomId || !playerId) return respond({ error: "missing_params" });
        const room = getRoom(roomId);
        if (!room || room.state !== "playing") return respond({ error: "no_active_game" });
        const isPlayerInRoom = room.players.some((p) => p.id === socket.id);
        if (!isPlayerInRoom) return respond({ error: "not_in_room" });
        const globalKey = `${roomId}:${playerId}`;
        const globalUsed = hintUsage.get(globalKey) || 0;
        if (globalUsed >= MAX_HINTS_PER_GAME) return respond({ error: "max_hints_reached" });
        const [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, playerId)).limit(1);
        if (!profile || profile.coins < HINT_COST) return respond({ error: "not_enough_coins" });
        await db.update(playerProfiles).set({ coins: profile.coins - HINT_COST }).where(eq2(playerProfiles.id, playerId));
        const activeCategories = getActiveCategories(room.wordCategory);
        const letter = room.currentLetter;
        const candidates = [];
        for (const cat of activeCategories) {
          const dbCat = CATEGORY_MAP[cat];
          const words = getWordsForLetter(dbCat, letter);
          for (const w of words.slice(0, 10)) {
            candidates.push({ category: cat, word: w });
          }
        }
        if (candidates.length === 0) {
          await db.update(playerProfiles).set({ coins: profile.coins }).where(eq2(playerProfiles.id, playerId));
          return respond({ error: "no_hints_available" });
        }
        const hint = candidates[Math.floor(Math.random() * candidates.length)];
        hintUsage.set(globalKey, globalUsed + 1);
        return respond({
          category: hint.category,
          word: hint.word,
          hintsUsed: globalUsed + 1,
          hintsRemaining: MAX_HINTS_PER_GAME - (globalUsed + 1),
          newCoinBalance: profile.coins - HINT_COST
        });
      } catch (e) {
        console.error("[hint] Error:", e);
        return respond({ error: "server_error" });
      }
    });
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
      const winnerPlayer = room.players.find((p) => p.id !== socket.id);
      const winnerPlayerId = winnerPlayer ? socketPlayerIdMap.get(winnerPlayer.id) || null : null;
      io.to(data.roomId).emit("game_over", { players: gameOverPlayers, forfeitedBy: socket.id });
      io.to(`spectate:${data.roomId}`).emit("spectate_update", { type: "game_over", payload: { players: gameOverPlayers, forfeitedBy: socket.id } });
      settleBets(data.roomId, winnerPlayerId);
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
            const [p] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, data.playerId));
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
          const myPendingTimeout = matchmakingTimeouts.get(socket.id);
          if (myPendingTimeout) {
            clearTimeout(myPendingTimeout);
            matchmakingTimeouts.delete(socket.id);
          }
          const oppPendingTimeout = matchmakingTimeouts.get(opponent.id);
          if (oppPendingTimeout) {
            clearTimeout(oppPendingTimeout);
            matchmakingTimeouts.delete(opponent.id);
          }
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
                  const [p] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, pid));
                  if (p) {
                    await db.update(playerProfiles).set({ coins: Math.max(0, p.coins - myCoinEntry), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, pid));
                  }
                } catch {
                }
              }
              roomPendingDeductions.delete(room.id);
            }
            clearHintsForRoom2(room.id);
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
              wordCategory: gameResult.room.wordCategory || "general"
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
        } else {
          const botFallbackTimer = setTimeout(async () => {
            matchmakingTimeouts.delete(socket.id);
            const stillQueued = matchmakingQueue.find((p) => p.id === socket.id);
            if (!stillQueued) return;
            matchmakingQueue = matchmakingQueue.filter((p) => p.id !== socket.id);
            if (entry.coinEntry && entry.coinEntry > 0 && entry.playerId) {
              try {
                const [updated] = await db.update(playerProfiles).set({ coins: sql3`coins + ${entry.coinEntry}`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, entry.playerId)).returning({ coins: playerProfiles.coins });
                socket.emit("coinRefunded", { amount: entry.coinEntry, newCoins: updated?.coins });
              } catch (e) {
                console.error("[bot-fallback] Failed to refund coins:", e);
              }
            }
            const botId = `bot:${socket.id}`;
            const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
            const botSkin = BOT_SKINS[Math.floor(Math.random() * BOT_SKINS.length)];
            const botRoom = createRoom(socket.id, entry.name, entry.skin);
            joinRoom(botRoom.id, botId, botName, botSkin);
            botRooms.set(botRoom.id, botId);
            socket.join(botRoom.id);
            socketRoomMap.set(socket.id, botRoom.id);
            const roomPlayers = botRoom.players.map((p) => ({ id: p.id, name: p.name, skin: p.skin }));
            console.log(`[bot-fallback] Starting bot match for ${entry.name} in room ${botRoom.id}`);
            emitCountdownThenStart(io, botRoom.id, roomPlayers, () => {
              clearHintsForRoom2(botRoom.id);
              const gameResult = startGame(botRoom.id);
              if (!gameResult.success || !gameResult.room) return;
              const gameData = {
                roomId: botRoom.id,
                letter: gameResult.room.currentLetter,
                round: gameResult.room.currentRound,
                totalRounds: gameResult.room.totalRounds,
                players: gameResult.room.players.map((p) => ({ id: p.id, name: p.name, skin: p.skin })),
                coinEntry: 0,
                wordCategory: gameResult.room.wordCategory || "general"
              };
              io.to(botRoom.id).emit("matchFound", gameData);
              console.log(`[bot-fallback] matchFound emitted for room ${botRoom.id}, letter=${gameData.letter}`);
              const botDelay = 6e3 + Math.random() * 6e3;
              scheduleBotSubmission(io, botRoom.id, botId, botDelay);
              gameResult.room.timer = setTimeout(() => {
                const results = calculateRoundScores(botRoom.id);
                const updatedRoom = getRoom(botRoom.id);
                if (!updatedRoom) return;
                io.to(botRoom.id).emit("round_results", {
                  results,
                  round: updatedRoom.currentRound,
                  totalRounds: updatedRoom.totalRounds,
                  players: updatedRoom.players.map((p) => ({ id: p.id, name: p.name, score: p.score }))
                });
              }, 51e3);
            });
          }, 15e3);
          matchmakingTimeouts.set(socket.id, botFallbackTimer);
        }
      }
    );
    socket.on("cancelMatch", async () => {
      const pendingBotTimer = matchmakingTimeouts.get(socket.id);
      if (pendingBotTimer) {
        clearTimeout(pendingBotTimer);
        matchmakingTimeouts.delete(socket.id);
      }
      const queueEntry = matchmakingQueue.find((p) => p.id === socket.id);
      matchmakingQueue = matchmakingQueue.filter((p) => p.id !== socket.id);
      console.log(`[cancelMatch] Socket ${socket.id} removed from queue. Queue: ${matchmakingQueue.length}`);
      if (queueEntry?.coinEntry && queueEntry.coinEntry > 0 && queueEntry.playerId) {
        try {
          const [updated] = await db.update(playerProfiles).set({ coins: sql3`coins + ${queueEntry.coinEntry}`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, queueEntry.playerId)).returning({ coins: playerProfiles.coins });
          socket.emit("coinRefunded", { amount: queueEntry.coinEntry, newCoins: updated?.coins });
          console.log(`[cancelMatch] Refunded ${queueEntry.coinEntry} coins to ${queueEntry.playerId}`);
        } catch (e) {
          console.error("[cancelMatch] Failed to refund coins:", e);
        }
      }
    });
    socket.on("quick_chat", (data) => {
      socket.to(data.roomId).emit("quick_chat", { message: data.message, playerName: data.playerName });
    });
    socket.on("send_emote", (data) => {
      socket.to(data.roomId).emit("receive_emote", { emote: data.emote, playerName: data.playerName });
    });
    const ALLOWED_REACTION_EMOJIS = /* @__PURE__ */ new Set(["\u{1F602}", "\u{1F525}", "\u{1F44F}", "\u{1F480}", "\u{1F91D}", "\u{1F624}", "\u2764\uFE0F", "\u{1F60E}"]);
    socket.on("game_reaction", async (data) => {
      const pid = socketPlayerIdMap.get(socket.id);
      if (!pid || !data.roomId || !data.emoji) return;
      if (!ALLOWED_REACTION_EMOJIS.has(data.emoji)) return;
      const trackedRoomId = socketRoomMap.get(socket.id);
      const inMainRoom = trackedRoomId === data.roomId;
      const rapidRoom = rapidRooms.get(data.roomId);
      const rapidPlayer = rapidRoom?.players.find((p) => p.socketId === socket.id);
      const inRapidRoom = rapidPlayer != null;
      if (!inMainRoom && !inRapidRoom) return;
      let authoritativeName = null;
      if (inMainRoom) {
        const mainRoom = getRoom(data.roomId);
        authoritativeName = mainRoom?.players.find((p) => p.id === socket.id)?.name ?? null;
      } else if (rapidPlayer) {
        authoritativeName = rapidPlayer.name;
      }
      if (!authoritativeName) return;
      const now = Date.now();
      const rateLimitKey = `${pid}:${data.roomId}`;
      const lastSent = reactionLastSentMap.get(rateLimitKey) || 0;
      if (now - lastSent < 5e3) return;
      reactionLastSentMap.set(rateLimitKey, now);
      socket.to(data.roomId).emit("game_reaction", { emoji: data.emoji, playerName: authoritativeName });
      incrementEmojiTaskProgress(pid).catch((err) => {
        console.error(`[emoji-task] Failed to update progress for player=${pid}:`, err);
      });
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
      const useStrict = !!room.wordCategory && room.wordCategory !== "general";
      const validation = validateWord(data.word, dbCategory, room.currentLetter, useStrict);
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
    socket.on("spectate_join", (data, cb) => {
      const room = getRoom(data.roomId);
      if (!room || room.state === "waiting" || room.state === "finished") {
        cb?.({ success: false, error: "room_not_active" });
        return;
      }
      let specs = roomSpectators.get(data.roomId);
      if (!specs) {
        specs = /* @__PURE__ */ new Set();
        roomSpectators.set(data.roomId, specs);
      }
      if (specs.size >= MAX_SPECTATORS) {
        cb?.({ success: false, error: "spectators_full" });
        return;
      }
      specs.add(socket.id);
      socket.join(`spectate:${data.roomId}`);
      const sanitized = sanitizeRoom(room);
      cb?.({ success: true, state: sanitized, spectatorCount: specs.size });
      socket.emit("spectate_state_sync", { state: sanitized, spectatorCount: specs.size });
      const currentCount = specs.size;
      io.to(data.roomId).emit("spectator_count", { count: currentCount });
      io.to(`spectate:${data.roomId}`).emit("spectator_count", { count: currentCount });
    });
    socket.on("spectate_leave", (data) => {
      const specs = roomSpectators.get(data.roomId);
      if (specs) {
        specs.delete(socket.id);
        if (specs.size === 0) roomSpectators.delete(data.roomId);
        const count = specs?.size ?? 0;
        io.to(data.roomId).emit("spectator_count", { count });
        io.to(`spectate:${data.roomId}`).emit("spectator_count", { count });
      }
      socket.leave(`spectate:${data.roomId}`);
    });
    socket.on("spectate_place_bet", async (data, callback) => {
      try {
        const spectatorId = socketPlayerIdMap.get(socket.id);
        if (!spectatorId) return callback({ success: false, error: "unauthorized" });
        const validAmounts = [50, 100, 200];
        if (!validAmounts.includes(data.amount)) return callback({ success: false, error: "invalid_amount" });
        const room = getRoom(data.roomId);
        if (!room || room.state !== "playing") return callback({ success: false, error: "room_not_active" });
        const targetPlayer = room.players.find((p) => p.id === data.betOnSocketId);
        if (!targetPlayer) return callback({ success: false, error: "invalid_target" });
        const betOnPlayerId = socketPlayerIdMap.get(data.betOnSocketId);
        if (!betOnPlayerId) return callback({ success: false, error: "invalid_target" });
        const isPlayerInRoom = room.players.some((p) => socketPlayerIdMap.get(p.id) === spectatorId);
        if (isPlayerInRoom) return callback({ success: false, error: "players_cannot_bet" });
        const spectateRoomSet = roomSpectators.get(data.roomId);
        if (!spectateRoomSet || !spectateRoomSet.has(socket.id)) return callback({ success: false, error: "not_spectating" });
        const existingBet = await db.select({ id: spectatorBets.id }).from(spectatorBets).where(and2(eq2(spectatorBets.roomId, data.roomId), eq2(spectatorBets.spectatorId, spectatorId))).limit(1);
        if (existingBet.length > 0) return callback({ success: false, error: "already_bet" });
        const updated = await db.update(playerProfiles).set({
          coins: sql3`GREATEST(0, coins - ${data.amount})`,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(and2(eq2(playerProfiles.id, spectatorId), sql3`coins >= ${data.amount}`)).returning({ coins: playerProfiles.coins });
        if (updated.length === 0) return callback({ success: false, error: "insufficient_coins" });
        await db.insert(spectatorBets).values({ roomId: data.roomId, spectatorId, betOnPlayerId, amount: data.amount });
        const allBets = await db.select({
          betOnPlayerId: spectatorBets.betOnPlayerId,
          amount: spectatorBets.amount,
          spectatorId: spectatorBets.spectatorId,
          spectatorName: playerProfiles.name
        }).from(spectatorBets).leftJoin(playerProfiles, eq2(spectatorBets.spectatorId, playerProfiles.id)).where(and2(eq2(spectatorBets.roomId, data.roomId), eq2(spectatorBets.settled, false)));
        const playerIdToSocketId = /* @__PURE__ */ new Map();
        for (const [sid, pid] of socketPlayerIdMap.entries()) playerIdToSocketId.set(pid, sid);
        const betTotals = {};
        const bettors = {};
        for (const b of allBets) {
          const sid = playerIdToSocketId.get(b.betOnPlayerId) || b.betOnPlayerId;
          betTotals[sid] = (betTotals[sid] || 0) + b.amount;
          if (!bettors[sid]) bettors[sid] = [];
          bettors[sid].push({ id: b.spectatorId, name: b.spectatorName || b.spectatorId });
        }
        io.to(`spectate:${data.roomId}`).emit("bet_update", { betTotals, bettors, totalBets: allBets.length });
        callback({ success: true, newCoins: updated[0].coins });
      } catch (e) {
        console.error("[spectate_place_bet]", e);
        callback({ success: false, error: "server_error" });
      }
    });
    socket.on("word_chain_join", (data, callback) => {
      const pid = data.playerId;
      const pendingEntry = wordChainQueue.find((e) => e.socketId !== socket.id);
      if (pendingEntry) {
        wordChainQueue = wordChainQueue.filter((e) => e.socketId !== pendingEntry.socketId);
        const roomId = `wc_${Date.now()}`;
        const room = {
          id: roomId,
          players: [
            { socketId: pendingEntry.socketId, playerId: pendingEntry.playerId, name: pendingEntry.name, skin: pendingEntry.skin, roundWins: 0 },
            { socketId: socket.id, playerId: pid, name: data.playerName, skin: data.skin, roundWins: 0 }
          ],
          chain: [],
          currentTurnIdx: 0,
          roundNum: 1,
          requiredLetter: ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)],
          turnTimer: null,
          usedWords: /* @__PURE__ */ new Set()
        };
        wordChainRooms.set(roomId, room);
        socket.join(roomId);
        const oppSocket = io.sockets.sockets.get(pendingEntry.socketId);
        if (oppSocket) oppSocket.join(roomId);
        const startData = {
          roomId,
          players: room.players.map((p) => ({ socketId: p.socketId, name: p.name, skin: p.skin, roundWins: p.roundWins })),
          currentTurnSocketId: room.players[0].socketId,
          requiredLetter: room.requiredLetter,
          chain: [],
          roundNum: 1
        };
        io.to(roomId).emit("word_chain_start", startData);
        startWordChainTurn(roomId);
        callback({ success: true, roomId });
      } else {
        wordChainQueue.push({ socketId: socket.id, playerId: pid, name: data.playerName, skin: data.skin });
        callback({ success: true });
      }
    });
    socket.on("word_chain_submit", (data, callback) => {
      const room = wordChainRooms.get(data.roomId);
      if (!room) return callback({ valid: false, error: "room_not_found" });
      const currentPlayer = room.players[room.currentTurnIdx];
      if (currentPlayer.socketId !== socket.id) return callback({ valid: false, error: "not_your_turn" });
      const word = data.word.trim();
      if (room.usedWords.has(word)) return callback({ valid: false, error: "already_used" });
      const allCategories = ["animals", "fruits", "vegetables", "cities", "countries", "objects", "boy_names", "girl_names"];
      let wordValid = false;
      for (const cat of allCategories) {
        const result = validateWord(word, cat, room.requiredLetter, false);
        if (result.valid) {
          wordValid = true;
          break;
        }
      }
      if (!wordValid) return callback({ valid: false, error: "invalid_word" });
      if (room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = null;
      }
      room.usedWords.add(word);
      room.chain.push({ socketId: socket.id, playerName: currentPlayer.name, word });
      const lastChar = [...word].at(-1) || "";
      room.requiredLetter = lastChar || ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)];
      room.currentTurnIdx = (room.currentTurnIdx + 1) % room.players.length;
      io.to(data.roomId).emit("word_chain_update", {
        chain: room.chain,
        currentTurnSocketId: room.players[room.currentTurnIdx].socketId,
        requiredLetter: room.requiredLetter
      });
      startWordChainTurn(data.roomId);
      callback({ valid: true });
    });
    socket.on("word_chain_leave", (data) => {
      const room = wordChainRooms.get(data.roomId);
      if (!room) return;
      if (room.turnTimer) clearTimeout(room.turnTimer);
      const opp = room.players.find((p) => p.socketId !== socket.id);
      if (opp) {
        io.to(opp.socketId).emit("word_chain_opponent_left");
      }
      wordChainRooms.delete(data.roomId);
    });
    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
      socketPlayerIdMap.delete(socket.id);
      const pendingBotTimerOnDisconnect = matchmakingTimeouts.get(socket.id);
      if (pendingBotTimerOnDisconnect) {
        clearTimeout(pendingBotTimerOnDisconnect);
        matchmakingTimeouts.delete(socket.id);
      }
      const queueEntry = matchmakingQueue.find((p) => p.id === socket.id);
      if (queueEntry?.coinEntry && queueEntry.coinEntry > 0 && queueEntry.playerId) {
        db.update(playerProfiles).set({ coins: sql3`coins + ${queueEntry.coinEntry}`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, queueEntry.playerId)).catch((e) => console.error("[disconnect] Failed to refund coins:", e));
        console.log(`[disconnect] Refunded ${queueEntry.coinEntry} coins to ${queueEntry.playerId}`);
      }
      matchmakingQueue = matchmakingQueue.filter((p) => p.id !== socket.id);
      rapidQueue = rapidQueue.filter((p) => p.id !== socket.id);
      wordChainQueue = wordChainQueue.filter((p) => p.socketId !== socket.id);
      for (const [wcRoomId, wcRoom] of wordChainRooms) {
        const isInRoom = wcRoom.players.some((p) => p.socketId === socket.id);
        if (isInRoom) {
          if (wcRoom.turnTimer) clearTimeout(wcRoom.turnTimer);
          const opp = wcRoom.players.find((p) => p.socketId !== socket.id);
          if (opp) {
            io.to(opp.socketId).emit("word_chain_opponent_left");
          }
          wordChainRooms.delete(wcRoomId);
          break;
        }
      }
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
        const roomBeforeRemove = getRoom(roomId);
        const wasPlaying = roomBeforeRemove?.state === "playing";
        const remainingPlayer = wasPlaying ? roomBeforeRemove?.players.find((p) => p.id !== socket.id) : void 0;
        const room = removePlayer(roomId, socket.id);
        console.log(`[disconnect] Removed socket ${socket.id} from room ${roomId}. Remaining: ${room ? room.players.map((p) => p.name).join(", ") : "room deleted"}`);
        if (room) {
          io.to(roomId).emit("room_updated", sanitizeRoom(room));
          io.to(roomId).emit("player_left", { playerId: socket.id });
        }
        if (wasPlaying && remainingPlayer) {
          const winnerPlayerId = socketPlayerIdMap.get(remainingPlayer.id) || null;
          settleBets(roomId, winnerPlayerId);
        } else if (wasPlaying && !remainingPlayer) {
          settleBets(roomId, null);
        }
      }
      for (const [roomId, specs] of roomSpectators) {
        if (specs.has(socket.id)) {
          specs.delete(socket.id);
          if (specs.size === 0) roomSpectators.delete(roomId);
          const cnt = specs.size;
          io.to(roomId).emit("spectator_count", { count: cnt });
          io.to(`spectate:${roomId}`).emit("spectator_count", { count: cnt });
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
  function startWordChainTurn(roomId) {
    const room = wordChainRooms.get(roomId);
    if (!room) return;
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = setTimeout(() => {
      const r = wordChainRooms.get(roomId);
      if (!r) return;
      const loser = r.players[r.currentTurnIdx];
      const winner = r.players[(r.currentTurnIdx + 1) % r.players.length];
      winner.roundWins++;
      io.to(roomId).emit("word_chain_round_over", {
        loserSocketId: loser.socketId,
        winnerSocketId: winner.socketId,
        chain: r.chain,
        roundNum: r.roundNum,
        roundWins: r.players.map((p) => ({ socketId: p.socketId, wins: p.roundWins })),
        reason: "timeout"
      });
      checkWordChainGameOver(roomId);
    }, WORD_CHAIN_TURN_TIME * 1e3);
  }
  function checkWordChainGameOver(roomId) {
    const room = wordChainRooms.get(roomId);
    if (!room) return;
    const winner = room.players.find((p) => p.roundWins >= WORD_CHAIN_ROUNDS_TO_WIN);
    if (winner) {
      const loser = room.players.find((p) => p.socketId !== winner.socketId);
      io.to(roomId).emit("word_chain_game_over", {
        winnerSocketId: winner.socketId,
        winnerPlayerId: winner.playerId,
        loserSocketId: loser?.socketId,
        chain: room.chain,
        roundWins: room.players.map((p) => ({ socketId: p.socketId, wins: p.roundWins }))
      });
      db.update(playerProfiles).set({ coins: sql3`coins + 30`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, winner.playerId)).catch(() => {
      });
      wordChainRooms.delete(roomId);
    } else {
      room.roundNum++;
      room.chain = [];
      room.usedWords.clear();
      room.requiredLetter = ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)];
      room.currentTurnIdx = room.roundNum % 2 === 0 ? 1 : 0;
      io.to(roomId).emit("word_chain_new_round", {
        roundNum: room.roundNum,
        requiredLetter: room.requiredLetter,
        currentTurnSocketId: room.players[room.currentTurnIdx].socketId,
        roundWins: room.players.map((p) => ({ socketId: p.socketId, wins: p.roundWins }))
      });
      startWordChainTurn(roomId);
    }
  }
  app2.get("/api/room/:id", (req, res) => {
    const room = getRoom(req.params.id);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(sanitizeRoom(room));
  });
  app2.get("/api/spectate/active-rooms", (_req, res) => {
    const result = [];
    const seenRooms = /* @__PURE__ */ new Set();
    for (const [, roomId] of socketRoomMap) {
      if (seenRooms.has(roomId)) continue;
      seenRooms.add(roomId);
      const room = getRoom(roomId);
      if (room && room.state === "playing") {
        result.push({
          roomId: room.id,
          players: room.players.map((p) => ({ id: p.id, name: p.name, skin: p.skin, score: p.score }))
        });
      }
    }
    res.json(result);
  });
  app2.get("/api/spectate/:roomId/bets", async (req, res) => {
    try {
      const { roomId } = req.params;
      const allBets = await db.select({
        betOnPlayerId: spectatorBets.betOnPlayerId,
        amount: spectatorBets.amount,
        spectatorId: spectatorBets.spectatorId,
        spectatorName: playerProfiles.name
      }).from(spectatorBets).leftJoin(playerProfiles, eq2(spectatorBets.spectatorId, playerProfiles.id)).where(and2(eq2(spectatorBets.roomId, roomId), eq2(spectatorBets.settled, false)));
      const playerIdToSocketId = /* @__PURE__ */ new Map();
      for (const [sid, pid] of socketPlayerIdMap.entries()) playerIdToSocketId.set(pid, sid);
      const betTotals = {};
      const bettors = {};
      for (const b of allBets) {
        const sid = playerIdToSocketId.get(b.betOnPlayerId) || b.betOnPlayerId;
        betTotals[sid] = (betTotals[sid] || 0) + b.amount;
        if (!bettors[sid]) bettors[sid] = [];
        bettors[sid].push({ id: b.spectatorId, name: b.spectatorName || b.spectatorId });
      }
      return res.json({ betTotals, bettors, totalBets: allBets.length });
    } catch (e) {
      console.error("[spectate-bets] error:", e);
      return res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/spectate/:roomId/bet", async (req, res) => {
    try {
      const { roomId } = req.params;
      const { betOnSocketId, amount } = req.body;
      const spectatorId = req.headers["x-player-id"];
      if (!spectatorId) return res.status(401).json({ success: false, error: "unauthorized" });
      const validAmounts = [50, 100, 200];
      if (!validAmounts.includes(amount)) return res.status(400).json({ success: false, error: "invalid_amount" });
      const room = getRoom(roomId);
      if (!room || room.state !== "playing") return res.status(400).json({ success: false, error: "room_not_active" });
      const targetPlayer = room.players.find((p) => p.id === betOnSocketId);
      if (!targetPlayer) return res.status(400).json({ success: false, error: "invalid_target" });
      const betOnPlayerId = socketPlayerIdMap.get(betOnSocketId);
      if (!betOnPlayerId) return res.status(400).json({ success: false, error: "invalid_target" });
      const isPlayerInRoom = room.players.some((p) => socketPlayerIdMap.get(p.id) === spectatorId);
      if (isPlayerInRoom) return res.status(403).json({ success: false, error: "players_cannot_bet" });
      const spectatorSocket = [...socketPlayerIdMap.entries()].find(([, pid]) => pid === spectatorId)?.[0];
      const spectateRoomSet = roomSpectators.get(roomId);
      if (!spectatorSocket || !spectateRoomSet || !spectateRoomSet.has(spectatorSocket)) {
        return res.status(403).json({ success: false, error: "not_spectating" });
      }
      const existingBet = await db.select({ id: spectatorBets.id }).from(spectatorBets).where(and2(eq2(spectatorBets.roomId, roomId), eq2(spectatorBets.spectatorId, spectatorId))).limit(1);
      if (existingBet.length > 0) return res.status(409).json({ success: false, error: "already_bet" });
      const updated = await db.update(playerProfiles).set({
        coins: sql3`GREATEST(0, coins - ${amount})`,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(and2(eq2(playerProfiles.id, spectatorId), sql3`coins >= ${amount}`)).returning({ coins: playerProfiles.coins });
      if (updated.length === 0) return res.status(402).json({ success: false, error: "insufficient_coins" });
      await db.insert(spectatorBets).values({ roomId, spectatorId, betOnPlayerId, amount });
      const allBets = await db.select({
        betOnPlayerId: spectatorBets.betOnPlayerId,
        amount: spectatorBets.amount,
        spectatorId: spectatorBets.spectatorId,
        spectatorName: playerProfiles.name
      }).from(spectatorBets).leftJoin(playerProfiles, eq2(spectatorBets.spectatorId, playerProfiles.id)).where(and2(eq2(spectatorBets.roomId, roomId), eq2(spectatorBets.settled, false)));
      const playerIdToSocketId = /* @__PURE__ */ new Map();
      for (const [sid, pid] of socketPlayerIdMap.entries()) playerIdToSocketId.set(pid, sid);
      const betTotals = {};
      const bettors = {};
      for (const b of allBets) {
        const sid = playerIdToSocketId.get(b.betOnPlayerId) || b.betOnPlayerId;
        betTotals[sid] = (betTotals[sid] || 0) + b.amount;
        if (!bettors[sid]) bettors[sid] = [];
        bettors[sid].push({ id: b.spectatorId, name: b.spectatorName || b.spectatorId });
      }
      io.to(`spectate:${roomId}`).emit("bet_update", { betTotals, bettors, totalBets: allBets.length });
      return res.json({ success: true, newCoins: updated[0].coins, betTotals, bettors });
    } catch (e) {
      console.error("[spectate-bet] error:", e);
      return res.status(500).json({ success: false, error: "server_error" });
    }
  });
  app2.post("/api/word-chain/ai-turn", (req, res) => {
    try {
      const { requiredLetter, usedWords } = req.body;
      if (!requiredLetter) return res.status(400).json({ error: "missing_params" });
      const used = new Set(usedWords || []);
      const allCategories = ["animals", "fruits", "vegetables", "cities", "countries", "objects", "boy_names", "girl_names"];
      const candidates = [];
      for (const cat of allCategories) {
        const ws = getWordsForLetter(cat, requiredLetter);
        for (const w of ws) {
          if (!used.has(w)) candidates.push(w);
        }
      }
      if (candidates.length === 0) {
        return res.json({ word: null, concede: true });
      }
      const word = candidates[Math.floor(Math.random() * candidates.length)];
      return res.json({ word, concede: false });
    } catch (e) {
      console.error("[word-chain-ai] error:", e);
      return res.status(500).json({ error: "server_error" });
    }
  });
  function getTodayDateString() {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  async function getOrCreateTodayChallenge() {
    const today = getTodayDateString();
    const existing = await db.select().from(dailyChallenges).where(eq2(dailyChallenges.date, today)).limit(1);
    if (existing.length > 0) return existing[0];
    const letter = ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)];
    const allCategories = ["animals", "fruits", "vegetables", "cities", "countries", "objects", "boy_names", "girl_names"];
    const candidateWords = [];
    for (const cat of allCategories) {
      const ws = getWordsForLetter(cat, letter);
      candidateWords.push(...ws);
    }
    const filtered = candidateWords.filter((w) => w.length >= 3 && w.length <= 7);
    const pool2 = filtered.length > 0 ? filtered : candidateWords;
    if (pool2.length === 0) {
      return getOrCreateTodayChallenge();
    }
    const word = pool2[Math.floor(Math.random() * pool2.length)];
    await db.insert(dailyChallenges).values({ date: today, word, letter }).onConflictDoNothing();
    const fresh = await db.select().from(dailyChallenges).where(eq2(dailyChallenges.date, today)).limit(1);
    return fresh[0] ?? { date: today, word, letter };
  }
  function applyWordleColoring(guess, target) {
    const result = [];
    const targetChars = [...target];
    const guessChars = [...guess];
    const used = new Array(targetChars.length).fill(false);
    for (let i = 0; i < guessChars.length; i++) {
      if (guessChars[i] === targetChars[i]) {
        result.push({ letter: guessChars[i], status: "correct" });
        used[i] = true;
      } else {
        result.push({ letter: guessChars[i], status: "absent" });
      }
    }
    for (let i = 0; i < guessChars.length; i++) {
      if (result[i].status === "correct") continue;
      const foundIdx = targetChars.findIndex((ch, idx) => !used[idx] && ch === guessChars[i]);
      if (foundIdx !== -1) {
        result[i] = { letter: guessChars[i], status: "present" };
        used[foundIdx] = true;
      }
    }
    return result;
  }
  app2.get("/api/daily-challenge", async (req, res) => {
    try {
      const { playerId } = req.query;
      const challenge = await getOrCreateTodayChallenge();
      const wordLength = [...challenge.word].length;
      let entry = null;
      if (playerId) {
        const rows = await db.select().from(dailyChallengeEntries).where(and2(eq2(dailyChallengeEntries.playerId, playerId), eq2(dailyChallengeEntries.date, challenge.date))).limit(1);
        if (rows.length > 0) {
          const r = rows[0];
          entry = { guesses: r.guesses, completed: r.completed, won: r.won, guessCount: r.guessCount, startedAt: r.startedAt };
        }
      }
      const revealedWord = entry?.completed ? challenge.word : null;
      res.json({
        date: challenge.date,
        letter: challenge.letter,
        wordLength,
        entry,
        word: revealedWord
      });
    } catch (e) {
      console.error("[daily-challenge] GET error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/daily-challenge/guess", async (req, res) => {
    try {
      const { playerId, guess } = req.body;
      if (!playerId || !guess) return res.status(400).json({ error: "missing_params" });
      const challenge = await getOrCreateTodayChallenge();
      const today = challenge.date;
      const MAX_GUESSES = 6;
      let entryRows = await db.select().from(dailyChallengeEntries).where(and2(eq2(dailyChallengeEntries.playerId, playerId), eq2(dailyChallengeEntries.date, today))).limit(1);
      let isNew = false;
      if (entryRows.length === 0) {
        await db.insert(dailyChallengeEntries).values({ playerId, date: today });
        entryRows = await db.select().from(dailyChallengeEntries).where(and2(eq2(dailyChallengeEntries.playerId, playerId), eq2(dailyChallengeEntries.date, today))).limit(1);
        isNew = true;
      }
      const entry = entryRows[0];
      if (entry.completed) return res.status(400).json({ error: "already_completed" });
      const currentGuesses = entry.guesses;
      if (currentGuesses.length >= MAX_GUESSES) return res.status(400).json({ error: "max_guesses_reached" });
      const guessChars = [...guess.trim()];
      const targetChars = [...challenge.word];
      if (guessChars.length !== targetChars.length) {
        return res.status(400).json({ error: "wrong_length", expected: targetChars.length });
      }
      const coloring = applyWordleColoring(guess.trim(), challenge.word);
      const newGuesses = [...currentGuesses, guess.trim()];
      const won = guess.trim() === challenge.word;
      const completed = won || newGuesses.length >= MAX_GUESSES;
      const now = /* @__PURE__ */ new Date();
      const durationSeconds = Math.round((now.getTime() - entry.startedAt.getTime()) / 1e3);
      await db.update(dailyChallengeEntries).set({
        guesses: newGuesses,
        guessCount: newGuesses.length,
        completed,
        won,
        finishedAt: completed ? now : null,
        durationSeconds: completed ? durationSeconds : entry.durationSeconds
      }).where(and2(eq2(dailyChallengeEntries.playerId, playerId), eq2(dailyChallengeEntries.date, today)));
      let coinsAwarded = 0;
      if (completed) {
        if (won) {
          coinsAwarded = Math.max(10, 60 - (newGuesses.length - 1) * 10);
          await db.update(playerProfiles).set({ coins: sql3`coins + ${coinsAwarded}`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, playerId));
        }
        const allEntries = await db.select({ guessCount: dailyChallengeEntries.guessCount, durationSeconds: dailyChallengeEntries.durationSeconds, won: dailyChallengeEntries.won }).from(dailyChallengeEntries).where(and2(eq2(dailyChallengeEntries.date, today), eq2(dailyChallengeEntries.completed, true)));
        const sorted = allEntries.filter((e) => e.won).sort((a, b) => a.guessCount - b.guessCount || a.durationSeconds - b.durationSeconds);
        const rank = won ? sorted.findIndex((e) => e.guessCount === newGuesses.length && e.durationSeconds === durationSeconds) + 1 : null;
        if (rank) {
          await db.update(dailyChallengeEntries).set({ rank }).where(and2(eq2(dailyChallengeEntries.playerId, playerId), eq2(dailyChallengeEntries.date, today)));
        }
      }
      return res.json({
        coloring,
        won,
        completed,
        guessCount: newGuesses.length,
        word: completed ? challenge.word : null,
        coinsAwarded: completed ? coinsAwarded : 0
      });
    } catch (e) {
      console.error("[daily-challenge] POST guess error:", e);
      return res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/daily-challenge/leaderboard", async (_req, res) => {
    try {
      const today = getTodayDateString();
      const rows = await db.select({
        playerId: dailyChallengeEntries.playerId,
        guessCount: dailyChallengeEntries.guessCount,
        durationSeconds: dailyChallengeEntries.durationSeconds,
        rank: dailyChallengeEntries.rank,
        finishedAt: dailyChallengeEntries.finishedAt,
        name: playerProfiles.name,
        skin: playerProfiles.equippedSkin,
        level: playerProfiles.level
      }).from(dailyChallengeEntries).innerJoin(playerProfiles, eq2(dailyChallengeEntries.playerId, playerProfiles.id)).where(and2(eq2(dailyChallengeEntries.date, today), eq2(dailyChallengeEntries.completed, true), eq2(dailyChallengeEntries.won, true))).orderBy(asc(dailyChallengeEntries.guessCount), asc(dailyChallengeEntries.durationSeconds)).limit(20);
      res.json(rows.map((r, idx) => ({ ...r, displayRank: idx + 1 })));
    } catch (e) {
      console.error("[daily-challenge] leaderboard error:", e);
      res.status(500).json({ error: "server_error" });
    }
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
      let [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, req.params.id));
      if (!profile) {
        const playerCode = await ensurePlayerCode(req.params.id);
        const randomName = generateRandomPlayerName();
        const playerTag = await generateUniquePlayerTag();
        const refCode = await generateUniqueReferralCode();
        [profile] = await db.insert(playerProfiles).values({
          id: req.params.id,
          playerCode,
          playerTag,
          name: randomName,
          referralCode: refCode
        }).returning();
      } else {
        const updates = {};
        if (!profile.playerCode) updates.playerCode = await ensurePlayerCode(req.params.id);
        if (!profile.playerTag) updates.playerTag = await generateUniquePlayerTag();
        if (Object.keys(updates).length > 0) {
          [profile] = await db.update(playerProfiles).set(updates).where(eq2(playerProfiles.id, req.params.id)).returning();
        }
      }
      const displayId = profile.playerTag ? `WM-${profile.playerTag.toString().padStart(5, "0")}` : null;
      res.json({ ...profile, displayId });
    } catch (e) {
      console.error("GET /api/player error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.put("/api/player/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const data = req.body;
      const [existing] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, id));
      if (!existing) {
        const playerCode = await ensurePlayerCode(id);
        const playerTag = await generateUniquePlayerTag();
        const refCode = await generateUniqueReferralCode();
        const [created] = await db.insert(playerProfiles).values({
          id,
          playerCode,
          playerTag,
          referralCode: refCode,
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
        try {
          const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
          const chosenTasks = pickDailyTasks();
          for (const def of chosenTasks) {
            await db.insert(playerDailyTasks).values({
              playerId: id,
              taskKey: def.key,
              assignedDate: today,
              progress: 0,
              baselineWins: 0,
              baselineGames: 0,
              baselineScore: 0
            });
          }
        } catch (e) {
          console.error("[init] Failed to seed daily tasks for new player:", e);
        }
        try {
          for (const def of ACHIEVEMENT_DEFS) {
            await db.insert(playerAchievements).values({
              playerId: id,
              achievementKey: def.key,
              progress: 0,
              unlocked: 0,
              claimed: 0
            });
          }
        } catch (e) {
          console.error("[init] Failed to seed achievements for new player:", e);
        }
        return res.json(created);
      }
      const updateData = { updatedAt: /* @__PURE__ */ new Date() };
      if (!existing.playerCode) updateData.playerCode = await ensurePlayerCode(id);
      if (!existing.playerTag) updateData.playerTag = await generateUniquePlayerTag();
      if (!existing.referralCode) updateData.referralCode = await generateUniqueReferralCode();
      const allowedFields = ["name", "coins", "xp", "level", "equippedSkin", "ownedSkins", "equippedTitle", "ownedTitles", "totalScore", "gamesPlayed", "wins", "winStreak", "bestStreak", "lastStreakReward", "powerCards", "country"];
      for (const key of allowedFields) {
        if (data[key] !== void 0) {
          if (key === "country" && data[key] === null) continue;
          updateData[key] = data[key];
        }
      }
      const [updated] = await db.update(playerProfiles).set(updateData).where(eq2(playerProfiles.id, id)).returning();
      res.json(updated);
    } catch (e) {
      console.error("PUT /api/player error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/player/:id/purchase", async (req, res) => {
    try {
      const id = req.params.id;
      const { itemType, itemId, price } = req.body;
      if (!itemType || !itemId || typeof price !== "number" || price < 0) {
        return res.status(400).json({ error: "invalid_params" });
      }
      const [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, id));
      if (!profile) return res.status(404).json({ error: "player_not_found" });
      if (profile.coins < price) return res.status(402).json({ error: "insufficient_coins" });
      const ownedSkins = Array.isArray(profile.ownedSkins) ? profile.ownedSkins : [];
      const ownedTitles = Array.isArray(profile.ownedTitles) ? profile.ownedTitles : [];
      if (itemType === "skin" && ownedSkins.includes(itemId)) {
        return res.json({ profile, alreadyOwned: true });
      }
      if (itemType === "title" && ownedTitles.includes(itemId)) {
        return res.json({ profile, alreadyOwned: true });
      }
      const updates = { coins: profile.coins - price, updatedAt: /* @__PURE__ */ new Date() };
      if (itemType === "skin") updates.ownedSkins = [...ownedSkins, itemId];
      if (itemType === "title") updates.ownedTitles = [...ownedTitles, itemId];
      const [updated] = await db.update(playerProfiles).set(updates).where(eq2(playerProfiles.id, id)).returning();
      return res.json({ profile: updated });
    } catch (e) {
      console.error("POST /api/player/:id/purchase error:", e);
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
      const [updated] = await db.update(playerProfiles).set({ name: trimmed, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, player_id)).returning();
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
      let [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, id));
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
      const isVip = profile.isVip && (!profile.vipExpiresAt || new Date(profile.vipExpiresAt) > /* @__PURE__ */ new Date());
      const coinMultiplier = isVip ? 2 : 1;
      const updates = { lastSpinAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() };
      if (reward.type === "coins") {
        updates.coins = profile.coins + reward.amount * coinMultiplier;
      } else if (reward.type === "xp") {
        updates.xp = profile.xp + reward.amount;
        updates.level = Math.floor((profile.xp + reward.amount) / 100) + 1;
      } else if (reward.type === "powerCard") {
        const currentCards = profile.powerCards || {};
        const cardKeys = ["time", "freeze", "hint"];
        const randomCard = cardKeys[Math.floor(Math.random() * cardKeys.length)];
        updates.powerCards = { ...currentCards, [randomCard]: (currentCards[randomCard] || 0) + 1 };
      }
      const [updated] = await db.update(playerProfiles).set(updates).where(eq2(playerProfiles.id, id)).returning();
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
      const [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, req.params.id));
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
      let [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, id));
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
      const isVip = profile.isVip && (!profile.vipExpiresAt || new Date(profile.vipExpiresAt) > /* @__PURE__ */ new Date());
      const vipMultiplier = isVip ? 2 : 1;
      const totalCoins = (coinsEarned + streakBonus + coinEntryReward) * vipMultiplier;
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
      }).where(eq2(playerProfiles.id, id)).returning();
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
  app2.post("/api/player/:id/activate-vip", async (req, res) => {
    try {
      const id = req.params.id;
      const { duration, subscriptionId } = req.body;
      const durationDays = duration || 30;
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1e3);
      const [updated] = await db.update(playerProfiles).set({
        isVip: true,
        vipExpiresAt: expiresAt,
        vipSubscriptionId: subscriptionId || null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(playerProfiles.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "player_not_found" });
      res.json({ success: true, profile: updated });
    } catch (e) {
      console.error("POST /api/player/:id/activate-vip error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/player/:id/vip-status", async (req, res) => {
    try {
      const [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, req.params.id));
      if (!profile) return res.status(404).json({ error: "player_not_found" });
      const isActive = profile.isVip && (!profile.vipExpiresAt || new Date(profile.vipExpiresAt) > /* @__PURE__ */ new Date());
      res.json({
        isVip: isActive,
        vipExpiresAt: profile.vipExpiresAt,
        vipSubscriptionId: profile.vipSubscriptionId
      });
    } catch (e) {
      console.error("GET /api/player/:id/vip-status error:", e);
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
      const openTournaments = await db.select().from(tournaments).where(eq2(tournaments.status, "open")).orderBy(desc(tournaments.createdAt));
      const result = [];
      for (const t of openTournaments) {
        const players = await db.select().from(tournamentPlayers).where(eq2(tournamentPlayers.tournamentId, t.id)).orderBy(asc(tournamentPlayers.joinedAt));
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
      const [t] = await db.select().from(tournaments).where(eq2(tournaments.id, id));
      if (!t) return res.status(404).json({ error: "not_found" });
      const players = await db.select().from(tournamentPlayers).where(eq2(tournamentPlayers.tournamentId, id));
      const matches = await db.select().from(tournamentMatches).where(eq2(tournamentMatches.tournamentId, id));
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
      const [t] = await db.select().from(tournaments).where(eq2(tournaments.id, tournamentId));
      if (!t) return res.status(404).json({ error: "not_found" });
      if (t.status !== "open") return res.status(400).json({ error: "tournament_closed" });
      const existingPlayers = await db.select().from(tournamentPlayers).where(eq2(tournamentPlayers.tournamentId, tournamentId));
      if (existingPlayers.some((p) => p.playerId === playerId)) return res.status(400).json({ error: "already_joined" });
      const maxCapacity = t.maxPlayers ?? TOURNAMENT_SIZE;
      if (existingPlayers.length >= maxCapacity) return res.status(400).json({ error: "tournament_full" });
      const [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, playerId));
      if (!profile || profile.coins < TOURNAMENT_ENTRY_FEE) return res.status(400).json({ error: "insufficient_coins" });
      await db.update(playerProfiles).set({ coins: profile.coins - TOURNAMENT_ENTRY_FEE, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, playerId));
      const seed = existingPlayers.length + 1;
      await db.insert(tournamentPlayers).values({ tournamentId, playerId, playerName, playerSkin, seed });
      tournamentPlayerSocketMap.set(playerId, socketId);
      const newPrizePool = t.prizePool + TOURNAMENT_ENTRY_FEE;
      await db.update(tournaments).set({ prizePool: newPrizePool }).where(eq2(tournaments.id, tournamentId));
      const allPlayers = await db.select().from(tournamentPlayers).where(eq2(tournamentPlayers.tournamentId, tournamentId));
      const maxP = t.maxPlayers ?? TOURNAMENT_SIZE;
      if (allPlayers.length >= maxP) {
        await db.update(tournaments).set({ status: "in_progress", startedAt: /* @__PURE__ */ new Date() }).where(eq2(tournaments.id, tournamentId));
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
      const [t] = await db.select().from(tournaments).where(eq2(tournaments.id, tournamentId));
      if (!t) return res.status(404).json({ error: "not_found" });
      if (t.status !== "open") return res.status(400).json({ error: "tournament_already_started" });
      const [existing] = await db.select().from(tournamentPlayers).where(
        and2(eq2(tournamentPlayers.tournamentId, tournamentId), eq2(tournamentPlayers.playerId, playerId))
      );
      if (!existing) return res.status(400).json({ error: "not_in_tournament" });
      const playerName = existing.playerName;
      await db.delete(tournamentPlayers).where(
        and2(eq2(tournamentPlayers.tournamentId, tournamentId), eq2(tournamentPlayers.playerId, playerId))
      );
      tournamentPlayerSocketMap.delete(playerId);
      const [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, playerId));
      if (profile) {
        await db.update(playerProfiles).set({
          coins: profile.coins + TOURNAMENT_ENTRY_FEE,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq2(playerProfiles.id, playerId));
      }
      const remainingPlayers = await db.select().from(tournamentPlayers).where(eq2(tournamentPlayers.tournamentId, tournamentId));
      if (remainingPlayers.length === 0) {
        await db.delete(tournamentMatches).where(eq2(tournamentMatches.tournamentId, tournamentId)).catch(() => {
        });
        await db.delete(tournamentPlayers).where(eq2(tournamentPlayers.tournamentId, tournamentId)).catch(() => {
        });
        await db.delete(tournaments).where(eq2(tournaments.id, tournamentId)).catch(() => {
        });
        activeTournaments.delete(tournamentId);
        io.emit("tournament_cancelled", { tournamentId });
        console.log(`[leave] Tournament ${tournamentId} deleted \u2014 no players remaining`);
      } else {
        const newPrizePool = Math.max(0, t.prizePool - TOURNAMENT_ENTRY_FEE);
        await db.update(tournaments).set({ prizePool: newPrizePool }).where(eq2(tournaments.id, tournamentId));
        io.emit("tournament_player_left", {
          tournamentId,
          playerCount: remainingPlayers.length,
          maxPlayers: t.maxPlayers ?? TOURNAMENT_SIZE,
          playerName
        });
        console.log(`[leave] Player ${playerName} left tournament ${tournamentId} \u2014 ${remainingPlayers.length}/${t.maxPlayers ?? TOURNAMENT_SIZE} remaining`);
      }
      const [updatedProfile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, playerId));
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
      const entries = await db.select().from(tournamentPlayers).where(eq2(tournamentPlayers.playerId, playerId));
      const result = [];
      for (const entry of entries) {
        const [t] = await db.select().from(tournaments).where(eq2(tournaments.id, entry.tournamentId));
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
      const country = req.query.country || null;
      const countryFilter = country ? eq2(playerProfiles.country, country) : void 0;
      let players;
      if (type === "wins") {
        players = await db.select().from(playerProfiles).where(countryFilter).orderBy(desc(playerProfiles.wins)).limit(50);
      } else if (type === "xp") {
        players = await db.select().from(playerProfiles).where(countryFilter).orderBy(desc(playerProfiles.xp)).limit(50);
      } else if (type === "ranked") {
        players = await db.select().from(playerProfiles).where(countryFilter).orderBy(desc(playerProfiles.elo)).limit(50);
      } else {
        players = await db.select().from(playerProfiles).where(countryFilter).orderBy(desc(playerProfiles.totalScore)).limit(50);
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
        gamesPlayed: p.gamesPlayed,
        isVip: p.isVip && (!p.vipExpiresAt || new Date(p.vipExpiresAt) > /* @__PURE__ */ new Date()),
        elo: p.elo ?? 1e3,
        division: p.division ?? "silver",
        seasonWins: p.seasonWins ?? 0,
        seasonLosses: p.seasonLosses ?? 0,
        country: p.country ?? "MA"
      }));
      res.json(result);
    } catch (e) {
      console.error("GET /api/leaderboard error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/ranked/season", async (_req, res) => {
    try {
      const [season] = await db.select().from(seasons).where(eq2(seasons.status, "active")).limit(1);
      if (!season) return res.json({ season: null });
      const now = /* @__PURE__ */ new Date();
      const daysLeft = Math.max(0, Math.ceil((new Date(season.endDate).getTime() - now.getTime()) / (1e3 * 60 * 60 * 24)));
      res.json({ season: { ...season, daysLeft } });
    } catch (e) {
      console.error("GET /api/ranked/season error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/ranked/leaderboard", async (req, res) => {
    try {
      const country = req.query.country || null;
      const countryFilter = country ? eq2(playerProfiles.country, country) : void 0;
      const players = await db.select().from(playerProfiles).where(countryFilter).orderBy(desc(playerProfiles.elo)).limit(50);
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
        gamesPlayed: p.gamesPlayed,
        isVip: p.isVip && (!p.vipExpiresAt || new Date(p.vipExpiresAt) > /* @__PURE__ */ new Date()),
        elo: p.elo ?? 1e3,
        division: p.division ?? "silver",
        seasonWins: p.seasonWins ?? 0,
        seasonLosses: p.seasonLosses ?? 0,
        country: p.country ?? "MA"
      }));
      res.json(result);
    } catch (e) {
      console.error("GET /api/ranked/leaderboard error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/clans/leaderboard", async (_req, res) => {
    try {
      const top = await db.select().from(clans).orderBy(desc(clans.totalWarScore)).limit(10);
      const result = await Promise.all(top.map(async (c, idx) => {
        const memberCount = await db.select({ count: sql3`count(*)` }).from(clanMembers).where(eq2(clanMembers.clanId, c.id));
        return { ...c, rank: idx + 1, memberCount: Number(memberCount[0]?.count ?? 0) };
      }));
      res.json(result);
    } catch (e) {
      console.error("GET /api/clans/leaderboard error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/clans/search", async (req, res) => {
    try {
      const q = (req.query.q || "").trim();
      if (q.length < 2) return res.json([]);
      const results = await db.select().from(clans).where(ilike(clans.name, `%${q}%`)).limit(20);
      const withCounts = await Promise.all(results.map(async (c) => {
        const memberCount = await db.select({ count: sql3`count(*)` }).from(clanMembers).where(eq2(clanMembers.clanId, c.id));
        return { ...c, memberCount: Number(memberCount[0]?.count ?? 0) };
      }));
      return res.json(withCounts);
    } catch (e) {
      console.error("GET /api/clans/search error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/clans/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [clan] = await db.select().from(clans).where(eq2(clans.id, id)).limit(1);
      if (!clan) return res.status(404).json({ error: "not_found" });
      const members = await db.select({
        id: clanMembers.id,
        playerId: clanMembers.playerId,
        warScore: clanMembers.warScore,
        role: clanMembers.role,
        joinedAt: clanMembers.joinedAt,
        name: playerProfiles.name,
        equippedSkin: playerProfiles.equippedSkin,
        level: playerProfiles.level
      }).from(clanMembers).innerJoin(playerProfiles, eq2(clanMembers.playerId, playerProfiles.id)).where(eq2(clanMembers.clanId, id)).orderBy(desc(clanMembers.warScore));
      const leaderboardRank = await db.select({ count: sql3`count(*)` }).from(clans).where(sql3`total_war_score > ${clan.totalWarScore}`);
      const rank = Number(leaderboardRank[0]?.count ?? 0) + 1;
      res.json({ ...clan, members, rank });
    } catch (e) {
      console.error("GET /api/clans/:id error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/clans/create", async (req, res) => {
    try {
      const { playerId, name, emoji } = req.body;
      if (!playerId || !name?.trim() || !emoji) return res.status(400).json({ error: "missing_params" });
      const [player] = await db.select({ coins: playerProfiles.coins, clanId: playerProfiles.clanId }).from(playerProfiles).where(eq2(playerProfiles.id, playerId)).limit(1);
      if (!player) return res.status(404).json({ error: "player_not_found" });
      if (player.clanId) return res.status(400).json({ error: "already_in_clan" });
      if (player.coins < 500) return res.status(400).json({ error: "insufficient_coins" });
      const [existing] = await db.select({ id: clans.id }).from(clans).where(ilike(clans.name, name.trim())).limit(1);
      if (existing) return res.status(400).json({ error: "name_taken" });
      const result = await db.transaction(async (tx) => {
        const [newClan] = await tx.insert(clans).values({ name: name.trim(), emoji, leaderId: playerId }).returning();
        await tx.insert(clanMembers).values({ clanId: newClan.id, playerId, role: "leader", warScore: 0 });
        await tx.update(playerProfiles).set({ coins: player.coins - 500, clanId: newClan.id, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, playerId));
        return { clan: newClan, coins: player.coins - 500 };
      });
      res.json(result);
    } catch (e) {
      console.error("POST /api/clans/create error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/clans/:id/join", async (req, res) => {
    try {
      const { id } = req.params;
      const { playerId } = req.body;
      if (!playerId) return res.status(400).json({ error: "missing_params" });
      const [clan] = await db.select().from(clans).where(eq2(clans.id, id)).limit(1);
      if (!clan) return res.status(404).json({ error: "not_found" });
      const [player] = await db.select({ clanId: playerProfiles.clanId }).from(playerProfiles).where(eq2(playerProfiles.id, playerId)).limit(1);
      if (!player) return res.status(404).json({ error: "player_not_found" });
      if (player.clanId) return res.status(400).json({ error: "already_in_clan" });
      const memberCount = await db.select({ count: sql3`count(*)` }).from(clanMembers).where(eq2(clanMembers.clanId, id));
      if (Number(memberCount[0]?.count ?? 0) >= 20) return res.status(400).json({ error: "clan_full" });
      await db.transaction(async (tx) => {
        await tx.insert(clanMembers).values({ clanId: id, playerId, role: "member", warScore: 0 });
        await tx.update(playerProfiles).set({ clanId: id, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, playerId));
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/clans/:id/join error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/clans/:id/leave", async (req, res) => {
    try {
      const { id } = req.params;
      const { playerId } = req.body;
      if (!playerId) return res.status(400).json({ error: "missing_params" });
      const [clan] = await db.select().from(clans).where(eq2(clans.id, id)).limit(1);
      if (!clan) return res.status(404).json({ error: "not_found" });
      const [membership] = await db.select({ id: clanMembers.id }).from(clanMembers).where(and2(eq2(clanMembers.clanId, id), eq2(clanMembers.playerId, playerId))).limit(1);
      if (!membership) return res.status(400).json({ error: "not_a_member" });
      await db.transaction(async (tx) => {
        await tx.delete(clanMembers).where(and2(eq2(clanMembers.clanId, id), eq2(clanMembers.playerId, playerId)));
        await tx.update(playerProfiles).set({ clanId: null, updatedAt: /* @__PURE__ */ new Date() }).where(and2(eq2(playerProfiles.id, playerId), eq2(playerProfiles.clanId, id)));
        const remaining = await tx.select({ warScore: clanMembers.warScore }).from(clanMembers).where(eq2(clanMembers.clanId, id));
        const total = remaining.reduce((sum, m) => sum + (m.warScore ?? 0), 0);
        await tx.update(clans).set({ totalWarScore: total }).where(eq2(clans.id, id));
        if (clan.leaderId === playerId) {
          const others = await tx.select().from(clanMembers).where(eq2(clanMembers.clanId, id)).orderBy(desc(clanMembers.warScore)).limit(1);
          if (others.length > 0) {
            await tx.update(clans).set({ leaderId: others[0].playerId }).where(eq2(clans.id, id));
            await tx.update(clanMembers).set({ role: "leader" }).where(and2(eq2(clanMembers.clanId, id), eq2(clanMembers.playerId, others[0].playerId)));
          } else {
            await tx.delete(clans).where(eq2(clans.id, id));
          }
        }
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/clans/:id/leave error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/clans/:id/kick", async (req, res) => {
    try {
      const { id } = req.params;
      const { leaderId, targetPlayerId } = req.body;
      if (!leaderId || !targetPlayerId) return res.status(400).json({ error: "missing_params" });
      const [clan] = await db.select().from(clans).where(eq2(clans.id, id)).limit(1);
      if (!clan) return res.status(404).json({ error: "not_found" });
      if (clan.leaderId !== leaderId) return res.status(403).json({ error: "not_leader" });
      if (targetPlayerId === leaderId) return res.status(400).json({ error: "cannot_kick_self" });
      const [targetMembership] = await db.select({ id: clanMembers.id }).from(clanMembers).where(and2(eq2(clanMembers.clanId, id), eq2(clanMembers.playerId, targetPlayerId))).limit(1);
      if (!targetMembership) return res.status(400).json({ error: "not_a_member" });
      await db.transaction(async (tx) => {
        await tx.delete(clanMembers).where(and2(eq2(clanMembers.clanId, id), eq2(clanMembers.playerId, targetPlayerId)));
        await tx.update(playerProfiles).set({ clanId: null, updatedAt: /* @__PURE__ */ new Date() }).where(and2(eq2(playerProfiles.id, targetPlayerId), eq2(playerProfiles.clanId, id)));
        const remaining = await tx.select({ warScore: clanMembers.warScore }).from(clanMembers).where(eq2(clanMembers.clanId, id));
        const total = remaining.reduce((sum, m) => sum + (m.warScore ?? 0), 0);
        await tx.update(clans).set({ totalWarScore: total }).where(eq2(clans.id, id));
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/clans/:id/kick error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/clans/:id/rename", async (req, res) => {
    try {
      const { id } = req.params;
      const { leaderId, name } = req.body;
      if (!leaderId || !name?.trim()) return res.status(400).json({ error: "missing_params" });
      const [clan] = await db.select().from(clans).where(eq2(clans.id, id)).limit(1);
      if (!clan) return res.status(404).json({ error: "not_found" });
      if (clan.leaderId !== leaderId) return res.status(403).json({ error: "not_leader" });
      const trimmed = name.trim();
      const [existing] = await db.select({ id: clans.id }).from(clans).where(and2(ilike(clans.name, trimmed), sql3`${clans.id} != ${id}`)).limit(1);
      if (existing) return res.status(400).json({ error: "name_taken" });
      await db.update(clans).set({ name: trimmed }).where(eq2(clans.id, id));
      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/clans/:id/rename error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/battle-pass/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const [activeSeason] = await db.select().from(seasons).where(eq2(seasons.status, "active")).limit(1);
      if (!activeSeason) return res.status(404).json({ error: "no_active_season" });
      const pass = await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
      const tiers = await db.select().from(battlePassTiers).where(eq2(battlePassTiers.seasonId, activeSeason.id)).orderBy(asc(battlePassTiers.tier));
      res.json({
        season: { id: activeSeason.id, name: activeSeason.name, endDate: activeSeason.endDate },
        passXp: pass.passXp,
        currentTier: pass.currentTier,
        premiumUnlocked: pass.premiumUnlocked,
        claimedTiers: Array.isArray(pass.claimedTiers) ? pass.claimedTiers : [],
        xpPerTier: BP_XP_PER_TIER,
        premiumCost: BP_PREMIUM_COST,
        tiers
      });
    } catch (e) {
      console.error("GET /api/battle-pass/:playerId error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/battle-pass/:playerId/buy-premium", async (req, res) => {
    try {
      const { playerId } = req.params;
      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq2(seasons.status, "active")).limit(1);
      if (!activeSeason) return res.status(404).json({ error: "no_active_season" });
      await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
      let newCoins;
      await db.transaction(async (tx) => {
        const [profile] = await tx.select({ coins: playerProfiles.coins }).from(playerProfiles).where(eq2(playerProfiles.id, playerId)).limit(1);
        if (!profile) throw Object.assign(new Error("player_not_found"), { statusCode: 404 });
        if (profile.coins < BP_PREMIUM_COST) throw Object.assign(new Error("insufficient_coins"), { statusCode: 400 });
        const updated = await tx.update(playerBattlePass).set({ premiumUnlocked: true, updatedAt: /* @__PURE__ */ new Date() }).where(and2(
          eq2(playerBattlePass.playerId, playerId),
          eq2(playerBattlePass.seasonId, activeSeason.id),
          eq2(playerBattlePass.premiumUnlocked, false)
        )).returning({ id: playerBattlePass.id });
        if (updated.length === 0) throw Object.assign(new Error("already_premium"), { statusCode: 400 });
        const [updatedProfile] = await tx.update(playerProfiles).set({ coins: sql3`coins - ${BP_PREMIUM_COST}`, updatedAt: /* @__PURE__ */ new Date() }).where(and2(eq2(playerProfiles.id, playerId), sql3`coins >= ${BP_PREMIUM_COST}`)).returning({ coins: playerProfiles.coins });
        if (!updatedProfile) throw Object.assign(new Error("insufficient_coins"), { statusCode: 400 });
        newCoins = updatedProfile.coins;
      });
      res.json({ ok: true, coins: newCoins });
    } catch (e) {
      const err = e;
      if (err.statusCode && err.message) return res.status(err.statusCode).json({ error: err.message });
      console.error("POST /api/battle-pass/:playerId/buy-premium error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/battle-pass/:playerId/claim/:tier", async (req, res) => {
    try {
      const { playerId, tier: tierStr } = req.params;
      const { track } = req.body;
      const tierNum = parseInt(tierStr, 10);
      if (isNaN(tierNum) || tierNum < 1 || tierNum > 30) return res.status(400).json({ error: "invalid_tier" });
      if (track !== "free" && track !== "premium") return res.status(400).json({ error: "invalid_track" });
      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq2(seasons.status, "active")).limit(1);
      if (!activeSeason) return res.status(404).json({ error: "no_active_season" });
      await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
      const [tierDef] = await db.select().from(battlePassTiers).where(and2(eq2(battlePassTiers.seasonId, activeSeason.id), eq2(battlePassTiers.tier, tierNum))).limit(1);
      if (!tierDef) return res.status(404).json({ error: "tier_not_found" });
      const rewardType = track === "free" ? tierDef.freeRewardType : tierDef.premiumRewardType;
      const rewardId = track === "free" ? tierDef.freeRewardId : tierDef.premiumRewardId;
      const rewardAmt = track === "free" ? tierDef.freeRewardAmount : tierDef.premiumRewardAmount;
      const claimedKey = `${tierNum}_${track}`;
      let resultNewCoins = 0;
      const grantedLabel = [];
      await db.transaction(async (tx) => {
        const [pass] = await tx.select().from(playerBattlePass).where(and2(eq2(playerBattlePass.playerId, playerId), eq2(playerBattlePass.seasonId, activeSeason.id))).limit(1);
        if (!pass) throw Object.assign(new Error("pass_not_found"), { statusCode: 404 });
        if (pass.currentTier < tierNum) throw Object.assign(new Error("tier_not_reached"), { statusCode: 400 });
        if (track === "premium" && !pass.premiumUnlocked) throw Object.assign(new Error("premium_not_unlocked"), { statusCode: 403 });
        const claimedArr = Array.isArray(pass.claimedTiers) ? pass.claimedTiers : [];
        if (claimedArr.includes(claimedKey)) throw Object.assign(new Error("already_claimed"), { statusCode: 400 });
        const [profile] = await tx.select().from(playerProfiles).where(eq2(playerProfiles.id, playerId)).limit(1);
        if (!profile) throw Object.assign(new Error("player_not_found"), { statusCode: 404 });
        resultNewCoins = profile.coins;
        if (rewardType === "coins") {
          const [updProf] = await tx.update(playerProfiles).set({ coins: sql3`coins + ${rewardAmt}`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, playerId)).returning({ coins: playerProfiles.coins });
          resultNewCoins = updProf?.coins ?? profile.coins + rewardAmt;
          grantedLabel.push(`\u{1FA99} +${rewardAmt}`);
        } else if (rewardType === "powerCard" && rewardId) {
          const pc = profile.powerCards ?? { time: 0, freeze: 0, hint: 0 };
          const newPc = { ...pc, [rewardId]: (pc[rewardId] ?? 0) + rewardAmt };
          await tx.update(playerProfiles).set({ powerCards: newPc, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, playerId));
          grantedLabel.push(`\u{1F0CF} +${rewardAmt} ${rewardId}`);
        } else if (rewardType === "skin" && rewardId) {
          const owned = Array.isArray(profile.ownedSkins) ? profile.ownedSkins : [];
          if (!owned.includes(rewardId)) {
            await tx.update(playerProfiles).set({ ownedSkins: [...owned, rewardId], updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, playerId));
            grantedLabel.push(`\u{1F457} ${rewardId}`);
          }
        } else if (rewardType === "title" && rewardId) {
          const owned = Array.isArray(profile.ownedTitles) ? profile.ownedTitles : [];
          if (!owned.includes(rewardId)) {
            await tx.update(playerProfiles).set({ ownedTitles: [...owned, rewardId], updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, playerId));
            grantedLabel.push(`\u{1F451} ${rewardId}`);
          }
        }
        const updateResult = await tx.update(playerBattlePass).set({
          claimedTiers: sql3`claimed_tiers || ${JSON.stringify([claimedKey])}::jsonb`,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(and2(
          eq2(playerBattlePass.playerId, playerId),
          eq2(playerBattlePass.seasonId, activeSeason.id),
          sql3`NOT (claimed_tiers @> ${JSON.stringify([claimedKey])}::jsonb)`
        )).returning({ id: playerBattlePass.id });
        if (updateResult.length === 0) throw Object.assign(new Error("already_claimed"), { statusCode: 400 });
      });
      res.json({
        ok: true,
        granted: grantedLabel,
        rewardType,
        rewardId: rewardId ?? null,
        rewardAmount: rewardAmt,
        newCoins: resultNewCoins
      });
    } catch (e) {
      const err = e;
      if (err.statusCode && err.message) return res.status(err.statusCode).json({ error: err.message });
      console.error("POST /api/battle-pass/:playerId/claim/:tier error:", e);
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
      const wmMatch = q.match(/^WM-?(\d+)$/i);
      if (wmMatch) {
        const tagNum = parseInt(wmMatch[1], 10);
        if (isNaN(tagNum)) return res.json([]);
        const whereClause2 = myId ? and2(eq2(playerProfiles.playerTag, tagNum), ne(playerProfiles.id, myId)) : eq2(playerProfiles.playerTag, tagNum);
        const rows2 = await db.select(selectFields).from(playerProfiles).where(whereClause2).limit(5);
        return res.json(rows2.map((r) => ({ ...r, displayId: r.playerTag ? `WM-${r.playerTag.toString().padStart(5, "0")}` : null })));
      }
      if (q.includes("#")) {
        const hashIdx = q.lastIndexOf("#");
        const namePart = q.slice(0, hashIdx).trim();
        const tagStr = q.slice(hashIdx + 1).trim();
        const tagNum = parseInt(tagStr, 10);
        if (isNaN(tagNum)) return res.json([]);
        let whereClause2;
        if (namePart) {
          const nameCondition = ilike(playerProfiles.name, namePart);
          const tagCondition = eq2(playerProfiles.playerTag, tagNum);
          whereClause2 = myId ? and2(nameCondition, tagCondition, ne(playerProfiles.id, myId)) : and2(nameCondition, tagCondition);
        } else {
          const tagCondition = eq2(playerProfiles.playerTag, tagNum);
          whereClause2 = myId ? and2(tagCondition, ne(playerProfiles.id, myId)) : tagCondition;
        }
        const rows2 = await db.select(selectFields).from(playerProfiles).where(whereClause2).limit(10);
        return res.json(rows2.map((r) => ({ ...r, displayId: r.playerTag ? `WM-${r.playerTag.toString().padStart(5, "0")}` : null })));
      }
      const searchCondition = or(
        ilike(playerProfiles.name, `%${q}%`),
        and2(isNotNull2(playerProfiles.playerCode), ilike(playerProfiles.playerCode, `%${q}%`))
      );
      const excludeSelf = myId ? ne(playerProfiles.id, myId) : void 0;
      const whereClause = excludeSelf ? and2(searchCondition, excludeSelf) : searchCondition;
      const rows = await db.select(selectFields).from(playerProfiles).where(whereClause).orderBy(desc(playerProfiles.wins)).limit(20);
      const missing = rows.filter((r) => !r.playerCode);
      if (missing.length > 0) {
        Promise.all(missing.map(async (r) => {
          const code = await ensurePlayerCode(r.id);
          await db.update(playerProfiles).set({ playerCode: code }).where(eq2(playerProfiles.id, r.id));
        })).catch(() => {
        });
      }
      const withDisplayId = rows.map((r) => ({
        ...r,
        displayId: r.playerTag ? `WM-${r.playerTag.toString().padStart(5, "0")}` : null
      }));
      res.json(withDisplayId);
    } catch (e) {
      console.error("GET /api/players/search error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/friends/list/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const rows = await db.select().from(friends).where(
        or(eq2(friends.playerId, playerId), eq2(friends.friendId, playerId))
      );
      const profileFields = {
        id: playerProfiles.id,
        playerTag: playerProfiles.playerTag,
        name: playerProfiles.name,
        skin: playerProfiles.equippedSkin,
        level: playerProfiles.level,
        wins: playerProfiles.wins
      };
      const playerSocketMap = /* @__PURE__ */ new Map();
      for (const [sockId, pid] of socketPlayerIdMap) {
        playerSocketMap.set(pid, sockId);
      }
      const result = [];
      for (const row of rows) {
        const otherId = row.playerId === playerId ? row.friendId : row.playerId;
        const [p] = await db.select(profileFields).from(playerProfiles).where(eq2(playerProfiles.id, otherId));
        if (!p) continue;
        const friendSocketId = playerSocketMap.get(otherId);
        let activeRoomId = null;
        if (friendSocketId) {
          const rid = socketRoomMap.get(friendSocketId);
          if (rid) {
            const room = getRoom(rid);
            if (room && room.state === "playing") activeRoomId = rid;
          }
        }
        result.push({ friendshipId: row.id, friend: p, since: row.createdAt, activeRoomId });
      }
      res.json(result);
    } catch (e) {
      console.error("GET /api/friends/list error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/friends/requests/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const rows = await db.select().from(friendRequests).where(
        and2(
          or(eq2(friendRequests.senderId, playerId), eq2(friendRequests.receiverId, playerId)),
          eq2(friendRequests.status, "pending")
        )
      ).orderBy(desc(friendRequests.createdAt));
      const profileFields = {
        id: playerProfiles.id,
        playerTag: playerProfiles.playerTag,
        name: playerProfiles.name,
        skin: playerProfiles.equippedSkin,
        level: playerProfiles.level,
        wins: playerProfiles.wins
      };
      const result = [];
      for (const row of rows) {
        const otherId = row.senderId === playerId ? row.receiverId : row.senderId;
        const [p] = await db.select(profileFields).from(playerProfiles).where(eq2(playerProfiles.id, otherId));
        if (p) result.push({ requestId: row.id, isSender: row.senderId === playerId, player: p, createdAt: row.createdAt });
      }
      res.json(result);
    } catch (e) {
      console.error("GET /api/friends/requests error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/friends/request", async (req, res) => {
    try {
      const { senderId, receiverId } = req.body;
      if (!senderId || !receiverId) return res.status(400).json({ error: "missing_fields" });
      if (senderId === receiverId) return res.status(400).json({ error: "cannot_add_self" });
      const alreadyFriends = await db.select({ id: friends.id }).from(friends).where(
        or(
          and2(eq2(friends.playerId, senderId), eq2(friends.friendId, receiverId)),
          and2(eq2(friends.playerId, receiverId), eq2(friends.friendId, senderId))
        )
      ).limit(1);
      if (alreadyFriends.length > 0) return res.status(400).json({ error: "already_friends" });
      const existing = await db.select().from(friendRequests).where(
        and2(
          or(
            and2(eq2(friendRequests.senderId, senderId), eq2(friendRequests.receiverId, receiverId)),
            and2(eq2(friendRequests.senderId, receiverId), eq2(friendRequests.receiverId, senderId))
          ),
          eq2(friendRequests.status, "pending")
        )
      ).limit(1);
      if (existing.length > 0) return res.status(400).json({ error: "request_exists", status: existing[0].status });
      const [row] = await db.insert(friendRequests).values({ senderId, receiverId, status: "pending" }).returning();
      res.json({ success: true, requestId: row.id });
    } catch (e) {
      console.error("POST /api/friends/request error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/friends/accept", async (req, res) => {
    try {
      const { requestId, playerId } = req.body;
      if (!requestId || !playerId) return res.status(400).json({ error: "missing_fields" });
      const [req_] = await db.select().from(friendRequests).where(and2(eq2(friendRequests.id, requestId), eq2(friendRequests.receiverId, playerId), eq2(friendRequests.status, "pending")));
      if (!req_) return res.status(404).json({ error: "request_not_found" });
      await db.transaction(async (tx) => {
        await tx.update(friendRequests).set({ status: "accepted" }).where(eq2(friendRequests.id, requestId));
        await tx.insert(friends).values({ playerId: req_.senderId, friendId: req_.receiverId });
      });
      res.json({ success: true });
    } catch (e) {
      console.error("POST /api/friends/accept error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/friends/decline", async (req, res) => {
    try {
      const { requestId, playerId } = req.body;
      if (!requestId || !playerId) return res.status(400).json({ error: "missing_fields" });
      await db.update(friendRequests).set({ status: "declined" }).where(and2(eq2(friendRequests.id, requestId), eq2(friendRequests.receiverId, playerId)));
      res.json({ success: true });
    } catch (e) {
      console.error("POST /api/friends/decline error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.delete("/api/friends/:playerId/:friendId", async (req, res) => {
    try {
      const { playerId, friendId } = req.params;
      await db.delete(friends).where(
        or(
          and2(eq2(friends.playerId, playerId), eq2(friends.friendId, friendId)),
          and2(eq2(friends.playerId, friendId), eq2(friends.friendId, playerId))
        )
      );
      res.json({ success: true });
    } catch (e) {
      console.error("DELETE /api/friends error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  const LOGIN_STREAK_REWARDS = {
    1: 15,
    2: 20,
    3: 30,
    4: 25,
    5: 35,
    6: 50,
    7: 100,
    14: 150,
    21: 200,
    30: 500
  };
  function getLoginReward(day) {
    if (LOGIN_STREAK_REWARDS[day]) return LOGIN_STREAK_REWARDS[day];
    return 15;
  }
  app2.post("/api/player/:id/daily-login", async (req, res) => {
    try {
      const { id: playerId } = req.params;
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const yesterday = /* @__PURE__ */ new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      let [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, playerId));
      if (!profile) {
        const playerCode = await ensurePlayerCode(playerId);
        const randomName = generateRandomPlayerName();
        [profile] = await db.insert(playerProfiles).values({ id: playerId, playerCode, playerTag: await generateUniquePlayerTag(), name: randomName }).returning();
      }
      if (profile.lastLoginDate === today) {
        return res.json({
          success: false,
          error: "already_claimed",
          streak: profile.loginStreak,
          longestStreak: profile.longestLoginStreak,
          lastLoginDate: profile.lastLoginDate
        });
      }
      const continuesStreak = profile.lastLoginDate === yesterdayStr;
      const newStreak = continuesStreak ? (profile.loginStreak ?? 0) + 1 : 1;
      const longestStreak = Math.max(newStreak, profile.longestLoginStreak ?? 0);
      const reward = getLoginReward(newStreak);
      const updated = await db.update(playerProfiles).set({
        loginStreak: newStreak,
        lastLoginDate: today,
        longestLoginStreak: longestStreak,
        coins: sql3`coins + ${reward}`,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(
        and2(
          eq2(playerProfiles.id, playerId),
          sql3`${playerProfiles.lastLoginDate} IS DISTINCT FROM ${today}`
        )
      ).returning();
      if (!updated.length) {
        return res.json({ success: false, error: "already_claimed", streak: profile.loginStreak, longestStreak: profile.longestLoginStreak, lastLoginDate: profile.lastLoginDate });
      }
      syncAchievementProgress(playerId, updated[0]).catch(() => {
      });
      res.json({
        success: true,
        streak: newStreak,
        longestStreak,
        reward,
        lastLoginDate: today
      });
    } catch (e) {
      console.error("POST /api/player/daily-login error:", e);
      res.json({ success: false, error: "server_error" });
    }
  });
  const WEEKLY_TASK_POOL = [
    { key: "weekly_win_20", titleAr: "\u0627\u0631\u0628\u062D 20 \u0645\u0628\u0627\u0631\u0627\u0629 \u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639", descAr: "\u0641\u064F\u0632 \u0628\u0640 20 \u0645\u0628\u0627\u0631\u0627\u0629 \u062E\u0644\u0627\u0644 \u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639", icon: "\u{1F3C6}", target: 20, type: "wins", rewardCoins: 200, rewardXp: 150 },
    { key: "weekly_play_30", titleAr: "\u0627\u0644\u0639\u0628 30 \u0645\u0628\u0627\u0631\u0627\u0629 \u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639", descAr: "\u0634\u0627\u0631\u0643 \u0641\u064A 30 \u0645\u0628\u0627\u0631\u0627\u0629 \u062E\u0644\u0627\u0644 \u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639", icon: "\u{1F3AE}", target: 30, type: "games", rewardCoins: 150, rewardXp: 100 },
    { key: "weekly_score_1000", titleAr: "\u0627\u062C\u0645\u0639 1000 \u0646\u0642\u0637\u0629 \u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639", descAr: "\u062D\u0635\u0651\u0644 1000 \u0646\u0642\u0637\u0629 \u062E\u0644\u0627\u0644 \u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639", icon: "\u2B50", target: 1e3, type: "score", rewardCoins: 250, rewardXp: 200 },
    { key: "weekly_win_10", titleAr: "\u0627\u0631\u0628\u062D 10 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639", descAr: "\u0641\u064F\u0632 \u0628\u0640 10 \u0645\u0628\u0627\u0631\u064A\u0627\u062A \u062E\u0644\u0627\u0644 \u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639", icon: "\u{1F396}\uFE0F", target: 10, type: "wins", rewardCoins: 120, rewardXp: 80 }
  ];
  function getWeekId() {
    const now = /* @__PURE__ */ new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + mondayOffset);
    const jan1 = new Date(monday.getFullYear(), 0, 1);
    const days = Math.floor((monday.getTime() - jan1.getTime()) / 864e5);
    const weekNum = Math.ceil((days + 1) / 7);
    return `${monday.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  }
  function pickWeeklyTask() {
    const weekId = getWeekId();
    let hash = 0;
    for (let i = 0; i < weekId.length; i++) {
      hash = (hash << 5) - hash + weekId.charCodeAt(i);
      hash |= 0;
    }
    return WEEKLY_TASK_POOL[Math.abs(hash) % WEEKLY_TASK_POOL.length];
  }
  function getTodayDate() {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  async function syncTaskProgress(playerId, profile) {
    const today = getTodayDate();
    const rows = await db.select().from(playerDailyTasks).where(and2(eq2(playerDailyTasks.playerId, playerId), eq2(playerDailyTasks.assignedDate, today)));
    for (const row of rows) {
      if (row.claimed === 1) continue;
      const def = TASK_POOL.find((d) => d.key === row.taskKey);
      if (!def) continue;
      let newProgress = row.progress ?? 0;
      if (def.type === "wins") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.wins - (row.baselineWins ?? 0)), def.target));
      if (def.type === "games") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.gamesPlayed - (row.baselineGames ?? 0)), def.target));
      if (def.type === "score") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.totalScore - (row.baselineScore ?? 0)), def.target));
      if (newProgress !== (row.progress ?? 0)) {
        await db.update(playerDailyTasks).set({ progress: newProgress }).where(eq2(playerDailyTasks.id, row.id));
      }
    }
  }
  async function syncAchievementProgress(playerId, profile) {
    let tournamentsPlayed = null;
    for (const def of ACHIEVEMENT_DEFS) {
      let progress = 0;
      if (def.type === "wins") progress = Math.min(profile.wins, def.target);
      if (def.type === "games") progress = Math.min(profile.gamesPlayed, def.target);
      if (def.type === "level") progress = Math.min(profile.level, def.target);
      if (def.type === "streak") progress = Math.min(profile.bestStreak, def.target);
      if (def.type === "login_streak") progress = Math.min(profile.longestLoginStreak ?? 0, def.target);
      if (def.type === "total_score") progress = Math.min(profile.totalScore ?? 0, def.target);
      if (def.type === "tournaments") {
        if (tournamentsPlayed === null) {
          const result = await db.select({ count: sql3`count(*)` }).from(tournamentPlayers).where(eq2(tournamentPlayers.playerId, playerId));
          tournamentsPlayed = Number(result[0]?.count ?? 0);
        }
        progress = Math.min(tournamentsPlayed, def.target);
      }
      const unlocked = progress >= def.target;
      const [existing] = await db.select().from(playerAchievements).where(and2(eq2(playerAchievements.playerId, playerId), eq2(playerAchievements.achievementKey, def.key)));
      if (existing) {
        if (existing.progress !== progress || existing.unlocked !== (unlocked ? 1 : 0)) {
          await db.update(playerAchievements).set({
            progress,
            unlocked: unlocked ? 1 : 0,
            unlockedAt: unlocked && !existing.unlockedAt ? /* @__PURE__ */ new Date() : existing.unlockedAt
          }).where(eq2(playerAchievements.id, existing.id));
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
      let [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, playerId));
      if (!profile) {
        const playerCode = await ensurePlayerCode(playerId);
        const randomName = generateRandomPlayerName();
        [profile] = await db.insert(playerProfiles).values({ id: playerId, playerCode, playerTag: await generateUniquePlayerTag(), name: randomName }).returning();
      }
      let todayRows = await db.select().from(playerDailyTasks).where(and2(eq2(playerDailyTasks.playerId, playerId), eq2(playerDailyTasks.assignedDate, today)));
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
        todayRows = await db.select().from(playerDailyTasks).where(and2(eq2(playerDailyTasks.playerId, playerId), eq2(playerDailyTasks.assignedDate, today)));
      }
      const dailyResult = todayRows.map((row) => {
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
          claimed: row.claimed === 1,
          isWeekly: false
        };
      }).filter(Boolean);
      const weekId = getWeekId();
      const weeklyDef = pickWeeklyTask();
      const weeklyTaskKey = `${weeklyDef.key}_${weekId}`;
      let [weeklyRow] = await db.select().from(playerDailyTasks).where(and2(eq2(playerDailyTasks.playerId, playerId), eq2(playerDailyTasks.taskKey, weeklyTaskKey)));
      if (!weeklyRow) {
        [weeklyRow] = await db.insert(playerDailyTasks).values({
          playerId,
          taskKey: weeklyTaskKey,
          assignedDate: weekId,
          progress: 0,
          baselineWins: profile.wins,
          baselineGames: profile.gamesPlayed,
          baselineScore: profile.totalScore
        }).returning();
      }
      let weeklyProgress = weeklyRow.progress ?? 0;
      if (weeklyDef.type === "wins") weeklyProgress = Math.max(weeklyProgress, Math.min(Math.max(0, profile.wins - (weeklyRow.baselineWins ?? 0)), weeklyDef.target));
      if (weeklyDef.type === "games") weeklyProgress = Math.max(weeklyProgress, Math.min(Math.max(0, profile.gamesPlayed - (weeklyRow.baselineGames ?? 0)), weeklyDef.target));
      if (weeklyDef.type === "score") weeklyProgress = Math.max(weeklyProgress, Math.min(Math.max(0, profile.totalScore - (weeklyRow.baselineScore ?? 0)), weeklyDef.target));
      const weeklyResult = {
        ...weeklyDef,
        key: weeklyTaskKey,
        rowId: weeklyRow.id,
        progress: weeklyProgress,
        completed: weeklyProgress >= weeklyDef.target,
        claimed: weeklyRow.claimed === 1,
        isWeekly: true
      };
      res.json([weeklyResult, ...dailyResult]);
    } catch (e) {
      console.error("GET /api/tasks error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/tasks/:playerId/:taskKey/claim", async (req, res) => {
    try {
      const { playerId, taskKey } = req.params;
      const today = getTodayDate();
      const isWeekly = taskKey.startsWith("weekly_");
      let def;
      if (isWeekly) {
        const baseKey = taskKey.replace(/_\d{4}-W\d{2}$/, "");
        def = WEEKLY_TASK_POOL.find((d) => d.key === baseKey);
      } else {
        def = DAILY_TASK_DEFS.find((d) => d.key === taskKey);
      }
      if (!def) return res.json({ success: false, error: "unknown_task" });
      const [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, playerId));
      if (!profile) return res.json({ success: false, error: "player_not_found" });
      const assignedDate = isWeekly ? getWeekId() : today;
      let [row] = await db.select().from(playerDailyTasks).where(and2(
        eq2(playerDailyTasks.playerId, playerId),
        eq2(playerDailyTasks.taskKey, taskKey),
        eq2(playerDailyTasks.assignedDate, assignedDate)
      ));
      if (!row) {
        const [inserted] = await db.insert(playerDailyTasks).values({
          playerId,
          taskKey,
          assignedDate,
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
      await db.update(playerDailyTasks).set({ claimed: 1, claimedAt: /* @__PURE__ */ new Date(), progress }).where(eq2(playerDailyTasks.id, row.id));
      await db.update(playerProfiles).set({
        coins: sql3`coins + ${def.rewardCoins}`,
        xp: sql3`xp + ${def.rewardXp}`,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(playerProfiles.id, playerId));
      let titleAwarded = null;
      if (isWeekly) {
        const WEEKLY_TITLE_POOL = ["word_master", "lightning", "streak_lord"];
        const weekId = getWeekId();
        let titleHash = 0;
        for (let i = 0; i < weekId.length; i++) {
          titleHash = (titleHash << 5) - titleHash + weekId.charCodeAt(i);
          titleHash |= 0;
        }
        titleAwarded = WEEKLY_TITLE_POOL[Math.abs(titleHash) % WEEKLY_TITLE_POOL.length];
        const freshProfile = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, playerId));
        if (freshProfile.length > 0) {
          const currentTitles = Array.isArray(freshProfile[0].ownedTitles) ? freshProfile[0].ownedTitles : [];
          if (!currentTitles.includes(titleAwarded)) {
            await db.update(playerProfiles).set({
              ownedTitles: [...currentTitles, titleAwarded],
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq2(playerProfiles.id, playerId));
          }
        }
      }
      awardBattlePassXp(playerId, BP_XP_GAME).catch((e) => console.error("[battle-pass] daily task xp error:", e));
      res.json({ success: true, coinsEarned: def.rewardCoins, xpEarned: def.rewardXp, titleAwarded });
    } catch (e) {
      console.error("POST /api/tasks/claim error:", e);
      res.json({ success: false, error: "server_error" });
    }
  });
  app2.get("/api/achievements/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      let [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, playerId));
      if (!profile) {
        const playerCode = await ensurePlayerCode(playerId);
        const randomName = generateRandomPlayerName();
        [profile] = await db.insert(playerProfiles).values({ id: playerId, playerCode, playerTag: await generateUniquePlayerTag(), name: randomName }).returning();
      }
      const rows = await db.select().from(playerAchievements).where(eq2(playerAchievements.playerId, playerId));
      const tournamentCount = await db.select({ count: sql3`count(*)` }).from(tournamentPlayers).where(eq2(tournamentPlayers.playerId, playerId));
      const tournamentsPlayed = Number(tournamentCount[0]?.count ?? 0);
      const result = ACHIEVEMENT_DEFS.map((def) => {
        const row = rows.find((r) => r.achievementKey === def.key);
        let progress = 0;
        if (def.type === "wins") progress = Math.min(profile.wins, def.target);
        if (def.type === "games") progress = Math.min(profile.gamesPlayed, def.target);
        if (def.type === "level") progress = Math.min(profile.level, def.target);
        if (def.type === "streak") progress = Math.min(profile.bestStreak, def.target);
        if (def.type === "login_streak") progress = Math.min(profile.longestLoginStreak ?? 0, def.target);
        if (def.type === "total_score") progress = Math.min(profile.totalScore, def.target);
        if (def.type === "tournaments") progress = Math.min(tournamentsPlayed, def.target);
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
    const [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, playerId));
    if (!profile) return { success: false, error: "player_not_found" };
    const [existing] = await db.select().from(playerAchievements).where(and2(eq2(playerAchievements.playerId, playerId), eq2(playerAchievements.achievementKey, key)));
    if (existing?.claimed === 1) return { success: false, error: "already_claimed" };
    let liveProgress = 0;
    if (def.type === "wins") liveProgress = profile.wins;
    if (def.type === "games") liveProgress = profile.gamesPlayed;
    if (def.type === "level") liveProgress = profile.level;
    if (def.type === "streak") liveProgress = profile.bestStreak;
    if (def.type === "login_streak") liveProgress = profile.longestLoginStreak ?? 0;
    if (def.type === "total_score") liveProgress = profile.totalScore;
    if (def.type === "tournaments") {
      const tc = await db.select({ count: sql3`count(*)` }).from(tournamentPlayers).where(eq2(tournamentPlayers.playerId, playerId));
      liveProgress = Number(tc[0]?.count ?? 0);
    }
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
      }).where(eq2(playerAchievements.id, existing.id));
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
      coins: sql3`coins + ${def.rewardCoins}`,
      xp: sql3`xp + ${def.rewardXp}`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(playerProfiles.id, playerId));
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
      const [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, playerId));
      if (!profile) return res.status(404).json({ error: "player_not_found" });
      const todayRows = await db.select().from(playerDailyTasks).where(and2(eq2(playerDailyTasks.playerId, playerId), eq2(playerDailyTasks.assignedDate, today)));
      const updated = [];
      for (const row of todayRows) {
        const def = TASK_POOL.find((d) => d.key === row.taskKey && d.type === taskType);
        if (!def || row.claimed === 1) continue;
        let newProgress = row.progress ?? 0;
        if (def.type === "wins") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.wins - (row.baselineWins ?? 0)), def.target));
        if (def.type === "games") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.gamesPlayed - (row.baselineGames ?? 0)), def.target));
        if (def.type === "score") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.totalScore - (row.baselineScore ?? 0)), def.target));
        if (def.type === "emojis") newProgress = Math.min(newProgress + increment, def.target);
        await db.update(playerDailyTasks).set({ progress: newProgress }).where(eq2(playerDailyTasks.id, row.id));
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
      const [profile] = await db.select().from(playerProfiles).where(eq2(playerProfiles.id, playerId));
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
        const [existing] = await db.select().from(playerAchievements).where(and2(eq2(playerAchievements.playerId, playerId), eq2(playerAchievements.achievementKey, def.key)));
        if (existing) {
          if (existing.progress !== progress || existing.unlocked !== (unlocked ? 1 : 0)) {
            await db.update(playerAchievements).set({
              progress,
              unlocked: unlocked ? 1 : 0,
              unlockedAt: unlocked && !existing.unlockedAt ? /* @__PURE__ */ new Date() : existing.unlockedAt
            }).where(eq2(playerAchievements.id, existing.id));
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
      await db.update(roomInvites).set({ status: "cancelled" }).where(and2(eq2(roomInvites.fromPlayerId, fromPlayerId), eq2(roomInvites.toPlayerId, toPlayerId), eq2(roomInvites.status, "pending")));
      const [invite] = await db.insert(roomInvites).values({ fromPlayerId, toPlayerId, roomId, fromPlayerName, status: "pending" }).returning();
      sendPushNotification(
        toPlayerId,
        `\u0635\u062F\u064A\u0642\u0643 ${fromPlayerName} \u064A\u062A\u062D\u062F\u0627\u0643! \u{1F3AE}`,
        "\u062F\u0639\u0648\u0629 \u0644\u0644\u0639\u0628!",
        { type: "room_invite", roomId }
      ).catch(() => {
      });
      res.json({ success: true, inviteId: invite.id });
    } catch (e) {
      console.error("POST /api/room-invites error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/room-invites/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const pending = await db.select().from(roomInvites).where(and2(eq2(roomInvites.toPlayerId, playerId), eq2(roomInvites.status, "pending"))).orderBy(desc(roomInvites.createdAt)).limit(5);
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
      const [invite] = await db.update(roomInvites).set({ status }).where(eq2(roomInvites.id, inviteId)).returning();
      if (!invite) return res.status(404).json({ error: "not_found" });
      res.json({ success: true, roomId: invite.roomId, action });
    } catch (e) {
      console.error("PUT /api/room-invites respond error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/friends/gift", async (req, res) => {
    try {
      const { fromPlayerId, toPlayerId, amount } = req.body;
      if (!fromPlayerId || !toPlayerId || !amount) return res.status(400).json({ error: "missing_fields" });
      const validAmounts = [50, 100, 200];
      if (!validAmounts.includes(amount)) return res.status(400).json({ error: "invalid_amount" });
      const friendship = await db.select({ id: friends.id }).from(friends).where(
        or(
          and2(eq2(friends.playerId, fromPlayerId), eq2(friends.friendId, toPlayerId)),
          and2(eq2(friends.playerId, toPlayerId), eq2(friends.friendId, fromPlayerId))
        )
      ).limit(1);
      if (friendship.length === 0) return res.json({ error: "not_friends" });
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const recentGifts = await db.select().from(coinGifts).where(
        and2(
          eq2(coinGifts.fromPlayerId, fromPlayerId),
          eq2(coinGifts.toPlayerId, toPlayerId),
          sql3`DATE(${coinGifts.sentAt}) = ${today}`
        )
      );
      if (recentGifts.length > 0) return res.json({ error: "already_gifted_today" });
      const [sender] = await db.select({ coins: playerProfiles.coins }).from(playerProfiles).where(eq2(playerProfiles.id, fromPlayerId));
      if (!sender || sender.coins < amount) return res.json({ error: "insufficient_coins" });
      await db.transaction(async (tx) => {
        await tx.update(playerProfiles).set({ coins: sql3`coins - ${amount}` }).where(eq2(playerProfiles.id, fromPlayerId));
        await tx.update(playerProfiles).set({ coins: sql3`coins + ${amount}` }).where(eq2(playerProfiles.id, toPlayerId));
        await tx.insert(coinGifts).values({ fromPlayerId, toPlayerId, amount });
      });
      const [senderProfile] = await db.select({ name: playerProfiles.name }).from(playerProfiles).where(eq2(playerProfiles.id, fromPlayerId));
      sendPushNotification(
        toPlayerId,
        `${senderProfile?.name || "\u0644\u0627\u0639\u0628"} \u0623\u0631\u0633\u0644 \u0644\u0643 ${amount} \u0639\u0645\u0644\u0629 \u{1F381}`,
        "\u0647\u062F\u064A\u0629!",
        { type: "gift", amount }
      ).catch(() => {
      });
      res.json({ success: true });
    } catch (e) {
      console.error("POST /api/friends/gift error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/friends/gifts/pending/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const pending = await db.select().from(coinGifts).where(
        and2(eq2(coinGifts.toPlayerId, playerId), eq2(coinGifts.seen, false))
      ).orderBy(desc(coinGifts.sentAt));
      const enriched = [];
      for (const g of pending) {
        const [sender] = await db.select({ name: playerProfiles.name }).from(playerProfiles).where(eq2(playerProfiles.id, g.fromPlayerId));
        enriched.push({ ...g, fromPlayerName: sender?.name || "\u0644\u0627\u0639\u0628" });
      }
      res.json(enriched);
    } catch (e) {
      console.error("GET /api/friends/gifts/pending error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.put("/api/friends/gifts/seen/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      await db.update(coinGifts).set({ seen: true }).where(and2(eq2(coinGifts.toPlayerId, playerId), eq2(coinGifts.seen, false)));
      res.json({ success: true });
    } catch (e) {
      console.error("PUT /api/friends/gifts/seen error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/friends/gifts/history/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const sent = await db.select().from(coinGifts).where(eq2(coinGifts.fromPlayerId, playerId)).orderBy(desc(coinGifts.sentAt)).limit(20);
      const received = await db.select().from(coinGifts).where(eq2(coinGifts.toPlayerId, playerId)).orderBy(desc(coinGifts.sentAt)).limit(20);
      const enrichSent = [];
      for (const g of sent) {
        const [recipient] = await db.select({ name: playerProfiles.name }).from(playerProfiles).where(eq2(playerProfiles.id, g.toPlayerId));
        enrichSent.push({ ...g, playerName: recipient?.name || "\u0644\u0627\u0639\u0628", type: "sent" });
      }
      const enrichReceived = [];
      for (const g of received) {
        const [sender] = await db.select({ name: playerProfiles.name }).from(playerProfiles).where(eq2(playerProfiles.id, g.fromPlayerId));
        enrichReceived.push({ ...g, playerName: sender?.name || "\u0644\u0627\u0639\u0628", type: "received" });
      }
      const all = [...enrichSent, ...enrichReceived].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()).slice(0, 30);
      res.json(all);
    } catch (e) {
      console.error("GET /api/friends/gifts/history error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/referral/:playerId", async (req, res) => {
    try {
      const code = await ensureReferralCode(req.params.playerId);
      const [profile] = await db.select({ referralCount: playerProfiles.referralCount, referredBy: playerProfiles.referredBy, createdAt: playerProfiles.createdAt }).from(playerProfiles).where(eq2(playerProfiles.id, req.params.playerId));
      const accountAgeHours = profile ? (Date.now() - new Date(profile.createdAt).getTime()) / (1e3 * 60 * 60) : 9999;
      const referralEligible = !profile?.referredBy && accountAgeHours <= 24;
      res.json({ referralCode: code, referralCount: profile?.referralCount || 0, referredBy: profile?.referredBy || null, referralEligible });
    } catch (e) {
      console.error("GET /api/referral error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/referral/claim", async (req, res) => {
    try {
      const { playerId, referralCode } = req.body;
      if (!playerId || !referralCode) return res.status(400).json({ error: "missing_fields" });
      const [player] = await db.select({ referredBy: playerProfiles.referredBy, createdAt: playerProfiles.createdAt }).from(playerProfiles).where(eq2(playerProfiles.id, playerId));
      if (!player) return res.status(404).json({ error: "not_found" });
      if (player.referredBy) return res.json({ error: "already_claimed" });
      const accountAgeHours = (Date.now() - new Date(player.createdAt).getTime()) / (1e3 * 60 * 60);
      if (accountAgeHours > 24) return res.json({ error: "expired" });
      const [referrer] = await db.select({ id: playerProfiles.id, referralCode: playerProfiles.referralCode }).from(playerProfiles).where(eq2(playerProfiles.referralCode, referralCode.toUpperCase()));
      if (!referrer) return res.json({ error: "invalid_code" });
      if (referrer.id === playerId) return res.json({ error: "self_referral" });
      const REFERRAL_REWARD = 100;
      await db.transaction(async (tx) => {
        const result = await tx.update(playerProfiles).set({ referredBy: referralCode.toUpperCase() }).where(and2(eq2(playerProfiles.id, playerId), sql3`referred_by IS NULL`));
        await tx.update(playerProfiles).set({
          referralCount: sql3`referral_count + 1`,
          coins: sql3`coins + ${REFERRAL_REWARD}`
        }).where(eq2(playerProfiles.id, referrer.id));
        await tx.update(playerProfiles).set({ coins: sql3`coins + ${REFERRAL_REWARD}` }).where(eq2(playerProfiles.id, playerId));
      });
      res.json({ success: true, reward: REFERRAL_REWARD });
    } catch (e) {
      console.error("POST /api/referral/claim error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  async function cleanupAbandonedTournaments() {
    try {
      const openTournaments = await db.select().from(tournaments).where(eq2(tournaments.status, "open"));
      const now = Date.now();
      for (const t of openTournaments) {
        const players = await db.select().from(tournamentPlayers).where(eq2(tournamentPlayers.tournamentId, t.id));
        const ageMs = now - new Date(t.createdAt).getTime();
        const shouldDelete = players.length === 0 && ageMs >= 2e4 || players.length < 2 && ageMs >= 6e4;
        if (shouldDelete) {
          await db.delete(tournamentMatches).where(eq2(tournamentMatches.tournamentId, t.id)).catch(() => {
          });
          await db.delete(tournamentPlayers).where(eq2(tournamentPlayers.tournamentId, t.id)).catch(() => {
          });
          await db.delete(tournaments).where(eq2(tournaments.id, t.id)).catch(() => {
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
  app2.post("/api/player/:id/push-token", async (req, res) => {
    try {
      const { id } = req.params;
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "missing_token" });
      await db.update(playerProfiles).set({ expoPushToken: token, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, id));
      res.json({ success: true });
    } catch (e) {
      console.error("POST /api/player/:id/push-token error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.put("/api/player/:id/notifications", async (req, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") return res.status(400).json({ error: "invalid_value" });
      await db.update(playerProfiles).set({ notificationsEnabled: enabled, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(playerProfiles.id, id));
      res.json({ success: true, enabled });
    } catch (e) {
      console.error("PUT /api/player/:id/notifications error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/player/:id/notifications", async (req, res) => {
    try {
      const { id } = req.params;
      const [profile] = await db.select({
        notificationsEnabled: playerProfiles.notificationsEnabled,
        expoPushToken: playerProfiles.expoPushToken
      }).from(playerProfiles).where(eq2(playerProfiles.id, id));
      if (!profile) return res.status(404).json({ error: "not_found" });
      res.json({
        enabled: profile.notificationsEnabled,
        tokenRegistered: !!profile.expoPushToken
      });
    } catch (e) {
      console.error("GET /api/player/:id/notifications error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  cron.schedule("0 9 * * *", () => {
    console.log("[cron] Running daily task reminders (9:00 AM)");
    sendDailyTaskReminders().catch(console.error);
  });
  cron.schedule("0 20 * * *", () => {
    console.log("[cron] Running streak reset warnings (8:00 PM)");
    sendStreakResetWarnings().catch(console.error);
  });
  cron.schedule("0 12 * * *", () => {
    console.log("[cron] Running season ending notifications (12:00 PM)");
    sendSeasonEndingNotifications().catch(console.error);
  });
  cron.schedule("0 0 * * *", () => {
    console.log("[cron] Checking season end (midnight)");
    handleSeasonEnd().catch(console.error);
  });
  cron.schedule("5 0 * * 1", () => {
    console.log("[cron] Clan war weekly payout (Monday 00:05)");
    handleClanWarWeeklyEnd().catch(console.error);
  });
  cron.schedule("55 23 * * *", async () => {
    try {
      const tomorrow = /* @__PURE__ */ new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().slice(0, 10);
      const existing = await db.select({ id: dailyChallenges.id }).from(dailyChallenges).where(eq2(dailyChallenges.date, dateStr)).limit(1);
      if (existing.length > 0) return;
      const letter = ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)];
      const allCategories = ["animals", "fruits", "vegetables", "cities", "countries", "objects", "boy_names", "girl_names"];
      const candidateWords = [];
      for (const cat of allCategories) {
        const ws = getWordsForLetter(cat, letter);
        candidateWords.push(...ws);
      }
      const filtered = candidateWords.filter((w) => w.length >= 3 && w.length <= 7);
      const pool2 = filtered.length > 0 ? filtered : candidateWords;
      if (pool2.length === 0) return;
      const word = pool2[Math.floor(Math.random() * pool2.length)];
      await db.insert(dailyChallenges).values({ date: dateStr, word, letter }).onConflictDoNothing();
      console.log(`[cron] Daily challenge pre-seeded for ${dateStr}: ${word} (${letter})`);
    } catch (e) {
      console.error("[cron] daily challenge pre-seed error:", e);
    }
  });
  setInterval(() => {
    const cutoff = Date.now() - 1e4;
    for (const [key, ts] of reactionLastSentMap.entries()) {
      if (ts < cutoff) reactionLastSentMap.delete(key);
    }
  }, 6e4);
  console.log("[cron] Push notification cron jobs scheduled");
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
    wordCategory: room.wordCategory || "general",
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
