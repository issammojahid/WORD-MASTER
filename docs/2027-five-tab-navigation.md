# Five-tab navigation and event art

Bottom navigation now reads visually left to right: Store, Achievements, Home, Tasks, Leaderboard. Home occupies the middle position. Leaderboard uses a dedicated transparent gold/turquoise 1–2–3 podium image in its tab, title and empty state; Achievements keeps its trophy. The duplicate home leaderboard shortcut was removed.

Season event cards were reduced from 180 to 140 points high at normal text size, with extra height for enlarged local text preferences. Game mode cards were not resized. Five newly authored event scenes are mapped by event identity: Atlas treasure chest, magical Arabic library/book, winter ice palace, gift boxes, and the New Year gateway/fireworks. The same scenes appear in the event gallery and collection banner. Cosmetic inventory and reward eligibility remain unchanged.

Art is static raster artwork generated with the built-in image tool. Asset paths and complete prompts are recorded in 2027-navigation-event-art.json. The original art remains intact.

Validation: TypeScript passed after refreshing Expo's generated route declaration using Expo Router's own generator. Five season/catalog/motion tests passed. Browser checks confirmed five tabs, centered Home, Leaderboard selection and distinct podium art, plus event carousel navigation. Backend-dependent leaderboard results remain inactive. No server, Supabase, production assets or deployment was changed.
