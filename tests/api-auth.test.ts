import test from 'node:test';
import assert from 'node:assert/strict';
import {installApiAuthentication,setApiBearer} from '../lib/api-auth';
test('bearer headers reach only the configured API, including Request objects and renewed sessions',async()=>{
 const original=globalThis.fetch;const calls:{input:unknown;init?:RequestInit}[]=[];
 globalThis.fetch=(async(input,init)=>{calls.push({input,init});return new Response('{}');}) as typeof fetch;
 try{
  installApiAuthentication('https://game.example/');setApiBearer('first');
  await fetch('https://game.example/api/player/a');
  await fetch('https://other.example/track');
  await fetch('https://game.example.evil.example/api/player/a');
  setApiBearer('renewed');await fetch(new Request('https://game.example/api/online/wallet',{headers:{'X-Test':'preserved'}}));
  assert.equal(new Headers(calls[0].init?.headers).get('Authorization'),'Bearer first');
  assert.equal(new Headers(calls[1].init?.headers).get('Authorization'),null);
  assert.equal(new Headers(calls[2].init?.headers).get('Authorization'),null);
  assert.equal(new Headers(calls[3].init?.headers).get('Authorization'),'Bearer renewed');
  assert.equal(new Headers(calls[3].init?.headers).get('X-Test'),'preserved');
  setApiBearer(null);await fetch('https://game.example/api/player/a');
  assert.equal(new Headers(calls[4].init?.headers).get('Authorization'),null);
 }finally{globalThis.fetch=original;setApiBearer(null);}
});
