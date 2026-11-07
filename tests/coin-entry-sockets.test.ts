import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {createServer} from "node:http";
import {io,type Socket} from "socket.io-client";
import {registerLocalFriendsRooms} from "../server/friends-room-local";
const wait=(s:Socket,event:string,predicate:(data:any)=>boolean=()=>true)=>new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>{s.off(event,listener);reject(Error(event));},4000);function listener(data:any){if(!predicate(data))return;clearTimeout(timer);s.off(event,listener);resolve(data);}s.on(event,listener);});
test("paid socket games reserve only at start, settle once, and FFA continues after early forfeits",async()=>{
 const app=express();app.use(express.json());const http=createServer(app),service=registerLocalFriendsRooms(app,http,{countdownMs:10,initialOnlineCoins:1000});await new Promise<void>(r=>http.listen(0,"127.0.0.1",r));const base="http://127.0.0.1:"+(http.address() as {port:number}).port,clients:{socket:Socket;token:string;id:string}[]=[];
 async function client(){const {token}=await(await fetch(base+"/api/online/guest-session",{method:"POST"})).json();const socket=io(base,{autoConnect:false,transports:["websocket"],reconnection:false,auth:{token,displayName:"Coin QA"}});const ready=wait(socket,"session:ready");socket.connect();const {playerId}=await ready;const c={socket,token,id:playerId};clients.push(c);return c;}
 const wallet=async(c:typeof clients[number])=>(await(await fetch(base+"/api/online/wallet",{headers:{Authorization:"Bearer "+c.token}})).json()).coins;
 try{const a=await client(),b=await client();
  const queued=wait(a.socket,"match:queued");a.socket.emit("match:find",{mode:"solo",entryFee:100});await queued;assert.equal(await wallet(a),1000);a.socket.emit("match:cancel-search");await wait(a.socket,"match:search-cancelled");assert.equal(await wallet(a),1000);
  const found=wait(a.socket,"match:found");a.socket.emit("match:find",{mode:"solo",entryFee:100});b.socket.emit("match:find",{mode:"solo",entryFee:100});let match=await found;assert.equal(match.settings.entryFee,100);const round=wait(a.socket,"match:round");a.socket.emit("match:ready",{matchId:match.matchId});b.socket.emit("match:ready",{matchId:match.matchId});await round;assert.equal(await wallet(a),900);assert.equal(await wallet(b),900);
  const finished=wait(a.socket,"match:finished");b.socket.emit("match:forfeit",{matchId:match.matchId});b.socket.emit("match:forfeit",{matchId:match.matchId});const result=await finished;assert.equal(result.players.find((p:any)=>p.playerId===a.id).coinsAwarded,200);assert.equal(await wallet(a),1100);assert.equal(await wallet(b),900);
  const c=await client(),d=await client();const group=[a,b,c,d];const four=wait(a.socket,"match:found");for(const p of group)p.socket.emit("match:find",{mode:"four",entryFee:100});match=await four;const fourRound=wait(a.socket,"match:round");for(const p of group)p.socket.emit("match:ready",{matchId:match.matchId});await fourRound;
  let settled=false;a.socket.on("match:finished",()=>settled=true);b.socket.emit("match:forfeit",{matchId:match.matchId});await wait(a.socket,"room:update",r=>r.players.some((p:any)=>p.id===b.id&&p.abandoned));assert.equal(settled,false);c.socket.emit("match:forfeit",{matchId:match.matchId});await wait(a.socket,"room:update",r=>r.players.filter((p:any)=>p.abandoned).length===2);assert.equal(settled,false);const end=wait(a.socket,"match:finished");d.socket.emit("match:forfeit",{matchId:match.matchId});const final=await end;assert.equal(final.players.find((p:any)=>p.playerId===a.id).coinsAwarded,400);assert.equal(await wallet(a),1400);
  const poor=await client();const denied=wait(poor.socket,"online:error",r=>r.code==="insufficient_online_coins");poor.socket.emit("match:find",{mode:"solo",entryFee:2500});await denied;assert.equal(await wallet(poor),1000);
 }finally{clients.forEach(c=>c.socket.disconnect());service.close();}
});
