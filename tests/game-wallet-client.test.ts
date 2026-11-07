import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import path from 'node:path';
test('offline queue preserves concurrent games and retries an acknowledged reward without losing or duplicating entries',async()=>{
 const storage=new Map<string,string>();(globalThis as any).__walletStorage=storage;
 const compiled=await build({entryPoints:[path.resolve('services/game-wallet.ts')],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'isolated-wallet-platform',setup(b){
  b.onResolve({filter:/^(\.\/socket|@\/lib\/query-client|@\/lib\/api-auth|@react-native-async-storage\/async-storage)$/},args=>({path:args.path,namespace:'wallet-mock'}));
  b.onLoad({filter:/.*/,namespace:'wallet-mock'},args=>({contents:args.path==='./socket'?'export async function getOnlineGuestToken(){return "test"};export async function refreshOnlineGuestToken(){return "test"}':args.path.includes('query-client')?'export function getApiUrl(){return "https://wallet.test"}':args.path.includes('api-auth')?'export function installApiAuthentication(){}':'export default {async getItem(key){return globalThis.__walletStorage.get(key)??null},async setItem(key,value){await new Promise(r=>setTimeout(r,1));globalThis.__walletStorage.set(key,value)}}',loader:'js'}));
 }}]});
 const module={exports:{} as any};new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
 const api=module.exports;const original=globalThis.fetch;const receipts=new Set<string>();let coins=0,lostResponse=true;
 globalThis.fetch=(async(_input,init)=>{const operation=JSON.parse(String(init?.body));if(!receipts.has(operation.operationId)){receipts.add(operation.operationId);coins+=20;}if(lostResponse){lostResponse=false;throw Error('response_lost_after_commit');}return new Response(JSON.stringify({coins,level:1}));}) as typeof fetch;
 try{
  await Promise.all([api.queueOfflineMatch(100),api.queueOfflineMatch(200)]);
  await assert.rejects(api.flushOfflineMatches(),/response_lost/);
  assert.equal(JSON.parse([...storage.values()][0]).length,2);assert.equal(coins,20);
  await Promise.all([api.flushOfflineMatches(),api.queueOfflineMatch(300)]);
  await api.flushOfflineMatches();
  assert.equal(receipts.size,3);assert.equal(coins,60);assert.deepEqual(JSON.parse([...storage.values()][0]),[]);
 }finally{globalThis.fetch=original;delete (globalThis as any).__walletStorage;}
});
