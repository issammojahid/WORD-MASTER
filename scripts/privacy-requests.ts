import {readFileSync,statSync} from 'node:fs';
import {fulfillDeletion} from '../server/privacy-maintenance';
const args=process.argv.slice(2),option=(key:string)=>args.includes(key)?args[args.indexOf(key)+1]:undefined;
if(!process.env.DATABASE_URL)throw Error('Set the reviewed DATABASE_URL explicitly; no environment file is loaded.');
if(args.includes('--fulfill')){
 if(!args.includes('--server-stopped')||!option('--request')||!option('--confirm-player'))throw Error('Stop the application, review ownership, and supply --request and --confirm-player.');
 const backup=option('--backup');if(!backup)throw Error('A fresh tested database backup is required.');const meta=statSync(backup),header=readFileSync(backup).subarray(0,80).toString();if(!meta.isFile()||meta.size<100||Date.now()-meta.mtimeMs>86400000||!header.startsWith('PGDMP')&&!header.includes('PostgreSQL database dump'))throw Error('Expected a pg_dump backup made in the last 24 hours.');
}
const {pool}=await import('../server/db');const client=await pool.connect();try{
 if(!args.includes('--fulfill')){const requests=await client.query("SELECT id,player_id,status,created_at FROM player_deletion_requests WHERE status IN ('pending','processing') ORDER BY created_at");console.log(JSON.stringify(requests.rows,null,2));}
 else{await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'");const result=await fulfillDeletion({query:(sql,values)=>client.query(sql,values)},option('--request')!,option('--confirm-player')!);await client.query('COMMIT');console.log(JSON.stringify(result));}
}catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();await pool.end();}
