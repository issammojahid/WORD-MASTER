# Supabase PostgreSQL setup

The Node.js API uses `pg` and Drizzle ORM through `server/db.ts`. The Expo app does not connect to Postgres directly. `DATABASE_URL` is a backend-only secret; do not prefix it with `EXPO_PUBLIC_`.

## Local development

1. In Supabase, open **Project → Connect** and copy the PostgreSQL **Session pooler** connection string. Replace its password placeholder with the database password from the project setup/reset flow. URL-encode special characters in the password.
2. Copy `.env.example` to `.env` in the repository root and set `DATABASE_URL` to that connection string. `.env` is git-ignored; never paste the real URL into chat or commit it.
3. Check connectivity without printing credentials or changing the database:

   ```powershell
   npm run db:check
   ```

4. Start the API locally with `npm run server:dev`. Offline gameplay remains client-side and does not require this connection.

The pool uses TLS with certificate verification for Supabase hostnames, a bounded pool size, and connection/idle timeouts.

## Render

In the Render service, open **Environment → Add Environment Variable** and add:

- **Key:** `DATABASE_URL`
- **Value:** the PostgreSQL Session pooler URI copied from Supabase **Project → Connect**

Save the environment variable and redeploy/restart the service. Keep the value in Render's secret environment configuration, not in source control or an Expo public variable.

If Supabase provides a direct connection URI, use the Session pooler for Render when direct IPv6 connectivity is unavailable. Use the exact host, port, username, and TLS query parameters shown in Supabase's Connect panel.

## Existing schema and authentication

- Player profiles and their Coins are stored in `player_profiles`; the Node.js backend owns reward and match updates.
- Online multiplayer uses `online_guest_sessions`, `online_guest_wallets`, and match tables. Social friends, private chat, notifications, and game invites are defined by the additive social migration.
- Missions and achievements use `daily_tasks`, `player_daily_tasks`, `achievements`, and `player_achievements`.
- The `users` model exists, but `server/storage.ts` uses in-memory storage and is not wired into the player API. Current online identity uses the backend-issued guest-session token. This integration does not add Supabase Auth or change authentication.
- No migration copies, resets, or deletes player data. The client does not receive database credentials.

## Migrations

The repository has two historical migration directories and no safe automatic migration runner. Inspect the target database before applying SQL. In a brand-new empty Supabase database, use the Supabase SQL Editor and apply:

1. `migrations/0000_volatile_lockjaw.sql` — baseline profiles/Coins, missions, achievements, and other original tables. This baseline is intended only for an empty database; do not re-run it where those tables already exist.
2. `server/migrations/001_online_multiplayer.sql`
3. `server/migrations/003_social_features.sql`
4. `server/migrations/004_cosmetic_inventory.sql`
5. `server/migrations/005_retained_gameplay.sql` — additive seasons, clans, and daily challenge schema plus missing profile fields.

Do **not** apply `server/migrations/002_optional_remove_friends.sql`; it drops legacy friendship tables. `migrations/0001_spectator_bets.sql` belongs to the removed spectator feature and is not needed for the retained game.

For a database that already contains player data, do not apply the baseline blindly. Check existing tables/columns first, back up the database, and apply only missing additive migrations. The SQL files do not transfer records from another PostgreSQL provider; if the old database has player progress, export/import it separately before switching `DATABASE_URL`.

`npm run db:schema` runs Drizzle's schema-push command, not a reviewed migration; do not use it as a production migration shortcut. The supplied `npm run db:check` only runs `SELECT 1`.

## Supabase configuration

No Supabase project URL, anon key, service-role key, or Supabase Auth configuration is required for this server-side PostgreSQL integration. The only required secret is `DATABASE_URL`, obtained from **Project → Connect**. Keep the Supabase database password private.
