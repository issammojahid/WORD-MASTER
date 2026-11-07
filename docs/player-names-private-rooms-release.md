# Player names and private rooms

This branch contains the current local game updates and the name/private-room fixes. Pushing this review branch does not authorize a production deployment or database migration.

## Behavior

- Private solo rooms send only `maxPlayers`, `rounds`, and `secondsPerRound`, retaining compatibility with old strict servers. Public entry fees and matchmaking fields are excluded even when settings originated in a match snapshot.
- Private 2v2 includes `teamMode: duo` and requires four seats. An old server rejecting the valid team payload produces a specific update-required message; the client does not silently change 2v2 into solo.
- Renaming validates/normalizes the name on the server, serializes competing claims, and returns HTTP 409 for occupied names, including case/spacing/Unicode compatibility variants.
- A prepared unique expression index protects every write path, not only the rename endpoint. Generated server names use a longer cryptographic suffix to reduce accidental collisions.
- Startup takes the server's canonical name so a corrected legacy duplicate does not remain as a stale name on the phone. A rename completed while startup sync is pending is retained.

## Production actions requiring approval

1. Review `server/migrations/007_unique_player_names.sql` and the read-only duplicate preflight. The migration preserves the oldest profile's existing name and suffixes the later duplicates with a deterministic ID-derived suffix. IDs, coins, XP, progress, ownership and messages are not deleted or changed. It aborts and rolls back if any unexpected collision prevents index creation. The table is write-locked briefly; a ten-second lock timeout prevents waiting indefinitely.
2. Back up production and apply the reviewed migration explicitly. Nothing in app/server startup runs it automatically.
3. Deploy the matching server source to Render. In particular, private 2v2 and paid public queues need the new server; a client update alone does not activate them.
4. Build/distribute a new Android version containing the client fixes. An installed old APK is unchanged by a GitHub push.

No new table is required for these fixes; the migration repairs duplicate names and creates one unique index on `player_profiles`. The separate optional seasonal-inventory migration is not required for device-local Halloween.

## Validation

Validated 7 November 2026: TypeScript passed; lint has no errors and three existing hook dependency warnings in `app/spin.tsx`. All 38 selected regression tests passed, including name migration/HTTP requests, legacy and 2v2 private rooms, public paid queues, voice-room authorization, seasonal objectives, daily challenge, and ads behavior.

Read-only production preflight found three duplicate-name groups, with 20 later profiles requiring a suffixed name under the prepared migration; the unique index is not yet present. These are aggregate results only. No production names or tables were changed.

Tests use isolated in-memory PostgreSQL (PGlite) for the actual migration and HTTP rename routes, and real local Socket.IO clients for legacy-room compatibility and 2v2 room behavior. They do not import the production server startup or write production data. The PGlite HTTP adapter serializes its single connection; the actual unique index remains active, while advisory locks themselves are not modeled by that adapter.

The existing profile rename endpoint identifies the profile through its existing request format. This patch does not introduce a new identity/authentication system or change match rewards.

## Approved production cleanup, 7 November 2026

The owner subsequently authorized the production update and requested replacing in-game player names containing `aissam` (case-insensitive, including compatibility-width forms) with available random names. Emails, GitHub/Expo account names, messages and game answers are outside this cleanup scope. No Android package build is authorized for this step.

`scripts/cleanup-player-display-names.ts` requires a private backup directory outside the repository and an explicit `--apply-approved` flag to commit. It first saves the old name cells, locks the affected tables, resolves duplicates and retired names, creates the unique name index, and verifies that non-name profile fields are unchanged. Without the flag, it exercises the transaction and rolls back.

The applied run changed 22 player-profile name cells, four social-profile names, two historical participant names and one result JSON document. It verified zero duplicate profile names and zero retired names in the inspected player-name columns. The private rollback data remains outside Git. Runtime social/socket handling prevents an old client cache from restoring the retired display name to online rooms. An old APK can still display its own local cached profile name; changing server data does not rewrite app storage.
