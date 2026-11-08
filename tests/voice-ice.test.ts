import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {parseVoiceIce} from '../shared/voice-ice';
import {voiceIceConfig} from '../server/voice-ice';
test('voice relay credentials expire, do not expose the shared secret and validate ICE URLs',()=>{
 const secret='temporary-test-secret-'.repeat(3),clock=Date.parse('2026-11-08T12:00:00Z');
 const servers=voiceIceConfig('player-a',{VOICE_TURN_SECRET:secret,VOICE_TURN_URLS:'turn:relay.example:3478?transport=udp,turns:relay.example:5349?transport=tcp'},clock);
 assert.equal(servers.length,2);assert.equal(Number(servers[1].username!.split(':')[0]),clock/1000+3600);assert.equal(servers[1].credential,createHmac('sha1',secret).update(servers[1].username!).digest('base64'));assert.ok(!JSON.stringify(servers).includes(secret));assert.ok(!servers[1].username!.includes('player-a'));
 assert.notEqual(voiceIceConfig('player-b',{VOICE_TURN_SECRET:secret,VOICE_TURN_URLS:'turn:relay.example:3478'},clock)[1].username,servers[1].username);
 assert.deepEqual(parseVoiceIce([{urls:'https://example.com'},{urls:'turn:relay.example'},{urls:'stun:good.example:3478'}]),[{urls:['stun:good.example:3478']}]);
});
