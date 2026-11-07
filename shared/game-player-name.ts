export function isRetiredPlayerName(value:string):boolean{return /aissam/iu.test(value.normalize("NFKC"));}
export function playerNameKey(value:string):string{return value.normalize("NFKC").trim().replace(/\s+/gu," ").toLowerCase();}
