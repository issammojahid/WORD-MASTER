import { createHash,randomBytes } from "node:crypto";
import type { Express,Request,RequestHandler } from "express";
import { sql } from "drizzle-orm";
import { pool,db,withRequestDatabase } from "./db";
import { HALLOWEEN_ITEMS,HALLOWEEN_SEASON } from "../shared/halloween";
import { isHalloweenSeasonActive } from "../shared/halloween-update";
import { LEVEL_REWARD_VALUES,gameLevel } from "../shared/game-wallet";

const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function authenticatedGuest(req:Request,walletPool=pool):Promise<string|null>{
 const token=req.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{40,128})$/)?.[1];if(!token)return null;
 const result=await walletPool.query('SELECT id FROM online_guest_sessions WHERE token_hash=$1 AND expires_at>now()',[hash(token)]);return result.rows[0]?.id??null;
}
export function walletTransaction(handler:RequestHandler<Record<string,string>>,transactionDatabase=db):RequestHandler<Record<string,string>>{return async(req,res,next)=>{
 if(!res.locals.unifiedPlayerId)return handler(req,res,next);
 const original=res.json;let body:unknown;let produced=false;
 res.json=function(value){body=value;produced=true;return this;};
 try{
  await transactionDatabase.transaction(async transaction=>{
   await transaction.execute(sql`SELECT id FROM player_profiles WHERE id=${res.locals.unifiedPlayerId} FOR UPDATE`);
   await withRequestDatabase(transaction,async()=>{await handler(req,res,next);});
   if(!produced)throw Error('wallet_response_missing');
   if(res.statusCode>=400)throw Error('wallet_handler_rejected');
  });
  res.json=original;return res.json(body);
 }catch(error){res.json=original;if(error instanceof Error&&error.message==='wallet_handler_rejected')return res.json(body);return res.status(503).json({error:'wallet_transaction_failed'});}
};}

