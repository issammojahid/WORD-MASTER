import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {URL} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
import {fulfillDeletion} from '../server/privacy-maintenance';
test('reviewed deletion removes profile, credentials, messages and inventory while preserving another player and anonymous results',async()=>{
 const pg=new PGlite();
 for(const path of ['supabase-initial/0000_clammy_thor.sql','006_halloween_inventory.sql','008_unified_game_wallet.sql','009_rewarded_ads.sql','010_privacy_requests.sql'])await pg.exec(readFileSync(new URL('../server/migrations/'+path,import.meta.url),'utf8'));
 const tx={query:(sql:string,values?:unknown[])=>pg.query<Record<string,unknown>>(sql,values)};
 try{
  await pg.exec("INSERT INTO player_profiles(id,name,coins) VALUES('a','ألف',2000),('b','باء',7777);INSERT INTO online_guest_sessions(id,token_hash,expires_at) VALUES('a','hash-a',now()+interval '1 day'),('b','hash-b',now()+interval '1 day');INSERT INTO game_wallet_accounts(player_id) VALUES('a'),('b');INSERT INTO player_deletion_requests(id,player_id) VALUES('request-a','a');INSERT INTO social_profiles(player_id,display_name) VALUES('a','ألف'),('b','باء');INSERT INTO social_conversations(id,player_low,player_high) VALUES('conv','a','b');INSERT INTO social_messages(id,conversation_id,sender_id,idempotency_key,content) VALUES('message','conv','a','abcdefgh','رسالة خاصة');INSERT INTO player_seasonal_inventory(player_id,season_id) VALUES('a','season_2027_atlas');INSERT INTO clans(id,name,leader_id) VALUES('clan','الحروف','a');INSERT INTO clan_members(clan_id,player_id,role) VALUES('clan','a','leader'),('clan','b','member');INSERT INTO online_matches(id,mode,status,results) VALUES('match','random','completed','{\"final\":[{\"playerId\":\"a\",\"playerName\":\"ألف\",\"score\":20},{\"playerId\":\"b\",\"playerName\":\"باء\",\"score\":30}]}');INSERT INTO online_match_participants(match_id,player_id,display_name) VALUES('match','a','ألف'),('match','b','باء');");
  await assert.rejects(()=>fulfillDeletion(tx,'request-a','b'),/request_owner_mismatch/);
  await pg.query('UPDATE online_match_participants SET active=true WHERE player_id=$1',['a']);await assert.rejects(()=>fulfillDeletion(tx,'request-a','a'),/active_matches/);await pg.query('UPDATE online_match_participants SET active=false WHERE player_id=$1',['a']);
  await pg.transaction(async transaction=>fulfillDeletion({query:(sql,values)=>transaction.query<Record<string,unknown>>(sql,values)},'request-a','a'));
  for(const [table,column]of [['player_profiles','id'],['online_guest_sessions','id'],['social_profiles','player_id'],['player_seasonal_inventory','player_id'],['game_wallet_accounts','player_id']])assert.equal((await pg.query(`SELECT * FROM ${table} WHERE ${column}=$1`,['a'])).rows.length,0);
  assert.equal((await pg.query('SELECT * FROM social_messages')).rows.length,0);assert.equal((await pg.query<{coins:number}>("SELECT coins FROM player_profiles WHERE id='b'")).rows[0].coins,7777);
  assert.equal((await pg.query<{leader_id:string}>("SELECT leader_id FROM clans WHERE id='clan'")).rows[0].leader_id,'b');
  const result=(await pg.query<{results:any}>("SELECT results FROM online_matches WHERE id='match'")).rows[0].results;assert.equal(result.final[0].playerName,'لاعب محذوف');assert.notEqual(result.final[0].playerId,'a');assert.equal(result.final[1].playerName,'باء');
  assert.deepEqual((await pg.query("SELECT player_id,status FROM player_deletion_requests WHERE id='request-a'")).rows,[{player_id:null,status:'completed'}]);
 }finally{await pg.close();}
});
