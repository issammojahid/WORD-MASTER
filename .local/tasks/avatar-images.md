# AI Avatar Images for Skins

  ## What & Why
  Replace the emoji placeholders on the 19 avatar skins with real AI-generated character illustrations. The goal is to make the avatars feel like actual characters players are proud to own and show off — in the profile card and in the shop.

  Each avatar gets a unique image. The art style varies by rarity tier so players can instantly recognise how rare a skin is:
  - **Common** — clean, cheerful flat cartoon (think animated sticker)
  - **Rare** — slightly more detailed cartoon with bold outlines and shading
  - **Epic** — expressive caricature style with exaggerated features
  - **Legendary** — dramatic, cinematic caricature with glowing aura effects

  ## Done looks like
  - Every skin in the shop's Avatars tab shows an illustrated character image instead of an emoji
  - The equipped avatar in the profile screen shows the same illustrated character (large version)
  - Rarity is immediately recognisable from the art style at a glance
  - All 19 skin images are present in `assets/avatars/`, each 128×128 px PNG, total weight < 1 MB

  ## Out of scope
  - Renaming rarity labels (common/rare/epic/legendary stays as-is)
  - Changing skin prices, unlock conditions, or game logic
  - Animated avatars (static PNG only)
  - Adding new skins — only updating the existing 19

  ## Tasks

  ### Existing 19 skins to illustrate

  | id | rarity | character concept |
  |----|--------|-------------------|
  | student | common | smiling student boy in cap and gown |
  | djellaba | common | Moroccan man in colourful djellaba |
  | sport | common | energetic kid in football jersey |
  | kaftan | common | Moroccan woman in ornate kaftan |
  | sahrawi | common | desert nomad with turban |
  | champion | epic | muscular champion holding trophy |
  | fassi | rare | noble Fes scholar in traditional attire |
  | amazigh | rare | proud Amazigh warrior with silver jewellery |
  | ninja | rare | stealthy ninja in dark suit |
  | hacker | rare | techy hacker with glowing screen |
  | astronaut | epic | caricature astronaut in space suit |
  | superhero | epic | caped superhero in bold colours |
  | king | legendary | royal king on glowing throne |
  | legend | legendary | glowing mystic legend figure |
  | elite | epic | elite soldier with glowing visor |
  | tourChamp | legendary | tournament champion with golden belt |
  | vip_phoenix | legendary | mythical phoenix rising from flames |
  | vip_sultan | legendary | Ottoman-style sultan with golden crown |
  | vip_cyber | legendary | futuristic cyber warrior with neon accents |

  1. **Generate avatar images** — Use the media-generation skill to create AI character illustrations for all 19 skins, one image per skin. Prompt each character to match their concept and the art style for their rarity tier. Generate at 1024×1024, then downscale to 128×128 with ImageMagick. Save to `assets/avatars/{id}.png`.

  2. **Add image field to Skin type** — Add an optional `image` field (React Native require number) to the `Skin` type and populate it with `require("@/assets/avatars/{id}.png")` for all 19 SKINS entries.

  3. **Update profile avatar display** — In the profile screen's avatar circle, replace the emoji `<Text>` with an `<Image>` sized to fill the circle (resizeMode "cover" or "contain"). Keep the rarity-coloured ring around it.

  4. **Update shop avatar card display** — In the shop's Avatars tab card renderer, replace the emoji `<Text>` inside `avatarCircleInner` with an `<Image>` sized to the circle (60×60). Keep locked opacity behaviour and all existing rarity/equip styling.

  ## Relevant files
  - `contexts/PlayerContext.tsx:1-85`
  - `app/profile.tsx:58,91,132,135,308`
  - `app/shop.tsx:753-790,1382-1400`
  