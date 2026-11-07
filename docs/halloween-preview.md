# Halloween category and Profile integration

Applied locally to WORD-MASTER on 2026-11-06. This supersedes the earlier all-in-one gallery implementation.

- Avatars are under the existing Characters tab; 6 frames under Frames; 4 backgrounds under Backgrounds; 4 nameplates under Nameplates; 4 static victory images under Victory Effects; 12 decorative icons under Seasonal.
- The old mixed gallery is no longer mounted in Store or Profile.
- Each category has selectable local preview cards. Selecting a card reveals the composed appearance at the top of Store. A dedicated button navigates to Profile using in-app routing and retains the in-memory choices.
- The Profile header composes the selected background, avatar, transparent frame and nameplate in their actual visual positions. Optional seasonal icon and static victory art are decorative badges in the preview only.
- Six scalable transparent SVG frame variants and four SVG nameplates extend the existing code-native artwork system; original opaque frame/nameplate crop images are retained as reference files but are no longer used for those preview visuals.
- Avatar images are clipped to a circular mask; the background covers the header area. Original raster sources are otherwise preserved.
- A reset action removes the preview and restores the regular profile presentation. Preview state is memory-only and disappears on full reload. It does not persist, equip, purchase, spend coins or send requests.
- Development-only flag is still required. Production catalogs, IDs, prices, inventory, gameplay and backend are unchanged. No push/deploy/publication or Supabase/Render operation.

## Visual validation

Selected Atlas Sorcerer, Pumpkin Halo, Enchanted Riad and Amethyst Script through their respective tabs and navigated to Profile through the new button. Verified the frame leaves the face visible, the background fills the header and the name appears inside the plate. Coin balance remained 1,015. Screenshots saved as halloween-composed-store.png and halloween-composed-profile.png.

The local Expo process on port 8082 uses the preview flag and an API override pointing to an unused localhost address, so this preview session does not use the configured Render API.

## Remaining asset limits

This implements the requested placement and composed appearance, not final production raster art or animations. The original avatars, backgrounds, victory and icon images are still low-resolution concept crops with baked-in backgrounds. Enlarged background art is visibly soft. Victory art remains static; no gameplay effect or animation was introduced. Final higher-resolution artwork and individually authored animations remain outstanding.

## Files

New: components/HalloweenAppearance.tsx. Updated: app/store.tsx, app/profile.tsx, constants/halloween-preview.ts. Text backups are in the workspace work/halloween-placement-backup-* folder. Existing unrelated local changes were preserved.
# Halloween animations — 2026-11-06

Added presentation animations to the existing local Halloween appearance without replacing the artwork, palette, SVG frame/nameplate designs, category placement, catalog IDs, prices or purchase/equip behavior.

- Avatar: gentle 3px float.
- Frame: subtle breathing scale and opacity.
- Background: slow zoom up to 3.5%.
- Nameplate: gentle luminance effect through opacity.
- Seasonal icon: slight float and tilt.
- Victory badge: gentle pulse/tilt with eight decorative sparkles in the composition.
- One shared 6.4-second animation clock per focused composition, using opacity/transforms and the React Native native driver where available. Shop thumbnails remain still.
- Pause/play control; honors the existing reduced-motion preference. Loops stop on focus loss, app backgrounding, pause, reduced-motion changes or unmount.

Changed `components/HalloweenAppearance.tsx`; added `components/HalloweenMotion.tsx`. Prior appearance code is backed up in the workspace work directory.

## Validation

Confirmed movement through changing rendered transforms on localhost Profile. Paused through the visible control and verified all sampled avatar ancestor transforms returned to `none`; resumed through the visible control. Screenshot: halloween-animated-profile.png. Left the Profile preview open and running with the same avatar/frame/background/nameplate plus a seasonal pumpkin icon and victory badge.

All 40 source PNGs match their originals byte-for-byte. ESLint passed. All 3 existing cosmetics tests passed. Diff whitespace check passed. Global TypeScript still fails only on the previously observed URL type mismatch in untouched server/initialize-database.ts:7.

Reduced-motion, focus and background handling are implemented; native-device performance and an interactive reduced-motion toggle were not tested. This is web-verified presentation motion around static raster images, not newly authored frame-by-frame or skeletal character animation. Original raster resolution limits remain.

The integration remains local and development-only. It does not write preview choices to account/player state or persist them on full reload. No gameplay or backend changes, purchases, pushes, builds, publication, deployment, remote uploads or Supabase/Render operations were performed.
# Halloween economy — implemented locally, 2026-11-06

The Halloween pack now has persistent local-demo ownership and equip behavior, a one-time choice of one starter gift, Coin purchases, and task/achievement reward claims. Original item IDs/prices and gameplay were preserved. All 40 new seasonal items have separate stable IDs under `halloween_2026_*`.

## Player flow

Home and Store link to `/halloween`, the event hub. A new seasonal participant can choose one of six starter items: avatar, frame, nameplate, background, victory art or decorative icon. There is a confirmation step because only one gift is allowed per player/season. The same gift request can safely be retried; choosing another after claiming is rejected.

The 40 items include 24 purchasable items and 16 reward-only items (8 task, 8 achievement). The six gift candidates are included among the purchasable items, so players can buy the other starter choices later. A separate Equip button activates an owned item; Remove restores the normal slot. Ownership, gift choice, equipped slots and wallet survive reload in the local server's SQLite file.

