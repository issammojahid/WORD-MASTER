-- Unified wallets are new authenticated guest identities. Legacy beta balances remain untouched.
BEGIN;
CREATE TABLE IF NOT EXISTS game_wallet_accounts (
 player_id varchar PRIMARY KEY REFERENCES player_profiles(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS game_wallet_operations (
 player_id varchar NOT NULL REFERENCES game_wallet_accounts(player_id),
 operation_id text NOT NULL,
 kind text NOT NULL,
 amount integer NOT NULL,
 result jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(player_id,operation_id)
);
ALTER TABLE game_wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_wallet_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_seasonal_inventory ENABLE ROW LEVEL SECURITY;
COMMIT;
