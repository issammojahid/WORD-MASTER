import { Platform } from "react-native";

export type AdFormat = "appOpen" | "rewarded" | "banner" | "interstitial";

const androidProductionAdUnitIds: Partial<Record<AdFormat, string>> = {
  appOpen: "ca-app-pub-8545693631358718/5352085289",
  rewarded: "ca-app-pub-8545693631358718/5071837508",
  banner: "ca-app-pub-8545693631358718/3758755836",
};

const testAdUnitIds: Record<AdFormat, string> = {
  appOpen: "ca-app-pub-3940256099942544/9257395921",
  rewarded: "ca-app-pub-3940256099942544/5224354917",
  banner: "ca-app-pub-3940256099942544/6300978111",
  interstitial: "ca-app-pub-3940256099942544/1033173712",
};

export function getAdUnitId(format: AdFormat): string | undefined {
  if (Platform.OS === "web") return undefined;

  if (process.env.EXPO_PUBLIC_ADMOB_MODE !== "production") {
    return testAdUnitIds[format];
  }

  if (Platform.OS !== "android") return undefined;
  if (format === "interstitial") return process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID?.trim() || undefined;
  return androidProductionAdUnitIds[format];
}