Task/achievement panels display required conditions. Players first complete and claim the existing task/achievement reward, then claim the corresponding Halloween cosmetic. These cosmetics have no purchase price. Availability is read from server-held claim records and refreshed after existing reward claims or screen focus; client-supplied completion lists are ignored.

## Default prices and reward allocation

| Category | Purchasable prices (Coins) | Reward-only conditions |
|---|---|---|
| Avatars | 250, 350, 450, 550, 650, 750 | play_5, win_3 tasks; win_10, level_5 achievements |
| Frames | 220, 320, 420, 520 | score_200 task; streak_3 achievement |
| Nameplates | 180, 280 | play_3 task; first_win achievement |
| Backgrounds | 280, 380 | score_500 task; play_10 achievement |
| Victory art | 260, 360 | win_5 task; win_25 achievement |
| Decorative icons | 100 through 310 in steps of 30 | score_100, play_10 tasks; first_win, score_5000 achievements |

Prices are initial implementation choices, centralized in `shared/halloween.ts`; no existing prices were changed. The first item in each category is gift eligible.

## Validation

10 tests passed: 3 existing cosmetics tests plus seasonal catalog/gift/economy/eligibility/HTTP/persistence/concurrency/access tests. They cover duplicate gifts, simultaneous different gift choices, duplicate purchases without double debit, forged prices/wallets/claim lists, insufficient Coins, unowned equip, reward-only purchase rejection, persistence after reopening SQLite, separate players, disabled season, and production access failing closed without verified player ownership.

In the web UI, claimed a demo avatar gift, purchased Moon Witch for 350 test Coins (1000 → 650), equipped it, restored the gifted Atlas Sorcerer, and verified persistence after full reload. Then purchased/equipped Pumpkin Halo for 220 and Enchanted Riad for 280 (650 → 430 → 150). The demo now has four owned items and 150 test Coins. These are isolated demo records, not production account changes. Animations and existing artwork remain.

ESLint passed on the changed files. Global TypeScript continues to report the previously known URL type incompatibility in untouched `server/initialize-database.ts:7`; no seasonal diagnostics. Diff whitespace checks passed with Windows line-ending notices.

## Local services

- Web: `http://localhost:8082/halloween` (Store `/store`, Profile `/profile`).
- Demo API: `http://127.0.0.1:39999`, bound to loopback, with an explicit CORS origin for the local web preview.
- Demo database: isolated workspace `work/halloween-demo.sqlite`; starts each new local player with 1000 test Coins.
- The demo server never imports the production DB module or reads DATABASE_URL. Existing unrelated backend endpoints are not simulated; live gameplay/task completion against PostgreSQL has not been exercised in this demo.
- Metro uses session-only flags `EXPO_PUBLIC_HALLOWEEN_PREVIEW=1`, `EXPO_PUBLIC_HALLOWEEN_COMMERCE=1`, and the local API URL. No .env or production configuration was changed.

To restart the isolated API from the repository in PowerShell:

```powershell
$env:HALLOWEEN_LOCAL_DB = 'C:/Users/aissa/Documents/Codex/2026-11-06/referenced-chatgpt-conversation-this-is-an/work/halloween-demo.sqlite'
node node_modules/tsx/dist/cli.mjs scripts/halloween-local.ts
```

In a separate local terminal:

```powershell
$env:EXPO_PUBLIC_HALLOWEEN_PREVIEW = '1'
$env:EXPO_PUBLIC_HALLOWEEN_COMMERCE = '1'
$env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:39999'
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '127.0.0.1'
node node_modules/expo/bin/cli start --offline --port 8082
```

## Prepared server integration, not activated in production

Added a PostgreSQL adapter that locks the player row, verifies the server price/eligibility, deducts Coins and stores inventory in one transaction. `server/migrations/006_halloween_inventory.sql` prepares a separate inventory table. The migration was NOT applied, and PostgreSQL integration/concurrency has not been tested against a real local PostgreSQL instance.

Server registration is disabled unless `HALLOWEEN_COMMERCE_ENABLED=1`. Outside the isolated demo, routes also deny access until a verified player-ownership authorization callback is wired. No such production callback is currently configured; setting the flag alone does not enable transactions.

Before an approved release, connect real authenticated player ownership, apply/review the migration in staging, test with real PostgreSQL transactions and game claim records, and resolve the existing economy trust issue: legacy player PUT accepts client coin/stat totals, while older skin/title purchases do not use the new row-lock transaction. Those existing flows were not rewritten here to avoid changing gameplay/purchases outside the authorized seasonal implementation. This means the whole game's economy must not be described as tamper-proof on the basis of the new endpoint alone.

Task claim eligibility uses existing claimed records assigned on/after 2026-10-01; achievements may already have been earned. There is no automatic season end/schedule enforcement yet. Existing claim authentication and authoritative gameplay progress need staging review before release.

Original raster images remain low-resolution/static concept crops; presentation animations do not turn them into final animated source assets.

## Files and boundaries

Added seasonal domain/catalog, context, event hub, economy UI, SVG artwork leaves, local demo API/store, PostgreSQL adapter, gated routes, migration and tests. Updated Home, Store, Profile, task/achievement screens and root provider. Existing claim rewards/gameplay and legacy catalogs were retained. Text backups are in `work/seasonal-economy-backup-*`.

No push, build, deployment, publication, Supabase/Render operation, production DB connection/migration or production wallet update was performed. This report supersedes older notes that seasonal choices are only in memory: previews remain temporary, while confirmed acquisition/equipment is now persisted by the configured seasonal server.
