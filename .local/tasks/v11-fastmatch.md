# Fast Match: Coin Entry System

## What & Why
The current quick/rapid match mode is free — players join without paying coins and win nothing. The user wants a "Fast Match" experience where players choose an entry fee tier, both players pay to enter, and the winner receives the reward. This makes the mode financially meaningful and gives coins a purpose beyond the shop.

The rapid match server logic already supports `coinEntry` in the matchmaking queue (`QueueEntry.coinEntry`) and deducts coins on join. The client needs to be updated to:
- Show a tier-selection screen before entering matchmaking
- Show the reward clearly before the match starts
- Handle draw (return coins) correctly

## Done looks like
- On entering rapid/fast match, the player sees two options:
  - **50 coins** entry → winner earns 100 coins (displayed as "+100 🪙")
  - **100 coins** entry → winner earns 250 coins (displayed as "+250 🪙")
- If the player has insufficient coins, the button is disabled with "رصيدك غير كافٍ"
- After selecting a tier, coins are deducted locally immediately and the player enters the matchmaking queue with the correct `coinEntry` value
- In case of a draw, both players receive their coins back (+50 or +100)
- The game over screen shows the correct coin reward (from the server's `coinsEarned` field)
- No changes to the server matchmaking logic or socket events

## Out of scope
- Adding a new free-entry rapid match option (the old free mode is replaced)
- Changing the rapid game rules, round duration, or category selection
- Leaderboards or history for fast match results

## Tasks
1. **Tier-selection lobby screen** — Replace the "waiting" phase initial view in `app/rapid.tsx` with a tier selector that shows the two entry options (50 → 100, 100 → 250), coin balance check, and a confirm button that emits `join_rapid` with the selected `coinEntry`.

2. **Reward preview during countdown** — During the countdown phase (before the first round starts), display a banner showing the reward the winner will receive, e.g. "الجائزة: 100 عملة 🪙".

3. **Draw refund display** — When the game ends in a draw, show a specific message "تعادل! استرجعت عملاتك" and ensure the local coin balance is corrected using `addCoins`.

## Relevant files
- `app/rapid.tsx`
- `contexts/PlayerContext.tsx`
- `server/routes.ts:828-860`
- `constants/colors.ts`
