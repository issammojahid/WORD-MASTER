import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { io, type Socket } from "socket.io-client";
import { registerLocalFriendsRooms } from "../server/friends-room-local";
import { friendRoomSettingsSchema,roomTeamAssignment,roomTeamScores,roomTeamsValid } from "../shared/friends-room";
import { getWordsForLetter,CATEGORY_MAP } from "../server/wordDatabase";
import { GAME_CATEGORIES } from "../constants/i18n";
const wait=(socket:Socket,event:string,predicate:(data:any)=>boolean=()=>true)=>new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>{socket.off(event,listener);reject(new Error("timeout "+event));},4000);function listener(data:any){if(!predicate(data))return;clearTimeout(timer);socket.off(event,listener);resolve(data);}socket.on(event,listener);});
const ack=(socket:Socket,event:string,payload:unknown)=>new Promise<any>((resolve,reject)=>{socket.timeout(3000).emit(event,payload,(error:Error|null,value:unknown)=>error?reject(error):resolve(value));});
test("room settings stay compatible and 2v2 requires exactly four seats",()=>{assert.equal(friendRoomSettingsSchema.parse({maxPlayers:4,rounds:3,secondsPerRound:45}).teamMode,"solo");assert.equal(friendRoomSettingsSchema.safeParse({maxPlayers:2,rounds:3,secondsPerRound:45,teamMode:"duo"}).success,false);assert.equal(friendRoomSettingsSchema.safeParse({maxPlayers:4,rounds:3,secondsPerRound:45,teamMode:"duo"}).success,true);});
test("teams balance two players each and sum canonical individual scores",()=>{const p=[{id:"a",score:10},{id:"b",score:20},{id:"c",score:30},{id:"d",score:5}],assign=roomTeamAssignment(p,"duo"),players=p.map(p=>({...p,teamId:assign.get(p.id)}));assert.equal(roomTeamsValid(players),true);assert.equal(roomTeamsValid(players.slice(0,3)),false);const scores=roomTeamScores(players,"duo");assert.equal(scores[0].score,40);assert.equal(scores[1].score,25);assert.equal(scores[0].rank,1);assert.deepEqual(roomTeamScores(players,"solo"),[]);const forfeited=roomTeamScores(players.map(p=>({...p,abandoned:p.id==="a"})),"duo");assert.equal(forfeited[0].rank,2);assert.equal(forfeited[1].rank,1);});
test("four real sockets: membership, full rooms, start gating, chat spoofing/rate limits, 2v2 scoring, rematch and reconnect",async()=>{
 const app=express();app.use(express.json());const http=createServer(app),service=registerLocalFriendsRooms(app,http,{countdownMs:10,resultsMs:30,graceMs:500});await new Promise<void>(resolve=>http.listen(0,"127.0.0.1",resolve));const base="http://127.0.0.1:"+(http.address() as {port:number}).port,clients:Socket[]=[],identities:string[]=[];
 async function connect(name:string){const {token}=await (await fetch(base+"/api/online/guest-session",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})).json();const socket=io(base,{autoConnect:false,transports:["websocket"],auth:{token,displayName:name},reconnection:false});clients.push(socket);const ready=wait(socket,"session:ready");socket.connect();identities.push((await ready).playerId);return socket;}
 try{
  for(let i=0;i<5;i++)await connect("QA "+i);
  const host=clients[0],settings={maxPlayers:4,rounds:3,secondsPerRound:45,teamMode:"duo"};
  const created=await ack(host,"room:create",settings);assert.equal(created.ok,true);let room=created.match;const matchId=room.matchId;
  for(let i=1;i<3;i++)assert.equal((await ack(clients[i],"room:join",{roomCode:created.roomCode})).ok,true);
  const gated=wait(host,"online:error",d=>d.code==="teams_require_four");host.emit("room:start",{matchId});await gated;
  const joined=await ack(clients[3],"room:join",{roomCode:created.roomCode});room=joined.match;assert.equal(room.players.length,4);assert.deepEqual(room.teams.map((t:any)=>t.playerIds.length),[2,2]);
  assert.equal((await ack(clients[4],"room:join",{roomCode:created.roomCode})).error,"room_full");
  let outsiderMessages=0;clients[4].on("room:quick-message",()=>outsiderMessages++);
  const denied=wait(clients[4],"online:error");clients[4].emit("room:quick-message",{matchId,messageId:"nice"});await denied;
  const bad=wait(clients[1],"online:error",d=>d.code==="invalid_payload");clients[1].emit("room:quick-message",{matchId,messageId:"custom text"});await bad;
  for(let i=0;i<3;i++){const message=wait(clients[2],"room:quick-message");host.emit("room:quick-message",{matchId,messageId:"nice",playerId:identities[4],playerName:"spoof"});const data=await message;assert.equal(data.playerId,identities[0]);assert.equal(data.playerName,"QA 0");}
  const limited=wait(host,"online:error",d=>d.code==="rate_limited");host.emit("room:quick-message",{matchId,messageId:"thanks"});await limited;assert.equal(outsiderMessages,0);
  const notReady=wait(host,"online:error",d=>d.code==="players_not_ready");host.emit("room:start",{matchId});await notReady;
  const allReady=wait(host,"room:update",d=>d.players.length===4&&d.players.every((p:any)=>p.ready));for(const socket of clients.slice(0,4))socket.emit("room:ready",{matchId});await allReady;
  let next=wait(host,"match:round");host.emit("room:start",{matchId});let round=await next;
  for(let n=1;n<=3;n++){
   assert.equal(round.round,n);const resultsPromise=wait(host,"match:round-results");const upcoming=wait(host,n===3?"match:finished":"match:round");
   const answers=Object.fromEntries(GAME_CATEGORIES.map(category=>[category,getWordsForLetter(CATEGORY_MAP[category]!,round.letter)[0]??""]));
   for(const socket of clients.slice(0,4))socket.emit("match:submit",{matchId,answers});const results=await resultsPromise;assert.equal(results.results.length,4);assert.equal(results.teams.reduce((sum:number,t:any)=>sum+t.score,0),results.results.reduce((sum:number,p:any)=>sum+p.totalScore,0));
   round=await upcoming;
  }
  assert.ok(round.players.every((p:any)=>p.coinsAwarded===0));assert.equal(round.teams.length,2);
  const rematch=wait(host,"room:update",d=>d.matchId!==matchId&&d.phase==="waiting");host.emit("room:rematch",{matchId});const reset=await rematch;assert.ok(reset.players.every((p:any)=>!p.ready&&p.score===0));assert.equal(reset.messages.length,0);
  clients[3].disconnect();const restored=wait(clients[3],"match:restored");clients[3].connect();assert.equal((await restored).matchId,reset.matchId);
  const migrated=wait(clients[1],"room:update",d=>d.hostId!==identities[0]);host.emit("room:leave",{matchId:reset.matchId});assert.equal((await migrated).players.length,3);
 }finally{clients.forEach(s=>s.disconnect());service.close();}
});
