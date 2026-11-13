import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";
import { getGoogleMobileAds } from "@/lib/google-mobile-ads";
import { getAdUnitId } from "@/lib/ad-config";
import {
  adErrorCode,
  canShowAppOpen,
  createAdRetry,
  gatherAdPermission,
} from "@/lib/ads-runtime";

const CAP_KEY = "admob_app_open_last_shown_v1",
  CACHE_MS = 4 * 60 * 60 * 1000,
  LOAD_TIMEOUT_MS = 45_000;
let initialization: Promise<void> | null = null;
type Format = "consent" | "sdk" | "appOpen" | "banner" | "interstitial";
type Diagnostic = { format: Format; status: string; code?: string; at: number };
type AdsContextValue = {
  acquireRewardedSlot: () => (() => void) | null;
  showInterstitial: () => Promise<boolean>;
  adRequestVersion: number;
  canRequestAds: boolean;
  isFullScreenAdActive: boolean;
  privacyOptionsRequired: boolean;
  showPrivacyOptions: () => Promise<void>;
  diagnosticReport: string;
  retryAds: () => Promise<void>;
  reportAdEvent: (format: Format, status: string, error?: unknown) => void;
};
const AdsContext = createContext<AdsContextValue>({
  acquireRewardedSlot: () => null,
  showInterstitial: async () => false,
  adRequestVersion: 0,
  canRequestAds: false,
  isFullScreenAdActive: false,
  privacyOptionsRequired: false,
  showPrivacyOptions: async () => {},
  diagnosticReport: "لم تبدأ التهيئة",
  retryAds: async () => {},
  reportAdEvent: () => {},
});

export function AdsProvider({ children }: React.PropsWithChildren) {
  const gma = getGoogleMobileAds();

  if (!gma) {
    const fallbackValue: AdsContextValue = {
      acquireRewardedSlot: () => null,
      showInterstitial: async () => false,
      adRequestVersion: 0,
      canRequestAds: false,
      isFullScreenAdActive: false,
      privacyOptionsRequired: false,
      showPrivacyOptions: async () => {
        throw new Error("Ads privacy options are unavailable on Expo Go.");
      },
      diagnosticReport: "الإعلانات غير متاحة في Expo Go",
      retryAds: async () => {},
      reportAdEvent: () => {},
    };
    return (
      <AdsContext.Provider value={fallbackValue}>
        {children}
      </AdsContext.Provider>
    );
  }

  return <NativeAdsProvider gma={gma}>{children}</NativeAdsProvider>;
}

