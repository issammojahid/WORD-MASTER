-- OPTIONAL DESTRUCTIVE CLEANUP: review before running; never run automatically.
-- This drops friendship links and friend requests. Player and game records remain.
BEGIN;

DROP TABLE IF EXISTS friend_requests;
DROP TABLE IF EXISTS friends;

COMMIT;
