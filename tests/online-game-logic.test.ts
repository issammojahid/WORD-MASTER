import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDailyRewardLimit,
  createRoomCode,
  getRandomMatchBaseRewards,
  OnlineMatchQueue,
  scoreOnlineRound,
} from "../server/online-game-logic";

test("matchmaking queue rejects duplicates and pairs distinct identities once", () => {
  const queue = new OnlineMatchQueue<string>();
  assert.deepEqual(queue.enqueue("first", "first-entry"), { status: "queued" });
  assert.deepEqual(queue.enqueue("first", "duplicate-entry"), { status: "duplicate" });
  assert.deepEqual(queue.enqueue("second", "second-entry"), {
    status: "paired",
    opponentId: "first",
    opponent: "first-entry",
  });
  assert.equal(queue.has("first"), false);
  assert.equal(queue.has("second"), false);
});

test("matchmaking cancellation removes only the requested player", () => {
  const queue = new OnlineMatchQueue<number>();
  queue.enqueue("first", 1);

  assert.equal(queue.cancel("first"), 1);
  assert.equal(queue.cancel("first"), undefined);
  assert.equal(queue.has("first"), false);
});

test("scores correct, normalized-duplicate, and empty answers from server inputs", () => {
  const results = scoreOnlineRound([
    { id: "p1", name: "One", answers: { animal: "أسد", boyName: "أحمد" } },
    { id: "p2", name: "Two", answers: { animal: "أرنب", boyName: "احمد" } },
  ], "أ");

  assert.equal(results[0].scores.animal, 10);
  assert.equal(results[1].scores.animal, 10);
  assert.equal(results[0].scores.boyName, 5);
  assert.equal(results[1].status.boyName, "duplicate");
  assert.equal(results[0].status.fruit, "empty");
  assert.equal(results[0].scores.fruit, 0);
});

test("invalid answers never contribute to duplicate scoring", () => {
  const results = scoreOnlineRound([
    { id: "p1", name: "One", answers: { animal: "not-a-word" } },
    { id: "p2", name: "Two", answers: { animal: "أسد" } },
  ], "أ");

  assert.equal(results[0].status.animal, "invalid");
  assert.equal(results[0].scores.animal, 0);
  assert.equal(results[1].scores.animal, 10);
});

test("random match rewards distinguish wins, losses, draws, and forfeits", () => {
  const win = getRandomMatchBaseRewards([
    { id: "winner", score: 100, abandoned: false },
    { id: "loser", score: 50, abandoned: false },
  ]);
  assert.equal(win.get("winner"), 20);
  assert.equal(win.get("loser"), 5);

  const draw = getRandomMatchBaseRewards([
    { id: "one", score: 20, abandoned: false },
    { id: "two", score: 20, abandoned: false },
  ]);
  assert.equal(draw.get("one"), 10);
  assert.equal(draw.get("two"), 10);

  const forfeit = getRandomMatchBaseRewards([
    { id: "abandoned", score: 100, abandoned: true },
    { id: "opponent", score: 0, abandoned: false },
  ]);
  assert.equal(forfeit.get("abandoned"), 0);
  assert.equal(forfeit.get("opponent"), 20);
});

test("daily reward limits apply at the exact UTC match-count boundaries", () => {
  assert.equal(applyDailyRewardLimit(20, 9), 20);
  assert.equal(applyDailyRewardLimit(20, 10), 10);
  assert.equal(applyDailyRewardLimit(5, 19), 2);
  assert.equal(applyDailyRewardLimit(20, 20), 0);
  assert.equal(applyDailyRewardLimit(0, 0), 0);
});

test("room codes use the expected six-character alphabet", () => {
  const code = createRoomCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
});
