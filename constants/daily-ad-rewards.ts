// Each completed ad earns its own amount; credits still require server proof.
export const DAILY_AD_MILESTONES=[100,250,500,1000,1500,2000] as const;
export const DAILY_AD_LIMIT=DAILY_AD_MILESTONES.length;
export const DAILY_AD_REWARD_MODE='per-ad' as const;
export const DAILY_AD_TOTAL=DAILY_AD_MILESTONES.reduce((total,coins)=>total+coins,0);
