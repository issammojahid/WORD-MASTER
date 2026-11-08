# 2027 client/backend integration — prepared locally, not deployed

## Review result (8 November 2026)

Worktree: `release/2027-compatible`. The original `design/2027-seasonal-ui` checkout and its running preview are unchanged. No APK/AAB or AdMob console change has been performed. A fresh public-schema pg_dump backup was restored into password-protected loopback PostgreSQL and successfully migrated without changing historical record/balance aggregates. The reviewed additive migrations were then applied to production Supabase. Backend publication status is recorded below. Production Supabase was inspected inside `BEGIN READ ONLY`: core profiles, online sessions/matches, social profiles, unified wallets and seasonal inventory exist; `rewarded_ad_sessions` and `player_deletion_requests` were absent at inspection and now exist after the reviewed migration.

## Implemented

- Server-authoritative daily ads: 6 independently paid stages (100, 250, 500, 1000, 1500, 2000 = 5350) per Casablanca calendar day, plus 6 separate eligible loss recoveries. Recovery is min(entry fee, 500), once per completed non-abandoned lost public paid match within 24 hours. Client-selected amounts and SDK-only completion cannot credit the wallet. Google signed SSV, opaque expiring player-bound reservations, unique transaction IDs and wallet transactions prevent duplicate payment. Server errors can be retried; malformed/invalid callbacks are rejected. No test callback or native test-ad bypass exists in the production routes.
- Active seasonal catalog, persistent ownership, one of four free gifts, authoritative prices/purchases, equipment and public cosmetic-only appearance. Canonical inventory IDs are separate from the prototype artwork keys. Ownership survives end dates and deployment rollback. Existing item IDs and Halloween inventory are untouched.
- Five events: Atlas 1–11 December; Arabic 12–18; Winter 19–24; Gifts 25–30; New Year 31 December–3 January. Boundaries are midnight Morocco UTC+1, inclusive opening/exclusive closing. Client banners use server clock offset after synchronization. Backend date checks always decide grants and purchases.
- Each event has 5 items in 6 categories (150 total). Variants 1–3 cost 3000/18000/60000; four category-variant-1 items are gift choices. Variant 4 is a five-completed-public-games task, variant 5 a three-public-wins achievement. Friend rooms and client-provided totals cannot grant these rewards. These event counters start at the event boundary, not account lifetime. There is no additional coin payout for these item objectives.
- Updated Store, event, task/achievement and profile flows, including 5-column responsive grids, explicit purchase confirmation, reduced-motion gift reveal and display animations. A failed secondary wallet refresh does not misreport a committed gift/purchase as failed.
- Actual top-50 stored profile leaderboard, global or country-filtered, with loading/error/retry/empty states. Rankings use existing total_score/wins; historical/offline totals have not been retroactively certified as cheat-proof. No leaderboard coin rewards were invented.
- New prices are authoritative for **all** clients, as explicitly chosen by the owner. Older clients quoting old prices receive `409 price_changed`, with no charge; they need an app update to buy. Gameplay and legacy matchmaking remain supported. Previously owned items stay owned.
- Unified profile sync cannot grant owned skins/titles or equip an unowned skin/title. Duplicate purchase receipts are checked before insufficient-balance handling. Legacy profile protocols are retained.
- Support/privacy email confirmed: issammojahid1@gmail.com. Arabic privacy and terms are shared between Settings and public `/privacy`, `/terms`, `/delete-data` pages. An authenticated, explicit deletion request is idempotently queued. It never silently deletes an account.
- Operator-only deletion fulfillment is tested against an isolated full schema: review ownership, stop application instances, resolve active matches/tournaments/bets, take/restore-test a backup, then explicitly fulfill one request. It removes credentials/profile/inventory/messages, transfers clan leadership and anonymizes shared match/tournament results. The anonymous request receipt remains unlinked to the deleted account. No production deletion was attempted.
- Private-room voice now receives STUN and optional one-hour coturn REST credentials only after room-membership authorization. The shared TURN secret never reaches the client. New fields in the existing join acknowledgement are additive; old clients ignore them. STUN alone cannot guarantee connectivity across every mobile/Wi-Fi NAT. A real TURN service still needs to be supplied/configured, then tested across networks.

## Local evidence

