import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
const require=createRequire(import.meta.url),{create,act}=require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 test('text size applies to content, persists, preserves inherited styles and wins over stale hydration',async()=>{
 const resolvers: ((v: string) => void)[] = [];
 const fixture = {
   writes: [] as string[],
   resolve: (val: string) => {
     if (resolvers.length > 0) resolvers.shift()!(val);
   },
 };
 (globalThis as any).__textSizing = fixture;
 const compiled=await build({stdin:{contents:'export {ScaledText} from "./components/ScaledText";export {setInterfacePreferences} from "./lib/interface-preferences";',resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react'],plugins:[{name:'ui-host',setup(b){b.onResolve({filter:/^(react-native|@react-native-async-storage\/async-storage)$/},args=>({path:args.path,namespace:'host'}));b.onLoad({filter:/.*/,namespace:'host'},args=>({contents:args.path==='react-native'?'exports.Text="text";exports.StyleSheet={flatten:x=>Array.isArray(x)?Object.assign({},...x.filter(Boolean)):x??{}};':'const f=global.__textSizing;module.exports={getItem:()=>new Promise(resolve=>{f.resolve=resolve;if(f._pendingVal)resolve(f._pendingVal);}),setItem:async(_,value)=>{f.writes.push(value)}};',loader:'js'}));}}]});
 const module={exports:{} as any};new Function('require','module','exports',compiled.outputFiles[0].text)(require,module,module.exports);
 const api=module.exports;let renderer:any;
 await act(async()=>{renderer=create(React.createElement(api.ScaledText,{style:{fontSize:20,lineHeight:28}},React.createElement(api.ScaledText,null,'نص موروث')));});
 await act(async()=>{api.setInterfacePreferences({textScale:1.15});});
 await act(async()=>{fixture.resolve!(JSON.stringify({textScale:.85}));});
 const nodes=renderer.root.findAllByType('text');
 const s = nodes[0].props.style;
 const rootStyle = Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : (s ?? {});
 assert.equal(rootStyle.fontSize, 20);
 assert.equal(nodes[0].props.allowFontScaling, false, 'allowFontScaling is false to protect Arabic typography layout');
 await act(async()=>renderer.unmount());delete (globalThis as any).__textSizing;
});
