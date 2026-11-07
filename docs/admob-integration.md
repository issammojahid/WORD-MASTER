# AdMob integration

The app uses `react-native-google-mobile-ads` 15.4.0 with Expo's config plugin. This version supports the project's React Native 0.81.5 runtime and New Architecture. AdMob requires a native development build; it does not run in Expo Go.

## Build and test

- Development and preview EAS profiles use Google's test ad units.
- Local runs use test units unless `EXPO_PUBLIC_ADMOB_MODE=production` is explicitly set.
- The production EAS profile selects the supplied Android App Open and Banner units. iOS production requests are disabled until iOS ad-unit IDs are configured.
- The iOS native app ID is Google's sample app ID; it is not a production ID.

Build an Android development client, then start Expo with:

```powershell
eas build --profile development --platform android
npx expo start --dev-client
```

Rebuild the development client whenever native configuration or native dependencies change.

## Consent and placement

The app refreshes UMP consent information before initializing the ads SDK. If consent is unavailable or ads are not permitted, gameplay continues and ads remain disabled. Requests are non-personalized, and the maximum ad-content rating is PG. If UMP requires a privacy-options form, it is available in Settings.

The Home banner is placed inside the scrolling content above the fixed navigation. App Open ads are limited to returning to Home after at least 30 seconds in the background, are not shown on the first launch or gameplay routes, and have a four-hour display cap and cache-age limit.

Publish the appropriate EEA/UK consent message in AdMob before serving production ads. Confirm the app's audience and age-related settings in AdMob/Play Console; the client deliberately does not assume that every player is an adult.

## Rewarded ads

The Android rewarded unit is recorded in the ad configuration but is not requested in production, and no "watch for Coins" action is shown. The current game does not have an authenticated AdMob SSV reward flow tied to its player wallet. Before enabling rewards, implement and deploy server-side SSV signature verification, a transactional/idempotent reward ledger, an authoritative account-to-player binding, and a configurable daily cap. A client-side reward callback must never credit Coins.
