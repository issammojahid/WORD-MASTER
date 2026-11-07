import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import { HALLOWEEN_ITEMS, applySeasonAction, emptySeasonState, SeasonError, type SeasonSnapshot } from "../shared/halloween";
import { localHalloweenRepository } from "../server/halloween-local-store";
import { registerHalloweenRoutes } from "../server/halloween-routes";
const initial=(coins=1000):SeasonSnapshot=>({coins,state:emptySeasonState(),claimedTasks:[],claimedAchievements:[]});
const gift=HALLOWEEN_ITEMS.find(item=>item.gift)!;
const paid=HALLOWEEN_ITEMS.find(item=>!item.gift&&item.price!==undefined)!;
const task=HALLOWEEN_ITEMS.find(item=>item.reward?.type==="task")!;
const achievement=HALLOWEEN_ITEMS.find(item=>item.reward?.type==="achievement")!;
test("40 stable unique seasonal IDs; gift candidates are exactly avatar, frame, background and victory",()=>{
 assert.equal(HALLOWEEN_ITEMS.length,40);assert.equal(new Set(HALLOWEEN_ITEMS.map(item=>item.id)).size,40);
 assert.equal(HALLOWEEN_ITEMS.filter(item=>item.gift).length,4);
 assert.deepEqual(HALLOWEEN_ITEMS.filter(item=>item.gift).map(item=>item.category).sort(),["avatar","background","frame","victory"]);
 assert.ok(HALLOWEEN_ITEMS.every(item=>item.reward?item.price===undefined:Number.isSafeInteger(item.price)&&item.price!>=0));
});
test("one gift per player/season, retry is idempotent and not auto-equipped",()=>{
 const first=applySeasonAction(initial(),{type:"gift",itemId:gift.id});
 assert.equal(first.coins,1000);assert.equal(first.state.giftItemId,gift.id);assert.deepEqual(first.state.equipped,{});
 assert.deepEqual(applySeasonAction(first,{type:"gift",itemId:gift.id}),first);
 assert.throws(()=>applySeasonAction(first,{type:"gift",itemId:HALLOWEEN_ITEMS.find(item=>item.gift&&item.id!==gift.id)!.id}),/gift_already_claimed/);
 assert.equal(initial().state.giftItemId,null);
});
test("catalog pricing, insufficient balance, duplicate purchase and unowned equip",()=>{
 assert.throws(()=>applySeasonAction(initial(0),{type:"buy",itemId:paid.id}),/insufficient_coins/);
 assert.throws(()=>applySeasonAction(initial(),{type:"equip",itemId:paid.id}),/not_owned/);
 const bought=applySeasonAction(initial(),{type:"buy",itemId:paid.id});
 assert.equal(bought.coins,1000-paid.price!);
 assert.deepEqual(applySeasonAction(bought,{type:"buy",itemId:paid.id}),bought);
 const equipped=applySeasonAction(bought,{type:"equip",itemId:paid.id});
 assert.equal(equipped.state.equipped[paid.category],paid.id);
 assert.equal(applySeasonAction(equipped,{type:"unequip",category:paid.category}).state.equipped[paid.category],undefined);
});
test("task and achievement rewards require server-held claim records and cannot be bought",()=>{
 for(const item of [task,achievement]){
  assert.throws(()=>applySeasonAction(initial(),{type:"claim",itemId:item.id}),/reward_locked/);
  assert.throws(()=>applySeasonAction(initial(),{type:"buy",itemId:item.id}),/reward_only/);
  const state=initial();(item.reward!.type==="task"?state.claimedTasks:state.claimedAchievements).push(item.reward!.key);
  const next=applySeasonAction(state,{type:"claim",itemId:item.id});assert.equal(next.coins,state.coins);assert.ok(next.state.owned.includes(item.id));
  assert.deepEqual(applySeasonAction(next,{type:"claim",itemId:item.id}),next);
 }
});
test("invalid IDs/actions are rejected without mutating the input",()=>{
 const state=initial(),before=JSON.stringify(state);
 assert.throws(()=>applySeasonAction(state,{type:"buy",itemId:"student"}),SeasonError);
 assert.throws(()=>applySeasonAction(state,{type:"unequip",category:"bogus" as never}),SeasonError);
 assert.equal(JSON.stringify(state),before);
});
test("HTTP routes + persistent isolated store: races, tampering, ownership, disabled mode",async()=>{
 const directory=process.env.HALLOWEEN_TEST_DIR;if(!directory)throw new Error("HALLOWEEN_TEST_DIR required to keep tests isolated");
 const file=join(mkdtempSync(join(directory,"halloween-")),"test.sqlite");
 const store=localHalloweenRepository(file,{claimedTasks:[task.reward!.key],claimedAchievements:[achievement.reward!.key]});
 const app=express();app.use(express.json());let enabled=true;registerHalloweenRoutes(app,store,{enabled:()=>enabled,local:true});
 const server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));
 const address=server.address();assert.ok(address&&typeof address!=="string");
 const api=`http://127.0.0.1:${address.port}/api/player/demo/halloween`;
 const request=async(body:unknown)=>{const response=await fetch(api,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 try{
  const gifts=HALLOWEEN_ITEMS.filter(item=>item.gift);
  const race=await Promise.all([request({type:"gift",itemId:gifts[0].id}),request({type:"gift",itemId:gifts[1].id})]);
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  const purchases=await Promise.all([request({type:"buy",itemId:paid.id,price:0,coins:999999}),request({type:"buy",itemId:paid.id})]);
  assert.ok(purchases.every(r=>r.status===200));
  const state=(await request({type:"enter"})).data;assert.equal(state.coins,1000-paid.price!);assert.equal(state.state.owned.filter((id:string)=>id===paid.id).length,1);
  assert.equal((await request({type:"equip",itemId:paid.id})).status,200);
  assert.equal((await request({type:"claim",itemId:task.id})).status,200);
  assert.equal((await request({type:"claim",itemId:achievement.id})).status,200);
  const otherTask=HALLOWEEN_ITEMS.find(item=>item.reward?.type==="task"&&item.reward.key!==task.reward!.key)!;
  assert.equal((await request({type:"claim",itemId:otherTask.id,claimedTasks:[otherTask.reward!.key]})).status,403);
  assert.equal((await request({type:"buy",itemId:"student"})).status,400);
  const reopened=localHalloweenRepository(file);const persisted=await reopened.transaction("demo",value=>value);
  assert.equal(persisted.state.equipped[paid.category],paid.id);assert.ok(persisted.state.giftItemId);
  const secondPlayer=await reopened.transaction("another-player",value=>value);assert.equal(secondPlayer.state.giftItemId,null);
  enabled=false;assert.equal((await request({type:"enter"})).status,404);
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test("non-demo endpoints fail closed without verified player ownership",async()=>{
 const app=express();app.use(express.json());let touched=false;
 registerHalloweenRoutes(app,{transaction:async()=>{touched=true;return initial();}},{enabled:()=>true});
 const server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));
 const address=server.address();assert.ok(address&&typeof address!=="string");
 try{const response=await fetch(`http://127.0.0.1:${address.port}/api/player/demo/halloween`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"enter"})});assert.equal(response.status,403);assert.equal(touched,false);}
 finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test("removed gift categories stay purchasable and previous gift claims are preserved",()=>{
 for(const category of ["nameplate","icon"]){
   const item=HALLOWEEN_ITEMS.find(item=>item.category===category)!;
   assert.throws(()=>applySeasonAction(initial(),{type:"gift",itemId:item.id}),/not_a_gift/);
   assert.ok(applySeasonAction(initial(),{type:"buy",itemId:item.id}).state.owned.includes(item.id));
   const old=initial();old.state.giftItemId=item.id;old.state.owned.push(item.id);
   assert.deepEqual(applySeasonAction(old,{type:"gift",itemId:item.id}),old);
   assert.throws(()=>applySeasonAction(old,{type:"gift",itemId:gift.id}),/gift_already_claimed/);
 }
});
