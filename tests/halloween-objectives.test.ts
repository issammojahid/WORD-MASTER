import test from "node:test";
import assert from "node:assert/strict";
import { HALLOWEEN_ITEMS } from "../shared/halloween";
import { applyDeviceHalloween, HALLOWEEN_END_AT } from "../shared/halloween-update";
import { halloweenObjective, prepareHalloweenObjectives } from "../shared/halloween-objectives";
const now=Date.parse("2026-11-07T12:00:00+01:00");
const start={gamesPlayed:100,wins:40,totalScore:20000,level:2,winStreak:0};

test("season counters start at entry, not lifetime totals or ordinary reward claims",()=>{
 const saved=prepareHalloweenObjectives(undefined,start,now)!;
 assert.deepEqual(saved.objectiveBaseline,start);
 assert.equal(saved.claimedTasks.length,0);
 assert.equal(halloweenObjective("task","play_5",start,saved).progress,0);
 const progressed=prepareHalloweenObjectives(saved,{...start,gamesPlayed:105},now)!;
 assert.ok(progressed.claimedTasks.includes("play_5"));
 assert.equal(progressed.claimedAchievements.includes("win_10"),false);
 assert.deepEqual(progressed.objectiveBaseline,start);
});

test("completed seasonal objectives unlock the existing cosmetic once without changing coins or IDs",()=>{
 const saved=prepareHalloweenObjectives(undefined,start,now)!;
 const completed=prepareHalloweenObjectives(saved,{...start,wins:43},now)!;
 const item=HALLOWEEN_ITEMS.find(item=>item.reward?.type==="task"&&item.reward.key==="win_3")!;
 assert.throws(()=>applyDeviceHalloween(1000,saved,{type:"claim",itemId:item.id},now),/reward_locked/);
 const claimed=applyDeviceHalloween(1000,completed,{type:"claim",itemId:item.id},now);
 assert.equal(claimed.coins,1000);
 assert.ok(claimed.state.owned.includes(item.id));
 assert.deepEqual(applyDeviceHalloween(1000,{...completed,...claimed},{type:"claim",itemId:item.id},now),claimed);
});

test("legacy earned rewards survive, counters tolerate older snapshots, and expiry does not unlock new rewards",()=>{
 const saved=prepareHalloweenObjectives(undefined,start,now)!;
 saved.claimedTasks.push("win_3");
 const restored=JSON.parse(JSON.stringify(saved));
 assert.equal(halloweenObjective("task","win_3",start,restored).completed,true);
 assert.equal(halloweenObjective("task","play_3",{...start,gamesPlayed:90},restored).progress,0);
 const expired=prepareHalloweenObjectives(restored,{...start,gamesPlayed:110},Date.parse(HALLOWEEN_END_AT));
 assert.deepEqual(expired,restored);
 assert.equal(prepareHalloweenObjectives(undefined,start,Date.parse(HALLOWEEN_END_AT)),undefined);
});

test("every existing reward has a themed objective; completed streaks remain unlocked",()=>{
 const saved=prepareHalloweenObjectives(undefined,start,now)!;
 const completed=prepareHalloweenObjectives(saved,{...start,level:5,winStreak:3},now)!;
 const afterLoss=prepareHalloweenObjectives(completed,start,now)!;
 assert.ok(afterLoss.claimedAchievements.includes("streak_3"));
 for(const item of HALLOWEEN_ITEMS){
  if(item.reward)assert.ok(halloweenObjective(item.reward.type,item.reward.key,start,saved).title);
 }
});
