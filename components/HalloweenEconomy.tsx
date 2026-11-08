import { HalloweenCountdown } from "@/components/HalloweenCountdown";
import React, { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { HALLOWEEN_ITEMS, type SeasonItem } from "@shared/halloween";
import { HALLOWEEN_PREVIEW_ASSETS } from "@/constants/halloween-preview";
import { HalloweenFrame } from "@/components/HalloweenFrameArtwork";
import { HalloweenPlateArtwork } from "@/components/HalloweenPlateArtwork";
import { useHalloweenAccount, halloweenItemForAsset } from "@/contexts/HalloweenContext";
import { HalloweenGiftCards } from "@/components/HalloweenGiftCards";
import { usePlayer } from "@/contexts/PlayerContext";
import { halloweenObjective } from "@shared/halloween-objectives";

export function HalloweenAcquireButton({assetKey,compact=false}:{assetKey:string;compact?:boolean}){
 const {profile}=usePlayer();
 const {enabled,seasonActive,account,busy,act}=useHalloweenAccount();
 const [confirm,setConfirm]=useState<"gift"|"buy"|null>(null);
 if(!enabled)return null;
 const item=halloweenItemForAsset(assetKey);if(!item)return null;
 const owned=account?.state.owned.includes(item.id),equipped=account?.state.equipped[item.category]===item.id;
 const gift=seasonActive&&!!account&&!account.state.giftItemId&&item.gift&&!owned;
 const ready=account?.claimable.includes(item.id);
 const action=owned?"equip":gift?"gift":item.reward?"claim":"buy";
 const label=!seasonActive&&!owned?"انتهى الموسم":equipped?"مجهز ✓":owned?"تجهيز":gift?"اختر هذه الهدية":item.reward?ready?"استلم المكافأة":"مكافأة مقفلة":`${item.price} عملة`;
 const disabled=busy||!account||(!owned&&!seasonActive)||!!equipped||(!owned&&!!item.reward&&!ready);
 return <View style={{gap:6,width:"100%"}}>
   {item.reward?<Text style={s.condition}>{halloweenObjective(item.reward.type,item.reward.key,profile,profile.halloween2026).description}</Text>:null}
   {confirm ? <View style={{gap:6}}><Text style={s.condition}>{confirm==="gift"?"هدية واحدة فقط: أكّد اختيارك":`تأكيد صرف ${item.price} عملة؟`}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={async()=>{const type=confirm;setConfirm(null);await act({type,itemId:item.id});}} style={[s.button,compact&&{padding:6,minHeight:44,borderRadius:9}]}><Text style={[s.buttonText,compact&&{fontSize:11,lineHeight:16,textAlign:"center"}]}>تأكيد {item.name}</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>setConfirm(null)}><Text style={s.condition}>رجوع</Text></Pressable></View>
    : <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${item.name}`} disabled={disabled} onPress={async()=>{if(action==="gift")router.push("/halloween");else if(action==="buy")setConfirm(action);else await act({type:action,itemId:item.id});}} style={[s.button,compact&&{padding:6,minHeight:44,borderRadius:9},disabled&&{opacity:0.5}]}><Text style={[s.buttonText,compact&&{fontSize:11,lineHeight:16,textAlign:"center"}]}>{label}</Text></Pressable>}
   {equipped?<Pressable accessibilityRole="button" disabled={busy} onPress={()=>void act({type:"unequip",category:item.category})}><Text style={s.condition}>إزالة {item.name}</Text></Pressable>:null}
 </View>;
}

export function HalloweenEntry({compact=false}:{compact?:boolean}={}){
 const {enabled,seasonActive,account}=useHalloweenAccount();if(!enabled||!seasonActive)return null;
 return <Pressable accessibilityRole="button" accessibilityLabel="دخول موسم هالوين" onPress={()=>router.push("/halloween")} style={[s.banner,{overflow:"hidden",minHeight:compact?72:134,gap:compact?3:12,justifyContent:"center"}]}>
   <Image source={require("../assets/seasonal/halloween-preview/backgrounds/backgrounds_01.png")} resizeMode="cover" style={[StyleSheet.absoluteFill,{width:"100%",height:"100%",opacity:0.42}]}/>
   <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:"rgba(25,11,40,0.5)"}]}/>
   {!compact&&<Text style={{color:"#D7B6F7",fontFamily:"Cairo_700Bold",fontSize:10}}>موسم خاص · حروف المغرب</Text>}
   <Text style={[s.title,{fontSize:22}]}>🎃 موسم هالوين</Text>
   {!compact&&<Text style={s.note}>{account?.state.giftItemId?"أكمل مجموعتك بالعملات ومكافآت المهام والإنجازات":"اختر هدية البداية واكتشف مظاهر الموسم ومكافآته"}</Text>}
   <HalloweenCountdown/>
   <Text style={[s.link,{alignSelf:"flex-end"}]}>دخول الموسم ←</Text>
 </Pressable>;
}

export function HalloweenAccountStatus({compact=false}:{compact?:boolean}={}){
 const {enabled,seasonActive,account,busy,error,refresh}=useHalloweenAccount();
 useFocusEffect(useCallback(()=>{if(enabled&&(seasonActive||!!account?.state.owned.length))void refresh();},[enabled,seasonActive,account?.state.owned.length,refresh]));
 if(!enabled||(!seasonActive&&!account?.state.owned.length))return null;
 if(compact)return <View style={{gap:4}}><View style={{minHeight:44,flexDirection:"row-reverse",alignItems:"center",justifyContent:"space-between",gap:10}}><Text style={s.note}>{account?"العناصر المملوكة: "+account.state.owned.length+(account.local?" · محفوظة على الجهاز":""):"المجموعة غير متاحة"}</Text><Pressable accessibilityRole="button" accessibilityLabel="تحديث المجموعة" disabled={busy} onPress={()=>void refresh()} style={{minHeight:44,justifyContent:"center",paddingHorizontal:8}}><Text style={s.link}>{busy?"جارٍ التحديث…":"تحديث"}</Text></Pressable></View>{error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}</View>;

 return <View style={[s.banner,compact&&{padding:10,gap:5,marginVertical:0}]}>
  {!compact&&<Text style={s.title}>{account?.local?"مجموعتك المحفوظة على الجهاز":"هالوين · مجموعتك"}</Text>}
  <Text style={s.note}>{account?`الرصيد: ${account.coins} عملة · ${account.state.owned.length} عنصر مملوك`:busy?"تحميل المجموعة…":"المجموعة غير متاحة"}</Text>
  {seasonActive&&account&&!account.state.giftItemId?<Pressable accessibilityRole="button" onPress={()=>router.push("/halloween")}><Text style={s.link}>اختر هديتك المجانية من أربع بطاقات</Text></Pressable>:null}
  {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void refresh()}><Text style={s.link}>تحديث المجموعة</Text></Pressable>
 </View>;
}

export function HalloweenRewards({source}:{source:"task"|"achievement"}){
 const {enabled,seasonActive,account,refresh}=useHalloweenAccount();
 useFocusEffect(useCallback(()=>{if(enabled)void refresh();},[enabled,refresh]));
 if(!enabled||!seasonActive)return null;
 return <View style={s.banner}><Text style={s.title}>{source==="task"?"مهام هالوين":"إنجازات هالوين"}</Text><Text style={s.note}>تحديات خاصة بالموسم. يبدأ عدّ المباريات والانتصارات والنقاط من أول دخول للموسم في هذا التحديث. استلم المظهر مباشرة هنا؛ لا تحتاج إلى استلام مهمة عادية.</Text><View style={s.grid}>{HALLOWEEN_ITEMS.filter(item=>item.reward?.type===source).map(item=><RewardTile key={item.id} item={item} owned={!!account?.state.owned.includes(item.id)} />)}</View></View>;
}
function RewardTile({item,owned}:{item:SeasonItem;owned:boolean}){
 const {profile}=usePlayer();
 const goal=item.reward?halloweenObjective(item.reward.type,item.reward.key,profile,profile.halloween2026):null;
 const image=HALLOWEEN_PREVIEW_ASSETS.find(asset=>asset.previewKey===item.assetKey);
 return <View style={s.tile}>{goal?<><Text style={s.title}>{goal.title}</Text><Text accessibilityLabel={`التقدم ${goal.progress} من ${goal.target}`} style={s.condition}>{goal.progress} / {goal.target}</Text></>:null}{image?<View style={{height:76,alignItems:"center",justifyContent:"center"}}>{item.category==="frame"?<HalloweenFrame asset={image} size={70}/>:item.category==="nameplate"?<HalloweenPlateArtwork name="اسم اللاعب" assetOverride={image} width={150}/>:<Image source={image.source} accessibilityLabel={item.name} style={{width:66,height:66}} resizeMode="contain"/>}</View>:null}<Text style={s.note}>{item.name}{owned?" ✓":""}</Text><HalloweenAcquireButton assetKey={item.assetKey}/></View>;
}

export function HalloweenWelcome({ onSelectGift }: { onSelectGift?: () => void }){
 const {enabled,seasonActive,account}=useHalloweenAccount();if(!enabled||!account)return null;
 if(!seasonActive)return <View style={s.banner}><Text style={s.title}>انتهى موسم هالوين</Text><Text style={s.note}>مظاهرك المكتسبة محفوظة على هذا الجهاز، ويمكنك تجهيزها من المتجر.</Text><Pressable accessibilityRole="button" onPress={()=>router.push("/store")} style={s.button}><Text style={s.buttonText}>فتح مجموعتي</Text></Pressable></View>;
 if(!account.state.giftItemId)return <View style={s.banner}><HalloweenGiftCards onSelectGift={onSelectGift}/></View>;
 return <View style={s.banner}><Text style={s.title}>{account.state.giftItemId?"تم حفظ هدية البداية ✓":"مرحباً بك في هالوين! اختر هدية واحدة"}</Text><Text style={s.note}>تُحفظ المظاهر التي تربحها أو تشتريها في مجموعتك، ويمكنك تجهيزها من المتجر.</Text>
 <Pressable accessibilityRole="button" onPress={()=>router.push("/store")} style={s.button}><Text style={s.buttonText}>المتجر والمجموعة</Text></Pressable></View>;
}
const s=StyleSheet.create({banner:{padding:16,borderRadius:20,borderWidth:1,borderColor:"#8B6A4E",backgroundColor:"#291B36",gap:12,marginVertical:8},title:{fontFamily:"Cairo_700Bold",fontSize:16,color:"#FFE6A5"},note:{fontFamily:"Cairo_400Regular",fontSize:12,color:"#DDCEE9"},condition:{fontFamily:"Cairo_400Regular",fontSize:11,color:"#D8C6E8",textAlign:"center"},button:{padding:10,borderRadius:12,backgroundColor:"#F2C773",alignItems:"center"},buttonText:{fontFamily:"Cairo_700Bold",fontSize:12,color:"#241139"},link:{fontFamily:"Cairo_600SemiBold",fontSize:12,color:"#FFD489"},error:{color:"#FFB6C5",fontFamily:"Cairo_400Regular",fontSize:12},grid:{flexDirection:"row",flexWrap:"wrap",gap:10},tile:{flexBasis:"45%",flexGrow:1,minWidth:130,maxWidth:240,padding:10,borderRadius:16,backgroundColor:"#332044",gap:8}});
