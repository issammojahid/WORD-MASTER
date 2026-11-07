import type { Pool } from "pg";
import { HALLOWEEN_SEASON, emptySeasonState, SeasonError, type SeasonSnapshot } from "../shared/halloween";
import type { HalloweenRepository } from "./halloween-routes";
export function postgresHalloweenRepository(pool:Pool):HalloweenRepository{return {async transaction(playerId,fn){
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  const player=await client.query("SELECT coins FROM player_profiles WHERE id=$1 FOR UPDATE",[playerId]);
  if(!player.rows[0])throw new SeasonError("player_not_found",404);
  const existing=await client.query("SELECT state FROM player_seasonal_inventory WHERE player_id=$1 AND season_id=$2",[playerId,HALLOWEEN_SEASON]);
  const tasks=await client.query("SELECT DISTINCT task_key FROM player_daily_tasks WHERE player_id=$1 AND claimed=1 AND assigned_date >= $2",[playerId,"2026-10-01"]);
  const achievements=await client.query("SELECT DISTINCT achievement_key FROM player_achievements WHERE player_id=$1 AND claimed=1 AND unlocked=1",[playerId]);
  const previous:SeasonSnapshot={coins:player.rows[0].coins,state:existing.rows[0]?.state??emptySeasonState(),claimedTasks:tasks.rows.map(row=>row.task_key),claimedAchievements:achievements.rows.map(row=>row.achievement_key)};
  const next=fn(previous);
  await client.query("INSERT INTO player_seasonal_inventory (player_id,season_id,state) VALUES ($1,$2,$3::jsonb) ON CONFLICT (player_id,season_id) DO UPDATE SET state=EXCLUDED.state,updated_at=now()",[playerId,HALLOWEEN_SEASON,JSON.stringify(next.state)]);
  if(next.coins!==previous.coins)await client.query("UPDATE player_profiles SET coins=$2,updated_at=now() WHERE id=$1",[playerId,next.coins]);
  await client.query("COMMIT");return next;
 }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}};}
