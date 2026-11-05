import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

export type AdFormat = "appOpen" | "rewarded" | "banner";

const androidProductionAdUnitIds: Record<AdFormat, string> = {
  appOpen: "ca-app-pub-8545693631358718/5352085289",
  rewarded: "ca-app-pub-8545693631358718/5071837508",
  banner: "ca-app-pub-8545693631358718/3758755836",
};

const testAdUnitIds: Record<AdFormat, string> = {
  appOpen: TestIds.APP_OPEN,
  rewarded: TestIds.REWARDED,
  banner: TestIds.BANNER,
};

export function getAdUnitId(format: AdFormat): string | undefined {
  if (Platform.OS === "web") return undefined;

  if (process.env.EXPO_PUBLIC_ADMOB_MODE !== "production") {
    return testAdUnitIds[format];
  }

  if (Platform.OS !== "android" || format === "rewarded") return undefined;
  return androidProductionAdUnitIds[format];
}
