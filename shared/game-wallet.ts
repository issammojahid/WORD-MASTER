export const STARTING_GAME_COINS=2000;
export const LEVEL_REWARD_VALUES=[{level:5,coins:300},{level:10,coins:500},{level:20,coins:1000}] as const;

export function gameLevel(xp:number):number{let level=1;while(xp>=100+(level-1)*70){xp-=100+(level-1)*70;level++;}return level;}
