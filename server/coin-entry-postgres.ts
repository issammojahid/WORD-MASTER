import {pool} from "./db";
import type {CoinDatabase} from "./coin-entry-ledger";
export const coinDatabase:CoinDatabase={async transaction(operation){const client=await pool.connect();try{await client.query("BEGIN");const result=await operation({query:async(text,values)=>client.query(text,values)});await client.query("COMMIT");return result;}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}};
