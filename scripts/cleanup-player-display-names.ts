import { mkdir,writeFile } from "node:fs/promises";
import { resolve,join } from "node:path";
import { pool } from "../server/db";
import { PLAYER_NAME_KEY_SQL } from "../server/player-name-store";
import { randomUnusedPlayerName,cleanResultNames } from "../server/player-name-cleanup";
import { isRetiredPlayerName,playerNameKey } from "../shared/game-player-name";
import type { PoolClient } from "pg";

const apply=process.argv.includes("--apply-approved");
const backupDir=process.env.PLAYER_NAME_BACKUP_DIR;
if(!backupDir)throw new Error("PLAYER_NAME_BACKUP_DIR must be a private directory outside the repository");
const targetDir=resolve(backupDir),repoDir=resolve(process.cwd());
if(targetDir===repoDir||targetDir.startsWith(repoDir+"\\")||targetDir.startsWith(repoDir+"/"))throw new Error("Backup must stay outside the repository");
const targets=[
 {table:"social_profiles",id:"player_id",fields:["display_name"],player:"player_id"},
 {table:"online_match_participants",id:"id",fields:["display_name"],player:"player_id"},
 {table:"tournament_players",id:"id",fields:["player_name"],player:"player_id"},
 {table:"tournaments",id:"id",fields:["winner_name"],player:"winner_id"},
 {table:"tournament_matches",id:"id",fields:["player1_name","player2_name","winner_name"],player:""},
 {table:"room_invites",id:"id",fields:["from_player_name"],player:"from_player_id"},
] as const;
type Change={table:string;idColumn:string;id:string;column:string;before:unknown;after:unknown};
let client:PoolClient|undefined;
try{
 await mkdir(targetDir,{recursive:true});
 client=await pool.connect();await client.query("BEGIN");
 await client.query("SET LOCAL lock_timeout='10s'");await client.query("SET LOCAL statement_timeout='60s'");
 await client.query("LOCK TABLE public.player_profiles,public.social_profiles,public.online_match_participants,public.online_matches,public.tournament_players,public.tournaments,public.tournament_matches,public.room_invites,public.social_notifications IN SHARE ROW EXCLUSIVE MODE");
 const digestSql="SELECT md5(coalesce(string_agg(md5((to_jsonb(p)-'name'-'updated_at')::text),'' ORDER BY id),'')) AS digest FROM public.player_profiles p";
 const beforeDigest=(await client.query(digestSql)).rows[0].digest;
 const profiles=(await client.query("SELECT id,name,created_at FROM public.player_profiles ORDER BY created_at,id")).rows;
 const used=new Set(profiles.map(p=>playerNameKey(p.name))),seen=new Set<string>(),renamed=new Map<string,string>(),legacy=new Map<string,string>();
 const changes:Change[]=[];
 for(const row of profiles){
  const key=playerNameKey(row.name),duplicate=seen.has(key);seen.add(key);
  if(isRetiredPlayerName(row.name)||duplicate){
   const name=randomUnusedPlayerName(used);renamed.set(row.id,name);
   changes.push({table:"player_profiles",idColumn:"id",id:row.id,column:"name",before:row.name,after:name});
  }
 }
 const replacement=(name:string,id?:string)=>{
  if(id&&renamed.has(id))return renamed.get(id)!;
  const key=playerNameKey(name);if(!legacy.has(key))legacy.set(key,randomUnusedPlayerName(used));return legacy.get(key)!;
 };
 for(const target of targets){
  const columns=[...new Set([target.id,...target.fields,...(target.player?[target.player]:[])])];
  const rows=(await client.query(`SELECT ${columns.map(c=>`"${c}"`).join(',')} FROM public."${target.table}"`)).rows;
  for(const row of rows)for(const column of target.fields){
   const name=row[column],id=target.player?row[target.player]:undefined;
   if(typeof name!=="string")continue;
   let next=name;
   if(isRetiredPlayerName(name))next=replacement(name,id);
   else if(id&&renamed.has(id))next=renamed.get(id)!;
   if(next!==name){
    changes.push({table:target.table,idColumn:target.id,id:row[target.id],column,before:name,after:next});
    if(target.table==="social_profiles")renamed.set(row[target.id],next);
   }
  }
 }
 for(const [table,column] of [["online_matches","results"],["social_notifications","payload"]]){
  const rows=(await client.query(`SELECT id,"${column}" FROM public."${table}" WHERE "${column}" IS NOT NULL`)).rows;
  for(const row of rows){const after=cleanResultNames(row[column],replacement);if(JSON.stringify(after)!==JSON.stringify(row[column]))changes.push({table,idColumn:"id",id:row.id,column,before:row[column],after});}
 }
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const backup=join(targetDir,`player-names-${stamp}-${apply?'apply':'dry-run'}.json`);
 await writeFile(backup,JSON.stringify({createdAt:new Date().toISOString(),apply,beforeDigest,changes},null,2),{flag:'wx',mode:0o600});
 for(const change of changes){
  const json=change.column==="results"||change.column==="payload";
  await client.query(`UPDATE public."${change.table}" SET "${change.column}"=$1${json?'::jsonb':''}${change.table==="player_profiles"||change.table==="social_profiles"?',updated_at=now()':''} WHERE "${change.idColumn}"=$2`,[json?JSON.stringify(change.after):change.after,change.id]);
 }
 await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS player_profiles_name_key_unique ON public.player_profiles ((${PLAYER_NAME_KEY_SQL}))`);
 const afterDigest=(await client.query(digestSql)).rows[0].digest;
 if(beforeDigest!==afterDigest)throw new Error("non_name_profile_data_changed");
 const duplicates=await client.query(`SELECT 1 FROM public.player_profiles GROUP BY ${PLAYER_NAME_KEY_SQL} HAVING count(*)>1 LIMIT 1`);
 if(duplicates.rows.length)throw new Error("duplicate_names_remain");
 for(const target of [{table:"player_profiles",fields:["name"]},...targets])for(const column of target.fields){
  const found=await client.query(`SELECT 1 FROM public."${target.table}" WHERE lower(normalize("${column}",NFKC)) LIKE '%aissam%' LIMIT 1`);
  if(found.rows.length)throw new Error("retired_name_remains");
 }
 const summary={applied:apply,changedCells:changes.length,changedByTable:Object.fromEntries([...new Set(changes.map(c=>c.table))].map(table=>[table,changes.filter(c=>c.table===table).length])),profileProgressUnchanged:true,duplicateNamesRemaining:0,retiredNamesRemaining:0,uniqueNameIndex:true};
 await client.query(apply?"COMMIT":"ROLLBACK");
 await writeFile(join(targetDir,`summary-${apply?'applied':'dry-run'}.json`),JSON.stringify(summary,null,2));
 console.log(JSON.stringify(summary));
}catch(error){await client?.query("ROLLBACK").catch(()=>{});console.error("Name cleanup stopped; transaction rolled back:",error instanceof Error?error.message:"unknown");process.exitCode=1;}
finally{client?.release();await pool.end();}
