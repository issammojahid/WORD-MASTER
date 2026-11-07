import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, uniqueIndex, index, check } from "drizzle-orm/pg-core";
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
  ownedCosmetics: jsonb("owned_cosmetics").$type<Record<string, string[]>>().notNull().default(sql`'{"frame":["basic_frame"],"background":["basic_background"],"nameplate":["basic_nameplate"],"victory":["no_victory_effect"],"seasonal":["no_seasonal"]}'::jsonb`),
  equippedCosmetics: jsonb("equipped_cosmetics").$type<Record<string, string>>().notNull().default(sql`'{"frame":"basic_frame","background":"basic_background","nameplate":"basic_nameplate","victory":"no_victory_effect","seasonal":"no_seasonal"}'::jsonb`),
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
  // ── Country ────────────────────────────────────────────────────────────────
  country: text("country").default("MA"),
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
},table=>({
  uniquePlayerName:uniqueIndex("player_profiles_name_key_unique").on(sql`lower(btrim(regexp_replace(normalize(${table.name}, NFKC), '[[:space:]]+', ' ', 'g')))`),
}));

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

// ── BATTLE PASS ────────────────────────────────────────────────────────────

export const battlePassTiers = pgTable("battle_pass_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seasonId: varchar("season_id").notNull(),
  tier: integer("tier").notNull(),
  freeRewardType: text("free_reward_type").notNull(), // "coins" | "skin" | "title" | "powerCard"
  freeRewardId: text("free_reward_id"),               // skin/title id, null for coins/powerCard
  freeRewardAmount: integer("free_reward_amount").notNull().default(0),
  premiumRewardType: text("premium_reward_type").notNull(),
  premiumRewardId: text("premium_reward_id"),
  premiumRewardAmount: integer("premium_reward_amount").notNull().default(0),
}, (t) => ({
  uniqSeasonTier: uniqueIndex("battle_pass_tiers_season_tier_unique").on(t.seasonId, t.tier),
}));

export type BattlePassTier = typeof battlePassTiers.$inferSelect;

export const playerBattlePass = pgTable("player_battle_pass", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  seasonId: varchar("season_id").notNull(),
  passXp: integer("pass_xp").notNull().default(0),
  currentTier: integer("current_tier").notNull().default(0),
  premiumUnlocked: boolean("premium_unlocked").notNull().default(false),
  claimedTiers: jsonb("claimed_tiers").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (t) => ({
  uniqPlayerSeason: uniqueIndex("player_battle_pass_player_season_unique").on(t.playerId, t.seasonId),
}));

export type PlayerBattlePass = typeof playerBattlePass.$inferSelect;

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

