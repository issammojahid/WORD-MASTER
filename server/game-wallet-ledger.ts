import type { CoinSql } from "./coin-entry-ledger";
export async function isUnifiedWallet(tx:CoinSql,id:string):Promise<boolean>{return (await tx.query('SELECT player_id FROM game_wallet_accounts WHERE player_id=$1',[id])).rows.length>0;}
export async function readGameCoins(tx:CoinSql,id:string):Promise<number>{
 const table=await isUnifiedWallet(tx,id)?"player_profiles":"online_guest_wallets",key=table==="player_profiles"?"id":"player_id";
 const result=await tx.query(`SELECT coins FROM ${table} WHERE ${key}=$1`,[id]);return Number(result.rows[0]?.coins??0);
}
export async function changeGameCoins(tx:CoinSql,id:string,amount:number):Promise<number>{
 if(!Number.isSafeInteger(amount))throw Error("invalid_coin_amount");
 const unified=await isUnifiedWallet(tx,id),table=unified?"player_profiles":"online_guest_wallets",key=unified?"id":"player_id";
 if(!unified)await tx.query('INSERT INTO online_guest_wallets(player_id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
 const result=await tx.query(`UPDATE ${table} SET coins=coins+$2,updated_at=now() WHERE ${key}=$1 AND coins+$2>=0 RETURNING coins`,[id,amount]);
 if(!result.rows.length)throw Error("insufficient_online_coins");return Number(result.rows[0].coins);
}
