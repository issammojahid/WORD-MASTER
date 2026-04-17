import { createClient } from "@replit/revenuecat-sdk/client";

export async function getUncachableRevenueCatClient() {
  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) {
    throw new Error(
      "REVENUECAT_API_KEY environment variable is not set. " +
      "Set it to your RevenueCat V2 secret key (found in RevenueCat dashboard → API Keys)."
    );
  }

  return createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}
