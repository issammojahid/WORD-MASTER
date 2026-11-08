import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{create,act}=require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
test('result sound plays once, cancels pending playback on mute, and never replays a suppressed result',async()=>{
 const f={soundEffects:true,audioPreferencesReady:false,active:true,focused:true,plays:[] as any[],stops:[] as string[]};(globalThis as any).__resultSound=f;
 const result=await build({stdin:{contents:'export {useResultSound} from "./lib/use-result-sound";',resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',external:['react'],plugins:[{name:'sound',setup(b){
  b.onResolve({filter:/^(\.\/sound-manager|\.\/use-app-active|@\/contexts\/LanguageContext|@react-navigation\/native)$/},a=>({path:a.path,namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:'const f=global.__resultSound;'+(a.path.includes('Language')?'exports.useLanguage=()=>f;':a.path.includes('use-app')?'exports.useAppActive=()=>f.active;':a.path.includes('navigation')?'exports.useIsFocused=()=>f.focused;':'exports.playSound=async(name,allowed)=>{f.plays.push({name,allowed})};exports.stopSound=async name=>{f.stops.push(name)};')}));
 }}]});
 const m={exports:{} as any};new Function('require','module','exports',result.outputFiles[0].text)(require,m,m.exports);
 function Host({id,outcome}:{id:string|null;outcome:string}){m.exports.useResultSound(id,outcome);return null;}
 let r:any;await act(async()=>{r=create(React.createElement(Host,{id:'one',outcome:'win'}));});assert.equal(f.plays.length,0);
 f.audioPreferencesReady=true;await act(async()=>r.update(React.createElement(Host,{id:'one',outcome:'win'})));assert.equal(f.plays.length,1);assert.equal(f.plays[0].allowed(),true);
 await act(async()=>r.update(React.createElement(Host,{id:'one',outcome:'win'})));assert.equal(f.plays.length,1);
 f.soundEffects=false;await act(async()=>r.update(React.createElement(Host,{id:'one',outcome:'win'})));assert.equal(f.plays[0].allowed(),false);assert.deepEqual(f.stops,['win']);
 f.soundEffects=true;await act(async()=>r.update(React.createElement(Host,{id:'one',outcome:'win'})));assert.equal(f.plays.length,1);
 f.focused=false;await act(async()=>r.update(React.createElement(Host,{id:'two',outcome:'draw'})));assert.equal(f.plays.length,1);
 f.focused=true;await act(async()=>r.update(React.createElement(Host,{id:'two',outcome:'draw'})));assert.equal(f.plays.length,1);
 await act(async()=>r.update(React.createElement(Host,{id:'three',outcome:'lose'})));assert.equal(f.plays.at(-1).name,'lose');
 await act(async()=>r.unmount());assert.equal(f.plays.at(-1).allowed(),false);delete (globalThis as any).__resultSound;
});
