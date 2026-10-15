import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const responder = (body: Record<string, unknown>, status=200) => Response.json(body,{status});
const invitar = withSupabase({ auth: "user" },async(req,ctx)=>{
  if(req.method!=="POST") return responder({error:"Método no permitido."},405);
  const id=ctx.userClaims?.id||ctx.jwtClaims?.sub;
  if(!id)return responder({error:"Inicia sesión."},401);
  const {data:perfil,error:perfilError}=await ctx.supabaseAdmin.from("profiles")
    .select("rol").eq("id",id).maybeSingle();
  if(perfilError)return responder({error:"No fue posible verificar los permisos."},503);
  if(!perfil||perfil.rol!=="admin")return responder({error:"Solo administradores.",autorizado:false},403);
  let body: Record<string,unknown>;
  try {
    const value=await req.json();
    if(!value||typeof value!=="object"||Array.isArray(value))throw Error('invalid');
    body=value;
  } catch{return responder({error:"Datos inválidos."},400);}
  const accion=typeof body.accion==='string'?body.accion.trim():'';
  const habilitada=Deno.env.get('ADMIN_INVITES_ENABLED')==='true';
  if(accion===''||accion==='verificar')return responder({ok:true,autorizado:true,
    modo:habilitada?'operativo':'preparacion',
    mensaje: habilitada?'Invitaciones habilitadas.':'Invitaciones pendientes de activación.'});
  if(accion!=='invitar')return responder({error:'Acción no reconocida.'},400);
  if(!habilitada)return responder({error:'El envío de invitaciones todavía no está habilitado.'},503);
  const nombre=typeof body.nombre==='string'?body.nombre.trim():'';
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(nombre.length<2||nombre.length>100||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return responder({error:'Nombre o correo inválido.'},400);
  const redireccion=Deno.env.get('ADMIN_INVITE_REDIRECT_URL')||'';
  if(!/^https:\/\//.test(redireccion)&&!/^http:\/\/127\.0\.0\.1:3000\//.test(redireccion))
    return responder({error:'Configura ADMIN_INVITE_REDIRECT_URL con una URL autorizada de tu aplicación.'},503);
  // No se aceptan perfiles existentes para evitar elevación de privilegios.
  // inviteUserByEmail tampoco envía invitación si ya existe la cuenta.
  const {data:invitacion,error:envioError}=await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(
    email,{data:{nombre},redirectTo:redireccion});
  if(envioError||!invitacion?.user?.id){
    console.error('No se pudo enviar la invitación',envioError?.message);
    return responder({error:'No fue posible enviar la invitación; revisa el correo y si ya existe una cuenta.'},400);
  }
  const {data:perfilNuevo,error:guardarError}=await ctx.supabaseAdmin.from('profiles')
    .upsert({id:invitacion.user.id,nombre,email,rol:'admin'},{onConflict:'id'})
    .select('id,rol').single();
  if(guardarError||perfilNuevo?.rol!=='admin'){
    console.error('REVISAR INVITACIÓN: el correo pudo enviarse pero falló el rol',guardarError?.message);
    return responder({error:'El correo pudo enviarse, pero el rol no se confirmó. Requiere revisión administrativa.'},500);
  }
  return responder({ok:true,mensaje:'Invitación enviada. El usuario debe abrir el correo y establecer su contraseña.'},201);
});
export default {fetch:invitar};
