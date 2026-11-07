import test from "node:test";
import assert from "node:assert/strict";
import { HALLOWEEN_ITEMS, type SeasonSnapshot } from "../shared/halloween";
import { HALLOWEEN_START_AT, HALLOWEEN_END_AT, isHalloweenSeasonActive, halloweenTimeLeft, applyDeviceHalloween, recordDeviceHalloweenClaims, deviceHalloweenSnapshot, type DeviceHalloween } from "../shared/halloween-update";
const during=Date.parse("2026-11-06T12:00:00+01:00"),end=Date.parse(HALLOWEEN_END_AT);
const save=(value:SeasonSnapshot):DeviceHalloween=>JSON.parse(JSON.stringify({state:value.state,claimedTasks:value.claimedTasks,claimedAchievements:value.claimedAchievements}));
const gift=HALLOWEEN_ITEMS.find(item=>item.gift&&item.category==="avatar")!;
const purchase=HALLOWEEN_ITEMS.find(item=>item.category==="frame"&&item.price!==undefined)!;
test("season is bundled for its full calendar window including all of November 30",()=>{
 const start=Date.parse(HALLOWEEN_START_AT);
 assert.equal(isHalloweenSeasonActive(start-1),false);assert.equal(isHalloweenSeasonActive(start),true);
 assert.equal(isHalloweenSeasonActive(Date.parse("2026-11-30T23:59:59.999+01:00")),true);
 assert.equal(isHalloweenSeasonActive(end),false);assert.equal(end,Date.parse("2026-11-30T23:00:00Z"));
});
test("countdown reports full days and clamps to zero after expiry",()=>{
 assert.deepEqual(halloweenTimeLeft(during),{totalSeconds:2116800,days:24,hours:12,minutes:0,seconds:0});
 assert.equal(halloweenTimeLeft(end-1).totalSeconds,1);assert.equal(halloweenTimeLeft(end+1).totalSeconds,0);
});
test("device gift and wallet survive serialization and retries charge only once",()=>{
 const granted=applyDeviceHalloween(1000,undefined,{type:"gift",itemId:gift.id},during);
 const bought=applyDeviceHalloween(granted.coins,save(granted),{type:"buy",itemId:purchase.id},during);
 assert.equal(bought.coins,1000-purchase.price!);
 const restored=save(bought),retry=applyDeviceHalloween(bought.coins,restored,{type:"buy",itemId:purchase.id},during);
 assert.deepEqual(retry,bought);assert.equal(restored.state.giftItemId,gift.id);
 assert.throws(()=>applyDeviceHalloween(retry.coins,restored,{type:"gift",itemId:HALLOWEEN_ITEMS.find(item=>item.gift&&item.id!==gift.id)!.id},during),/gift_already_claimed/);
});
test("expiry blocks every new seasonal acquisition but retains owned equipment",()=>{
 const granted=applyDeviceHalloween(1000,undefined,{type:"gift",itemId:gift.id},during),saved=save(granted);
 for(const type of ["gift","buy","claim"] as const)assert.throws(()=>applyDeviceHalloween(granted.coins,saved,{type,itemId:purchase.id},end),/season_ended/);
 const equipped=applyDeviceHalloween(granted.coins,saved,{type:"equip",itemId:gift.id},end);
 assert.equal(equipped.state.equipped.avatar,gift.id);assert.equal(equipped.coins,1000);
 const removed=applyDeviceHalloween(1000,save(equipped),{type:"unequip",category:"avatar"},end);
 assert.equal(removed.state.equipped.avatar,undefined);assert.deepEqual(removed.state.owned,[gift.id]);
});
test("existing task reward claims unlock local cosmetics once, with no claims added after expiry",()=>{
 const item=HALLOWEEN_ITEMS.find(item=>item.reward?.type==="task")!;
 assert.throws(()=>applyDeviceHalloween(1000,undefined,{type:"claim",itemId:item.id},during),/reward_locked/);
 const record=recordDeviceHalloweenClaims(1000,undefined,"task",[item.reward!.key,"unknown"],during);
 assert.deepEqual(record.claimedTasks,[item.reward!.key]);
 const claimed=applyDeviceHalloween(1000,record,{type:"claim",itemId:item.id},during);
 assert.equal(claimed.coins,1000);assert.ok(claimed.state.owned.includes(item.id));
 assert.deepEqual(recordDeviceHalloweenClaims(1000,undefined,"task",[item.reward!.key],end).claimedTasks,[]);
});
test("normalization removes unknown IDs and unowned equipment without changing known item IDs",()=>{
 const saved={state:{owned:[gift.id,gift.id,"unknown"],equipped:{avatar:gift.id,frame:purchase.id},giftItemId:gift.id},claimedTasks:[],claimedAchievements:[]};
 const restored=deviceHalloweenSnapshot(700,saved);
 assert.deepEqual(restored.state.owned,[gift.id]);assert.deepEqual(restored.state.equipped,{avatar:gift.id});assert.equal(restored.coins,700);
});
