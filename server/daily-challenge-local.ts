import type { Express } from "express";
import { DatabaseSync } from "node:sqlite";
export type DailyColor = {letter:string;status:"correct"|"present"|"absent"};
export function colorDailyGuess(guess:string,target:string):DailyColor[]{
 const chars=[...target],used=chars.map(()=>false),result:DailyColor[]=[...guess].map(letter=>({letter,status:"absent"}));
 result.forEach((cell,i)=>{if(cell.letter===chars[i]){cell.status="correct";used[i]=true;}});
 result.forEach(cell=>{if(cell.status==="correct")return;const i=chars.findIndex((letter,j)=>!used[j]&&letter===cell.letter);if(i>=0){used[i]=true;cell.status="present";}});return result;
}
export function localDailyWord(date:string):string{
 const words=["مفتاح","مصباح","حديقة","سفينة","نجمة","كتاب","قلم","مدينة","رسالة","شجرة","طاولة","تفاحة"];
 const day=Math.floor(Date.parse(date+"T00:00:00Z")/86400000);return words[((day%words.length)+words.length)%words.length];
}
export function registerLocalDailyChallenge(app:Express,file:string,now:()=>Date=()=>new Date()){
 const db=new DatabaseSync(file);
 db.exec("CREATE TABLE IF NOT EXISTS demo_daily_entries (player_id TEXT NOT NULL,date TEXT NOT NULL,guesses TEXT NOT NULL,started_at TEXT NOT NULL,PRIMARY KEY(player_id,date))");
 function state(playerId:string){const date=now().toISOString().slice(0,10),word=localDailyWord(date);const row=db.prepare("SELECT guesses,started_at FROM demo_daily_entries WHERE player_id=? AND date=?").get(playerId,date) as {guesses:string;started_at:string}|undefined;const guesses:string[]=row?JSON.parse(row.guesses):[];return {date,word,guesses,startedAt:row?.started_at??now().toISOString()};}
 function view(s:ReturnType<typeof state>){const won=s.guesses.includes(s.word),completed=won||s.guesses.length>=6;return {local:true,date:s.date,letter:[...s.word][0],wordLength:[...s.word].length,word:completed?s.word:null,entry:s.guesses.length?{guesses:s.guesses,coloring:s.guesses.map(g=>colorDailyGuess(g,s.word)),completed,won,guessCount:s.guesses.length,startedAt:s.startedAt}:null};}
 app.get("/api/daily-challenge",(req,res)=>{const id=req.query.playerId;if(typeof id!=="string"||!id||id.length>128)return res.status(400).json({error:"missing_params"});return res.json(view(state(id)));});
 app.post("/api/daily-challenge/guess",(req,res)=>{
  const {playerId,guess}=req.body;if(typeof playerId!=="string"||!playerId||playerId.length>128||typeof guess!=="string")return res.status(400).json({error:"missing_params"});
  db.exec("BEGIN IMMEDIATE");
  try{const s=state(playerId),before=view(s),trimmed=guess.trim();
   if(before.entry?.completed){db.exec("ROLLBACK");return res.status(400).json({error:"already_completed"});}
   if([...trimmed].length!==[...s.word].length){db.exec("ROLLBACK");return res.status(400).json({error:"wrong_length",expected:[...s.word].length});}
   if(!/^[\p{Script=Arabic}]+$/u.test(trimmed)||[...trimmed][0]!==[...s.word][0]){db.exec("ROLLBACK");return res.status(400).json({error:"invalid_guess"});}
   s.guesses.push(trimmed);
   db.prepare("INSERT INTO demo_daily_entries(player_id,date,guesses,started_at) VALUES (?,?,?,?) ON CONFLICT(player_id,date) DO UPDATE SET guesses=excluded.guesses").run(playerId,s.date,JSON.stringify(s.guesses),s.startedAt);
   const after=view(s);db.exec("COMMIT");return res.json({local:true,coloring:colorDailyGuess(trimmed,s.word),won:after.entry!.won,completed:after.entry!.completed,guessCount:s.guesses.length,word:after.word,coinsAwarded:0});
  }catch(error){db.exec("ROLLBACK");console.error("[local-daily]",error);return res.status(500).json({error:"server_error"});}
 });
 return ()=>db.close();
}
