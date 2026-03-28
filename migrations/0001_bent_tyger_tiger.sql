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
CREATE TABLE "seasons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "player_profiles" ADD COLUMN "clan_id" varchar;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN "elo" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN "division" text DEFAULT 'silver' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN "peak_elo" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN "season_wins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN "season_losses" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "battle_pass_tiers_season_tier_unique" ON "battle_pass_tiers" USING btree ("season_id","tier");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_members_clan_player_unique" ON "clan_members" USING btree ("clan_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_challenge_entries_player_date_unique" ON "daily_challenge_entries" USING btree ("player_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "player_battle_pass_player_season_unique" ON "player_battle_pass" USING btree ("player_id","season_id");