The final full suite passed 87 tests after ownership/voice hardening. TypeScript, focused ESLint and backend bundling passed. Android Hermes/assets export passed (this is not a signed APK/AAB and does not exercise native microphone/ad SDK behavior).

Browser review used a separate in-memory API (`scripts/release-preview.ts`, loopback 6060) and a separate Metro preview (8085). Its injected clock is 3 December and its 100000 sample coins are fictional. Tested 390×844 phone and 768×1024 tablet, reveal-all-before-choice, one gift, actual equipment on the profile, locked objective, explicit purchase and 100000→82000 wallet update. Screenshots are saved in the workspace's `previews/release-compatible` folder.

Artwork remains static prototype sheets/cutouts with interface animations, not independently rigged animated characters or final production animation files. The old Halloween previews remain archived. No physical phone was available; the owner explicitly chose to continue local testing.

## Reviewable deployment plan

1. Create a fresh database backup with official pg_dump and test restoration. Official EDB PostgreSQL 17.11 portable tools were downloaded into the ignored .build-tmp directory; no system service was installed. The fresh dump and restored test data stay outside Git. Keep backups out of Git and never print connection credentials.
2. Run `scripts/release-database.ts --plan` (default, no DB connection), then `--check` against the deliberately selected database. The apply command requires a fresh pg_dump file and exact hostname confirmation. It wraps the additive migrations and checksums in one transaction with timeouts/advisory lock. It never runs destructive 002 or renames players with 007. Existing 004/005/006/008 are idempotent prerequisites; new work is 009/010.
3. After explicit production approval, apply the reviewed migrations; push/deploy reviewed backend sources with the existing 2.7.2 null-wrapper compatibility fix retained. Avoid mixing unrelated server_dist/.agents edits from the original checkout. Verify health and old/new socket flows.
4. This reviewed release enables the seasonal schedule by default; `SEASON_2027_ENABLED=false` is the emergency off switch. It does not open events early; the server's real clock still gates dates. Keep `REWARDED_ADS_ENABLED=false` until AdMob SSV callback configuration and native testing succeed.
5. Configure the rewarded unit callback to `/api/rewarded-ads/ssv` on the existing HTTPS backend. Set the exact signed `ADMOB_SSV_AD_UNIT`, nominal `ADMOB_SSV_REWARD_ITEM` and nominal `ADMOB_SSV_REWARD_AMOUNT`; these are the AdMob unit's values, not the staged coin payouts. Validate a genuine callback before activation.
6. Supply `VOICE_TURN_URLS` and server-only `VOICE_TURN_SECRET` for an actual coturn REST-compatible relay, then test two different real networks. Do not embed permanent relay credentials in Expo public variables.
7. Review/publish the privacy URLs in Play Console and monitor the deletion inbox/support email. The in-app path and public request path do not remove the need to actually process requests. Commands in `scripts/privacy-requests.ts` default to listing pending requests; fulfillment requires explicit request/player, stopped-server assertion and a fresh backup. Never execute fulfillment during ordinary deployment.
8. Schedule real Android checks for ads/receipts, failed/closed ads, voice opt-in/mute/leave, keyboard/small screens, sounds, permission denial, notifications and battery restrictions. Existing five opt-in local reminders do not impose an aggregate cap on remote pushes registered by historical clients; those old tokens need a separately reviewed delivery migration if a strict total cap is required.

Rollback: disable new feature flags and restore the prior backend deployment. Leave the additive tables and new ownership/receipts in place; dropping them would lose data and is not an ordinary rollback. New clients fail closed when endpoints are unavailable. No production rollback has been executed.

## Reference documents checked

- [AdMob server-side verification](https://developers.google.com/admob/android/ssv)
- [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Google Mobile Ads data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)
- [WebRTC TURN connectivity](https://webrtc.org/getting-started/turn-server)
- [coturn REST temporary credentials](https://github.com/coturn/coturn/wiki/turnserver)

These references guide the implementation; they do not certify the app's compliance or replace verification of the owner's actual retention/hosting and store declarations.

## Publication status

Production additive migrations applied after a successful backup/restore rehearsal. No profiles, balances, old inventories or match records were intentionally rewritten. Backend Git publication and health verification are the next step. Rewarded currency remains disabled until SSV configuration/native verification. TURN relay service credentials are not supplied. The owner deferred physical-phone tests because no device was available.
