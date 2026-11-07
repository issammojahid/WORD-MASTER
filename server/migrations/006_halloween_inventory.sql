-- Prepared only; never automatically applied. Obtain approval before production.
BEGIN;
CREATE TABLE IF NOT EXISTS player_seasonal_inventory (
 player_id varchar NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
 season_id text NOT NULL,
 state jsonb NOT NULL DEFAULT '{"owned":[],"equipped":{},"giftItemId":null}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (player_id,season_id),
 CHECK (jsonb_typeof(state)='object')
);
COMMIT;
