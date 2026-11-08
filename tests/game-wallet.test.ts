import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {URL} from 'node:url';
import {drizzle} from 'drizzle-orm/pglite';
import {sql} from 'drizzle-orm';
import express from 'express';
import {PGlite} from '@electric-sql/pglite';
import {reserveCoinEntry,settleCoinEntry,type CoinDatabase,type EntryMatch} from '../server/coin-entry-ledger';
import {changeGameCoins,readGameCoins} from '../server/game-wallet-ledger';
import {gameLevel} from '../shared/game-wallet';

test('level progression follows the existing increasing XP thresholds',()=>{
 assert.equal(gameLevel(99),1);assert.equal(gameLevel(100),2);assert.equal(gameLevel(269),2);assert.equal(gameLevel(270),3);
});

test('authenticated wallet: welcome once, ownership, snapshot tampering, idempotent rewards, shared purchases and match payouts',async()=>{
 // Never load the production .env or connect to an external database in this test.
 process.env.DATABASE_URL='postgres://unused:unused@127.0.0.1:1/unused';
 const {registerGameWallet,walletTransaction}=await import('../server/game-wallet');
 const {db:requestDb}=await import('../server/db');
 const pg=new PGlite();
 await pg.exec(`CREATE TABLE player_profiles(id varchar PRIMARY KEY,name text NOT NULL,coins integer NOT NULL DEFAULT 100,xp integer NOT NULL DEFAULT 0,level integer NOT NULL DEFAULT 1,games_played integer NOT NULL DEFAULT 0,total_score integer NOT NULL DEFAULT 0,updated_at timestamptz DEFAULT now());`);
 for(const file of ['001_online_multiplayer.sql','006_halloween_inventory.sql','008_unified_game_wallet.sql'])await pg.exec(readFileSync(new URL('../server/migrations/'+file,import.meta.url),'utf8'));
 const token='a'.repeat(64),other='b'.repeat(64);
 for(const [id,t] of [['a',token],['b',other]])await pg.query("INSERT INTO online_guest_sessions(id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')",[id,createHash('sha256').update(t).digest('hex')]);
 await pg.exec("INSERT INTO player_profiles(id,name,coins) VALUES('legacy','Archived',7777);INSERT INTO online_guest_wallets(player_id,coins) VALUES('a',9999),('b',8888)");
 const query=(sql:string,values?:unknown[])=>pg.query<Record<string,unknown>>(sql,values);
 const adapter={query,connect:async()=>({query,release(){}})};
 const app=express();app.use(express.json());registerGameWallet(app,adapter as never);
 app.put('/api/player/:id',(req,res)=>res.json(req.body));
 const transactional=drizzle(pg);
 app.post('/api/player/:id/test-rollback',walletTransaction(async(req,res)=>{
  await requestDb.execute(sql`UPDATE player_profiles SET coins=coins-100 WHERE id=${req.params.id}`);
  res.status(400).json({error:'rejected'});
 },transactional as never));
 app.post('/api/player/:id/test-credit',walletTransaction(async(req,res)=>{
  await requestDb.execute(sql`UPDATE player_profiles SET coins=coins+25 WHERE id=${req.params.id}`);
  res.json({ok:true});
 },transactional as never));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const address=server.address();assert.ok(address&&typeof address!=='string');const origin=`http://127.0.0.1:${address.port}`;
 const request=async(path:string,body:unknown={},credential:string|null=token,method='POST')=>{const res=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(credential?{Authorization:`Bearer ${credential}`}:{})},body:JSON.stringify(body)});return {status:res.status,body:await res.json()};};
 try{
  assert.equal((await request('/api/game-wallet/initialize',{},null)).status,401);
  assert.equal((await request('/api/game-wallet/initialize')).body.coins,2000);
  assert.equal((await request('/api/game-wallet/initialize')).body.coins,2000);
  assert.equal((await request('/api/game-wallet/initialize',{},other)).body.coins,2000);
  assert.equal((await request('/api/player/a/test-rollback')).status,400);
  assert.equal(await readGameCoins(adapter,'a'),2000);
  assert.equal((await request('/api/player/a/test-credit')).status,200);
  assert.equal(await readGameCoins(adapter,'a'),2025);
  await changeGameCoins(adapter,'a',-25);
  assert.equal((await pg.query<{coins:number}>("SELECT coins FROM player_profiles WHERE id='legacy'")).rows[0].coins,7777);
  assert.equal((await pg.query<{coins:number}>("SELECT coins FROM online_guest_wallets WHERE player_id='a'")).rows[0].coins,9999);
  assert.equal((await request('/api/player/a',{coins:99999},other,'PUT')).status,403);
  assert.equal((await request('/API/player/%61/',{coins:99999},other,'PUT')).status,403);
  assert.deepEqual((await request('/API/player/%61/',{coins:99999},token,'PUT')).body,{});
  assert.deepEqual((await request('/api/player/a',{coins:99999,xp:999,ownedSkins:['king'],ownedTitles:['vip_gold'],name:'Okay'},token,'PUT')).body,{name:'Okay'});
  assert.equal((await request('/api/player/a/game-result',{coinsWon:99999})).status,400);
  assert.equal((await request('/api/game-wallet/action',{operationId:'offline:test',kind:'offline_match',score:400})).body.coins,2020);
  assert.equal((await request('/api/game-wallet/action',{operationId:'offline:test',kind:'offline_match',score:400})).body.coins,2020);
  assert.equal((await request('/api/game-wallet/action',{operationId:'offline:bad',kind:'offline_match',score:401})).status,400);
  assert.equal((await request('/api/game-wallet/action',{operationId:'level_reward:20',kind:'level_reward',level:20})).status,400);
  const db:CoinDatabase={transaction:fn=>pg.transaction(tx=>fn({query:(sql,values)=>tx.query<Record<string,unknown>>(sql,values)}))};
  const players=[{id:'a',name:'A',score:50,teamId:null,abandoned:false},{id:'b',name:'B',score:0,teamId:null,abandoned:false}];
  const match:EntryMatch={id:'unified-match',settings:{entryFee:1000,matchmakingMode:'solo'},players};
  await assert.rejects(reserveCoinEntry(db,{...match,id:'too-expensive',settings:{entryFee:2500,matchmakingMode:'solo'}}),/insufficient_online_coins/);
  await changeGameCoins(adapter,'a',-250); // Store debit uses the same profile row.
  assert.equal(await readGameCoins(adapter,'a'),1770);
  await reserveCoinEntry(db,match);assert.equal(await readGameCoins(adapter,'a'),770);
  await settleCoinEntry(db,match,{});await settleCoinEntry(db,match,{});
  assert.equal(await readGameCoins(adapter,'a'),2770);assert.equal(await readGameCoins(adapter,'b'),1000);
  await assert.rejects(changeGameCoins(adapter,'a',-3000));assert.equal(await readGameCoins(adapter,'a'),2770);
  assert.equal((await request('/api/game-wallet/initialize')).body.coins,2770);
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await pg.close();}
});
