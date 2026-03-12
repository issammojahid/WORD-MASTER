import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  name: text("name").notNull().default("لاعب"),
  coins: integer("coins").notNull().default(100),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  equippedSkin: text("equipped_skin").notNull().default("student"),
  ownedSkins: jsonb("owned_skins").$type<string[]>().notNull().default(sql`'["student"]'::jsonb`),
  totalScore: integer("total_score").notNull().default(0),
  gamesPlayed: integer("games_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  winStreak: integer("win_streak").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  lastStreakReward: integer("last_streak_reward").notNull().default(0),
  lastSpinAt: timestamp("last_spin_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

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
