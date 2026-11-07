import {isQueueFee} from "../shared/coin-entry";
import { PUBLIC_QUEUE_MODES,publicQueueSize,type PublicQueueMode } from "../shared/public-game";
import {roomTeamScores,roomTeamsValid,type TeamPlayer} from "../shared/friends-room";
import {getRandomMatchBaseRewards} from "./online-game-logic";
export class PublicMatchmaking<T>{
 private readonly queues=new Map<PublicQueueMode,Map<number,Map<string,T>>>(PUBLIC_QUEUE_MODES.map(mode=>[mode,new Map()]));
 private queue(mode:PublicQueueMode,fee:number){let q=this.queues.get(mode)!.get(fee);if(!q){q=new Map();this.queues.get(mode)!.set(fee,q);}return q;}
 modeFor(id:string){return PUBLIC_QUEUE_MODES.find(mode=>[...this.queues.get(mode)!.values()].some(q=>q.has(id)));}
 feeFor(id:string){const mode=this.modeFor(id);if(!mode)return undefined;return [...this.queues.get(mode)!.entries()].find(([,q])=>q.has(id))?.[0];}
 has(id:string){return this.modeFor(id)!==undefined;}
 entriesFor(mode:PublicQueueMode,fee?:number):[string,T][]{return fee===undefined?[...this.queues.get(mode)!.values()].flatMap(q=>[...q.entries()]):[...this.queue(mode,fee).entries()];}
 entriesList(){return PUBLIC_QUEUE_MODES.flatMap(mode=>this.entriesFor(mode));}
 cancel(id:string):T|undefined{const mode=this.modeFor(id),fee=this.feeFor(id);if(!mode||fee===undefined)return;const q=this.queue(mode,fee),entry=q.get(id);q.delete(id);return entry;}
 enqueue(id:string,entry:T,mode:PublicQueueMode,fee=0):{status:"queued"|"duplicate";mode:PublicQueueMode;entryFee:number;players:number;needed:number}|{status:"matched";mode:PublicQueueMode;entryFee:number;entries:[string,T][]}{
  if(!isQueueFee(fee))throw Error("invalid_entry_fee");const existing=this.modeFor(id);if(existing){const priorFee=this.feeFor(id)!;return {status:"duplicate",mode:existing,entryFee:priorFee,players:this.queue(existing,priorFee).size,needed:publicQueueSize(existing)};}
  const queue=this.queue(mode,fee);queue.set(id,entry);const needed=publicQueueSize(mode);
  if(queue.size<needed)return {status:"queued",mode,entryFee:fee,players:queue.size,needed};
  const entries=[...queue.entries()].slice(0,needed);entries.forEach(([id])=>queue.delete(id));return {status:"matched",mode,entryFee:fee,entries};
 }
}
export function getPublicMatchBaseRewards(players:(TeamPlayer&{abandoned:boolean})[],mode:PublicQueueMode):Map<string,number>{
 if(mode==="solo")return getRandomMatchBaseRewards(players);
 const rewards=new Map(players.map(p=>[p.id,0]));if(players.length!==4)return rewards;
 if(mode==="team"){
  if(!roomTeamsValid(players))return rewards;
  const teams=roomTeamScores(players,"duo");if(teams.every(t=>t.forfeited))return rewards;
  const draw=teams.every(t=>t.rank===1);
  for(const p of players){if(p.abandoned)continue;const team=teams.find(t=>t.id===p.teamId)!;rewards.set(p.id,draw?10:team.rank===1?20:5);}return rewards;
 }
 const active=players.filter(p=>!p.abandoned);if(!active.length)return rewards;const best=Math.max(...active.map(p=>p.score)),winners=active.filter(p=>p.score===best).length;
 for(const p of active)rewards.set(p.id,p.score===best?(winners>1?10:20):5);return rewards;
}
