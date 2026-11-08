import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
test('rewarded ads use server verification, require earned plus close, and clean up on errors and cancellation',async(t)=>{
 const f={ad:null as any,options:null as any,shows:0};(globalThis as any).__rewardDriver=f;
 const compiled=await build({stdin:{contents:'export {runRewardedAd} from "./lib/rewarded-ad.native";',resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'sdk',setup(b){
  b.onResolve({filter:/^(react-native-google-mobile-ads|\.\/ad-config)$/},a=>({path:a.path,namespace:'host'}));
  b.onLoad({filter:/.*/,namespace:'host'},a=>({loader:'js',contents:a.path.includes('ad-config')?'exports.getAdUnitId=()=>"test-rewarded";':`const f=global.__rewardDriver;exports.RewardedAdEventType={LOADED:'loaded',EARNED_REWARD:'earned'};exports.AdEventType={CLOSED:'closed',ERROR:'error'};exports.RewardedAd={createForAdRequest:(_,options)=>{f.options=options;const listeners=new Map();f.ad={load(){},show:async()=>{f.shows++},addAdEventListener:(name,fn)=>{listeners.set(name,fn);return()=>listeners.delete(name)},emit:(name,value)=>listeners.get(name)?.(value),count:()=>listeners.size};return f.ad;}};`}));
 }}]});
 const m={exports:{} as any};new Function('require','module','exports',compiled.outputFiles[0].text)(require,m,m.exports);
 t.mock.timers.enable({apis:['setTimeout']});
 const options={userId:'player-one',customData:'signed-session',allowed:()=>true};
 let promise=m.exports.runRewardedAd(options);assert.deepEqual(f.options.serverSideVerificationOptions,{userId:'player-one',customData:'signed-session'});
 f.ad.emit('loaded');f.ad.emit('closed');assert.equal(await promise,false);assert.equal(f.ad.count(),0);
 promise=m.exports.runRewardedAd(options);f.ad.emit('loaded');f.ad.emit('earned');f.ad.emit('earned');f.ad.emit('closed');assert.equal(await promise,true);assert.equal(f.ad.count(),0);
 const abort=new AbortController();promise=m.exports.runRewardedAd({...options,signal:abort.signal});const cancelled=assert.rejects(promise,/cancelled/);abort.abort();await cancelled;assert.equal(f.ad.count(),0);
 promise=m.exports.runRewardedAd(options);const failed=assert.rejects(promise,/no_fill/);f.ad.emit('error',Error('no_fill'));await failed;assert.equal(f.ad.count(),0);
 await assert.rejects(m.exports.runRewardedAd({...options,allowed:()=>false}),/unavailable/);
 promise=m.exports.runRewardedAd(options);const timeout=assert.rejects(promise,/load_timeout/);t.mock.timers.tick(45000);await timeout;assert.equal(f.ad.count(),0);
 delete (globalThis as any).__rewardDriver;
});
