import {URL} from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";
import {ENTRY_FEES} from "../shared/coin-entry";
import {coinEntryPayouts} from "../server/coin-entry-logic";
import {reserveCoinEntry,settleCoinEntry,refundInterruptedCoinEntries,type CoinDatabase,type EntryMatch} from "../server/coin-entry-ledger";
import {PublicMatchmaking} from "../server/public-matchmaking";
const players=[{id:"a",name:"A",score:60,teamId:"sun" as const,abandoned:false},{id:"b",name:"B",score:20,teamId:"moon" as const,abandoned:false},{id:"c",name:"C",score:40,teamId:"sun" as const,abandoned:false},{id:"d",name:"D",score:10,teamId:"moon" as const,abandoned:false}];
test("all entry tiers conserve coins for duel, teams, FFA, tied leaders and forfeits",()=>{
 for(const fee of ENTRY_FEES){assert.deepEqual([...coinEntryPayouts(players.slice(0,2),"solo",fee).values()],[fee*2,0]);assert.deepEqual([...coinEntryPayouts(players,"team",fee).values()],[fee*2,0,fee*2,0]);assert.deepEqual([...coinEntryPayouts(players,"four",fee).values()],[fee*4,0,0,0]);
  assert.deepEqual([...coinEntryPayouts(players.map(p=>({...p,score:10})),"four",fee).values()],[fee,fee,fee,fee]);
  assert.deepEqual([...coinEntryPayouts(players.map(p=>({...p,abandoned:p.id==="a"})),"team",fee).values()],[0,fee*2,0,fee*2]);
  assert.equal([...coinEntryPayouts(players.map(p=>({...p,abandoned:p.id==="a"})),"four",fee).values()].reduce((a,b)=>a+b),fee*4);
 }
});
test("queues isolate entry tiers within every public mode and one identity cannot occupy multiple tiers",()=>{const q=new PublicMatchmaking<string>();q.enqueue("a","a","solo",100);q.enqueue("b","b","solo",500);assert.equal(q.enqueue("a","a2","four",1000).status,"duplicate");assert.equal(q.entriesFor("solo",100).length,1);const m=q.enqueue("c","c","solo",100);assert.equal(m.status,"matched");if(m.status==="matched")assert.deepEqual(m.entries.map(([id])=>id),["a","c"]);assert.equal(q.feeFor("b"),500);assert.equal(q.cancel("b"),"b");});
test("real PostgreSQL transactions: atomic debit, no overdraft, active-match collision rollback, exactly-once payout and restart refunds",async()=>{
 const pg=new PGlite();try{await pg.exec("CREATE TABLE player_profiles(id varchar PRIMARY KEY,coins int NOT NULL DEFAULT 0,updated_at timestamptz DEFAULT now());CREATE TABLE game_wallet_accounts(player_id varchar PRIMARY KEY REFERENCES player_profiles(id));");await pg.exec(readFileSync(new URL("../server/migrations/001_online_multiplayer.sql",import.meta.url),"utf8"));const db:CoinDatabase={transaction:operation=>pg.transaction(tx=>operation({query:(text,values)=>tx.query<Record<string,unknown>>(text,values)}))};
  const coins=async(id:string)=>Number((await pg.query<{coins:number}>('SELECT coins FROM online_guest_wallets WHERE player_id=$1',[id])).rows[0]?.coins??0);
  await pg.query('INSERT INTO online_guest_wallets(player_id,coins) VALUES($1,500),($2,0)',["a","b"]);
  const match:EntryMatch={id:"match-a",settings:{entryFee:100,matchmakingMode:"solo"},players:players.slice(0,2)};
  await assert.rejects(reserveCoinEntry(db,match),/insufficient_online_coins/);assert.equal(await coins("a"),500);assert.equal((await pg.query('SELECT id FROM online_matches')).rows.length,0);
  await pg.query("UPDATE online_guest_wallets SET coins=500 WHERE player_id='b'");await reserveCoinEntry(db,match);assert.equal(await coins("a"),400);assert.equal(await coins("b"),400);
  await assert.rejects(reserveCoinEntry(db,match));assert.equal(await coins("a"),400);
  await assert.rejects(reserveCoinEntry(db,{...match,id:"conflict"}));assert.equal(await coins("a"),400);assert.equal(await coins("b"),400);
  const results=await Promise.all([settleCoinEntry(db,match,{}),settleCoinEntry(db,match,{})]);assert.equal(results[0].get("a")?.amount,200);assert.equal(await coins("a"),600);assert.equal(await coins("b"),400);
  await refundInterruptedCoinEntries(db);assert.equal(await coins("a"),600);
  await reserveCoinEntry(db,{...match,id:"restart"});assert.equal(await coins("a"),500);await refundInterruptedCoinEntries(db);await refundInterruptedCoinEntries(db);assert.equal(await coins("a"),600);assert.equal(await coins("b"),400);
  assert.equal((await pg.query<{n:number}>("SELECT count(*)::int n FROM online_match_participants WHERE active=true")).rows[0].n,0);
  for(const p of players)await pg.query('INSERT INTO online_guest_wallets(player_id,coins) VALUES($1,10000) ON CONFLICT(player_id) DO UPDATE SET coins=10000',[p.id]);
  const team:EntryMatch={id:"team",settings:{entryFee:2500,matchmakingMode:"team"},players};await reserveCoinEntry(db,team);await settleCoinEntry(db,team,{});assert.deepEqual(await Promise.all(players.map(p=>coins(p.id))),[12500,7500,12500,7500]);
  const draw={...team,id:"draw",settings:{entryFee:1000,matchmakingMode:"four" as const},players:players.map(p=>({...p,score:0}))};await reserveCoinEntry(db,draw);await settleCoinEntry(db,draw,{});assert.deepEqual(await Promise.all(players.map(p=>coins(p.id))),[12500,7500,12500,7500]);
 }finally{await pg.close();}
});
