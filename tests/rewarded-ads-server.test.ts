import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {URL} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
import express from 'express';
import {registerRewardedAds,ADMOB_VALIDATION_CUSTOM_DATA} from '../server/rewarded-ads';
import {reserveCoinEntry,settleCoinEntry,type CoinDatabase,type EntryMatch} from '../server/coin-entry-ledger';
import type {VerifiedAdCallback} from '../server/admob-ssv';
test('verified rewards: six independent daily stages, six separate recoveries, owner isolation, expiry and exactly-once wallet credits',async()=>{
 const pg=new PGlite();
 await pg.exec('CREATE TABLE player_profiles(id varchar PRIMARY KEY,name text,coins integer NOT NULL,updated_at timestamptz DEFAULT now());');
 for(const name of ['001_online_multiplayer.sql','006_halloween_inventory.sql','008_unified_game_wallet.sql','009_rewarded_ads.sql','009_rewarded_ads.sql'])await pg.exec(readFileSync(new URL('../server/migrations/'+name,import.meta.url),'utf8'));
 await pg.exec("INSERT INTO player_profiles(id,name,coins) VALUES('a','A',20000),('b','B',20000),('old','Legacy',1234);INSERT INTO game_wallet_accounts(player_id) VALUES('a'),('b');");
 const database:CoinDatabase={transaction:fn=>pg.transaction(tx=>fn({query:(sql,values)=>tx.query<Record<string,unknown>>(sql,values)}))};
 const callbacks=new Map<string,VerifiedAdCallback>();let clock=new Date('2026-11-08T12:00:00Z'),sequence=0;
 const app=express();app.use(express.json());registerRewardedAds(app,{database,authenticate:async req=>req.get('authorization')==='Bearer a'?'a':req.get('authorization')==='Bearer b'?'b':null,verify:async key=>{const data=callbacks.get(key);if(!data)throw Error('invalid');return data;},config:{enabled:true,recoveryDailyLimit:6},now:()=>clock});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');const origin=`http://127.0.0.1:${address.port}`;
 async function call(path:string,body?:unknown,user:string|null='a'){const response=await fetch(origin+'/api/rewarded-ads'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(user?{Authorization:'Bearer '+user}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};}
 const balance=async(id='a')=>Number((await pg.query<{coins:number}>('SELECT coins FROM player_profiles WHERE id=$1',[id])).rows[0].coins);
 async function complete(session:{customData:string},user='a'){const key='cb'+(++sequence);callbacks.set(key,{userId:user,customData:session.customData,adUnit:'5071837508',timestamp:clock.getTime(),transactionId:sequence.toString(16).padStart(32,'0')});const first=await call('/ssv?'+key,undefined,null);const second=await call('/ssv?'+key,undefined,null);assert.equal(first.status,200);assert.equal(second.status,200);}
 try{
  const beforeValidation=await balance('old');
  callbacks.set('console-validation',{userId:'admob_validation',customData:ADMOB_VALIDATION_CUSTOM_DATA,adUnit:'5071837508',timestamp:clock.getTime(),transactionId:'a'.repeat(32)});
  assert.deepEqual(await call('/ssv?console-validation',undefined,null),{status:200,body:{ok:true,credited:false}});
  assert.equal(await balance('old'),beforeValidation,'console validation must never grant coins');
  assert.equal((await pg.query('SELECT id FROM rewarded_ad_sessions WHERE custom_data=$1',[ADMOB_VALIDATION_CUSTOM_DATA])).rows.length,0);
  assert.equal((await call('/daily',undefined,null)).status,401);
  let total=0;
  for(const amount of [100,250,500,1000,1500,2000]){
   const session=await call('/sessions',{kind:'coins',coins:999999});assert.equal(session.status,200);assert.equal(session.body.coins,amount);
   const again=await call('/sessions',{kind:'coins'});assert.equal(again.body.id,session.body.id);
   assert.equal((await call('/sessions/'+session.body.id,undefined,'b')).status,404);
   assert.equal(await balance(),20000+total);
   await complete(session.body);total+=amount;assert.equal(await balance(),20000+total);
  }
  assert.equal(total,5350);assert.equal((await call('/offer?kind=coins')).status,429);assert.equal((await call('/daily')).body.completed,6);
  for(let i=0;i<7;i++){
   const match:EntryMatch={id:'loss-'+i,settings:{entryFee:1000,matchmakingMode:'solo'},players:[{id:'a',name:'A',score:0,teamId:null,abandoned:false},{id:'b',name:'B',score:50,teamId:null,abandoned:false}]};
   await reserveCoinEntry(database,match);await settleCoinEntry(database,match,{});await pg.query('UPDATE online_matches SET completed_at=$2 WHERE id=$1',[match.id,clock.toISOString()]);
   if(i<6){const session=await call('/sessions',{kind:'loss-recovery',matchId:match.id});assert.equal(session.body.coins,500);const before=await balance();await complete(session.body);assert.equal(await balance(),before+500);assert.equal((await call('/offer?kind=loss-recovery&matchId='+match.id)).status,409);}
   else assert.equal((await call('/offer?kind=loss-recovery&matchId='+match.id)).status,429);
  }
  assert.equal((await call('/daily')).body.recoveries,6);assert.equal(await balance('old'),1234);
  assert.equal((await call('/offer?kind=loss-recovery&matchId=loss-0',undefined,'b')).status,409,'winning player cannot recover');
  clock=new Date('2026-11-09T12:00:00Z');assert.equal((await call('/daily')).body.completed,0);
  const pending=await call('/sessions',{kind:'coins'});clock=new Date(clock.getTime()+31*60000);assert.equal((await call('/sessions/'+pending.body.id)).body.status,'expired');
  const fresh=await call('/sessions',{kind:'coins'});assert.notEqual(fresh.body.id,pending.body.id);assert.equal(fresh.body.coins,100);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await pg.close();}
});
