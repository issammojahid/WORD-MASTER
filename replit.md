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

- **Friends System**: Search players by name, send/accept/reject/remove friend requests. DB table `friends` with requesterId/receiverId/status. REST endpoints: `/api/players/search`, `/api/friends/:id`, `/api/friends/:id/request/:target`, `/api/friends/request/:id/:action`, `/api/friends/:id/:friendId`. Frontend: `app/friends.tsx` with 3 tabs (friends/search/requests) + Create/Join Room buttons.
- **Real Leaderboard**: `/api/leaderboard?type=score|wins|xp` queries DB sorted by field. Frontend updated to use real data, shows local player highlighted.
- **Daily Tasks**: DB table `player_daily_tasks`. 3 tasks (win_3, play_5, score_200). `/api/tasks/:id` and `/api/tasks/:id/:key/claim`. Frontend: `app/tasks.tsx` with claim buttons.
- **Achievements**: DB table `player_achievements`. 8 achievements (first_win, win_10/50, play_10/100, level_5/10, streak_3). `/api/achievements/:id` and `/api/achievements/:id/claim/:key`. Frontend: `app/achievements.tsx` with filter tabs.
- **Auto-matchmaking**: lobby.tsx now auto-starts matchmaking when `coinEntry` param is provided (Quick Match mode bypasses select screen).
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
  colors.ts            # Moroccan-themed dark color palette
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

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS
eas build:configure

# Build APK (development)
eas build --platform android --profile preview

# Or build release APK
eas build --platform android --profile production
```
