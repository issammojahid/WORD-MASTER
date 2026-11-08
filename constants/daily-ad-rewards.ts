// Milestone labels approved for the daily ads page. Payout interpretation is
// confirmed separately; the server must calculate and verify actual credits.
export const DAILY_AD_MILESTONES=[100,250,500,1000,1500,2000] as const;
export const DAILY_AD_LIMIT=DAILY_AD_MILESTONES.length;
