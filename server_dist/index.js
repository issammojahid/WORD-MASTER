var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";

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

// constants/i18n.ts
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
var WORD_CATEGORIES = [
  { id: "general", emoji: "\u{1F524}", labelAr: "\u0639\u0627\u0645", labelEn: "General", gameCategories: [...GAME_CATEGORIES] },
  { id: "animals", emoji: "\u{1F981}", labelAr: "\u062D\u064A\u0648\u0627\u0646\u0627\u062A", labelEn: "Animals", gameCategories: ["animal"] },
  { id: "countries", emoji: "\u{1F30D}", labelAr: "\u062F\u0648\u0644", labelEn: "Countries", gameCategories: ["country", "city"] },
  { id: "food", emoji: "\u{1F355}", labelAr: "\u0637\u0639\u0627\u0645", labelEn: "Food", gameCategories: ["fruit", "vegetable"] },
  { id: "names", emoji: "\u{1F464}", labelAr: "\u0623\u0633\u0645\u0627\u0621", labelEn: "Names", gameCategories: ["boyName", "girlName"] },
  { id: "objects", emoji: "\u{1F4E6}", labelAr: "\u062C\u0645\u0627\u062F\u0627\u062A", labelEn: "Objects", gameCategories: ["object"] },
  { id: "cities", emoji: "\u{1F3D9}\uFE0F", labelAr: "\u0645\u062F\u0646", labelEn: "Cities", gameCategories: ["city"] }
];

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
  insertUserSchema: () => insertUserSchema,
  onlineDailyMatchCounters: () => onlineDailyMatchCounters,
  onlineGuestSessions: () => onlineGuestSessions,
  onlineGuestWallets: () => onlineGuestWallets,
  onlineMatchFlags: () => onlineMatchFlags,
  onlineMatchParticipants: () => onlineMatchParticipants,
  onlineMatches: () => onlineMatches,
  onlineRewardClaims: () => onlineRewardClaims,
  playerAchievements: () => playerAchievements,
  playerBattlePass: () => playerBattlePass,
  playerDailyTasks: () => playerDailyTasks,
  playerProfiles: () => playerProfiles,
  roomInvites: () => roomInvites,
  seasons: () => seasons,
  socialBlocks: () => socialBlocks,
  socialConversations: () => socialConversations,
  socialFriendRequests: () => socialFriendRequests,
  socialFriendships: () => socialFriendships,
  socialGameInvites: () => socialGameInvites,
  socialMessages: () => socialMessages,
  socialNotifications: () => socialNotifications,
  socialProfiles: () => socialProfiles,
  spectatorBets: () => spectatorBets,
  tournamentMatches: () => tournamentMatches,
  tournamentPlayers: () => tournamentPlayers,
  tournaments: () => tournaments,
  users: () => users,
  winStreaks: () => winStreaks
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, uniqueIndex, index, check } from "drizzle-orm/pg-core";
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
  ownedCosmetics: jsonb("owned_cosmetics").$type().notNull().default(sql`'{"frame":["basic_frame"],"background":["basic_background"],"nameplate":["basic_nameplate"],"victory":["no_victory_effect"],"seasonal":["no_seasonal"]}'::jsonb`),
  equippedCosmetics: jsonb("equipped_cosmetics").$type().notNull().default(sql`'{"frame":"basic_frame","background":"basic_background","nameplate":"basic_nameplate","victory":"no_victory_effect","seasonal":"no_seasonal"}'::jsonb`),
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
var onlineGuestSessions = pgTable("online_guest_sessions", {
  id: varchar("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  expiresAt: timestamp("expires_at").notNull()
}, (t) => ({
  uniqueTokenHash: uniqueIndex("online_guest_sessions_token_hash_unique").on(t.tokenHash)
}));
var onlineGuestWallets = pgTable("online_guest_wallets", {
  playerId: varchar("player_id").primaryKey(),
  coins: integer("coins").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});
var onlineMatches = pgTable("online_matches", {
  id: varchar("id").primaryKey(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  results: jsonb("results"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at")
});
var onlineMatchParticipants = pgTable("online_match_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull(),
  playerId: varchar("player_id").notNull(),
  displayName: text("display_name").notNull(),
  score: integer("score").notNull().default(0),
  active: boolean("active").notNull().default(false),
  abandoned: boolean("abandoned").notNull().default(false),
  finalRank: integer("final_rank"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
}, (t) => ({
  uniqMatchPlayer: uniqueIndex("online_match_participants_match_player_unique").on(t.matchId, t.playerId),
  oneActiveMatchPerPlayer: uniqueIndex("online_one_active_match_per_player").on(t.playerId).where(sql`${t.active} = true`),
  playerMatches: index("online_match_participants_player_idx").on(t.playerId, t.createdAt)
}));
var onlineRewardClaims = pgTable("online_reward_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull(),
  playerId: varchar("player_id").notNull(),
  rewardType: text("reward_type").notNull(),
  amount: integer("amount").notNull().default(0),
  rewardDate: text("reward_date").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
}, (t) => ({
  uniqMatchPlayerReward: uniqueIndex("online_reward_claims_match_player_type_unique").on(t.matchId, t.playerId, t.rewardType)
}));
var onlineDailyMatchCounters = pgTable("online_daily_match_counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  rewardDate: text("reward_date").notNull(),
  completedMatches: integer("completed_matches").notNull().default(0)
}, (t) => ({
  uniqPlayerDate: uniqueIndex("online_daily_match_counters_player_date_unique").on(t.playerId, t.rewardDate)
}));
var onlineMatchFlags = pgTable("online_match_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull(),
  playerId: varchar("player_id").notNull(),
  reason: text("reason").notNull(),
  details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
  reviewed: boolean("reviewed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});
var socialProfiles = pgTable("social_profiles", {
  playerId: varchar("player_id").primaryKey().references(() => onlineGuestSessions.id),
  displayName: text("display_name").notNull().default("\u0644\u0627\u0639\u0628"),
  allowFriendRequests: boolean("allow_friend_requests").notNull().default(true),
  allowGameInvites: boolean("allow_game_invites").notNull().default(true),
  showPresence: boolean("show_presence").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
}, (t) => ({
  displayNameLength: check("social_profiles_display_name_length", sql`char_length(${t.displayName}) BETWEEN 1 AND 24`)
}));
var socialFriendRequests = pgTable("social_friend_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => onlineGuestSessions.id),
  receiverId: varchar("receiver_id").notNull().references(() => onlineGuestSessions.id),
  pairLow: varchar("pair_low").notNull().references(() => onlineGuestSessions.id),
  pairHigh: varchar("pair_high").notNull().references(() => onlineGuestSessions.id),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
}, (t) => ({
  pendingPair: uniqueIndex("social_friend_requests_pending_pair_unique").on(t.pairLow, t.pairHigh).where(sql`${t.status} = 'pending'`),
  receiverStatus: index("social_friend_requests_receiver_status_idx").on(t.receiverId, t.status, t.createdAt),
  senderStatus: index("social_friend_requests_sender_status_idx").on(t.senderId, t.status, t.createdAt),
  pairOrder: check("social_friend_requests_pair_order", sql`
    ${t.pairLow} < ${t.pairHigh}
    AND ${t.pairLow} = LEAST(${t.senderId}, ${t.receiverId})
    AND ${t.pairHigh} = GREATEST(${t.senderId}, ${t.receiverId})
  `),
  notSelf: check("social_friend_requests_not_self", sql`${t.senderId} <> ${t.receiverId}`),
  statusValues: check("social_friend_requests_status_values", sql`${t.status} IN ('pending', 'accepted', 'declined', 'cancelled')`)
}));
var socialFriendships = pgTable("social_friendships", {
  playerLow: varchar("player_low").notNull().references(() => onlineGuestSessions.id),
  playerHigh: varchar("player_high").notNull().references(() => onlineGuestSessions.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
}, (t) => ({
  pair: uniqueIndex("social_friendships_pair_unique").on(t.playerLow, t.playerHigh),
  lowPlayer: index("social_friendships_low_player_idx").on(t.playerLow, t.createdAt),
  highPlayer: index("social_friendships_high_player_idx").on(t.playerHigh, t.createdAt),
  pairOrder: check("social_friendships_pair_order", sql`${t.playerLow} < ${t.playerHigh}`)
}));
var socialBlocks = pgTable("social_blocks", {
  blockerId: varchar("blocker_id").notNull().references(() => onlineGuestSessions.id),
  blockedId: varchar("blocked_id").notNull().references(() => onlineGuestSessions.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
}, (t) => ({
  pair: uniqueIndex("social_blocks_pair_unique").on(t.blockerId, t.blockedId),
  blockedPlayer: index("social_blocks_blocked_player_idx").on(t.blockedId),
  notSelf: check("social_blocks_not_self", sql`${t.blockerId} <> ${t.blockedId}`)
}));
var socialConversations = pgTable("social_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerLow: varchar("player_low").notNull().references(() => onlineGuestSessions.id),
  playerHigh: varchar("player_high").notNull().references(() => onlineGuestSessions.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
}, (t) => ({
  pair: uniqueIndex("social_conversations_pair_unique").on(t.playerLow, t.playerHigh),
  lowActivity: index("social_conversations_low_activity_idx").on(t.playerLow, t.updatedAt),
  highActivity: index("social_conversations_high_activity_idx").on(t.playerHigh, t.updatedAt),
  pairOrder: check("social_conversations_pair_order", sql`${t.playerLow} < ${t.playerHigh}`)
}));
var socialMessages = pgTable("social_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => socialConversations.id),
  senderId: varchar("sender_id").notNull().references(() => onlineGuestSessions.id),
  idempotencyKey: varchar("idempotency_key").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  readAt: timestamp("read_at")
}, (t) => ({
  idempotency: uniqueIndex("social_messages_sender_idempotency_unique").on(t.senderId, t.idempotencyKey),
  conversationHistory: index("social_messages_conversation_history_idx").on(t.conversationId, t.createdAt, t.id),
  unread: index("social_messages_unread_idx").on(t.conversationId, t.senderId, t.readAt),
  contentLength: check("social_messages_content_length", sql`char_length(${t.content}) BETWEEN 1 AND 1000`),
  idempotencyLength: check("social_messages_idempotency_length", sql`char_length(${t.idempotencyKey}) BETWEEN 8 AND 128`)
}));
var socialGameInvites = pgTable("social_game_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => onlineGuestSessions.id),
  receiverId: varchar("receiver_id").notNull().references(() => onlineGuestSessions.id),
  pairLow: varchar("pair_low").notNull().references(() => onlineGuestSessions.id),
  pairHigh: varchar("pair_high").notNull().references(() => onlineGuestSessions.id),
  roomCode: varchar("room_code").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
}, (t) => ({
  pendingPair: uniqueIndex("social_game_invites_pending_pair_unique").on(t.pairLow, t.pairHigh, t.roomCode).where(sql`${t.status} = 'pending'`),
  receiverStatus: index("social_game_invites_receiver_status_idx").on(t.receiverId, t.status, t.expiresAt),
  pairOrder: check("social_game_invites_pair_order", sql`
    ${t.pairLow} < ${t.pairHigh}
    AND ${t.pairLow} = LEAST(${t.senderId}, ${t.receiverId})
    AND ${t.pairHigh} = GREATEST(${t.senderId}, ${t.receiverId})
  `),
  notSelf: check("social_game_invites_not_self", sql`${t.senderId} <> ${t.receiverId}`),
  statusValues: check("social_game_invites_status_values", sql`${t.status} IN ('pending', 'accepted', 'declined', 'expired')`)
}));
var socialNotifications = pgTable("social_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull().references(() => onlineGuestSessions.id),
  type: text("type").notNull(),
  actorId: varchar("actor_id").references(() => onlineGuestSessions.id),
  entityId: varchar("entity_id"),
  payload: jsonb("payload").$type().notNull().default(sql`'{}'::jsonb`),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
}, (t) => ({
  playerFeed: index("social_notifications_player_feed_idx").on(t.playerId, t.createdAt, t.id),
  unread: index("social_notifications_unread_idx").on(t.playerId, t.readAt),
  typeValues: check("social_notifications_type_values", sql`${t.type} IN ('friend_request', 'friend_accepted', 'message', 'game_invite', 'invite_response')`)
}));

// server/db.ts
var databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required by the Node.js backend. See .env.example.");
}
var isSupabaseDatabase = false;
try {
  const parsedUrl = new URL(databaseUrl);
  if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the postgres:// or postgresql:// scheme.");
  }
  isSupabaseDatabase = parsedUrl.hostname.endsWith(".supabase.co") || parsedUrl.hostname.endsWith(".pooler.supabase.com");
} catch {
  throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
}
var connectionUrl = new URL(databaseUrl);
if (isSupabaseDatabase) {
  connectionUrl.searchParams.set("sslmode", "verify-full");
  if (!connectionUrl.searchParams.has("sslrootcert")) {
    connectionUrl.searchParams.set("sslrootcert", "server/certs/supabase-ca.crt");
  }
  connectionUrl.searchParams.delete("ssl");
  connectionUrl.searchParams.delete("uselibpqcompat");
}
var pool = new pg.Pool({
  connectionString: connectionUrl.toString(),
  ...isSupabaseDatabase ? { ssl: { rejectUnauthorized: true } } : {},
  max: 10,
  connectionTimeoutMillis: 1e4,
  idleTimeoutMillis: 3e4,
  keepAlive: true
});
pool.on("error", (error) => {
  const code = "code" in error ? String(error.code) : "unknown";
  console.error(`[db] idle connection error (${code})`);
});
var db = drizzle(pool, { schema: schema_exports });

// server/routes.ts
import { eq as eq4, and as and4, desc as desc3, asc, ilike as ilike2, sql as sql5 } from "drizzle-orm";
import cron from "node-cron";

// server/notifications.ts
import { eq, and, isNotNull, sql as sql2 } from "drizzle-orm";
var EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
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

// server/online-multiplayer.ts
import { createHash as createHash2, randomBytes as randomBytes2, randomUUID } from "node:crypto";
import { clearInterval as clearNodeInterval2, setInterval as setNodeInterval2 } from "node:timers";
import {
  and as and3,
  desc as desc2,
  eq as eq3,
  gte as gte2,
  inArray as inArray2,
  sql as sql4
} from "drizzle-orm";
import { z as z2 } from "zod";
import { Server as SocketServer } from "socket.io";

