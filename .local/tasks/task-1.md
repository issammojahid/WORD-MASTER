---
title: Trigger Railway Deploy with DB Migration
---
# Trigger Railway Deploy with DB Migration

## What & Why
Railway is not auto-deploying from GitHub pushes, so the production database is missing schema tables. This causes `server_error` on `/api/daily-challenge`, `/api/tasks/:id`, and `/api/achievements/:id`. The `railway.toml` already includes `npm run db:push` in the `buildCommand`, so triggering a fresh Railway deploy will run the migration automatically. We have a `RAILWAY_TOKEN` from the user to authenticate the CLI and trigger the deploy.

## Done looks like
- `GET https://word-master-production.up.railway.app/api/daily-challenge` returns JSON with `letter` and `wordLength` (not a server error)
- `GET https://word-master-production.up.railway.app/api/tasks/test` returns a tasks array
- `GET https://word-master-production.up.railway.app/api/achievements/test` returns an achievements array
- Daily Challenge, Tasks, and Achievements screens work on the phone

## Out of scope
- Any code changes (everything is already correct)
- UI changes

## Tasks
1. **Save RAILWAY_TOKEN secret** — Use `requestEnvVar` to securely save the Railway token the user has provided so it can be used by the CLI.

2. **Install Railway CLI and trigger deploy** — Install the Railway CLI, authenticate using the saved token, link to the correct project/service, and trigger a new deployment so Railway runs the updated `buildCommand` (which includes `db:push`).

3. **Poll and verify production routes** — After triggering the deploy, poll `/api/daily-challenge`, `/api/tasks/test`, and `/api/achievements/test` every 30 seconds until all three return valid JSON (no server error), confirming the migration completed successfully.

## Relevant files
- `railway.toml`