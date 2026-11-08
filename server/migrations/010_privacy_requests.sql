-- Additive request inbox. This migration never deletes player data.
BEGIN;
CREATE TABLE IF NOT EXISTS player_deletion_requests (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 player_id varchar REFERENCES game_wallet_accounts(player_id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS player_deletion_request_open ON player_deletion_requests(player_id) WHERE status IN ('pending','processing');
ALTER TABLE player_deletion_requests ENABLE ROW LEVEL SECURITY;
COMMIT;
