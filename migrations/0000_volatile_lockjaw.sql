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
CREATE TABLE "coin_gifts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "from_player_id" varchar NOT NULL,
        "to_player_id" varchar NOT NULL,
        "amount" integer NOT NULL,
        "seen" boolean DEFAULT false NOT NULL,
        "sent_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "friends" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "player_id" varchar NOT NULL,
        "friend_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friend_requests" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "sender_id" varchar NOT NULL,
        "receiver_id" varchar NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
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
