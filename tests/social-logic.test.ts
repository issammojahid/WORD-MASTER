import assert from "node:assert/strict";
import test from "node:test";
import {
  canMessage,
  canSendFriendRequest,
  invitationExpired,
  normalizeMessageContent,
  normalizePlayerPair,
} from "../server/social-logic";

test("friend pair keys are stable regardless of request direction", () => {
  assert.deepEqual(normalizePlayerPair("player-a", "player-b"), ["player-a", "player-b"]);
  assert.deepEqual(normalizePlayerPair("player-b", "player-a"), ["player-a", "player-b"]);
});

test("chat content is trimmed and limited to 1000 characters", () => {
  assert.equal(normalizeMessageContent("  hello 👋  "), "hello 👋");
  assert.equal(normalizeMessageContent("  "), null);
  assert.equal(normalizeMessageContent("x".repeat(1001)), null);
  assert.equal(normalizeMessageContent("x".repeat(1000))?.length, 1000);
});

test("chat authorization requires friendship and rejects self or blocked pairs", () => {
  assert.equal(canMessage({ samePlayer: false, friends: true, blocked: false }), true);
  assert.equal(canMessage({ samePlayer: false, friends: false, blocked: false }), false);
  assert.equal(canMessage({ samePlayer: false, friends: true, blocked: true }), false);
  assert.equal(canMessage({ samePlayer: true, friends: true, blocked: false }), false);
});

test("friend requests respect self, existing friendship, blocks, and privacy", () => {
  const allowed = {
    samePlayer: false,
    alreadyFriends: false,
    blocked: false,
    requestsAllowed: true,
  };
  assert.equal(canSendFriendRequest(allowed), true);
  assert.equal(canSendFriendRequest({ ...allowed, samePlayer: true }), false);
  assert.equal(canSendFriendRequest({ ...allowed, alreadyFriends: true }), false);
  assert.equal(canSendFriendRequest({ ...allowed, blocked: true }), false);
  assert.equal(canSendFriendRequest({ ...allowed, requestsAllowed: false }), false);
});

test("invitation expires at the exact 60-second cutoff", () => {
  const now = 1_000_000;
  assert.equal(invitationExpired(new Date(now - 1), now), true);
  assert.equal(invitationExpired(new Date(now), now), true);
  assert.equal(invitationExpired(new Date(now + 1), now), false);
});
