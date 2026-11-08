import {parseVoiceIce,type VoiceIceServer} from '@shared/voice-ice';
import {RoomVoiceButton} from "./RoomVoiceButton";
import React,{useEffect,useRef,useState} from "react";
import {AppState,NativeModules,PermissionsAndroid,Platform} from "react-native";
import type {Socket} from "socket.io-client";
import type {MediaStream,MediaStreamTrack,RTCPeerConnection} from "react-native-webrtc";
export type VoiceProps={socket:Socket|null;matchId:string;connected:boolean;players:{id:string;name:string}[]};
type Peer={peerId:string;playerId:string};
type Link={pc:RTCPeerConnection;pending:RTCIceCandidateInit[];tracks:MediaStreamTrack[]};
// Upstream event-target-shim inherited event methods are missing from its exported declarations.
function onNative<T>(target:object,event:string,listener:(value:T)=>void){(target as {addEventListener(type:string,callback:(value:T)=>void):void}).addEventListener(event,listener);}
export function RoomVoiceChat({socket,matchId,connected,players}:VoiceProps){
 const [joined,setJoined]=useState(false),[busy,setBusy]=useState(false),[mic,setMic]=useState(false),[error,setError]=useState(""),[peers,setPeers]=useState<Peer[]>([]),[muted,setMuted]=useState<string[]>([]),[speaking,setSpeaking]=useState<string[]>([]);
 const rtc=useRef<typeof import("react-native-webrtc")|null>(null),stream=useRef<MediaStream|null>(null),links=useRef(new Map<string,Link>()),epoch=useRef(0),active=useRef(false),mutedRef=useRef<string[]>([]);
 function stop(){epoch.current++;active.current=false;stream.current?.getTracks().forEach(t=>t.stop());stream.current?.release();stream.current=null;for(const link of links.current.values())link.pc.close();links.current.clear();setJoined(false);setBusy(false);setMic(false);setPeers([]);setSpeaking([]);}
 const ice=useRef<VoiceIceServer[]>([]);
 const stopRef=useRef(stop);stopRef.current=stop;
 useEffect(()=>{
  if(!socket)return;
  function leave(){socket!.emit("voice:leave");stopRef.current();}
  function linkFor(peerId:string){let link=links.current.get(peerId);if(link)return link;const pc=new rtc.current!.RTCPeerConnection({iceServers:ice.current});link={pc,pending:[],tracks:[]};links.current.set(peerId,link);stream.current?.getAudioTracks().forEach(t=>pc.addTrack(t,stream.current!));
   onNative(pc,"icecandidate",(event:{candidate:{toJSON():RTCIceCandidateInit}|null})=>{if(event.candidate&&active.current)socket!.emit("voice:signal",{matchId,to:peerId,signal:{type:"ice",candidate:event.candidate.toJSON()}});});
   onNative(pc,"track",(event:{track:MediaStreamTrack})=>{if(event.track.kind==="audio"){link!.tracks.push(event.track);event.track._setVolume(mutedRef.current.includes(peerId)?0:1);}});
   onNative(pc,"connectionstatechange",()=>{if(pc.connectionState==="failed")setError("تعذر الاتصال بأحد المشاركين. أعد الدخول إلى الصوت.");});return link;
  }
  async function roster(data:{matchId:string;peers:Peer[]}){if(data.matchId!==matchId||!active.current)return;setPeers(data.peers);const ids=new Set(data.peers.map(p=>p.peerId));for(const [id,link] of links.current)if(!ids.has(id)){link.pc.close();links.current.delete(id);}const generation=epoch.current;
   for(const peer of data.peers){if(peer.peerId===socket!.id||links.current.has(peer.peerId))continue;const link=linkFor(peer.peerId);if(socket!.id!<peer.peerId)try{const offer=await link.pc.createOffer({});if(generation!==epoch.current)return;await link.pc.setLocalDescription(offer);if(generation===epoch.current)socket!.emit("voice:signal",{matchId,to:peer.peerId,signal:{type:"offer",sdp:offer.sdp}});}catch{if(generation===epoch.current)setError("تعذر ربط الصوت. أعد الدخول إلى المحادثة.");}}
  }
  async function signal(data:{matchId:string;from:string;signal:{type:string;sdp?:string;candidate?:RTCIceCandidateInit}}){if(data.matchId!==matchId||!active.current)return;const generation=epoch.current;
   try{const link=linkFor(data.from),value=data.signal;if(value.type==="ice"){if(link.pc.remoteDescription)await link.pc.addIceCandidate(value.candidate);else if(link.pending.length<100)link.pending.push(value.candidate!);return;}
    await link.pc.setRemoteDescription({type:value.type as "offer"|"answer",sdp:value.sdp!});if(generation!==epoch.current)return;for(const candidate of link.pending)await link.pc.addIceCandidate(candidate);link.pending=[];
    if(value.type==="offer"){const answer=await link.pc.createAnswer();if(generation!==epoch.current)return;await link.pc.setLocalDescription(answer);if(generation===epoch.current)socket!.emit("voice:signal",{matchId,to:data.from,signal:{type:"answer",sdp:answer.sdp}});}
   }catch{if(generation===epoch.current)setError("تعذر ربط أحد المشاركين. أعد الدخول إلى الصوت.");}
  }
  function revoked(data:{matchId:string}){if(data.matchId===matchId){stopRef.current();setError("انتهت جلسة الصوت. يمكنك الدخول مجدداً.");}}
  socket.on("voice:peers",roster);socket.on("voice:signal",signal);socket.on("voice:revoked",revoked);socket.on("disconnect",leave);
  const heartbeat=setInterval(()=>{if(active.current)socket.emit("voice:heartbeat",{matchId});},4000);let metering=false;
  const meter=setInterval(async()=>{if(!active.current||metering)return;metering=true;const generation=epoch.current;const talking=new Set<string>();try{for(const [id,link] of links.current){const report=await link.pc.getStats();report.forEach((r:{type:string;kind?:string;mediaType?:string;audioLevel?:number})=>{if((r.kind??r.mediaType)==="audio"&&(r.audioLevel??0)>0.04){if(r.type==="inbound-rtp")talking.add(id);if(r.type==="media-source"&&stream.current?.getAudioTracks()[0]?.enabled)talking.add(socket.id!);}});}if(generation===epoch.current)setSpeaking([...talking]);}catch{}finally{metering=false;}},400);
  const app=AppState.addEventListener("change",state=>{if(state!=="active")leave();});
  return()=>{clearInterval(heartbeat);clearInterval(meter);app.remove();socket.off("voice:peers",roster);socket.off("voice:signal",signal);socket.off("voice:revoked",revoked);socket.off("disconnect",leave);socket.emit("voice:leave");stopRef.current();};
 },[socket,matchId]);
 useEffect(()=>{if(!connected)stopRef.current();},[connected]);
 async function join(){if(!socket?.connected||busy||joined)return;setBusy(true);setError("");const generation=epoch.current;
  try{if(!NativeModules.WebRTCModule)throw Error("native_build_required");if(Platform.OS==="android"){const result=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);if(generation!==epoch.current)return;if(result!==PermissionsAndroid.RESULTS.GRANTED)throw Error("permission_denied");}
   const module=await import("react-native-webrtc");rtc.current=module;if(generation!==epoch.current)return;const media=await module.mediaDevices.getUserMedia({audio:true,video:false});if(generation!==epoch.current){media.getTracks().forEach(t=>t.stop());media.release();return;}media.getAudioTracks().forEach(t=>{t.enabled=false;onNative(t,"ended",()=>{socket.emit("voice:leave");stopRef.current();});});stream.current=media;active.current=true;
   socket.timeout(5000).emit("voice:join",{matchId},(err:Error|null,response:{ok:boolean;iceServers?:unknown})=>{if(generation!==epoch.current)return;if(err||!response?.ok){socket.emit("voice:leave");stopRef.current();setError("تعذر الدخول إلى الصوت. أعد المحاولة.");return;}ice.current=parseVoiceIce(response.iceServers);setBusy(false);setJoined(true);});
  }catch(cause){if(generation!==epoch.current)return;stopRef.current();setError(cause instanceof Error&&cause.message==="native_build_required"?"الصوت يحتاج نسخة جديدة من التطبيق؛ لا يتوفر داخل Expo Go.":"تعذر فتح الميكروفون. تحقق من الإذن ثم أعد المحاولة.");}
 }
 function toggleMic(){const track=stream.current?.getAudioTracks()[0];if(track){track.enabled=!track.enabled;setMic(track.enabled);}}
 function toggleMute(id:string){const next=muted.includes(id)?muted.filter(v=>v!==id):[...muted,id];mutedRef.current=next;setMuted(next);links.current.get(id)?.tracks.forEach(track=>track._setVolume(next.includes(id)?0:1));}
 return <RoomVoiceButton joined={joined} busy={busy} mic={mic} connected={connected} error={error} onClearError={()=>{setError("");}} onPress={()=>{if(joined)toggleMic();else void join();}} onLeave={()=>{socket?.emit("voice:leave");stop();}} peers={peers.map(peer=>({...peer,name:players.find(p=>p.id===peer.playerId)?.name??"لاعب",self:peer.peerId===socket?.id}))} muted={muted} speaking={speaking} onMute={toggleMute} />;
}
