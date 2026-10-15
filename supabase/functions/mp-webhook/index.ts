import { createClient } from 'npm:@supabase/supabase-js@2';
const adminKey=()=>Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default;
const hex=(array:ArrayBuffer)=>Array.from(new Uint8Array(array)).map(x=>x.toString(16).padStart(2,'0')).join('');
async function signed(req:Request,id:string){
 const h=req.headers.get('x-signature')||'';const requestId=req.headers.get('x-request-id')||'';
 const ts=h.match(/(?:^|,)ts=([^,]+)/)?.[1];const v1=h.match(/(?:^|,)v1=([^,]+)/)?.[1];
 const secret=Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');if(!ts||!v1||!requestId||!secret)return false;
 if(Math.abs(Date.now()-Number(ts)*1000)>10*60_000)return false;
 const payload=`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const check=hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)));
 return check.length===v1.length&&check.split('').reduce((ok,c,i)=>ok|(c.charCodeAt(0)^v1.charCodeAt(i)),0)===0;
}
Deno.serve(async(req)=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 try {
 const incoming=new URL(req.url);const body=await req.json().catch(()=>({}));
 const paymentId=String(incoming.searchParams.get('data.id')||body?.data?.id||'');
 if(!/^\d+$/.test(paymentId))return new Response('Ignored',{status:200});
 if(!await signed(req,paymentId))return new Response('Unauthorized',{status:401});
 const token=Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')!;
 const response=await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`,{headers:{Authorization:`Bearer ${token}`}});
 if(!response.ok)return new Response('Retry',{status:503});
 const payment=await response.json();const ref=payment.external_reference;
 if(!/^[0-9a-f-]{36}$/i.test(ref||''))return new Response('Ignored',{status:200});
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,adminKey(),{auth:{persistSession:false}});
 const {data:order,error}=await admin.from('mp_orders').select('*').eq('id',ref).single();if(error||!order)return new Response('Unknown order',{status:200});
 if(String(payment.currency_id)!=='MXN'||Number(payment.transaction_amount)!==Number(order.amount))return new Response('Amount mismatch',{status:400});
 if(payment.status==='approved'){
   if(order.status==='approved')return new Response('OK',{status:200});
   if(order.status==='expired'||order.status==='failed'){await admin.from('mp_orders').update({status:'review',mp_payment_id:paymentId}).eq('id',order.id);return new Response('OK',{status:200});}
   // Puede necesitar revisión si expiró o se ocupó durante una transición.
   const {data:occupied}=await admin.from('appointments').select('id').eq('fecha',order.fecha).eq('hora_inicio',order.hora_inicio).neq('status','cancelada').limit(1);
   if(occupied?.length){await admin.from('mp_orders').update({status:'review',mp_payment_id:paymentId}).eq('id',order.id);return new Response('OK',{status:200});}
   const {data:appt,error:ae}=await admin.from('appointments').insert({user_id:order.user_id,therapy_id:order.therapy_id,slot_id:null,fecha:order.fecha,hora_inicio:order.hora_inicio,hora_fin:order.hora_fin,status:'confirmada'}).select('id').single();
   if(ae){console.error(ae);await admin.from('mp_orders').update({status:'review',mp_payment_id:paymentId}).eq('id',order.id);return new Response('OK',{status:200});}
   await admin.from('mp_orders').update({status:'approved',mp_payment_id:paymentId,appointment_id:appt.id}).eq('id',order.id);
 } else if(['rejected','cancelled','refunded','charged_back'].includes(payment.status)) {
   await admin.from('mp_orders').update({status:payment.status==='refunded'?'refunded':'rejected',mp_payment_id:paymentId}).eq('id',order.id).neq('status','approved');
 }
 return new Response('OK',{status:200});
 } catch(e){console.error(e);return new Response('Retry',{status:500});}
});
