CREATE TABLE "achievements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"title_ar" text NOT NULL,
	"desc_ar" text NOT NULL,
	"icon" text DEFAULT '🏆' NOT NULL,
	"target" integer NOT NULL,
	"type" text NOT NULL,
	"reward_coins" integer DEFAULT 0 NOT NULL,
	"reward_xp" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "achievements_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "battle_pass_tiers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" varchar NOT NULL,
	"tier" integer NOT NULL,
	"free_reward_type" text NOT NULL,
	"free_reward_id" text,
	"free_reward_amount" integer DEFAULT 0 NOT NULL,
	"premium_reward_type" text NOT NULL,
	"premium_reward_id" text,
	"premium_reward_amount" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clan_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clan_id" varchar NOT NULL,
	"player_id" varchar NOT NULL,
	"war_score" integer DEFAULT 0 NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '⚔️' NOT NULL,
	"leader_id" varchar NOT NULL,
	"total_war_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coin_gifts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_player_id" varchar NOT NULL,
	"to_player_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_challenge_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"date" text NOT NULL,
	"guesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"won" boolean DEFAULT false NOT NULL,
	"guess_count" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"rank" integer
);
--> statement-breakpoint
CREATE TABLE "daily_challenges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"word" text NOT NULL,
	"letter" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_challenges_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "daily_spins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"reward_type" text NOT NULL,
	"reward_amount" integer NOT NULL,
	"spun_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"title_ar" text NOT NULL,
	"desc_ar" text NOT NULL,
	"icon" text DEFAULT '📋' NOT NULL,
	"target" integer NOT NULL,
	"type" text NOT NULL,
	"reward_coins" integer DEFAULT 0 NOT NULL,
	"reward_xp" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_tasks_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "online_daily_match_counters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"reward_date" text NOT NULL,
	"completed_matches" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_guest_sessions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_guest_wallets" (
	"player_id" varchar PRIMARY KEY NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_match_flags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" varchar NOT NULL,
	"player_id" varchar NOT NULL,
	"reason" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_match_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" varchar NOT NULL,
	"player_id" varchar NOT NULL,
	"display_name" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"abandoned" boolean DEFAULT false NOT NULL,
	"final_rank" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_matches" (
	"id" varchar PRIMARY KEY NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"results" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "online_reward_claims" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" varchar NOT NULL,
	"player_id" varchar NOT NULL,
	"reward_type" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"reward_date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_achievements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"achievement_key" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"unlocked" integer DEFAULT 0 NOT NULL,
	"claimed" integer DEFAULT 0 NOT NULL,
	"unlocked_at" timestamp,
	"claimed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "player_battle_pass" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"season_id" varchar NOT NULL,
	"pass_xp" integer DEFAULT 0 NOT NULL,
	"current_tier" integer DEFAULT 0 NOT NULL,
	"premium_unlocked" boolean DEFAULT false NOT NULL,
	"claimed_tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_daily_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"task_key" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed" integer DEFAULT 0 NOT NULL,
	"claimed" integer DEFAULT 0 NOT NULL,
	"assigned_date" text NOT NULL,
	"claimed_at" timestamp,
	"baseline_wins" integer DEFAULT 0 NOT NULL,
	"baseline_games" integer DEFAULT 0 NOT NULL,
	"baseline_score" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_profiles" (
	"id" varchar PRIMARY KEY NOT NULL,
	"player_code" text,
	"player_tag" integer,
	"name" text DEFAULT 'لاعب' NOT NULL,
	"coins" integer DEFAULT 100 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"equipped_skin" text DEFAULT 'student' NOT NULL,
	"owned_skins" jsonb DEFAULT '["student"]'::jsonb NOT NULL,
	"owned_cosmetics" jsonb DEFAULT '{"frame":["basic_frame"],"background":["basic_background"],"nameplate":["basic_nameplate"],"victory":["no_victory_effect"],"seasonal":["no_seasonal"]}'::jsonb NOT NULL,
	"equipped_cosmetics" jsonb DEFAULT '{"frame":"basic_frame","background":"basic_background","nameplate":"basic_nameplate","victory":"no_victory_effect","seasonal":"no_seasonal"}'::jsonb NOT NULL,
	"equipped_title" text DEFAULT 'beginner',
	"owned_titles" jsonb DEFAULT '["beginner"]'::jsonb NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"win_streak" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"last_streak_reward" integer DEFAULT 0 NOT NULL,
	"last_spin_at" timestamp,
	"power_cards" jsonb DEFAULT '{"time":3,"freeze":3,"hint":3}'::jsonb,
	"login_streak" integer DEFAULT 0 NOT NULL,
	"last_login_date" text,
	"longest_login_streak" integer DEFAULT 0 NOT NULL,
	"referral_code" text,
	"referred_by" text,
	"referral_count" integer DEFAULT 0 NOT NULL,
	"expo_push_token" text,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"is_vip" boolean DEFAULT false NOT NULL,
	"vip_expires_at" timestamp,
	"vip_subscription_id" text,
	"country" text DEFAULT 'MA',
	"clan_id" varchar,
	"elo" integer DEFAULT 1000 NOT NULL,
	"division" text DEFAULT 'silver' NOT NULL,
	"peak_elo" integer DEFAULT 1000 NOT NULL,
	"season_wins" integer DEFAULT 0 NOT NULL,
	"season_losses" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_profiles_player_code_unique" UNIQUE("player_code"),
	CONSTRAINT "player_profiles_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "room_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_player_id" varchar NOT NULL,
	"to_player_id" varchar NOT NULL,
	"room_id" varchar NOT NULL,
	"from_player_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_blocks" (
	"blocker_id" varchar NOT NULL,
	"blocked_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_blocks_not_self" CHECK ("social_blocks"."blocker_id" <> "social_blocks"."blocked_id")
);
--> statement-breakpoint
CREATE TABLE "social_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_low" varchar NOT NULL,
	"player_high" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_conversations_pair_order" CHECK ("social_conversations"."player_low" < "social_conversations"."player_high")
);
--> statement-breakpoint
CREATE TABLE "social_friend_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"pair_low" varchar NOT NULL,
	"pair_high" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_friend_requests_pair_order" CHECK (
    "social_friend_requests"."pair_low" < "social_friend_requests"."pair_high"
    AND "social_friend_requests"."pair_low" = LEAST("social_friend_requests"."sender_id", "social_friend_requests"."receiver_id")
    AND "social_friend_requests"."pair_high" = GREATEST("social_friend_requests"."sender_id", "social_friend_requests"."receiver_id")
  ),
	CONSTRAINT "social_friend_requests_not_self" CHECK ("social_friend_requests"."sender_id" <> "social_friend_requests"."receiver_id"),
	CONSTRAINT "social_friend_requests_status_values" CHECK ("social_friend_requests"."status" IN ('pending', 'accepted', 'declined', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "social_friendships" (
	"player_low" varchar NOT NULL,
	"player_high" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_friendships_pair_order" CHECK ("social_friendships"."player_low" < "social_friendships"."player_high")
);
--> statement-breakpoint
CREATE TABLE "social_game_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"pair_low" varchar NOT NULL,
	"pair_high" varchar NOT NULL,
	"room_code" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_game_invites_pair_order" CHECK (
    "social_game_invites"."pair_low" < "social_game_invites"."pair_high"
    AND "social_game_invites"."pair_low" = LEAST("social_game_invites"."sender_id", "social_game_invites"."receiver_id")
    AND "social_game_invites"."pair_high" = GREATEST("social_game_invites"."sender_id", "social_game_invites"."receiver_id")
  ),
	CONSTRAINT "social_game_invites_not_self" CHECK ("social_game_invites"."sender_id" <> "social_game_invites"."receiver_id"),
	CONSTRAINT "social_game_invites_status_values" CHECK ("social_game_invites"."status" IN ('pending', 'accepted', 'declined', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "social_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"idempotency_key" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp,
	CONSTRAINT "social_messages_content_length" CHECK (char_length("social_messages"."content") BETWEEN 1 AND 1000),
	CONSTRAINT "social_messages_idempotency_length" CHECK (char_length("social_messages"."idempotency_key") BETWEEN 8 AND 128)
);
--> statement-breakpoint
CREATE TABLE "social_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"type" text NOT NULL,
	"actor_id" varchar,
	"entity_id" varchar,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_notifications_type_values" CHECK ("social_notifications"."type" IN ('friend_request', 'friend_accepted', 'message', 'game_invite', 'invite_response'))
);
--> statement-breakpoint
CREATE TABLE "social_profiles" (
	"player_id" varchar PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT 'لاعب' NOT NULL,
	"allow_friend_requests" boolean DEFAULT true NOT NULL,
	"allow_game_invites" boolean DEFAULT true NOT NULL,
	"show_presence" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_profiles_display_name_length" CHECK (char_length("social_profiles"."display_name") BETWEEN 1 AND 24)
);
--> statement-breakpoint
CREATE TABLE "spectator_bets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" varchar NOT NULL,
	"spectator_id" varchar NOT NULL,
	"bet_on_player_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"settled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_matches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" varchar NOT NULL,
	"round_name" text NOT NULL,
	"match_index" integer NOT NULL,
	"player1_id" varchar,
	"player1_name" text,
	"player2_id" varchar,
	"player2_name" text,
	"winner_id" varchar,
	"winner_name" text,
	"room_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tournament_players" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" varchar NOT NULL,
	"player_id" varchar NOT NULL,
	"player_name" text NOT NULL,
	"player_skin" text DEFAULT 'student' NOT NULL,
	"seed" integer DEFAULT 0 NOT NULL,
	"eliminated" integer DEFAULT 0 NOT NULL,
	"placement" integer,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"entry_fee" integer DEFAULT 100 NOT NULL,
	"prize_pool" integer DEFAULT 0 NOT NULL,
	"max_players" integer DEFAULT 8 NOT NULL,
	"winner_id" varchar,
	"winner_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "win_streaks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"streak_length" integer NOT NULL,
	"bonus_awarded" integer DEFAULT 0 NOT NULL,
	"milestone" integer DEFAULT 0 NOT NULL,
	"awarded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_blocks" ADD CONSTRAINT "social_blocks_blocker_id_online_guest_sessions_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_blocks" ADD CONSTRAINT "social_blocks_blocked_id_online_guest_sessions_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_conversations" ADD CONSTRAINT "social_conversations_player_low_online_guest_sessions_id_fk" FOREIGN KEY ("player_low") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_conversations" ADD CONSTRAINT "social_conversations_player_high_online_guest_sessions_id_fk" FOREIGN KEY ("player_high") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_friend_requests" ADD CONSTRAINT "social_friend_requests_sender_id_online_guest_sessions_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_friend_requests" ADD CONSTRAINT "social_friend_requests_receiver_id_online_guest_sessions_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_friend_requests" ADD CONSTRAINT "social_friend_requests_pair_low_online_guest_sessions_id_fk" FOREIGN KEY ("pair_low") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_friend_requests" ADD CONSTRAINT "social_friend_requests_pair_high_online_guest_sessions_id_fk" FOREIGN KEY ("pair_high") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_friendships" ADD CONSTRAINT "social_friendships_player_low_online_guest_sessions_id_fk" FOREIGN KEY ("player_low") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_friendships" ADD CONSTRAINT "social_friendships_player_high_online_guest_sessions_id_fk" FOREIGN KEY ("player_high") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_game_invites" ADD CONSTRAINT "social_game_invites_sender_id_online_guest_sessions_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_game_invites" ADD CONSTRAINT "social_game_invites_receiver_id_online_guest_sessions_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_game_invites" ADD CONSTRAINT "social_game_invites_pair_low_online_guest_sessions_id_fk" FOREIGN KEY ("pair_low") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_game_invites" ADD CONSTRAINT "social_game_invites_pair_high_online_guest_sessions_id_fk" FOREIGN KEY ("pair_high") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_messages" ADD CONSTRAINT "social_messages_conversation_id_social_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."social_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_messages" ADD CONSTRAINT "social_messages_sender_id_online_guest_sessions_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_notifications" ADD CONSTRAINT "social_notifications_player_id_online_guest_sessions_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_notifications" ADD CONSTRAINT "social_notifications_actor_id_online_guest_sessions_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_player_id_online_guest_sessions_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."online_guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "battle_pass_tiers_season_tier_unique" ON "battle_pass_tiers" USING btree ("season_id","tier");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_members_clan_player_unique" ON "clan_members" USING btree ("clan_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_challenge_entries_player_date_unique" ON "daily_challenge_entries" USING btree ("player_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "online_daily_match_counters_player_date_unique" ON "online_daily_match_counters" USING btree ("player_id","reward_date");--> statement-breakpoint
CREATE UNIQUE INDEX "online_guest_sessions_token_hash_unique" ON "online_guest_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "online_match_participants_match_player_unique" ON "online_match_participants" USING btree ("match_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "online_one_active_match_per_player" ON "online_match_participants" USING btree ("player_id") WHERE "online_match_participants"."active" = true;--> statement-breakpoint
CREATE INDEX "online_match_participants_player_idx" ON "online_match_participants" USING btree ("player_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "online_reward_claims_match_player_type_unique" ON "online_reward_claims" USING btree ("match_id","player_id","reward_type");--> statement-breakpoint
CREATE UNIQUE INDEX "player_battle_pass_player_season_unique" ON "player_battle_pass" USING btree ("player_id","season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_blocks_pair_unique" ON "social_blocks" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "social_blocks_blocked_player_idx" ON "social_blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_conversations_pair_unique" ON "social_conversations" USING btree ("player_low","player_high");--> statement-breakpoint
CREATE INDEX "social_conversations_low_activity_idx" ON "social_conversations" USING btree ("player_low","updated_at");--> statement-breakpoint
CREATE INDEX "social_conversations_high_activity_idx" ON "social_conversations" USING btree ("player_high","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "social_friend_requests_pending_pair_unique" ON "social_friend_requests" USING btree ("pair_low","pair_high") WHERE "social_friend_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "social_friend_requests_receiver_status_idx" ON "social_friend_requests" USING btree ("receiver_id","status","created_at");--> statement-breakpoint
CREATE INDEX "social_friend_requests_sender_status_idx" ON "social_friend_requests" USING btree ("sender_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "social_friendships_pair_unique" ON "social_friendships" USING btree ("player_low","player_high");--> statement-breakpoint
CREATE INDEX "social_friendships_low_player_idx" ON "social_friendships" USING btree ("player_low","created_at");--> statement-breakpoint
CREATE INDEX "social_friendships_high_player_idx" ON "social_friendships" USING btree ("player_high","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "social_game_invites_pending_pair_unique" ON "social_game_invites" USING btree ("pair_low","pair_high","room_code") WHERE "social_game_invites"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "social_game_invites_receiver_status_idx" ON "social_game_invites" USING btree ("receiver_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "social_messages_sender_idempotency_unique" ON "social_messages" USING btree ("sender_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "social_messages_conversation_history_idx" ON "social_messages" USING btree ("conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "social_messages_unread_idx" ON "social_messages" USING btree ("conversation_id","sender_id","read_at");--> statement-breakpoint
CREATE INDEX "social_notifications_player_feed_idx" ON "social_notifications" USING btree ("player_id","created_at","id");--> statement-breakpoint
CREATE INDEX "social_notifications_unread_idx" ON "social_notifications" USING btree ("player_id","read_at");