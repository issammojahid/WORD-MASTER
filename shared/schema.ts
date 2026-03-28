import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const playerProfiles = pgTable("player_profiles", {
  id: varchar("id").primaryKey(),
  playerCode: text("player_code").unique(),
  playerTag: integer("player_tag"),
  name: text("name").notNull().default("لاعب"),
  coins: integer("coins").notNull().default(100),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  equippedSkin: text("equipped_skin").notNull().default("student"),
  ownedSkins: jsonb("owned_skins").$type<string[]>().notNull().default(sql`'["student"]'::jsonb`),
  equippedTitle: text("equipped_title").default("beginner"),
  ownedTitles: jsonb("owned_titles").$type<string[]>().notNull().default(sql`'["beginner"]'::jsonb`),
  totalScore: integer("total_score").notNull().default(0),
  gamesPlayed: integer("games_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  winStreak: integer("win_streak").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  lastStreakReward: integer("last_streak_reward").notNull().default(0),
  lastSpinAt: timestamp("last_spin_at"),
  powerCards: jsonb("power_cards").$type<{ time: number; freeze: number; hint: number }>().default(sql`'{"time":3,"freeze":3,"hint":3}'::jsonb`),
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
  // ── Clan Wars ──────────────────────────────────────────────────────────────
  clanId: varchar("clan_id"),
  // ── Ranked Season System ───────────────────────────────────────────────────
  elo: integer("elo").notNull().default(1000),
  division: text("division").notNull().default("silver"),
  peakElo: integer("peak_elo").notNull().default(1000),
  seasonWins: integer("season_wins").notNull().default(0),
  seasonLosses: integer("season_losses").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// ── RANKED SEASONS ──────────────────────────────────────────────────────────
export const seasons = pgTable("seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type Season = typeof seasons.$inferSelect;

export type PlayerProfile = typeof playerProfiles.$inferSelect;
export type InsertPlayerProfile = typeof playerProfiles.$inferInsert;

export const dailySpins = pgTable("daily_spins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  rewardType: text("reward_type").notNull(),
  rewardAmount: integer("reward_amount").notNull(),
  spunAt: timestamp("spun_at").notNull().default(sql`now()`),
});

export type DailySpin = typeof dailySpins.$inferSelect;

export const winStreaks = pgTable("win_streaks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  streakLength: integer("streak_length").notNull(),
  bonusAwarded: integer("bonus_awarded").notNull().default(0),
  milestone: integer("milestone").notNull().default(0),
  awardedAt: timestamp("awarded_at").notNull().default(sql`now()`),
});

export type WinStreak = typeof winStreaks.$inferSelect;

export const tournaments = pgTable("tournaments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").notNull().default("open"),
  entryFee: integer("entry_fee").notNull().default(100),
  prizePool: integer("prize_pool").notNull().default(0),
  maxPlayers: integer("max_players").notNull().default(8),
  winnerId: varchar("winner_id"),
  winnerName: text("winner_name"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export type Tournament = typeof tournaments.$inferSelect;

export const tournamentPlayers = pgTable("tournament_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: varchar("tournament_id").notNull(),
  playerId: varchar("player_id").notNull(),
  playerName: text("player_name").notNull(),
  playerSkin: text("player_skin").notNull().default("student"),
  seed: integer("seed").notNull().default(0),
  eliminated: integer("eliminated").notNull().default(0),
  placement: integer("placement"),
  joinedAt: timestamp("joined_at").notNull().default(sql`now()`),
});

export type TournamentPlayer = typeof tournamentPlayers.$inferSelect;

export const tournamentMatches = pgTable("tournament_matches", {
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
  completedAt: timestamp("completed_at"),
});

// ── FRIENDS SYSTEM ─────────────────────────────────────────────────────────
// Confirmed friendships only (bidirectional — one row per pair)
export const friends = pgTable("friends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  friendId: varchar("friend_id").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type Friend = typeof friends.$inferSelect;

// Friend requests (pending / accepted / declined)
export const friendRequests = pgTable("friend_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull(),
  receiverId: varchar("receiver_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted | declined
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type FriendRequest = typeof friendRequests.$inferSelect;

// ── DAILY TASK DEFINITIONS ─────────────────────────────────────────────────
export const dailyTaskDefs = pgTable("daily_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  titleAr: text("title_ar").notNull(),
  descAr: text("desc_ar").notNull(),
  icon: text("icon").notNull().default("📋"),
  target: integer("target").notNull(),
  type: text("type").notNull(),
  rewardCoins: integer("reward_coins").notNull().default(0),
  rewardXp: integer("reward_xp").notNull().default(0),
});

export type DailyTaskDef = typeof dailyTaskDefs.$inferSelect;

// ── ACHIEVEMENT DEFINITIONS ─────────────────────────────────────────────────
export const achievementDefs = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  titleAr: text("title_ar").notNull(),
  descAr: text("desc_ar").notNull(),
  icon: text("icon").notNull().default("🏆"),
  target: integer("target").notNull(),
  type: text("type").notNull(),
  rewardCoins: integer("reward_coins").notNull().default(0),
  rewardXp: integer("reward_xp").notNull().default(0),
});

export type AchievementDef = typeof achievementDefs.$inferSelect;

// ── DAILY TASKS (player progress) ──────────────────────────────────────────
export const playerDailyTasks = pgTable("player_daily_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  taskKey: text("task_key").notNull(),
  progress: integer("progress").notNull().default(0),
  completed: integer("completed").notNull().default(0),
  claimed: integer("claimed").notNull().default(0),
  assignedDate: text("assigned_date").notNull(), // YYYY-MM-DD
  claimedAt: timestamp("claimed_at"),
  baselineWins: integer("baseline_wins").notNull().default(0),
  baselineGames: integer("baseline_games").notNull().default(0),
  baselineScore: integer("baseline_score").notNull().default(0),
});

export type PlayerDailyTask = typeof playerDailyTasks.$inferSelect;

// ── ACHIEVEMENTS ───────────────────────────────────────────────────────────
export const playerAchievements = pgTable("player_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  achievementKey: text("achievement_key").notNull(),
  progress: integer("progress").notNull().default(0),
  unlocked: integer("unlocked").notNull().default(0),
  claimed: integer("claimed").notNull().default(0),
  unlockedAt: timestamp("unlocked_at"),
  claimedAt: timestamp("claimed_at"),
});

