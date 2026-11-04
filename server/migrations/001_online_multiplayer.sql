BEGIN;

CREATE TABLE IF NOT EXISTS online_guest_sessions (
  id varchar PRIMARY KEY,
  token_hash text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS online_guest_sessions_token_hash_unique
  ON online_guest_sessions (token_hash);

CREATE TABLE IF NOT EXISTS online_guest_wallets (
  player_id varchar PRIMARY KEY,
  coins integer NOT NULL DEFAULT 0 CHECK (coins >= 0),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS online_matches (
  id varchar PRIMARY KEY,
  mode text NOT NULL,
  status text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);

CREATE TABLE IF NOT EXISTS online_match_participants (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  match_id varchar NOT NULL,
  player_id varchar NOT NULL,
  display_name text NOT NULL,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  active boolean NOT NULL DEFAULT false,
  abandoned boolean NOT NULL DEFAULT false,
  final_rank integer,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS online_match_participants_match_player_unique
  ON online_match_participants (match_id, player_id);
CREATE UNIQUE INDEX IF NOT EXISTS online_one_active_match_per_player
  ON online_match_participants (player_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS online_match_participants_player_idx
  ON online_match_participants (player_id, created_at);

CREATE TABLE IF NOT EXISTS online_reward_claims (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  match_id varchar NOT NULL,
  player_id varchar NOT NULL,
  reward_type text NOT NULL,
  amount integer NOT NULL DEFAULT 0 CHECK (amount >= 0),
  reward_date text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS online_reward_claims_match_player_type_unique
  ON online_reward_claims (match_id, player_id, reward_type);

CREATE TABLE IF NOT EXISTS online_daily_match_counters (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  player_id varchar NOT NULL,
  reward_date text NOT NULL,
  completed_matches integer NOT NULL DEFAULT 0 CHECK (completed_matches >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS online_daily_match_counters_player_date_unique
  ON online_daily_match_counters (player_id, reward_date);

CREATE TABLE IF NOT EXISTS online_match_flags (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  match_id varchar NOT NULL,
  player_id varchar NOT NULL,
  reason text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

COMMIT;
