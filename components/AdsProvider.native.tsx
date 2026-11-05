import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";
import mobileAds, {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  AdEventType,
  AppOpenAd,
  MaxAdContentRating,
} from "react-native-google-mobile-ads";
import { getAdUnitId } from "@/lib/ad-config";

const APP_OPEN_LAST_SHOWN_KEY = "admob_app_open_last_shown_v1";
const APP_OPEN_FREQUENCY_CAP_MS = 4 * 60 * 60 * 1000;
const APP_OPEN_CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const APP_OPEN_MIN_BACKGROUND_MS = 30 * 1000;
const APP_OPEN_LOAD_TIMEOUT_MS = 15 * 1000;

let adSdkInitialization: Promise<void> | null = null;

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
  showPrivacyOptions: async () => {},
});

function logAdsFailure(operation: string, error: unknown): void {
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "unknown";
  console.warn(`[ads] ${operation} failed (${code})`);
}

export function AdsProvider({ children }: React.PropsWithChildren) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [canRequestAds, setCanRequestAds] = useState(false);
  const [isFullScreenAdActive, setIsFullScreenAdActive] = useState(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);
  const canRequestAdsRef = useRef(false);
  const appOpenAdRef = useRef<AppOpenAd | null>(null);
  const appOpenListenersRef = useRef<(() => void)[]>([]);
  const appOpenLoadedRef = useRef(false);
  const appOpenLoadingRef = useRef(false);
  const appOpenLoadedAtRef = useRef(0);
  const appOpenShowingRef = useRef(false);
  const appOpenLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundedAtRef = useRef<number | null>(null);
  const previousAppStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastAppOpenShownAtRef = useRef(0);
  const frequencyCapReadyRef = useRef(false);

  const loadAppOpenAd = useCallback(() => {
    const ad = appOpenAdRef.current;
    if (!canRequestAdsRef.current || !ad || appOpenLoadedRef.current || appOpenLoadingRef.current) return;

    appOpenLoadingRef.current = true;
    if (appOpenLoadTimeoutRef.current) clearTimeout(appOpenLoadTimeoutRef.current);
    appOpenLoadTimeoutRef.current = setTimeout(() => {
      if (!appOpenLoadingRef.current) return;
      appOpenLoadingRef.current = false;
      console.warn("[ads] app-open load timed out");
    }, APP_OPEN_LOAD_TIMEOUT_MS);

    try {
      ad.load();
    } catch (error) {
      appOpenLoadingRef.current = false;
      if (appOpenLoadTimeoutRef.current) clearTimeout(appOpenLoadTimeoutRef.current);
      appOpenLoadTimeoutRef.current = null;
      logAdsFailure("app-open load", error);
    }
  }, []);

  const initializeAdSdk = useCallback(() => {
    if (!adSdkInitialization) {
      adSdkInitialization = (async () => {
        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.PG,
        });
        await mobileAds().initialize();
      })().catch((error: unknown) => {
        adSdkInitialization = null;
        throw error;
      });
    }
    return adSdkInitialization;
  }, []);

  const setupAppOpenAd = useCallback(() => {
    if (appOpenAdRef.current) {
      loadAppOpenAd();
      return;
    }

    const appOpenUnitId = getAdUnitId("appOpen");
    if (!appOpenUnitId) return;

    const ad = AppOpenAd.createForAdRequest(appOpenUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    appOpenAdRef.current = ad;
    appOpenListenersRef.current = [
      ad.addAdEventListener(AdEventType.LOADED, () => {
        appOpenLoadingRef.current = false;
        appOpenLoadedRef.current = true;
        appOpenLoadedAtRef.current = Date.now();
        if (appOpenLoadTimeoutRef.current) clearTimeout(appOpenLoadTimeoutRef.current);
        appOpenLoadTimeoutRef.current = null;
      }),
      ad.addAdEventListener(AdEventType.OPENED, () => {
        appOpenShowingRef.current = true;
        appOpenLoadedRef.current = false;
        setIsFullScreenAdActive(true);
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        appOpenShowingRef.current = false;
        appOpenLoadedRef.current = false;
        setIsFullScreenAdActive(false);
        loadAppOpenAd();
      }),
      ad.addAdEventListener(AdEventType.ERROR, (error) => {
        appOpenShowingRef.current = false;
        appOpenLoadedRef.current = false;
        appOpenLoadingRef.current = false;
        setIsFullScreenAdActive(false);
        if (appOpenLoadTimeoutRef.current) clearTimeout(appOpenLoadTimeoutRef.current);
        appOpenLoadTimeoutRef.current = null;
        logAdsFailure("app-open", error);
      }),
    ];
    loadAppOpenAd();
  }, [loadAppOpenAd]);

  useEffect(() => {
    let active = true;

    async function prepareAds() {
      try {
        await AdsConsent.requestInfoUpdate();
        const consentInfo = await AdsConsent.loadAndShowConsentFormIfRequired();
        if (!active) return;

        setPrivacyOptionsRequired(
          consentInfo.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
        );
        if (!consentInfo.canRequestAds) return;
        if (!getAdUnitId("appOpen") && !getAdUnitId("banner")) return;

        await initializeAdSdk();
        if (!active) return;
        canRequestAdsRef.current = true;
        setCanRequestAds(true);
        setupAppOpenAd();
      } catch (error) {
        if (active) {
          canRequestAdsRef.current = false;
          setCanRequestAds(false);
          try {
            const cachedConsentInfo = await AdsConsent.getConsentInfo();
            setPrivacyOptionsRequired(
              cachedConsentInfo.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
            );
          } catch (consentError) {
            logAdsFailure("cached consent lookup", consentError);
          }
          logAdsFailure("consent or initialization", error);
        }
      }
    }

    void prepareAds();
    return () => {
      active = false;
      if (appOpenLoadTimeoutRef.current) clearTimeout(appOpenLoadTimeoutRef.current);
      appOpenListenersRef.current.forEach((unsubscribe) => unsubscribe());
      appOpenListenersRef.current = [];
    };
  }, [initializeAdSdk, loadAppOpenAd, setupAppOpenAd]);

  useEffect(() => {
    if (!canRequestAds) return;
    let active = true;

    void AsyncStorage.getItem(APP_OPEN_LAST_SHOWN_KEY)
      .then((value) => {
        if (active) {
          lastAppOpenShownAtRef.current = value ? Number(value) || 0 : 0;
          frequencyCapReadyRef.current = true;
        }
      })
      .catch((error: unknown) => logAdsFailure("frequency-cap lookup", error));

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = previousAppStateRef.current;
      previousAppStateRef.current = nextState;

      if (nextState !== "active") {
        if (previousState === "active" && backgroundedAtRef.current === null) {
          backgroundedAtRef.current = Date.now();
        }
        return;
      }

      const backgroundedAt = backgroundedAtRef.current;
      backgroundedAtRef.current = null;
      if (backgroundedAt === null || Date.now() - backgroundedAt < APP_OPEN_MIN_BACKGROUND_MS) return;
      if (pathnameRef.current !== "/" || appOpenShowingRef.current) return;
      if (!frequencyCapReadyRef.current) return;

      const now = Date.now();
      if (now - lastAppOpenShownAtRef.current < APP_OPEN_FREQUENCY_CAP_MS) return;

      if (appOpenLoadedRef.current && now - appOpenLoadedAtRef.current > APP_OPEN_CACHE_MAX_AGE_MS) {
        appOpenLoadedRef.current = false;
      }

      if (
        appOpenLoadedRef.current
        && now - appOpenLoadedAtRef.current <= APP_OPEN_CACHE_MAX_AGE_MS
        && appOpenAdRef.current
      ) {
        appOpenLoadedRef.current = false;
        appOpenShowingRef.current = true;
        setIsFullScreenAdActive(true);
        lastAppOpenShownAtRef.current = now;
        void AsyncStorage.setItem(APP_OPEN_LAST_SHOWN_KEY, String(now))
          .catch((error: unknown) => logAdsFailure("frequency-cap save", error));
        appOpenAdRef.current.show().catch((error: unknown) => {
          appOpenShowingRef.current = false;
          setIsFullScreenAdActive(false);
          logAdsFailure("app-open show", error);
        });
      } else {
        loadAppOpenAd();
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [canRequestAds, loadAppOpenAd]);

  const showPrivacyOptions = useCallback(async () => {
    try {
      const consentInfo = await AdsConsent.showPrivacyOptionsForm();
      setPrivacyOptionsRequired(
        consentInfo.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
      );
      if (!consentInfo.canRequestAds || (!getAdUnitId("appOpen") && !getAdUnitId("banner"))) {
        canRequestAdsRef.current = false;
        setCanRequestAds(false);
        return;
      }

      await initializeAdSdk();
      canRequestAdsRef.current = true;
      setCanRequestAds(true);
      setupAppOpenAd();
    } catch (error) {
      canRequestAdsRef.current = false;
      setCanRequestAds(false);
      logAdsFailure("privacy options", error);
      throw error;
    }
  }, [initializeAdSdk, setupAppOpenAd]);

  return (
    <AdsContext.Provider value={{
      canRequestAds,
      isFullScreenAdActive,
      privacyOptionsRequired,
      showPrivacyOptions,
    }}>
      {children}
    </AdsContext.Provider>
  );
}

export function useAds(): AdsContextValue {
  return useContext(AdsContext);
}
