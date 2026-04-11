---
title: Shop visuals: title images, chest images, coin pack icons, harder spin wheel
---
# Shop Visual & Spin Wheel Update

  ## What & Why
  Four improvements to the shop to make it richer and fairer:
  1. **AI-generated images for Titles** — 10 title cards show illustrated icons instead of emojis
  2. **AI-generated images for Mystery boxes** — 4 box tier cards show illustrated chest art
  3. **Spin wheel harder + atmosphere** — add more wheel segments (12 total) to dilute the easy-win probability for big prizes, plus improve visual glow/particle effects on the wheel screen
  4. **AI icons for coin packs** — 3 coin-pack cards in the coins tab get illustrated icons

  ## Done looks like
  - Title cards in the shop show illustrated badge/medallion icons per title
  - Mystery box tier cards show illustrated treasure chest images
  - Spin wheel has more segments (~12) so winning 500 coins or a power card is visually and statistically rarer, plus the spin page has better glow effects
  - Coin pack cards display distinct illustrated icons (bronze bag, gold bag, diamond bag)

  ## Out of scope
  - Changing spin wheel backend cooldown logic
  - Changing mystery box prices or prize tables
  - New titles or new coin packs

  ## Tasks

  ### 10 Titles to illustrate (assets/titles/)
  | id | concept |
  |----|---------|
  | beginner | simple graduation scroll badge |
  | eloquent | glowing speech bubble with golden letters |
  | word_master | ancient open book with magical light |
  | lightning | electric lightning bolt with cyan glow |
  | genius | glowing brain with purple neon circuits |
  | letter_king | ornate crown with letter-shaped gems |
  | streak_lord | blazing flame streak fire chain |
  | morocco_legend | glowing golden star with Moroccan geometric pattern |
  | champion_title | gold championship medal with ribbon |
  | vip_gold | golden VIP badge with crown |

  ### 4 Mystery box images (assets/chests/)
  | id | concept |
  |----|---------|
  | basic | simple wooden treasure chest, grey tones |
  | rare | purple glowing enchanted chest with magic runes |
  | epic | fiery legendary chest with pink/red flame effects |
  | legendary | golden glowing epic chest with starbursts |

  ### 3 Coin pack images (assets/coin-packs/)
  | id | concept |
  |----|---------|
  | starter | bronze coin pouch with coins spilling |
  | medium | green gem chest overflowing with gold coins |
  | premium | gleaming diamond chest with golden crown |

  1. **Generate title images** — AI-generate 10 title badge illustrations matching the concept per title, rarity-appropriate art style, transparent background. Downscale to 128×128. Save to `assets/titles/{id}.png`.

  2. **Wire title images** — Add `image: number` field to `Title` type and all 10 TITLES entries in PlayerContext.tsx. In shop.tsx titles renderer, replace `<Text style={avatarEmoji}>{title.emoji}</Text>` with `<Image source={title.image} />`.

  3. **Generate chest images** — AI-generate 4 chest illustrations (basic/rare/epic/legendary) at 1024×1024, downscale to 160×160. Save to `assets/chests/{id}.png`.

  4. **Wire chest images** — Add `image` field to BOX_TIERS in shop.tsx. Replace `<Text style={boxTierEmoji}>{tier.emoji}</Text>` in the mystery box card with `<Image source={tier.image} />`.

  5. **Generate coin pack images** — AI-generate 3 coin pack illustrations, downscale to 128×128. Save to `assets/coin-packs/{id}.png`.

  6. **Wire coin pack images** — Add `image` field to COIN_PACKS in shop.tsx. Replace `<Text style={coinPackEmoji}>{pack.emoji}</Text>` with `<Image source={pack.image} />`.

  7. **Spin wheel harder + atmosphere** — In `app/spin.tsx`, expand WHEEL_SEGMENTS from 8 to 12 by duplicating low-value coin slots (add 4 more "50 coin" and "100 coin" slots), so the 500-coin and power-card slots shrink from 12.5% to ~8.3% probability. Also improve visual effects: stronger radial gradient glow behind wheel, add a few more particle emoji, increase glow ring opacity on active spin.

  ## Relevant files
  - `contexts/PlayerContext.tsx:149-179`
  - `app/shop.tsx:146-158,968-1044`
  - `app/spin.tsx:28-37`