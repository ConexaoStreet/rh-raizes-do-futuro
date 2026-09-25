import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
const DEFAULT_ALLOWED_ORIGINS=new Set(['https://ti-raizes-do-futuro.vercel.app','https://rh-raizes-do-futuro.vercel.app','http://127.0.0.1:4174','http://localhost:4174','http://127.0.0.1:4173','http://localhost:4173'])
const allowedOrigins=()=>new Set([...DEFAULT_ALLOWED_ORIGINS,...(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean)])
const required=(name:string)=>{const value=Deno.env.get(name);if(!value)throw new Error('CONFIGURATION_REQUIRED');return value}
const headers=(origin:string)=>({'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json'})
async function hashCode(userId:string,sessionId:string,code:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(required('OTP_HMAC_SECRET')),{name:'HMAC',hash:'SHA-256'},false,['sign']);const result=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${userId}:${sessionId}:${code}`));return Array.from(new Uint8Array(result)).map(n=>n.toString(16).padStart(2,'0')).join('')}
function generateCode(){const buffer=new Uint32Array(1);let n:number;do{crypto.getRandomValues(buffer);n=buffer[0]}while(n>=4294000000);return String(n%1000000).padStart(6,'0')}
function tokenClaims(token:string){try{const part=token.split('.')[1];if(!part)return null;const encoded=part.replaceAll('-','+').replaceAll('_','/');const padded=encoded.padEnd(encoded.length+((4-(encoded.length%4))%4),'=');return JSON.parse(atob(padded)) as {sub?:string,session_id?:string,amr?:{method:string}[]}}catch{return null}}
Deno.serve(async request=>{
 const origin=request.headers.get('origin')||''
 const allowed=allowedOrigins()
 if(!allowed.has(origin))return new Response(null,{status:403})
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)})
 if(request.method!=='POST')return new Response(null,{status:405,headers:headers(origin)})
 const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:headers(origin)})
 try{
  const token=(request.headers.get('authorization')||'').replace(/^Bearer /i,'')
  if(!token)return respond({error:'FORBIDDEN'},401)
  const auth=createClient(required('SUPABASE_URL'),required('SUPABASE_ANON_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:{user},error}=await auth.auth.getUser(token)
  if(error||!user||!user.email||!user.email_confirmed_at)return respond({error:'FORBIDDEN'},401)
  const claims=tokenClaims(token)
  if(!claims||claims.sub!==user.id||!claims.session_id||!claims.amr?.some(item=>item.method==='password'))return respond({error:'PASSWORD_LOGIN_REQUIRED'},403)
  if(Number(request.headers.get('content-length')||0)>2048)return respond({error:'INVALID_REQUEST'},400)
  const text=await request.text();if(text.length>2048)return respond({error:'INVALID_REQUEST'},400)
  const body=JSON.parse(text) as {action?:string,code?:string}
  const admin=createClient(required('SUPABASE_URL'),required('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
  if(body.action==='send'){
   required('RESEND_API_KEY');required('EMAIL_FROM')
   const code=generateCode();const codeHash=await hashCode(user.id,claims.session_id,code)
   const {data,error:issueError}=await admin.rpc('issue_otp',{user_identifier:user.id,session_identifier:claims.session_id,hash_value:codeHash})
   if(issueError)return respond({error:'FORBIDDEN'},403)
   if(!data.ok)return respond({error:data.error},429)
   const html=`<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#07110d;font-family:Arial,Helvetica,sans-serif;color:#eef7f1"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#07110d;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#0d1f17;border:1px solid #234433;border-radius:20px;overflow:hidden"><tr><td style="padding:32px 36px 22px;background:linear-gradient(135deg,#0b1a13,#153827);border-bottom:1px solid #234433"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#9bc8a9;font-weight:700">Raízes do Futuro · Segurança</div><div style="font-size:30px;line-height:1.1;font-weight:800;color:#fff;margin-top:12px">Confirme seu acesso</div><div style="font-size:15px;line-height:1.6;color:#b7cbbd;margin-top:10px">Use o código abaixo para concluir sua verificação.</div></td></tr><tr><td style="padding:30px 36px"><div style="text-align:center;padding:24px;border:1px solid #2b4d3a;border-radius:14px;background:#10271d"><div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#86b796;font-weight:700">Código de verificação</div><div style="font-size:38px;letter-spacing:8px;font-weight:900;color:#fff;margin-top:12px">${code}</div><div style="font-size:13px;color:#7f9988;margin-top:12px">Válido por 5 minutos.</div></div><div style="font-size:13px;line-height:1.6;color:#8fa69a;margin-top:24px">Não compartilhe este código. A equipe Raízes do Futuro nunca pedirá este código por mensagem ou telefone.</div></td></tr><tr><td style="padding:18px 36px 26px;border-top:1px solid #1d392b;font-size:12px;color:#6e8977">Equipe de Tecnologia · Raízes do Futuro</td></tr></table></td></tr></table></body></html>`;
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${required('RESEND_API_KEY')}`,'Content-Type':'application/json','Idempotency-Key':data.challenge_id},body:JSON.stringify({from:required('EMAIL_FROM'),to:[user.email],subject:'Seu código de acesso | Raízes do Futuro',text:`Seu código de verificação é ${code}. Ele vale por 5 minutos. Não compartilhe este código.`,html})})
   if(!response.ok)return respond({error:'EMAIL_DELIVERY_FAILED'},502)
   return respond({ok:true,masked_email:user.email[0]+'***@'+user.email.split('@')[1],retry_after:60})
  }
  if(body.action==='verify'&&/^\d{6}$/.test(body.code||'')){
   const {data,error:verifyError}=await admin.rpc('verify_otp',{user_identifier:user.id,session_identifier:claims.session_id,hash_value:await hashCode(user.id,claims.session_id,body.code!)})
   if(verifyError||!data?.ok)return respond({error:'INVALID_CODE'},400)
   return respond({ok:true})
  }
  return respond({error:'INVALID_REQUEST'},400)
 }catch{return respond({error:'UNAVAILABLE'},503)}
})
