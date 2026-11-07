import { HALLOWEEN_ITEMS, SEASON_CATEGORIES, applySeasonAction, emptySeasonState, SeasonError, type SeasonAction, type SeasonSnapshot } from "./halloween";
// Bundled with the app update. End is exclusive: all of 30 November is included.
export const HALLOWEEN_START_AT = "2026-11-06T00:00:00+01:00";
export const HALLOWEEN_END_AT = "2026-12-01T00:00:00+01:00";
export const HALLOWEEN_END_LABEL = "30 نوفمبر 2026";
export function isHalloweenSeasonActive(now = Date.now()): boolean {
 return now >= Date.parse(HALLOWEEN_START_AT) && now < Date.parse(HALLOWEEN_END_AT);
}
export function halloweenTimeLeft(now = Date.now()) {
 const totalSeconds = Math.max(0, Math.ceil((Date.parse(HALLOWEEN_END_AT)-now)/1000));
 return { totalSeconds, days:Math.floor(totalSeconds/86400), hours:Math.floor(totalSeconds%86400/3600), minutes:Math.floor(totalSeconds%3600/60), seconds:totalSeconds%60 };
}
export type DeviceHalloween = Omit<SeasonSnapshot,"coins"> & { walletPending?: boolean; objectiveBaseline?: {gamesPlayed:number;wins:number;totalScore:number;level:number;winStreak:number} };
export function deviceHalloweenSnapshot(coins:number, saved?:DeviceHalloween):SeasonSnapshot {
 const known=new Set(HALLOWEEN_ITEMS.map(item=>item.id));
 const owned=[...new Set((saved?.state?.owned??[]).filter(id=>known.has(id)))];
 const equipped=Object.fromEntries(SEASON_CATEGORIES.flatMap(category=>{
  const id=saved?.state?.equipped?.[category];
  return id&&owned.includes(id)&&HALLOWEEN_ITEMS.some(item=>item.id===id&&item.category===category)?[[category,id]]:[];
 }));
 return {coins,state:{...emptySeasonState(),owned,equipped,giftItemId:known.has(saved?.state?.giftItemId??"")?saved!.state.giftItemId:null},claimedTasks:[...new Set(saved?.claimedTasks??[])],claimedAchievements:[...new Set(saved?.claimedAchievements??[])]};
}
export function applyDeviceHalloween(coins:number,saved:DeviceHalloween|undefined,action:SeasonAction,now=Date.now()):SeasonSnapshot {
 if(!isHalloweenSeasonActive(now)&&!["enter","equip","unequip"].includes(action.type))throw new SeasonError("season_ended",403);
 return applySeasonAction(deviceHalloweenSnapshot(coins,saved),action);
}
export function recordDeviceHalloweenClaims(coins:number,saved:DeviceHalloween|undefined,source:"task"|"achievement",keys:string[],now=Date.now()):DeviceHalloween {
 const snapshot=deviceHalloweenSnapshot(coins,saved);
 const eligible=new Set(HALLOWEEN_ITEMS.filter(item=>item.reward?.type===source).map(item=>item.reward!.key));
 const field=source==="task"?"claimedTasks":"claimedAchievements";
 const claims=isHalloweenSeasonActive(now)?keys.filter(key=>eligible.has(key)):[];
 return {state:snapshot.state,claimedTasks:snapshot.claimedTasks,claimedAchievements:snapshot.claimedAchievements,[field]:[...new Set([...snapshot[field],...claims])],walletPending:saved?.walletPending,objectiveBaseline:saved?.objectiveBaseline};
}
