# Online connection investigation

The desktop agent reproduced the Android APK error in BlueStacks.

Verified production: Supabase has 36 public application tables with RLS enabled; Render service is https://word-master-backend.onrender.com, tracking supabase-render-backend.

A Node socket probe without Origin succeeds, creates a guest session and a private room. The same probe with Origin: https://word-master-backend.onrender.com fails during WebSocket handshake. The server CORS callback accepts Railway/Replit and configured origins, but omitted Render's own external origin, which Android sends.

Fix prepared in server/index.ts and server/online-multiplayer.ts: add new URL(process.env.RENDER_EXTERNAL_URL).origin to the existing allowed-origin sets. No wildcard or arbitrary onrender.com hosts are allowed. Authentication remains required.

Local integration test with RENDER_EXTERNAL_URL set: exact Render origin accepted; https://untrusted.invalid rejected. Backend build succeeds. Publish only these two server changes to supabase-render-backend, then verify production with Android Origin and BlueStacks. Do not overwrite unrelated frontend work or expose .env.

## Confirmed Android/BlueStacks storage failure

ADB logcat from the installed app exposed `ERR_DECRYPT` in `ExpoSecureStore.getValueWithKeyAsync` for `online_guest_token_v1`; the restored encrypted entry no longer matches the Android keystore. services/socket.ts now catches only ERR_DECRYPT, deletes only that unreadable credential, and creates a fresh online session. It leaves player progress untouched and rethrows unrelated storage errors. Mocked-native regression checks passed for corrupt, valid, and unrelated-error cases.

Server origin fix is deployed as e083e31. The user's physical Android phone connected afterward. A live random match between that phone and a controlled test client completed matchmaking, readiness, all five rounds, round results, and final results for two players. A replacement APK for the BlueStacks recovery fix is building at Expo build 207e107c-8147-4f70-a8bf-8f776c305f32. Next: install it over the existing BlueStacks app without clearing data, then verify online connection and room creation.

## BlueStacks retest and session consistency

Build 207e107c was installed as an in-place update. BlueStacks recovered online connectivity and successfully created private room XCC7YG; existing 1265 local coins remained. Reopening online exposed a separate wallet read failure (`guest_session_missing`) despite an authenticated socket. services/socket.ts now retains the authenticated token in memory and coalesces concurrent guest-token acquisition with a single in-flight promise. Native secure storage remains the persistent store. A regression probe with ten simultaneous requests and a permanently failing native read produced one new guest session and a successful authenticated wallet request with no second keystore read. Updated APK build: c36ef71e-12bc-4e08-975d-4d1726baf28b. Final pending verification: install over existing BlueStacks app, check online, wallet, room creation, and re-entry with no error banner.

## Final verification completed

Build c36ef71e finished and was installed over the existing BlueStacks app without clearing data. Entered online twice: connected indicator, no error banner. Private room CBP2VX was created and then left cleanly. Current-process ReactNativeJS error log was empty. Local balance remained 1265 coins. Final APK: Huroof-Al-Maghrib-online.apk (101.4 MiB, ZIP integrity verified), https://expo.dev/artifacts/eas/-jsp31jDBNXRRgCO0Z9U5ZDisRouMxyRL_pehXoiy1I.apk .
