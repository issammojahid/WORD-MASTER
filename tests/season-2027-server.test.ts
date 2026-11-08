import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {URL} from 'node:url';
import express from 'express';
import {PGlite} from '@electric-sql/pglite';
import {registerSeason2027} from '../server/season-2027-routes';
import {SEASON_2027_ITEMS} from '../shared/season-2027';
import type {CoinDatabase} from '../server/coin-entry-ledger';

test('season dates, canonical inventory, paid replay, verified objectives, one gift and archive equipment',async()=>{
 const pg=new PGlite();await pg.exec('CREATE TABLE player_profiles(id varchar PRIMARY KEY,coins integer NOT NULL,updated_at timestamptz DEFAULT now());');
 for(const name of ['001_online_multiplayer.sql','006_halloween_inventory.sql','008_unified_game_wallet.sql'])await pg.exec(readFileSync(new URL('../server/migrations/'+name,import.meta.url),'utf8'));
 await pg.exec("INSERT INTO player_profiles(id,coins) VALUES('a',100000),('b',2000),('legacy',777);INSERT INTO game_wallet_accounts(player_id) VALUES('a'),('b');");
 const database:CoinDatabase={transaction:fn=>pg.transaction(tx=>fn({query:(sql,values)=>tx.query<Record<string,unknown>>(sql,values)}))};
 let clock=new Date('2026-11-30T22:59:59Z'),enabled=true;const app=express();app.use(express.json());registerSeason2027(app,{database,authenticate:async req=>['a','b','legacy'].includes(req.get('authorization')??'')?req.get('authorization')!:null,enabled:()=>enabled,now:()=>clock});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
 const port=address.port;
 async function call(body?:Record<string,unknown>,user='a'){const response=await fetch(`http://127.0.0.1:${port}/api/seasonal-events/${body?'action':'state'}`,{method:body?'POST':'GET',headers:{Authorization:user,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
 const item=(kind:string,variant:number)=>SEASON_2027_ITEMS.find(item=>item.event==='atlas'&&item.kind===kind&&item.art.variant===variant)!;
 try{
  assert.equal(SEASON_2027_ITEMS.length,150);assert.equal(new Set(SEASON_2027_ITEMS.map(i=>i.id)).size,150);
  assert.equal((await call(undefined,'')).status,401);assert.equal((await call(undefined,'legacy')).status,403);
  assert.deepEqual((await call()).data.items,[]);assert.equal((await call({type:'gift',itemId:item('avatar',0).id})).status,403);
  clock=new Date('2026-11-30T23:00:00Z');assert.equal((await call()).data.activeEvent,'atlas');assert.equal((await call()).data.items.length,30);
  const gift={type:'gift',itemId:item('avatar',0).id};assert.equal((await call(gift)).status,200);assert.equal((await call(gift)).data.states.atlas.owned.length,1);assert.equal((await call({type:'gift',itemId:item('frame',0).id})).status,409);
  const purchase={type:'buy',itemId:item('frame',1).id,price:18000};assert.equal((await call({...purchase,price:1})).status,409);assert.equal((await call(purchase)).data.coins,82000);assert.equal((await call(purchase)).data.coins,82000);
  assert.equal((await call(purchase,'b')).status,402);assert.equal((await call({type:'equip',itemId:item('avatar',0).id},'b')).status,403);
  assert.equal((await call({type:'claim',itemId:item('icon',3).id,progress:999999})).status,403);
  for(let i=0;i<5;i++)await pg.query("INSERT INTO online_matches(id,mode,status,completed_at) VALUES($1,'random','completed',$2);",['m'+i,'2026-12-02T12:00:00Z']);
  for(let i=0;i<5;i++)await pg.query('INSERT INTO online_match_participants(match_id,player_id,display_name,score,final_rank) VALUES($1,\'a\',\'A\',20,1)',['m'+i]);
  clock=new Date('2026-12-03T12:00:00Z');const task=await call({type:'claim',itemId:item('icon',3).id});assert.equal(task.status,200);assert.equal(task.data.progress.games,5);assert.equal((await call({type:'claim',itemId:item('avatar',4).id})).status,200);
  assert.equal((await call({type:'equip',itemId:item('avatar',0).id})).status,200);
  clock=new Date('2026-12-11T23:00:00Z');const next=(await call()).data;assert.equal(next.activeEvent,'arabic');assert.equal(next.items.filter((i:{event:string})=>i.event==='atlas').length,4,'only owned Atlas items remain visible');
  assert.equal((await call({type:'buy',itemId:item('background',1).id,price:18000})).status,403);assert.equal((await call({type:'equip',itemId:item('avatar',0).id})).status,200,'owned cosmetics remain usable after event ends');
  enabled=false;assert.equal((await call()).data.activeEvent,null);assert.equal((await call({type:'unequip',eventId:'atlas',category:'avatar'})).status,200);
  assert.equal((await pg.query<{coins:number}>("SELECT coins FROM player_profiles WHERE id='legacy'")).rows[0].coins,777);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await pg.close();}
});