function NativeAdsProvider({
  children,
  gma,
}: React.PropsWithChildren<{
  gma: NonNullable<ReturnType<typeof getGoogleMobileAds>>;
}>) {
  const {
    default: mobileAds,
    AdsConsent,
    AdsConsentPrivacyOptionsRequirementStatus,
    AdEventType,
    AppOpenAd,
    InterstitialAd,
    MaxAdContentRating,
  } = gma;

  const path = usePathname(),
    pathRef = useRef(path);
  pathRef.current = path;
  const [allowed, setAllowed] = useState(false),
    [fullScreen, setFullScreen] = useState(false),
    [privacyRequired, setPrivacyRequired] = useState(false),
    [events, setEvents] = useState<Diagnostic[]>([]);
  const [adRequestVersion, setAdRequestVersion] = useState(0);
  const mounted = useRef(false),
    permission = useRef(false),
    preparing = useRef(false),
    privacyBusy = useRef(false),
    generation = useRef(0);
  const rewardBusy = useRef(false);
  const interstitialBusy = useRef(false);
  const acquireRewardedSlot = useCallback(() => {
    if (
      !mounted.current ||
      !permission.current ||
      showing.current ||
      rewardBusy.current ||
      privacyBusy.current ||
      AppState.currentState !== "active"
    )
      return null;
    rewardBusy.current = true;
    setFullScreen(true);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      rewardBusy.current = false;
      if (mounted.current) setFullScreen(false);
    };
  }, []);
  const ad = useRef<any>(null),
    listeners = useRef<(() => void)[]>([]),
    loaded = useRef(false),
    loading = useRef(false),
    loadedAt = useRef(0),
    showing = useRef(false),
    watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastShown = useRef(0),
    capReady = useRef(false),
    backgroundAt = useRef<number | null>(null),
    previous = useRef<AppStateStatus>(AppState.currentState);
  const prepareRef = useRef<() => Promise<void>>(async () => {}),
    loadRef = useRef<() => void>(() => {});
  const startupRetry = useRef<ReturnType<typeof createAdRetry> | null>(null),
    openRetry = useRef<ReturnType<typeof createAdRetry> | null>(null);
  const reportAdEvent = useCallback(
    (format: Format, status: string, error?: unknown) => {
      if (!mounted.current) return;
      const code = error === undefined ? undefined : adErrorCode(error);
      setEvents((old) =>
        [...old, { format, status, code, at: Date.now() }].slice(-20),
      );
      if (code) console.warn(`[ads] ${format}: ${status} (${code})`);
    },
    [],
  );
  const showInterstitial = useCallback(async () => {
    const unitId = getAdUnitId("interstitial");
    if (
      !unitId || !mounted.current || !permission.current || showing.current
      || rewardBusy.current || interstitialBusy.current || privacyBusy.current
      || AppState.currentState !== "active"
    ) return false;
    const release = acquireRewardedSlot();
    if (!release) return false;
    interstitialBusy.current = true;
    let request: ReturnType<typeof InterstitialAd.createForAdRequest>;
    try {
      request = InterstitialAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true });
    } catch (error) {
      interstitialBusy.current = false;
      release();
      reportAdEvent("interstitial", "create_failed", error);
      return false;
    }
    return await new Promise<boolean>((resolve) => {
      let settled = false, opened = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const unsubscribers: (() => void)[] = [];
      const finish = (shown: boolean, error?: unknown) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        unsubscribers.forEach((unsubscribe) => unsubscribe());
        interstitialBusy.current = false;
        release();
        reportAdEvent("interstitial", shown ? "closed" : "failed", error);
        resolve(shown);
      };
      unsubscribers.push(
        request.addAdEventListener(AdEventType.LOADED, () => {
          if (settled) return;
          reportAdEvent("interstitial", "loaded");
          try {
            void request.show().catch((error) => finish(false, error));
          } catch (error) {
            finish(false, error);
          }
        }),
        request.addAdEventListener(AdEventType.OPENED, () => {
          opened = true;
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(() => finish(false, { code: "show_timeout" }), 180_000);
          reportAdEvent("interstitial", "opened");
        }),
        request.addAdEventListener(AdEventType.CLOSED, () => finish(opened)),
        request.addAdEventListener(AdEventType.ERROR, (error) => finish(false, error)),
      );
      timeout = setTimeout(() => finish(false, { code: "load_timeout" }), LOAD_TIMEOUT_MS);
      reportAdEvent("interstitial", "loading");
      try {
        request.load();
      } catch (error) {
        finish(false, error);
      }
    });
  }, [acquireRewardedSlot, AdEventType, InterstitialAd, reportAdEvent]);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const clearWatchdog = useCallback(() => {
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
  }, []);
  const disposeOpen = useCallback(() => {
    clearWatchdog();
    listeners.current.forEach((off) => off());
    listeners.current = [];
    ad.current = null;
    loaded.current = false;
    loading.current = false;
    showing.current = false;
  }, [clearWatchdog]);
  const initialize = useCallback(async () => {
    if (!initialization)
      initialization = (async () => {
        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.PG,
        });
        const adapters = await mobileAds().initialize();
        console.info(
          "[ads] SDK initialized",
          adapters.map((a) => ({ name: a.name, state: a.state })),
        );
      })().catch((error) => {
        initialization = null;
        throw error;
      });
    await initialization;
  }, [mobileAds, MaxAdContentRating]);
  const loadOpen = useCallback(() => {
    if (
      !mounted.current ||
      !permission.current ||
      AppState.currentState !== "active" ||
      showing.current ||
      rewardBusy.current ||
      loading.current
    )
      return;
    if (loaded.current && Date.now() - loadedAt.current <= CACHE_MS) return;
    const unitId = getAdUnitId("appOpen");
    if (!unitId) return;
    disposeOpen();
    try {
      const request = AppOpenAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: true,
      });
      ad.current = request;
      const current = () =>
        mounted.current && permission.current && ad.current === request;
      const fail = (error: unknown) => {
        if (!current()) return;
        disposeOpen();
        setFullScreen(false);
        reportAdEvent("appOpen", "failed", error);
        openRetry.current?.schedule();
      };
      listeners.current = [
        request.addAdEventListener(AdEventType.LOADED, () => {
          if (!current()) return;
          clearWatchdog();
          loading.current = false;
          loaded.current = true;
          loadedAt.current = Date.now();
          openRetry.current?.reset();
          reportAdEvent("appOpen", "loaded");
        }),
        request.addAdEventListener(AdEventType.OPENED, () => {
          if (!current()) return;
          clearWatchdog();
          showing.current = true;
          loaded.current = false;
          lastShown.current = Date.now();
          setFullScreen(true);
          reportAdEvent("appOpen", "opened");
          void AsyncStorage.setItem(CAP_KEY, String(lastShown.current)).catch(
            (error) => reportAdEvent("appOpen", "cap_save_failed", error),
          );
        }),
        request.addAdEventListener(AdEventType.CLOSED, () => {
          if (!current()) return;
          disposeOpen();
          setFullScreen(false);
          reportAdEvent("appOpen", "closed");
          loadRef.current();
        }),
        request.addAdEventListener(AdEventType.ERROR, fail),
      ];
      loading.current = true;
      reportAdEvent("appOpen", "loading");
      watchdog.current = setTimeout(
        () => fail({ code: "load_timeout" }),
        LOAD_TIMEOUT_MS,
      );
      request.load();
    } catch (error) {
      disposeOpen();
      reportAdEvent("appOpen", "failed", error);
      openRetry.current?.schedule();
    }
  }, [disposeOpen, clearWatchdog, reportAdEvent, AppOpenAd, AdEventType]);
  loadRef.current = loadOpen;
  const applyPermission = useCallback(
    async (
      info: {
        canRequestAds: boolean;
        privacyOptionsRequirementStatus: any;
      },
      token: number,
    ) => {
      if (!mounted.current || token !== generation.current) return;
      setPrivacyRequired(
        info.privacyOptionsRequirementStatus ===
          AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
      );
      if (!info.canRequestAds) {
        permission.current = false;
        setAllowed(false);
        setFullScreen(false);
        openRetry.current?.reset();
        disposeOpen();
        reportAdEvent("consent", "permission_required");
        return;
      }
      if (!getAdUnitId("appOpen") && !getAdUnitId("banner")) {
        permission.current = false;
        setAllowed(false);
        reportAdEvent("sdk", "no_ad_units");
        return;
      }
      reportAdEvent("sdk", "initializing");
      await initialize();
      if (!mounted.current || token !== generation.current) return;
      permission.current = true;
      setAllowed(true);
      startupRetry.current?.reset();
      reportAdEvent("sdk", "ready");
      loadRef.current();
    },
    [
      initialize,
      disposeOpen,
      reportAdEvent,
      AdsConsentPrivacyOptionsRequirementStatus,
    ],
  );
  const prepare = useCallback(async () => {
    if (!mounted.current || preparing.current || privacyBusy.current) return;
    preparing.current = true;
    const token = generation.current;
    try {
      reportAdEvent("consent", "checking");
      const info = await gatherAdPermission(AdsConsent, (error) =>
        reportAdEvent("consent", "refresh_failed", error),
      );
      await applyPermission(info, token);
    } catch (error) {
      if (mounted.current && token === generation.current) {
        permission.current = false;
        setAllowed(false);
        disposeOpen();
        reportAdEvent("consent", "blocked", error);
        startupRetry.current?.schedule();
      }
    } finally {
      if (token === generation.current) preparing.current = false;
    }
  }, [applyPermission, disposeOpen, reportAdEvent, AdsConsent]);
  prepareRef.current = prepare;
  useEffect(() => {
    mounted.current = true;
    startupRetry.current = createAdRetry(() => {
      if (AppState.currentState === "active") void prepareRef.current();
    });
    openRetry.current = createAdRetry(() => loadRef.current());
    const token = generation.current;
    void AsyncStorage.getItem(CAP_KEY)
      .then((value) => {
        if (!mounted.current || token !== generation.current) return;
        lastShown.current = Math.max(0, Number(value) || 0);
        capReady.current = true;
      })
      .catch((error) => {
        if (mounted.current && token === generation.current) {
          capReady.current = true;
          reportAdEvent("appOpen", "cap_read_failed", error);
        }
      });
    void prepareRef.current();
    const subscription = AppState.addEventListener("change", (next) => {
      const prev = previous.current;
      previous.current = next;
      if (next !== "active") {
        if (prev === "active" && backgroundAt.current === null)
          backgroundAt.current = Date.now();
        return;
      }
      const elapsed =
        backgroundAt.current === null ? 0 : Date.now() - backgroundAt.current;
      backgroundAt.current = null;
      if (!permission.current) {
        startupRetry.current?.reset();
        void prepareRef.current();
        return;
      }
      const now = Date.now();
      if (
        canShowAppOpen({
          allowed: permission.current,
          home: pathRef.current === "/",
          showing: showing.current || rewardBusy.current,
          capReady: capReady.current,
          loaded: loaded.current,
          loadedAt: loadedAt.current,
          lastShown: lastShown.current,
          backgroundMs: elapsed,
          now,
        }) &&
        ad.current
      ) {
        const request = ad.current;
        showing.current = true;
        setFullScreen(true);
        void Promise.resolve()
          .then(() => {
            if (
              !permission.current ||
              rewardBusy.current ||
              !mounted.current ||
              ad.current !== request
            )
              throw Error("ad_no_longer_allowed");
            return request.show();
          })
          .catch((error) => {
            if (!mounted.current || ad.current !== request) return;
            disposeOpen();
            setFullScreen(false);
            reportAdEvent("appOpen", "show_failed", error);
            openRetry.current?.schedule();
          });
      } else {
        openRetry.current?.reset();
        loadRef.current();
      }
    });
    return () => {
      mounted.current = false;
      invalidate();
      preparing.current = false;
      permission.current = false;
      startupRetry.current?.dispose();
      openRetry.current?.dispose();
      subscription.remove();
      disposeOpen();
    };
  }, [disposeOpen, reportAdEvent, invalidate]);
  const showPrivacyOptions = useCallback(async () => {
    if (preparing.current || privacyBusy.current) return;
    privacyBusy.current = true;
    const token = ++generation.current;
    permission.current = false;
    setAllowed(false);
    startupRetry.current?.reset();
    openRetry.current?.reset();
    disposeOpen();
    try {
      const info = await AdsConsent.showPrivacyOptionsForm();
      await applyPermission(info, token);
    } catch (error) {
      reportAdEvent("consent", "privacy_options_failed", error);
      throw error;
    } finally {
      privacyBusy.current = false;
    }
  }, [applyPermission, disposeOpen, reportAdEvent, AdsConsent]);
  const retryAds = useCallback(async () => {
    setAdRequestVersion((value) => value + 1);
    startupRetry.current?.reset();
    openRetry.current?.reset();
    if (permission.current) {
      loadRef.current();
      return;
    }
    await prepareRef.current();
  }, []);
  const diagnosticReport = [
    `وضع الإعلانات: ${process.env.EXPO_PUBLIC_ADMOB_MODE === "production" ? "إنتاج" : "اختبار"}`,
    `السماح بطلب الإعلانات: ${allowed ? "نعم" : "لا"}`,
    `البانير: ${getAdUnitId("banner") ? "مهيأ" : "غير مهيأ"}`,
    `إعلان الرجوع: ${getAdUnitId("appOpen") ? "مهيأ" : "غير مهيأ"}`,
    `إعلان ما بعد المباراة: ${getAdUnitId("interstitial") ? "مهيأ" : "غير مهيأ"}`,
    ...events.map(
      (e) =>
        `${new Date(e.at).toISOString()} ${e.format}: ${e.status}${e.code ? " [" + e.code + "]" : ""}`,
    ),
  ].join("\n");
  return (
    <AdsContext.Provider
      value={{
        acquireRewardedSlot,
        showInterstitial,
        adRequestVersion,
        canRequestAds: allowed,
        isFullScreenAdActive: fullScreen,
        privacyOptionsRequired: privacyRequired,
        showPrivacyOptions,
        diagnosticReport,
        retryAds,
        reportAdEvent,
      }}
    >
      {children}
    </AdsContext.Provider>
  );
}

export function useAds() {
  return useContext(AdsContext);
}
