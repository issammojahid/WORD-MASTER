import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
test('five local reminders are opt-in, idempotent, serialized and cancelled without deleting unrelated notifications',async()=>{
 const f={store:new Map<string,string>(),scheduled:new Map<string,any>([['friend-invite',{identifier:'friend-invite'}]]),permission:'denied',requests:0,fail:false};
 (globalThis as any).__reminders=f;
 const result=await build({stdin:{contents:'export * from "./lib/local-reminders";',resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'native',setup(b){
  b.onResolve({filter:/^(react-native|expo-notifications|@react-native-async-storage\/async-storage)$/},a=>({path:a.path,namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:a.path==='react-native'?'exports.Platform={OS:"android"};':a.path.includes('async-storage')?'const f=global.__reminders;module.exports={getItem:async k=>f.store.get(k)??null,setItem:async(k,v)=>{f.store.set(k,v)}};':`const f=global.__reminders;exports.AndroidImportance={DEFAULT:3};exports.SchedulableTriggerInputTypes={DAILY:'daily'};exports.setNotificationHandler=()=>{};exports.setNotificationChannelAsync=async()=>{};exports.getPermissionsAsync=async()=>({status:f.permission});exports.requestPermissionsAsync=async()=>{f.requests++;return {status:f.permission}};exports.getAllScheduledNotificationsAsync=async()=>[...f.scheduled.values()];exports.cancelScheduledNotificationAsync=async id=>{f.scheduled.delete(id)};exports.scheduleNotificationAsync=async item=>{if(f.fail&&item.identifier.endsWith('2'))throw Error('failed');f.scheduled.set(item.identifier,item);return item.identifier;};`}));
 }}]});
 const m={exports:{} as any};new Function('require','module','exports',result.outputFiles[0].text)(require,m,m.exports);const api=m.exports;
 assert.equal(await api.syncLocalReminders(),false);assert.equal(f.requests,0);
 assert.equal(await api.setLocalReminders(true),false);assert.equal(f.scheduled.size,1);
 f.permission='granted';assert.equal(await api.setLocalReminders(true),true);
 await Promise.all([api.syncLocalReminders(),api.setLocalReminders(true),api.syncLocalReminders()]);
 const owned=[...f.scheduled.values()].filter(x=>x.identifier!=='friend-invite');
 assert.equal(owned.length,5);assert.deepEqual(owned.map(x=>x.trigger.hour),[10,13,16,19,21]);
 assert.ok(owned.every(x=>x.trigger.type==='daily'&&x.trigger.minute===0));
 f.permission='denied';await api.syncLocalReminders();assert.equal(f.scheduled.size,1);assert.equal(f.requests,1,'startup reconciliation never asks permission');
 f.permission='granted';await api.setLocalReminders(true);
 assert.equal(await api.setLocalReminders(false),true);assert.deepEqual([...f.scheduled.keys()],['friend-invite']);
 f.fail=true;assert.equal(await api.setLocalReminders(true),false);assert.equal(f.scheduled.size,1);
 assert.equal((await api.getNotificationSettings()).enabled,false);
 delete (globalThis as any).__reminders;
});
