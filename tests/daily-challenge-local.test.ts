import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { registerLocalDailyChallenge, colorDailyGuess, localDailyWord } from "../server/daily-challenge-local";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
test("duplicate letters consume target occurrences exactly once",()=>{
 assert.deepEqual(colorDailyGuess("بابا","بدره").map(c=>c.status),["correct","absent","absent","absent"]);
 assert.deepEqual(colorDailyGuess("ماما","تمام").map(c=>c.status),["present","present","present","absent"]);
});
test("local daily API persists colors and attempts, limits to six, rolls over, and grants no real coins",async()=>{
 const dir=mkdtempSync(join(process.env.HALLOWEEN_TEST_DIR||tmpdir(),"daily-qa-"));
 let today=new Date("2026-11-06T10:00:00Z");const app=express();app.use(express.json());const file=join(dir,"test.sqlite");
 let closeDb=registerLocalDailyChallenge(app,file,()=>today);
 const server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));
 const address=server.address() as {port:number},base="http://127.0.0.1:"+address.port;
 const get=(id:string)=>fetch(base+"/api/daily-challenge?playerId="+id).then(r=>r.json());
 const guess=(id:string,value:string)=>fetch(base+"/api/daily-challenge/guess",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({playerId:id,guess:value})});
 try{
  const first=await get("a"),word=localDailyWord("2026-11-06");assert.equal(first.word,null);assert.equal(first.local,true);assert.equal(first.entry,null);
  assert.equal((await guess("a","x")).status,400);assert.equal((await get("a")).entry,null);
  const wrong=[...word].map((c,i)=>i===0?c:"ظ").join("");
  assert.equal((await guess("a",wrong)).status,200);
  const restored=await get("a");assert.equal(restored.entry.guessCount,1);assert.deepEqual(restored.entry.coloring[0],colorDailyGuess(wrong,word));assert.equal(restored.word,null);
  for(let i=1;i<6;i++)await guess("a",wrong);
  const lost=await get("a");assert.equal(lost.entry.guessCount,6);assert.equal(lost.entry.completed,true);assert.equal(lost.entry.won,false);assert.equal(lost.word,word);assert.equal((await guess("a",word)).status,400);
  const won=await (await guess("b",word)).json();assert.equal(won.won,true);assert.equal(won.coinsAwarded,0);
  const reopened=new DatabaseSync(file);const persisted=reopened.prepare("SELECT guesses FROM demo_daily_entries WHERE player_id=?").get("b") as {guesses:string};assert.deepEqual(JSON.parse(persisted.guesses),[word]);reopened.close();
  assert.equal((await get("b")).entry.won,true);
  today=new Date("2026-11-07T00:00:00Z");assert.equal((await get("a")).entry,null);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));closeDb();rmSync(dir,{recursive:true,force:true});}
});
