import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { socialProfiles } from "../shared/schema";
import { isRetiredPlayerName } from "../shared/game-player-name";
import { db } from "./db";

export async function safeOnlineDisplayName(playerId:string,requested?:string):Promise<string>{
 const name=requested?.trim().replace(/[<>]/g,"");
 if(name&&!isRetiredPlayerName(name))return name;
 const [existing]=await db.select({name:socialProfiles.displayName}).from(socialProfiles).where(eq(socialProfiles.playerId,playerId)).limit(1);
 if(existing?.name&&!isRetiredPlayerName(existing.name))return existing.name;
 return `Najm_${randomBytes(6).toString("hex")}`;
}
