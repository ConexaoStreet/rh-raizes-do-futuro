import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
const required=(name:string)=>{const value=Deno.env.get(name);if(!value)throw new Error('CONFIGURATION_REQUIRED');return value}
const headers=(origin:string)=>({'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json'})
async function hashCode(userId:string,sessionId:string,code:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(required('OTP_HMAC_SECRET')),{name:'HMAC',hash:'SHA-256'},false,['sign']);const result=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${userId}:${sessionId}:${code}`));return Array.from(new Uint8Array(result)).map(n=>n.toString(16).padStart(2,'0')).join('')}
function generateCode(){const buffer=new Uint32Array(1);let n:number;do{crypto.getRandomValues(buffer);n=buffer[0]}while(n>=4294000000);return String(n%1000000).padStart(6,'0')}
Deno.serve(async request=>{
 const origin=request.headers.get('origin')||''
 const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean)
 if(!allowed.includes(origin))return new Response(null,{status:403})
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)})
 if(request.method!=='POST')return new Response(null,{status:405,headers:headers(origin)})
 const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:headers(origin)})
 try{
  const token=(request.headers.get('authorization')||'').replace(/^Bearer /i,'')
  if(!token)return respond({error:'FORBIDDEN'},401)
  const auth=createClient(required('SUPABASE_URL'),required('SUPABASE_ANON_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:{user},error}=await auth.auth.getUser(token)
  if(error||!user||!user.email||!user.email_confirmed_at)return respond({error:'FORBIDDEN'},401)
  const encoded=token.split('.')[1].replaceAll('-','+').replaceAll('_','/')
  const claims=JSON.parse(atob(encoded)) as {sub:string,session_id?:string,amr?:{method:string}[]}
  if(claims.sub!==user.id||!claims.session_id||!claims.amr?.some(item=>item.method==='password'))return respond({error:'PASSWORD_LOGIN_REQUIRED'},403)
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
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${required('RESEND_API_KEY')}`,'Content-Type':'application/json','Idempotency-Key':data.challenge_id},body:JSON.stringify({from:required('EMAIL_FROM'),to:[user.email],subject:'Seu código de acesso | Raízes do Futuro',text:`Seu código de verificação é ${code}. Ele vale por 5 minutos. Não compartilhe este código.`})})
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
