// Local UI fixtures only. Never imports the production database or production routes.
import express from "express";
import {createServer} from "node:http";
import {io as createClient} from "socket.io-client";
import {registerLocalFriendsRooms} from "../server/friends-room-local";

const app=express(),http=createServer(app),profiles=new Map<string,Record<string,unknown>>(),identities=new Map<string,string>();
app.use((req,res,next)=>{res.setHeader("Access-Control-Allow-Origin","http://localhost:8084");res.setHeader("Access-Control-Allow-Headers","Content-Type,Authorization");res.setHeader("Access-Control-Allow-Methods","GET,POST,PUT,PATCH,OPTIONS");if(req.method==="OPTIONS"){res.sendStatus(204);return;}next();});app.use(express.json());
const service=registerLocalFriendsRooms(app,http,{initialOnlineCoins:2000});
service.io.on("connection",socket=>{const token=socket.handshake.auth?.token;if(typeof token==="string")identities.set(token,socket.data.playerId);});
const profile=(id:string)=>{if(!profiles.has(id))profiles.set(id,{id,name:"مستكشف الحروف",coins:2000,xp:680,level:4,totalScore:3400,gamesPlayed:42,wins:28,bestStreak:6,playerTag:7154,ownedSkins:["student","djellaba"],equippedSkin:"student",ownedCosmetics:{frame:["basic_frame"],background:["basic_background"],nameplate:["basic_nameplate"],victory:["no_victory_effect"],seasonal:["no_seasonal"]},equippedCosmetics:{frame:"basic_frame",background:"basic_background",nameplate:"basic_nameplate",victory:"no_victory_effect",seasonal:"no_seasonal"}});return profiles.get(id)!;};
app.post('/api/game-wallet/initialize',async(req,res)=>{const token=req.get('authorization')?.replace(/^Bearer /,'');if(!token)return res.status(401).json({error:'unauthorized'});let id=identities.get(token);if(!id){try{id=await new Promise<string>((resolve,reject)=>{const socket=createClient('http://127.0.0.1:39888',{autoConnect:false,transports:['websocket'],reconnection:false,auth:{token,displayName:'UI fixture'}});const timer=setTimeout(()=>{socket.disconnect();reject(Error('timeout'));},3000);socket.once('session:ready',data=>{clearTimeout(timer);socket.disconnect();resolve(data.playerId);});socket.once('connect_error',()=>{clearTimeout(timer);socket.disconnect();reject(Error('unauthorized'));});socket.connect();});}catch{return res.status(401).json({error:'unauthorized'});}}return res.json({playerId:id,coins:profile(id).coins,name:profile(id).name,unified:true});});
app.get('/api/player/:id',(req,res)=>res.json(profile(String(req.params.id))));
app.put('/api/player/:id',(req,res)=>res.json(Object.assign(profile(String(req.params.id)),req.body)));
app.patch('/api/player/change-name',(req,res)=>{const name=String(req.body.new_name??'').trim();if(name.length<2)return res.status(400).json({error:'invalid_name'});profile(String(req.body.player_id)).name=name;res.json({success:true,name});});
app.post('/api/player/:id/daily-login',(_req,res)=>res.json({success:false}));
app.get('/api/player/:id/notifications',(_req,res)=>res.json({enabled:false}));
app.get('/api/referral/:id',(_req,res)=>res.json({referralCode:'',referralEligible:false,referralCount:0}));
app.get('/api/tasks/:id',(_req,res)=>res.json([
 {key:'ui-play',titleAr:'العب 3 مباريات',descAr:'أكمل المباريات حتى النهاية',target:3,progress:2,completed:false,claimed:false,rewardCoins:100,rewardXp:20,type:'games'},
 {key:'ui-score',titleAr:'اجمع 500 نقطة',descAr:'تقدم عبر الأجوبة الصحيحة',target:500,progress:350,completed:false,claimed:false,rewardCoins:150,rewardXp:30,type:'score'},
 {key:'ui-win',titleAr:'حقق انتصارين',descAr:'اربح مباراتين',target:2,progress:2,completed:true,claimed:false,rewardCoins:200,rewardXp:40,type:'wins'},
 {key:'ui-week',titleAr:'تحدي الأسبوع',descAr:'أكمل 10 مباريات',target:10,progress:4,completed:false,claimed:false,rewardCoins:300,rewardXp:50,type:'games',isWeekly:true},
]));
app.get('/api/achievements/:id',(_req,res)=>res.json([{key:'ui-first',titleAr:'خبير الكلمات',descAr:'اجمع 1000 نقطة',target:1000,progress:1000,unlocked:true,claimed:true,rewardCoins:150,rewardXp:20},{key:'ui-ten',titleAr:'بطل المنافسة',descAr:'حقق 10 انتصارات',target:10,progress:6,unlocked:false,claimed:false,rewardCoins:300,rewardXp:40}]));
app.all('/api/{*rest}',(_req,res)=>res.status(503).json({error:'ui_preview_only'}));
http.listen(39888,'127.0.0.1',()=>console.log('Isolated UI fixtures at http://127.0.0.1:39888; no production connections.'));
