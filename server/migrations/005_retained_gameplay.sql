-- Additive tables and profile fields required by retained clan and daily challenge gameplay.
-- Safe to apply after the core, online, social, and cosmetic migrations.
-- No existing table or user data is deleted or rewritten.
BEGIN;

ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'MA',
  ADD COLUMN IF NOT EXISTS clan_id varchar,
  ADD COLUMN IF NOT EXISTS elo integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS division text NOT NULL DEFAULT 'silver',
  ADD COLUMN IF NOT EXISTS peak_elo integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS season_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS season_losses integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS seasons (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  start_date timestamp NOT NULL,
  end_date timestamp NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clans (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '⚔️',
  leader_id varchar NOT NULL,
  total_war_score integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clan_members (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clan_id varchar NOT NULL,
  player_id varchar NOT NULL,
  war_score integer NOT NULL DEFAULT 0,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS clan_members_clan_player_unique
  ON clan_members (clan_id, player_id);

CREATE TABLE IF NOT EXISTS daily_challenges (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date text NOT NULL UNIQUE,
  word text NOT NULL,
  letter text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_challenge_entries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  player_id varchar NOT NULL,
  date text NOT NULL,
  guesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed boolean NOT NULL DEFAULT false,
  won boolean NOT NULL DEFAULT false,
  guess_count integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  started_at timestamp NOT NULL DEFAULT now(),
  finished_at timestamp,
  rank integer
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_challenge_entries_player_date_unique
  ON daily_challenge_entries (player_id, date);

COMMIT;
