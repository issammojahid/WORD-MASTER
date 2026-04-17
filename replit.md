# حروف المغرب - Huroof Al Maghrib

A full-featured multiplayer Arabic word game inspired by the "Categories/Stop" game format.

## Architecture

- **Frontend**: React Native with Expo (SDK 54), Expo Router v6, TypeScript
- **Backend**: Express.js with Socket.io for real-time multiplayer
- **State**: AsyncStorage for persistence, React Context for shared state
- **Fonts**: Cairo (Arabic-friendly Google Font)
- **Audio**: expo-av (v15.0.x) for voice chat (mic recording + playback)
- **File I/O**: expo-file-system/legacy for base64 audio chunk encoding

## Recent Features Added

- **Battle Pass Overhaul (Task #11)**:
  - **Railway DB seeded**: 1 active season (`موسم أبريل 2026`) + 30 `battle_pass_tiers` rows on Railway production. One-shot script: `scripts/seed-railway-bp.ts` (run with `DATABASE_URL=$RAILWAY_DATABASE_URL npx tsx scripts/seed-railway-bp.ts`). Idempotent — safe to re-run.
  - **Backend IAP scaffolding** (`server/routes.ts`):
    - New constants: `BP_IAP_PRODUCT_ID = "battle_pass_premium_s1"`, `BP_IAP_BASE_PRICE = €1.99`, `BP_IAP_ENABLED` (true only when `REVENUECAT_SECRET_API_KEY` env var is set)
    - `GET /api/battle-pass/:playerId` response now includes `iap: { enabled, productId, price: { amount, currency, display } }`
    - New endpoint `POST /api/battle-pass/:playerId/unlock-premium-iap` — verifies entitlement via RevenueCat REST API (`https://api.revenuecat.com/v1/subscribers/{userId}`, entitlement key `battle_pass_premium`) before flipping `premium_unlocked = true`. Returns 503 `iap_not_configured` when keys missing
    - Legacy `/buy-premium` (1000 coins) **deprecated** — now returns `410 Gone` so old clients fail loudly and prompt update
    - Seed script `scripts/seed-railway-bp.ts` now **creates an active season if missing** (30-day window, name = `موسم {شهر سنة}`) before seeding tiers — fully production-ready
  - **Mobile IAP integration** (`lib/iap.ts` + `app/_layout.tsx`):
    - Installed `react-native-purchases`. New `lib/iap.ts` exports `initIAP(playerId)`, `purchaseBattlePassPremium(playerId)`, `restorePurchases(playerId)`. SDK is lazy-loaded so it degrades gracefully on web/Expo Go.
    - `<IapInitializer />` mounted in `RootLayoutNav` calls `Purchases.configure({ apiKey, appUserID: playerId })` on app boot, ensuring RevenueCat App User ID always equals our in-game playerId (security binding for the server-side verify endpoint).
    - Reads `EXPO_PUBLIC_REVENUECAT_API_KEY` from env. Until this is set + the native build is published, `purchaseBattlePassPremium()` returns `{ ok: false, error: "iap_unavailable" }` and the UI shows "قريباً".
  - **New Battle Pass UI** (`app/battle-pass.tsx` — 876 lines, full rewrite):
    - Season banner hero card with countdown (days/hours/min, refreshes every 60s), large tier badge (current/30), gold→orange gradient XP bar
    - Vertical tier path: 30 rows, each with two reward cells side-by-side and a center connector with tier-number circle
    - Reward cells show: icon (🪙/💡/❄️/⏱️/👗/👑), amount, sub-label (skin/title id), state-aware visuals: claimable (animated gold glow), claimed (✓ تم), locked (🔒 مغلق), premium-locked (⭐ مميز)
    - Sticky bottom CTA: gold gradient card with `€1.99` chip + animated shadow glow. When `iap.enabled = false`, chip shows "قريباً" and tap shows a "coming soon" alert (no coin fallback in current UX — legacy `/buy-premium` returns 410). When enabled, calls IAP flow then backend verify endpoint, with a "استرجاع مشتريات سابقة" (Restore Purchases) button for recovery.
    - Pulsing glow loop animation for claimable rewards & CTA
    - All API contracts preserved: GET state, POST claim/:tier, POST buy-premium (legacy), POST unlock-premium-iap (new)
  - **Version bumped to 2.7.0** in `app.json` (next EAS build will include all changes)
  - **RevenueCat setup pending** (follow-up): user must (1) create Google Play Console product `battle_pass_premium_s1` ($1.99 base, regional auto-pricing), (2) create RevenueCat project + entitlement `battle_pass_premium` + offering with that product, (3) install `react-native-purchases` in mobile app, (4) wire `Purchases.purchasePackage()` call before hitting backend, (5) set `REVENUECAT_SECRET_API_KEY` env var on Railway

- **National & International Leaderboard (Task #12)**:
  - **Schema**: `country` text column (default "MA") added to `player_profiles`
  - **Backend**: `GET /api/leaderboard` and `GET /api/ranked/leaderboard` now accept optional `?country=XX` query param to filter by country; `country` included in all leaderboard API responses; `country` added to `allowedFields` in `PUT /api/player/:id`
  - **Shared utility**: `lib/countries.tsx` — list of 30 countries (Arab world + Europe/Americas), `getCountryInfo()` helper, reusable `CountryPickerModal` component
  - **PlayerContext**: `country: string` (default "MA") added to `PlayerProfile` type, `defaultProfile`, and server sync merge
  - **Leaderboard UI** (`app/leaderboard.tsx`): Geo filter row with "وطني 🏳" (national = filtered by player's country) and "دولي 🌍" (international = all); flag emoji shown per player in list rows and podium; country picker button in header
  - **Settings** (`app/settings.tsx`): "بلدك" section with current flag/name display and tap-to-open country picker modal

- **Clan Wars / نظام العصابات (Task #5)**:
  - **Schema**: `clans` table (id, name, emoji, leader_id, total_war_score, created_at), `clan_members` table (id, clan_id, player_id, war_score, role, joined_at), nullable `clan_id` column on `player_profiles`
  - **Backend Routes**: `GET /api/clans/leaderboard` (top 10), `GET /api/clans/search?q=` (search by name), `GET /api/clans/:id` (detail + member list + rank), `POST /api/clans/create` (costs 500 coins), `POST /api/clans/:id/join`, `POST /api/clans/:id/leave`, `POST /api/clans/:id/kick`, `POST /api/clans/:id/rename`
  - **War Score**: Every match win adds +1 to `clan_members.war_score` for the winner and +1 to `clans.total_war_score` in the `next_round` → game_over handler
  - **Weekly Cron**: Every Monday 00:05 — distributes rewards (1st: 300 coins/member, 2nd: 150, 3rd: 75) then resets all war scores
  - **Frontend**: `app/clans.tsx` — two-tab screen (عصابتي + الترتيب), create/join modals with clan emoji picker, member list with war scores, kick/leave functionality, weekly war info card
  - **Home Screen**: Bottom nav "العصابات" ⚔️ button (replaced Achievements) navigates to `/clans`
  - **PlayerContext**: `clanId: string | null` field added to `PlayerProfile` type + default + server merge
  - Files: `shared/schema.ts`, `server/routes.ts`, `app/clans.tsx`, `contexts/PlayerContext.tsx`, `app/index.tsx`

- **Shop UI Rebuild (Task #2)**:
  - Rebuilt `app/shop.tsx` with premium mobile game styling while preserving all game logic exactly
  - Enhanced design tokens (`L` object) with deeper dark theme colors, additional tokens (`cardInner`, `purpleDeep`, `goldGlow`, `headerGrad1/2`)
  - Improved card designs with more pronounced rarity glow effects, deeper shadows, and refined border radius (18→20px cards, 14→18px daily cards)
  - Better tab bar with refined active states and glow indicators
  - Enhanced daily deals section with structured banner layout, improved timer badge styling
  - Restructured header with dedicated `headerRight` container, cleaner VIP button styling
  - Filter chips with active state style extraction (`filterChipActive`) instead of inline styles
  - All 7 tabs preserved: daily/spin/mystery/avatars/effects/titles/coins
  - All logic functions preserved exactly: getDailyItems, rollMysteryBox, BOX_TIERS, COIN_PACKS, AnimatedCard, BoxOpeningModal, BurstOverlay, ShopParticles
  - Files: `app/shop.tsx`

- **VIP / Premium Subscription (Task #7)**:
  - **Schema**: `player_profiles.is_vip`, `player_profiles.vip_expires_at`, `player_profiles.vip_subscription_id` columns
  - **Backend**: `POST /api/player/:id/activate-vip` (activate VIP, default 30 days), `GET /api/player/:id/vip-status` (check status), 2x coin multiplier in `POST /api/player/:id/spin` and `POST /api/player/:id/game-result` for VIP players, `isVip` field in leaderboard API response
  - **Frontend**: `app/vip.tsx` — VIP benefits screen with crown animation, benefits list, pricing, subscribe button. VIP entry points in shop header and settings page
  - **VIP Skins**: 3 exclusive VIP skins (`vip_phoenix`, `vip_sultan`, `vip_cyber`) — locked for non-VIP, shown with "👑 VIP" badge in shop
  - **VIP Title**: "عضو VIP" golden title (`vip_gold`) — locked for non-VIP
  - **VIP Crown**: 👑 badge next to VIP players' names in home screen profile area, leaderboard (podium + list rows)
  - **PlayerContext**: `isVip` and `vipExpiresAt` fields added to `PlayerProfile` type, merged from server on sync
  - Files: `shared/schema.ts`, `server/routes.ts`, `contexts/PlayerContext.tsx`, `app/vip.tsx`, `app/shop.tsx`, `app/settings.tsx`, `app/index.tsx`, `app/leaderboard.tsx`

- **Push Notifications (Task #6)**:
  - **Backend**: `server/notifications.ts` — Expo Push API utility (`sendPushNotification`, `sendBulkPushNotifications`), cron job functions for daily task reminders (9am), streak reset warnings (8pm), season ending alerts (noon)
  - **Schema**: `player_profiles.expo_push_token` and `player_profiles.notifications_enabled` columns
  - **API Endpoints**: `POST /api/player/:id/push-token` (register token), `GET/PUT /api/player/:id/notifications` (read/toggle notification setting)
  - **Event-triggered**: Push on room invite creation, push on coin gift sent
  - **Cron Jobs**: `node-cron` schedules in `server/routes.ts` — 9:00 AM daily task reminders (players who haven't logged in today), 8:00 PM streak reset warnings (players with 3+ streaks who haven't logged in), 12:00 PM season ending notifications (3 days and 1 day before month end)
  - **Frontend**: `lib/notifications.ts` — `registerForPushNotifications()` (permission request, Android channel setup, token registration), `updateNotificationSetting()`, `getNotificationSettings()`
  - **App Startup**: `PushNotificationRegistrar` component in `_layout.tsx` — registers push token 3s after playerId is available
  - **Settings**: Notifications toggle in `app/settings.tsx` with real-time server sync
  - Files: `server/notifications.ts`, `lib/notifications.ts`, `shared/schema.ts`, `server/routes.ts`, `app/_layout.tsx`, `app/settings.tsx`, `app.json`

- **Word Categories & Hint System (Task #5)**:
  - **Word Categories**: Room host picks a category (عام/حيوانات/دول/طعام/رياضة/أفلام/مدن) when creating a room. Each category filters which answer fields (game categories) appear during gameplay. Category picker in lobby, badge in waiting room and game header.
  - **In-game Hint Button**: Costs 5 coins per use, max 3 per game. Server-side tracking (cleared on game start). Returns a random valid word from the current letter + active categories. Hint usage shown in game-over stats.
  - Files: `constants/i18n.ts` (WORD_CATEGORIES), `server/gameLogic.ts` (Room.wordCategory, getActiveCategories), `server/routes.ts` (POST /api/game/hint, clearHintsForRoom), `app/lobby.tsx` (category picker), `app/game.tsx` (hint button, filtered inputs, category badge)

- **Sound System APK Fix**: Ensured game sounds work in both Expo preview and production APK builds:
  - Added `assetBundlePatterns: ["**/*"]` to `app.json` — primary fix so sound files are bundled in APK
  - Added `expo-av` to the plugins list in `app.json` for proper native audio initialization
  - Rewrote `lib/sound-manager.ts`: changed `require("@/assets/...")` to relative `require("../assets/...")`, added `Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true })` before any playback, added `Platform.OS === "web"` guard (skip audio on web), added `preloadAllSounds()` export
  - `app/_layout.tsx` calls `preloadAllSounds()` during the splash screen period so all 7 sounds are cached before gameplay starts
  - Freeze/unfreeze sounds in `game.tsx` use `window.AudioContext` (web-only) and already have proper `typeof window === "undefined"` guards — safe on native

- **Friends System Fix**: Fixed three broken flows in `app/friends.tsx` and `server/routes.ts`:
  - **Search** now searches by both player name AND WM code (`playerCode` via ILIKE) — users can type "WM-XXXXXX" to find friends directly
  - **Friends list** endpoint now returns `playerCode` and `playerTag` for each friend (previously missing)
  - **Send request `onSuccess`** was crashing on 400 responses (null `data`) — fixed null-safety, added success/already-exists alerts and an `onError` handler
  - Search placeholder updated to "ابحث بالاسم أو الكود (WM-XXXXXX)"
  - Player cards now show WM code (or #tag) as the primary identifier in the subtitle

- **Shop Complete Redesign (Light Theme)**: Full rewrite of `app/shop.tsx` with:
  - Light theme replacing dark mode: `#EEF2FF→#F5F3FF→#F0FDF4` gradient background, white cards, soft shadows
  - New tab structure: العروض / الأفاتار / تأثيرات / ألقاب / صناديق / العجلة / حزم (removed backgrounds tab)
  - Avatar cards displayed as circular icons with rarity glow rings (borderColor + shadowColor based on rarity)
  - Mystery box opening with full 4-phase animation: box entry → shake (Animated.sequence) → light burst → reward card reveal with spring animation + spark particles
  - Coin Packs tab: 3 tiers (500/1200+200/3000+800 coins) with gradient cards, added locally for testing
  - Design tokens `L` object: purple=#6C63FF, gold=#F59E0B, green=#10B981, card=#FFFFFF, textMain=#1A1A3A, textSub=#6B7A99

- **Titles System**: New `TITLES` array in PlayerContext with 9 titles (beginner/eloquent/word_master/lightning/genius/letter_king/streak_lord/morocco_legend/champion_title). Added `ownedTitles: TitleId[]` and `equippedTitle: TitleId | null` to PlayerProfile. New `purchaseTitle` and `equipTitle` context functions. Titles have rarity tiers, prices, and unlock conditions (wins/level/streak).
- **Shop Redesign — Titles Tab**: New "ألقاب" (Titles) tab in the shop. Shows active title preview bar + full grid of all titles. Buy, unlock by condition, or equip titles. Uses same rarity card system as outfits.
- **Shop Redesign — Spin Wheel Tab**: New "العجلة" (Spin Wheel) tab with a hero banner (purple gradient, animated) that navigates to `/spin`. Shows prizes list and daily tips.
- **Shop Redesign — 3-tier Mystery Boxes**: Mystery box tab renamed to "صناديق" (Boxes). Shows 3 selectable tiers: صندوق أساسي (100 coins), صندوق نادر (300 coins), صندوق أسطوري (600 coins). Each tier has its own gradient, glow color, and reward range. Selected tier highlighted with glow border.

- **Player Code System**: Each player profile now gets a unique `playerCode` (WM-XXXXXX format) generated on creation. Stored in `player_profiles.player_code` column. New players also get a random English name (e.g. Lion_482, Atlas_771) instead of the default Arabic "لاعب".
- **Change Name Endpoint**: `PATCH /api/player/change-name` accepts `{ player_id, new_name }` body and updates the player name in the DB.
- **Friends System**: Search players by name OR playerCode (WM-XXXXXX), send/accept/reject/remove friend requests. DB table `friends` with requesterId/receiverId/status. REST endpoints: `/api/players/search`, `/api/friends/:id`, `/api/friends/:id/request/:target`, `/api/friends/request/:id/:action`, `/api/friends/:id/:friendId`. Additional body-style endpoints: `POST /api/friends/request` and `POST /api/friends/accept`. Frontend: `app/friends.tsx` with 3 tabs (friends/search/requests) + Create/Join Room buttons.
- **Real Leaderboard**: `/api/leaderboard?type=score|wins|xp` queries DB sorted by field. Frontend updated to use real data, shows local player highlighted.
- **Daily Tasks**: DB tables `daily_tasks` (static definitions, seeded on startup) + `player_daily_tasks` (per-player progress). 3 task defs (win_3, play_5, score_200). Endpoints: `GET /api/daily-tasks` (definitions list, no auth), `GET /api/tasks/:id` (player progress, auto-creates player if missing), `POST /api/tasks/:id/:key/claim`. Frontend: `app/tasks.tsx` with claim buttons.
- **Achievements**: DB tables `achievements` (static definitions, seeded on startup) + `player_achievements` (per-player progress). 8 achievement defs (first_win, win_10/50, play_10/100, level_5/10, streak_3). Endpoints: `GET /api/achievements` (definitions list, no auth), `GET /api/achievements/:id` (player progress, auto-creates player if missing), `POST /api/achievements/:id/claim/:key`. Frontend: `app/achievements.tsx` with filter tabs. Player-specific endpoints no longer return 404 for unknown players — they auto-create the profile instead.
- **Auto-matchmaking**: lobby.tsx now auto-starts matchmaking when `coinEntry` param is provided (Quick Match mode bypasses select screen).
- **Daily Login Streak**: `POST /api/player/:id/daily-login` endpoint with atomic update (IS DISTINCT FROM guard prevents race conditions). Streak rewards: day 1→15🪙, day 7→100🪙, day 30→500🪙. Tracks `loginStreak`, `lastLoginDate`, `longestLoginStreak` in `playerProfiles`. Frontend: animated 7-day calendar popup in `_layout.tsx` with coin reward animation, appears 6s after launch.
- **Weekly Challenge**: `WEEKLY_TASK_POOL` (4 tasks), deterministic `getWeekId()`/`pickWeeklyTask()` helpers. Weekly task appears as first item in tasks list with purple gradient border. Uses same claim endpoint with weekly key format (`weekly_key_YYYY-WNN`).
- **Expanded Achievements**: 20 achievement definitions (was 8): added win_25, win_100, play_50, play_500, streak_5, streak_10, level_15, level_20, login_7, login_30, score_5000, first_tournament. `syncAchievementProgress` updated for `login_streak` and `total_score` types.
- **Share Result Card**: Share button on game-over screen using React Native `Share.share()` API. Generates Arabic text with rank, score, and hashtag.
- **Nav bar updated**: الأصدقاء→/friends, المهام→/tasks, الإنجازات→/achievements
- **Tournament Mode**: Knockout tournaments supporting 4/8/16 players. Create Room button with size picker (4/8/16 لاعب), 100 coin entry fee, host player name shown in room list, real-time player count (X/Y), join button per room, empty state "لا توجد بطولات حالياً", auto-start when full, adaptive bracket (semi/final for 4p; quarter/semi/final for 8p; round1/quarter/semi/final for 16p). DB: `tournaments.max_players` column added. Server: `getTournamentRounds()` helper, generic `generateTournamentBracket()` and `advanceTournamentWinner()`. Socket events: `tournament_created`/`tournament_started`/`tournament_player_joined`/`tournament_player_left`/`tournament_update`/`tournament_cancelled`. Screen: `app/tournament.tsx`
- **Rapid Mode**: Best-of-5 speed rounds (10s each), first correct word wins the round, separate matchmaking queue (`rapid_join`/`rapid_cancel`/`rapid_word`/`rapid_leave` socket events), `app/rapid.tsx` game screen, server validation enforces room membership + category match
- **Home screen**: Swipeable FlatList game modes carousel (مباراة سريعة / الوضع السريع / البطولة / غرفة أصدقاء / وضع محلي) with dot indicators, coins badge → shop navigation, profile/XP bar
- **Quick chat**: Preset Arabic message bubbles in game (floating overlay, 3.5s auto-dismiss), speech bubble icon button, received from opponents via socket relay
- **Voice chat**: Push-to-talk voice in friend rooms (lobby), mic permission request, real-time chunk streaming via socket, speaking indicators per player, mute toggle
- **Server relays**: `quick_chat` and `voice_data` socket events added to routes.ts (relay-only, no game logic touched)

## Project Structure

```
app/               # Expo Router screens
  index.tsx        # Home screen
  lobby.tsx        # Multiplayer lobby (create/join rooms)
  game.tsx         # Main game screen + inline results
  rapid.tsx        # Rapid Mode game screen (best of 5, 10s rounds)
  tournament.tsx   # Tournament bracket screen (8 players, 3 rounds)
  offline.tsx      # Offline mode with AI opponents
  leaderboard.tsx  # Player rankings (real DB data)
  friends.tsx      # Friends system (search/add/remove + Create/Join room)
  tasks.tsx        # Daily tasks with claim rewards
  achievements.tsx # Achievement gallery with claim rewards
  shop.tsx         # Skin shop
  settings.tsx     # Language + map settings

contexts/
  LanguageContext.tsx   # i18n (Arabic/English) + map selection
  PlayerContext.tsx     # Player profile, coins, XP, skins
  ThemeContext.tsx      # Dark/light mode toggle + theme tokens (useTheme hook)

services/
  socket.ts            # Socket.io client service

server/
  index.ts             # Express server entry point
  routes.ts            # REST API + Socket.io game server
  gameLogic.ts         # Room management, scoring, round logic
  wordDatabase.ts      # Word validation logic (loads from JSON)
  data/
    wordDatabase.json  # 3500+ Arabic words across 8 categories

constants/
  colors.ts            # Accent-only color constants (gold, emerald, ruby, etc.) — neutral/surface/text tokens live in ThemeContext
  i18n.ts              # Arabic/English translations, letter list
```

## Game Features

1. **Multiplayer Rooms** - Create/join rooms (2-8 players) via Socket.io
2. **28 Arabic Letters** - Random letter selection each round
3. **50-second Timer** - Per-round countdown
4. **8 Categories** - Girl/Boy names, Animals, Fruits, Vegetables, Objects, Cities, Countries
5. **Scoring** - Correct=3pts, Duplicate=0pts, Empty=0pts
6. **Offline Mode** - Play against 2 AI bots
7. **XP & Levels** - Experience points and player levels
8. **Coins System** - 1st=20, 2nd=15, 3rd=10, Others=5 coins
9. **Shop** - 4 skins: Student (free), Djellaba (150), Sport (200), Champion (500)
10. **Bilingual** - Full Arabic/English i18n
11. **5 Map Themes** - Casablanca, Marrakech, Rabat, Tangier, Chefchaouen
12. **Dark/Light Mode** - Full theme system via ThemeContext, toggle in settings, persisted to AsyncStorage

## Running Locally

Backend runs on port 5000, Frontend on port 8081.

Workflows:
- `Start Backend` - Express + Socket.io server
- `Start Frontend` - Expo dev server with HMR

## Deploying to Railway (Online Server)

The backend Express server can be deployed to Railway so the multiplayer works online.

### Files Added
- `railway.toml` — tells Railway how to build and start the server automatically

### Steps
1. Push your code to GitHub
2. In Railway: **New Project → Deploy from GitHub repo**
3. Railway will automatically read `railway.toml` and:
   - **Build**: `npm install && npm run server:build && cp -r server/data server_dist/data`
   - **Start**: `npm run server:prod`

### Environment Variables (set in Railway dashboard → Variables tab)
| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | Set automatically by Railway — do NOT set manually |

### Update Expo App to Point to Railway
In your Expo app, change the server URL to your Railway domain:
- Railway will give you a domain like: `word-master-production.up.railway.app`
- Update `EXPO_PUBLIC_DOMAIN` in your Expo build config or in the app settings

### CORS
The server automatically allows all `*.railway.app` and `*.up.railway.app` domains.
No extra configuration needed for CORS.

## Config Files Note

The project uses `"type": "module"` in `package.json` (for ES modules). Config files that use CommonJS syntax have been renamed to `.cjs` to avoid conflicts:
- `babel.config.cjs` (Babel configuration)
- `metro.config.cjs` (Metro bundler configuration)
- `eslint.config.cjs` (ESLint configuration)
- `scripts/build.cjs` (static build script)

Babel and Metro both support `.cjs` config files automatically.

## Building Android APK

Uses EAS Build (Expo Application Services) with EXPO_TOKEN for CI authentication.

```bash
# Build APK (preview profile = internal APK distribution)
npx eas-cli build --platform android --profile preview --non-interactive --no-wait

# Build release AAB (for Play Store)
npx eas-cli build --platform android --profile production --non-interactive --no-wait
```

### Latest Builds
| Task | Profile | Version | versionCode | Type | URL |
|------|---------|---------|-------------|------|-----|
| #7 | preview | 2.5.0 | 7 | APK | https://expo.dev/accounts/aissam09s-organization/projects/huroof-al-maghrib/builds/ba0fa31b-c17d-4467-aa49-348fe5365449 |
| #8 | production | 2.6.0 | 8 | AAB (Play Store) | https://expo.dev/accounts/aissam09s-organization/projects/huroof-al-maghrib/builds/8444cddb-6d73-49b5-8202-367953d64236 |
| #10 | preview | 2.6.0 | 9 | APK | https://expo.dev/accounts/aissam09s-organization/projects/huroof-al-maghrib/builds/ab981c54-9211-4989-8356-06fde0ffe0e4 |
