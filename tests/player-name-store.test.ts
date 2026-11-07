import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import express from "express";
import { registerPlayerNameRoute, isPlayerNameConflict } from "../server/player-name-store";

const migration=()=>readFile(new URL("../server/migrations/007_unique_player_names.sql",import.meta.url),"utf8");
const setup=async()=>{
 const db=new PGlite();
 await db.exec("CREATE TABLE player_profiles(id text PRIMARY KEY,name text NOT NULL,coins int DEFAULT 100,xp int DEFAULT 0,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now())");
 return db;
};
test("prepared migration resolves legacy duplicates, keeps oldest name and all progress, and prevents bypass writes",async()=>{
 const db=await setup();try{
  await db.exec("INSERT INTO player_profiles(id,name,coins,xp,created_at) VALUES ('one','Atlas  Hero',250,999,'2026-01-01'),('two',' atlas hero ',350,777,'2026-02-01'),('three','Ｑａｍａｒ',500,111,'2026-03-01')");
  await db.exec(await migration());
  const rows=await db.query<any>("SELECT id,name,coins,xp FROM player_profiles ORDER BY id");
  assert.equal(rows.rows.find(r=>r.id==='one').name,'Atlas  Hero');
  assert.match(rows.rows.find(r=>r.id==='two').name,/^atlas her_[a-f0-9]{10}$/);
  assert.deepEqual(rows.rows.map(r=>[r.id,r.coins,r.xp]),[['one',250,999],['three',500,111],['two',350,777]]);
  for(const name of ['ATLAS HERO',' atlas   hero ','\tATLAS HERO\t','Qamar'])await assert.rejects(db.query("INSERT INTO player_profiles(id,name) VALUES($1,$2)",[name,name]),(e:any)=>e.code==='23505');
  await db.exec(await migration());
 }finally{await db.close();}
});

test("two HTTP clients cannot claim the same normalized name; same owner can retry and malformed inputs return 400",async()=>{
 const db=await setup();let server:ReturnType<ReturnType<typeof express>["listen"]>|undefined;
 try{
  await db.exec("INSERT INTO player_profiles(id,name) VALUES ('a','Player_a'),('b','Player_b')");await db.exec(await migration());
  // PGlite has one connection. Serialize transactions; the actual unique index remains active.
  let tail=Promise.resolve();
  const pool={connect:async()=>{
   const previous=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve;});await previous;
   return {query:async(sql:string,values?:unknown[])=>sql.includes('pg_advisory_xact_lock')?{rows:[]}:db.query(sql,values),release};
  }};
  const app=express();app.use(express.json());registerPlayerNameRoute(app,pool as any);
  server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server!.once('listening',r));const address=server.address();assert.ok(address&&typeof address!=='string');
  const url=`http://127.0.0.1:${address.port}/api/player/change-name`;
  const rename=(id:unknown,name:unknown)=>fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({player_id:id,new_name:name})});
  const responses=await Promise.all([rename('a','  Atlas   Hero  '),rename('b','atlas hero')]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const winningId=responses[0].status===200?'a':'b';
  assert.equal((await rename(winningId,'ATLAS HERO')).status,200);
  assert.equal((await rename('absent','MissingPlayer')).status,404);
  assert.equal((await rename({},'Valid')).status,400);
  assert.equal((await rename('a',{})).status,400);
  assert.equal((await rename('a','<script>')).status,400);
  assert.equal((await rename('a','King_AISSAM')).status,200);
  assert.equal((await rename('b','king_aissam')).status,409);
  assert.equal((await rename('a','Aissam')).status,200);
  assert.equal((await rename('b','ＡＩＳＳＡＭ')).status,409);
  assert.equal(isPlayerNameConflict({cause:{code:'23505',constraint:'player_profiles_name_key_unique'}}),true);
  assert.equal(isPlayerNameConflict({code:'23505',constraint:'another_constraint'}),false);
 }finally{if(server)await new Promise<void>((r,j)=>server!.close(e=>e?j(e):r()));await db.close();}
});
