import type {Express} from 'express';
import type {CoinSql} from './coin-entry-ledger';
import {AVATAR_CATALOG,COSMETIC_CATALOG} from '../shared/cosmetics';
import {getStoreOffer} from '../constants/store-economy';
export function registerReleaseRoutes(app:Express,database:CoinSql){
 app.get('/api/store/catalog',(_req,res)=>res.json({version:'economy-2027-v1',items:[...AVATAR_CATALOG,...COSMETIC_CATALOG].map(item=>({id:item.id,...getStoreOffer(item.id)}))}));
 app.get('/api/leaderboard',async(req,res)=>{
  try{
   const country=req.query.country;
   if(country!==undefined&&(typeof country!=='string'||!/^([A-Z]{2})$/.test(country)))return res.status(400).json({error:'invalid_country'});
   const limit=50;
   const result=await database.query(`SELECT row_number() OVER(ORDER BY total_score DESC,wins DESC,id ASC)::int AS rank,name,country,total_score AS score,wins,equipped_skin AS "skinId" FROM player_profiles WHERE ($1::text IS NULL OR country=$1) ORDER BY total_score DESC,wins DESC,id ASC LIMIT $2`,[country??null,limit]);
   return res.json({entries:result.rows,updatedAt:new Date().toISOString()});
  }catch{return res.status(503).json({error:'leaderboard_unavailable'});}
 });
}
