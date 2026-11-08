# 2027 client design checkpoint

Approved visual references are in `C:/Users/aissa/Desktop/wm 2.9.0/horof-2027-ui-designs` and `horof-gameplay-room-previews`. This branch translates their layout into interactive native components. It does not use a screenshot as the interface.

## Implemented client work

- Fixed indigo/purple, gold and turquoise identity across the shared background, cards and controls.
- Home: compact wallet/profile/settings HUD, Moroccan hero, five selectable mode tabs synchronized with the swipe cards, automatic/manual event carousel with pause and reduced-motion support.
- Store: five compact tiles per row (three at enlarged system text), separate selection tray and detailed preview with the existing purchase confirmation/equip flow. IDs, prices and inventory are unchanged.
- Profile: portrait, editable name, player code, XP, 2x2 statistics and four appearance shortcuts. Settings: six control tiles and compact information sections. Tasks/achievements: compact card grids.
- Offline/online answers: all eight categories in one panel, next-field keyboard navigation; existing keyboard-aware scrolling retained. Native keyboard behavior still needs a real device check.
- Friends: four seats around a table, eight-player roster in two rows, compact room settings; quick messages next to the microphone at the top. Peer avatars use a fallback because the existing room messages do not provide their equipped cosmetic data.
- Entry selection: existing fees and actual wallet availability retained, with compact 2x2 tiles. No reward or entry accounting was changed.
- Halloween promotions and launch pop-up disabled for this post-Halloween release. Owned cosmetics remain available. Historical IDs, assets and saved data were retained.
- Five consecutive December display windows are bundled, including December 31–January 3. This local display calendar does not authorize rewards.

## Art

Project-bound images are under `assets/ui-2027` and `assets/seasons-2027`. Existing assets were not deleted. New art was generated with the built-in image tool using the approved store as a style reference.

`portraits-atlas.png` is a 2-column, 4-row texture, read row-major: student, djellaba, sport, amazigh, astronaut, ninja, king, champion. The renderer selects a cell without modifying the file. Other legacy skins retain their previous illustrations.

Portrait prompt: polished 3D storybook Moroccan fantasy portraits matching the approved store; indigo night skies and warm gold lighting; eight equally sized square bust portraits in a straight 2x4 grid; no text, prices, UI, gutters or borders. Subjects: red-fez scholar with book; terracotta traveler; green athletic courier; blue/silver Amazigh heroine; silver celestial explorer; violet shadow guardian; gold-crowned king; turquoise champion.

Core illustrations: text-free red-fez wizard and book against a Moroccan night landscape for the home; an unoccupied round zellige table/lounge for friends; a quiet dark purple gameplay background with gold edge ornaments. All are static raster artwork, not animated characters.

The December pack now also contains a 5-column by 6-row alpha atlas per event: five avatars, five frames, five victory motifs, five backgrounds, five nameplates and five icons. The 150 named items have UI-only `preview:2027:` keys, separate from all existing inventory IDs. Source boards were used as references to regenerate clean atlases without headings or grid lines. Original boards and the earlier six-sprite prototype textures remain intact.

`SeasonCatalogArtwork` selects one cell. `SeasonItemPreview` composes frames around the player's portrait, places their name on a plaque, previews backgrounds and animates presentation particles in five patterns. These are static raster characters/motifs with UI motion, not skeletal or frame-by-frame character animation. `SeasonChestPreview` cross-fades four authored chest-opening keyframes and raises a sample icon; it never awards an item. Motion respects reduced-motion/low-quality settings; periodic particle animations stop when the app is backgrounded. Frame centers have near-transparent alpha; the generated sheets still require final device/GPU edge-quality review before release.

All six categories can be inspected separately in `/season?event=atlas` (and `arabic`, `winter`, `gifts`, `newyear`). Purchase, equipment, objective and reward wiring is deliberately absent from this gallery. No preview key is sent to production services.

## Isolated local preview

The UI fixture service is `scripts/ui-preview-server.ts`, bound to 127.0.0.1:39888. It uses disposable in-memory profile/task data and local room support. The matching Metro preview runs on port 8084 with `EXPO_NO_DOTENV=1` and `EXPO_PUBLIC_API_URL=http://localhost:39888`. This preview must never be mistaken for production verification. Unimplemented purchase/reward APIs deliberately return an error rather than modifying a real account.

No production backend, Supabase, schema, deployment, push, APK or AAB was changed or produced for this checkpoint.

## Remaining release work

Review all generated atlas edges, readability and motion on real devices, then compare each final screen to its approved reference. Choose reward acquisition rules and do production wiring only in the later authorized backend phase. Leaderboard/rewarded-ad recovery is pending that phase; no client-only balance minting. Verify keyboard, safe areas, voice and native ad behavior on actual phones/tablets before a release build.
