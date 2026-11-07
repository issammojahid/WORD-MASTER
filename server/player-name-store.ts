import { cleanPlayerName } from "../shared/player-name";
import type { Express } from "express";
import type { Pool } from "pg";

export const PLAYER_NAME_KEY_SQL="lower(btrim(regexp_replace(normalize(name, NFKC), '[[:space:]]+', ' ', 'g')))";
export function isPlayerNameConflict(error:unknown):boolean{
 if(!error||typeof error!=="object")return false;
 const value=error as {code?:string;constraint?:string;cause?:unknown};
 return value.code==="23505"&&value.constraint==="player_profiles_name_key_unique"||!!value.cause&&isPlayerNameConflict(value.cause);
}
export async function renamePlayer(pool:Pick<Pool,"connect">,playerId:string,value:unknown){
 const name=cleanPlayerName(value);
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext(lower($1)))",[name]);
  const taken=await client.query(`SELECT id FROM public.player_profiles WHERE ${PLAYER_NAME_KEY_SQL}=lower($1) AND id<>$2 LIMIT 1`,[name,playerId]);
  if(taken.rows.length){await client.query("ROLLBACK");return {error:"name_taken" as const};}
  const updated=await client.query("UPDATE public.player_profiles SET name=$1,updated_at=now() WHERE id=$2 RETURNING name",[name,playerId]);
  if(!updated.rows.length){await client.query("ROLLBACK");return {error:"player_not_found" as const};}
  await client.query("COMMIT");
  return {success:true as const,name:String(updated.rows[0].name)};
 }catch(error){await client.query("ROLLBACK").catch(()=>{});if(isPlayerNameConflict(error))return {error:"name_taken" as const};throw error;}
 finally{client.release();}
}
export function registerPlayerNameRoute(app:Express,pool:Pick<Pool,"connect">){
 app.patch("/api/player/change-name",async(req,res)=>{
  const id=req.body?.player_id;
  if(typeof id!=="string"||!id.trim()||id.length>100)return res.status(400).json({error:"missing_fields"});
  try{
   const result=await renamePlayer(pool,id,req.body?.new_name);
   if("error" in result)return res.status(result.error==="name_taken"?409:404).json(result);
   return res.json(result);
  }catch(error){
   if(error instanceof Error&&error.message==="invalid_name")return res.status(400).json({error:"invalid_name"});
   console.error("[player-name] rename failed");return res.status(500).json({error:"server_error"});
  }
 });
}
