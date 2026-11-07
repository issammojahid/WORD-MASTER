import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {createServer} from "node:http";
import {io,type Socket} from "socket.io-client";
import {PublicMatchmaking,getPublicMatchBaseRewards} from "../server/public-matchmaking";
import {registerLocalFriendsRooms} from "../server/friends-room-local";
import {getWordsForLetter,CATEGORY_MAP} from "../server/wordDatabase";
import {GAME_CATEGORIES} from "../constants/i18n";
const wait=(s:Socket,event:string,predicate:(d:any)=>boolean=()=>true)=>new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>{s.off(event,listener);reject(new Error("timeout "+event));},4000);function listener(d:any){if(!predicate(d))return;clearTimeout(timer);s.off(event,listener);resolve(d);}s.on(event,listener);});
const ack=(s:Socket,event:string,payload:unknown)=>new Promise<any>((resolve,reject)=>s.timeout(2000).emit(event,payload,(e:Error|null,d:any)=>e?reject(e):resolve(d)));
test("queues isolate modes, require exactly 2 or 4 identities, preserve FIFO and reject duplicate identities",()=>{
 const q=new PublicMatchmaking<string>();q.enqueue("t1","a","team");q.enqueue("f1","b","four");q.enqueue("t2","c","team");q.enqueue("t3","d","team");
 assert.equal(q.enqueue("t1","spoof","four").status,"duplicate");assert.equal(q.entriesFor("four").length,1);
 const team=q.enqueue("t4","e","team");assert.equal(team.status,"matched");if(team.status==="matched")assert.deepEqual(team.entries.map(([id])=>id),["t1","t2","t3","t4"]);
 assert.equal(q.entriesFor("team").length,0);assert.equal(q.cancel("f1"),"b");assert.equal(q.enqueue("s1","s1","solo").status,"queued");assert.equal(q.enqueue("s2","s2","solo").status,"matched");
});
test("approved public rewards: team win/loss/draw, FFA wins and ties, and no reward for abandoners",()=>{
 const p=[{id:"a",score:60,teamId:"sun" as const,abandoned:false},{id:"b",score:20,teamId:"moon" as const,abandoned:false},{id:"c",score:40,teamId:"sun" as const,abandoned:false},{id:"d",score:10,teamId:"moon" as const,abandoned:false}];
 assert.deepEqual([...getPublicMatchBaseRewards(p,"team").values()],[20,5,20,5]);assert.deepEqual([...getPublicMatchBaseRewards(p.map(x=>({...x,score:10})),"team").values()],[10,10,10,10]);
 assert.deepEqual([...getPublicMatchBaseRewards(p.map(x=>({...x,abandoned:x.id==="a"})),"team").values()],[0,20,5,20]);
 assert.deepEqual([...getPublicMatchBaseRewards(p,"four").values()],[20,5,5,5]);assert.deepEqual([...getPublicMatchBaseRewards(p.map(x=>({...x,score:x.id==="a"||x.id==="b"?50:10})),"four").values()],[10,10,5,5]);assert.deepEqual([...getPublicMatchBaseRewards(p.map(x=>({...x,score:0})),"four").values()],[10,10,10,10]);
 assert.equal(getPublicMatchBaseRewards(p.map(x=>({...x,abandoned:x.id==="a"})),"four").get("a"),0);
});
async function fixture(options={queueMs:120000}){
 const app=express();app.use(express.json());const http=createServer(app),service=registerLocalFriendsRooms(app,http,{...options,countdownMs:10,resultsMs:25,publicRounds:3});await new Promise<void>(resolve=>http.listen(0,"127.0.0.1",resolve));const base="http://127.0.0.1:"+(http.address() as {port:number}).port,sockets:Socket[]=[];
 async function connect(auth?:any){if(!auth){const data=await (await fetch(base+"/api/online/guest-session",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})).json();auth={token:data.token,displayName:"Public QA "+sockets.length};}const socket=io(base,{autoConnect:false,transports:["websocket"],auth,reconnection:false});sockets.push(socket);const ready=wait(socket,"session:ready");socket.connect();await ready;return socket;}
 return {connect,close:()=>{sockets.forEach(s=>s.disconnect());service.close();}};
}
test("real sockets keep team, four-player solo and legacy duels separate and run all three games",async()=>{
 const f=await fixture();try{
  const clients:Socket[]=[];for(let i=0;i<10;i++)clients.push(await f.connect());const team=clients.slice(0,4),four=clients.slice(4,8),solo=clients.slice(8,10);
  let earlyFound=0;team[0].on("match:found",()=>earlyFound++);
  for(let i=0;i<3;i++){const queued=wait(team[i],"match:queued",d=>d.players===i+1);team[i].emit("match:find",{mode:"team"});assert.equal((await queued).needed,4);}
  for(let i=0;i<3;i++){const queued=wait(four[i],"match:queued",d=>d.players===i+1);four[i].emit("match:find",{mode:"four"});assert.equal((await queued).mode,"four");}assert.equal(earlyFound,0);
  const wrong=wait(team[0],"online:error",d=>d.code==="already_in_queue");team[0].emit("match:find",{mode:"four"});await wrong;
  const twin=await f.connect(team[0].auth),duplicate=wait(twin,"match:queued");twin.emit("match:find",{mode:"team"});assert.equal((await duplicate).players,3);twin.disconnect();
  const cancelled=wait(team[0],"match:search-cancelled");team[0].emit("match:cancel-search");await cancelled;const requeued=wait(team[0],"match:queued",d=>d.players===3);team[0].emit("match:find",{mode:"team"});await requeued;
  const teamFound=wait(team[0],"match:found");team[3].emit("match:find",{mode:"team"});const teamMatch=await teamFound;assert.equal(teamMatch.queueMode,"team");assert.equal(teamMatch.players.length,4);assert.deepEqual(teamMatch.teams.map((t:any)=>t.playerIds.length),[2,2]);assert.equal(teamMatch.roomCode,null);
  const fourFound=wait(four[0],"match:found");four[3].emit("match:find",{mode:"four"});const fourMatch=await fourFound;assert.equal(fourMatch.queueMode,"four");assert.deepEqual(fourMatch.teams,[]);
  const queued=wait(solo[0],"match:queued");solo[0].emit("match:find");assert.equal((await queued).needed,2);const soloFound=wait(solo[0],"match:found");solo[1].emit("match:find");const soloMatch=await soloFound;assert.equal(soloMatch.players.length,2);assert.equal(soloMatch.queueMode,"solo");assert.notEqual(teamMatch.matchId,fourMatch.matchId);
  for(const [members,match] of [[team,teamMatch],[four,fourMatch],[solo,soloMatch]] as [Socket[],any][]){
   const first=wait(members[0],"match:round");for(const socket of members)socket.emit("match:ready",{matchId:match.matchId});let round=await first;
   for(let n=1;n<=3;n++){assert.equal(round.round,n);const result=wait(members[0],"match:round-results"),next=wait(members[0],n===3?"match:finished":"match:round");const answers=Object.fromEntries(GAME_CATEGORIES.map(category=>[category,getWordsForLetter(CATEGORY_MAP[category]!,round.letter)[0]??""]));members.forEach(s=>s.emit("match:submit",{matchId:match.matchId,answers}));assert.equal((await result).results.length,members.length);round=await next;}assert.ok(round.players.every((p:any)=>p.coinsAwarded===0));
  }
  const found=wait(four[0],"match:found");four.forEach(s=>s.emit("match:find",{mode:"four"}));const nextMatch=await found;const decline=wait(four[1],"match:cancelled");four[0].emit("match:decline",{matchId:nextMatch.matchId});assert.equal((await decline).reason,"match_cancelled");
  assert.equal((await ack(four[0],"room:create",{maxPlayers:4,rounds:3,secondsPerRound:45,teamMode:"solo"})).ok,true);
 }finally{f.close();}
});
test("timed-out and disconnected queue entries are removed and players can switch modes after cancellation",async()=>{
 const f=await fixture({queueMs:60});try{const a=await f.connect(),b=await f.connect();const timeout=wait(a,"match:queue-timeout");a.emit("match:find",{mode:"team"});await timeout;const queued=wait(a,"match:queued");a.emit("match:find",{mode:"four"});assert.equal((await queued).mode,"four");const two=wait(a,"match:queued",d=>d.players===2);b.emit("match:find",{mode:"four"});await two;const one=wait(a,"match:queued",d=>d.players===1);b.disconnect();await one;const cancelled=wait(a,"match:search-cancelled");a.emit("match:cancel-search");await cancelled;}finally{f.close();}
});
