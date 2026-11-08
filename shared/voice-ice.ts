export type VoiceIceServer={urls:string[];username?:string;credential?:string};
export function parseVoiceIce(value:unknown):VoiceIceServer[]{
 if(!Array.isArray(value))return [];
 return value.slice(0,8).flatMap(server=>{
  if(!server||typeof server!=='object')return [];
  const row=server as Record<string,unknown>,urls=(Array.isArray(row.urls)?row.urls:[row.urls]).filter((url):url is string=>typeof url==='string'&&url.length<=500&&/^(stun|stuns|turn|turns):[a-zA-Z0-9.[\]:_-]+(?:\?transport=(udp|tcp))?$/.test(url));
  if(!urls.length)return [];
  if(urls.some(url=>/^turns?:/.test(url))){if(typeof row.username!=='string'||row.username.length>128||typeof row.credential!=='string'||row.credential.length>256)return [];return [{urls,username:row.username,credential:row.credential}];}
  return [{urls}];
 });
}
