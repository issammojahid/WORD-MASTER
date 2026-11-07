import test from "node:test";
import assert from "node:assert/strict";
import {
  AD_RETRY_DELAYS_MS,
  adErrorCode,
  canShowAppOpen,
  createAdRetry,
  gatherAdPermission,
} from "../lib/ads-runtime";
test("consent refresh failure uses only the SDK's currently permitted cached consent", async () => {
  let reads = 0;
  const result = await gatherAdPermission<{ canRequestAds: boolean }>({
    requestInfoUpdate: async () => {
      throw Error("network");
    },
    loadAndShowConsentFormIfRequired: async () => ({ canRequestAds: false }),
    getConsentInfo: async () => {
      reads++;
      return { canRequestAds: true };
    },
  });
  assert.equal(result.canRequestAds, true);
  assert.equal(reads, 1);
});
test("no ad request permission is invented after refresh failure or explicit denial", async () => {
  await assert.rejects(
    gatherAdPermission<{ canRequestAds: boolean }>({
      requestInfoUpdate: async () => {
        throw Error("offline");
      },
      loadAndShowConsentFormIfRequired: async () => ({ canRequestAds: true }),
      getConsentInfo: async () => ({ canRequestAds: false }),
    }),
    /offline/,
  );
  let cached = false;
  const result = await gatherAdPermission<{ canRequestAds: boolean }>({
    requestInfoUpdate: async () => ({ canRequestAds: true }),
    loadAndShowConsentFormIfRequired: async () => ({ canRequestAds: false }),
    getConsentInfo: async () => {
      cached = true;
      return { canRequestAds: true };
    },
  });
  assert.equal(result.canRequestAds, false);
  assert.equal(cached, false);
});
test("retry is bounded, deduplicates concurrent failures and cancels on reset/dispose", () => {
  let nextId = 0,
    calls = 0;
  const timers = new Map<number, { fn: () => void; ms: number }>();
  const retry = createAdRetry(() => calls++, {
    schedule: (fn, ms) => {
      const id = ++nextId;
      timers.set(id, { fn, ms });
      return id;
    },
    cancel: (handle) => {
      timers.delete(handle as number);
    },
  });
  for (const delay of AD_RETRY_DELAYS_MS) {
    retry.schedule();
    retry.schedule();
    assert.equal(timers.size, 1);
    const [id, timer] = [...timers][0];
    assert.equal(timer.ms, delay);
    timers.delete(id);
    timer.fn();
  }
  assert.equal(calls, 4);
  retry.schedule();
  assert.equal(timers.size, 0);
  retry.reset();
  retry.schedule();
  assert.equal(timers.size, 1);
  retry.reset();
  assert.equal(timers.size, 0);
  retry.schedule();
  const callback = [...timers.values()][0].fn;
  retry.dispose();
  assert.equal(timers.size, 0);
  callback();
  assert.equal(calls, 4);
});
test("app-open gating preserves home/background/frequency/freshness checks", () => {
  const valid = {
    allowed: true,
    home: true,
    showing: false,
    capReady: true,
    loaded: true,
    loadedAt: 100_000,
    lastShown: 0,
    backgroundMs: 30_000,
    now: 100_000,
  };
  assert.equal(canShowAppOpen(valid), true);
  for (const change of [
    { allowed: false },
    { home: false },
    { showing: true },
    { capReady: false },
    { loaded: false },
    { backgroundMs: 29_999 },
    { lastShown: 99_999 },
    { loadedAt: 1, now: 4 * 60 * 60 * 1000 + 2 },
  ])
    assert.equal(canShowAppOpen({ ...valid, ...change }), false);
  assert.equal(
    canShowAppOpen({
      ...valid,
      lastShown: 1,
      now: 4 * 60 * 60 * 1000 + 1,
      loadedAt: 4 * 60 * 60 * 1000,
    }),
    true,
  );
});
test("diagnostic error codes are bounded and contain no raw messages", () => {
  assert.equal(
    adErrorCode({
      code: "googleMobileAds/error-code-no-fill",
      message: "private message",
    }),
    "googleMobileAds/error-code-no-fill",
  );
  assert.equal(adErrorCode(Error("private message")), "unknown");
  assert.equal(adErrorCode({ code: "x".repeat(1000) }).length, 100);
});
