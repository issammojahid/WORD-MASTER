import { z } from "zod";
export type TeamId="sun"|"moon";
export type TeamMode="solo"|"duo";
export const friendRoomSettingsSchema=z.object({maxPlayers:z.union([z.literal(2),z.literal(4),z.literal(6),z.literal(8)]),rounds:z.union([z.literal(3),z.literal(5),z.literal(7)]),secondsPerRound:z.union([z.literal(45),z.literal(60),z.literal(90)]),teamMode:z.enum(["solo","duo"]).default("solo")}).strict().refine(s=>s.teamMode!=="duo"||s.maxPlayers===4,{message:"teams_require_four"});
export function privateRoomPayload(settings:{maxPlayers:number;rounds:number;secondsPerRound:number;teamMode?:TeamMode}){
 const parsed=friendRoomSettingsSchema.parse({maxPlayers:settings.maxPlayers,rounds:settings.rounds,secondsPerRound:settings.secondsPerRound,teamMode:settings.teamMode??"solo"});
 const {teamMode,...legacy}=parsed;
 // Legacy servers reject unknown fields. Solo rooms retain the original wire format.
 return teamMode==="duo"?{...legacy,teamMode}:legacy;
}
export const QUICK_MESSAGES=[{id:"ready",ar:"أنا مستعد",en:"I'm ready"},{id:"good_luck",ar:"حظاً موفقاً",en:"Good luck"},{id:"nice",ar:"أحسنت!",en:"Nice!"},{id:"thanks",ar:"شكراً",en:"Thanks"},{id:"wait",ar:"انتظر قليلاً",en:"One moment"},{id:"lets_go",ar:"لنبدأ!",en:"Let's go!"},{id:"sorry",ar:"آسف",en:"Sorry"},{id:"well_played",ar:"لعب رائع!",en:"Well played!"}] as const;
export type QuickMessageId=typeof QUICK_MESSAGES[number]["id"];
export type QuickRoomMessage={id:string;matchId:string;playerId:string;playerName:string;messageId:QuickMessageId;createdAt:number};
export const isQuickMessageId=(value:unknown):value is QuickMessageId=>QUICK_MESSAGES.some(m=>m.id===value);
export type TeamPlayer={id:string;score:number;teamId?:TeamId|null;abandoned?:boolean};
export function roomTeamAssignment(players:{id:string}[],mode:TeamMode|undefined):Map<string,TeamId|null>{return new Map(players.map((player,i)=>[player.id,mode==="duo"?(i%2===0?"sun":"moon"):null]));}
export function roomTeamsValid(players:TeamPlayer[]):boolean{return players.length===4&&players.filter(p=>p.teamId==="sun").length===2&&players.filter(p=>p.teamId==="moon").length===2;}
export function roomTeamScores(players:TeamPlayer[],mode:TeamMode|undefined){
 if(mode!=="duo")return [];
 const teams=(["sun","moon"] as const).map(id=>({id,score:players.filter(p=>p.teamId===id).reduce((sum,p)=>sum+p.score,0),playerIds:players.filter(p=>p.teamId===id).map(p=>p.id),forfeited:players.some(p=>p.teamId===id&&p.abandoned)}));
 return teams.map(team=>({...team,rank:1+teams.filter(other=>Number(other.forfeited)<Number(team.forfeited)||(other.forfeited===team.forfeited&&other.score>team.score)).length}));
}
export type RoomTeamScore=ReturnType<typeof roomTeamScores>[number];
