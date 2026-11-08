import React,{useEffect,useRef,useState} from 'react';
import {Pressable,View,Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAds} from './AdsProvider';
import {usePlayer} from '@/contexts/PlayerContext';
import {getRewardOffer,startRewardSession,getRewardReceipt,type RewardOffer,type RewardKind} from '@/services/rewarded-ads';
import {runRewardedAd} from '@/lib/rewarded-ad';
import {RoyalSurface,RoyalIcon} from './RoyalUi';
import {ScaledText as Text} from './ScaledText';

export function RewardedCoinsCard({matchId}:{matchId?:string}){
 const kind:RewardKind=matchId?'loss-recovery':'coins',ads=useAds(),{playerId,refreshCoins}=usePlayer();
 const [offer,setOffer]=useState<RewardOffer|null>(null),[pending,setPending]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const epoch=useRef(0),alive=useRef(false),lock=useRef(false),release=useRef<null|(()=>void)>(null),controller=useRef<AbortController|null>(null),allowed=useRef(false);
 allowed.current=ads.canRequestAds;
 const key=`rewarded-pending-v1:${playerId}:${kind}:${matchId??'coins'}`;
 useEffect(()=>{
  alive.current=true;epoch.current++;let cancelled=false;const abort=new AbortController();
  void AsyncStorage.getItem(key).then(value=>{if(!cancelled&&alive.current)setPending(value);}).catch(()=>{});
  void getRewardOffer(kind,matchId,abort.signal).then(value=>{if(!cancelled&&alive.current)setOffer(value);}).catch(()=>{if(!cancelled&&alive.current)setMessage('الخدمة غير متاحة حالياً.');});
  return()=>{cancelled=true;alive.current=false;abort.abort();controller.current?.abort();release.current?.();release.current=null;};
 },[key,kind,matchId]);
 async function verify(id:string){
  const status=await getRewardReceipt(id);
  if(status==='credited'){
   await refreshCoins();await AsyncStorage.removeItem(key);
   if(alive.current){setPending(null);setOffer(null);setMessage('تم تأكيد المكافأة وتحديث رصيدك.');}
  }else if(status==='expired'){
   await AsyncStorage.removeItem(key);if(alive.current){setPending(null);setMessage('انتهت صلاحية الطلب دون مكافأة.');}
  }else if(alive.current)setMessage('بانتظار تأكيد المكافأة. يمكنك التحقق مجدداً.');
 }
 async function watch(){
  if(lock.current||!playerId)return;const generation=epoch.current;const current=()=>alive.current&&generation===epoch.current;lock.current=true;setBusy(true);setMessage('');
  try{
   if(pending){await verify(pending);return;}
   if(!offer?.enabled||!ads.canRequestAds||Platform.OS==='web')throw Error('unavailable');
   const slot=ads.acquireRewardedSlot();if(!slot)throw Error('busy');release.current=slot;
   const session=await startRewardSession(kind,matchId);
   if(!current())throw Error("cancelled");
   await AsyncStorage.setItem(key,session.id);if(alive.current)setPending(session.id);
   const abort=new AbortController();controller.current=abort;
   const earned=await runRewardedAd({userId:playerId,customData:session.customData,allowed:()=>current()&&allowed.current,signal:abort.signal});
   slot();release.current=null;
   if(earned)await verify(session.id);
   else{await AsyncStorage.removeItem(key);if(alive.current){setPending(null);setMessage('لم تكتمل مشاهدة الإعلان، ولم تُضف مكافأة.');}}
  }catch{if(alive.current)setMessage('تعذر إكمال الطلب. أعد المحاولة؛ لا تُضاف العملات إلا بعد التأكيد.');}
  finally{release.current?.();release.current=null;controller.current=null;lock.current=false;if(alive.current)setBusy(false);}
 }
 // Keep the release UI clean until the authoritative reward service is enabled.
 if(!offer?.enabled&&!pending)return null;
 const disabled=busy||!playerId||(!pending&&(!offer?.enabled||!ads.canRequestAds||ads.isFullScreenAdActive||Platform.OS==='web'));
 return <RoyalSurface style={{padding:12,gap:9,marginTop:8}}><View style={{flexDirection:'row-reverse',gap:10,alignItems:'center'}}><RoyalIcon name={matchId?'gift':'coins'} size={40}/><View style={{flex:1}}><Text style={{fontFamily:'Cairo_700Bold',fontSize:14,color:'#FFE4A3',textAlign:'right'}}>{matchId?'عوّض جزءاً من مبلغ الدخول':'اربح عملات بمشاهدة إعلان'}</Text><Text style={{fontFamily:'Cairo_400Regular',fontSize:11,color:'#D8C9E4',textAlign:'right'}}>{offer?.enabled?`المكافأة: ${offer.coins} عملة`:'يتطلب اتصالاً وخدمة مكافآت متاحة.'}</Text></View></View>
 <Pressable accessibilityRole="button" accessibilityState={{disabled,busy}} disabled={disabled} onPress={()=>void watch()} style={{minHeight:46,borderRadius:12,backgroundColor:disabled?'#4A405F':'#0E8C92',justifyContent:'center',opacity:disabled?.65:1}}><Text style={{fontFamily:'Cairo_700Bold',fontSize:13,color:'#FFF0D6',textAlign:'center'}}>{busy?'جارٍ المعالجة…':pending?'التحقق من المكافأة':offer?.enabled?'شاهد الإعلان':'الإعلان غير متاح حالياً'}</Text></Pressable>
 {message?<Text accessibilityLiveRegion="polite" style={{fontFamily:'Cairo_400Regular',fontSize:11,lineHeight:21,color:'#E9D7B8',textAlign:'center'}}>{message}</Text>:null}</RoyalSurface>;
}
