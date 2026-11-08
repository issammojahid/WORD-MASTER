import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
const require=createRequire(import.meta.url),{create,act}=require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;

test('chest motion stops in background, settles with reduced motion, and cleans up listeners',async()=>{
 const fixture={reduced:false,starts:0,stops:0,settled:0,listener:null as null|((state:string)=>void)};
 (globalThis as any).__chestMotion=fixture;
 const compiled=await build({stdin:{contents:'export {SeasonChestPreview} from "./components/SeasonChestPreview";',resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react'],loader:{'.png':'empty'},plugins:[{name:'chest-host',setup(b){
  b.onResolve({filter:/^(react-native|\.\/GameUi|\.\/SeasonCatalogArtwork|@\/components\/ScaledText)$/},args=>({path:args.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='react-native'?`const f=global.__chestMotion;exports.View='view';exports.Image='image';exports.StyleSheet={create:x=>x};exports.AppState={currentState:'active',addEventListener:(_,fn)=>{f.listener=fn;return {remove:()=>{f.listener=null;}};}};class Value{setValue(x){if(x===1)f.settled++;}stopAnimation(){}interpolate(){return 0;}}exports.Animated={Value,View:'animated',timing:()=>({start:()=>f.starts++,stop:()=>f.stops++})};`:args.path==='./GameUi'?'exports.useReducedMotion=()=>global.__chestMotion.reduced;':args.path.includes('ScaledText')?'exports.ScaledText="text";':'exports.SeasonCatalogArtwork="art";'}));
 }}]});
 const module={exports:{} as any};new Function('require','module','exports',compiled.outputFiles[0].text)(require,module,module.exports);
 let renderer:any;await act(async()=>{renderer=create(React.createElement(module.exports.SeasonChestPreview,{event:'atlas'}));});
 assert.equal(fixture.starts,1);
 await act(async()=>fixture.listener!('background'));assert.equal(fixture.stops,1);assert.equal(fixture.settled,1);
 await act(async()=>fixture.listener!('active'));assert.equal(fixture.starts,2);
 fixture.reduced=true;await act(async()=>renderer.update(React.createElement(module.exports.SeasonChestPreview,{event:'atlas'})));
 assert.equal(fixture.stops,2);assert.equal(fixture.starts,2);assert.equal(fixture.settled,2);
 await act(async()=>renderer.unmount());assert.equal(fixture.listener,null);
 delete (globalThis as any).__chestMotion;
});
