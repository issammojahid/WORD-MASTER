import { Platform } from "react-native";

// RevenueCat react-native-purchases SDK is a native module — only loaded on iOS/Android.
// In Expo Go (or web/SSR), `Purchases` may not be available; we lazy-import and degrade gracefully.

const RC_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ||
  (process.env as Record<string, string | undefined>).EXPO_PUBLIC_REVENUECAT_PUBLIC_API_KEY ||
  "";

const PRODUCT_ID = "battle_pass_premium_s1";
const ENTITLEMENT_ID = "battle_pass_premium";

let initialized = false;
let currentPlayerId: string | null = null;

type PurchasesModule = typeof import("react-native-purchases").default;

async function loadPurchases(): Promise<PurchasesModule | null> {
  if (Platform.OS === "web") return null;
  try {
    const mod = await import("react-native-purchases");
    return mod.default;
  } catch (e) {
    console.warn("[iap] react-native-purchases not available:", (e as Error).message);
    return null;
  }
}

export async function initIAP(playerId: string | null): Promise<void> {
  if (!RC_API_KEY || !playerId) return;
  if (initialized && currentPlayerId === playerId) return;
  const Purchases = await loadPurchases();
  if (!Purchases) return;
  try {
    if (!initialized) {
      Purchases.configure({ apiKey: RC_API_KEY, appUserID: playerId });
      initialized = true;
    } else if (currentPlayerId !== playerId) {
      await Purchases.logIn(playerId);
    }
    currentPlayerId = playerId;
  } catch (e) {
    console.warn("[iap] init failed:", (e as Error).message);
  }
}

export type PurchaseResult =
  | { ok: true }
  | { ok: false; cancelled?: boolean; error: string };

/**
 * Open the Google Play / App Store billing sheet for the Battle Pass premium product.
 * Returns success only after the user completes the purchase AND the entitlement is active.
 */
export async function purchaseBattlePassPremium(playerId: string): Promise<PurchaseResult> {
  const Purchases = await loadPurchases();
  if (!Purchases || !RC_API_KEY) {
    return { ok: false, error: "iap_unavailable" };
  }
  try {
    await initIAP(playerId);
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return { ok: false, error: "no_offerings" };

    // Find the package whose product id matches our expected product.
    const pkg =
      current.availablePackages.find(
        (p) => p.product.identifier === PRODUCT_ID || p.product.identifier === `${PRODUCT_ID}:${PRODUCT_ID}`
      ) || current.lifetime || current.availablePackages[0];
    if (!pkg) return { ok: false, error: "no_package" };

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const ent = customerInfo.entitlements.active[ENTITLEMENT_ID];
    if (!ent) return { ok: false, error: "entitlement_not_active" };
    return { ok: true };
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, cancelled: true, error: "user_cancelled" };
    return { ok: false, error: e?.message || "purchase_failed" };
  }
}

export async function restorePurchases(playerId: string): Promise<boolean> {
  const Purchases = await loadPurchases();
  if (!Purchases || !RC_API_KEY) return false;
  try {
    await initIAP(playerId);
    const customerInfo = await Purchases.restorePurchases();
    return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  } catch {
    return false;
  }
}
