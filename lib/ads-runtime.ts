// Retry only failed requests, with backoff; consent denial never schedules a retry.
export const AD_RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 180_000] as const;
export function adErrorCode(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "unknown";
  return code.replace(/[^a-zA-Z0-9_./-]/g, "").slice(0, 100) || "unknown";
}
export function createAdRetry(
  callback: () => void,
  clock: {
    schedule: (fn: () => void, ms: number) => unknown;
    cancel: (handle: unknown) => void;
  } = {
    schedule: (fn, ms) => setTimeout(fn, ms),
    cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
) {
  let handle: unknown = null,
    attempt = 0,
    disposed = false;
  return {
    schedule() {
      if (disposed || handle !== null || attempt >= AD_RETRY_DELAYS_MS.length)
        return;
      const delay = AD_RETRY_DELAYS_MS[attempt++];
      handle = clock.schedule(() => {
        handle = null;
        if (!disposed) callback();
      }, delay);
    },
    reset() {
      if (handle !== null) clock.cancel(handle);
      handle = null;
      attempt = 0;
    },
    dispose() {
      disposed = true;
      if (handle !== null) clock.cancel(handle);
      handle = null;
    },
  };
}
export async function gatherAdPermission<T extends { canRequestAds: boolean }>(
  consent: {
    requestInfoUpdate: () => Promise<T>;
    loadAndShowConsentFormIfRequired: () => Promise<T>;
    getConsentInfo: () => Promise<T>;
  },
  onRefreshFailure: (error: unknown) => void = () => {},
): Promise<T> {
  try {
    await consent.requestInfoUpdate();
    return await consent.loadAndShowConsentFormIfRequired();
  } catch (error) {
    onRefreshFailure(error);
    const cached = await consent.getConsentInfo();
    if (cached.canRequestAds) return cached;
    throw error;
  }
}
export function canShowAppOpen({
  allowed,
  home,
  showing,
  capReady,
  loaded,
  loadedAt,
  lastShown,
  backgroundMs,
  now,
}: {
  allowed: boolean;
  home: boolean;
  showing: boolean;
  capReady: boolean;
  loaded: boolean;
  loadedAt: number;
  lastShown: number;
  backgroundMs: number;
  now: number;
}) {
  return (
    allowed &&
    home &&
    !showing &&
    capReady &&
    loaded &&
    backgroundMs >= 30_000 &&
    (lastShown === 0 || now - lastShown >= 4 * 60 * 60 * 1000) &&
    now - loadedAt <= 4 * 60 * 60 * 1000
  );
}
