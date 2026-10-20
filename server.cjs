'use strict';
// API local de demostración: Node.js nativo, sin instalar frameworks adicionales.
// Todas las consultas a Supabase usan SOLO la clave publicable y el JWT del usuario:
// las políticas RLS siguen siendo la autorización real.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { readEnvironment } = require('./scripts/env.cjs');
const { handleSwaggerDocs } = require('./scripts/swagger-docs.cjs');
const { consultarSaludPostgres } = require('./scripts/postgresql.cjs');
const ROOT = __dirname;
const TYPES = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
const BAD_ID = /^[a-z0-9][a-z0-9-]{0,99}$/i;
const UUID_OR_INT = /^(?:\d+|[a-f0-9]{8}-[a-f0-9-]{27,36})$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const BODY_MAX = 100_000;
const htmlPages = new Set(['index.html','login.html','registro.html','terapias.html','terapia-detalle.html','agendar.html','mis-citas.html','admin.html','404.html','dashboard.html','establecer-contrasena.html','cita-confirmada.html','cita-demo.html','pago-resultado.html']);
const isText = (n) => Object.hasOwn(TYPES, path.extname(n).toLowerCase());
const cleanTime = v => typeof v === 'string' && TIME.test(v) ? (v.length === 5 ? v+':00':v) : null;
function validDate(s) {
  if(typeof s!=='string'||!DATE.test(s)) return false;
  const d = new Date(s+'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===s;
}
function HttpError(status, codigo, mensaje) { const err=new Error(mensaje);err.status=status;err.codigo=codigo;return err; }
function sendJson(res,status,value) {
  const buf = Buffer.from(JSON.stringify(value));
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':buf.length,'Cache-Control':'no-store'});
  res.end(buf);
}
function errorJson(res,e) { const status=(Number.isInteger(e.status) && e.status>=400 && e.status<=599)?e.status:500;sendJson(res,status,{ok:false,error:{codigo:e.codigo||(status===500?'ERROR_INTERNO':'ERROR'),mensaje: status>=500 ? (status===502?'El proveedor de datos devolvió un error':status===503?'El proveedor de datos no está disponible':'Ocurrió un error interno del servidor') :e.message}}); }
function parseBody(req) {
  return new Promise((resolve,reject)=>{
    const chunks=[];let bytes=0;let tooLarge=false;
    req.on('data',chunk=>{
      bytes+=chunk.length;
      if(bytes>BODY_MAX){tooLarge=true;return;}
      chunks.push(chunk);
    });
    req.on('end',()=>{
      if(tooLarge){reject(HttpError(413,'CUERPO_EXCESIVO','La petición supera el tamaño permitido'));return;}
      if(!req.headers['content-type']?.startsWith('application/json')){reject(HttpError(415,'TIPO_INCORRECTO','Envía Content-Type: application/json'));return;}
      try{
        const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(!data||typeof data!=='object'||Array.isArray(data))throw HttpError(400,'VALIDACION','El cuerpo debe ser un objeto JSON');
        resolve(data);
      }catch(err){reject(err.status?err:HttpError(400,'JSON_INVALIDO','El JSON no es válido'));}
    });
    req.on('error',reject);
  });
}
function secureHeaders(res, projectHost) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(self), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  // El frontend original usa scripts y atributos inline; una CSP sin unsafe-inline los rompería.
  // Eliminar unsafe-inline es un trabajo posterior de refactorización de los HTML.
  const connect = ["'self'",'https://*.supabase.co','wss://*.supabase.co'];
  if (projectHost && !projectHost.endsWith('.supabase.co')) connect.push(`https://${projectHost}`);
  res.setHeader('Content-Security-Policy', `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src ${connect.join(' ')}; frame-src https://www.google.com https://maps.google.com;`);
}
function createApp(cfg, injectedFetch = fetch) {
  const base = new URL(cfg.SUPABASE_URL);
  if(base.protocol!=='https:' || !base.hostname.endsWith('.supabase.co')) throw Error('SUPABASE_URL inválida');
  if (!/^sb_publishable_[\w-]{8,}$/.test(cfg.SUPABASE_PUBLISHABLE_KEY)) throw Error('SUPABASE_PUBLISHABLE_KEY inválida');
  const allowed = (cfg.ALLOWED_ORIGIN||'').split(',').map(v=>v.trim()).filter(Boolean);
  function cors(req,res) {
    const origin=req.headers.origin;
    if(origin && allowed.includes(origin)) {res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, PATCH, DELETE, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');}
    if(origin && !allowed.includes(origin) && req.method==='OPTIONS') throw HttpError(403,'ORIGEN_NO_PERMITIDO','Origen no autorizado');
  }
  async function upstream(resource, opts={}) {
    const dest = new URL(resource,base);
    let r;
    try {r=await injectedFetch(dest,{...opts, signal: AbortSignal.timeout(8000)});} catch(e) { throw HttpError(503,'PROVEEDOR_INDISPONIBLE','No fue posible contactar a Supabase'); }
    let data=null;try{data=await r.json();}catch{};
    if(!r.ok) {
      // La base de datos detecto un empalme (SQLSTATE exclusion_violation).
      if(data?.code === '23P01' || /Horario ocupado: ya existe otra cita confirmada/i.test(data?.message || '')) {
        throw HttpError(409,'HORARIO_OCUPADO','Ese horario se superpone con otra cita confirmada. Selecciona otro.');
      }
      const status = [400,401,403,404,409,422,429].includes(r.status) ? (r.status===422?400:r.status) : 502;
      const msg = status===409?'Existe un conflicto con los datos':status===404?'El recurso no existe':status===401?'No autorizado':status===403?'Acceso denegado':status===429?'Demasiadas solicitudes':status===400?'Los datos no son válidos':'Error del proveedor';
      throw HttpError(status,status===409?'CONFLICTO':status===502?'SERVICIO_EXTERNO':'OPERACION_RECHAZADA',msg);
    }
    return data;
  }
  const keyHeaders = {'apikey':cfg.SUPABASE_PUBLISHABLE_KEY};
  function bearer(req) {const b=req.headers.authorization||'';if(!/^Bearer [A-Za-z0-9._~+/-]{20,4096}={0,2}$/.test(b)) throw HttpError(401,'NO_AUTENTICADO','Se requiere un token de sesión');return b;}
  async function getUser(req) { const b=bearer(req);let user;try{user=await upstream('/auth/v1/user',{headers:{...keyHeaders,authorization:b}});}catch(e){ if(e.status===502 || e.status===503)throw e;throw HttpError(401,'NO_AUTENTICADO','Sesión inválida o expirada');}if(!user?.id)throw HttpError(401,'NO_AUTENTICADO','Sesión inválida');return {id:user.id,authorization:b}; }
  function restHeaders(auth, write=false) { return {...keyHeaders,authorization:auth||`Bearer ${cfg.SUPABASE_PUBLISHABLE_KEY}`,...(write?{'Content-Type':'application/json','Prefer':'return=representation'}:{})}; }
  async function handleApi(req,res,url) {
    const p=url.pathname;
    if(p==='/api/salud' && req.method==='GET'){sendJson(res,200,{ok:true,data:{servicio:'Lombana Therapy',estado:'activo'}});return;}
    // Estado de PostgreSQL local (solo lectura).
    // No consulta ni modifica los datos de Supabase.
    if (p === '/api/db/salud' && req.method === 'GET') {
      try {
        const datos = await consultarSaludPostgres(cfg);

        sendJson(res, 200, {
          ok: true,
          data: datos
        });
      } catch (error) {
        throw HttpError(
          503,
          'POSTGRESQL_NO_DISPONIBLE',
          'No se pudo consultar PostgreSQL local'
        );
      }

      return;
    }
if(p==='/api/terapias' && req.method==='GET') {
      const q=new URLSearchParams({select:'*',activo:'eq.true',order:'nombre.asc'});
      const data=await upstream('/rest/v1/therapies?'+q,{headers:restHeaders()});
      sendJson(res,200,{ok:true,data,total:data.length});return;
    }
    const therapy=p.match(/^\/api\/terapias\/([^/]+)$/);
    if(therapy && req.method==='GET') {
      const slug=decodeURIComponent(therapy[1]);if(!BAD_ID.test(slug))throw HttpError(400,'VALIDACION','Identificador de terapia inválido');
      const q=new URLSearchParams({select:'*',slug:'eq.'+slug,activo:'eq.true',limit:'1'});
      const rows=await upstream('/rest/v1/therapies?'+q,{headers:restHeaders()});
      if(!Array.isArray(rows)||rows.length===0)throw HttpError(404,'NO_ENCONTRADO','La terapia no existe');
      sendJson(res,200,{ok:true,data:rows[0]});return;
    }
    if(p==='/api/citas' && req.method==='GET') {
      const user=await getUser(req);
      const q=new URLSearchParams({select:'id,fecha,hora_inicio,hora_fin,status,therapy_id,user_id',user_id:'eq.'+user.id,order:'fecha.asc,hora_inicio.asc'});
      const data=await upstream('/rest/v1/appointments?'+q,{headers:restHeaders(user.authorization)});
      sendJson(res,200,{ok:true,data,total:data.length});return;
    }
    if(p==='/api/citas' && req.method==='POST') {
      const user=await getUser(req);const body=await parseBody(req);
      const campos=['therapy_id','fecha','hora_inicio','hora_fin'];
      if(campos.some(k=>typeof body[k]!=='string'||!body[k].trim()))throw HttpError(400,'VALIDACION','Terapia, fecha y horario son obligatorios');
      if(!/^[a-z0-9-]{1,100}$/i.test(body.therapy_id)||!validDate(body.fecha)||!cleanTime(body.hora_inicio)||!cleanTime(body.hora_fin)||cleanTime(body.hora_fin)<=cleanTime(body.hora_inicio))throw HttpError(400,'VALIDACION','Fecha, terapia u horario inválidos');
      const entry={user_id:user.id,therapy_id:body.therapy_id,fecha:body.fecha,hora_inicio:cleanTime(body.hora_inicio),hora_fin:cleanTime(body.hora_fin),slot_id:null,status:'confirmada'};
      const rows=await upstream('/rest/v1/appointments',{method:'POST',headers:restHeaders(user.authorization,true),body:JSON.stringify(entry)});
      sendJson(res,201,{ok:true,data:rows?.[0]||entry});return;
    }
    const match=p.match(/^\/api\/citas\/([^/]+)$/);
    if(match && ['GET','PUT','PATCH','DELETE'].includes(req.method)) {
      const id=decodeURIComponent(match[1]);if(!UUID_OR_INT.test(id))throw HttpError(400,'VALIDACION','Id de cita inválido');
      const user=await getUser(req);const q=new URLSearchParams({select:'id,fecha,hora_inicio,hora_fin,status,user_id,therapy_id',id:'eq.'+id,user_id:'eq.'+user.id});
      const resource='/rest/v1/appointments?'+q;
      if(req.method==='GET') {const rows=await upstream(resource,{headers:restHeaders(user.authorization)});if(!rows?.length)throw HttpError(404,'NO_ENCONTRADO','Cita no encontrada');sendJson(res,200,{ok:true,data:rows[0]});return;}
      if(req.method==='PUT'||req.method==='PATCH'){const body=await parseBody(req);if(body.status!=='cancelada'||Object.keys(body).some(k=>k!=='status'))throw HttpError(400,'VALIDACION','Solo se permite cambiar status a cancelada');}
      const rows=await upstream(resource,{method:'PATCH',headers:restHeaders(user.authorization,true),body:JSON.stringify({status:'cancelada'})});
      if(!rows?.length)throw HttpError(404,'NO_ENCONTRADO','Cita no encontrada o sin permiso');
      if(req.method==='DELETE'){res.writeHead(204);res.end();return;}
      sendJson(res,200,{ok:true,data:rows[0]});return;
    }
    throw HttpError(404,'RUTA_NO_ENCONTRADA','La ruta de la API no existe');
  }
  async function staticFile(req,res,url) {
    if(!['GET','HEAD'].includes(req.method))throw HttpError(405,'METODO_NO_PERMITIDO','Método no permitido');
    let name;
    try{name=decodeURIComponent(url.pathname);}catch{throw HttpError(400,'RUTA_INVALIDA','Ruta inválida');}
    if(name==='/' )name='/index.html';
    const parts=name.split('/').filter(Boolean);
    if(parts.some(x=>x.startsWith('.')||x==='..'||x.includes('\\')))throw HttpError(404,'NO_ENCONTRADO','Página no encontrada');
    const rel=parts.join('/');
    if(!(htmlPages.has(rel) || ((rel.startsWith('css/')||rel.startsWith('js/')||rel.startsWith('assets/'))&&isText(rel))))throw HttpError(404,'NO_ENCONTRADO','Página no encontrada');
    const filename=path.join(ROOT,rel);
    let data;try{data=await fs.promises.readFile(filename);}catch{throw HttpError(404,'NO_ENCONTRADO','Página no encontrada');}
    res.writeHead(200,{'Content-Type':TYPES[path.extname(filename).toLowerCase()],'Content-Length':data.length, ...(rel==='js/config.js'?{'Cache-Control':'no-store'}:{})});
    res.end(req.method==='HEAD'?undefined:data);
  }
  return async (req,res)=>{
    const start=performance.now();let url;let requestPath='(inválida)';
    try {
      url=new URL(req.url,'http://localhost');requestPath=url.pathname;
      secureHeaders(res,base.hostname);cors(req,res);
      if(req.method==='OPTIONS') {res.writeHead(204);res.end();return;}
      if (
        url.pathname === '/api-docs' ||
        url.pathname.startsWith('/api-docs/')
      ) {
        await handleSwaggerDocs(req, res, url);
      } else if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
      } else {
        await staticFile(req, res, url);
      }

    } catch(e) {
      // Nunca incluir contraseñas, cabeceras Authorization ni body en el log.
      console.error(`[${new Date().toISOString()}] error ${req.method} ${requestPath}: ${e.codigo||'INTERNO'} ${e.status||500}`);
      if(!res.headersSent){
        if(requestPath.startsWith('/api/'))errorJson(res,e);
        else if(e.status===404){try{const data=await fs.promises.readFile(path.join(ROOT,'404.html'));res.writeHead(404,{'Content-Type':'text/html; charset=utf-8','Content-Length':data.length});res.end(data);}catch{res.writeHead(404);res.end('404');}}
        else {res.writeHead(e.status||500,{'Content-Type':'text/plain; charset=utf-8'});res.end(e.status>=500?'Error interno del servidor':e.message);}
      }
    } finally {res.once('finish',()=>{});console.log(`${req.method} ${requestPath} ${res.statusCode} ${Math.round(performance.now()-start)} ms`);}
  };
}

function boot() {
  const envFile = path.join(ROOT, '.env');

  // En Windows, utiliza .env si existe.
  // En Docker, acepta variables del entorno.
  const cfg = fs.existsSync(envFile)
    ? readEnvironment(envFile)
    : { ...process.env };

  const required = [
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'ALLOWED_ORIGIN'
  ];

  const missing = required.filter(
    k => !cfg[k] ||
      cfg[k].includes('TU_PROYECTO') ||
      cfg[k].includes('TU_CLAVE')
  );

  if (missing.length) {
    throw Error(
      'Faltan variables de entorno: ' + missing.join(', ')
    );
  }

  const port = Number(cfg.PORT || 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw Error('PORT inválido');
  }

  // Conservar localhost fuera de Docker.
  // Docker utilizará HOST=0.0.0.0.
  const host = cfg.HOST || '127.0.0.1';

  const httpServer = http.createServer(createApp(cfg));

  httpServer.listen(port, host, () => {
    console.log(`Lombana Therapy: http://${host}:${port}`);
  });

  return httpServer;
}


if(require.main===module){try{boot();}catch(err){console.error('No se pudo iniciar:',err.message);process.exitCode=1;}}
module.exports={createApp,boot};
