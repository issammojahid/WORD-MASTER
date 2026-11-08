import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

// No environment file is loaded by this script. The operator chooses the target explicitly.
const files=['004_cosmetic_inventory.sql','005_retained_gameplay.sql','006_halloween_inventory.sql','008_unified_game_wallet.sql','009_rewarded_ads.sql','010_privacy_requests.sql'];
const args=process.argv.slice(2);const option=(name:string)=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
const plan=files.map(file=>{const path=resolve('server/migrations',file),sql=readFileSync(path,'utf8');return {file,sql,sha256:createHash('sha256').update(sql).digest('hex')};});
if(!args.includes('--check')&&!args.includes('--apply')){console.log(JSON.stringify({mode:'plan-only',note:'Requires existing core/online/social schema. Never runs migration 002 or renames existing players with 007.',migrations:plan.map(({file,sha256})=>({file,sha256}))},null,2));}
else{
 const url=process.env.DATABASE_URL;if(!url)throw Error('Set DATABASE_URL explicitly; no environment file is loaded.');const host=new URL(url).hostname;
 if(args.includes('--apply')){
  if(option('--confirm-host')!==host)throw Error('The explicit target hostname must match --confirm-host.');
  const backup=option('--backup');if(!backup)throw Error('A fresh verified database backup is required.');const meta=statSync(backup);const header=readFileSync(backup).subarray(0,80).toString();if(!meta.isFile()||meta.size<100||Date.now()-meta.mtimeMs>86400000||!header.startsWith('PGDMP')&&!header.includes('PostgreSQL database dump'))throw Error('Expected a pg_dump backup made in the last 24 hours. Test its restoration before applying.');
 }
 const {pool}=await import('../server/db');const client=await pool.connect();
 try{
  if(args.includes('--check')){await client.query('BEGIN READ ONLY');const tables=await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[]) ORDER BY table_name",[['player_profiles','online_guest_sessions','online_matches','social_profiles','player_seasonal_inventory','game_wallet_accounts','rewarded_ad_sessions','player_deletion_requests']]);console.log(JSON.stringify({host,tables:tables.rows},null,2));await client.query('ROLLBACK');}
  else{
   await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';");await client.query("SELECT pg_advisory_xact_lock(2027,290)");
   for(const prerequisite of ['player_profiles','online_guest_sessions','online_matches','social_profiles']){const row=await client.query('SELECT to_regclass($1) AS name',['public.'+prerequisite]);if(!row.rows[0]?.name)throw Error('Missing prerequisite table: '+prerequisite);}
   await client.query('CREATE TABLE IF NOT EXISTS release_migration_receipts(file text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now()); ALTER TABLE release_migration_receipts ENABLE ROW LEVEL SECURITY;');
   for(const migration of plan){const receipt=await client.query('SELECT sha256 FROM release_migration_receipts WHERE file=$1',[migration.file]);if(receipt.rows.length){if(receipt.rows[0].sha256!==migration.sha256)throw Error('Migration checksum changed: '+migration.file);continue;}const sql=migration.sql.replace(/^\s*BEGIN;\s*$/gim,'').replace(/^\s*COMMIT;\s*$/gim,'');await client.query(sql);await client.query('INSERT INTO release_migration_receipts(file,sha256) VALUES($1,$2)',[migration.file,migration.sha256]);}
   await client.query('COMMIT');console.log('Reviewed additive migrations applied to '+host);
  }
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();await pool.end();}
}
