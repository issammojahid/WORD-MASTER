import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {HALLOWEEN_ITEMS} from '../shared/halloween';
const require=createRequire(import.meta.url),{create,act}=require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;

test('archived seasonal collection hides unowned items but owned items still select and preview',async()=>{
 const owned=HALLOWEEN_ITEMS.find(item=>item.category==='avatar')!;
 (globalThis as any).__archiveAccount={enabled:true,seasonActive:false,account:{state:{owned:[owned.id],equipped:{}}}};
 const compiled=await build({stdin:{contents:'export {HalloweenCategory,useHalloweenAppearance} from "./components/HalloweenAppearance";',resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react'],loader:{'.png':'empty'},alias:{'@':process.cwd()},plugins:[{name:'ui-hosts',setup(b){
  b.onResolve({filter:/^(react-native|@\/contexts\/(LanguageContext|HalloweenContext)|@\/components\/(HalloweenFrameArtwork|HalloweenPlateArtwork|AvatarArtwork|HalloweenMotion))$/},args=>({path:args.path,namespace:'fixtures'}));
  b.onLoad({filter:/.*/,namespace:'fixtures'},args=>({loader:'js',contents:args.path==='react-native'?'exports.View="view";exports.Text="text";exports.Image="image";exports.Pressable="button";exports.StyleSheet={create:x=>x,absoluteFill:{}};':args.path.includes('LanguageContext')?'exports.useLanguage=()=>({language:"ar"});':args.path.includes('HalloweenContext')?'exports.useHalloweenAccount=()=>global.__archiveAccount;':'exports.HalloweenFrame="frame";exports.HalloweenPlateArtwork="plate";exports.AvatarArtwork="avatar";exports.HalloweenMotionLayer="motion";exports.HalloweenMotionScene="scene";'}));
 }}]});
 const module={exports:{} as any};new Function('require','module','exports',compiled.outputFiles[0].text)(require,module,module.exports);
 let appearance:any,selected:any,renderer:any;
 function Screen(){appearance=module.exports.useHalloweenAppearance();return React.createElement(module.exports.HalloweenCategory,{kind:'skin',onSelect:(asset:any)=>{selected=asset;}});}
 await act(async()=>{renderer=create(React.createElement(Screen));});
 const tiles=renderer.root.findAllByType('button').filter((node:any)=>node.props.accessibilityLabel);
 assert.equal(tiles.length,1,'only the owned archived avatar is offered');
 await act(async()=>{tiles[0].props.onPress();});
 assert.equal(selected.previewKey,owned.assetKey);
 assert.equal(appearance.asset('avatar').previewKey,owned.assetKey,'owned selection is visible even after promotions are disabled');
 assert.equal(appearance.active,true);
 await act(async()=>{renderer.unmount();});
 delete (globalThis as any).__archiveAccount;
});
