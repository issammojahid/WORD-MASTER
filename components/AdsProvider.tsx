import React, { createContext, useContext } from "react";

type AdsContextValue = {
  canRequestAds: boolean;
  isFullScreenAdActive: boolean;
  privacyOptionsRequired: boolean;
  showPrivacyOptions: () => Promise<void>;
};

const AdsContext = createContext<AdsContextValue>({
  canRequestAds: false,
  isFullScreenAdActive: false,
  privacyOptionsRequired: false,
  showPrivacyOptions: async () => {
    throw new Error("Ads privacy options are unavailable on this platform.");
  },
});

export function AdsProvider({ children }: React.PropsWithChildren) {
  const value: AdsContextValue = {
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
