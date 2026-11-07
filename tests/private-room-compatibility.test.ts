import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io, type Socket } from "socket.io-client";
import { z } from "zod";
import { privateRoomPayload,friendRoomSettingsSchema } from "../shared/friends-room";

test("private room payload keeps all valid choices and excludes public-game fields",()=>{
 for(const maxPlayers of [2,4,6,8])for(const rounds of [3,5,7])for(const secondsPerRound of [45,60,90]){
  const payload=privateRoomPayload({maxPlayers,rounds,secondsPerRound,teamMode:'solo',entryFee:1000,matchmakingMode:'four'} as any);
  assert.deepEqual(payload,{maxPlayers,rounds,secondsPerRound});
  assert.equal(friendRoomSettingsSchema.parse(payload).teamMode,'solo');
 }
 assert.equal(friendRoomSettingsSchema.parse(privateRoomPayload({maxPlayers:4,rounds:5,secondsPerRound:60,teamMode:'duo'})).teamMode,'duo');
 assert.throws(()=>privateRoomPayload({maxPlayers:2,rounds:5,secondsPerRound:60,teamMode:'duo'}));
 assert.throws(()=>privateRoomPayload({maxPlayers:4,rounds:4,secondsPerRound:60}));
});

test("two Socket.IO clients create and join a private solo room on an old strict server",async()=>{
 const server=createServer(express()),sockets:Socket[]=[];
 const service=new Server(server,{serveClient:false});let members=0;
 const legacy=z.object({maxPlayers:z.number(),rounds:z.number(),secondsPerRound:z.number()}).strict();
 service.on('connection',socket=>{
  socket.on('room:create',(payload,ack)=>{if(!legacy.safeParse(payload).success)return ack({ok:false,error:'invalid_settings'});members=1;socket.join('room');ack({ok:true,roomCode:'ABC234'});});
  socket.on('room:join',(payload,ack)=>{assert.equal(payload.roomCode,'ABC234');members++;socket.join('room');ack({ok:true,players:members});});
 });
 server.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const address=server.address();assert.ok(address&&typeof address!=='string');
 const ack=(socket:Socket,event:string,payload:unknown)=>new Promise<any>((resolve,reject)=>socket.timeout(3000).emit(event,payload,(error:Error|null,result:any)=>error?reject(error):resolve(result)));
 try{
  for(let i=0;i<2;i++){const socket=io(`http://127.0.0.1:${address.port}`,{autoConnect:false,forceNew:true,transports:['websocket']});sockets.push(socket);const ready=new Promise<void>(r=>socket.once('connect',r));socket.connect();await ready;}
  const settings={maxPlayers:4,rounds:5,secondsPerRound:60,teamMode:'solo' as const};
  assert.equal((await ack(sockets[0],'room:create',settings)).error,'invalid_settings');
  const created=await ack(sockets[0],'room:create',privateRoomPayload(settings));assert.equal(created.ok,true);
  assert.equal((await ack(sockets[1],'room:join',{roomCode:created.roomCode})).players,2);
 }finally{sockets.forEach(s=>s.disconnect());await new Promise<void>(r=>service.close(()=>r()));}
});
