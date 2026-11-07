import test from "node:test";
import assert from "node:assert/strict";
import { isRetiredPlayerName,playerNameKey } from "../shared/game-player-name";
import { cleanResultNames,randomUnusedPlayerName } from "../server/player-name-cleanup";
test("retired player names match substrings and Unicode compatibility forms only in game name fields",()=>{
 assert.ok(isRetiredPlayerName("King_AISSAM_7"));assert.ok(isRetiredPlayerName("Ａｉｓｓａｍ"));assert.equal(isRetiredPlayerName("Atlas"),false);
 const before={id:"p",name:"Aissam",coins:123,xp:456,content:"hello Aissam",email:"aissam@example.test",answers:{city:"Aissam"},players:[{playerId:"q",displayName:"TheAissam",score:99}]};
 const after=cleanResultNames(before,(_,id)=>`Najm_${id}`) as any;
 assert.equal(after.name,"Najm_p");assert.equal(after.players[0].displayName,"Najm_q");assert.equal(after.players[0].score,99);
 assert.equal(after.content,before.content);assert.equal(after.email,before.email);assert.deepEqual(after.answers,before.answers);assert.equal(after.coins,123);assert.equal(after.xp,456);assert.equal(before.name,"Aissam");
 const used=new Set<string>();for(let i=0;i<200;i++){const name=randomUnusedPlayerName(used);assert.ok(name.length<=20);assert.ok(!isRetiredPlayerName(name));assert.ok(used.has(playerNameKey(name)));}assert.equal(used.size,200);
});
