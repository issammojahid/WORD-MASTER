import { createServer } from "node:http";
import { registerLocalFriendsRooms } from "../server/friends-room-local";
import { registerLocalDailyChallenge } from "../server/daily-challenge-local";
import { DatabaseSync } from "node:sqlite";
import { cleanPlayerName } from "../shared/player-name";
import express from "express";
import { resolve } from "node:path";
import { registerHalloweenRoutes } from "../server/halloween-routes";
import { localHalloweenRepository } from "../server/halloween-local-store";
const file=process.env.HALLOWEEN_LOCAL_DB;
if(!file)throw new Error("HALLOWEEN_LOCAL_DB must name an isolated local demo SQLite file");
const app=express();
app.use((req,res,next)=>{res.setHeader("Access-Control-Allow-Origin","http://localhost:8082");res.setHeader("Access-Control-Allow-Headers","Content-Type,Authorization");res.setHeader("Access-Control-Allow-Methods","GET,POST,PATCH,OPTIONS");if(req.method==="OPTIONS"){res.sendStatus(204);return;}next();});
app.use(express.json({limit:"8kb"}));
const names = new DatabaseSync(resolve(file));
names.exec("CREATE TABLE IF NOT EXISTS demo_names (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE)");
app.patch("/api/player/change-name", (req,res) => {
  let name: string;
  try { name = cleanPlayerName(req.body.new_name); } catch { return res.status(400).json({error:"invalid_name"}); }
  const id=req.body.player_id;
  if(typeof id!=="string" || !id) return res.status(400).json({error:"missing_fields"});
  try {
    names.prepare("INSERT INTO demo_names(id,name,name_key) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,name_key=excluded.name_key").run(id,name,name.toLowerCase());
    return res.json({success:true,name});
  } catch {return res.status(409).json({error:"name_taken"});}
});
registerLocalDailyChallenge(app,resolve(file));
registerHalloweenRoutes(app,localHalloweenRepository(resolve(file)),{enabled:()=>true,local:true});
const httpServer=createServer(app);
registerLocalFriendsRooms(app,httpServer);
httpServer.listen(39999,"127.0.0.1",()=>console.log("Isolated Halloween demo API: http://127.0.0.1:39999 · 1000 test coins per new local player"));
