import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {seasonPreviewItems} from '../constants/season-catalog';
const require=createRequire(import.meta.url),{create,act}=require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;

test('season motion runs only while active and stops for backgrounding, reduced motion and unmount',async()=>{
 const fixture={active:'active',reduced:false,starts:0,stops:0,listener:null as null|((state:string)=>void)};
 (globalThis as any).__seasonMotion=fixture;
 const compiled=await build({stdin:{contents:'export {SeasonItemPreview} from "./components/SeasonItemPreview";',resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react'],plugins:[{name:'motion-host',setup(b){
  b.onResolve({filter:/^(react-native|\.\/GameUi|\.\/SeasonCatalogArtwork|@\/contexts\/PlayerContext)$/},args=>({path:args.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='react-native'?`const f=global.__seasonMotion;exports.View='view';exports.Text='text';exports.StyleSheet={create:x=>x,flatten:x=>Array.isArray(x)?Object.assign({},...x.filter(Boolean)):x??{},absoluteFill:{}};exports.AppState={currentState:'active',addEventListener:(_,fn)=>{f.listener=fn;return {remove:()=>{f.listener=null;}};}};class Value{setValue(){}stopAnimation(){}interpolate(){return 0;}}exports.Animated={Value,View:'animated',timing:()=>({}),loop:()=>({start:()=>f.starts++,stop:()=>f.stops++})};`:args.path==='./GameUi'?'exports.PlayerAvatar="avatar";exports.useReducedMotion=()=>global.__seasonMotion.reduced;':args.path==='./SeasonCatalogArtwork'?'exports.SeasonCatalogArtwork="art";':'exports.usePlayer=()=>({profile:{name:"لاعب",equippedSkin:"student",equippedCosmetics:{frame:"basic_frame"}}});'}));
 }}]});
 const module={exports:{} as any};new Function('require','module','exports',compiled.outputFiles[0].text)(require,module,module.exports);
 const item=seasonPreviewItems('winter').find(item=>item.kind==='victory')!;
 let renderer:any;await act(async()=>{renderer=create(React.createElement(module.exports.SeasonItemPreview,{item}));});
 assert.equal(fixture.starts,1);
 assert.equal(renderer.root.findAllByType('animated').length,13,'art plus twelve particles');
 await act(async()=>fixture.listener!('background'));
 assert.equal(fixture.stops,1);assert.equal(renderer.root.findAllByType('animated').length,1);
 await act(async()=>fixture.listener!('active'));assert.equal(fixture.starts,2);
 fixture.reduced=true;await act(async()=>renderer.update(React.createElement(module.exports.SeasonItemPreview,{item})));
 assert.equal(fixture.stops,2);assert.equal(renderer.root.findAllByType('animated').length,1);
 fixture.reduced=false;await act(async()=>renderer.update(React.createElement(module.exports.SeasonItemPreview,{item})));
 assert.equal(fixture.starts,3);await act(async()=>renderer.unmount());assert.equal(fixture.stops,3);assert.equal(fixture.listener,null);
 delete (globalThis as any).__seasonMotion;
});