// ── SPECTATOR BETS ──────────────────────────────────────────────────────────
export const spectatorBets = pgTable("spectator_bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull(),
  spectatorId: varchar("spectator_id").notNull(),
  betOnPlayerId: varchar("bet_on_player_id").notNull(),
  amount: integer("amount").notNull(),
  settled: boolean("settled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type SpectatorBet = typeof spectatorBets.$inferSelect;

// ── DAILY CHALLENGE ──────────────────────────────────────────────────────────
export const dailyChallenges = pgTable("daily_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull().unique(),
  word: text("word").notNull(),
  letter: text("letter").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type DailyChallenge = typeof dailyChallenges.$inferSelect;

export const dailyChallengeEntries = pgTable("daily_challenge_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  date: text("date").notNull(),
  guesses: jsonb("guesses").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  completed: boolean("completed").notNull().default(false),
  won: boolean("won").notNull().default(false),
  guessCount: integer("guess_count").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  startedAt: timestamp("started_at").notNull().default(sql`now()`),
  finishedAt: timestamp("finished_at"),
  rank: integer("rank"),
}, (t) => ({
  uniqPlayerDate: uniqueIndex("daily_challenge_entries_player_date_unique").on(t.playerId, t.date),
}));

export type DailyChallengeEntry = typeof dailyChallengeEntries.$inferSelect;

export const onlineGuestSessions = pgTable("online_guest_sessions", {
  id: varchar("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  expiresAt: timestamp("expires_at").notNull(),
}, (t) => ({
  uniqueTokenHash: uniqueIndex("online_guest_sessions_token_hash_unique").on(t.tokenHash),
}));

export const onlineGuestWallets = pgTable("online_guest_wallets", {
  playerId: varchar("player_id").primaryKey(),
  coins: integer("coins").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const onlineMatches = pgTable("online_matches", {
  id: varchar("id").primaryKey(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  results: jsonb("results"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

export const onlineMatchParticipants = pgTable("online_match_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull(),
  playerId: varchar("player_id").notNull(),
  displayName: text("display_name").notNull(),
  score: integer("score").notNull().default(0),
  active: boolean("active").notNull().default(false),
  abandoned: boolean("abandoned").notNull().default(false),
  finalRank: integer("final_rank"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => ({
  uniqMatchPlayer: uniqueIndex("online_match_participants_match_player_unique").on(t.matchId, t.playerId),
  oneActiveMatchPerPlayer: uniqueIndex("online_one_active_match_per_player")
    .on(t.playerId)
    .where(sql`${t.active} = true`),
  playerMatches: index("online_match_participants_player_idx").on(t.playerId, t.createdAt),
}));

export const onlineRewardClaims = pgTable("online_reward_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull(),
  playerId: varchar("player_id").notNull(),
  rewardType: text("reward_type").notNull(),
  amount: integer("amount").notNull().default(0),
  rewardDate: text("reward_date").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => ({
  uniqMatchPlayerReward: uniqueIndex("online_reward_claims_match_player_type_unique")
    .on(t.matchId, t.playerId, t.rewardType),
}));

export const onlineDailyMatchCounters = pgTable("online_daily_match_counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  rewardDate: text("reward_date").notNull(),
  completedMatches: integer("completed_matches").notNull().default(0),
}, (t) => ({
  uniqPlayerDate: uniqueIndex("online_daily_match_counters_player_date_unique").on(t.playerId, t.rewardDate),
}));

export const onlineMatchFlags = pgTable("online_match_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull(),
  playerId: varchar("player_id").notNull(),
  reason: text("reason").notNull(),
  details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
  reviewed: boolean("reviewed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const socialProfiles = pgTable("social_profiles", {
  playerId: varchar("player_id").primaryKey().references(() => onlineGuestSessions.id),
  displayName: text("display_name").notNull().default("لاعب"),
  allowFriendRequests: boolean("allow_friend_requests").notNull().default(true),
  allowGameInvites: boolean("allow_game_invites").notNull().default(true),
  showPresence: boolean("show_presence").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (t) => ({
  displayNameLength: check("social_profiles_display_name_length", sql`char_length(${t.displayName}) BETWEEN 1 AND 24`),
}));

export const socialFriendRequests = pgTable("social_friend_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => onlineGuestSessions.id),
  receiverId: varchar("receiver_id").notNull().references(() => onlineGuestSessions.id),
  pairLow: varchar("pair_low").notNull().references(() => onlineGuestSessions.id),
  pairHigh: varchar("pair_high").notNull().references(() => onlineGuestSessions.id),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (t) => ({
  pendingPair: uniqueIndex("social_friend_requests_pending_pair_unique")
    .on(t.pairLow, t.pairHigh)
    .where(sql`${t.status} = 'pending'`),
  receiverStatus: index("social_friend_requests_receiver_status_idx").on(t.receiverId, t.status, t.createdAt),
  senderStatus: index("social_friend_requests_sender_status_idx").on(t.senderId, t.status, t.createdAt),
  pairOrder: check("social_friend_requests_pair_order", sql`
    ${t.pairLow} < ${t.pairHigh}
    AND ${t.pairLow} = LEAST(${t.senderId}, ${t.receiverId})
    AND ${t.pairHigh} = GREATEST(${t.senderId}, ${t.receiverId})
  `),
  notSelf: check("social_friend_requests_not_self", sql`${t.senderId} <> ${t.receiverId}`),
  statusValues: check("social_friend_requests_status_values", sql`${t.status} IN ('pending', 'accepted', 'declined', 'cancelled')`),
}));

export const socialFriendships = pgTable("social_friendships", {
  playerLow: varchar("player_low").notNull().references(() => onlineGuestSessions.id),
  playerHigh: varchar("player_high").notNull().references(() => onlineGuestSessions.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => ({
  pair: uniqueIndex("social_friendships_pair_unique").on(t.playerLow, t.playerHigh),
  lowPlayer: index("social_friendships_low_player_idx").on(t.playerLow, t.createdAt),
  highPlayer: index("social_friendships_high_player_idx").on(t.playerHigh, t.createdAt),
  pairOrder: check("social_friendships_pair_order", sql`${t.playerLow} < ${t.playerHigh}`),
}));

export const socialBlocks = pgTable("social_blocks", {
  blockerId: varchar("blocker_id").notNull().references(() => onlineGuestSessions.id),
  blockedId: varchar("blocked_id").notNull().references(() => onlineGuestSessions.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => ({
  pair: uniqueIndex("social_blocks_pair_unique").on(t.blockerId, t.blockedId),
  blockedPlayer: index("social_blocks_blocked_player_idx").on(t.blockedId),
  notSelf: check("social_blocks_not_self", sql`${t.blockerId} <> ${t.blockedId}`),
}));

export const socialConversations = pgTable("social_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerLow: varchar("player_low").notNull().references(() => onlineGuestSessions.id),
  playerHigh: varchar("player_high").notNull().references(() => onlineGuestSessions.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (t) => ({
  pair: uniqueIndex("social_conversations_pair_unique").on(t.playerLow, t.playerHigh),
  lowActivity: index("social_conversations_low_activity_idx").on(t.playerLow, t.updatedAt),
  highActivity: index("social_conversations_high_activity_idx").on(t.playerHigh, t.updatedAt),
  pairOrder: check("social_conversations_pair_order", sql`${t.playerLow} < ${t.playerHigh}`),
}));

export const socialMessages = pgTable("social_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => socialConversations.id),
  senderId: varchar("sender_id").notNull().references(() => onlineGuestSessions.id),
  idempotencyKey: varchar("idempotency_key").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  readAt: timestamp("read_at"),
}, (t) => ({
  idempotency: uniqueIndex("social_messages_sender_idempotency_unique").on(t.senderId, t.idempotencyKey),
  conversationHistory: index("social_messages_conversation_history_idx").on(t.conversationId, t.createdAt, t.id),
  unread: index("social_messages_unread_idx").on(t.conversationId, t.senderId, t.readAt),
  contentLength: check("social_messages_content_length", sql`char_length(${t.content}) BETWEEN 1 AND 1000`),
  idempotencyLength: check("social_messages_idempotency_length", sql`char_length(${t.idempotencyKey}) BETWEEN 8 AND 128`),
}));

export type SocialMessage = typeof socialMessages.$inferSelect;

export const socialGameInvites = pgTable("social_game_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => onlineGuestSessions.id),
  receiverId: varchar("receiver_id").notNull().references(() => onlineGuestSessions.id),
  pairLow: varchar("pair_low").notNull().references(() => onlineGuestSessions.id),
  pairHigh: varchar("pair_high").notNull().references(() => onlineGuestSessions.id),
  roomCode: varchar("room_code").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => ({
  pendingPair: uniqueIndex("social_game_invites_pending_pair_unique")
    .on(t.pairLow, t.pairHigh, t.roomCode)
    .where(sql`${t.status} = 'pending'`),
  receiverStatus: index("social_game_invites_receiver_status_idx").on(t.receiverId, t.status, t.expiresAt),
  pairOrder: check("social_game_invites_pair_order", sql`
    ${t.pairLow} < ${t.pairHigh}
    AND ${t.pairLow} = LEAST(${t.senderId}, ${t.receiverId})
    AND ${t.pairHigh} = GREATEST(${t.senderId}, ${t.receiverId})
  `),
  notSelf: check("social_game_invites_not_self", sql`${t.senderId} <> ${t.receiverId}`),
  statusValues: check("social_game_invites_status_values", sql`${t.status} IN ('pending', 'accepted', 'declined', 'expired')`),
}));

export const socialNotifications = pgTable("social_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull().references(() => onlineGuestSessions.id),
  type: text("type").notNull(),
  actorId: varchar("actor_id").references(() => onlineGuestSessions.id),
  entityId: varchar("entity_id"),
  payload: jsonb("payload").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => ({
  playerFeed: index("social_notifications_player_feed_idx").on(t.playerId, t.createdAt, t.id),
  unread: index("social_notifications_unread_idx").on(t.playerId, t.readAt),
  typeValues: check("social_notifications_type_values", sql`${t.type} IN ('friend_request', 'friend_accepted', 'message', 'game_invite', 'invite_response')`),
}));
