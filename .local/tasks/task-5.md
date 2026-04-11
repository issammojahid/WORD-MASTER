---
title: AI Background Images — All Screens & Popups
---
# Task #5 — AI Background Images for All Screens & Popups

  ## Objective
  Generate AI-created background images (Moroccan/Arabic game aesthetic, dark & premium) for every screen and key popup in the app, then integrate them using React Native's `ImageBackground` with a semi-transparent dark overlay so text stays readable. Goal: make the game look polished and professional.

  ## Art Direction
  - **Style**: Dark luxury — deep blacks/navies with glowing Moroccan arabesque geometric patterns
  - **Palette**: Per-screen accent color matching the existing game palette (cyan, pink, purple, yellow, green, gold)
  - **Consistency**: All images share the same underlying arabesque tile geometry so the app feels cohesive
  - **Negatives**: no text, no watermarks, no modern/Western patterns, no blurry blobs

  ## Phase 1 — Generate Images (3 batches of ~8, saved to assets/images/)

  ### Batch A — Core Screens
  | File | Screen | Accent | Theme |
  |---|---|---|---|
  | bg_home.png | Home / Lobby | Cyan + Purple | grand Moroccan archway with Arabic letters floating |
  | bg_game.png | Active Game | Pink + Gold | dramatic arena with glowing Arabic calligraphy on stone |
  | bg_lobby.png | Waiting Room | Purple | Moroccan riad courtyard at night, lanterns glowing |
  | bg_tournament.png | Tournament | Gold + Red | colosseum-style Moroccan arena with crowd silhouettes |
  | bg_leaderboard.png | Leaderboard | Yellow + Gold | hall of champions with star-lit domed ceiling |
  | bg_daily.png | Daily Challenge | Green + Teal | compass rose on ancient Moroccan tile, sunrise glow |
  | bg_league.png | League | Blue + Silver | ascending tower levels with neon rank badges |
  | bg_achievements.png | Achievements | Gold | treasure vault with glowing trophies and arabesque walls |

  ### Batch B — Feature Screens
  | File | Screen | Accent | Theme |
  |---|---|---|---|
  | bg_shop.png | Shop / Store | Orange + Gold | Moroccan souk at night, lanterns, treasure chests |
  | bg_battle_pass.png | Battle Pass | Cyan + Blue | cosmic scroll unrolling with reward icons |
  | bg_spin.png | Lucky Spin | Rainbow | mystical spinning wheel chamber with star particles |
  | bg_clans.png | Clans / Wars | Purple + Red | fortress battlements at night with war banners |
  | bg_vip.png | VIP | Gold + Diamond | opulent Moroccan palace interior, rich carpets |
  | bg_friends.png | Friends | Teal + Pink | Moroccan rooftop terrace at sunset, city silhouette |
  | bg_tasks.png | Tasks / Missions | Green | ancient scroll room with glowing mission stamps |
  | bg_ai.png | AI Game | Cyan + Neon | circuit-board merged with arabesque, futuristic blue glow |

  ### Batch C — Mode Screens + Popup Cards
  | File | Screen/Popup | Accent | Theme |
  |---|---|---|---|
  | bg_word_chain.png | Word Chain | Yellow | chain links forged from glowing Arabic letters |
  | bg_rapid.png | Rapid Mode | Red + Orange | lightning-charged Arabic letters, speed blur |
  | bg_spectate.png | Spectate | Grey + Teal | observatory dome with audience silhouette, glowing stage |
  | bg_settings.png | Settings | Dark Blue | minimal Moroccan tile grid, very subtle |
  | bg_popup.png | Generic Popup/Modal | Purple | dark Moroccan arch frame, vignette — 3:4 portrait |
  | bg_popup_reward.png | Reward Popup | Gold | treasure burst with confetti rays — 3:4 portrait |
  | bg_popup_confirm.png | Confirm Dialog | Dark Red | stone arch with subtle warning glow — 3:4 portrait |

  All full-screen backgrounds: 9:16 portrait. Popup cards: 3:4.

  ## Phase 2 — Integration into Each Screen

  For each screen file, wrap the outermost View with ImageBackground:

  ```tsx
  import { ImageBackground } from 'react-native';

  <ImageBackground
    source={require('../assets/images/bg_<screen>.png')}
    style={{ flex: 1 }}
    resizeMode="cover"
  >
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}>
      {/* existing screen content */}
    </View>
  </ImageBackground>
  ```

  For Modals/Popups, wrap the card View (not the full overlay):

  ```tsx
  <ImageBackground
    source={require('../assets/images/bg_popup.png')}
    style={styles.modalCard}
    imageStyle={{ borderRadius: 20 }}
    resizeMode="cover"
  >
    <View style={{ backgroundColor: 'rgba(0,0,0,0.50)', borderRadius: 20, padding: 20 }}>
      {/* modal content */}
    </View>
  </ImageBackground>
  ```

  Use themed popup images:
  - Reward/login popup → bg_popup_reward.png
  - Confirm/leave modal → bg_popup_confirm.png
  - Name edit, box opening, generic → bg_popup.png

  ## Files to Modify
  - assets/images/ — 23 new PNG files
  - app/index.tsx — home + feature popup + name modal + login reward popup
  - app/game.tsx — game bg + chat panel modal + exit confirm modal
  - app/lobby.tsx
  - app/tournament.tsx — screen + 3 modals
  - app/leaderboard.tsx
  - app/daily-challenge.tsx
  - app/league.tsx
  - app/achievements.tsx
  - app/shop.tsx — screen + box opening modal + spin modal
  - app/battle-pass.tsx
  - app/spin.tsx
  - app/clans.tsx
  - app/vip.tsx
  - app/friends.tsx
  - app/tasks.tsx
  - app/ai-game.tsx
  - app/word-chain.tsx
  - app/rapid.tsx
  - app/spectate.tsx
  - app/settings.tsx

  ## Definition of Done
  - All 23 PNG images generated and saved to assets/images/
  - Every screen uses ImageBackground with the correct themed background
  - Every key modal/popup card has a background image
  - Semi-transparent overlay applied everywhere so text contrast is maintained
  - No existing game logic, navigation, or socket events are touched
  - App builds and runs without errors