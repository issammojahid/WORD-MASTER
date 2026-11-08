import {spawnSync} from 'node:child_process';
import {mkdirSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
const args=process.argv.slice(2),option=(name:string)=>args[args.indexOf(name)+1];
if(!args.includes('--bin')||!args.includes('--output')||!process.env.DATABASE_URL)throw Error('Supply --bin, --output and the deliberately selected DATABASE_URL.');
const target=new URL(process.env.DATABASE_URL),output=resolve(option('--output'));mkdirSync(resolve(output,'..'),{recursive:true});
const environment={...process.env,PGHOST:target.hostname,PGPORT:target.port||'5432',PGUSER:decodeURIComponent(target.username),PGPASSWORD:decodeURIComponent(target.password),PGDATABASE:target.pathname.slice(1),PGSSLMODE:'verify-full',PGSSLROOTCERT:resolve('server/certs/supabase-ca.crt')};
// Credentials are inherited through the environment, never process arguments or logs.
const result=spawnSync(resolve(option('--bin')),['--format=custom','--no-owner','--no-privileges','--schema=public','--lock-wait-timeout=10000','--file',output],{env:environment,encoding:'utf8',windowsHide:true});
if(result.status!==0){console.error('Backup failed; no migrations were applied.');process.exitCode=1;}else console.log(JSON.stringify({backup:output,bytes:statSync(output).size,scope:'public application schema and data',host:target.hostname}));
