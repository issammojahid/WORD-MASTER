import {isEntryFee,type EntryFee} from "../shared/coin-entry";
import type {PublicQueueMode} from "../shared/public-game";
import {roomTeamScores,roomTeamsValid,type TeamPlayer} from "../shared/friends-room";
export type EntryPlayer=TeamPlayer&{name:string;abandoned:boolean};
// No rake and no new coins: every collected coin is paid out or refunded.
export function coinEntryPayouts(players:EntryPlayer[],mode:PublicQueueMode,fee:EntryFee):Map<string,number>{
 if(!isEntryFee(fee)||players.length!==(mode==="solo"?2:4)||new Set(players.map(p=>p.id)).size!==players.length)throw Error("invalid_entry_match");
 const refund=()=>new Map(players.map(p=>[p.id,fee]));const result=new Map(players.map(p=>[p.id,0]));let winners:EntryPlayer[];
 if(mode==="team"){
  if(!roomTeamsValid(players))throw Error("invalid_entry_teams");
  const teams=roomTeamScores(players,"duo");if(teams.every(t=>t.forfeited)||teams.every(t=>t.rank===1))return refund();
  const winner=teams.find(t=>t.rank===1&&!t.forfeited);if(!winner)return refund();winners=players.filter(p=>p.teamId===winner.id);
 }else{
  const active=players.filter(p=>!p.abandoned);if(!active.length)return refund();const best=Math.max(...active.map(p=>p.score));winners=active.filter(p=>p.score===best);if(winners.length!==1)return refund();
 }
 const perPlayer=fee*players.length/winners.length;if(!Number.isSafeInteger(perPlayer))throw Error("invalid_entry_payout");winners.forEach(p=>result.set(p.id,perPlayer));return result;
}
