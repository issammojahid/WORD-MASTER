-- Migration: Add spectator_bets table for Spectator Mode + Betting feature
-- Uses bet_on_player_id (stable player identity) rather than transient socket IDs

CREATE TABLE IF NOT EXISTS "spectator_bets" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "room_id" varchar NOT NULL,
  "spectator_id" varchar NOT NULL,
  "bet_on_player_id" varchar NOT NULL,
  "amount" integer NOT NULL,
  "settled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
