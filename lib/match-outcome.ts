export type MatchOutcome='win'|'lose'|'draw';
export function rankedOutcome(own:{rank:number;forfeited?:boolean}|undefined,results:{rank:number;forfeited?:boolean}[]):MatchOutcome|null{
 if(!own)return null;
 if(own.forfeited||own.rank!==1)return 'lose';
 return results.filter(result=>result.rank===1&&!result.forfeited).length>1?'draw':'win';
}
