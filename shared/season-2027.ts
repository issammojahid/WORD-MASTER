import {SEASON_EVENTS,eventPhase,type SeasonEventId} from '../lib/season-calendar';
import {seasonPreviewItems,type SeasonCategory} from '../constants/season-catalog';

export const seasonInventoryId=(event:SeasonEventId)=>`season_2027_${event}`;
export const SEASON_2027_ITEMS=SEASON_EVENTS.flatMap(event=>seasonPreviewItems(event.id).map(art=>({
 id:`season_2027_${event.id}_${art.kind}_${art.variant+1}`,
 event:event.id,kind:art.kind,name:art.name,art,
 gift:art.variant===0&&(['avatar','frame','victory','icon'] as string[]).includes(art.kind),
 price:art.variant<3?[3000,18000,60000][art.variant]:null,
 objective:art.variant===3?{type:'task' as const,target:5,label:'أكمل 5 مباريات أونلاين خلال الحدث'}:art.variant===4?{type:'achievement' as const,target:3,label:'حقق 3 انتصارات أونلاين خلال الحدث'}:null,
})));
export type SeasonalItem=typeof SEASON_2027_ITEMS[number];
export function seasonalItem(id:unknown){return typeof id==='string'?SEASON_2027_ITEMS.find(item=>item.id===id):undefined;}
export type SeasonalState={owned:string[];equipped:Partial<Record<SeasonCategory,string>>;giftItemId:string|null};
export type SeasonalSnapshot={serverTime:string;enabled:boolean;coins:number;states:Partial<Record<SeasonEventId,SeasonalState>>;activeEvent:SeasonEventId|null;items:SeasonalItem[];progress:{games:number;wins:number};};
export function activeSeason(now:number){return SEASON_EVENTS.find(event=>eventPhase(event,now)==='active');}
export const emptySeasonalState=():SeasonalState=>({owned:[],equipped:{},giftItemId:null});
