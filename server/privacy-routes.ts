import type {Express,Request} from 'express';
import type {CoinDatabase} from './coin-entry-ledger';
import {PRIVACY_TEXT,TERMS_TEXT,SUPPORT_EMAIL} from '../shared/privacy-content';
const escape=(text:string)=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function registerPrivacyRoutes(app:Express,deps:{database:CoinDatabase;authenticate:(req:Request)=>Promise<string|null>}){
 for(const [path,title,body] of [['/privacy','سياسة الخصوصية',PRIVACY_TEXT],['/terms','شروط الاستخدام',TERMS_TEXT],['/delete-data','طلب حذف البيانات',`لطلب حذف بيانات حروف المغرب، استخدم زر طلب حذف البيانات في إعدادات اللعبة، أو أرسل طلبك إلى ${SUPPORT_EMAIL} مع اسم اللاعب وكوده WM- إن كان متاحاً. لا ترسل رمز جلستك. نتحقق من ملكية الملف قبل المعالجة. إذا فقدت جهازك، وضّح ذلك في الرسالة. يشمل الطلب الملف والتقدم والعملات والمظاهر والرسائل والعلاقات المرتبطة؛ تُراجع السجلات المشتركة والنسخ الاحتياطية كما هو موضح في سياسة الخصوصية.`]])app.get(path,(_req,res)=>{
  res.set({'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'}).type('html').send(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · حروف المغرب</title><style>body{background:#171437;color:#fff0d6;font:18px/1.9 system-ui;max-width:760px;margin:40px auto;padding:20px}a{color:#6aefe1}p{white-space:pre-wrap}nav{display:flex;gap:18px;flex-wrap:wrap}</style><h1>حروف المغرب · ${escape(title)}</h1><p>${escape(body)}</p><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a><nav><a href="/privacy">الخصوصية</a><a href="/terms">الشروط</a><a href="/delete-data">حذف البيانات</a></nav></html>`);
 });
 app.post('/api/privacy/deletion-request',async(req,res)=>{try{
  const id=await deps.authenticate(req);if(!id)return res.status(401).json({error:'unauthorized'});
  if(req.body?.confirm!==true)return res.status(400).json({error:'confirmation_required'});
  const result=await deps.database.transaction(async tx=>{const owner=await tx.query('SELECT player_id FROM game_wallet_accounts WHERE player_id=$1 FOR UPDATE',[id]);if(!owner.rows.length)return null;const existing=(await tx.query("SELECT id,status,created_at FROM player_deletion_requests WHERE player_id=$1 AND status IN ('pending','processing')",[id])).rows[0];return existing??(await tx.query('INSERT INTO player_deletion_requests(player_id) VALUES($1) RETURNING id,status,created_at',[id])).rows[0];});
  return result?res.json({request:result,contact:SUPPORT_EMAIL}):res.status(403).json({error:'wallet_required'});
 }catch{return res.status(503).json({error:'privacy_unavailable'});}});
}
