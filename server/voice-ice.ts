import {createHash,createHmac} from 'node:crypto';
import {parseVoiceIce,type VoiceIceServer} from '../shared/voice-ice';
export function voiceIceConfig(playerId:string,env:Record<string,string|undefined>=process.env,now=Date.now()):VoiceIceServer[]{
 const stun=(env.VOICE_STUN_URLS??'stun:stun.l.google.com:19302').split(',').map(value=>value.trim()).filter(value=>/^stuns?:/.test(value));
 const result=parseVoiceIce([{urls:stun}]);
 const urls=(env.VOICE_TURN_URLS??'').split(',').map(value=>value.trim()).filter(value=>/^turns?:/.test(value));
 if(urls.length&&env.VOICE_TURN_SECRET&&env.VOICE_TURN_SECRET.length>=32){const username=`${Math.floor(now/1000)+3600}:${createHash('sha256').update(playerId).digest('hex').slice(0,16)}`;const credential=createHmac('sha1',env.VOICE_TURN_SECRET).update(username).digest('base64');result.push(...parseVoiceIce([{urls,username,credential}]));}
 return result;
}
