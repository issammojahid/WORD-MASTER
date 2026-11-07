-- Additive social features for authenticated online guest sessions.
-- Review before applying. This migration does not alter or delete existing data.
BEGIN;

CREATE TABLE IF NOT EXISTS social_profiles (
  player_id varchar PRIMARY KEY REFERENCES online_guest_sessions(id),
  display_name text NOT NULL DEFAULT 'لاعب' CHECK (char_length(display_name) BETWEEN 1 AND 24),
  allow_friend_requests boolean NOT NULL DEFAULT true,
  allow_game_invites boolean NOT NULL DEFAULT true,
  show_presence boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_friend_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sender_id varchar NOT NULL REFERENCES online_guest_sessions(id),
  receiver_id varchar NOT NULL REFERENCES online_guest_sessions(id),
  pair_low varchar NOT NULL REFERENCES online_guest_sessions(id),
  pair_high varchar NOT NULL REFERENCES online_guest_sessions(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT social_friend_requests_not_self CHECK (sender_id <> receiver_id),
  CONSTRAINT social_friend_requests_pair_order CHECK (
    pair_low < pair_high AND pair_low = LEAST(sender_id, receiver_id) AND pair_high = GREATEST(sender_id, receiver_id)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS social_friend_requests_pending_pair_unique
  ON social_friend_requests (pair_low, pair_high) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS social_friend_requests_receiver_status_idx
  ON social_friend_requests (receiver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS social_friend_requests_sender_status_idx
  ON social_friend_requests (sender_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS social_friendships (
  player_low varchar NOT NULL REFERENCES online_guest_sessions(id),
  player_high varchar NOT NULL REFERENCES online_guest_sessions(id),
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (player_low, player_high),
  CONSTRAINT social_friendships_pair_order CHECK (player_low < player_high)
);
CREATE INDEX IF NOT EXISTS social_friendships_low_player_idx
  ON social_friendships (player_low, created_at DESC);
CREATE INDEX IF NOT EXISTS social_friendships_high_player_idx
  ON social_friendships (player_high, created_at DESC);

CREATE TABLE IF NOT EXISTS social_blocks (
  blocker_id varchar NOT NULL REFERENCES online_guest_sessions(id),
  blocked_id varchar NOT NULL REFERENCES online_guest_sessions(id),
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT social_blocks_not_self CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS social_blocks_blocked_player_idx ON social_blocks (blocked_id);

CREATE TABLE IF NOT EXISTS social_conversations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  player_low varchar NOT NULL REFERENCES online_guest_sessions(id),
  player_high varchar NOT NULL REFERENCES online_guest_sessions(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT social_conversations_pair_order CHECK (player_low < player_high),
  CONSTRAINT social_conversations_pair_unique UNIQUE (player_low, player_high)
);
CREATE INDEX IF NOT EXISTS social_conversations_low_activity_idx
  ON social_conversations (player_low, updated_at DESC);
CREATE INDEX IF NOT EXISTS social_conversations_high_activity_idx
  ON social_conversations (player_high, updated_at DESC);

CREATE TABLE IF NOT EXISTS social_messages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id varchar NOT NULL REFERENCES social_conversations(id),
  sender_id varchar NOT NULL REFERENCES online_guest_sessions(id),
  idempotency_key varchar NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 128),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at timestamp NOT NULL DEFAULT now(),
  read_at timestamp,
  CONSTRAINT social_messages_sender_idempotency_unique UNIQUE (sender_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS social_messages_conversation_history_idx
  ON social_messages (conversation_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS social_messages_unread_idx
  ON social_messages (conversation_id, sender_id, read_at);

CREATE TABLE IF NOT EXISTS social_game_invites (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sender_id varchar NOT NULL REFERENCES online_guest_sessions(id),
  receiver_id varchar NOT NULL REFERENCES online_guest_sessions(id),
  pair_low varchar NOT NULL REFERENCES online_guest_sessions(id),
  pair_high varchar NOT NULL REFERENCES online_guest_sessions(id),
  room_code varchar(6) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT social_game_invites_not_self CHECK (sender_id <> receiver_id),
  CONSTRAINT social_game_invites_pair_order CHECK (
    pair_low < pair_high AND pair_low = LEAST(sender_id, receiver_id) AND pair_high = GREATEST(sender_id, receiver_id)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS social_game_invites_pending_pair_unique
  ON social_game_invites (pair_low, pair_high, room_code) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS social_game_invites_receiver_status_idx
  ON social_game_invites (receiver_id, status, expires_at);

CREATE TABLE IF NOT EXISTS social_notifications (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  player_id varchar NOT NULL REFERENCES online_guest_sessions(id),
  type text NOT NULL CHECK (type IN (
    'friend_request', 'friend_accepted', 'message', 'game_invite', 'invite_response'
  )),
  actor_id varchar REFERENCES online_guest_sessions(id),
  entity_id varchar,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_notifications_player_feed_idx
  ON social_notifications (player_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS social_notifications_unread_idx
  ON social_notifications (player_id, read_at);

COMMIT;
