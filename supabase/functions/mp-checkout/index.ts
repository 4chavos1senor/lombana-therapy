// Checkout Pro. Solo se usa la credencial secreta del lado servidor.
import { createClient } from 'npm:@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage','Access-Control-Allow-Methods':'POST, OPTIONS' };
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const adminKey=()=>Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default;
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return json({error:'Método no permitido'},405);
 try {
 const url=Deno.env.get('SUPABASE_URL')!;
 const service=adminKey();const token=Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
 const site=Deno.env.get('PUBLIC_SITE_URL');const webhook=Deno.env.get('MP_WEBHOOK_URL');
 if(!service||!token||!site||!webhook)throw new Error('Faltan secretos del servidor: Mercado Pago / URL pública');
 const jwt=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!jwt)return json({error:'Inicia sesión'},401);
 const admin=createClient(url,service,{auth:{persistSession:false}});
 const {data:ud,error:ue}=await admin.auth.getUser(jwt);if(ue||!ud.user)return json({error:'Sesión inválida'},401);
 const {therapy_id,fecha,hora_inicio}=await req.json();
 if(typeof therapy_id!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||!/^\d{2}:\d{2}:\d{2}$/.test(hora_inicio))return json({error:'Datos de la cita inválidos'},400);
 const {data:therapy,error:te}=await admin.from('therapies').select('id,nombre,precio,activo').eq('id',therapy_id).eq('activo',true).single();
 if(te||!therapy||!Number.isFinite(Number(therapy.precio))||Number(therapy.precio)<=0)return json({error:'No hay precio válido publicado para esta terapia'},400);
 const d=new Date(`${fecha}T${hora_inicio}-06:00`);if(!Number.isFinite(+d)||+d<=Date.now())return json({error:'El horario ya pasó'},400);
 const day=new Date(`${fecha}T12:00:00-06:00`).getUTCDay();const hour=Number(hora_inicio.slice(0,2));
 if(day===0||hour<9||hour>=(day===6?15:18)||hora_inicio.slice(3)!=='00:00')return json({error:'Horario fuera de atención'},400);
 const end=`${String(hour+1).padStart(2,'0')}:00:00`;
 // Libera únicamente órdenes sin pago después de 30 minutos; la confirmación real procede por webhook.
 await admin.from('mp_orders').update({status:'expired'}).eq('fecha',fecha).eq('hora_inicio',hora_inicio).eq('status','pending').lt('expires_at',new Date().toISOString());
 const {data:existing,error:ee}=await admin.from('appointments').select('id').eq('fecha',fecha).eq('hora_inicio',hora_inicio).neq('status','cancelada').limit(1);
 if(ee)throw ee;if(existing?.length)return json({error:'Horario ocupado, selecciona otro'},409);
 const {data:order,error:oe}=await admin.from('mp_orders').insert({user_id:ud.user.id,therapy_id:therapy.id,fecha,hora_inicio,hora_fin:end,amount:therapy.precio}).select('id').single();
 if(oe)return json({error:'Este horario está reservado temporalmente. Prueba con otro.'},409);
 const siteUrl = new URL(site.endsWith('/') ? site : site + '/');
 if(siteUrl.protocol!=='https:')throw new Error('PUBLIC_SITE_URL debe ser HTTPS público');
 const resultadoUrl=new URL('pago-resultado.html',siteUrl).href;
 const body={items:[{id:String(therapy.id),title:therapy.nombre,quantity:1,currency_id:'MXN',unit_price:Number(therapy.precio)}],external_reference:order.id,expires:true,expiration_date_from:new Date().toISOString(),expiration_date_to:new Date(Date.now()+30*60_000).toISOString(),back_urls:{success:resultadoUrl,pending:resultadoUrl,failure:resultadoUrl},notification_url:webhook,metadata:{order_id:order.id},payer:{email:ud.user.email}};
 const pref=await fetch('https://api.mercadopago.com/checkout/preferences',{method:'POST',headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json','X-Idempotency-Key':order.id},body:JSON.stringify(body)});
 const out=await pref.json();if(!pref.ok||!out.init_point){await admin.from('mp_orders').update({status:'failed'}).eq('id',order.id);return json({error:'Mercado Pago no pudo crear el pago'},502)}
 await admin.from('mp_orders').update({mp_preference_id:out.id}).eq('id',order.id);
 return json({checkout_url:out.init_point,order_id:order.id});
 }catch(e){console.error(e);return json({error:'No se pudo iniciar el pago. Revisa la configuración del servidor.'},500)}
});
