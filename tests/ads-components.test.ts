import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import React from "react";
const require = createRequire(import.meta.url),
  { create, act } = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
async function setup(options: Record<string, unknown> = {}) {
  const env: any = {
    path: "/",
    appState: "active",
    listeners: new Set(),
    storage: new Map(),
    writes: [],
    initialized: 0,
    loads: 0,
    shows: 0,
    ads: [],
    permission: true,
    cachedPermission: true,
    consentError: false,
    autoLoad: true,
    rejectShow: false,
    bannerMounts: 0,
    ...options,
  };
  (globalThis as any).__adsFixture = env;
  const root = process.cwd(),
    fixture = (name: string) =>
      path.join(root, "tests/fixtures/ads", name + ".cjs");
  const compiled = await build({
    stdin: {
      contents:
        'export {AdsProvider,useAds} from "./components/AdsProvider.native";export {HomeBannerAd} from "./components/HomeBannerAd.native";',
      resolveDir: root,
      loader: "tsx",
    },
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    external: ["react"],
    alias: {
      "react-native": fixture("react-native"),
      "expo-router": fixture("router"),
      "react-native-google-mobile-ads": fixture("sdk"),
      "@react-native-async-storage/async-storage": fixture("storage"),
      "@/components/AdsProvider": path.join(
        root,
        "components/AdsProvider.native.tsx",
      ),
      "@/contexts/LanguageContext": fixture("language"),
      "@": root,
    },
  });
  const module = { exports: {} as any };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(
    require,
    module,
    module.exports,
  );
  const api = module.exports;
  let context: any;
  function Consumer() {
    context = api.useAds();
    return options.banner ? React.createElement(api.HomeBannerAd) : null;
  }
  let renderer: any;
  await act(async () => {
    renderer = create(
      React.createElement(api.AdsProvider, null, React.createElement(Consumer)),
    );
  });
  return {
    env,
    context: () => context,
    renderer,
    async state(state: string) {
      await act(async () => {
        env.appState = state;
        for (const fn of env.listeners) fn(state);
      });
    },
    async close() {
      await act(async () => renderer.unmount());
    },
  };
}
test("native provider initializes after a permitted cached consent fallback, but blocks unpermitted requests", async () => {
  let app = await setup({ consentError: true });
  try {
    assert.equal(app.env.initialized, 1);
    assert.equal(app.context().canRequestAds, true);
    assert.equal(app.env.loads, 1);
  } finally {
    await app.close();
  }
  app = await setup({ consentError: true, cachedPermission: false });
  try {
    assert.equal(app.env.initialized, 0);
    assert.equal(app.context().canRequestAds, false);
    assert.equal(app.env.loads, 0);
  } finally {
    await app.close();
  }
});
test("native app-open failure does not consume the four-hour cap, while OPENED does", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  const app = await setup({ rejectShow: true });
  try {
    await app.state("background");
    await act(async () => t.mock.timers.tick(30000));
    await app.state("active");
    assert.equal(app.env.shows, 1);
    assert.equal(app.env.writes.length, 0);
    assert.equal(app.context().isFullScreenAdActive, false);
    await act(async () => t.mock.timers.tick(30000));
    app.env.rejectShow = false;
    await app.state("background");
    await act(async () => t.mock.timers.tick(30000));
    await app.state("active");
    assert.equal(app.env.shows, 2);
    assert.equal(app.env.writes.length, 1);
    await act(async () => app.env.ads.at(-1).emit("closed"));
    await app.state("background");
    await act(async () => t.mock.timers.tick(30000));
    await app.state("active");
    assert.equal(app.env.shows, 2);
  } finally {
    await app.close();
  }
});
test("native banner remounts after no-fill instead of staying hidden and manual diagnostics retry restarts it", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 2_000_000 });
  const app = await setup({ banner: true });
  try {
    await act(async () =>
      app.renderer.root
        .findByType("view")
        .props.onLayout({ nativeEvent: { layout: { width: 280 } } }),
    );
    assert.equal(app.env.bannerMounts, 1);
    assert.equal(app.env.banner.width, 280);
    const oldBanner = app.env.banner;
    await act(async () => oldBanner.onAdFailedToLoad({ code: "no-fill" }));
    await act(async () => oldBanner.onAdLoaded());
    await act(async () => t.mock.timers.tick(29999));
    assert.equal(app.env.bannerMounts, 1);
    await act(async () => t.mock.timers.tick(1));
    assert.equal(app.env.bannerMounts, 2);
    await act(async () => app.env.banner.onAdLoaded());
    assert.match(app.context().diagnosticReport, /banner: loaded/);
    await act(async () => app.context().retryAds());
    assert.equal(app.env.bannerMounts, 3);
  } finally {
    await app.close();
  }
});

test("native app-open load timeout retries and teardown cancels pending requests", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 3_000_000 });
  const app = await setup({ autoLoad: false });
  assert.equal(app.env.loads, 1);
  await act(async () => t.mock.timers.tick(45000));
  assert.match(app.context().diagnosticReport, /load_timeout/);
  await act(async () => t.mock.timers.tick(30000));
  assert.equal(app.env.loads, 2);
  await app.close();
  await act(async () => t.mock.timers.tick(300000));
  assert.equal(app.env.loads, 2);
});
test("privacy revocation disables requests and invalidates preloaded ads", async () => {
  const app = await setup();
  try {
    const old = app.env.ads[0];
    app.env.permission = false;
    await act(async () => app.context().showPrivacyOptions());
    assert.equal(app.context().canRequestAds, false);
    assert.equal(
      [...old.listeners.values()].every((set: any) => set.size === 0),
      true,
    );
    await act(async () => old.emit("loaded"));
    assert.equal(app.context().canRequestAds, false);
  } finally {
    await app.close();
  }
});
