# Unified game wallet

New authenticated guest wallets start with 2,000 coins once. `game_wallet_accounts`
marks canonical profiles, whose ID equals the authenticated guest session ID.
Their authoritative balance is `player_profiles.coins`; Store purchases, daily
rewards, free online rewards, entry debits, match payouts and seasonal purchases
all use that row. Existing beta profiles and `online_guest_wallets` balances are
retained without merging or resetting them. The client saves a pre-migration
profile snapshot under `@horof_pre_unified_profile` before changing identity.

Apply migrations 006 then 008 before deploying this backend. The migrations only
create tables and enable RLS; they do not transfer legacy funds. Deploying this
backend keeps legacy clients on their previous wallet behavior. The new Android
build initializes the authenticated wallet and adopts the server balance.

Profile currency/stat snapshots are ignored for canonical wallets. Monetary HTTP
handlers share a transaction and profile-row lock, including nested database
calls. Failed handlers roll back before sending a response. Online ledger debits
use conditional atomic updates and existing exactly-once settlement receipts.
Offline results and level rewards have operation receipts, so retries cannot
credit them twice. Offline results are still client-reported; this is not a
complete anti-cheat system. Offline rewards queue locally until confirmation.

Seasonal paid ownership is stored server-side to prevent repeat charges. Existing
seasonal gifts/objectives and their preview graphics remain device-local. The
cropped static Halloween graphics remain prototypes. No asset IDs are renamed.
Clearing app credentials creates a new anonymous identity; cross-device account
recovery is outside this change.

Validation: TypeScript, server bundle, existing gameplay/commerce tests and
isolated PostgreSQL-compatible HTTP/ledger tests. No production funds are used in
tests. A physical Android update and multi-phone smoke test remain necessary.
