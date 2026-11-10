
import {randomBytes,randomUUID} from 'node:crypto';
import type {Express,Request} from 'express';
import type {CoinDatabase,CoinSql} from './coin-entry-ledger';
import {changeGameCoins} from './game-wallet-ledger';
import type {VerifiedAdCallback} from './admob-ssv';
import {DAILY_AD_MILESTONES} from '../constants/daily-ad-rewards';

type Kind='coins'|'loss-recovery';
type Config={enabled:boolean;recoveryDailyLimit:number};
type Dependencies={database:CoinDatabase;authenticate:(req:Request)=>Promise<string|null>;verify:(query:string)=>Promise<VerifiedAdCallback>;config:Config;now?:()=>Date};
export const ADMOB_VALIDATION_CUSTOM_DATA='admob-validation-only-no-reward-2026-11-10';
export function rewardDay(now:Date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(k=>parts.find(p=>p.type===k)!.value).join('-');}
function kindOf(value:unknown):Kind{if(value!=='coins'&&value!=='loss-recovery')throw Error('invalid_kind');return value;}
async function lockWallet(tx:CoinSql,id:string){const row=(await tx.query('SELECT p.id FROM player_profiles p JOIN game_wallet_accounts w ON w.player_id=p.id WHERE p.id=$1 FOR UPDATE OF p',[id])).rows[0];if(!row)throw Error('initialize_wallet_first');}
async function expire(tx:CoinSql,id:string,now:Date){await tx.query("UPDATE rewarded_ad_sessions SET status='expired' WHERE player_id=$1 AND status='pending' AND expires_at<$2",[id,now.toISOString()]);}
async function recoveryAmount(tx:CoinSql,id:string,matchId:unknown,now:Date){
 if(typeof matchId!=='string'||matchId.length>128)throw Error('invalid_match');
 const row=(await tx.query(`SELECT d.amount,m.settings FROM online_matches m
 JOIN online_match_participants p ON p.match_id=m.id AND p.player_id=$1
 JOIN online_reward_claims d ON d.match_id=m.id AND d.player_id=$1 AND d.reward_type='entry_debit'
 JOIN online_reward_claims r ON r.match_id=m.id AND r.player_id=$1 AND r.reward_type='entry_payout'
 WHERE m.id=$2 AND m.mode='random' AND m.status='completed' AND p.abandoned=false AND r.amount=0 AND d.amount>0 AND m.completed_at>=$3`,[id,matchId,new Date(now.getTime()-86400000).toISOString()])).rows[0];
 if(!row||Number(row.amount)!==Number((row.settings as {entryFee?:number})?.entryFee))throw Error('recovery_ineligible');
 const used=(await tx.query("SELECT id FROM rewarded_ad_sessions WHERE player_id=$1 AND match_id=$2 AND kind='loss-recovery' AND status='credited'",[id,matchId])).rows.length;
 if(used)throw Error('recovery_already_claimed');return Math.min(Number(row.amount),500);
}
async function quote(tx:CoinSql,id:string,kind:Kind,matchId:unknown,now:Date,config:Config){
 const day=rewardDay(now);await lockWallet(tx,id);await expire(tx,id,now);
 const rows=(await tx.query("SELECT id,amount,slot,custom_data,status,match_id FROM rewarded_ad_sessions WHERE player_id=$1 AND reward_day=$2 AND kind=$3 AND status IN ('pending','credited') ORDER BY slot",[id,day,kind])).rows;
 const credited=rows.filter(r=>r.status==='credited'),pending=rows.find(r=>r.status==='pending');
 const limit=kind==='coins'?DAILY_AD_MILESTONES.length:config.recoveryDailyLimit;
 if(kind==='loss-recovery'){
  const amount=await recoveryAmount(tx,id,matchId,now);
  if(credited.length>=limit)throw Error('daily_ad_limit');
  if(pending&&pending.match_id!==matchId)throw Error('reward_session_pending');
  return {day,amount,slot:credited.length+1,pending};
 }
 if(credited.length>=limit)throw Error('daily_ad_limit');
 const slot=credited.length+1;
 return {day,amount:DAILY_AD_MILESTONES[slot-1],slot,pending};
}
export function registerRewardedAds(app:Express,deps:Dependencies){
 const now=deps.now??(()=>new Date());
 const fail=(res:import('express').Response,error:unknown)=>{const code=error instanceof Error?error.message:'';const status=code==='unauthorized'?401:code==='invalid_kind'||code==='invalid_match'?400:code==='daily_ad_limit'?429:['initialize_wallet_first','recovery_ineligible','recovery_already_claimed','reward_session_pending'].includes(code)?409:503;return res.status(status).json({error:status===503?'reward_service_unavailable':code});};
 async function identity(req:Request){if(!deps.config.enabled)throw Error('reward_service_unavailable');const id=await deps.authenticate(req);if(!id)throw Error('unauthorized');return id;}
 app.get('/api/rewarded-ads/daily',async(req,res)=>{try{
  const id=await identity(req),date=now(),day=rewardDay(date);
  const result=await deps.database.transaction(async tx=>{await lockWallet(tx,id);await expire(tx,id,date);const rows=(await tx.query("SELECT kind,count(*)::int AS count FROM rewarded_ad_sessions WHERE player_id=$1 AND reward_day=$2 AND status='credited' GROUP BY kind",[id,day])).rows;return {completed:Number(rows.find(r=>r.kind==='coins')?.count??0),recoveries:Number(rows.find(r=>r.kind==='loss-recovery')?.count??0)};});
  return res.json({enabled:true,day,timeZone:'Africa/Casablanca',serverTime:date.toISOString(),rewards:DAILY_AD_MILESTONES,limit:6,recoveryLimit:deps.config.recoveryDailyLimit,...result});
 }catch(error){return fail(res,error);}});
 app.get('/api/rewarded-ads/offer',async(req,res)=>{try{const id=await identity(req),kind=kindOf(req.query.kind);const offer=await deps.database.transaction(tx=>quote(tx,id,kind,req.query.matchId,now(),deps.config));return res.json({enabled:true,coins:offer.amount,step:offer.slot});}catch(error){return fail(res,error);}});
 app.post('/api/rewarded-ads/sessions',async(req,res)=>{try{
  const id=await identity(req),kind=kindOf(req.body?.kind),date=now();
  const session=await deps.database.transaction(async tx=>{
   const offer=await quote(tx,id,kind,req.body?.matchId,date,deps.config);
   if(offer.pending)return {id:String(offer.pending.id),coins:Number(offer.pending.amount),customData:String(offer.pending.custom_data)};
   const sessionId=randomUUID(),customData=sessionId+'.'+randomBytes(24).toString('base64url');
   await tx.query("INSERT INTO rewarded_ad_sessions(id,player_id,kind,reward_day,slot,amount,match_id,custom_data,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[sessionId,id,kind,offer.day,offer.slot,offer.amount,kind==='loss-recovery'?req.body.matchId:null,customData,date.toISOString(),new Date(date.getTime()+30*60000).toISOString()]);
   return {id:sessionId,coins:offer.amount,customData};
  });return res.json(session);
 }catch(error){return fail(res,error);}});
 app.get('/api/rewarded-ads/sessions/:id',async(req,res)=>{try{
  const id=await identity(req);const receipt=await deps.database.transaction(async tx=>{await lockWallet(tx,id);await expire(tx,id,now());return (await tx.query('SELECT status FROM rewarded_ad_sessions WHERE id=$1 AND player_id=$2',[req.params.id,id])).rows[0];});
  if(!receipt)return res.status(404).json({error:'reward_session_not_found'});return res.json({status:receipt.status});
 }catch(error){return fail(res,error);}});
 app.get('/api/rewarded-ads/ssv',async(req,res)=>{try{
  if(!deps.config.enabled)return res.status(503).json({error:'reward_service_unavailable'});
  if(req.query.custom_data===ADMOB_VALIDATION_CUSTOM_DATA&&req.query.user_id==='admob_validation')return res.json({ok:true,credited:false});const raw=req.originalUrl.split('?')[1]??'',callback=await deps.verify(raw);
  // A signed AdMob console check has no wallet session; acknowledge only this exact no-credit marker.
  if(callback.customData===ADMOB_VALIDATION_CUSTOM_DATA)return res.json({ok:true,credited:false});
  const date=now();
  await deps.database.transaction(async tx=>{
   await lockWallet(tx,callback.userId);
   const row=(await tx.query('SELECT * FROM rewarded_ad_sessions WHERE custom_data=$1 AND player_id=$2 FOR UPDATE',[callback.customData,callback.userId])).rows[0];
   if(!row)throw Error('ssv_session_invalid');
   if(row.status==='credited'){if(row.transaction_id!==callback.transactionId)throw Error('ssv_already_redeemed');return;}
   const created=new Date(String(row.created_at)).getTime(),expires=new Date(String(row.expires_at)).getTime();
   if(row.status!=='pending'||callback.timestamp<created-300000||callback.timestamp>expires||callback.timestamp>date.getTime()+300000||date.getTime()>expires+86400000)throw Error('ssv_expired');
   if(row.kind==='loss-recovery')await recoveryAmount(tx,callback.userId,row.match_id,new Date(created));
   await tx.query("UPDATE rewarded_ad_sessions SET status='credited',transaction_id=$2,credited_at=$3 WHERE id=$1",[row.id,callback.transactionId,date.toISOString()]);
   const coins=await changeGameCoins(tx,callback.userId,Number(row.amount));
   await tx.query("INSERT INTO game_wallet_operations(player_id,operation_id,kind,amount,result) VALUES($1,$2,'rewarded_ad',$3,$4::jsonb)",[callback.userId,'ad:'+String(row.id),row.amount,JSON.stringify({coins})]);
  });return res.json({ok:true});
 }catch(error){const message=error instanceof Error?error.message:'';const rejected=['ssv_invalid','ssv_duplicate_field','ssv_signature_invalid','ssv_reward_mismatch','ssv_key_unknown','ssv_session_invalid','ssv_already_redeemed','ssv_expired','recovery_ineligible','recovery_already_claimed'].includes(message);return res.status(rejected?400:503).json({error:'reward_verification_failed'});}});
}
