'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const {createApp}=require('../server.cjs');
const cfg={SUPABASE_URL:'https://ejemplo.supabase.co', SUPABASE_PUBLISHABLE_KEY:'sb_publishable_solo_para_pruebas',ALLOWED_ORIGIN:'http://127.0.0.1:5502'};
function mockUpstream(url,opts={}){
  const p=new URL(url).pathname;
  if(p==='/auth/v1/user')return Promise.resolve(new Response(JSON.stringify({id:'usuario-test'}),{status:200,headers:{'content-type':'application/json'}}));
  if(p==='/rest/v1/therapies'){
    return Promise.resolve(new Response(JSON.stringify([{id:1,nombre:'Terapia prueba',slug:'terapia-prueba'}]),{status:200,headers:{'content-type':'application/json'}}));
  }
  if(p==='/rest/v1/appointments'&&opts.method==='POST')return Promise.resolve(new Response(JSON.stringify([{id:'123',status:'confirmada'}]),{status:201,headers:{'content-type':'application/json'}}));
  if(p==='/rest/v1/appointments'&&opts.method==='PATCH')return Promise.resolve(new Response(JSON.stringify([{id:'123',status:'cancelada'}]),{status:200,headers:{'content-type':'application/json'}}));
  if(p==='/rest/v1/appointments')return Promise.resolve(new Response(JSON.stringify([{id:'123',status:'confirmada'}]),{status:200,headers:{'content-type':'application/json'}}));
  return Promise.resolve(new Response('Not Found',{status:404}));
}
async function withServer(fn,upstream=mockUpstream){const server=http.createServer(createApp(cfg,upstream));await new Promise(r=>server.listen(0,'127.0.0.1',r));try{return await fn('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));}}
const TOKEN='Bearer '+('abc.abc.abc'.repeat(5));
test('GET /api/salud devuelve 200 y contrato uniforme',()=>withServer(async base=>{const r=await fetch(base+'/api/salud');assert.equal(r.status,200);assert.equal((await r.json()).ok,true);assert.equal(r.headers.get('x-content-type-options'),'nosniff');}));
test('GET /api/terapias devuelve lista JSON',()=>withServer(async base=>{const r=await fetch(base+'/api/terapias');const d=await r.json();assert.equal(r.status,200);assert.equal(d.total,1);assert.equal(d.data[0].nombre,'Terapia prueba');}));
test('GET /api/terapias/:id inválido devuelve 400',()=>withServer(async base=>{const r=await fetch(base+'/api/terapias/!!!');assert.equal(r.status,400);assert.equal((await r.json()).ok,false);}));
test('GET /api/desconocida devuelve 404 JSON',()=>withServer(async base=>{const r=await fetch(base+'/api/desconocida');assert.equal(r.status,404);assert.equal((await r.json()).error.codigo,'RUTA_NO_ENCONTRADA');}));
test('GET /no-existe devuelve 404 HTML personalizado',()=>withServer(async base=>{const r=await fetch(base+'/pagina-falsa');assert.equal(r.status,404);assert.match(r.headers.get('content-type'),/text\/html/);}));
test('.env no se puede descargar',()=>withServer(async base=>{const r=await fetch(base+'/.env');assert.equal(r.status,404);}));
test('CORS permite solo orígenes declarados',()=>withServer(async base=>{const a=await fetch(base+'/api/salud',{headers:{Origin:'http://127.0.0.1:5502'}});assert.equal(a.headers.get('access-control-allow-origin'),'http://127.0.0.1:5502');const b=await fetch(base+'/api/salud',{headers:{Origin:'http://malicioso.invalid'}});assert.equal(b.headers.get('access-control-allow-origin'),null);}));
test('GET /api/citas sin JWT devuelve 401',()=>withServer(async base=>{const r=await fetch(base+'/api/citas');assert.equal(r.status,401);}));
test('POST /api/citas inválida devuelve 400',()=>withServer(async base=>{const r=await fetch(base+'/api/citas',{method:'POST',headers:{Authorization:TOKEN,'Content-Type':'application/json'},body:JSON.stringify({fecha:'ayer'})});assert.equal(r.status,400);}));
test('POST /api/citas válida utiliza uid verificado y devuelve 201',()=>withServer(async base=>{const r=await fetch(base+'/api/citas',{method:'POST',headers:{Authorization:TOKEN,'Content-Type':'application/json'},body:JSON.stringify({therapy_id:'1',fecha:'2026-11-10',hora_inicio:'10:00',hora_fin:'11:00'})});assert.equal(r.status,201);assert.equal((await r.json()).data.id,'123');}));
test('DELETE /api/citas/:id devuelve 204',()=>withServer(async base=>{const r=await fetch(base+'/api/citas/123',{method:'DELETE',headers:{Authorization:TOKEN}});assert.equal(r.status,204);}));
test('servicio externo caído devuelve 503',()=>withServer(async base=>{const r=await fetch(base+'/api/terapias');assert.equal(r.status,503);},async()=>{throw Error('sin conexion')}));

test('POST /api/citas solapada se traduce a 409 sin crear cita',()=>withServer(async base=>{
  const r=await fetch(base+'/api/citas',{method:'POST',headers:{Authorization:TOKEN,'Content-Type':'application/json'},body:JSON.stringify({therapy_id:'1',fecha:'2026-11-10',hora_inicio:'11:30',hora_fin:'12:30'})});
  assert.equal(r.status,409);
  const d=await r.json();assert.equal(d.error.codigo,'HORARIO_OCUPADO');
},async (url,opts={})=>{
  const x=new URL(url).pathname;
  if(x==='/auth/v1/user')return new Response(JSON.stringify({id:'usuario-test'}),{status:200,headers:{'content-type':'application/json'}});
  if(x==='/rest/v1/appointments'&&opts.method==='POST')return new Response(JSON.stringify({code:'23P01',message:'Horario ocupado: ya existe otra cita confirmada que se superpone'}),{status:409,headers:{'content-type':'application/json'}});
  return mockUpstream(url,opts);
}));
