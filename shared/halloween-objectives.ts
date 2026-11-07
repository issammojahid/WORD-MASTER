import { HALLOWEEN_ITEMS } from "./halloween";
import { isHalloweenSeasonActive, type DeviceHalloween } from "./halloween-update";

export type HalloweenMetrics = { gamesPlayed:number; wins:number; totalScore:number; level:number; winStreak:number };
type Goal = { title:string; metric:keyof HalloweenMetrics; target:number; description:string };
const goals:Record<string,Goal> = {
 "task:play_3":{title:"جولة بين الفوانيس",metric:"gamesPlayed",target:3,description:"العب 3 مباريات بعد دخول الموسم"},
 "task:play_5":{title:"رحلة الأشباح",metric:"gamesPlayed",target:5,description:"العب 5 مباريات بعد دخول الموسم"},
 "task:play_10":{title:"ليلة المغامرات",metric:"gamesPlayed",target:10,description:"العب 10 مباريات بعد دخول الموسم"},
 "task:win_3":{title:"تحدي اليقطين",metric:"wins",target:3,description:"حقق 3 انتصارات بعد دخول الموسم"},
 "task:win_5":{title:"حارس القصر المسحور",metric:"wins",target:5,description:"حقق 5 انتصارات بعد دخول الموسم"},
 "task:score_100":{title:"شرارة السحر",metric:"totalScore",target:100,description:"اجمع 100 نقطة بعد دخول الموسم"},
 "task:score_200":{title:"تعويذة الفانوس",metric:"totalScore",target:200,description:"اجمع 200 نقطة بعد دخول الموسم"},
 "task:score_500":{title:"سر الساحة البنفسجية",metric:"totalScore",target:500,description:"اجمع 500 نقطة بعد دخول الموسم"},
 "achievement:first_win":{title:"بداية الساحر",metric:"wins",target:1,description:"حقق أول انتصار لك بعد دخول الموسم"},
 "achievement:win_10":{title:"بطل ليلة هالوين",metric:"wins",target:10,description:"حقق 10 انتصارات بعد دخول الموسم"},
 "achievement:win_25":{title:"أسطورة القصر",metric:"wins",target:25,description:"حقق 25 انتصاراً بعد دخول الموسم"},
 "achievement:play_10":{title:"رحّال عالم الأشباح",metric:"gamesPlayed",target:10,description:"العب 10 مباريات بعد دخول الموسم"},
 "achievement:score_5000":{title:"سيد التعويذات",metric:"totalScore",target:5000,description:"اجمع 5000 نقطة بعد دخول الموسم"},
 "achievement:level_5":{title:"حكيم القمر",metric:"level",target:5,description:"بلغ المستوى 5 خلال الموسم"},
 "achievement:streak_3":{title:"سلسلة الانتصارات المسحورة",metric:"winStreak",target:3,description:"حقق سلسلة من 3 انتصارات متتالية خلال الموسم"},
};
const count=(value:number)=>Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
export function halloweenObjective(source:"task"|"achievement",key:string,metrics:HalloweenMetrics,saved?:DeviceHalloween){
 const goal=goals[`${source}:${key}`];
 if(!goal)throw new Error("unknown_halloween_objective");
 const baseline=saved?.objectiveBaseline;
 const absolute=goal.metric==="level"||goal.metric==="winStreak";
 const progress=baseline?Math.min(goal.target,Math.max(0,count(metrics[goal.metric])-(absolute?0:count(baseline[goal.metric])))):0;
 const retained=(source==="task"?saved?.claimedTasks:saved?.claimedAchievements)?.includes(key)??false;
 return {...goal,progress:retained?goal.target:progress,completed:retained||progress>=goal.target};
}

// This update uses the existing local seasonal save; it never writes seasonal data to production.
export function prepareHalloweenObjectives(saved:DeviceHalloween|undefined,metrics:HalloweenMetrics,now=Date.now()):DeviceHalloween|undefined{
 if(!isHalloweenSeasonActive(now))return saved;
 const next:DeviceHalloween={
  state:saved?.state??{owned:[],equipped:{},giftItemId:null},
  claimedTasks:[...new Set(saved?.claimedTasks??[])],
  claimedAchievements:[...new Set(saved?.claimedAchievements??[])],
  walletPending:saved?.walletPending,
  objectiveBaseline:saved?.objectiveBaseline??Object.fromEntries(Object.entries(metrics).map(([key,value])=>[key,count(value)])) as HalloweenMetrics,
 };
 for(const item of HALLOWEEN_ITEMS){
  if(!item.reward)continue;
  const {type,key}=item.reward;
  if(halloweenObjective(type,key,metrics,next).completed){
   const claims=type==="task"?next.claimedTasks:next.claimedAchievements;
   if(!claims.includes(key))claims.push(key);
  }
 }
 return next;
}
