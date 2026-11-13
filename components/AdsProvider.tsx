import React, { createContext, useContext } from "react";

type AdsContextValue = {
  acquireRewardedSlot: () => (() => void) | null;
  showInterstitial: () => Promise<boolean>;
  adRequestVersion: number;
  diagnosticReport: string;
  retryAds: () => Promise<void>;
  reportAdEvent: (
    format: "consent" | "sdk" | "appOpen" | "banner" | "interstitial",
    status: string,
    error?: unknown,
  ) => void;
  canRequestAds: boolean;
  isFullScreenAdActive: boolean;
  privacyOptionsRequired: boolean;
  showPrivacyOptions: () => Promise<void>;
};

const AdsContext = createContext<AdsContextValue>({
  acquireRewardedSlot: () => null,
  showInterstitial: async () => false,
  adRequestVersion: 0,
  diagnosticReport: "الإعلانات غير متاحة في المتصفح",
  retryAds: async () => {},
  reportAdEvent: () => {},
  canRequestAds: false,
  isFullScreenAdActive: false,
  privacyOptionsRequired: false,
  showPrivacyOptions: async () => {
    throw new Error("Ads privacy options are unavailable on this platform.");
  },
});

export function AdsProvider({ children }: React.PropsWithChildren) {
  const value: AdsContextValue = {
    acquireRewardedSlot: () => null,
    showInterstitial: async () => false,
    adRequestVersion: 0,
    diagnosticReport: "الإعلانات غير متاحة في المتصفح",
    retryAds: async () => {},
    reportAdEvent: () => {},
    canRequestAds: false,
    isFullScreenAdActive: false,
    privacyOptionsRequired: false,
    showPrivacyOptions: async () => {
      throw new Error("Ads privacy options are unavailable on this platform.");
    },
  };
  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

export function useAds(): AdsContextValue {
  return useContext(AdsContext);
}
