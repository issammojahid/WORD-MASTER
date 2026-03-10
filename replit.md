# حروف المغرب - Huroof Al Maghrib

A full-featured multiplayer Arabic word game inspired by the "Categories/Stop" game format.

## Architecture

- **Frontend**: React Native with Expo (SDK 54), Expo Router v6, TypeScript
- **Backend**: Express.js with Socket.io for real-time multiplayer
- **State**: AsyncStorage for persistence, React Context for shared state
- **Fonts**: Cairo (Arabic-friendly Google Font)

## Project Structure

```
app/               # Expo Router screens
  index.tsx        # Home screen
  lobby.tsx        # Multiplayer lobby (create/join rooms)
  game.tsx         # Main game screen + inline results
  offline.tsx      # Offline mode with AI opponents
  leaderboard.tsx  # Player rankings
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
