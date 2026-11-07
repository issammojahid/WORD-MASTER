let apiOrigin="";
let bearer:string|null=null;
let installed=false;
export function setApiBearer(token:string|null){bearer=token;}
export function installApiAuthentication(origin:string){
 apiOrigin=new URL(origin).origin;if(installed)return;installed=true;
 const original=globalThis.fetch.bind(globalThis);
 globalThis.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
  if(bearer&&new URL(url,apiOrigin).origin===apiOrigin){
   const headers=new Headers(typeof input==='object'&&'headers' in input?input.headers:undefined);
   new Headers(init?.headers).forEach((value,key)=>headers.set(key,value));
   if(!headers.has('Authorization'))headers.set('Authorization',`Bearer ${bearer}`);
   return original(input,{...init,headers});
  }
  return original(input,init);
 };
}
