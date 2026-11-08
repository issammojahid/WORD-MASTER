import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DAILY_REMINDERS,REMINDER_PREFIX} from './notification-plan';

const KEY='horof_local_reminders_v2';
let Notifications:typeof import('expo-notifications')|null=null;
try{
 if(Platform.OS!=='web'){
  // Native module is optional in web and Expo Go environments.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications=require('expo-notifications');
  Notifications?.setNotificationHandler({handleNotification:async()=>({shouldPlaySound:false,shouldSetBadge:false,shouldShowBanner:false,shouldShowList:true})});
 }
}catch{/* Native notifications are unavailable in some preview environments. */}
let queue:Promise<unknown>=Promise.resolve();
function serial<T>(action:()=>Promise<T>):Promise<T>{const next=queue.then(action,action);queue=next.catch(()=>{});return next;}
async function cancelOwned(){
 if(!Notifications)return;
 const scheduled=await Notifications.getAllScheduledNotificationsAsync();
 await Promise.all(scheduled.filter(item=>item.identifier.startsWith(REMINDER_PREFIX)).map(item=>Notifications!.cancelScheduledNotificationAsync(item.identifier)));
}
async function channel(){
 if(Notifications&&Platform.OS==='android')await Notifications.setNotificationChannelAsync('daily-reminders',{name:'تذكيرات اللعب',importance:Notifications.AndroidImportance.DEFAULT,sound:'default'});
}
async function reconcile(){
 if(!Notifications)return false;
 const existing=await Notifications.getAllScheduledNotificationsAsync();
 const owned=existing.filter(item=>item.identifier.startsWith(REMINDER_PREFIX));
 const expected=DAILY_REMINDERS.map((_,index)=>`${REMINDER_PREFIX}${index}`);
 if(owned.length===5&&expected.every(id=>owned.some(item=>item.identifier===id)))return true;
 await cancelOwned();
 try{
  for(const [index,item] of DAILY_REMINDERS.entries())await Notifications.scheduleNotificationAsync({identifier:expected[index],content:{title:item.title,body:item.body,sound:'default',data:{kind:'daily-reminder',version:2}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DAILY,hour:item.hour,minute:item.minute,channelId:'daily-reminders'}});
  return true;
 }catch{await cancelOwned();return false;}
}
export async function getPermissionsStatus():Promise<string|null>{
 if(!Notifications)return null;
 try{return (await Notifications.getPermissionsAsync()).status;}catch{return null;}
}
export function setLocalReminders(enabled:boolean){return serial(async()=>{
 if(!enabled){try{await cancelOwned();await AsyncStorage.setItem(KEY,'false');return true;}catch{return false;}}
 if(!Notifications)return false;
 try{
  await channel();
  let status=await getPermissionsStatus();
  if(status!=='granted')status=(await Notifications.requestPermissionsAsync()).status;
  if(status!=='granted'){await cancelOwned();await AsyncStorage.setItem(KEY,'false');return false;}
  const ok=await reconcile();
  await AsyncStorage.setItem(KEY,String(ok));return ok;
 }catch{await AsyncStorage.setItem(KEY,'false');return false;}
 });}
export function syncLocalReminders(){return serial(async()=>{
 const enabled=await AsyncStorage.getItem(KEY)==='true';
 if(!enabled||await getPermissionsStatus()!=='granted'){await cancelOwned();return false;}
 await channel();return reconcile();
 });}
export async function getNotificationSettings(_playerId?:string){
 return {enabled:await AsyncStorage.getItem(KEY)==='true'&&await getPermissionsStatus()==='granted',tokenRegistered:false};
}
export async function updateNotificationSetting(_playerId:string,enabled:boolean){return setLocalReminders(enabled);}
