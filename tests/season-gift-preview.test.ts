import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
const require=createRequire(import.meta.url),{create,act}=require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
test('gift preview requires all four reveals and exactly one choice before confirmation',async()=>{
 const compiled=await build({stdin:{contents:'export {SeasonGiftCards} from "./components/SeasonGiftCards";',resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react'],plugins:[{name:'gift-host',setup(b){
  b.onResolve({filter:/^(react-native|\.\/GameUi|\.\/RoyalUi|\.\/SeasonCatalogArtwork|@\/components\/ScaledText)$/},args=>({path:args.path,namespace:'host'}));
  b.onLoad({filter:/.*/,namespace:'host'},args=>({loader:'js',contents:args.path==='react-native'?'exports.View="view";exports.Text="text";exports.Pressable="button";exports.ScrollView="scroll";class Value{setValue(){}interpolate(){return 1;}}exports.Animated={Value,View:"animated",timing:()=>({start(){},stop(){}})};':args.path==='./GameUi'?'exports.useReducedMotion=()=>true;exports.GameModal="modal";':args.path==='./RoyalUi'?'exports.RoyalSurface="panel";exports.RoyalIcon="icon";':args.path.includes('ScaledText')?'exports.ScaledText="text";':'exports.SeasonCatalogArtwork="art";'}));
 }}]});
 const module={exports:{} as any};new Function('require','module','exports',compiled.outputFiles[0].text)(require,module,module.exports);
 let renderer:any;await act(async()=>{renderer=create(React.createElement(module.exports.SeasonGiftCards,{event:'atlas',onClose:()=>{}}));});
 const buttons=()=>renderer.root.findAllByType('button'),confirm=()=>buttons().find((node:any)=>node.props.disabled!==undefined);
 assert.equal(confirm().props.disabled,true);
 await act(async()=>buttons().find((node:any)=>node.props.accessibilityLabel==='اقلب بطاقة الهدية').props.onPress());
 await act(async()=>buttons().find((node:any)=>node.props.accessibilityLabel?.startsWith('اختيار ')).props.onPress());
 assert.equal(confirm().props.disabled,true,'cannot select a gift while other cards remain hidden');
 for(let index=0;index<3;index++)await act(async()=>buttons().find((node:any)=>node.props.accessibilityLabel==='اقلب بطاقة الهدية').props.onPress());
 assert.equal(confirm().props.disabled,true,'revealing does not silently choose a gift');
 await act(async()=>buttons().find((node:any)=>node.props.accessibilityLabel?.startsWith('اختيار ')).props.onPress());
 assert.equal(confirm().props.disabled,false);
 assert.equal(buttons().filter((node:any)=>node.props.accessibilityState?.selected).length,1);
 await act(async()=>confirm().props.onPress());
 assert.ok(renderer.root.findAllByType('text').some((node:any)=>String(node.props.children).startsWith('اختيارك:')));
 await act(async()=>renderer.unmount());
});
