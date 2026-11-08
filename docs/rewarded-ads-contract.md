> Historical client preparation contract below. The authenticated backend is now implemented and locally tested, but not deployed/activated. See [2027-compatible-release.md](2027-compatible-release.md) for the current 6+6 quotas, SSV setup and rollout requirements.

# Rewarded ads: client ready, backend activation pending

Client entry points: a voluntary coin ad on Home; loss recovery only on a finished public paid match with a losing result (solo, teams or four-player). No recovery card for a win, draw, free match or private room. Existing ad unit IDs, UMP consent and non-personalized requests are reused. The rewarded format is now configured for Android production; availability still requires a successful authenticated server offer before an ad can load. Browser ads remain unavailable.

## Backend interface required (not implemented or deployed here)

- GET /api/rewarded-ads/offer?kind=coins|loss-recovery&matchId=... returns enabled and a positive integer coins quote. Server checks eligibility and limits.
- POST /api/rewarded-ads/sessions receives kind and optional matchId, never a client-selected amount. Returns id, coins and an opaque signed customData token bound to the authenticated player and ad unit, with an expiry.
- GET /api/rewarded-ads/sessions/:id returns pending, credited or expired, and must enforce session ownership.
- Configure the AdMob rewarded unit's server-side-verification callback. Validate Google's callback signature/key and all signed fields, ad unit, transaction ID, token, player, expiry, and intended reward. A client EARNED_REWARD event is not proof of payment.
- Atomically persist and credit each verified transaction once into the unified wallet. Enforce unique transaction IDs and one recovery per player/match. Lost paid match membership and the original entry fee must come from authoritative match/entry records. Wins, draws, refunded/cancelled entries and private matches are ineligible.

Updated daily-page design: six ad milestones labelled 100/250/500/1000/1500/2000. The user confirmed separate per-ad payouts, totalling 5350 coins per day. The backend must enforce six verified ads per day and award the correct next amount atomically. This supersedes the earlier 50-coin/five-ad proposal. Suggested recovery remains min(original paid entry, 500), once per eligible lost match (100 -> 100, 500 -> 500, 1000 -> 500, 2500 -> 500); backend rules are not active.

## Implemented client behavior

The native SDK attaches the authenticated player's ID and server-issued customData to AdMob SSV. A shared fullscreen slot blocks overlapping reward and app-open ads. Early close, load/show error, cancellation and timeout do not trigger client credit. Pending session IDs are retained locally for later verification. After SDK completion the app asks for the receipt; it refreshes the actual wallet only after credited. A pending receipt offers re-check without forcing another view. Missing service (including 404), denial of consent or unsupported platform disables ad viewing. No addCoins call or amount-based wallet action is used.

No server source, schema, production AdMob console setting, Supabase data or deployment was modified. Consequently the current server cannot grant these rewards yet. Cards stay hidden without an enabled authoritative offer, except a previously pending receipt can still be checked. The user explicitly chose client preparation only and declined backend/Supabase changes in this phase. Production activation requires later explicit approval of the limited backend/receipt persistence work and AdMob callback configuration, followed by actual-phone testing. Client test ad completion must never credit production currency.
