import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {createServer} from "node:http";
import {io,type Socket} from "socket.io-client";
import {registerLocalFriendsRooms} from "../server/friends-room-local";
const ack=(s:Socket,event:string,payload:unknown)=>new Promise<any>((resolve,reject)=>s.timeout(2000).emit(event,payload,(err:Error|null,data:unknown)=>err?reject(err):resolve(data)));
const wait=(s:Socket,event:string,predicate:(data:any)=>boolean=()=>true)=>new Promise<any>((resolve,reject)=>{const listener=(data:any)=>{if(!predicate(data))return;clearTimeout(timer);s.off(event,listener);resolve(data);};const timer=setTimeout(()=>{s.off(event,listener);reject(Error(event));},3000);s.on(event,listener);});
test("voice is opt-in, private-room scoped, validates signals and cleans leaving/disconnecting/replaced sessions",async()=>{
 const app=express();app.use(express.json());const http=createServer(app),service=registerLocalFriendsRooms(app,http);await new Promise<void>(r=>http.listen(0,"127.0.0.1",r));const base="http://127.0.0.1:"+(http.address() as {port:number}).port,clients:Socket[]=[];
 async function connect(token?:string){token??=(await(await fetch(base+"/api/online/guest-session",{method:"POST"})).json()).token;const s=io(base,{autoConnect:false,transports:["websocket"],reconnection:false,auth:{token,displayName:"Voice QA"}});clients.push(s);const ready=wait(s,"session:ready");s.connect();await ready;return {s,token};}
 try{
  const a=await connect(),b=await connect(),outsider=await connect();
  const room=(await ack(a.s,"room:create",{maxPlayers:4,rounds:3,secondsPerRound:45})).match;const matchId=room.matchId;
  await ack(b.s,"room:join",{roomCode:room.roomCode});
  assert.equal((await ack(outsider.s,"voice:join",{matchId})).ok,false);
  assert.equal((await ack(a.s,"voice:join",{matchId})).peers.length,1);
  let received=0;b.s.on("voice:signal",()=>received++);a.s.emit("voice:signal",{matchId,to:b.s.id,signal:{type:"offer",sdp:"v=0"}});await new Promise(r=>setTimeout(r,60));assert.equal(received,0,"receiver must opt in");
  assert.equal((await ack(b.s,"voice:join",{matchId})).peers.length,2);
  const signal=wait(b.s,"voice:signal");a.s.emit("voice:signal",{matchId,to:b.s.id,from:"spoof",signal:{type:"offer",sdp:"v=0"}});assert.equal((await signal).from,a.s.id);
  const before=received;a.s.emit("voice:signal",{matchId,to:b.s.id,signal:{type:"offer",sdp:"x".repeat(12001)}});a.s.emit("voice:signal",{matchId:"another-room",to:b.s.id,signal:{type:"offer",sdp:"v=0"}});outsider.s.emit("voice:signal",{matchId,to:b.s.id,signal:{type:"offer",sdp:"v=0"}});await new Promise(r=>setTimeout(r,60));assert.equal(received,before);
  const twin=await connect(a.token);const revoked=wait(a.s,"voice:revoked");assert.equal((await ack(twin.s,"voice:join",{matchId})).ok,true);await revoked;
  const gone=wait(twin.s,"voice:peers",d=>d.peers.length===1);b.s.emit("room:leave",{matchId});await gone;
  assert.equal((await ack(b.s,"voice:join",{matchId})).ok,false);
  const alone=wait(twin.s,"voice:peers",d=>d.peers.length===1);twin.s.emit("voice:leave");await new Promise(r=>setTimeout(r,20));assert.equal((await ack(twin.s,"voice:join",{matchId})).peers.length,1);await alone;
  await ack(b.s,"room:join",{roomCode:room.roomCode});
  await ack(b.s,"voice:join",{matchId});const disconnected=wait(b.s,"voice:peers",d=>d.peers.length===1);twin.s.disconnect();await disconnected;
  b.s.emit("room:leave",{matchId});
  // A public match participant cannot join voice even though they are a real member.
  const c=await connect();a.s.emit("room:leave",{matchId});await new Promise(r=>setTimeout(r,50));const found=wait(c.s,"match:found");a.s.emit("match:find");c.s.emit("match:find");const publicMatch=await found;assert.equal((await ack(c.s,"voice:join",{matchId:publicMatch.matchId})).ok,false);
 }finally{clients.forEach(s=>s.disconnect());service.close();}
});
