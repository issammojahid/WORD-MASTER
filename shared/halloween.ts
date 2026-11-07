export const HALLOWEEN_SEASON = "halloween_2026";
export const SEASON_CATEGORIES = ["avatar", "frame", "nameplate", "background", "victory", "icon"] as const;
export type SeasonCategory = typeof SEASON_CATEGORIES[number];
export type SeasonItem = { id: string; assetKey: string; category: SeasonCategory; name: string; price?: number; gift: boolean; reward?: { type: "task" | "achievement"; key: string; label: string } };
const names: Record<SeasonCategory,string[]> = {
 avatar:["ساحر الأطلس","ساحرة القمر","حارس الظلال","الشبح الودود","قط منتصف الليل","أمير اليقطين","روح الصحراء","الخيميائي الذهبي","حكيم القمر","رحّال الشفق"],
 frame:["هالة اليقطين","قمر الخفافيش","نجمة الزمرد","الحصاد الذهبي","الخفاش الوردي","نجمة الصقيع"],
 nameplate:["خط الجمشت","الفانوس الذهبي","تعويذة الزمرد","الشفق الوردي"],
 background:["الرياض المسحور","قصر القمر","الساحة البنفسجية","البوابة الذهبية"],
 victory:["سحر اليقطين","احتفال الأشباح","الوهج البنفسجي","التعويذة الذهبية"],
 icon:["اليقطين","الشبح","قبعة الساحرة","كتاب السحر","القمر","الفانوس","الجرعة السحرية","البلورة","الخفاش","المفتاح","النجمة","الحلوى"],
};
const rewards: Record<string,NonNullable<SeasonItem["reward"]>> = {
 avatar_07:{type:"task",key:"play_5",label:"العب 5 مباريات واستلم مكافأة المهمة"},avatar_08:{type:"task",key:"win_3",label:"اربح 3 مباريات واستلم مكافأة المهمة"},avatar_09:{type:"achievement",key:"win_10",label:"إنجاز 10 انتصارات"},avatar_10:{type:"achievement",key:"level_5",label:"إنجاز المستوى 5"},
 frame_05:{type:"task",key:"score_200",label:"مهمة اجمع 200 نقطة"},frame_06:{type:"achievement",key:"streak_3",label:"إنجاز 3 انتصارات متتالية"},nameplate_03:{type:"task",key:"play_3",label:"مهمة العب 3 مباريات"},nameplate_04:{type:"achievement",key:"first_win",label:"إنجاز أول انتصار"},
 background_03:{type:"task",key:"score_500",label:"مهمة اجمع 500 نقطة"},background_04:{type:"achievement",key:"play_10",label:"إنجاز 10 مباريات"},victory_03:{type:"task",key:"win_5",label:"مهمة اربح 5 مباريات"},victory_04:{type:"achievement",key:"win_25",label:"إنجاز 25 انتصاراً"},
 icon_09:{type:"task",key:"score_100",label:"مهمة اجمع 100 نقطة"},icon_10:{type:"task",key:"play_10",label:"مهمة العب 10 مباريات"},icon_11:{type:"achievement",key:"first_win",label:"إنجاز أول انتصار"},icon_12:{type:"achievement",key:"score_5000",label:"إنجاز 5000 نقطة"},
};
const basePrices:Record<SeasonCategory,number>={avatar:250,frame:220,nameplate:180,background:280,victory:260,icon:100};
export const HALLOWEEN_ITEMS:readonly SeasonItem[]=SEASON_CATEGORIES.flatMap(category=>names[category].map((name,index)=>{
 const suffix=`${category}_${String(index+1).padStart(2,"0")}`;
 const reward=rewards[suffix];
 return {id:`${HALLOWEEN_SEASON}_${suffix}`,assetKey:`halloween-preview-${category}-${String(index+1).padStart(2,"0")}`,category,name,gift:index===0&&(["avatar","frame","background","victory"] as string[]).includes(category),...(reward?{reward}:{price:basePrices[category]+index*(category==="icon"?30:100)})};
}));
export type SeasonState={owned:string[];equipped:Partial<Record<SeasonCategory,string>>;giftItemId:string|null};
export const emptySeasonState=():SeasonState=>({owned:[],equipped:{},giftItemId:null});
export type SeasonSnapshot={coins:number;state:SeasonState;claimedTasks:string[];claimedAchievements:string[]};
export type SeasonAction={type:"enter"|"gift"|"buy"|"equip"|"claim"|"unequip";itemId?:string;category?:SeasonCategory};
export class SeasonError extends Error{constructor(public code:string,public status=400){super(code);}}
export function rewardEligible(item:SeasonItem,snapshot:SeasonSnapshot){return !!item.reward&&(item.reward.type==="task"?snapshot.claimedTasks:snapshot.claimedAchievements).includes(item.reward.key);}
export function seasonView(snapshot:SeasonSnapshot){return {...snapshot,claimable:HALLOWEEN_ITEMS.filter(item=>rewardEligible(item,snapshot)&&!snapshot.state.owned.includes(item.id)).map(item=>item.id)};}

// Pure transition. Repository adapters execute this under a per-player lock.
// Client prices, ownership, progress and wallet totals are never accepted.
export function applySeasonAction(snapshot:SeasonSnapshot,action:SeasonAction):SeasonSnapshot{
 const result:SeasonSnapshot={...snapshot,state:{...snapshot.state,owned:[...snapshot.state.owned],equipped:{...snapshot.state.equipped}}};
 if(action.type==="enter")return result;
 if(action.type==="unequip"){
   if(!action.category||!SEASON_CATEGORIES.includes(action.category))throw new SeasonError("invalid_category");
   delete result.state.equipped[action.category];return result;
 }
 const item=HALLOWEEN_ITEMS.find(item=>item.id===action.itemId);
 if(!item)throw new SeasonError("invalid_item");
 const owned=result.state.owned.includes(item.id);
 if(action.type==="equip"){
   if(!owned)throw new SeasonError("not_owned",403);
   result.state.equipped[item.category]=item.id;return result;
 }
 if(action.type==="gift"){
   if(result.state.giftItemId){if(result.state.giftItemId===item.id)return result;throw new SeasonError("gift_already_claimed",409);}
   if(!item.gift)throw new SeasonError("not_a_gift");
   if(owned)throw new SeasonError("already_owned",409);
   result.state.giftItemId=item.id;
 }else if(action.type==="buy"){
   if(item.price===undefined)throw new SeasonError("reward_only",403);
   if(owned)return result;
   if(!Number.isSafeInteger(result.coins)||result.coins<item.price)throw new SeasonError("insufficient_coins",402);
   result.coins-=item.price;
 }else if(action.type==="claim"){
   if(!rewardEligible(item,snapshot))throw new SeasonError("reward_locked",403);
   if(owned)return result;
 }else throw new SeasonError("invalid_action");
 result.state.owned.push(item.id);return result;
}
