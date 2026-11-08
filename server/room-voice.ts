import type {VoiceIceServer} from '../shared/voice-ice';
import { z } from "zod";
import type { Server, Socket } from "socket.io";
const id = z.string().min(1).max(80);
const joinSchema = z.object({ matchId:id });
const signalSchema = z.object({matchId:id,to:id,signal:z.union([
 z.object({type:z.enum(["offer","answer"]),sdp:z.string().min(1).max(12000)}),
 z.object({type:z.literal("ice"),candidate:z.object({candidate:z.string().max(2000),sdpMid:z.string().max(80).nullable().optional(),sdpMLineIndex:z.number().int().min(0).max(20).nullable().optional(),usernameFragment:z.string().max(256).optional()})})
])});
type Member={socket:Socket;playerId:string;matchId:string;seen:number};
// Only signalling travels through Socket.IO. Audio is never recorded or stored here.
export function createRoomVoice(io:Server,authorize:(socket:Socket,matchId:string)=>boolean,iceFor:(playerId:string)=>VoiceIceServer[]=()=>[]){
 const members=new Map<string,Member>();
 const valid=(m:Member)=>m.socket.connected&&Date.now()-m.seen<15000&&authorize(m.socket,m.matchId);
 function roster(matchId:string){return [...members.values()].filter(m=>m.matchId===matchId&&valid(m)).map(m=>({peerId:m.socket.id,playerId:m.playerId}));}
 function publish(matchId:string){const peers=roster(matchId);for(const m of members.values())if(m.matchId===matchId)m.socket.emit("voice:peers",{matchId,peers});}
 function remove(socketId:string,revoked=false){const m=members.get(socketId);if(!m)return;members.delete(socketId);if(revoked)m.socket.emit("voice:revoked",{matchId:m.matchId});publish(m.matchId);}
 const sweep:ReturnType<typeof globalThis.setInterval>=setInterval(()=>{for(const m of members.values())if(!valid(m))remove(m.socket.id,true);},1000);
 io.engine.on("close",()=>{clearInterval(sweep);members.clear();});
 return {attach(socket:Socket,playerId:string){
  let count=0,windowStart=Date.now();
  function allowed(){if(Date.now()-windowStart>10000){count=0;windowStart=Date.now();}return ++count<=160;}
  socket.on("voice:join",(payload:unknown,ack?: (value:unknown)=>void)=>{
   if(typeof ack!=="function")return;
   const parsed=joinSchema.safeParse(payload);if(!allowed()||!parsed.success||!authorize(socket,parsed.data.matchId))return ack({ok:false,error:"voice_not_allowed"});
   const matchId=parsed.data.matchId;
   for(const m of members.values())if(m.playerId===playerId&&m.socket.id!==socket.id)remove(m.socket.id,true);
   remove(socket.id);members.set(socket.id,{socket,playerId,matchId,seen:Date.now()});
   ack({ok:true,peers:roster(matchId),iceServers:iceFor(playerId)});publish(matchId);
  });
  socket.on("voice:heartbeat",(payload:unknown)=>{const m=members.get(socket.id);if(m&&allowed()&&joinSchema.safeParse(payload).success&&(payload as {matchId:string}).matchId===m.matchId&&authorize(socket,m.matchId))m.seen=Date.now();});
  socket.on("voice:signal",(payload:unknown)=>{
   if(!allowed())return;const parsed=signalSchema.safeParse(payload);if(!parsed.success)return;
   const data=parsed.data,from=members.get(socket.id),to=members.get(data.to);
   if(!from||!to||from.matchId!==data.matchId||to.matchId!==data.matchId||from===to||!valid(from)||!valid(to))return;
   to.socket.emit("voice:signal",{matchId:data.matchId,from:socket.id,signal:data.signal});
  });
  socket.on("voice:leave",()=>remove(socket.id));socket.on("disconnect",()=>remove(socket.id));
 },close(){clearInterval(sweep);members.clear();}};
}