// server/online-game-logic.ts
import { randomBytes } from "node:crypto";
var OnlineMatchQueue = class {
  entries = /* @__PURE__ */ new Map();
  enqueue(playerId, entry) {
    if (this.entries.has(playerId)) return { status: "duplicate" };
    for (const [opponentId, opponent] of this.entries) {
      if (opponentId === playerId) continue;
      this.entries.delete(opponentId);
      return { status: "paired", opponentId, opponent };
    }
    this.entries.set(playerId, entry);
    return { status: "queued" };
  }
  cancel(playerId) {
    const entry = this.entries.get(playerId);
    this.entries.delete(playerId);
    return entry;
  }
  has(playerId) {
    return this.entries.has(playerId);
  }
  entriesList() {
    return [...this.entries.entries()];
  }
};
function normalizeAnswer(answer) {
  return answer.trim().replace(/\s+/g, " ").replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "\u0627").replace(/ؤ/g, "\u0648").replace(/ئ/g, "\u064A").replace(/ى/g, "\u064A").replace(/ة/g, "\u0647").toLocaleLowerCase();
}
function scoreOnlineRound(players, letter) {
  const validation = /* @__PURE__ */ new Map();
  const duplicateCounts = /* @__PURE__ */ new Map();
  for (const category of GAME_CATEGORIES) duplicateCounts.set(category, /* @__PURE__ */ new Map());
  for (const player of players) {
    const playerValidity = /* @__PURE__ */ new Map();
    for (const category of GAME_CATEGORIES) {
      const answer = player.answers[category]?.trim() ?? "";
      const valid = answer.length > 0 && answer.length <= 80 && validateWord(answer, CATEGORY_MAP[category], letter).valid;
      playerValidity.set(category, valid);
      if (valid) {
        const normalized = normalizeAnswer(answer);
        const counts = duplicateCounts.get(category);
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
    }
    validation.set(player.id, playerValidity);
  }
  return players.map((player) => {
    const scores = {};
    const status = {};
    let roundTotal = 0;
    for (const category of GAME_CATEGORIES) {
      const answer = player.answers[category]?.trim() ?? "";
      const valid = validation.get(player.id)?.get(category) ?? false;
      if (!answer) {
        scores[category] = 0;
        status[category] = "empty";
      } else if (!valid) {
        scores[category] = 0;
        status[category] = "invalid";
      } else {
        const count = duplicateCounts.get(category).get(normalizeAnswer(answer)) ?? 0;
        scores[category] = count > 1 ? 5 : 10;
        status[category] = count > 1 ? "duplicate" : "correct";
      }
      roundTotal += scores[category];
    }
    return {
      playerId: player.id,
      playerName: player.name,
      answers: player.answers,
      scores,
      status,
      roundTotal
    };
  });
}
function getRandomMatchBaseRewards(players) {
  const rewards = new Map(players.map((player) => [player.id, 0]));
  if (players.length !== 2) return rewards;
  const [first, second] = players;
  if (first.abandoned && second.abandoned) return rewards;
  if (first.abandoned) {
    rewards.set(second.id, 20);
    return rewards;
  }
  if (second.abandoned) {
    rewards.set(first.id, 20);
    return rewards;
  }
  if (first.score === second.score) {
    rewards.set(first.id, 10);
    rewards.set(second.id, 10);
  } else {
    rewards.set(first.score > second.score ? first.id : second.id, 20);
    rewards.set(first.score > second.score ? second.id : first.id, 5);
  }
  return rewards;
}
function applyDailyRewardLimit(baseReward, completedMatchesToday) {
  if (completedMatchesToday < 10) return baseReward;
  if (completedMatchesToday < 20) return Math.floor(baseReward / 2);
  return 0;
}
function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let code = "";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}
function getRandomLetter() {
  return ARABIC_LETTERS[randomBytes(4).readUInt32BE(0) % ARABIC_LETTERS.length];
}

// server/social.ts
import { createHash } from "node:crypto";
import { setInterval as setNodeInterval, clearInterval as clearNodeInterval } from "node:timers";
import { and as and2, desc, eq as eq2, gt, gte, ilike, inArray, isNull, lt as lt2, lte, ne, or, sql as sql3 } from "drizzle-orm";
import { z } from "zod";

// server/social-logic.ts
function normalizePlayerPair(first, second) {
  return first < second ? [first, second] : [second, first];
}
function normalizeMessageContent(value) {
  if (typeof value !== "string") return null;
  const content = value.trim();
  return content.length > 0 && content.length <= 1e3 ? content : null;
}
function canMessage(input) {
  return !input.samePlayer && input.friends && !input.blocked;
}
function canSendFriendRequest(input) {
  return !input.samePlayer && !input.alreadyFriends && !input.blocked && input.requestsAllowed;
}

