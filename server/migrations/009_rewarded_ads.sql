BEGIN;
CREATE TABLE IF NOT EXISTS rewarded_ad_sessions (
 id text PRIMARY KEY,
 player_id varchar NOT NULL REFERENCES game_wallet_accounts(player_id),
 kind text NOT NULL CHECK(kind IN ('coins','loss-recovery')),
 reward_day text NOT NULL,
 slot integer NOT NULL CHECK(slot BETWEEN 1 AND 6),
 amount integer NOT NULL CHECK(amount>0 AND amount<=10000),
 match_id varchar REFERENCES online_matches(id),
 custom_data text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','credited','expired')),
 transaction_id text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 credited_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS rewarded_ad_daily_slot ON rewarded_ad_sessions(player_id,reward_day,slot) WHERE kind='coins' AND status IN ('pending','credited');
CREATE UNIQUE INDEX IF NOT EXISTS rewarded_ad_one_recovery ON rewarded_ad_sessions(player_id,match_id) WHERE kind='loss-recovery' AND status IN ('pending','credited');
CREATE INDEX IF NOT EXISTS rewarded_ad_player_day ON rewarded_ad_sessions(player_id,reward_day,status);
ALTER TABLE rewarded_ad_sessions ENABLE ROW LEVEL SECURITY;
COMMIT;
