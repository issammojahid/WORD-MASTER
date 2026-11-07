import { randomBytes } from "node:crypto";
import { isRetiredPlayerName,playerNameKey } from "../shared/game-player-name";
const words=["Atlas","Najm","Qamar","Sahara","Zellige","Batal"];
export function randomUnusedPlayerName(used:Set<string>):string{
 for(let n=0;n<100;n++){
  const word=words[randomBytes(1)[0]%words.length];
  const name=`${word}_${randomBytes(5).toString("hex")}`;
  if(!used.has(playerNameKey(name))){used.add(playerNameKey(name));return name;}
 }
 throw new Error("name_allocation_failed");
}
const nameFields=new Set(["name","displayName","playerName","winnerName","fromPlayerName","senderName","actorName","player1Name","player2Name"]);
export function cleanResultNames(value:unknown,replace:(name:string,playerId?:string)=>string):unknown{
 if(Array.isArray(value))return value.map(item=>cleanResultNames(item,replace));
 if(!value||typeof value!=="object")return value;
 const row=value as Record<string,unknown>;
 const playerId=typeof row.playerId==="string"?row.playerId:typeof row.id==="string"?row.id:undefined;
 return Object.fromEntries(Object.entries(row).map(([key,item])=>[
  key,nameFields.has(key)&&typeof item==="string"&&isRetiredPlayerName(item)?replace(item,playerId):cleanResultNames(item,replace),
 ]));
}
