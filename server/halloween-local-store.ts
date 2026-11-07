import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { emptySeasonState, type SeasonSnapshot } from "../shared/halloween";
import type { HalloweenRepository } from "./halloween-routes";

// Isolated demo storage. Never imports server/db or reads DATABASE_URL.
export function localHalloweenRepository(file:string,fixture:Pick<SeasonSnapshot,"claimedTasks"|"claimedAchievements">={claimedTasks:[],claimedAchievements:[]}):HalloweenRepository{
 mkdirSync(dirname(file),{recursive:true});
 const db=new DatabaseSync(file);
 db.exec("CREATE TABLE IF NOT EXISTS demo_players (id TEXT PRIMARY KEY,snapshot TEXT NOT NULL)");
 return {async transaction(id,fn){
  db.exec("BEGIN IMMEDIATE");
  try{
   const row=db.prepare("SELECT snapshot FROM demo_players WHERE id=?").get(id) as {snapshot:string}|undefined;
   const previous:SeasonSnapshot=row?JSON.parse(row.snapshot):{coins:1000,state:emptySeasonState(),...fixture};
   const next=fn(previous);
   db.prepare("INSERT INTO demo_players(id,snapshot) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET snapshot=excluded.snapshot").run(id,JSON.stringify(next));
   db.exec("COMMIT");return next;
  }catch(error){db.exec("ROLLBACK");throw error;}
 }};
}
