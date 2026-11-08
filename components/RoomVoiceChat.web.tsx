import {parseVoiceIce,type VoiceIceServer} from '@shared/voice-ice';
import {RoomVoiceButton} from "./RoomVoiceButton";
import React,{useEffect,useRef,useState} from "react";

import type {VoiceProps} from "./RoomVoiceChat";
type Peer={peerId:string;playerId:string};
type Link={pc:RTCPeerConnection;audio:HTMLAudioElement;pending:RTCIceCandidateInit[];analyser?:AnalyserNode};
export function RoomVoiceChat({socket,matchId,connected,players}:VoiceProps){
 const [joined,setJoined]=useState(false),[busy,setBusy]=useState(false),[mic,setMic]=useState(false),[error,setError]=useState(""),[peers,setPeers]=useState<Peer[]>([]),[muted,setMuted]=useState<string[]>([]),[speaking,setSpeaking]=useState<string[]>([]),[failed,setFailed]=useState(false);
 const stream=useRef<MediaStream|null>(null),links=useRef(new Map<string,Link>()),epoch=useRef(0),active=useRef(false),mutedRef=useRef<string[]>([]),audioContext=useRef<AudioContext|null>(null),selfAnalyser=useRef<AnalyserNode|null>(null),playersRef=useRef(players);playersRef.current=players;
 function stop(){epoch.current++;active.current=false;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;for(const link of links.current.values()){link.pc.close();link.audio.pause();link.audio.srcObject=null;}links.current.clear();void audioContext.current?.close();audioContext.current=null;selfAnalyser.current=null;setJoined(false);setBusy(false);setMic(false);setPeers([]);setSpeaking([]);setFailed(false);}
 const ice=useRef<VoiceIceServer[]>([]);
 const stopRef=useRef(stop);stopRef.current=stop;
 useEffect(()=>{
  if(!socket)return;
  function leave(){socket!.emit("voice:leave");stopRef.current();}
  function analyser(media:MediaStream){try{const context=audioContext.current;if(!context)return;const node=context.createAnalyser();node.fftSize=256;context.createMediaStreamSource(media).connect(node);return node;}catch{return;}}
  function linkFor(peerId:string){
   let link=links.current.get(peerId);if(link)return link;
   // The authenticated private-room join supplies short-lived relay credentials.
   const pc=new RTCPeerConnection({iceServers:ice.current}),audio=new Audio();audio.autoplay=true;audio.muted=mutedRef.current.includes(peerId);
   link={pc,audio,pending:[]};links.current.set(peerId,link);const own=stream.current;own?.getAudioTracks().forEach(track=>pc.addTrack(track,own));
   pc.onicecandidate=event=>{if(event.candidate&&active.current)socket!.emit("voice:signal",{matchId,to:peerId,signal:{type:"ice",candidate:event.candidate.toJSON()}});};
   pc.ontrack=event=>{if(!active.current)return;const remote=event.streams[0]??new MediaStream([event.track]);audio.srcObject=remote;link!.analyser=analyser(remote);void audio.play().catch(()=>setError("تعذر تشغيل الصوت. اضغط «تشغيل الصوت» أدناه."));};
   pc.onconnectionstatechange=()=>{if(pc.connectionState==="failed")setFailed(true);};return link;
  }
  async function roster(data:{matchId:string;peers:Peer[]}){
   if(data.matchId!==matchId||!active.current)return;setPeers(data.peers);const ids=new Set(data.peers.map(p=>p.peerId));for(const [id,link] of links.current)if(!ids.has(id)){link.pc.close();link.audio.pause();link.audio.srcObject=null;links.current.delete(id);}
   const generation=epoch.current;
   for(const peer of data.peers){if(peer.peerId===socket!.id||links.current.has(peer.peerId))continue;const link=linkFor(peer.peerId);if(socket!.id!<peer.peerId){try{const offer=await link.pc.createOffer();if(generation!==epoch.current)return;await link.pc.setLocalDescription(offer);if(generation!==epoch.current)return;socket!.emit("voice:signal",{matchId,to:peer.peerId,signal:{type:"offer",sdp:offer.sdp}});}catch{if(generation===epoch.current)setError("تعذر ربط الصوت. اخرج من المحادثة ثم أعد الدخول.");}}}
  }
  async function signal(data:{matchId:string;from:string;signal:{type:string;sdp?:string;candidate?:RTCIceCandidateInit}}){
   if(data.matchId!==matchId||!active.current||data.from===socket!.id)return;const generation=epoch.current;
   try{const link=linkFor(data.from),value=data.signal;if(value.type==="ice"){if(link.pc.remoteDescription)await link.pc.addIceCandidate(value.candidate);else if(link.pending.length<100)link.pending.push(value.candidate!);return;}
    await link.pc.setRemoteDescription({type:value.type as RTCSdpType,sdp:value.sdp});if(generation!==epoch.current)return;
    for(const candidate of link.pending)await link.pc.addIceCandidate(candidate);link.pending=[];
    if(value.type==="offer"){const answer=await link.pc.createAnswer();if(generation!==epoch.current)return;await link.pc.setLocalDescription(answer);if(generation===epoch.current)socket!.emit("voice:signal",{matchId,to:data.from,signal:{type:"answer",sdp:answer.sdp}});}
   }catch{if(generation===epoch.current)setError("تعذر ربط أحد المشاركين. أعد الدخول إلى الصوت.");}
  }
  function revoked(data:{matchId:string}){if(data.matchId===matchId){stopRef.current();setError("انتهت جلسة الصوت. يمكنك الدخول مجدداً من هذه الغرفة.");}}
  socket.on("voice:peers",roster);socket.on("voice:signal",signal);socket.on("voice:revoked",revoked);socket.on("disconnect",leave);
  const heartbeat=setInterval(()=>{if(active.current)socket.emit("voice:heartbeat",{matchId});},4000);
  const meter=setInterval(()=>{if(!active.current)return;const speaking:string[]=[];const audible=(node?:AnalyserNode|null)=>{if(!node)return false;const values=new Uint8Array(node.fftSize);node.getByteTimeDomainData(values);return values.some(v=>Math.abs(v-128)>12);};if(stream.current?.getAudioTracks()[0]?.enabled&&audible(selfAnalyser.current))speaking.push(socket.id!);for(const [id,link] of links.current)if(audible(link.analyser))speaking.push(id);setSpeaking(speaking);},200);
  return()=>{clearInterval(heartbeat);clearInterval(meter);socket.off("voice:peers",roster);socket.off("voice:signal",signal);socket.off("voice:revoked",revoked);socket.off("disconnect",leave);socket.emit("voice:leave");stopRef.current();};
 },[socket,matchId]);
 useEffect(()=>{if(!connected)stopRef.current();},[connected]);
 useEffect(()=>{const hide=()=>{if(document.visibilityState==="hidden"){socket?.emit("voice:leave");stopRef.current();}};document.addEventListener("visibilitychange",hide);window.addEventListener("pagehide",hide);return()=>{document.removeEventListener("visibilitychange",hide);window.removeEventListener("pagehide",hide);};},[socket]);
 async function join(){if(!socket?.connected||busy||joined)return;setBusy(true);setError("");const generation=epoch.current;
  try{if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==="undefined")throw Error("unsupported");const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});if(generation!==epoch.current){media.getTracks().forEach(t=>t.stop());return;}media.getAudioTracks().forEach(track=>{track.enabled=false;track.onended=()=>{socket.emit("voice:leave");stopRef.current();};});stream.current=media;
   const context=new AudioContext();audioContext.current=context;await context.resume();if(generation!==epoch.current)return;const node=context.createAnalyser();node.fftSize=256;context.createMediaStreamSource(media).connect(node);selfAnalyser.current=node;active.current=true;
   socket.timeout(5000).emit("voice:join",{matchId},(err:Error|null,response:{ok:boolean;iceServers?:unknown})=>{if(generation!==epoch.current)return;if(err||!response?.ok){socket.emit("voice:leave");stopRef.current();setError("تعذر الدخول إلى الصوت. تحقق من الاتصال ثم أعد المحاولة.");return;}ice.current=parseVoiceIce(response.iceServers);setBusy(false);setJoined(true);});
  }catch(cause){if(generation!==epoch.current)return;stopRef.current();setError(cause instanceof Error&&cause.name==="NotAllowedError"?"لم يُسمح بالميكروفون. يمكنك السماح به من إعدادات المتصفح ثم إعادة المحاولة.":"الصوت غير متاح هنا. استخدم متصفحاً يدعم الصوت على اتصال آمن.");}
 }
 function toggleMic(){const track=stream.current?.getAudioTracks()[0];if(track){track.enabled=!track.enabled;setMic(track.enabled);}}
 function toggleMute(id:string){const next=muted.includes(id)?muted.filter(p=>p!==id):[...muted,id];mutedRef.current=next;setMuted(next);const link=links.current.get(id);if(link)link.audio.muted=next.includes(id);}
 return <RoomVoiceButton joined={joined} busy={busy} mic={mic} connected={connected} error={error||(failed?"تعذر الاتصال بأحد المشاركين. أعد الدخول إلى الصوت.":"")} onClearError={()=>{setError("");setFailed(false);}} onPress={()=>{if(joined)toggleMic();else void join();}} onLeave={()=>{socket?.emit("voice:leave");stop();}} peers={peers.map(peer=>({...peer,name:playersRef.current.find(p=>p.id===peer.playerId)?.name??"لاعب",self:peer.peerId===socket?.id}))} muted={muted} speaking={speaking} onMute={toggleMute} onResumeAudio={()=>{for(const link of links.current.values())void link.audio.play().catch(()=>setError("تعذر تشغيل الصوت. أعد المحاولة."));}}/>;
}
