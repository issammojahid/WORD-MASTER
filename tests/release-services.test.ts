import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {URL} from 'node:url';
import express from 'express';
import {PGlite} from '@electric-sql/pglite';
import {registerPrivacyRoutes} from '../server/privacy-routes';
import {registerReleaseRoutes} from '../server/release-routes';
import {getStoreOffer} from '../constants/store-economy';
import type {CoinDatabase} from '../server/coin-entry-ledger';
test('real rankings, authoritative prices, public policies and owner-bound idempotent deletion requests',async()=>{
 const pg=new PGlite();await pg.exec("CREATE TABLE player_profiles(id varchar PRIMARY KEY,name text,coins int,total_score int,wins int,country text,equipped_skin text,updated_at timestamptz DEFAULT now());INSERT INTO player_profiles VALUES('a','ألف',2000,800,3,'MA','student',now()),('b','باء',2000,900,2,'FR','student',now());");
 for(const file of ['008_unified_game_wallet.sql','010_privacy_requests.sql']){
  if(file.startsWith('008'))await pg.exec('CREATE TABLE player_seasonal_inventory(player_id varchar);');
  await pg.exec(readFileSync(new URL('../server/migrations/'+file,import.meta.url),'utf8'));
 }await pg.exec("INSERT INTO game_wallet_accounts(player_id) VALUES('a'),('b');");
 const database:CoinDatabase={transaction:fn=>pg.transaction(tx=>fn({query:(sql,values)=>tx.query<Record<string,unknown>>(sql,values)}))};
 const app=express();app.use(express.json());registerReleaseRoutes(app,{query:(sql,values)=>pg.query<Record<string,unknown>>(sql,values)});registerPrivacyRoutes(app,{database,authenticate:async req=>['a','b'].includes(req.get('authorization')??'')?req.get('authorization')!:null});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');const origin=`http://127.0.0.1:${address.port}`;
 try{
  const global=await (await fetch(origin+'/api/leaderboard')).json();assert.deepEqual(global.entries.map((i:{name:string})=>i.name),['باء','ألف']);
  const local=await (await fetch(origin+'/api/leaderboard?country=MA')).json();assert.equal(local.entries.length,1);assert.equal((await fetch(origin+'/api/leaderboard?country=%27')).status,400);
  const catalog=await (await fetch(origin+'/api/store/catalog')).json();assert.equal(catalog.items.find((i:{id:string})=>i.id==='king').price,getStoreOffer('king')!.price);
  for(const path of ['/privacy','/terms','/delete-data']){const response=await fetch(origin+path);assert.equal(response.status,200);assert.ok(response.headers.get('content-security-policy'));assert.ok((await response.text()).includes('issammojahid1@gmail.com'));}
  const submit=(token:string,confirm=true)=>fetch(origin+'/api/privacy/deletion-request',{method:'POST',headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify({confirm,playerId:'b'})});
  assert.equal((await submit('')).status,401);assert.equal((await submit('a',false)).status,400);
  const first=await (await submit('a')).json(),retry=await (await submit('a')).json();assert.equal(first.request.id,retry.request.id);assert.equal(first.request.status,'pending');
  const rows=await pg.query<{player_id:string}>('SELECT player_id FROM player_deletion_requests');assert.deepEqual(rows.rows,[{player_id:'a'}]);assert.equal((await pg.query('SELECT id FROM player_profiles')).rows.length,2,'request does not silently delete a profile');
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await pg.close();}
});
