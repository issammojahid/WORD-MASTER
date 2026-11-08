import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { usePlayer } from "@/contexts/PlayerContext";
import { HALLOWEEN_ITEMS, seasonView, type SeasonAction, type SeasonSnapshot } from "@shared/halloween";
import { HALLOWEEN_START_AT, HALLOWEEN_END_AT, deviceHalloweenSnapshot, isHalloweenSeasonActive } from "@shared/halloween-update";
import { prepareHalloweenObjectives } from "@shared/halloween-objectives";
import {HALLOWEEN_PROMOTIONS_ENABLED} from "@/constants/release-content";
export type HalloweenAccount=SeasonSnapshot&{claimable:string[];local:boolean};
type AccountContext={enabled:boolean;seasonActive:boolean;account:HalloweenAccount|null;busy:boolean;error:string;refresh:()=>Promise<boolean>;act:(action:SeasonAction)=>Promise<boolean>;recordClaims:(source:"task"|"achievement",keys:string[])=>void};
const fallback:AccountContext={enabled:false,seasonActive:false,account:null,busy:false,error:"",refresh:async()=>false,act:async()=>false,recordClaims:()=>{}};
const Context=createContext<AccountContext>(fallback);
const errors:Record<string,string>={insufficient_coins:"العملات غير كافية",gift_already_claimed:"استلمت هدية البداية من قبل",not_owned:"يجب أن تمتلك هذا العنصر أولاً",reward_locked:"أكمل المهمة أو الإنجاز واستلم مكافأته أولاً",reward_only:"هذا العنصر مكافأة ولا يُباع",season_ended:"انتهى موسم هالوين. مظاهرك المكتسبة ما زالت متاحة للتجهيز.",already_owned:"تمتلك هذا العنصر بالفعل"};
export function HalloweenProvider({children}:{children:React.ReactNode}){
 const {profile,isReady,applyHalloweenAction,recordHalloweenClaims}=usePlayer();
 const [clock,setClock]=useState(Date.now),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const lock=useRef(false),seasonActive=HALLOWEEN_PROMOTIONS_ENABLED&&isHalloweenSeasonActive(clock);
 useEffect(()=>{
  const wake=()=>setClock(Date.now());
  const boundary=clock<Date.parse(HALLOWEEN_START_AT)?Date.parse(HALLOWEEN_START_AT):Date.parse(HALLOWEEN_END_AT);
  const remaining=boundary-clock;
  const timer=remaining>0?setTimeout(wake,Math.min(remaining,2147483647)):undefined;
  const subscription=AppState.addEventListener("change",state=>{if(state==="active")wake();});
  return ()=>{if(timer)clearTimeout(timer);subscription.remove();};
 },[clock]);
 const account=useMemo(()=>{
  if(!isReady)return null;
  const saved=prepareHalloweenObjectives(profile.halloween2026,profile,clock);
  const view=seasonView(deviceHalloweenSnapshot(profile.coins,saved));
  return {...view,local:true,claimable:seasonActive?view.claimable:[]};
 },[isReady,profile,clock,seasonActive]);
 const act=useCallback(async(action:SeasonAction)=>{
  if(!isReady||lock.current)return false;
  if(!HALLOWEEN_PROMOTIONS_ENABLED&&!["enter","equip","unequip"].includes(action.type)){setError(errors.season_ended);return false;}
  lock.current=true;setBusy(true);setError("");
  try{await applyHalloweenAction(action);return true;}
  catch(cause){const code=cause instanceof Error?cause.message:"";setError(errors[code]??"تعذر حفظ الموسم على هذا الجهاز. تحقق من مساحة التخزين وأعد المحاولة.");return false;}
  finally{lock.current=false;setBusy(false);}
 },[isReady,applyHalloweenAction]);
 useEffect(()=>{
  if(!isReady||!seasonActive||!profile.halloween2026?.objectiveBaseline)return;
  const next=prepareHalloweenObjectives(profile.halloween2026,profile,clock);
  if(next&&(next.claimedTasks.join("|")!==profile.halloween2026.claimedTasks.join("|")||next.claimedAchievements.join("|")!==profile.halloween2026.claimedAchievements.join("|")))void act({type:"enter"});
 },[isReady,seasonActive,profile,clock,act]);
 const refresh=useCallback(()=>act({type:"enter"}),[act]);
 return <Context.Provider value={{enabled:true,seasonActive,account,busy,error,refresh,act,recordClaims:recordHalloweenClaims}}>{children}</Context.Provider>;
}
export function useHalloweenAccount(){return useContext(Context);}
export const halloweenItemForAsset=(key:string)=>HALLOWEEN_ITEMS.find(item=>item.assetKey===key);
