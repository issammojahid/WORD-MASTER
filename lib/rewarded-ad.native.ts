import { getGoogleMobileAds } from "./google-mobile-ads";
import { getAdUnitId } from "./ad-config";

export function runRewardedAd({
  userId,
  customData,
  allowed,
  signal,
}: {
  userId: string;
  customData: string;
  allowed: () => boolean;
  signal?: AbortSignal;
}): Promise<boolean> {
  const gma = getGoogleMobileAds();
  if (!gma) return Promise.reject(Error("rewarded_unavailable"));

  const { RewardedAd, RewardedAdEventType, AdEventType } = gma;
  const unit = getAdUnitId("rewarded");
  if (!unit || !allowed()) return Promise.reject(Error("rewarded_unavailable"));

  return new Promise((resolve, reject) => {
    let earned = false,
      finished = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribers: (() => void)[] = [];
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      signal?.removeEventListener("abort", cancel);
      if (error) reject(error);
      else resolve(earned && allowed());
    };
    const cancel = () => finish(Error("rewarded_cancelled"));
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) {
      cancel();
      return;
    }
    try {
      const ad = RewardedAd.createForAdRequest(unit, {
        requestNonPersonalizedAdsOnly: true,
        serverSideVerificationOptions: { userId, customData },
      });
      unsubscribers.push(
        ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
          if (finished) return;
          if (!allowed()) {
            finish(Error("rewarded_not_allowed"));
            return;
          }
          if (timer) clearTimeout(timer);
          timer = setTimeout(
            () => finish(Error("rewarded_close_timeout")),
            180_000,
          );
          void ad.show().catch(finish);
        }),
        ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          if (!finished && allowed()) earned = true;
        }),
        ad.addAdEventListener(AdEventType.CLOSED, () => finish()),
        ad.addAdEventListener(AdEventType.ERROR, finish),
      );
      timer = setTimeout(() => finish(Error("rewarded_load_timeout")), 45_000);
      ad.load();
    } catch (error) {
      finish(error);
    }
  });
}
