import { TurboModuleRegistry } from "react-native";

let adsModule: typeof import("react-native-google-mobile-ads") | null = null;
let checked = false;

export function getGoogleMobileAds(): typeof import("react-native-google-mobile-ads") | null {
  if (checked) return adsModule;
  checked = true;
  try {
    const hasNativeModule = TurboModuleRegistry.get("RNGoogleMobileAdsModule");
    if (hasNativeModule) {
      adsModule = require("react-native-google-mobile-ads");
    }
  } catch {
    adsModule = null;
  }
  return adsModule;
}
