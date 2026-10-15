/* Gestión del panel sin claves privadas. La autorización real la imponen las políticas RLS de Supabase. */
'use strict';
const textoAdmin = v => (v===null||v===undefined?'':String(v));
function celdaAdmin(row, value) { const td=document.createElement('td');td.textContent=textoAdmin(value);row.appendChild(td);return td; }
function mensajeTabla(id, mensaje, columnas) {const tabla=document.getElementById(id);if(!tabla)return;tabla.replaceChildren();const tr=document.createElement('tr');const td=celdaAdmin(tr,mensaje);td.colSpan=columnas;tabla.appendChild(tr);}
function mensajeAdministracion(mensaje) { alert(mensaje); }
let terapiasAdminCache=[];
let clientesAdminCache=[];
async function autorizadoAdministracion(){
  const {data:{user},error}=await supabaseClient.auth.getUser();
  if(error||!user)return false;
  const {data:perfil,error:perr}=await supabaseClient.from('profiles').select('rol').eq('id',user.id).single();
  return !perr && perfil?.rol==='admin';
}
async function cargarClientesAdmin(){
  const tabla=document.getElementById('tabla-clientes');if(!tabla)return;
  mensajeTabla('tabla-clientes','Cargando clientes...',5);
  const {data,error}=await supabaseClient.from('profiles').select('id,nombre,email,telefono,genero').order('nombre',{ascending:true});
  if(error){mensajeTabla('tabla-clientes','No se pudieron cargar los clientes. Revisa los permisos RLS.',5);return;}
  clientesAdminCache=data||[];tabla.replaceChildren();
  if(!clientesAdminCache.length){mensajeTabla('tabla-clientes','No hay clientes registrados o no tienes acceso.',5);return;}
  clientesAdminCache.forEach(cliente=>{const tr=document.createElement('tr');celdaAdmin(tr,cliente.nombre);celdaAdmin(tr,cliente.email);celdaAdmin(tr,cliente.telefono);celdaAdmin(tr,cliente.genero);
    const td=document.createElement('td');const btn=document.createElement('button');btn.type='button';btn.textContent='Editar';btn.className='btn-secondary';btn.addEventListener('click',()=>editarCliente(cliente.id));td.appendChild(btn);tr.appendChild(td);tabla.appendChild(tr);
  });
}
function editarCliente(id){
  const c=clientesAdminCache.find(v=>String(v.id)===String(id));if(!c)return;
  document.getElementById('cliente-id-edicion').value=c.id;
  for(const [campo,valor] of [['cliente-nombre',c.nombre],['cliente-email',c.email],['cliente-telefono',c.telefono],['cliente-genero',c.genero]]){const el=document.getElementById(campo);if(el)el.value=valor||'';}
  document.getElementById('cliente-password').required=false;document.getElementById('cliente-password').value='';
  document.getElementById('form-cliente').hidden=false;
  document.getElementById('titulo-form-cliente').textContent='Editar cliente';
  document.getElementById('btn-guardar-cliente').textContent='Guardar cambios';
  document.getElementById('btn-cancelar-edicion-cliente').classList.remove('oculto');
  document.getElementById('cliente-nombre').focus();
}
function limpiarFormularioCliente(){
  document.getElementById('form-cliente').reset();document.getElementById('cliente-id-edicion').value='';
  document.getElementById('form-cliente').hidden=true;
  document.getElementById('btn-cancelar-edicion-cliente').classList.add('oculto');
  document.getElementById('titulo-form-cliente').textContent='Editar cliente existente';
}
async function guardarCliente(event){
  event.preventDefault();const id=document.getElementById('cliente-id-edicion').value;
  // Nunca se crean usuarios Auth desde el navegador del administrador con un token privilegiado.
  if(!id){mensajeAdministracion('Para crear una cuenta, utiliza registro.html. Crear usuarios desde el panel requiere una función segura de servidor con validación de permisos.');return;}
  if(!await autorizadoAdministracion()){mensajeAdministracion('Sesión de administrador no válida.');return;}
  const nombre=document.getElementById('cliente-nombre').value.trim();const email=document.getElementById('cliente-email').value.trim();const telefono=document.getElementById('cliente-telefono').value.trim();const genero=document.getElementById('cliente-genero').value;
  const original=clientesAdminCache.find(c=>String(c.id)===String(id));
  if(original && email!==original.email){mensajeAdministracion('El correo de acceso se administra en Supabase Auth y no debe cambiarse solo en profiles.');return;}
  if(nombre.length<2||nombre.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['femenino','masculino','otro'].includes(genero)|| (telefono && !/^[0-9+()\-\s]{7,20}$/.test(telefono))) {mensajeAdministracion('Datos del cliente inválidos.');return;}
  if(document.getElementById('cliente-password').value) {mensajeAdministracion('No se pueden modificar contraseñas desde el navegador. Utiliza el flujo seguro de recuperación de contraseña de Supabase Auth.');return;}
  const {data,error}=await supabaseClient.from('profiles').update({nombre,telefono,genero}).eq('id',id).select('id');
  if(error||!data?.length){mensajeAdministracion('No se guardaron los cambios. Revisa permisos RLS y las columnas de profiles.');return;}
  limpiarFormularioCliente();await cargarClientesAdmin();mensajeAdministracion('Datos del cliente actualizados.');
}
function camposTerapia() {
  const get=id=>document.getElementById(id).value.trim();const nombre=get('terapia-admin-nombre');const slug=get('terapia-admin-slug');const duracion=Number(get('terapia-admin-duracion'));const precio=get('terapia-admin-precio');
  if(nombre.length<2||nombre.length>150||!Number.isInteger(duracion)||duracion<1||duracion>480|| (slug&&!/^[a-z0-9-]{2,100}$/.test(slug))||precio.length>50)throw Error('Revisa el nombre, slug, duración y precio.');
  return {nombre,slug:slug||nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-+$/g,''),duracion_minutos:duracion,precio,imagen_url:get('terapia-admin-imagen')||null,activo:get('terapia-admin-activo')==='true',descripcion:get('terapia-admin-descripcion'),descripcion_larga:get('terapia-admin-descripcion-larga')};
}
async function cargarTerapiasAdmin(){
  const tabla=document.getElementById('tabla-terapias-admin');if(!tabla)return;
  mensajeTabla('tabla-terapias-admin','Cargando terapias...',5);
  const {data,error}=await supabaseClient.from('therapies').select('id,nombre,slug,duracion_minutos,precio,imagen_url,activo,descripcion,descripcion_larga').order('nombre',{ascending:true});
  if(error){mensajeTabla('tabla-terapias-admin','Error al consultar terapias. Comprueba los nombres de columnas y RLS.',5);return;}
  terapiasAdminCache=data||[];tabla.replaceChildren();
  if(!terapiasAdminCache.length){mensajeTabla('tabla-terapias-admin','No hay terapias.',5);return;}
  terapiasAdminCache.forEach(t=>{const tr=document.createElement('tr');celdaAdmin(tr,t.nombre);celdaAdmin(tr,t.precio);celdaAdmin(tr,t.duracion_minutos+' min');celdaAdmin(tr,t.activo?'Activa':'Inactiva');const td=document.createElement('td');const b=document.createElement('button');b.type='button';b.textContent='Editar';b.className='btn-secondary';b.addEventListener('click',()=>editarTerapia(t.id));td.appendChild(b);tr.appendChild(td);tabla.appendChild(tr);});
}
function editarTerapia(id){const t=terapiasAdminCache.find(x=>String(x.id)===String(id));if(!t)return;
  const m={'terapia-id-edicion':t.id,'terapia-admin-nombre':t.nombre,'terapia-admin-slug':t.slug,'terapia-admin-duracion':t.duracion_minutos,'terapia-admin-precio':t.precio,'terapia-admin-imagen':t.imagen_url,'terapia-admin-activo':String(t.activo),'terapia-admin-descripcion':t.descripcion,'terapia-admin-descripcion-larga':t.descripcion_larga};
  for(const [id,value] of Object.entries(m))document.getElementById(id).value=value??'';
  document.getElementById('titulo-form-terapia').textContent='Editar terapia';document.getElementById('btn-cancelar-edicion-terapia').classList.remove('oculto');document.getElementById('terapia-admin-nombre').focus();
}
function limpiarFormularioTerapia(){document.getElementById('form-terapia').reset();document.getElementById('terapia-id-edicion').value='';document.getElementById('titulo-form-terapia').textContent='Agregar nueva terapia';document.getElementById('btn-cancelar-edicion-terapia').classList.add('oculto');}
async function guardarTerapia(event){event.preventDefault();if(!await autorizadoAdministracion()){mensajeAdministracion('Solo administradores autorizados pueden guardar terapias.');return;}
  let entrada;try{entrada=camposTerapia();}catch(e){mensajeAdministracion(e.message);return;}
  const id=document.getElementById('terapia-id-edicion').value;
  const consulta=id?supabaseClient.from('therapies').update(entrada).eq('id',id):supabaseClient.from('therapies').insert(entrada);
  const {data,error}=await consulta.select('id');
  if(error||!data?.length){mensajeAdministracion('No se pudo guardar la terapia. Verifica las columnas y políticas RLS de Supabase.');return;}
  limpiarFormularioTerapia();await cargarTerapiasAdmin();mensajeAdministracion('Terapia guardada correctamente.');
}
document.addEventListener('DOMContentLoaded',async()=>{
  const form=document.getElementById('form-cliente');if(!form)return;
  // Crear un usuario requiere la API administrativa (no disponible desde el frontend público).
  form.hidden=true;
  document.getElementById('titulo-form-cliente').textContent='Editar cliente existente';
  const aviso=document.createElement('p');aviso.className='info-text';aviso.textContent='Las cuentas nuevas se crean desde Registro. Aquí puedes editar perfiles existentes, según los permisos RLS.';document.getElementById('titulo-form-cliente').after(aviso);
  if(await autorizadoAdministracion()){await Promise.all([cargarClientesAdmin(),cargarTerapiasAdmin()]);}
});
