const React = require("react"),
  env = global.__adsFixture;
function mobileAds() {
  return {
    setRequestConfiguration: async () => {},
    initialize: async () => {
      env.initialized++;
      return [{ name: "Google", state: 1 }];
    },
  };
}
class Ad {
  constructor() {
    this.listeners = new Map();
    env.ads.push(this);
  }
  addAdEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.listeners.get(type).delete(fn);
  }
  emit(type, value) {
    for (const fn of [...(this.listeners.get(type) || [])]) fn(value);
  }
  load() {
    env.loads++;
    if (env.autoLoad) queueMicrotask(() => this.emit("loaded"));
  }
  async show() {
    env.shows++;
    if (env.rejectShow) throw { code: "show_failed" };
    this.emit("opened");
  }
}
module.exports = Object.assign(mobileAds, {
  AdsConsent: {
    requestInfoUpdate: async () => {
      if (env.consentError) throw { code: "consent_network" };
      return {
        canRequestAds: env.permission,
        privacyOptionsRequirementStatus: "NOT_REQUIRED",
      };
    },
    loadAndShowConsentFormIfRequired: async () => ({
      canRequestAds: env.permission,
      privacyOptionsRequirementStatus: "NOT_REQUIRED",
    }),
    getConsentInfo: async () => ({
      canRequestAds: env.cachedPermission,
      privacyOptionsRequirementStatus: "NOT_REQUIRED",
    }),
    showPrivacyOptionsForm: async () => ({
      canRequestAds: env.permission,
      privacyOptionsRequirementStatus: "NOT_REQUIRED",
    }),
  },
  AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: "REQUIRED" },
  AdEventType: {
    LOADED: "loaded",
    OPENED: "opened",
    CLOSED: "closed",
    ERROR: "error",
  },
  AppOpenAd: { createForAdRequest: () => new Ad() },
  MaxAdContentRating: { PG: "PG" },
  TestIds: {
    APP_OPEN: "test-open",
    BANNER: "test-banner",
    REWARDED: "test-reward",
  },
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: "adaptive" },
  BannerAd: (props) => {
    env.banner = props;
    React.useEffect(() => {
      env.bannerMounts++;
    }, []);
    return React.createElement("ad-banner");
  },
});