export function registerGameWallet(app:Express,walletPool=pool){
 app.post('/api/game-wallet/initialize',async(req,res)=>{
  let client;
  try{
   const id=await authenticatedGuest(req,walletPool);if(!id)return res.status(401).json({error:'unauthorized'});
   client=await walletPool.connect();await client.query('BEGIN');
   await client.query('SELECT id FROM online_guest_sessions WHERE id=$1 FOR UPDATE',[id]);
   const existing=await client.query('SELECT player_id FROM game_wallet_accounts WHERE player_id=$1',[id]);
   if(!existing.rows.length){
    const name=`Najm_${randomBytes(5).toString('hex')}`;
    await client.query('INSERT INTO player_profiles(id,name,coins) VALUES($1,$2,2000)',[id,name]);
    await client.query('INSERT INTO game_wallet_accounts(player_id) VALUES($1)',[id]);
    await client.query("INSERT INTO game_wallet_operations(player_id,operation_id,kind,amount) VALUES($1,'welcome','welcome',2000)",[id]);
    await client.query("UPDATE online_guest_sessions SET expires_at=now()+interval '20 years' WHERE id=$1",[id]);
   }
   const profile=(await client.query('SELECT id,name,coins FROM player_profiles WHERE id=$1',[id])).rows[0];
   await client.query('COMMIT');return res.json({playerId:id,coins:profile.coins,name:profile.name,unified:true});
  }catch{await client?.query('ROLLBACK').catch(()=>{});return res.status(503).json({error:'wallet_unavailable'});}finally{client?.release();}
 });
 app.use(async(req,res,next)=>{
  try{
   const rawPathId=req.path.match(/^\/api\/(?:player|tasks|achievements|battle-pass|referral)\/([^/]+)/i)?.[1];
   const pathId=rawPathId?decodeURIComponent(rawPathId):undefined;
   const candidates=[...new Set([req.body?.playerId,req.body?.player_id,req.query.playerId,pathId].filter((id):id is string=>typeof id==='string'))];
   if(!candidates.length)return next();
   const wallet=await walletPool.query('SELECT player_id FROM game_wallet_accounts WHERE player_id=ANY($1::varchar[])',[candidates]);if(!wallet.rows.length)return next();
   const owner=await authenticatedGuest(req,walletPool);if(!owner||wallet.rows.some(row=>row.player_id!==owner))return res.status(403).json({error:'wallet_owner_required'});
   res.locals.unifiedPlayerId=owner;
   if(req.method==='PUT'&&/^\/api\/player\/[^/]+\/?$/i.test(req.path)){delete req.body.coins;delete req.body.xp;delete req.body.level;delete req.body.totalScore;delete req.body.gamesPlayed;delete req.body.wins;delete req.body.winStreak;delete req.body.bestStreak;delete req.body.ownedSkins;delete req.body.ownedTitles;}
   if(req.method!=='GET'&&(/\/game-result\/?$/i.test(req.path)||['/api/task-progress','/api/achievement-progress'].includes(req.path.toLowerCase().replace(/\/$/,''))))return res.status(400).json({error:'use_verified_wallet_rewards'});
   next();
  }catch{return res.status(503).json({error:'wallet_unavailable'});}
 });
 app.post('/api/game-wallet/action',async(req,res)=>{
  let client;
  try{
   const id=await authenticatedGuest(req,walletPool);if(!id)return res.status(401).json({error:'unauthorized'});
   const {operationId,kind}=req.body??{};
   if(typeof operationId!=='string'||!/^[a-zA-Z0-9:_-]{8,120}$/.test(operationId))return res.status(400).json({error:'invalid_operation'});
   client=await walletPool.connect();await client.query('BEGIN');
   const profile=(await client.query('SELECT p.* FROM player_profiles p JOIN game_wallet_accounts w ON w.player_id=p.id WHERE p.id=$1 FOR UPDATE OF p',[id])).rows[0];
   if(!profile){await client.query('ROLLBACK');return res.status(409).json({error:'initialize_wallet_first'});}
   const receipt=(await client.query('SELECT result FROM game_wallet_operations WHERE player_id=$1 AND operation_id=$2',[id,operationId])).rows[0];
   if(receipt){await client.query('ROLLBACK');return res.json({...receipt.result,coins:profile.coins});}
   let amount=0;let extra:Record<string,unknown>={};
   if(kind==='offline_match'){
    const score=req.body.score;if(!Number.isInteger(score)||score<0||score>400)throw Error('invalid_offline_result');
    amount=20;
    await client.query('UPDATE player_profiles SET games_played=games_played+1,total_score=total_score+$2,xp=xp+$3,level=$4 WHERE id=$1',[id,score,Math.floor(score/2),gameLevel(profile.xp+Math.floor(score/2))]);
   }else if(kind==='level_reward'){
    const level=req.body.level;const reward=LEVEL_REWARD_VALUES.find(r=>r.level===level);if(!reward||profile.level<level)throw Error('level_reward_locked');
    if(operationId!==`level_reward:${level}`)throw Error('invalid_operation');amount=reward.coins;
   }else if(kind==='halloween_buy'){
    if(!isHalloweenSeasonActive())throw Error('season_ended');
    const item=HALLOWEEN_ITEMS.find(i=>i.id===req.body.itemId);if(!item||item.price===undefined)throw Error('invalid_item');
    const row=(await client.query('SELECT state FROM player_seasonal_inventory WHERE player_id=$1 AND season_id=$2',[id,HALLOWEEN_SEASON])).rows[0];
    const state=row?.state??{owned:[],equipped:{},giftItemId:null};
    if(!state.owned.includes(item.id)){amount=-item.price;state.owned.push(item.id);await client.query('INSERT INTO player_seasonal_inventory(player_id,season_id,state) VALUES($1,$2,$3::jsonb) ON CONFLICT(player_id,season_id) DO UPDATE SET state=excluded.state,updated_at=now()',[id,HALLOWEEN_SEASON,JSON.stringify(state)]);}
    extra={owned:state.owned};
   }else throw Error('invalid_operation');
   const updated=(await client.query('UPDATE player_profiles SET coins=coins+$2,updated_at=now() WHERE id=$1 AND coins+$2>=0 RETURNING coins,xp,level,games_played,total_score',[id,amount])).rows[0];if(!updated)throw Error('insufficient_coins');
   const result={coins:updated.coins,xp:updated.xp,level:updated.level,gamesPlayed:updated.games_played,totalScore:updated.total_score,...extra};
   await client.query('INSERT INTO game_wallet_operations(player_id,operation_id,kind,amount,result) VALUES($1,$2,$3,$4,$5::jsonb)',[id,operationId,kind,amount,JSON.stringify(result)]);
   await client.query('COMMIT');return res.json(result);
  }catch(error){await client?.query('ROLLBACK').catch(()=>{});const message=error instanceof Error?error.message:'';const known=['insufficient_coins','invalid_offline_result','level_reward_locked','invalid_operation','season_ended','invalid_item'].includes(message);return res.status(message==='insufficient_coins'?402:known?400:503).json({error:known?message:'wallet_unavailable'});}finally{client?.release();}
 });
}
