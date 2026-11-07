import type { Express, Request } from "express";
import { applySeasonAction, HALLOWEEN_SEASON, SeasonError, seasonView, type SeasonAction, type SeasonSnapshot } from "../shared/halloween";
export interface HalloweenRepository { transaction(playerId:string,fn:(snapshot:SeasonSnapshot)=>SeasonSnapshot):Promise<SeasonSnapshot>; }
export function registerHalloweenRoutes(app:Express,repository:HalloweenRepository,options:{enabled:()=>boolean;local?:boolean;authorize?:(request:Request)=>boolean}){
 app.post("/api/player/:id/halloween",async(req,res)=>{
  if(!options.enabled())return res.status(404).json({error:"season_disabled"});
  // Fail closed outside the isolated demo until verified player ownership is wired.
  if(!options.local&&!options.authorize?.(req))return res.status(403).json({error:"ownership_verification_required"});
  if(typeof req.params.id!=="string"||req.params.id.length>100)return res.status(400).json({error:"invalid_player"});
  if(!req.body||typeof req.body!=="object"||!["enter","gift","buy","equip","claim","unequip"].includes(req.body.type))return res.status(400).json({error:"invalid_action"});
  const action:SeasonAction={type:req.body.type,itemId:typeof req.body.itemId==="string"?req.body.itemId:undefined,category:req.body.category};
  try{
   const snapshot=await repository.transaction(req.params.id,previous=>applySeasonAction(previous,action));
   return res.json({...seasonView(snapshot),seasonId:HALLOWEEN_SEASON,local:!!options.local});
  }catch(error){if(error instanceof SeasonError)return res.status(error.status).json({error:error.code});console.error("[halloween] request failed");return res.status(500).json({error:"server_error"});}
 });
}