export type PlayerAchievement = typeof playerAchievements.$inferSelect;

// ── ROOM INVITES ────────────────────────────────────────────────────────────
export const roomInvites = pgTable("room_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromPlayerId: varchar("from_player_id").notNull(),
  toPlayerId: varchar("to_player_id").notNull(),
  roomId: varchar("room_id").notNull(),
  fromPlayerName: text("from_player_name").notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted | declined
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type RoomInvite = typeof roomInvites.$inferSelect;

export const coinGifts = pgTable("coin_gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromPlayerId: varchar("from_player_id").notNull(),
  toPlayerId: varchar("to_player_id").notNull(),
  amount: integer("amount").notNull(),
  seen: boolean("seen").notNull().default(false),
  sentAt: timestamp("sent_at").notNull().default(sql`now()`),
});

export type CoinGift = typeof coinGifts.$inferSelect;

// ── CLAN WARS ──────────────────────────────────────────────────────────────
export const clans = pgTable("clans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("⚔️"),
  leaderId: varchar("leader_id").notNull(),
  totalWarScore: integer("total_war_score").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type Clan = typeof clans.$inferSelect;

export const clanMembers = pgTable("clan_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clanId: varchar("clan_id").notNull(),
  playerId: varchar("player_id").notNull(),
  warScore: integer("war_score").notNull().default(0),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").notNull().default(sql`now()`),
}, (t) => ({
  uniqMembership: uniqueIndex("clan_members_clan_player_unique").on(t.clanId, t.playerId),
}));

export type ClanMember = typeof clanMembers.$inferSelect;
