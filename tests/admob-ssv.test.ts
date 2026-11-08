import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createAdmobVerifier} from '../server/admob-ssv';
test('SSV verifies the trusted EC signature and rejects altered, duplicate and wrong-unit callbacks',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const verify=createAdmobVerifier({adUnit:'5071837508',rewardItem:'coins',rewardAmount:'1',getKey:async id=>{assert.equal(id,'42');return publicKey;}});
 const data='ad_network=5450213213286189855&ad_unit=5071837508&custom_data=12345678-1234-1234-1234-123456789012.abcdefghijklmnopqrstuvwxyz012345&reward_amount=1&reward_item=coins&timestamp=1794139200000&transaction_id=0123456789abcdef0123456789abcdef&user_id=player_a';
 const callback=(value:string)=>value+'&signature='+sign('sha256',Buffer.from(value),privateKey).toString('base64url')+'&key_id=42';
 assert.equal((await verify(callback(data))).userId,'player_a');
 await assert.rejects(verify(callback(data).replace('player_a','player_b')),/signature/);
 await assert.rejects(verify(callback(data+'&user_id=player_b')),/duplicate/);
 await assert.rejects(verify(callback(data.replace('5071837508','0000000000'))),/mismatch/);
 await assert.rejects(verify(callback(data.replace('reward_amount=1','reward_amount=999999'))),/mismatch/);
 await assert.rejects(verify(callback(data)+'&extra=1'),/invalid/);
 const encoded=data.replace('player_a','player%5Fa');
 const decodedSigned=encoded+'&signature='+sign('sha256',Buffer.from(decodeURIComponent(encoded)),privateKey).toString('base64url')+'&key_id=42';
 assert.equal((await verify(decodedSigned)).userId,'player_a');
});
