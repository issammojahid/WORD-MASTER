import type {Express,Request} from 'express';
import type {CoinDatabase,CoinSql} from './coin-entry-ledger';
import {changeGameCoins} from './game-wallet-ledger';
import {SEASON_EVENTS,type SeasonEventId} from '../lib/season-calendar';
import {SEASON_2027_ITEMS,activeSeason,emptySeasonalState,seasonalItem,seasonInventoryId,type SeasonalState,type SeasonalSnapshot} from '../shared/season-2027';

class Rejection extends Error{constructor(public code:string,public status=409){super(code);}}
export function registerSeason2027(app:Express,deps:{database:CoinDatabase;authenticate:(req:Request)=>Promise<string|null>;enabled:()=>boolean;now?:()=>Date}){
 const now=deps.now??(()=>new Date());
 async function lock(tx:CoinSql,id:string){const row=(await tx.query('SELECT p.coins FROM player_profiles p JOIN game_wallet_accounts w ON w.player_id=p.id WHERE p.id=$1 FOR UPDATE OF p',[id])).rows[0];if(!row)throw new Rejection('wallet_required',403);return Number(row.coins);}
 async function states(tx:CoinSql,id:string){const rows=await tx.query('SELECT season_id,state FROM player_seasonal_inventory WHERE player_id=$1',[id]);const result:SeasonalSnapshot['states']={};for(const event of SEASON_EVENTS){const row=rows.rows.find(row=>row.season_id===seasonInventoryId(event.id));if(row)result[event.id]=row.state as SeasonalState;}return result;}
 async function progress(tx:CoinSql,id:string,event:typeof SEASON_EVENTS[number]|undefined){
  if(!event)return {games:0,wins:0};
  // Only persisted completed public games count. Client totals and friend rooms cannot grant rewards.
  const rows=await tx.query(`SELECT p.score,p.final_rank,m.settings,m.id,
   (SELECT count(*)::int FROM online_match_participants other WHERE other.match_id=m.id AND other.final_rank=1) AS first_count,
   (SELECT amount FROM online_reward_claims r WHERE r.match_id=m.id AND r.player_id=$1 AND r.reward_type='entry_debit') AS debit,
   (SELECT amount FROM online_reward_claims r WHERE r.match_id=m.id AND r.player_id=$1 AND r.reward_type='entry_payout') AS payout
   FROM online_match_participants p JOIN online_matches m ON m.id=p.match_id WHERE p.player_id=$1 AND m.mode='random' AND m.status='completed' AND p.abandoned=false AND m.completed_at >= $2 AND m.completed_at < $3`,[id,event.start,event.end]);
  return {games:rows.rows.length,wins:rows.rows.filter(row=>Number(row.debit)>0?Number(row.payout)>Number(row.debit):Number(row.final_rank)===1&&(Number(row.first_count)===1||(Number(row.first_count)===2&&(row.settings as {matchmakingMode?:string})?.matchmakingMode==='team'))).length};
 }
 async function view(tx:CoinSql,id:string,coins:number,date:Date):Promise<SeasonalSnapshot>{const active=deps.enabled()?activeSeason(date.getTime()):undefined;const saved=await states(tx,id);const owned=new Set(Object.values(saved).flatMap(state=>state?.owned??[]));return {serverTime:date.toISOString(),enabled:deps.enabled(),coins,states:saved,activeEvent:active?.id??null,items:SEASON_2027_ITEMS.filter(item=>item.event===active?.id||owned.has(item.id)),progress:await progress(tx,id,active)};}
 const fail=(res:import('express').Response,error:unknown)=>error instanceof Rejection?res.status(error.status).json({error:error.code}):res.status(503).json({error:'season_unavailable'});
 app.get('/api/seasonal-events/appearance/:playerId',async(req,res)=>{try{if(!await deps.authenticate(req))return res.status(401).json({error:'unauthorized'});const id=req.params.playerId;if(typeof id!=='string'||id.length>100)return res.status(400).json({error:'invalid_player'});const equipped:SeasonalState['equipped']={};await deps.database.transaction(async tx=>{for(const state of Object.values(await states(tx,id)))for(const [kind,value] of Object.entries(state?.equipped??{})){const item=seasonalItem(value);if(item&&state?.owned.includes(value)&&item.kind===kind)equipped[item.kind]=value;}});return res.json({equipped});}catch(error){return fail(res,error);}});
 app.get('/api/seasonal-events/state',async(req,res)=>{try{const id=await deps.authenticate(req);if(!id)return res.status(401).json({error:'unauthorized'});return res.json(await deps.database.transaction(async tx=>view(tx,id,await lock(tx,id),now())));}catch(error){return fail(res,error);}});
 app.post('/api/seasonal-events/action',async(req,res)=>{try{
  const id=await deps.authenticate(req);if(!id)return res.status(401).json({error:'unauthorized'});
  const {type,itemId,eventId,category}=req.body??{};
  if(!['gift','buy','claim','equip','unequip'].includes(type))throw new Rejection('invalid_action',400);
  return res.json(await deps.database.transaction(async tx=>{
   let coins=await lock(tx,id);const date=now();const item=seasonalItem(itemId);const event=SEASON_EVENTS.find(event=>event.id===(type==='unequip'?eventId:item?.event));if(!event)throw new Rejection('invalid_item',400);
   const saved=await states(tx,id);const state=saved[event.id]??emptySeasonalState();
   const owned=item?state.owned.includes(item.id):false;
   if(type==='equip'){if(!item||!owned)throw new Rejection('not_owned',403);for(const other of Object.values(saved))if(other)delete other.equipped[item.kind];state.equipped[item.kind]=item.id;}
   else if(type==='unequip'){if(!['avatar','frame','background','victory','nameplate','icon'].includes(category))throw new Rejection('invalid_category',400);delete state.equipped[category as keyof SeasonalState['equipped']];}
   else{
    if(!deps.enabled()||activeSeason(date.getTime())?.id!==event.id)throw new Rejection('season_inactive',403);
    if(!item)throw new Rejection('invalid_item',400);
    if(type==='gift'){if(!item.gift)throw new Rejection('not_a_gift',400);if(state.giftItemId&&state.giftItemId!==item.id)throw new Rejection('gift_already_claimed');state.giftItemId=item.id;}
    else if(type==='buy'){if(item.price===null)throw new Rejection('reward_only',403);if(req.body.price!==item.price)throw new Rejection('price_changed');if(!owned){if(coins<item.price)throw new Rejection('insufficient_coins',402);coins=await changeGameCoins(tx,id,-item.price);await tx.query("INSERT INTO game_wallet_operations(player_id,operation_id,kind,amount,result) VALUES($1,$2,'season_purchase',$3,$4::jsonb)",[id,'season:'+item.id,-item.price,JSON.stringify({coins,itemId:item.id})]);}}
    else if(type==='claim'){if(!item.objective)throw new Rejection('not_a_reward',400);const current=await progress(tx,id,event);if((item.objective.type==='task'?current.games:current.wins)<item.objective.target)throw new Rejection('reward_locked',403);}
    if(!owned)state.owned.push(item.id);
   }
   saved[event.id]=state;
   for(const [eventKey,value] of Object.entries(saved))await tx.query('INSERT INTO player_seasonal_inventory(player_id,season_id,state) VALUES($1,$2,$3::jsonb) ON CONFLICT(player_id,season_id) DO UPDATE SET state=excluded.state,updated_at=now()',[id,seasonInventoryId(eventKey as SeasonEventId),JSON.stringify(value)]);
   return view(tx,id,coins,date);
  }));
 }catch(error){return fail(res,error);}});
}