// server/social.ts
var presenceByPlayer = /* @__PURE__ */ new Map();
var rateBuckets = /* @__PURE__ */ new Map();
var MAX_PAGE_SIZE = 50;
var PAGE_SIZE_SCHEMA = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20);
var uuidSchema = z.string().uuid();
var friendRequestSchema = z.object({ playerId: uuidSchema }).strict();
var profileSchema = z.object({ displayName: z.string().trim().min(1).max(24) }).strict();
var blockSchema = z.object({ playerId: uuidSchema }).strict();
var messageSchema = z.object({
  content: z.string().transform(normalizeMessageContent).pipe(z.string().min(1).max(1e3)),
  idempotencyKey: z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/)
}).strict();
var inviteSchema = z.object({
  playerId: uuidSchema,
  roomCode: z.string().trim().regex(/^[A-HJ-NP-Z2-9]{6}$/i)
}).strict();
var invitationResponseSchema = z.object({
  inviteId: uuidSchema,
  accept: z.boolean()
}).strict();
var socketMessageSchema = z.object({
  playerId: uuidSchema,
  ...messageSchema.shape
}).strict();
var typingSchema = z.object({ playerId: uuidSchema }).strict();
var readSchema = z.object({ conversationId: uuidSchema }).strict();
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
function isRateLimited(key, limit, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}
function getPresence(playerId) {
  const entry = presenceByPlayer.get(playerId);
  if (!entry || entry.sockets.size === 0) return "offline";
  return entry.inGame ? "in_game" : "online";
}
async function ensureProfile(playerId, displayName) {
  await db.insert(socialProfiles).values({
    playerId,
    ...displayName ? { displayName: displayName.replace(/[<>]/g, "") } : {}
  }).onConflictDoNothing();
}
async function authorizedPlayer(req) {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (token.length < 40 || token.length > 128) return null;
  const [session] = await db.select({ id: onlineGuestSessions.id }).from(onlineGuestSessions).where(and2(
    eq2(onlineGuestSessions.tokenHash, hashToken(token)),
    gte(onlineGuestSessions.expiresAt, /* @__PURE__ */ new Date())
  )).limit(1);
  return session?.id ?? null;
}
function withAuth(handler) {
  return async (req, res) => {
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
async function getPlayerProfile(playerId) {
  const [profile] = await db.select({
    playerId: socialProfiles.playerId,
    displayName: socialProfiles.displayName
  }).from(socialProfiles).where(eq2(socialProfiles.playerId, playerId)).limit(1);
  return profile ?? { playerId, displayName: "\u0644\u0627\u0639\u0628" };
}
async function areFriends(first, second) {
  const [playerLow, playerHigh] = normalizePlayerPair(first, second);
  const [friendship] = await db.select({ playerLow: socialFriendships.playerLow }).from(socialFriendships).where(and2(
    eq2(socialFriendships.playerLow, playerLow),
    eq2(socialFriendships.playerHigh, playerHigh)
  )).limit(1);
  return !!friendship;
}
async function isBlockedEitherWay(first, second) {
  const [block] = await db.select({ blockerId: socialBlocks.blockerId }).from(socialBlocks).where(or(
    and2(eq2(socialBlocks.blockerId, first), eq2(socialBlocks.blockedId, second)),
    and2(eq2(socialBlocks.blockerId, second), eq2(socialBlocks.blockedId, first))
  )).limit(1);
  return !!block;
}
async function createNotification(playerId, type, actorId, entityId, payload = {}) {
  try {
    const [notification] = await db.insert(socialNotifications).values({
      playerId,
      type,
      actorId,
      entityId,
      payload
    }).returning({
      id: socialNotifications.id,
      type: socialNotifications.type,
      actorId: socialNotifications.actorId,
      entityId: socialNotifications.entityId,
      createdAt: socialNotifications.createdAt
    });
    const event = {
      id: notification.id,
      type: notification.type,
      actorId: notification.actorId,
      entityId: notification.entityId,
      createdAt: notification.createdAt.toISOString()
    };
    ioForPresence?.to(`social:${playerId}`).emit("social:notification", event);
  } catch (error) {
    console.error("[social] Notification persistence failed:", error);
    ioForPresence?.to(`social:${playerId}`).emit("social:error", { code: "notification_unavailable" });
  }
}
function parsePageSize(value) {
  const parsed = PAGE_SIZE_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : 20;
}
function parsePageOffset(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 0;
  return Math.min(Number(value), 1e4);
}
function parseCursor(value) {
  if (typeof value !== "string" || value.length > 512) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed === "object" && parsed !== null && "createdAt" in parsed && typeof parsed.createdAt === "string" && "id" in parsed && typeof parsed.id === "string") {
      const createdAt = new Date(parsed.createdAt);
      if (!Number.isNaN(createdAt.getTime())) return { createdAt, id: parsed.id };
    }
  } catch {
    return null;
  }
  return null;
}
function makeCursor(createdAt, id) {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), "utf8").toString("base64url");
}
function registerSocialRoutes(app2) {
  app2.get("/api/social/profile", withAuth(async (_req, res, playerId) => {
    await ensureProfile(playerId);
    const profile = await getPlayerProfile(playerId);
    res.json({ ...profile, playerCode: playerId });
  }));
  app2.put("/api/social/profile", withAuth(async (req, res, playerId) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    await db.insert(socialProfiles).values({
      playerId,
      displayName: parsed.data.displayName.replace(/[<>]/g, "")
    }).onConflictDoUpdate({
      target: socialProfiles.playerId,
      set: { displayName: parsed.data.displayName.replace(/[<>]/g, ""), updatedAt: /* @__PURE__ */ new Date() }
    });
    res.json(await getPlayerProfile(playerId));
  }));
  app2.put("/api/social/privacy", withAuth(async (req, res, playerId) => {
    await ensureProfile(playerId);
    const parsed = z.object({
      allowFriendRequests: z.boolean(),
      allowGameInvites: z.boolean(),
      showPresence: z.boolean()
    }).strict().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    await db.update(socialProfiles).set({ ...parsed.data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(socialProfiles.playerId, playerId));
    await broadcastPresence(playerId);
    res.json({ success: true });
  }));
  app2.get("/api/social/privacy", withAuth(async (_req, res, playerId) => {
    await ensureProfile(playerId);
    const [privacy] = await db.select({
      allowFriendRequests: socialProfiles.allowFriendRequests,
      allowGameInvites: socialProfiles.allowGameInvites,
      showPresence: socialProfiles.showPresence
    }).from(socialProfiles).where(eq2(socialProfiles.playerId, playerId)).limit(1);
    res.json(privacy ?? {
      allowFriendRequests: true,
      allowGameInvites: true,
      showPresence: true
    });
  }));
  app2.get("/api/social/search", withAuth(async (req, res, playerId) => {
    if (isRateLimited(`search:${playerId}`, 30, 6e4)) {
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
      showPresence: socialProfiles.showPresence
    }).from(socialProfiles).where(and2(
      ne(socialProfiles.playerId, playerId),
      or(ilike(socialProfiles.displayName, pattern), sql3`lower(${socialProfiles.playerId}) = lower(${query})`),
      sql3`NOT EXISTS (
        SELECT 1 FROM social_blocks b
        WHERE (b.blocker_id = ${playerId} AND b.blocked_id = ${socialProfiles.playerId})
           OR (b.blocker_id = ${socialProfiles.playerId} AND b.blocked_id = ${playerId})
      )`
    )).limit(20);
    const friendships = matches.length ? await db.select().from(socialFriendships).where(and2(
      or(eq2(socialFriendships.playerLow, playerId), eq2(socialFriendships.playerHigh, playerId)),
      or(
        inArray(socialFriendships.playerLow, matches.map((match) => match.playerId)),
        inArray(socialFriendships.playerHigh, matches.map((match) => match.playerId))
      )
    )) : [];
    const friendIds = new Set(friendships.map(
      (friendship) => friendship.playerLow === playerId ? friendship.playerHigh : friendship.playerLow
    ));
    res.json({
      players: matches.map(({ showPresence, ...profile }) => ({
        ...profile,
        presence: showPresence && friendIds.has(profile.playerId) ? getPresence(profile.playerId) : "hidden"
      }))
    });
  }));
  app2.post("/api/social/friend-requests", withAuth(async (req, res, playerId) => {
    await ensureProfile(playerId);
    if (isRateLimited(`friend-request:${playerId}`, 10, 6e4)) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    const parsed = friendRequestSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.playerId === playerId) {
      res.status(400).json({ error: "invalid_player" });
      return;
    }
    const targetId = parsed.data.playerId;
    const [target] = await db.select().from(socialProfiles).where(eq2(socialProfiles.playerId, targetId)).limit(1);
    if (!target) {
      res.status(404).json({ error: "player_not_found" });
      return;
    }
    const [alreadyFriends, blocked] = await Promise.all([
      areFriends(playerId, targetId),
      isBlockedEitherWay(playerId, targetId)
    ]);
    if (!canSendFriendRequest({
      samePlayer: playerId === targetId,
      alreadyFriends,
      blocked,
      requestsAllowed: target.allowFriendRequests
    })) {
      res.status(blocked || !target.allowFriendRequests ? 403 : 409).json({
        error: blocked || !target.allowFriendRequests ? "contact_not_allowed" : "already_friends"
      });
      return;
    }
    const [pairLow, pairHigh] = normalizePlayerPair(playerId, targetId);
    const [existing] = await db.select().from(socialFriendRequests).where(and2(
      eq2(socialFriendRequests.pairLow, pairLow),
      eq2(socialFriendRequests.pairHigh, pairHigh),
      eq2(socialFriendRequests.status, "pending")
    )).limit(1);
    if (existing) {
      res.status(409).json({ error: "request_already_pending" });
      return;
    }
    let request;
    try {
      [request] = await db.insert(socialFriendRequests).values({
        senderId: playerId,
        receiverId: targetId,
        pairLow,
        pairHigh
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
  app2.get("/api/social/friend-requests", withAuth(async (req, res, playerId) => {
    const direction = req.query.direction === "outgoing" ? "outgoing" : "incoming";
    const limit = parsePageSize(req.query.limit);
    const offset = parsePageOffset(req.query.offset);
    const requests = await db.select().from(socialFriendRequests).where(and2(
      eq2(direction === "incoming" ? socialFriendRequests.receiverId : socialFriendRequests.senderId, playerId),
      eq2(socialFriendRequests.status, "pending")
    )).orderBy(desc(socialFriendRequests.createdAt)).limit(limit + 1).offset(offset);
    const hasMore = requests.length > limit;
    const page = requests.slice(0, limit);
    const ids = page.map((request) => direction === "incoming" ? request.senderId : request.receiverId);
    const profiles = ids.length ? await db.select({
      playerId: socialProfiles.playerId,
      displayName: socialProfiles.displayName
    }).from(socialProfiles).where(inArray(socialProfiles.playerId, ids)) : [];
    const profileById = new Map(profiles.map((profile) => [profile.playerId, profile]));
    res.json({
      requests: page.map((request) => ({
        id: request.id,
        createdAt: request.createdAt,
        player: profileById.get(direction === "incoming" ? request.senderId : request.receiverId)
      })),
      nextOffset: hasMore ? offset + limit : null
    });
  }));
  app2.post("/api/social/friend-requests/:id/respond", withAuth(async (req, res, playerId) => {
    const requestId = uuidSchema.safeParse(req.params.id);
    const parsed = z.object({ accept: z.boolean() }).strict().safeParse(req.body);
    if (!requestId.success || !parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const [result] = await db.transaction(async (tx) => {
      const [request] = await tx.select().from(socialFriendRequests).where(and2(
        eq2(socialFriendRequests.id, requestId.data),
        eq2(socialFriendRequests.receiverId, playerId),
        eq2(socialFriendRequests.status, "pending")
      )).limit(1).for("update");
      if (!request) return [];
      const [block] = await tx.select({ blockerId: socialBlocks.blockerId }).from(socialBlocks).where(or(
        and2(eq2(socialBlocks.blockerId, playerId), eq2(socialBlocks.blockedId, request.senderId)),
        and2(eq2(socialBlocks.blockerId, request.senderId), eq2(socialBlocks.blockedId, playerId))
      )).limit(1);
      if (block) return [];
      await tx.update(socialFriendRequests).set({
        status: parsed.data.accept ? "accepted" : "declined",
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(socialFriendRequests.id, request.id));
      if (parsed.data.accept) {
        await tx.insert(socialFriendships).values({
          playerLow: request.pairLow,
          playerHigh: request.pairHigh
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
  app2.delete("/api/social/friend-requests/:id", withAuth(async (req, res, playerId) => {
    const requestId = uuidSchema.safeParse(req.params.id);
    if (!requestId.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const deleted = await db.delete(socialFriendRequests).where(and2(
      eq2(socialFriendRequests.id, requestId.data),
      eq2(socialFriendRequests.senderId, playerId),
      eq2(socialFriendRequests.status, "pending")
    )).returning({ id: socialFriendRequests.id });
    res.status(deleted.length ? 200 : 404).json({ success: deleted.length > 0 });
  }));
  app2.get("/api/social/friends", withAuth(async (req, res, playerId) => {
    const limit = parsePageSize(req.query.limit);
    const offset = parsePageOffset(req.query.offset);
    const rows = await db.select().from(socialFriendships).where(or(
      eq2(socialFriendships.playerLow, playerId),
      eq2(socialFriendships.playerHigh, playerId)
    )).orderBy(desc(socialFriendships.createdAt)).limit(limit + 1).offset(offset);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const ids = page.map((row) => row.playerLow === playerId ? row.playerHigh : row.playerLow);
    const profiles = ids.length ? await db.select({
      playerId: socialProfiles.playerId,
      displayName: socialProfiles.displayName,
      showPresence: socialProfiles.showPresence
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
          presence: profile.showPresence ? getPresence(id) : "hidden"
        }] : [];
      }),
      nextOffset: hasMore ? offset + limit : null
    });
  }));
  app2.delete("/api/social/friends/:playerId", withAuth(async (req, res, playerId) => {
    const target = uuidSchema.safeParse(req.params.playerId);
    if (!target.success || target.data === playerId) {
      res.status(400).json({ error: "invalid_player" });
      return;
    }
    const [low, high] = normalizePlayerPair(playerId, target.data);
    await db.delete(socialFriendships).where(and2(
      eq2(socialFriendships.playerLow, low),
      eq2(socialFriendships.playerHigh, high)
    ));
    res.json({ success: true });
  }));
  app2.post("/api/social/blocks", withAuth(async (req, res, playerId) => {
    await ensureProfile(playerId);
    if (isRateLimited(`block:${playerId}`, 10, 6e4)) {
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
      const [low, high] = normalizePlayerPair(playerId, targetId);
      await tx.delete(socialFriendships).where(and2(
        eq2(socialFriendships.playerLow, low),
        eq2(socialFriendships.playerHigh, high)
      ));
      await tx.update(socialFriendRequests).set({ status: "cancelled", updatedAt: /* @__PURE__ */ new Date() }).where(and2(
        or(
          and2(eq2(socialFriendRequests.senderId, playerId), eq2(socialFriendRequests.receiverId, targetId)),
          and2(eq2(socialFriendRequests.senderId, targetId), eq2(socialFriendRequests.receiverId, playerId))
        ),
        eq2(socialFriendRequests.status, "pending")
      ));
      await tx.update(socialGameInvites).set({ status: "expired" }).where(and2(
        or(
          and2(eq2(socialGameInvites.senderId, playerId), eq2(socialGameInvites.receiverId, targetId)),
          and2(eq2(socialGameInvites.senderId, targetId), eq2(socialGameInvites.receiverId, playerId))
        ),
        eq2(socialGameInvites.status, "pending")
      ));
    });
    res.json({ success: true });
  }));
  app2.delete("/api/social/blocks/:playerId", withAuth(async (req, res, playerId) => {
    const target = uuidSchema.safeParse(req.params.playerId);
    if (!target.success) {
      res.status(400).json({ error: "invalid_player" });
      return;
    }
    await db.delete(socialBlocks).where(and2(
      eq2(socialBlocks.blockerId, playerId),
      eq2(socialBlocks.blockedId, target.data)
    ));
    res.json({ success: true });
  }));
  app2.get("/api/social/blocks", withAuth(async (_req, res, playerId) => {
    const rows = await db.select({
      playerId: socialBlocks.blockedId,
      displayName: socialProfiles.displayName,
      createdAt: socialBlocks.createdAt
    }).from(socialBlocks).innerJoin(socialProfiles, eq2(socialProfiles.playerId, socialBlocks.blockedId)).where(eq2(socialBlocks.blockerId, playerId)).orderBy(desc(socialBlocks.createdAt)).limit(MAX_PAGE_SIZE);
    res.json({ blocks: rows });
  }));
  app2.post("/api/social/conversations", withAuth(async (req, res, playerId) => {
    await ensureProfile(playerId);
    if (isRateLimited(`conversation:${playerId}`, 20, 6e4)) {
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
    const [playerLow, playerHigh] = normalizePlayerPair(playerId, otherId);
    await db.insert(socialConversations).values({ playerLow, playerHigh }).onConflictDoNothing();
    const [conversation] = await db.select().from(socialConversations).where(and2(
      eq2(socialConversations.playerLow, playerLow),
      eq2(socialConversations.playerHigh, playerHigh)
    )).limit(1);
    if (!conversation) {
      res.status(500).json({ error: "social_unavailable" });
      return;
    }
    res.json({ conversationId: conversation.id });
  }));
  app2.get("/api/social/conversations", withAuth(async (_req, res, playerId) => {
    const result = await db.execute(sql3`
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
  app2.get("/api/social/conversations/:id/messages", withAuth(async (req, res, playerId) => {
    const conversationId = uuidSchema.safeParse(req.params.id);
    if (!conversationId.success) {
      res.status(400).json({ error: "invalid_conversation" });
      return;
    }
    const [conversation] = await db.select().from(socialConversations).where(and2(
      eq2(socialConversations.id, conversationId.data),
      or(eq2(socialConversations.playerLow, playerId), eq2(socialConversations.playerHigh, playerId))
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
      eq2(socialMessages.conversationId, conversation.id),
      ...cursor ? [or(
        lt2(socialMessages.createdAt, cursor.createdAt),
        and2(eq2(socialMessages.createdAt, cursor.createdAt), lt2(socialMessages.id, cursor.id))
      )] : []
    ];
    const page = await db.select().from(socialMessages).where(and2(...conditions)).orderBy(desc(socialMessages.createdAt), desc(socialMessages.id)).limit(limit + 1);
    const hasMore = page.length > limit;
    const messages = page.slice(0, limit);
    const oldest = messages.at(-1);
    res.json({
      messages: messages.reverse(),
      nextCursor: hasMore && oldest ? makeCursor(oldest.createdAt, oldest.id) : null
    });
  }));
  app2.get("/api/social/notifications", withAuth(async (req, res, playerId) => {
    const limit = parsePageSize(req.query.limit);
    const notifications = await db.select({
      id: socialNotifications.id,
      type: socialNotifications.type,
      actorId: socialNotifications.actorId,
      actorName: socialProfiles.displayName,
      entityId: socialNotifications.entityId,
      payload: socialNotifications.payload,
      readAt: socialNotifications.readAt,
      createdAt: socialNotifications.createdAt
    }).from(socialNotifications).leftJoin(socialProfiles, eq2(socialProfiles.playerId, socialNotifications.actorId)).where(eq2(socialNotifications.playerId, playerId)).orderBy(desc(socialNotifications.createdAt), desc(socialNotifications.id)).limit(limit);
    res.json({ notifications });
  }));
  app2.post("/api/social/notifications/:id/read", withAuth(async (req, res, playerId) => {
    const notificationId = uuidSchema.safeParse(req.params.id);
    if (!notificationId.success) {
      res.status(400).json({ error: "invalid_notification" });
      return;
    }
    await db.update(socialNotifications).set({ readAt: /* @__PURE__ */ new Date() }).where(and2(
      eq2(socialNotifications.id, notificationId.data),
      eq2(socialNotifications.playerId, playerId),
      isNull(socialNotifications.readAt)
    ));
    res.json({ success: true });
  }));
  app2.get("/api/social/invitations", withAuth(async (_req, res, playerId) => {
    await db.update(socialGameInvites).set({ status: "expired" }).where(and2(
      eq2(socialGameInvites.receiverId, playerId),
      eq2(socialGameInvites.status, "pending"),
      lte(socialGameInvites.expiresAt, /* @__PURE__ */ new Date())
    ));
    const invitations = await db.select({
      id: socialGameInvites.id,
      senderId: socialGameInvites.senderId,
      roomCode: socialGameInvites.roomCode,
      expiresAt: socialGameInvites.expiresAt,
      createdAt: socialGameInvites.createdAt,
      displayName: socialProfiles.displayName
    }).from(socialGameInvites).innerJoin(socialProfiles, eq2(socialProfiles.playerId, socialGameInvites.senderId)).where(and2(
      eq2(socialGameInvites.receiverId, playerId),
      eq2(socialGameInvites.status, "pending"),
      gt(socialGameInvites.expiresAt, /* @__PURE__ */ new Date())
    )).orderBy(desc(socialGameInvites.createdAt)).limit(20);
    res.json({ invitations });
  }));
}
function setSocialPlayerInGame(playerId, inGame) {
  const entry = presenceByPlayer.get(playerId);
  if (!entry || entry.inGame === inGame) return;
  entry.inGame = inGame;
  void broadcastPresence(playerId).catch((error) => console.error("[social] Presence broadcast failed:", error));
}
async function broadcastPresence(playerId) {
  const entry = presenceByPlayer.get(playerId);
  const state = getPresence(playerId);
  if (state === "offline" && entry?.inGame) return;
  const friendships = await db.select().from(socialFriendships).where(or(
    eq2(socialFriendships.playerLow, playerId),
    eq2(socialFriendships.playerHigh, playerId)
  ));
  const friendIds = friendships.map((row) => row.playerLow === playerId ? row.playerHigh : row.playerLow);
  if (friendIds.length === 0) return;
  const friends = await db.select({
    playerId: socialProfiles.playerId,
    showPresence: socialProfiles.showPresence
  }).from(socialProfiles).where(inArray(socialProfiles.playerId, friendIds));
  for (const friend of friends) {
    ioForPresence?.to(`social:${friend.playerId}`).emit("social:presence", {
      playerId,
      status: friend.showPresence ? state : "hidden"
    });
  }
}
var ioForPresence = null;
var invitationTimers = /* @__PURE__ */ new Map();
async function canChat(playerId, otherId) {
  const [friends, blocked] = await Promise.all([
    areFriends(playerId, otherId),
    isBlockedEitherWay(playerId, otherId)
  ]);
  return canMessage({ samePlayer: playerId === otherId, friends, blocked });
}
async function getOrCreateConversation(first, second) {
  const [playerLow, playerHigh] = normalizePlayerPair(first, second);
  await db.insert(socialConversations).values({ playerLow, playerHigh }).onConflictDoNothing();
  const [conversation] = await db.select().from(socialConversations).where(and2(
    eq2(socialConversations.playerLow, playerLow),
    eq2(socialConversations.playerHigh, playerHigh)
  )).limit(1);
  return conversation;
}
async function saveMessage(senderId, receiverId, content, idempotencyKey) {
  const conversation = await getOrCreateConversation(senderId, receiverId);
  if (!conversation) throw new Error("conversation_unavailable");
  const [inserted] = await db.insert(socialMessages).values({
    conversationId: conversation.id,
    senderId,
    idempotencyKey,
    content
  }).onConflictDoNothing().returning();
  if (!inserted) {
    const [existing] = await db.select().from(socialMessages).where(and2(
      eq2(socialMessages.senderId, senderId),
      eq2(socialMessages.idempotencyKey, idempotencyKey)
    )).limit(1);
    if (existing && existing.conversationId !== conversation.id) {
      throw new Error("idempotency_conflict");
    }
    return { conversation, message: existing, duplicate: true };
  }
  await db.update(socialConversations).set({ updatedAt: inserted.createdAt }).where(eq2(socialConversations.id, conversation.id));
  return { conversation, message: inserted, duplicate: false };
}
function attachSocialSocket(io, socket, playerId, validateRoom, initiallyInGame = false) {
  ioForPresence = io;
  socket.join(`social:${playerId}`);
  const presence = presenceByPlayer.get(playerId) ?? { sockets: /* @__PURE__ */ new Set(), inGame: initiallyInGame };
  presence.sockets.add(socket.id);
  presenceByPlayer.set(playerId, presence);
  void ensureProfile(playerId, socket.data.displayName).then(() => broadcastPresence(playerId)).catch((error) => console.error("[social] Could not initialize profile:", error));
  const rateLimitSocketEvent = (event, limit, windowMs) => {
    if (!isRateLimited(`socket:${playerId}:${event}`, limit, windowMs)) return true;
    socket.emit("social:error", { code: "rate_limited" });
    return false;
  };
  const createInvite = async (targetId, roomCode) => {
    if (targetId === playerId || !await canChat(playerId, targetId)) return { error: "contact_not_allowed" };
    if (getPresence(targetId) === "offline") return { error: "player_offline" };
    const [target] = await db.select({ allowGameInvites: socialProfiles.allowGameInvites }).from(socialProfiles).where(eq2(socialProfiles.playerId, targetId)).limit(1);
    if (!target?.allowGameInvites) return { error: "contact_not_allowed" };
    const roomState = validateRoom(roomCode, targetId);
    if (roomState !== "ok") {
      return { error: roomState === "full" ? "room_full" : roomState === "already_in_match" ? "already_in_match" : "room_not_available" };
    }
    const now = /* @__PURE__ */ new Date();
    const [pairLow, pairHigh] = normalizePlayerPair(playerId, targetId);
    await db.update(socialGameInvites).set({ status: "expired" }).where(and2(
      eq2(socialGameInvites.status, "pending"),
      lte(socialGameInvites.expiresAt, now)
    ));
    const [duplicate] = await db.select().from(socialGameInvites).where(and2(
      eq2(socialGameInvites.pairLow, pairLow),
      eq2(socialGameInvites.pairHigh, pairHigh),
      eq2(socialGameInvites.roomCode, roomCode.toUpperCase()),
      eq2(socialGameInvites.status, "pending"),
      gt(socialGameInvites.expiresAt, now)
    )).limit(1);
    if (duplicate) return { error: "invite_already_sent" };
    const [invite] = await db.insert(socialGameInvites).values({
      senderId: playerId,
      receiverId: targetId,
      pairLow,
      pairHigh,
      roomCode: roomCode.toUpperCase(),
      expiresAt: new Date(Date.now() + 6e4)
    }).returning();
    const sender = await getPlayerProfile(playerId);
    await createNotification(targetId, "game_invite", playerId, invite.id, { roomCode: invite.roomCode });
    io.to(`social:${targetId}`).emit("social:game_invite", {
      id: invite.id,
      senderId: playerId,
      displayName: sender.displayName,
      roomCode: invite.roomCode,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString()
    });
    const timer = setTimeout(() => {
      void db.update(socialGameInvites).set({ status: "expired" }).where(and2(
        eq2(socialGameInvites.id, invite.id),
        eq2(socialGameInvites.status, "pending")
      )).catch((error) => console.error("[social] Invite expiry failed:", error));
      invitationTimers.delete(invite.id);
    }, 6e4);
    invitationTimers.set(invite.id, timer);
    return { inviteId: invite.id };
  };
  socket.on("social:message", async (payload, ack) => {
    if (!rateLimitSocketEvent("message", 30, 6e4)) return;
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
      const message = {
        id: saved.message.id,
        conversationId: saved.conversation.id,
        senderId: playerId,
        content: saved.message.content,
        createdAt: saved.message.createdAt.toISOString(),
        readAt: saved.message.readAt?.toISOString() ?? null
      };
      if (!saved.duplicate) {
        await createNotification(parsed.data.playerId, "message", playerId, saved.message.id, {
          conversationId: saved.conversation.id
        });
        io.to(`social:${parsed.data.playerId}`).emit("social:new_message", message);
      }
      ack?.({ ok: true, message, duplicate: saved.duplicate });
    } catch (error) {
      console.error("[social] Message persistence failed:", error);
      ack?.({ ok: false, error: "message_unavailable" });
    }
  });
  socket.on("social:typing", async (payload) => {
    if (!rateLimitSocketEvent("typing", 20, 1e4)) return;
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
  socket.on("social:typing-stop", async (payload) => {
    if (!rateLimitSocketEvent("typing-stop", 20, 1e4)) return;
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
  socket.on("social:read", async (payload, ack) => {
    if (!rateLimitSocketEvent("read", 30, 6e4)) return;
    const parsed = readSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: false, error: "invalid_payload" });
      return;
    }
    try {
      const [conversation] = await db.select().from(socialConversations).where(and2(
        eq2(socialConversations.id, parsed.data.conversationId),
        or(eq2(socialConversations.playerLow, playerId), eq2(socialConversations.playerHigh, playerId))
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
      const readAt = /* @__PURE__ */ new Date();
      const readMessages = await db.update(socialMessages).set({ readAt }).where(and2(
        eq2(socialMessages.conversationId, conversation.id),
        ne(socialMessages.senderId, playerId),
        isNull(socialMessages.readAt)
      )).returning({ id: socialMessages.id });
      if (readMessages.length > 0) {
        await db.update(socialNotifications).set({ readAt }).where(and2(
          eq2(socialNotifications.playerId, playerId),
          eq2(socialNotifications.type, "message"),
          inArray(socialNotifications.entityId, readMessages.map((message) => message.id)),
          isNull(socialNotifications.readAt)
        ));
        io.to(`social:${playerId}`).emit("social:notification_read", {
          conversationId: conversation.id
        });
      }
      io.to(`social:${otherId}`).emit("social:read_receipt", {
        conversationId: conversation.id,
        readerId: playerId,
        readAt: readAt.toISOString()
      });
      ack?.({ ok: true, readAt: readAt.toISOString() });
    } catch (error) {
      console.error("[social] Mark-read failed:", error);
      ack?.({ ok: false, error: "social_unavailable" });
    }
  });
  socket.on("social:game_invite", async (payload, ack) => {
    if (!rateLimitSocketEvent("invite", 5, 6e4)) return;
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
  socket.on("social:game_invite:respond", async (payload, ack) => {
    if (!rateLimitSocketEvent("invite-response", 10, 6e4)) return;
    const parsed = invitationResponseSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: false, error: "invalid_payload" });
      return;
    }
    try {
      const now = /* @__PURE__ */ new Date();
      await db.update(socialGameInvites).set({ status: "expired" }).where(and2(
        eq2(socialGameInvites.receiverId, playerId),
        eq2(socialGameInvites.status, "pending"),
        lte(socialGameInvites.expiresAt, now)
      ));
      const [invite] = await db.select().from(socialGameInvites).where(and2(
        eq2(socialGameInvites.id, parsed.data.inviteId),
        eq2(socialGameInvites.receiverId, playerId),
        eq2(socialGameInvites.status, "pending"),
        gt(socialGameInvites.expiresAt, now)
      )).limit(1);
      if (!invite || await isBlockedEitherWay(playerId, invite.senderId)) {
        ack?.({ ok: false, error: "invite_expired" });
        return;
      }
      if (parsed.data.accept) {
        const roomState = validateRoom(invite.roomCode, playerId);
        const [targetPrivacy] = await db.select({
          allowGameInvites: socialProfiles.allowGameInvites
        }).from(socialProfiles).where(eq2(socialProfiles.playerId, playerId)).limit(1);
        if (!targetPrivacy?.allowGameInvites) {
          await db.update(socialGameInvites).set({ status: "expired" }).where(eq2(socialGameInvites.id, invite.id));
          ack?.({ ok: false, error: "contact_not_allowed" });
          return;
        }
        if (roomState !== "ok") {
          await db.update(socialGameInvites).set({ status: "expired" }).where(eq2(socialGameInvites.id, invite.id));
          ack?.({
            ok: false,
            error: roomState === "full" ? "room_full" : roomState === "already_in_match" ? "already_in_match" : "room_not_available"
          });
          return;
        }
      }
      const status = parsed.data.accept ? "accepted" : "declined";
      const [updatedInvite] = await db.update(socialGameInvites).set({ status }).where(and2(
        eq2(socialGameInvites.id, invite.id),
        eq2(socialGameInvites.status, "pending")
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
        roomCode: invite.roomCode
      });
      io.to(`social:${invite.senderId}`).emit("social:invite_response", {
        inviteId: invite.id,
        playerId,
        status,
        roomCode: invite.roomCode
      });
      ack?.({
        ok: true,
        status,
        ...parsed.data.accept ? { roomCode: invite.roomCode } : {}
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
    void broadcastPresence(playerId).catch((error) => console.error("[social] Presence update failed:", error));
  });
}
function initializeSocial(io, httpServer) {
  ioForPresence = io;
  void db.update(socialGameInvites).set({ status: "expired" }).where(and2(
    eq2(socialGameInvites.status, "pending"),
    lte(socialGameInvites.expiresAt, /* @__PURE__ */ new Date())
  )).catch((error) => console.error("[social] Startup invite cleanup failed:", error));
  const cleanup = setNodeInterval(() => {
    const cutoff = Date.now() - 10 * 6e4;
    for (const [key, bucket] of rateBuckets) {
      if (bucket.startedAt < cutoff) rateBuckets.delete(key);
    }
  }, 6e4);
  httpServer.once("close", () => {
    clearNodeInterval(cleanup);
    for (const timer of invitationTimers.values()) clearTimeout(timer);
    invitationTimers.clear();
    presenceByPlayer.clear();
    ioForPresence = null;
  });
}

// server/online-multiplayer.ts
var SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1e3;
var READY_TIMEOUT_MS = 3e4;
var RECONNECT_GRACE_MS = 3e4;
var COUNTDOWN_SECONDS = 3;
var RESULT_DISPLAY_MS = 4e3;
var MAX_SOCKET_PAYLOAD_BYTES = 16 * 1024;
var displayNameSchema = z2.string().trim().min(1).max(24);
var roomSettingsSchema = z2.object({
  maxPlayers: z2.union([z2.literal(2), z2.literal(4), z2.literal(6), z2.literal(8)]),
  rounds: z2.union([z2.literal(3), z2.literal(5), z2.literal(7)]),
  secondsPerRound: z2.union([z2.literal(45), z2.literal(60), z2.literal(90)])
}).strict();
var matchIdSchema = z2.string().uuid();
var matchEventSchema = z2.object({ matchId: matchIdSchema }).strict();
var submitSchema = z2.object({
  matchId: matchIdSchema,
  answers: z2.record(z2.string().max(80))
}).strict();
var roomJoinSchema = z2.object({ roomCode: z2.string().trim().regex(/^[A-HJ-NP-Z2-9]{6}$/i) }).strict();
var settingsEventSchema = z2.object({
  roomCode: z2.string().trim().regex(/^[A-HJ-NP-Z2-9]{6}$/i),
  settings: roomSettingsSchema
}).strict();
var waitingQueue = new OnlineMatchQueue();
var activeMatchByPlayer = /* @__PURE__ */ new Map();
var finishedMatchByPlayer = /* @__PURE__ */ new Map();
var matchesById = /* @__PURE__ */ new Map();
var roomsByCode = /* @__PURE__ */ new Map();
var socketByPlayer = /* @__PURE__ */ new Map();
var socketsByPlayer = /* @__PURE__ */ new Map();
var rateBuckets2 = /* @__PURE__ */ new Map();
var emptySettings = {
  maxPlayers: 2,
  rounds: 5,
  secondsPerRound: 60
};
function hashToken2(token) {
  return createHash2("sha256").update(token).digest("hex");
}
function getClientAddress(socket) {
  return socket.handshake.address || "unknown";
}
function isRateLimited2(key, limit, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets2.get(key);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    rateBuckets2.set(key, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}
function cleanRateBuckets() {
  const cutoff = Date.now() - 10 * 6e4;
  for (const [key, bucket] of rateBuckets2) {
    if (bucket.startedAt < cutoff) rateBuckets2.delete(key);
  }
}
function safeDisplayName(value) {
  const parsed = displayNameSchema.safeParse(value);
  if (!parsed.success) return "\u0644\u0627\u0639\u0628";
  return parsed.data.replace(/[<>]/g, "");
}
function getPlayer(match, playerId) {
  return match.players.find((player) => player.id === playerId);
}
function snapshot(match) {
  return {
    matchId: match.id,
    mode: match.mode,
    phase: match.phase,
    roomCode: match.roomCode,
    hostId: match.hostId,
    settings: match.settings,
    round: match.round,
    totalRounds: match.settings.rounds,
    letter: match.letter,
    deadline: match.deadline,
    players: match.players.map((player) => ({
      id: player.id,
      name: player.name,
      ready: player.ready,
      host: player.id === match.hostId,
      connected: player.socketId !== null,
      score: player.score
    }))
  };
}
function emitRoomUpdate(io, match) {
  io.to(match.id).emit("room:update", snapshot(match));
}
function emitError(socket, code) {
  socket.emit("online:error", { code });
}
function clearMatchTimers(match) {
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
function removeFromQueue(playerId) {
  const entry = waitingQueue.cancel(playerId);
  if (!entry) return false;
  clearTimeout(entry.timeout);
  return true;
}
function releaseMatchPlayers(match) {
  for (const player of match.players) {
    if (activeMatchByPlayer.get(player.id) === match) activeMatchByPlayer.delete(player.id);
  }
}
function deleteMatch(match) {
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
function makePlayer(id, name, socketId) {
  return {
    id,
    name: safeDisplayName(name),
    socketId,
    ready: false,
    score: 0,
    abandoned: false,
    disconnectTimer: null
  };
}
function makeMatch(mode, host, settings) {
  const match = {
    id: randomUUID(),
    mode,
    phase: mode === "random" ? "match_found" : "waiting",
    roomCode: null,
    hostId: host.id,
    settings,
    players: [host],
    round: 0,
    letter: "",
    deadline: 0,
    answers: /* @__PURE__ */ new Map(),
    roundResults: [],
    timer: null,
    readyTimer: null,
    countdownTimer: null,
    resultsTimer: null,
    cleanupTimer: null,
    startedAt: 0,
    finalResults: null
  };
  matchesById.set(match.id, match);
  activeMatchByPlayer.set(host.id, match);
  return match;
}
function attachPlayer(io, match, player, socket) {
  player.socketId = socket.id;
  socket.data.playerId = player.id;
  socket.join(match.id);
  socketByPlayer.set(player.id, socket.id);
}
async function persistMatchStart(match) {
  await db.transaction(async (tx) => {
    await tx.insert(onlineMatches).values({
      id: match.id,
      mode: match.mode,
      status: "active",
      settings: match.settings
    });
    await tx.insert(onlineMatchParticipants).values(
      match.players.map((player) => ({
        matchId: match.id,
        playerId: player.id,
        displayName: player.name,
        active: true
      }))
    );
  });
}
async function persistAndPayMatch(match, forfeitedPlayerId) {
  let priorScore = null;
  let priorRank = 0;
  const results = [...match.players].sort((a, b) => b.score - a.score).map((player, index2) => {
    if (priorScore !== player.score) priorRank = index2 + 1;
    priorScore = player.score;
    return {
      playerId: player.id,
      name: player.name,
      score: player.score,
      rank: priorRank,
      abandoned: player.abandoned
    };
  });
  const payouts = match.mode === "random" ? getRandomMatchBaseRewards(match.players) : new Map(match.players.map((player) => [player.id, 0]));
  const rewardDate = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const wallets = /* @__PURE__ */ new Map();
  await db.transaction(async (tx) => {
    if (match.mode === "random") {
      for (const player of match.players) {
        await tx.insert(onlineGuestWallets).values({ playerId: player.id }).onConflictDoNothing();
        const [counter] = await tx.insert(onlineDailyMatchCounters).values({
          playerId: player.id,
          rewardDate,
          completedMatches: 1
        }).onConflictDoUpdate({
          target: [onlineDailyMatchCounters.playerId, onlineDailyMatchCounters.rewardDate],
          set: {
            completedMatches: sql4`${onlineDailyMatchCounters.completedMatches} + 1`
          }
        }).returning({ completedMatches: onlineDailyMatchCounters.completedMatches });
        const matchCountBeforeThisOne = counter.completedMatches - 1;
        const baseReward = payouts.get(player.id) ?? 0;
        const amount = player.abandoned ? 0 : applyDailyRewardLimit(baseReward, matchCountBeforeThisOne);
        const [claim] = await tx.insert(onlineRewardClaims).values({
          matchId: match.id,
          playerId: player.id,
          rewardType: "random_match",
          amount,
          rewardDate
        }).onConflictDoNothing().returning({ id: onlineRewardClaims.id });
        if (claim && amount > 0) {
          const [wallet] = await tx.update(onlineGuestWallets).set({ coins: sql4`${onlineGuestWallets.coins} + ${amount}`, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(onlineGuestWallets.playerId, player.id)).returning({ coins: onlineGuestWallets.coins });
          wallets.set(player.id, { coinsAwarded: amount, balance: wallet.coins });
        } else {
          const [wallet] = await tx.select({ coins: onlineGuestWallets.coins }).from(onlineGuestWallets).where(eq3(onlineGuestWallets.playerId, player.id)).limit(1);
          wallets.set(player.id, { coinsAwarded: 0, balance: wallet?.coins ?? 0 });
        }
      }
    }
    await tx.update(onlineMatches).set({
      status: "completed",
      results: { rounds: match.roundResults, final: results, forfeitedPlayerId: forfeitedPlayerId ?? null },
      completedAt: /* @__PURE__ */ new Date()
    }).where(eq3(onlineMatches.id, match.id));
    for (const result of results) {
      await tx.update(onlineMatchParticipants).set({
        score: result.score,
        active: false,
        abandoned: result.abandoned,
        finalRank: result.rank
      }).where(and3(
        eq3(onlineMatchParticipants.matchId, match.id),
        eq3(onlineMatchParticipants.playerId, result.playerId)
      ));
    }
    if (match.mode === "random" && Date.now() - match.startedAt < 25e3) {
      for (const player of match.players) {
        await tx.insert(onlineMatchFlags).values({
          matchId: match.id,
          playerId: player.id,
          reason: "unusually_fast_match",
          details: { durationMs: Date.now() - match.startedAt }
        });
      }
    }
    if (match.mode === "random" && match.players.length === 2) {
      const since = /* @__PURE__ */ new Date();
      since.setUTCHours(0, 0, 0, 0);
      const priorMatches = await tx.select({ matchId: onlineMatchParticipants.matchId }).from(onlineMatchParticipants).innerJoin(onlineMatches, eq3(onlineMatches.id, onlineMatchParticipants.matchId)).where(and3(
        eq3(onlineMatchParticipants.playerId, match.players[0].id),
        eq3(onlineMatches.mode, "random"),
        eq3(onlineMatches.status, "completed"),
        gte2(onlineMatches.completedAt, since)
      ));
      if (priorMatches.length > 0) {
        const repeatedPairs = await tx.select({ matchId: onlineMatchParticipants.matchId }).from(onlineMatchParticipants).where(and3(
          eq3(onlineMatchParticipants.playerId, match.players[1].id),
          inArray2(onlineMatchParticipants.matchId, priorMatches.map((row) => row.matchId))
        ));
        if (repeatedPairs.length >= 2) {
          for (const player of match.players) {
            await tx.insert(onlineMatchFlags).values({
              matchId: match.id,
              playerId: player.id,
              reason: "repeated_opponent_pairing",
              details: { recentPairMatches: repeatedPairs.length + 1 }
            });
          }
        }
        for (const player of match.players.filter((candidate) => candidate.abandoned)) {
          const recentForfeits = await tx.select({ matchId: onlineMatchParticipants.matchId }).from(onlineMatchParticipants).innerJoin(onlineMatches, eq3(onlineMatches.id, onlineMatchParticipants.matchId)).where(and3(
            eq3(onlineMatchParticipants.playerId, player.id),
            eq3(onlineMatchParticipants.abandoned, true),
            eq3(onlineMatches.mode, "random"),
            eq3(onlineMatches.status, "completed"),
            gte2(onlineMatches.completedAt, since)
          ));
          if (recentForfeits.length >= 2) {
            await tx.insert(onlineMatchFlags).values({
              matchId: match.id,
              playerId: player.id,
              reason: "repeated_forfeits",
              details: { recentForfeits: recentForfeits.length + 1 }
            });
          }
        }
      }
    }
  });
  return results.map((result) => ({
    ...result,
    coinsAwarded: wallets.get(result.playerId)?.coinsAwarded ?? 0,
    walletBalance: wallets.get(result.playerId)?.balance ?? 0
  }));
}
function beginRound(io, match) {
  if (match.phase === "finished" || match.phase === "settling") return;
  match.phase = "playing";
  for (const player of match.players) setSocialPlayerInGame(player.id, true);
  match.round += 1;
  match.letter = getRandomLetter();
  match.answers.clear();
  match.deadline = Date.now() + match.settings.secondsPerRound * 1e3;
  match.timer = setTimeout(() => {
    void finishRound(io, match);
  }, match.settings.secondsPerRound * 1e3);
  io.to(match.id).emit("match:round", {
    ...snapshot(match),
    deadline: match.deadline,
    categories: GAME_CATEGORIES
  });
}
async function finishMatch(io, match, forfeitedPlayerId) {
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
      players: publicPlayers,
      forfeitedPlayerId: forfeitedPlayerId ?? null,
      coinsAwarded: match.mode === "private" ? 0 : void 0
    });
    for (const player of finalPlayers) {
      const socketId = getPlayer(match, player.playerId)?.socketId;
      if (socketId) {
        io.to(socketId).emit("match:wallet", {
          matchId: match.id,
          coinsAwarded: player.coinsAwarded,
          balance: player.walletBalance
        });
      }
    }
    emitRoomUpdate(io, match);
    match.cleanupTimer = setTimeout(() => deleteMatch(match), match.mode === "private" ? 15 * 6e4 : 6e4);
  } catch (error) {
    console.error("[online] Match settlement failed; canceling without rewards:", error);
    await db.update(onlineMatches).set({ status: "cancelled", completedAt: /* @__PURE__ */ new Date() }).where(and3(eq3(onlineMatches.id, match.id), eq3(onlineMatches.status, "active"))).catch((updateError) => {
      console.error("[online] Failed to mark match cancelled:", updateError);
    });
    match.phase = "finished";
    for (const player of match.players) setSocialPlayerInGame(player.id, false);
    releaseMatchPlayers(match);
    io.to(match.id).emit("match:cancelled", { reason: "settlement_failed" });
    emitRoomUpdate(io, match);
    match.cleanupTimer = setTimeout(() => deleteMatch(match), 6e4);
  }
}
async function finishRound(io, match) {
  if (match.phase !== "playing") return;
  if (Date.now() < match.deadline && match.players.every((player) => match.answers.has(player.id))) {
  } else if (Date.now() < match.deadline) {
    return;
  }
  if (match.timer) clearTimeout(match.timer);
  const results = scoreOnlineRound(
    match.players.map((player) => ({
      id: player.id,
      name: player.name,
      answers: match.answers.get(player.id) ?? {}
    })),
    match.letter
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
    results: results.map((result) => ({
      ...result,
      totalScore: getPlayer(match, result.playerId)?.score ?? result.roundTotal
    }))
  });
  match.resultsTimer = setTimeout(() => {
    if (match.round >= match.settings.rounds) {
      void finishMatch(io, match);
    } else {
      beginRound(io, match);
    }
  }, RESULT_DISPLAY_MS);
}
function beginCountdown(io, match) {
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
        match.startedAt = Date.now();
        beginRound(io, match);
      } catch (error) {
        console.error("[online] Could not reserve match players:", error);
        io.to(match.id).emit("match:cancelled", { reason: "active_match_conflict" });
        deleteMatch(match);
      }
    })();
  }, 1e3);
}
function cancelUnreadyMatch(io, match) {
  io.to(match.id).emit("match:cancelled", { reason: "ready_timeout" });
  deleteMatch(match);
}
function startReadyTimeout(io, match) {
  match.readyTimer = setTimeout(() => {
    if (match.phase === "match_found" || match.phase === "waiting") {
      cancelUnreadyMatch(io, match);
    }
  }, READY_TIMEOUT_MS);
}
function makeRoomSnapshot(match) {
  return snapshot(match);
}
function setRoomHost(match) {
  const nextHost = match.players.find((player) => player.socketId !== null) ?? match.players[0];
  if (nextHost) match.hostId = nextHost.id;
}
function markDisconnected(io, playerId, socketId) {
  const match = activeMatchByPlayer.get(playerId);
  if (!match) return;
  const player = getPlayer(match, playerId);
  if (!player || player.socketId !== socketId) return;
  player.socketId = null;
  socketByPlayer.delete(playerId);
  io.to(match.id).emit("match:reconnecting", {
    playerId,
    deadline: Date.now() + RECONNECT_GRACE_MS
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
    void finishMatch(io, match, playerId);
  }, RECONNECT_GRACE_MS);
}
async function createGuestSession(app2) {
  app2.post("/api/online/guest-session", async (req, res) => {
    cleanRateBuckets();
    const address = req.ip || req.socket.remoteAddress || "unknown";
    if (isRateLimited2(`guest:${address}`, 30, 6e4)) {
      return res.status(429).json({ error: "rate_limited" });
    }
    if (req.body && Object.keys(req.body).length > 0) {
      return res.status(400).json({ error: "unexpected_payload" });
    }
    const token = randomBytes2(32).toString("base64url");
    const playerId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    try {
      await db.insert(onlineGuestSessions).values({
        id: playerId,
        tokenHash: hashToken2(token),
        expiresAt
      });
      return res.status(201).json({ token, expiresAt: expiresAt.toISOString() });
    } catch (error) {
      console.error("[online] Guest session creation failed:", error);
      return res.status(503).json({ error: "online_unavailable" });
    }
  });
  app2.get("/api/online/wallet", async (req, res) => {
    const address = req.ip || req.socket.remoteAddress || "unknown";
    if (isRateLimited2(`wallet:${address}`, 60, 6e4)) {
      return res.status(429).json({ error: "rate_limited" });
    }
    const token = req.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{40,128})$/)?.[1];
    if (!token) return res.status(401).json({ error: "unauthorized" });
    try {
      const [session] = await db.select({ id: onlineGuestSessions.id }).from(onlineGuestSessions).where(and3(
        eq3(onlineGuestSessions.tokenHash, hashToken2(token)),
        gte2(onlineGuestSessions.expiresAt, /* @__PURE__ */ new Date())
      )).limit(1);
      if (!session) return res.status(401).json({ error: "unauthorized" });
      const [wallet] = await db.select({ coins: onlineGuestWallets.coins }).from(onlineGuestWallets).where(eq3(onlineGuestWallets.playerId, session.id)).limit(1);
      const claims = await db.select({
        matchId: onlineRewardClaims.matchId,
        amount: onlineRewardClaims.amount
      }).from(onlineRewardClaims).where(eq3(onlineRewardClaims.playerId, session.id)).orderBy(desc2(onlineRewardClaims.createdAt)).limit(100);
      return res.json({
        coins: wallet?.coins ?? 0,
        claims: claims.filter((claim) => claim.amount > 0)
      });
    } catch (error) {
      console.error("[online] Wallet lookup failed:", error);
      return res.status(503).json({ error: "online_unavailable" });
    }
  });
}
async function cancelInterruptedMatches() {
  const interrupted = await db.select({ id: onlineMatches.id }).from(onlineMatches).where(eq3(onlineMatches.status, "active"));
  if (interrupted.length === 0) return;
  await db.transaction(async (tx) => {
    await tx.update(onlineMatches).set({ status: "cancelled", completedAt: /* @__PURE__ */ new Date() }).where(eq3(onlineMatches.status, "active"));
    await tx.update(onlineMatchParticipants).set({ active: false }).where(eq3(onlineMatchParticipants.active, true));
  });
  console.warn(`[online] Cancelled ${interrupted.length} in-memory match(es) left by a server restart; no rewards issued.`);
}
async function registerOnlineMultiplayer(app2, httpServer) {
  await createGuestSession(app2);
  try {
    await cancelInterruptedMatches();
  } catch (error) {
    console.error("[online] Could not clean interrupted matches:", error);
    throw error;
  }
  const configuredOrigins = new Set(
    (process.env.ALLOWED_ORIGIN ?? "").split(",").map((origin) => origin.trim()).filter(Boolean)
  );
  if (process.env.RENDER_EXTERNAL_URL) configuredOrigins.add(new URL(process.env.RENDER_EXTERNAL_URL).origin);
  if (process.env.REPLIT_DEV_DOMAIN) configuredOrigins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  const io = new SocketServer(httpServer, {
    maxHttpBufferSize: MAX_SOCKET_PAYLOAD_BYTES,
    cors: {
      credentials: true,
      origin(origin, callback) {
        const local = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
        const hosted = origin?.endsWith(".replit.app");
        if (!origin || local || hosted || configuredOrigins.has(origin)) {
          callback(null, true);
        } else {
          callback(new Error("origin_not_allowed"), false);
        }
      }
    }
  });
  initializeSocial(io, httpServer);
  const bucketCleanup = setNodeInterval2(cleanRateBuckets, 6e4);
  httpServer.once("close", () => clearNodeInterval2(bucketCleanup));
  io.use((socket, next) => {
    const ip = getClientAddress(socket);
    cleanRateBuckets();
    if (isRateLimited2(`socket-auth:${ip}`, 60, 6e4)) {
      next(new Error("rate_limited"));
      return;
    }
    const auth = z2.object({
      token: z2.string().min(40).max(128),
      displayName: displayNameSchema.optional()
    }).safeParse(socket.handshake.auth);
    if (!auth.success) {
      next(new Error("unauthorized"));
      return;
    }
    void db.select({ id: onlineGuestSessions.id }).from(onlineGuestSessions).where(and3(
      eq3(onlineGuestSessions.tokenHash, hashToken2(auth.data.token)),
      gte2(onlineGuestSessions.expiresAt, /* @__PURE__ */ new Date())
    )).then(([session]) => {
      if (!session) {
        next(new Error("unauthorized"));
        return;
      }
      socket.data.playerId = session.id;
      socket.data.displayName = safeDisplayName(auth.data.displayName);
      next();
    }).catch((error) => {
      console.error("[online] Socket authentication lookup failed:", error);
      next(new Error("online_unavailable"));
    });
  });
  io.on("connection", (rawSocket) => {
    const socket = rawSocket;
    const playerId = socket.data.playerId;
    if (!playerId) {
      socket.disconnect(true);
      return;
    }
    socketByPlayer.set(playerId, socket.id);
    const playerSockets = socketsByPlayer.get(playerId) ?? /* @__PURE__ */ new Set();
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
          roundResults: existingMatch.roundResults.at(-1) ?? null
        });
        if (existingMatch.phase === "finished" && existingMatch.finalResults) {
          const publicPlayers = existingMatch.finalResults.map(({ walletBalance: _walletBalance, ...result }) => result);
          socket.emit("match:finished", {
            matchId: existingMatch.id,
            mode: existingMatch.mode,
            players: publicPlayers
          });
          const ownResult = existingMatch.finalResults.find((result) => result.playerId === playerId);
          if (ownResult) {
            socket.emit("match:wallet", {
              matchId: existingMatch.id,
              coinsAwarded: ownResult.coinsAwarded,
              balance: ownResult.walletBalance
            });
          }
        }
        emitRoomUpdate(io, existingMatch);
      }
    }
    function eventAllowed(event, limit, windowMs) {
      if (!isRateLimited2(`event:${playerId}:${event}`, limit, windowMs)) return true;
      emitError(socket, "rate_limited");
      return false;
    }
    function parsePayload(schema, payload) {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, "invalid_payload");
        return null;
      }
      return parsed.data;
    }
    socket.on("match:find", () => {
      if (!eventAllowed("match:find", 5, 6e4)) return;
      if (activeMatchByPlayer.has(playerId)) {
        emitError(socket, "already_in_match");
        return;
      }
      if (waitingQueue.has(playerId)) {
        socket.emit("match:queued");
        return;
      }
      const entryPlayer = makePlayer(playerId, socket.data.displayName ?? "", socket.id);
      const currentEntry = {
        player: entryPlayer,
        queuedAt: Date.now(),
        timeout: setTimeout(() => {
          removeFromQueue(playerId);
          socket.emit("match:queue-timeout");
        }, 12e4)
      };
      const pairing = waitingQueue.enqueue(playerId, currentEntry);
      if (pairing.status === "duplicate") {
        clearTimeout(currentEntry.timeout);
        socket.emit("match:queued");
        return;
      }
      if (pairing.status === "queued") {
        socket.emit("match:queued");
        return;
      }
      const { opponent: opponentEntry } = pairing;
      const opponentSocket = io.sockets.sockets.get(opponentEntry.player.socketId);
      if (!opponentSocket) {
        clearTimeout(opponentEntry.timeout);
        waitingQueue.enqueue(playerId, currentEntry);
        socket.emit("match:queued");
        return;
      }
      clearTimeout(currentEntry.timeout);
      clearTimeout(opponentEntry.timeout);
      const match = makeMatch("random", opponentEntry.player, emptySettings);
      match.players.push(entryPlayer);
      activeMatchByPlayer.set(playerId, match);
      attachPlayer(io, match, opponentEntry.player, opponentSocket);
      attachPlayer(io, match, entryPlayer, socket);
      startReadyTimeout(io, match);
      io.to(match.id).emit("match:found", snapshot(match));
    });
    socket.on("match:cancel-search", () => {
      if (!eventAllowed("match:cancel-search", 10, 6e4)) return;
      if (removeFromQueue(playerId)) socket.emit("match:search-cancelled");
    });
    socket.on("match:ready", (payload) => {
      if (!eventAllowed("match:ready", 8, 3e4)) return;
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
      if (match.players.length === 2 && match.players.every((item) => item.ready)) {
        beginCountdown(io, match);
      }
    });
    socket.on("room:create", (payload, ack) => {
      if (!eventAllowed("room:create", 3, 6e4)) return;
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
    socket.on("room:join", (payload, ack) => {
      if (!eventAllowed("room:join", 10, 6e4)) return;
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
      const player = makePlayer(playerId, socket.data.displayName ?? "", socket.id);
      match.players.push(player);
      activeMatchByPlayer.set(playerId, match);
      attachPlayer(io, match, player, socket);
      emitRoomUpdate(io, match);
      ack?.({ ok: true, roomCode: code, match: makeRoomSnapshot(match) });
    });
    socket.on("room:update-settings", (payload) => {
      if (!eventAllowed("room:update-settings", 10, 6e4)) return;
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
    socket.on("room:ready", (payload) => {
      if (!eventAllowed("room:ready", 12, 3e4)) return;
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
    socket.on("room:start", (payload) => {
      if (!eventAllowed("room:start", 5, 6e4)) return;
      const data = parsePayload(matchEventSchema, payload);
      if (!data) return;
      const match = matchesById.get(data.matchId);
      if (!match || match.mode !== "private" || match.hostId !== playerId || match.phase !== "waiting") {
        emitError(socket, "host_only");
        return;
      }
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
    socket.on("room:rematch", (payload) => {
      if (!eventAllowed("room:rematch", 3, 6e4)) return;
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
        const playerSocket = playerSocketId ? io.sockets.sockets.get(playerSocketId) : void 0;
        if (playerSocket) playerSocket.join(match.id);
      }
      matchesById.set(match.id, match);
      if (match.roomCode) roomsByCode.set(match.roomCode, match);
      emitRoomUpdate(io, match);
    });
    socket.on("match:submit", (payload) => {
      if (!eventAllowed("match:submit", 10, 6e4)) return;
      const data = parsePayload(submitSchema, payload);
      if (!data) return;
      const match = matchesById.get(data.matchId);
      if (!match || match.phase !== "playing" || !getPlayer(match, playerId)) {
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
      const answers = {};
      for (const category of GAME_CATEGORIES) {
        const answer = data.answers[category];
        if (answer !== void 0) answers[category] = answer.trim();
      }
      match.answers.set(playerId, answers);
      io.to(match.id).emit("match:player-submitted", { playerId });
      if (match.players.every((player) => match.answers.has(player.id))) {
        void finishRound(io, match);
      }
    });
    socket.on("match:forfeit", (payload) => {
      if (!eventAllowed("match:forfeit", 3, 6e4)) return;
      const data = parsePayload(matchEventSchema, payload);
      if (!data) return;
      const match = matchesById.get(data.matchId);
      const player = match && getPlayer(match, playerId);
      if (!match || !player || match.mode !== "random" || !["playing", "results"].includes(match.phase)) {
        emitError(socket, "cannot_forfeit");
        return;
      }
      player.abandoned = true;
      void finishMatch(io, match, playerId);
    });
    socket.on("room:leave", (payload) => {
      if (!eventAllowed("room:leave", 8, 6e4)) return;
      const data = parsePayload(matchEventSchema, payload);
      if (!data) return;
      const match = matchesById.get(data.matchId);
      const player = match && getPlayer(match, playerId);
      if (!match || !player || match.mode !== "private" || match.phase !== "waiting") return;
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
      const playerSockets2 = socketsByPlayer.get(playerId);
      playerSockets2?.delete(socket.id);
      if (playerSockets2?.size === 0) socketsByPlayer.delete(playerId);
      if (socketByPlayer.get(playerId) !== socket.id) return;
      const fallbackSocketId = [...playerSockets2 ?? []].find((socketId) => io.sockets.sockets.get(socketId)?.connected);
      if (fallbackSocketId) {
        socketByPlayer.set(playerId, fallbackSocketId);
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
      if (queued) return;
      markDisconnected(io, playerId, socket.id);
    });
  });
}

// shared/cosmetics.ts
var AVATAR_CATALOG = [
  { id: "student", price: 0, colors: ["#17AFC1", "#83E5DE", "#075D70"] },
  { id: "djellaba", price: 250, colors: ["#E79B47", "#FFE0A6", "#9B4F1F"] },
  { id: "sport", price: 300, colors: ["#F05A8D", "#FFC0D8", "#9A2452"] },
  { id: "amazigh", price: 450, colors: ["#E2B51C", "#FFF0A1", "#735300"] },
  { id: "astronaut", price: 550, colors: ["#6D72E8", "#C9CCFF", "#343A9A"] },
  { id: "ninja", price: 650, colors: ["#7650AA", "#D6C1F4", "#43256B"] },
  { id: "king", price: 900, colors: ["#DE9E16", "#FFE69A", "#805400"] }
];
var COSMETIC_KINDS = ["frame", "background", "nameplate", "victory", "seasonal"];
var DEFAULT_EQUIPPED_COSMETICS = {
  frame: "basic_frame",
  background: "basic_background",
  nameplate: "basic_nameplate",
  victory: "no_victory_effect",
  seasonal: "no_seasonal"
};
var COSMETIC_CATALOG = [
  { id: "basic_frame", kind: "frame", price: 0, colors: ["#17AFC1", "#83E5DE", "#075D70"], icon: "shield-outline" },
  { id: "mosaic_frame", kind: "frame", price: 220, colors: ["#33C5A1", "#B6F3E2", "#12634F"], icon: "shield-outline" },
  { id: "atlas_frame", kind: "frame", price: 360, colors: ["#D8A332", "#FFE6A5", "#805B14"], icon: "shield-outline" },
  { id: "aurora_frame", kind: "frame", price: 480, colors: ["#8B6BEE", "#D7C9FF", "#4C32A0"], icon: "shield-outline" },
  { id: "basic_background", kind: "background", price: 0, colors: ["#253B60", "#8298BD", "#17253E"], icon: "image-outline" },
  { id: "marrakech_bg", kind: "background", price: 280, colors: ["#E88D5B", "#FFD2A8", "#8B3E26"], icon: "image-outline" },
  { id: "atlas_night_bg", kind: "background", price: 420, colors: ["#427AA8", "#A9D9F0", "#1D3858"], icon: "image-outline" },
  { id: "zellige_bg", kind: "background", price: 500, colors: ["#36A99A", "#B3EEE4", "#1D5A54"], icon: "image-outline" },
  { id: "basic_nameplate", kind: "nameplate", price: 0, colors: ["#586A8A", "#C0CAE0", "#293852"], icon: "text-outline" },
  { id: "calligraphy_plate", kind: "nameplate", price: 180, colors: ["#8B6BEE", "#D7C9FF", "#4C32A0"], icon: "text-outline" },
  { id: "gold_plate", kind: "nameplate", price: 320, colors: ["#D8A332", "#FFE6A5", "#805B14"], icon: "text-outline" },
  { id: "emerald_plate", kind: "nameplate", price: 390, colors: ["#33C5A1", "#B6F3E2", "#12634F"], icon: "text-outline" },
  { id: "no_victory_effect", kind: "victory", price: 0, colors: ["#64748B", "#CBD5E1", "#334155"], icon: "sparkles-outline" },
  { id: "starlight", kind: "victory", price: 260, colors: ["#8B6BEE", "#D7C9FF", "#4C32A0"], icon: "sparkles-outline" },
  { id: "confetti", kind: "victory", price: 380, colors: ["#E88D5B", "#FFD2A8", "#8B3E26"], icon: "sparkles-outline" },
  { id: "golden_burst", kind: "victory", price: 520, colors: ["#D8A332", "#FFE6A5", "#805B14"], icon: "sparkles-outline" },
  { id: "no_seasonal", kind: "seasonal", price: 0, colors: ["#64748B", "#CBD5E1", "#334155"], icon: "sunny-outline" },
  { id: "ramadan_lantern", kind: "seasonal", price: 300, colors: ["#D8A332", "#FFE6A5", "#805B14"], icon: "sunny-outline" },
  { id: "eid_mosaic", kind: "seasonal", price: 350, colors: ["#33C5A1", "#B6F3E2", "#12634F"], icon: "sunny-outline" },
  { id: "atlas_winter", kind: "seasonal", price: 440, colors: ["#427AA8", "#A9D9F0", "#1D3858"], icon: "sunny-outline" }
];

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
  { key: "score_500", titleAr: "\u0627\u0643\u0633\u0628 500 \u0646\u0642\u0637\u0629", descAr: "\u062D\u0635\u0651\u0644 500 \u0646\u0642\u0637\u0629 \u0641\u064A \u0645\u0628\u0627\u0631\u064A\u0627\u062A\u0643", icon: "\u2B50", target: 500, type: "score", rewardCoins: 80, rewardXp: 60 }
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
    const existing = await db.select({ id: playerProfiles.id }).from(playerProfiles).where(eq4(playerProfiles.playerCode, code));
    if (existing.length === 0) break;
    code = generatePlayerCode();
    attempts++;
  }
  return code;
}
async function generateUniqueReferralCode() {
  let code = "WM-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  for (let attempt = 0; attempt < 10; attempt++) {
    const dup = await db.select({ id: playerProfiles.id }).from(playerProfiles).where(eq4(playerProfiles.referralCode, code));
    if (dup.length === 0) break;
    code = "WM-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  return code;
}
async function ensureReferralCode(playerId) {
  const [existing] = await db.select({ referralCode: playerProfiles.referralCode }).from(playerProfiles).where(eq4(playerProfiles.id, playerId));
  if (existing?.referralCode) return existing.referralCode;
  const code = await generateUniqueReferralCode();
  await db.update(playerProfiles).set({ referralCode: code }).where(eq4(playerProfiles.id, playerId));
  return code;
}
async function generateUniquePlayerTag() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const tag = Math.floor(1e3 + Math.random() * 9e3);
    const existing = await db.select({ id: playerProfiles.id }).from(playerProfiles).where(eq4(playerProfiles.playerTag, tag)).limit(1);
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
    const missing = await db.select({ id: playerProfiles.id }).from(playerProfiles).where(sql5`player_code IS NULL OR player_tag IS NULL`);
    if (missing.length === 0) return;
    console.log(`[fix] Assigning playerCode/playerTag to ${missing.length} players...`);
    for (const { id } of missing) {
      const updates = {};
      updates.playerCode = await ensurePlayerCode(id);
      updates.playerTag = await generateUniquePlayerTag();
      await db.update(playerProfiles).set(updates).where(eq4(playerProfiles.id, id));
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
async function seedCurrentSeason() {
  try {
    const existing = await db.select().from(seasons).where(eq4(seasons.status, "active")).limit(1);
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
var BP_XP_PER_TIER = 500;
var BP_PREMIUM_COST = 900;
var BP_XP_GAME = 10;
var BP_IAP_PRODUCT_ID = "battle_pass_premium_s1";
var BP_IAP_BASE_PRICE = { amount: 1.99, currency: "EUR", display: "\u20AC1.99" };
var BP_IAP_ENABLED = !!process.env.REVENUECAT_SECRET_API_KEY;
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
    const existing = await db.select({ id: battlePassTiers.id }).from(battlePassTiers).where(eq4(battlePassTiers.seasonId, seasonId));
    if (existing.length >= 30) return;
    if (existing.length > 0 && existing.length < 30) {
      console.warn(`[battle-pass] Partial seed detected for season ${seasonId} (${existing.length}/30). Wiping & re-seeding.`);
      await db.delete(battlePassTiers).where(eq4(battlePassTiers.seasonId, seasonId));
    }
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
  const [pass] = await db.select().from(playerBattlePass).where(and4(eq4(playerBattlePass.playerId, playerId), eq4(playerBattlePass.seasonId, seasonId))).limit(1);
  return pass;
}
async function awardBattlePassXp(playerId, xpAmount) {
  try {
    const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq4(seasons.status, "active")).limit(1);
    if (!activeSeason) return;
    await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
    await db.update(playerBattlePass).set({
      passXp: sql5`pass_xp + ${xpAmount}`,
      currentTier: sql5`LEAST(30, FLOOR((pass_xp + ${xpAmount}) / ${BP_XP_PER_TIER})::int)`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and4(eq4(playerBattlePass.playerId, playerId), eq4(playerBattlePass.seasonId, activeSeason.id)));
  } catch (e) {
    console.error("[battle-pass] awardBattlePassXp error:", e);
  }
}
async function handleClanWarWeeklyEnd() {
  try {
    const allClans = await db.select().from(clans).orderBy(desc3(clans.totalWarScore));
    if (allClans.length === 0) return;
    const rewardsByRank = { 1: 300, 2: 150, 3: 75 };
    for (let i = 0; i < allClans.length; i++) {
      const clan = allClans[i];
      const rank = i + 1;
      const rewardPerMember = rewardsByRank[rank] ?? 0;
      const members = await db.select({ playerId: clanMembers.playerId }).from(clanMembers).where(eq4(clanMembers.clanId, clan.id));
      if (rewardPerMember > 0) {
        for (const m of members) {
          const [prof] = await db.select({ coins: playerProfiles.coins }).from(playerProfiles).where(eq4(playerProfiles.id, m.playerId)).limit(1);
          if (prof) {
            await db.update(playerProfiles).set({ coins: prof.coins + rewardPerMember, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(playerProfiles.id, m.playerId));
          }
        }
      }
      await db.update(clanMembers).set({ warScore: 0 }).where(eq4(clanMembers.clanId, clan.id));
      await db.update(clans).set({ totalWarScore: 0 }).where(eq4(clans.id, clan.id));
    }
    console.log(`[clan-war] Weekly rewards distributed to top ${Math.min(allClans.length, 3)} clans`);
  } catch (e) {
    console.error("[clan-war] handleClanWarWeeklyEnd error:", e);
  }
}
async function registerRoutes(app2) {
  const httpServer = createServer(app2);
  await registerOnlineMultiplayer(app2, httpServer);
  registerSocialRoutes(app2);
  seedTaskAndAchievementDefs();
  fixMissingPlayerCodes();
  await seedCurrentSeason().catch(console.error);
  (async () => {
    try {
      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq4(seasons.status, "active")).limit(1);
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
  function getTodayDateString() {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  async function getOrCreateTodayChallenge() {
    const today = getTodayDateString();
    const existing = await db.select().from(dailyChallenges).where(eq4(dailyChallenges.date, today)).limit(1);
    if (existing.length > 0) return existing[0];
    const letter = ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)];
    const allCategories = ["animals", "fruits", "vegetables", "cities", "countries", "objects", "boy_names", "girl_names"];
    const candidateWords = [];
    for (const category of allCategories) {
      candidateWords.push(...getWordsForLetter(category, letter));
    }
    const filtered = candidateWords.filter((word2) => word2.length >= 3 && word2.length <= 7);
    const pool2 = filtered.length > 0 ? filtered : candidateWords;
    if (pool2.length === 0) {
      throw new Error(`No daily challenge words available for ${letter}`);
    }
    const word = pool2[Math.floor(Math.random() * pool2.length)];
    await db.insert(dailyChallenges).values({ date: today, word, letter }).onConflictDoNothing();
    const fresh = await db.select().from(dailyChallenges).where(eq4(dailyChallenges.date, today)).limit(1);
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
      const foundIdx = targetChars.findIndex((character, idx) => !used[idx] && character === guessChars[i]);
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
        const rows = await db.select().from(dailyChallengeEntries).where(and4(eq4(dailyChallengeEntries.playerId, playerId), eq4(dailyChallengeEntries.date, challenge.date))).limit(1);
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
      let entryRows = await db.select().from(dailyChallengeEntries).where(and4(eq4(dailyChallengeEntries.playerId, playerId), eq4(dailyChallengeEntries.date, today))).limit(1);
      let isNew = false;
      if (entryRows.length === 0) {
        await db.insert(dailyChallengeEntries).values({ playerId, date: today });
        entryRows = await db.select().from(dailyChallengeEntries).where(and4(eq4(dailyChallengeEntries.playerId, playerId), eq4(dailyChallengeEntries.date, today))).limit(1);
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
      }).where(and4(eq4(dailyChallengeEntries.playerId, playerId), eq4(dailyChallengeEntries.date, today)));
      let coinsAwarded = 0;
      if (completed) {
        if (won) {
          coinsAwarded = Math.max(10, 60 - (newGuesses.length - 1) * 10);
          await db.update(playerProfiles).set({ coins: sql5`coins + ${coinsAwarded}`, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(playerProfiles.id, playerId));
        }
        const allEntries = await db.select({ guessCount: dailyChallengeEntries.guessCount, durationSeconds: dailyChallengeEntries.durationSeconds, won: dailyChallengeEntries.won }).from(dailyChallengeEntries).where(and4(eq4(dailyChallengeEntries.date, today), eq4(dailyChallengeEntries.completed, true)));
        const sorted = allEntries.filter((e) => e.won).sort((a, b) => a.guessCount - b.guessCount || a.durationSeconds - b.durationSeconds);
        const rank = won ? sorted.findIndex((e) => e.guessCount === newGuesses.length && e.durationSeconds === durationSeconds) + 1 : null;
        if (rank) {
          await db.update(dailyChallengeEntries).set({ rank }).where(and4(eq4(dailyChallengeEntries.playerId, playerId), eq4(dailyChallengeEntries.date, today)));
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
      }).from(dailyChallengeEntries).innerJoin(playerProfiles, eq4(dailyChallengeEntries.playerId, playerProfiles.id)).where(and4(eq4(dailyChallengeEntries.date, today), eq4(dailyChallengeEntries.completed, true), eq4(dailyChallengeEntries.won, true))).orderBy(asc(dailyChallengeEntries.guessCount), asc(dailyChallengeEntries.durationSeconds)).limit(20);
      res.json(rows.map((r, idx) => ({ ...r, displayRank: idx + 1 })));
    } catch (e) {
      console.error("[daily-challenge] leaderboard error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
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
    return LOGIN_STREAK_REWARDS[day] ?? 15;
  }
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
      let [profile] = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, req.params.id));
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
          [profile] = await db.update(playerProfiles).set(updates).where(eq4(playerProfiles.id, req.params.id)).returning();
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
      const [existing] = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, id));
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
          equippedCosmetics: DEFAULT_EQUIPPED_COSMETICS,
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
      if (data.equippedCosmetics && typeof data.equippedCosmetics === "object") {
        const equipped = { ...existing.equippedCosmetics };
        const owned = existing.ownedCosmetics ?? {};
        for (const kind of COSMETIC_KINDS) {
          const itemId = data.equippedCosmetics[kind];
          if (typeof itemId === "string" && (owned[kind] ?? []).includes(itemId)) {
            equipped[kind] = itemId;
          }
        }
        updateData.equippedCosmetics = equipped;
      }
      const [updated] = await db.update(playerProfiles).set(updateData).where(eq4(playerProfiles.id, id)).returning();
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
      if (!itemType || !itemId || !Number.isSafeInteger(price) || price < 0) {
        return res.status(400).json({ error: "invalid_params" });
      }
      const avatarProduct = itemType === "skin" ? AVATAR_CATALOG.find((item) => item.id === itemId) : void 0;
      const cosmeticProduct = itemType === "cosmetic" ? COSMETIC_CATALOG.find((item) => item.id === itemId) : void 0;
      if (itemType === "skin" && (!avatarProduct || price !== avatarProduct.price) || itemType === "cosmetic" && (!cosmeticProduct || price !== cosmeticProduct.price) || !["skin", "title", "cosmetic"].includes(itemType)) {
        return res.status(400).json({ error: "invalid_item" });
      }
      if (itemType === "cosmetic" && cosmeticProduct) {
        const result = await db.transaction(async (tx) => {
          const [profile2] = await tx.select().from(playerProfiles).where(eq4(playerProfiles.id, id)).for("update");
          if (!profile2) return { status: 404, error: "player_not_found" };
          if (profile2.coins < price) return { status: 402, error: "insufficient_coins" };
          const owned = profile2.ownedCosmetics ?? {};
          const ownedInKind = owned[cosmeticProduct.kind] ?? [];
          if (ownedInKind.includes(itemId)) {
            return { status: 200, profile: profile2, alreadyOwned: true };
          }
          const updatedOwned = {
            ...owned,
            [cosmeticProduct.kind]: [...ownedInKind, itemId]
          };
          const [updated2] = await tx.update(playerProfiles).set({
            coins: profile2.coins - price,
            ownedCosmetics: updatedOwned,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq4(playerProfiles.id, id)).returning();
          return { status: 200, profile: updated2 };
        });
        if (result.status !== 200) return res.status(result.status).json({ error: result.error });
        return res.json({ profile: result.profile, alreadyOwned: result.alreadyOwned ?? false });
      }
      const [profile] = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, id));
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
      const [updated] = await db.update(playerProfiles).set(updates).where(eq4(playerProfiles.id, id)).returning();
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
      const [updated] = await db.update(playerProfiles).set({ name: trimmed, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(playerProfiles.id, player_id)).returning();
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
      let [profile] = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, id));
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
      const [updated] = await db.update(playerProfiles).set(updates).where(eq4(playerProfiles.id, id)).returning();
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
      const [profile] = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, req.params.id));
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
      const { won } = req.body;
      const score = Number(req.body.score) || 0;
      const coinsEarned = Number(req.body.coinsEarned) || 0;
      const xpEarned = Number(req.body.xpEarned) || 0;
      let [profile] = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, id));
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
      const isVip = profile.isVip && (!profile.vipExpiresAt || new Date(profile.vipExpiresAt) > /* @__PURE__ */ new Date());
      const vipMultiplier = isVip ? 2 : 1;
      const totalCoins = (coinsEarned + streakBonus) * vipMultiplier;
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
      }).where(eq4(playerProfiles.id, id)).returning();
      res.json({ profile: updated, streakBonus });
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
      }).where(eq4(playerProfiles.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "player_not_found" });
      res.json({ success: true, profile: updated });
    } catch (e) {
      console.error("POST /api/player/:id/activate-vip error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/player/:id/vip-status", async (req, res) => {
    try {
      const [profile] = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, req.params.id));
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
  app2.get("/api/spin-rewards", (_req, res) => {
    res.json(SPIN_REWARDS.map((r) => ({ type: r.type, amount: r.amount, label: r.label })));
  });
  app2.get("/api/clans/leaderboard", async (_req, res) => {
    try {
      const top = await db.select().from(clans).orderBy(desc3(clans.totalWarScore)).limit(10);
      const result = await Promise.all(top.map(async (c, idx) => {
        const memberCount = await db.select({ count: sql5`count(*)` }).from(clanMembers).where(eq4(clanMembers.clanId, c.id));
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
      const results = await db.select().from(clans).where(ilike2(clans.name, `%${q}%`)).limit(20);
      const withCounts = await Promise.all(results.map(async (c) => {
        const memberCount = await db.select({ count: sql5`count(*)` }).from(clanMembers).where(eq4(clanMembers.clanId, c.id));
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
      const [clan] = await db.select().from(clans).where(eq4(clans.id, id)).limit(1);
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
      }).from(clanMembers).innerJoin(playerProfiles, eq4(clanMembers.playerId, playerProfiles.id)).where(eq4(clanMembers.clanId, id)).orderBy(desc3(clanMembers.warScore));
      const leaderboardRank = await db.select({ count: sql5`count(*)` }).from(clans).where(sql5`total_war_score > ${clan.totalWarScore}`);
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
      const [player] = await db.select({ coins: playerProfiles.coins, clanId: playerProfiles.clanId }).from(playerProfiles).where(eq4(playerProfiles.id, playerId)).limit(1);
      if (!player) return res.status(404).json({ error: "player_not_found" });
      if (player.clanId) return res.status(400).json({ error: "already_in_clan" });
      if (player.coins < 500) return res.status(400).json({ error: "insufficient_coins" });
      const [existing] = await db.select({ id: clans.id }).from(clans).where(ilike2(clans.name, name.trim())).limit(1);
      if (existing) return res.status(400).json({ error: "name_taken" });
      const result = await db.transaction(async (tx) => {
        const [newClan] = await tx.insert(clans).values({ name: name.trim(), emoji, leaderId: playerId }).returning();
        await tx.insert(clanMembers).values({ clanId: newClan.id, playerId, role: "leader", warScore: 0 });
        await tx.update(playerProfiles).set({ coins: player.coins - 500, clanId: newClan.id, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(playerProfiles.id, playerId));
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
      const [clan] = await db.select().from(clans).where(eq4(clans.id, id)).limit(1);
      if (!clan) return res.status(404).json({ error: "not_found" });
      const [player] = await db.select({ clanId: playerProfiles.clanId }).from(playerProfiles).where(eq4(playerProfiles.id, playerId)).limit(1);
      if (!player) return res.status(404).json({ error: "player_not_found" });
      if (player.clanId) return res.status(400).json({ error: "already_in_clan" });
      const memberCount = await db.select({ count: sql5`count(*)` }).from(clanMembers).where(eq4(clanMembers.clanId, id));
      if (Number(memberCount[0]?.count ?? 0) >= 20) return res.status(400).json({ error: "clan_full" });
      await db.transaction(async (tx) => {
        await tx.insert(clanMembers).values({ clanId: id, playerId, role: "member", warScore: 0 });
        await tx.update(playerProfiles).set({ clanId: id, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(playerProfiles.id, playerId));
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
      const [clan] = await db.select().from(clans).where(eq4(clans.id, id)).limit(1);
      if (!clan) return res.status(404).json({ error: "not_found" });
      const [membership] = await db.select({ id: clanMembers.id }).from(clanMembers).where(and4(eq4(clanMembers.clanId, id), eq4(clanMembers.playerId, playerId))).limit(1);
      if (!membership) return res.status(400).json({ error: "not_a_member" });
      await db.transaction(async (tx) => {
        await tx.delete(clanMembers).where(and4(eq4(clanMembers.clanId, id), eq4(clanMembers.playerId, playerId)));
        await tx.update(playerProfiles).set({ clanId: null, updatedAt: /* @__PURE__ */ new Date() }).where(and4(eq4(playerProfiles.id, playerId), eq4(playerProfiles.clanId, id)));
        const remaining = await tx.select({ warScore: clanMembers.warScore }).from(clanMembers).where(eq4(clanMembers.clanId, id));
        const total = remaining.reduce((sum, m) => sum + (m.warScore ?? 0), 0);
        await tx.update(clans).set({ totalWarScore: total }).where(eq4(clans.id, id));
        if (clan.leaderId === playerId) {
          const others = await tx.select().from(clanMembers).where(eq4(clanMembers.clanId, id)).orderBy(desc3(clanMembers.warScore)).limit(1);
          if (others.length > 0) {
            await tx.update(clans).set({ leaderId: others[0].playerId }).where(eq4(clans.id, id));
            await tx.update(clanMembers).set({ role: "leader" }).where(and4(eq4(clanMembers.clanId, id), eq4(clanMembers.playerId, others[0].playerId)));
          } else {
            await tx.delete(clans).where(eq4(clans.id, id));
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
      const [clan] = await db.select().from(clans).where(eq4(clans.id, id)).limit(1);
      if (!clan) return res.status(404).json({ error: "not_found" });
      if (clan.leaderId !== leaderId) return res.status(403).json({ error: "not_leader" });
      if (targetPlayerId === leaderId) return res.status(400).json({ error: "cannot_kick_self" });
      const [targetMembership] = await db.select({ id: clanMembers.id }).from(clanMembers).where(and4(eq4(clanMembers.clanId, id), eq4(clanMembers.playerId, targetPlayerId))).limit(1);
      if (!targetMembership) return res.status(400).json({ error: "not_a_member" });
      await db.transaction(async (tx) => {
        await tx.delete(clanMembers).where(and4(eq4(clanMembers.clanId, id), eq4(clanMembers.playerId, targetPlayerId)));
        await tx.update(playerProfiles).set({ clanId: null, updatedAt: /* @__PURE__ */ new Date() }).where(and4(eq4(playerProfiles.id, targetPlayerId), eq4(playerProfiles.clanId, id)));
        const remaining = await tx.select({ warScore: clanMembers.warScore }).from(clanMembers).where(eq4(clanMembers.clanId, id));
        const total = remaining.reduce((sum, m) => sum + (m.warScore ?? 0), 0);
        await tx.update(clans).set({ totalWarScore: total }).where(eq4(clans.id, id));
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
      const [clan] = await db.select().from(clans).where(eq4(clans.id, id)).limit(1);
      if (!clan) return res.status(404).json({ error: "not_found" });
      if (clan.leaderId !== leaderId) return res.status(403).json({ error: "not_leader" });
      const trimmed = name.trim();
      const [existing] = await db.select({ id: clans.id }).from(clans).where(and4(ilike2(clans.name, trimmed), sql5`${clans.id} != ${id}`)).limit(1);
      if (existing) return res.status(400).json({ error: "name_taken" });
      await db.update(clans).set({ name: trimmed }).where(eq4(clans.id, id));
      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/clans/:id/rename error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.get("/api/battle-pass/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const [activeSeason] = await db.select().from(seasons).where(eq4(seasons.status, "active")).limit(1);
      if (!activeSeason) return res.status(404).json({ error: "no_active_season" });
      const pass = await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
      const tiers = await db.select().from(battlePassTiers).where(eq4(battlePassTiers.seasonId, activeSeason.id)).orderBy(asc(battlePassTiers.tier));
      res.json({
        season: { id: activeSeason.id, name: activeSeason.name, endDate: activeSeason.endDate },
        passXp: pass.passXp,
        currentTier: pass.currentTier,
        premiumUnlocked: pass.premiumUnlocked,
        claimedTiers: Array.isArray(pass.claimedTiers) ? pass.claimedTiers : [],
        xpPerTier: BP_XP_PER_TIER,
        premiumCost: BP_PREMIUM_COST,
        // Real-money IAP info
        iap: {
          enabled: BP_IAP_ENABLED,
          productId: BP_IAP_PRODUCT_ID,
          price: BP_IAP_BASE_PRICE
        },
        tiers
      });
    } catch (e) {
      console.error("GET /api/battle-pass/:playerId error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/battle-pass/:playerId/unlock-premium-iap", async (req, res) => {
    try {
      if (!BP_IAP_ENABLED) {
        return res.status(503).json({ error: "iap_not_configured", message: "Real-money premium is not yet available." });
      }
      const { playerId } = req.params;
      if (!playerId) return res.status(400).json({ error: "missing_player_id" });
      const rcRes = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(playerId)}`, {
        headers: { Authorization: `Bearer ${process.env.REVENUECAT_SECRET_API_KEY}` }
      });
      if (!rcRes.ok) {
        console.error("[battle-pass IAP] RevenueCat verify failed:", rcRes.status);
        return res.status(502).json({ error: "verify_failed" });
      }
      const rcData = await rcRes.json();
      const ent = rcData.subscriber?.entitlements?.battle_pass_premium;
      if (!ent) return res.status(403).json({ error: "entitlement_missing" });
      if (ent.expires_date !== null && ent.expires_date !== void 0) {
        const expiresMs = Date.parse(ent.expires_date);
        if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
          return res.status(403).json({ error: "entitlement_expired" });
        }
      }
      const prodId = ent.product_identifier;
      const productMatches = !!prodId && (prodId === BP_IAP_PRODUCT_ID || prodId.startsWith(`${BP_IAP_PRODUCT_ID}:`));
      if (!productMatches) {
        console.warn("[battle-pass IAP] product mismatch / missing:", prodId, "expected", BP_IAP_PRODUCT_ID);
        return res.status(403).json({ error: "product_mismatch" });
      }
      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq4(seasons.status, "active")).limit(1);
      if (!activeSeason) return res.status(404).json({ error: "no_active_season" });
      await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
      await db.update(playerBattlePass).set({ premiumUnlocked: true, updatedAt: /* @__PURE__ */ new Date() }).where(and4(eq4(playerBattlePass.playerId, playerId), eq4(playerBattlePass.seasonId, activeSeason.id)));
      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/battle-pass/:playerId/unlock-premium-iap error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/admin/dev-bp-unlock/:playerId", async (req, res) => {
    const { playerId } = req.params;
    try {
      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq4(seasons.status, "active")).limit(1);
      if (!activeSeason) return res.status(404).json({ error: "no_active_season" });
      await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
      await db.update(playerBattlePass).set({ premiumUnlocked: true }).where(and4(eq4(playerBattlePass.playerId, playerId), eq4(playerBattlePass.seasonId, activeSeason.id)));
      return res.json({ ok: true, playerId, seasonId: activeSeason.id });
    } catch (e) {
      console.error("/api/admin/dev-bp-unlock error:", e);
      return res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/battle-pass/:playerId/buy-premium", async (req, res) => {
    try {
      const { playerId } = req.params;
      if (!playerId) return res.status(400).json({ error: "missing_player_id" });
      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq4(seasons.status, "active")).limit(1);
      if (!activeSeason) return res.status(404).json({ error: "no_active_season" });
      const [player] = await db.select({ coins: playerProfiles.coins }).from(playerProfiles).where(eq4(playerProfiles.id, playerId)).limit(1);
      if (!player) return res.status(404).json({ error: "player_not_found" });
      const [existingPass] = await db.select({ premiumUnlocked: playerBattlePass.premiumUnlocked }).from(playerBattlePass).where(and4(eq4(playerBattlePass.playerId, playerId), eq4(playerBattlePass.seasonId, activeSeason.id))).limit(1);
      if (existingPass?.premiumUnlocked) {
        return res.json({ ok: true, newCoins: player.coins ?? 0 });
      }
      if ((player.coins ?? 0) < BP_PREMIUM_COST) {
        return res.status(402).json({ error: "insufficient_coins", required: BP_PREMIUM_COST, current: player.coins ?? 0 });
      }
      const deductResult = await db.update(playerProfiles).set({ coins: sql5`coins - ${BP_PREMIUM_COST}`, updatedAt: /* @__PURE__ */ new Date() }).where(and4(eq4(playerProfiles.id, playerId), sql5`coins >= ${BP_PREMIUM_COST}`)).returning({ newCoins: playerProfiles.coins });
      if (deductResult.length === 0) {
        return res.status(402).json({ error: "insufficient_coins", required: BP_PREMIUM_COST, current: player.coins ?? 0 });
      }
      await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
      await db.update(playerBattlePass).set({ premiumUnlocked: true, updatedAt: /* @__PURE__ */ new Date() }).where(and4(eq4(playerBattlePass.playerId, playerId), eq4(playerBattlePass.seasonId, activeSeason.id)));
      res.json({ ok: true, newCoins: deductResult[0].newCoins ?? 0 });
    } catch (e) {
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
      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq4(seasons.status, "active")).limit(1);
      if (!activeSeason) return res.status(404).json({ error: "no_active_season" });
      await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
      const [tierDef] = await db.select().from(battlePassTiers).where(and4(eq4(battlePassTiers.seasonId, activeSeason.id), eq4(battlePassTiers.tier, tierNum))).limit(1);
      if (!tierDef) return res.status(404).json({ error: "tier_not_found" });
      const rewardType = track === "free" ? tierDef.freeRewardType : tierDef.premiumRewardType;
      const rewardId = track === "free" ? tierDef.freeRewardId : tierDef.premiumRewardId;
      const rewardAmt = track === "free" ? tierDef.freeRewardAmount : tierDef.premiumRewardAmount;
      const claimedKey = `${tierNum}_${track}`;
      let resultNewCoins = 0;
      const grantedLabel = [];
      await db.transaction(async (tx) => {
        const [pass] = await tx.select().from(playerBattlePass).where(and4(eq4(playerBattlePass.playerId, playerId), eq4(playerBattlePass.seasonId, activeSeason.id))).limit(1);
        if (!pass) throw Object.assign(new Error("pass_not_found"), { statusCode: 404 });
        if (pass.currentTier < tierNum) throw Object.assign(new Error("tier_not_reached"), { statusCode: 400 });
        if (track === "premium" && !pass.premiumUnlocked) throw Object.assign(new Error("premium_not_unlocked"), { statusCode: 403 });
        const claimedArr = Array.isArray(pass.claimedTiers) ? pass.claimedTiers : [];
        if (claimedArr.includes(claimedKey)) throw Object.assign(new Error("already_claimed"), { statusCode: 400 });
        const [profile] = await tx.select().from(playerProfiles).where(eq4(playerProfiles.id, playerId)).limit(1);
        if (!profile) throw Object.assign(new Error("player_not_found"), { statusCode: 404 });
        resultNewCoins = profile.coins;
        if (rewardType === "coins") {
          const [updProf] = await tx.update(playerProfiles).set({ coins: sql5`coins + ${rewardAmt}`, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(playerProfiles.id, playerId)).returning({ coins: playerProfiles.coins });
          resultNewCoins = updProf?.coins ?? profile.coins + rewardAmt;
          grantedLabel.push(`\u{1FA99} +${rewardAmt}`);
        } else if (rewardType === "powerCard" && rewardId) {
          const pc = profile.powerCards ?? { time: 0, freeze: 0, hint: 0 };
          const newPc = { ...pc, [rewardId]: (pc[rewardId] ?? 0) + rewardAmt };
          await tx.update(playerProfiles).set({ powerCards: newPc, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(playerProfiles.id, playerId));
          grantedLabel.push(`\u{1F0CF} +${rewardAmt} ${rewardId}`);
        } else if (rewardType === "skin" && rewardId) {
          const owned = Array.isArray(profile.ownedSkins) ? profile.ownedSkins : [];
          if (!owned.includes(rewardId)) {
            await tx.update(playerProfiles).set({ ownedSkins: [...owned, rewardId], updatedAt: /* @__PURE__ */ new Date() }).where(eq4(playerProfiles.id, playerId));
            grantedLabel.push(`\u{1F457} ${rewardId}`);
          }
        } else if (rewardType === "title" && rewardId) {
          const owned = Array.isArray(profile.ownedTitles) ? profile.ownedTitles : [];
          if (!owned.includes(rewardId)) {
            await tx.update(playerProfiles).set({ ownedTitles: [...owned, rewardId], updatedAt: /* @__PURE__ */ new Date() }).where(eq4(playerProfiles.id, playerId));
            grantedLabel.push(`\u{1F451} ${rewardId}`);
          }
        }
        const updateResult = await tx.update(playerBattlePass).set({
          claimedTiers: sql5`claimed_tiers || ${JSON.stringify([claimedKey])}::jsonb`,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(and4(
          eq4(playerBattlePass.playerId, playerId),
          eq4(playerBattlePass.seasonId, activeSeason.id),
          sql5`NOT (claimed_tiers @> ${JSON.stringify([claimedKey])}::jsonb)`
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
  app2.post("/api/player/:id/daily-login", async (req, res) => {
    try {
      const { id: playerId } = req.params;
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const yesterday = /* @__PURE__ */ new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      let [profile] = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, playerId));
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
        coins: sql5`coins + ${reward}`,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(
        and4(
          eq4(playerProfiles.id, playerId),
          sql5`${playerProfiles.lastLoginDate} IS DISTINCT FROM ${today}`
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
        coins: updated[0].coins,
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
    const rows = await db.select().from(playerDailyTasks).where(and4(eq4(playerDailyTasks.playerId, playerId), eq4(playerDailyTasks.assignedDate, today)));
    for (const row of rows) {
      if (row.claimed === 1) continue;
      const def = TASK_POOL.find((d) => d.key === row.taskKey);
      if (!def) continue;
      let newProgress = row.progress ?? 0;
      if (def.type === "wins") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.wins - (row.baselineWins ?? 0)), def.target));
      if (def.type === "games") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.gamesPlayed - (row.baselineGames ?? 0)), def.target));
      if (def.type === "score") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.totalScore - (row.baselineScore ?? 0)), def.target));
      if (newProgress !== (row.progress ?? 0)) {
        await db.update(playerDailyTasks).set({ progress: newProgress }).where(eq4(playerDailyTasks.id, row.id));
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
          const result = await db.select({ count: sql5`count(*)` }).from(tournamentPlayers).where(eq4(tournamentPlayers.playerId, playerId));
          tournamentsPlayed = Number(result[0]?.count ?? 0);
        }
        progress = Math.min(tournamentsPlayed, def.target);
      }
      const unlocked = progress >= def.target;
      const [existing] = await db.select().from(playerAchievements).where(and4(eq4(playerAchievements.playerId, playerId), eq4(playerAchievements.achievementKey, def.key)));
      if (existing) {
        if (existing.progress !== progress || existing.unlocked !== (unlocked ? 1 : 0)) {
          await db.update(playerAchievements).set({
            progress,
            unlocked: unlocked ? 1 : 0,
            unlockedAt: unlocked && !existing.unlockedAt ? /* @__PURE__ */ new Date() : existing.unlockedAt
          }).where(eq4(playerAchievements.id, existing.id));
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
      let [profile] = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, playerId));
      if (!profile) {
        const playerCode = await ensurePlayerCode(playerId);
        const randomName = generateRandomPlayerName();
        [profile] = await db.insert(playerProfiles).values({ id: playerId, playerCode, playerTag: await generateUniquePlayerTag(), name: randomName }).returning();
      }
      let todayRows = await db.select().from(playerDailyTasks).where(and4(eq4(playerDailyTasks.playerId, playerId), eq4(playerDailyTasks.assignedDate, today)));
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
        todayRows = await db.select().from(playerDailyTasks).where(and4(eq4(playerDailyTasks.playerId, playerId), eq4(playerDailyTasks.assignedDate, today)));
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
      let [weeklyRow] = await db.select().from(playerDailyTasks).where(and4(eq4(playerDailyTasks.playerId, playerId), eq4(playerDailyTasks.taskKey, weeklyTaskKey)));
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
      const [profile] = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, playerId));
      if (!profile) return res.json({ success: false, error: "player_not_found" });
      const assignedDate = isWeekly ? getWeekId() : today;
      let [row] = await db.select().from(playerDailyTasks).where(and4(
        eq4(playerDailyTasks.playerId, playerId),
        eq4(playerDailyTasks.taskKey, taskKey),
        eq4(playerDailyTasks.assignedDate, assignedDate)
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
      await db.update(playerDailyTasks).set({ claimed: 1, claimedAt: /* @__PURE__ */ new Date(), progress }).where(eq4(playerDailyTasks.id, row.id));
      await db.update(playerProfiles).set({
        coins: sql5`coins + ${def.rewardCoins}`,
        xp: sql5`xp + ${def.rewardXp}`,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(playerProfiles.id, playerId));
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
        const freshProfile = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, playerId));
        if (freshProfile.length > 0) {
          const currentTitles = Array.isArray(freshProfile[0].ownedTitles) ? freshProfile[0].ownedTitles : [];
          if (!currentTitles.includes(titleAwarded)) {
            await db.update(playerProfiles).set({
              ownedTitles: [...currentTitles, titleAwarded],
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq4(playerProfiles.id, playerId));
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
      let [profile] = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, playerId));
      if (!profile) {
        const playerCode = await ensurePlayerCode(playerId);
        const randomName = generateRandomPlayerName();
        [profile] = await db.insert(playerProfiles).values({ id: playerId, playerCode, playerTag: await generateUniquePlayerTag(), name: randomName }).returning();
      }
      const rows = await db.select().from(playerAchievements).where(eq4(playerAchievements.playerId, playerId));
      const tournamentCount = await db.select({ count: sql5`count(*)` }).from(tournamentPlayers).where(eq4(tournamentPlayers.playerId, playerId));
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
    const [profile] = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, playerId));
    if (!profile) return { success: false, error: "player_not_found" };
    const [existing] = await db.select().from(playerAchievements).where(and4(eq4(playerAchievements.playerId, playerId), eq4(playerAchievements.achievementKey, key)));
    if (existing?.claimed === 1) return { success: false, error: "already_claimed" };
    let liveProgress = 0;
    if (def.type === "wins") liveProgress = profile.wins;
    if (def.type === "games") liveProgress = profile.gamesPlayed;
    if (def.type === "level") liveProgress = profile.level;
    if (def.type === "streak") liveProgress = profile.bestStreak;
    if (def.type === "login_streak") liveProgress = profile.longestLoginStreak ?? 0;
    if (def.type === "total_score") liveProgress = profile.totalScore;
    if (def.type === "tournaments") {
      const tc = await db.select({ count: sql5`count(*)` }).from(tournamentPlayers).where(eq4(tournamentPlayers.playerId, playerId));
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
      }).where(eq4(playerAchievements.id, existing.id));
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
      coins: sql5`coins + ${def.rewardCoins}`,
      xp: sql5`xp + ${def.rewardXp}`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(playerProfiles.id, playerId));
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
      const { playerId, taskType } = req.body;
      if (!playerId || !taskType) return res.status(400).json({ error: "missing_fields" });
      const today = getTodayDate();
      const [profile] = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, playerId));
      if (!profile) return res.status(404).json({ error: "player_not_found" });
      const todayRows = await db.select().from(playerDailyTasks).where(and4(eq4(playerDailyTasks.playerId, playerId), eq4(playerDailyTasks.assignedDate, today)));
      const updated = [];
      for (const row of todayRows) {
        const def = TASK_POOL.find((d) => d.key === row.taskKey && d.type === taskType);
        if (!def || row.claimed === 1) continue;
        let newProgress = row.progress ?? 0;
        if (def.type === "wins") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.wins - (row.baselineWins ?? 0)), def.target));
        if (def.type === "games") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.gamesPlayed - (row.baselineGames ?? 0)), def.target));
        if (def.type === "score") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.totalScore - (row.baselineScore ?? 0)), def.target));
        await db.update(playerDailyTasks).set({ progress: newProgress }).where(eq4(playerDailyTasks.id, row.id));
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
      const [profile] = await db.select().from(playerProfiles).where(eq4(playerProfiles.id, playerId));
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
        const [existing] = await db.select().from(playerAchievements).where(and4(eq4(playerAchievements.playerId, playerId), eq4(playerAchievements.achievementKey, def.key)));
        if (existing) {
          if (existing.progress !== progress || existing.unlocked !== (unlocked ? 1 : 0)) {
            await db.update(playerAchievements).set({
              progress,
              unlocked: unlocked ? 1 : 0,
              unlockedAt: unlocked && !existing.unlockedAt ? /* @__PURE__ */ new Date() : existing.unlockedAt
            }).where(eq4(playerAchievements.id, existing.id));
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
  app2.get("/api/referral/:playerId", async (req, res) => {
    try {
      const code = await ensureReferralCode(req.params.playerId);
      const [profile] = await db.select({ referralCount: playerProfiles.referralCount, referredBy: playerProfiles.referredBy, createdAt: playerProfiles.createdAt }).from(playerProfiles).where(eq4(playerProfiles.id, req.params.playerId));
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
      const [player] = await db.select({ referredBy: playerProfiles.referredBy, createdAt: playerProfiles.createdAt }).from(playerProfiles).where(eq4(playerProfiles.id, playerId));
      if (!player) return res.status(404).json({ error: "not_found" });
      if (player.referredBy) return res.json({ error: "already_claimed" });
      const accountAgeHours = (Date.now() - new Date(player.createdAt).getTime()) / (1e3 * 60 * 60);
      if (accountAgeHours > 24) return res.json({ error: "expired" });
      const [referrer] = await db.select({ id: playerProfiles.id, referralCode: playerProfiles.referralCode }).from(playerProfiles).where(eq4(playerProfiles.referralCode, referralCode.toUpperCase()));
      if (!referrer) return res.json({ error: "invalid_code" });
      if (referrer.id === playerId) return res.json({ error: "self_referral" });
      const REFERRAL_REWARD = 100;
      await db.transaction(async (tx) => {
        const result = await tx.update(playerProfiles).set({ referredBy: referralCode.toUpperCase() }).where(and4(eq4(playerProfiles.id, playerId), sql5`referred_by IS NULL`));
        await tx.update(playerProfiles).set({
          referralCount: sql5`referral_count + 1`,
          coins: sql5`coins + ${REFERRAL_REWARD}`
        }).where(eq4(playerProfiles.id, referrer.id));
        await tx.update(playerProfiles).set({ coins: sql5`coins + ${REFERRAL_REWARD}` }).where(eq4(playerProfiles.id, playerId));
      });
      res.json({ success: true, reward: REFERRAL_REWARD });
    } catch (e) {
      console.error("POST /api/referral/claim error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  app2.post("/api/player/:id/push-token", async (req, res) => {
    try {
      const { id } = req.params;
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "missing_token" });
      await db.update(playerProfiles).set({ expoPushToken: token, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(playerProfiles.id, id));
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
      await db.update(playerProfiles).set({ notificationsEnabled: enabled, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(playerProfiles.id, id));
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
      }).from(playerProfiles).where(eq4(playerProfiles.id, id));
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
  cron.schedule("5 0 * * 1", () => {
    console.log("[cron] Clan war weekly payout (Monday 00:05)");
    handleClanWarWeeklyEnd().catch(console.error);
  });
  cron.schedule("55 23 * * *", async () => {
    try {
      const tomorrow = /* @__PURE__ */ new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().slice(0, 10);
      const existing = await db.select({ id: dailyChallenges.id }).from(dailyChallenges).where(eq4(dailyChallenges.date, dateStr)).limit(1);
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
  return httpServer;
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
    if (process.env.RENDER_EXTERNAL_URL) {
      origins.add(new URL(process.env.RENDER_EXTERNAL_URL).origin);
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    const isReplitApp = origin?.endsWith(".replit.app");
    if (origin && (origins.has(origin) || isLocalhost || isReplitApp)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
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
      reusePort: process.platform !== "win32"
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
