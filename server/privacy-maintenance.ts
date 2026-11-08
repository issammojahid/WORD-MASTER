import {randomUUID} from 'node:crypto';
import type {CoinSql} from './coin-entry-ledger';

// Call only in a database transaction with the application stopped for maintenance.
// No route exposes this operation. Requests are reviewed by the operator first.
function anonymize(value:unknown,id:string,replacement:string):unknown{
 if(Array.isArray(value))return value.map(child=>anonymize(child,id,replacement));
 if(value&&typeof value==='object'){
  const source=value as Record<string,unknown>,own=source.playerId===id||source.id===id;
  return Object.fromEntries(Object.entries(source).map(([key,child])=>[key===id?replacement:key,own&&['name','playerName','displayName'].includes(key)?'لاعب محذوف':own&&key==='answers'?{}:anonymize(child,id,replacement)]));
 }
 return value===id?replacement:value;
}
export async function fulfillDeletion(tx:CoinSql,requestId:string,expectedPlayerId:string){
 const request=(await tx.query("SELECT player_id,status FROM player_deletion_requests WHERE id=$1 FOR UPDATE",[requestId])).rows[0];
 if(!request||request.player_id!==expectedPlayerId||!['pending','processing'].includes(String(request.status)))throw Error('request_owner_mismatch');
 const profile=(await tx.query('SELECT id,referral_code FROM player_profiles WHERE id=$1 FOR UPDATE',[expectedPlayerId])).rows[0];if(!profile)throw Error('profile_missing');
 const active=(await tx.query('SELECT match_id FROM online_match_participants WHERE player_id=$1 AND active=true',[expectedPlayerId])).rows;
 if(active.length)throw Error('finish_or_refund_active_matches_first');
 if((await tx.query("SELECT id FROM tournament_matches WHERE status<>'completed' AND (player1_id=$1 OR player2_id=$1)",[expectedPlayerId])).rows.length)throw Error('resolve_pending_tournament_first');
 if((await tx.query('SELECT id FROM spectator_bets WHERE settled=false AND (spectator_id=$1 OR bet_on_player_id=$1)',[expectedPlayerId])).rows.length)throw Error('settle_spectator_bets_first');
 const replacement='deleted-'+randomUUID();
 const clans=(await tx.query('SELECT id FROM clans WHERE leader_id=$1 FOR UPDATE',[expectedPlayerId])).rows;
 for(const clan of clans){const successor=(await tx.query('SELECT player_id FROM clan_members WHERE clan_id=$1 AND player_id<>$2 ORDER BY joined_at,player_id LIMIT 1',[clan.id,expectedPlayerId])).rows[0];if(successor){await tx.query('UPDATE clans SET leader_id=$2 WHERE id=$1',[clan.id,successor.player_id]);await tx.query("UPDATE clan_members SET role='leader' WHERE clan_id=$1 AND player_id=$2",[clan.id,successor.player_id]);}else{await tx.query('DELETE FROM clan_members WHERE clan_id=$1',[clan.id]);await tx.query('DELETE FROM clans WHERE id=$1',[clan.id]);}}
 await tx.query('DELETE FROM clan_members WHERE player_id=$1',[expectedPlayerId]);
 await tx.query('DELETE FROM social_messages WHERE conversation_id IN (SELECT id FROM social_conversations WHERE player_low=$1 OR player_high=$1) OR sender_id=$1',[expectedPlayerId]);
 for(const table of ['social_conversations','social_friendships'])await tx.query(`DELETE FROM ${table} WHERE player_low=$1 OR player_high=$1`,[expectedPlayerId]);
 for(const table of ['social_friend_requests','social_game_invites'])await tx.query(`DELETE FROM ${table} WHERE sender_id=$1 OR receiver_id=$1 OR pair_low=$1 OR pair_high=$1`,[expectedPlayerId]);
 await tx.query('DELETE FROM social_blocks WHERE blocker_id=$1 OR blocked_id=$1',[expectedPlayerId]);await tx.query('DELETE FROM social_notifications WHERE player_id=$1 OR actor_id=$1',[expectedPlayerId]);await tx.query('DELETE FROM social_profiles WHERE player_id=$1',[expectedPlayerId]);
 const matches=(await tx.query('SELECT id,results FROM online_matches WHERE id IN (SELECT match_id FROM online_match_participants WHERE player_id=$1)',[expectedPlayerId])).rows;
 for(const match of matches)await tx.query('UPDATE online_matches SET results=$2::jsonb WHERE id=$1',[match.id,JSON.stringify(anonymize(match.results,expectedPlayerId,replacement))]);
 await tx.query("UPDATE online_match_participants SET player_id=$2,display_name='لاعب محذوف' WHERE player_id=$1",[expectedPlayerId,replacement]);
 for(const column of ['player1','player2','winner'])await tx.query(`UPDATE tournament_matches SET ${column}_id=$2,${column}_name='لاعب محذوف' WHERE ${column}_id=$1`,[expectedPlayerId,replacement]);
 await tx.query("UPDATE tournament_players SET player_id=$2,player_name='لاعب محذوف',player_skin='student' WHERE player_id=$1",[expectedPlayerId,replacement]);
 await tx.query('DELETE FROM room_invites WHERE from_player_id=$1 OR to_player_id=$1',[expectedPlayerId]);
 for(const column of ['from_player_id','to_player_id'])await tx.query(`UPDATE coin_gifts SET ${column}=$2 WHERE ${column}=$1`,[expectedPlayerId,replacement]);
 await tx.query('DELETE FROM spectator_bets WHERE spectator_id=$1',[expectedPlayerId]);await tx.query('UPDATE spectator_bets SET bet_on_player_id=$2 WHERE bet_on_player_id=$1',[expectedPlayerId,replacement]);
 for(const table of ['daily_spins','win_streaks','player_daily_tasks','player_achievements','player_battle_pass','daily_challenge_entries','online_reward_claims','online_daily_match_counters','online_match_flags','player_seasonal_inventory','rewarded_ad_sessions','game_wallet_operations','online_guest_wallets'])await tx.query(`DELETE FROM ${table} WHERE player_id=$1`,[expectedPlayerId]);
 await tx.query("UPDATE player_deletion_requests SET status='completed',updated_at=now() WHERE player_id=$1",[expectedPlayerId]);
 if(profile.referral_code)await tx.query('UPDATE player_profiles SET referred_by=NULL WHERE referred_by=$1',[profile.referral_code]);
 await tx.query('DELETE FROM game_wallet_accounts WHERE player_id=$1',[expectedPlayerId]);await tx.query('DELETE FROM player_profiles WHERE id=$1',[expectedPlayerId]);await tx.query('DELETE FROM online_guest_sessions WHERE id=$1',[expectedPlayerId]);
 return {requestId,status:'completed' as const};
}
