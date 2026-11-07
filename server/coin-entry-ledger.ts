import {isEntryFee,type EntryFee} from "../shared/coin-entry";
import {isPublicQueueMode,type PublicQueueMode} from "../shared/public-game";
import {coinEntryPayouts,type EntryPlayer} from "./coin-entry-logic";
import {readGameCoins,changeGameCoins} from "./game-wallet-ledger";
export type CoinSql={query(text:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[]}>};
export type CoinDatabase={transaction<T>(operation:(tx:CoinSql)=>Promise<T>):Promise<T>};
export type EntryMatch={id:string;settings:{entryFee?:number;matchmakingMode?:PublicQueueMode};players:EntryPlayer[]};
export type CoinPayment={amount:number;balance:number};
const day=()=>new Date().toISOString().slice(0,10);
async function balance(tx:CoinSql,id:string){return readGameCoins(tx,id);}
export async function reserveCoinEntry(db:CoinDatabase,match:EntryMatch):Promise<Map<string,CoinPayment>>{
 const fee=match.settings.entryFee;if(!isEntryFee(fee)||!isPublicQueueMode(match.settings.matchmakingMode))throw Error("invalid_entry_match");coinEntryPayouts(match.players,match.settings.matchmakingMode,fee);
 return db.transaction(async tx=>{
  await tx.query("INSERT INTO online_matches(id,mode,status,settings) VALUES($1,'random','active',$2::jsonb)",[match.id,JSON.stringify(match.settings)]);
  const payments=new Map<string,CoinPayment>();
  // Stable lock order also prevents deadlocks if two workers try to reserve the same players.
  for(const player of [...match.players].sort((a,b)=>a.id.localeCompare(b.id))){
   const remaining=await changeGameCoins(tx,player.id,-fee);
   await tx.query("INSERT INTO online_reward_claims(match_id,player_id,reward_type,amount,reward_date) VALUES($1,$2,'entry_debit',$3,$4)",[match.id,player.id,fee,day()]);
   await tx.query('INSERT INTO online_match_participants(match_id,player_id,display_name,active) VALUES($1,$2,$3,true)',[match.id,player.id,player.name]);
   payments.set(player.id,{amount:-fee,balance:remaining});
  }return payments;
 });
}
export async function settleCoinEntry(db:CoinDatabase,match:EntryMatch,results:unknown):Promise<Map<string,CoinPayment>>{
 return db.transaction(async tx=>{
  const row=(await tx.query('SELECT status,settings FROM online_matches WHERE id=$1 FOR UPDATE',[match.id])).rows[0];if(!row)throw Error("entry_match_missing");
  if(row.status!=="active"&&row.status!=="completed")throw Error("entry_match_cancelled");
  const settings=row.settings as EntryMatch['settings'],fee=settings.entryFee;if(!isEntryFee(fee)||!isPublicQueueMode(settings.matchmakingMode))throw Error("invalid_entry_match");
  const payments=new Map<string,CoinPayment>();
  if(row.status==="completed"){
   for(const p of match.players){const receipt=(await tx.query("SELECT amount FROM online_reward_claims WHERE match_id=$1 AND player_id=$2 AND reward_type='entry_payout'",[match.id,p.id])).rows[0];payments.set(p.id,{amount:Number(receipt?.amount??0),balance:await balance(tx,p.id)});}return payments;
  }
  const members=(await tx.query('SELECT player_id FROM online_match_participants WHERE match_id=$1',[match.id])).rows.map(r=>String(r.player_id));if(members.length!==match.players.length||match.players.some(p=>!members.includes(p.id)))throw Error("entry_roster_mismatch");
  const payouts=coinEntryPayouts(match.players,settings.matchmakingMode,fee);
  for(const p of [...match.players].sort((a,b)=>a.id.localeCompare(b.id))){const amount=payouts.get(p.id)!;
   const debit=(await tx.query("SELECT amount FROM online_reward_claims WHERE match_id=$1 AND player_id=$2 AND reward_type='entry_debit'",[match.id,p.id])).rows[0];if(Number(debit?.amount)!==fee)throw Error("entry_debit_missing");
   const receipt=await tx.query("INSERT INTO online_reward_claims(match_id,player_id,reward_type,amount,reward_date) VALUES($1,$2,'entry_payout',$3,$4) ON CONFLICT DO NOTHING RETURNING amount",[match.id,p.id,amount,day()]);
   if(receipt.rows.length&&amount>0)await changeGameCoins(tx,p.id,amount);
   payments.set(p.id,{amount,balance:await balance(tx,p.id)});
   await tx.query('UPDATE online_match_participants SET active=false,abandoned=$3,score=$4 WHERE match_id=$1 AND player_id=$2',[match.id,p.id,p.abandoned,p.score]);
  }
  await tx.query("UPDATE online_matches SET status='completed',results=$2::jsonb,completed_at=now() WHERE id=$1",[match.id,JSON.stringify(results)]);return payments;
 });
}
export async function refundInterruptedCoinEntries(db:CoinDatabase):Promise<void>{
 await db.transaction(async tx=>{
  const interrupted=await tx.query("SELECT id FROM online_matches WHERE status='active' AND (settings->>'entryFee')::integer > 0 ORDER BY id FOR UPDATE");
  for(const row of interrupted.rows){const matchId=String(row.id),debits=await tx.query("SELECT player_id,amount FROM online_reward_claims WHERE match_id=$1 AND reward_type='entry_debit' ORDER BY player_id",[matchId]);
   for(const debit of debits.rows){const id=String(debit.player_id),fee=Number(debit.amount);const receipt=await tx.query("INSERT INTO online_reward_claims(match_id,player_id,reward_type,amount,reward_date) VALUES($1,$2,'entry_payout',$3,$4) ON CONFLICT DO NOTHING RETURNING amount",[matchId,id,fee,day()]);if(receipt.rows.length)await changeGameCoins(tx,id,fee);}
   await tx.query("UPDATE online_matches SET status='cancelled',completed_at=now() WHERE id=$1",[matchId]);await tx.query('UPDATE online_match_participants SET active=false WHERE match_id=$1',[matchId]);
  }
 });
}
export function entryReceipt(id:string,matchId:string,kind:string,amount:number){return {id,matchId,amount:kind==="entry_debit"?-amount:amount};}
export type {EntryFee};
