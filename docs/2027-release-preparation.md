> Historical client-only preparation below. Current local integration/deployment status is documented in [2027-compatible-release.md](2027-compatible-release.md). Do not treat the historical blockers or “no server source changed” statement as the current worktree status.

# Local release preparation

## Completed

- Removed the upcoming-features link and page content. Old deep links redirect home; the wallet opens the existing store.
- Added a native gold/turquoise shield and two banners for Clans, promoted its home shortcut, and standardized Arabic clan terminology. Existing clan requests, fees and rewards are unchanged.
- Connected existing win/lose audio and a newly synthesized neutral draw chord to offline, public online, teams, friend rooms and daily challenge outcomes. Ranked leaders tied for first get draw audio. Playback waits for saved preferences, respects effects mute, stops on background/navigation, cancels pending loads, and suppresses repeats. Browser audio remains disabled by the existing manager.
- Added five opt-in local daily reminders at 10:00, 13:00, 16:00, 19:00 and 21:00 in device-local time. No new push token is registered by this client. Android's channel is created before requesting permission. Startup/resume reconciles without prompting. Repeated enables do not duplicate notifications; disabling cancels only this schedule; partial schedule failures roll back. Revoking OS permission clears scheduled reminders. Existing remote-push implementation remains untouched and unused by the new registrar/settings.
- Disabled the internal seasonal artwork showcase for player-facing builds, including direct event links and store previews. Upcoming events show artwork and dates only. Removed inactive prototype power cards, ad-recovery cards and weekly reward-roadmap UI. Owned historical cosmetics remain intact.

The draw WAV is original procedural audio: mono 22,050 Hz, 16-bit PCM, 0.85-second decaying C-major chord (523.25/659.25/783.99 Hz); no external sample was used.

## Validation

TypeScript passed after refreshing Expo's generated route cache with its own generator. Focused ESLint passed. Six focused tests passed: outcome classification, once-only/mute/focus audio behavior, reminder scheduling/permission/idempotency/rollback/revocation, seasonal boundaries, archived ownership, and wallet retry/concurrency. Browser review verified removal of the features link, its deep-link redirect, hidden seasonal store items, event status page, and Clan shortcut. No real purchase, claim or microphone action was performed.

## Release blockers still requiring separate work

- Actual Android/iOS sound, notification delivery, battery restrictions, keyboard, voice and tablet tests. OS delivery timing is not guaranteed by a scheduled-notification API. No physical phone was tested in this phase.
- Backend activation of seasonal purchases, authoritative dates, grants/objectives, leaderboard results and rewarded-ad recovery. These are not enabled merely by reaching a local calendar date. The client deliberately does not mint rewards or expose a fake purchase flow.
- Final privacy/terms pages and verified deletion procedure are not supplied by these changes.
- Five local reminders do not impose a total cap on legacy remote pushes already registered by older clients. A combined remote/local cap or removal of old tokens needs separately authorized backend work. No production settings or tokens were modified here.

No server source, Supabase data/schema, deployment, push, version bump, APK or AAB was changed or produced. Existing unrelated server_dist and .agents work remains excluded.
