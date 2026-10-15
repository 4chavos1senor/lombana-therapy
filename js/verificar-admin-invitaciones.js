/* Las invitaciones solo se habilitan cuando la Edge Function anuncia modo operativo. */
'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const form=document.getElementById('form-invitar-admin');
 const button=document.getElementById('btn-invitar-admin');
 const status=document.getElementById('mensaje-invitar-admin');
 if(!form||!button||!status)return;
 let operativo=false,procesando=false;
 button.type='submit';button.disabled=true;
 form.addEventListener('submit',async e=>{
   e.preventDefault();
   if(!operativo||procesando)return;
   if(!form.reportValidity())return;
   const nombre=document.getElementById('nuevo-admin-nombre')?.value.trim();
   const email=document.getElementById('nuevo-admin-email')?.value.trim().toLowerCase();
   if(!nombre||!email)return;
   if(!confirm('¿Deseas invitar a '+email+' como ADMINISTRADOR? Esta persona podrá gestionar el sistema.'))return;
   procesando=true;button.disabled=true;
   status.textContent='Enviando invitación y verificando la cuenta...';
   try {
     const {data,error}=await supabaseClient.functions.invoke('invitar-administrador',{
       body:{accion:'invitar',nombre,email}
     });
     if(error||!data?.ok){
       let detail=data?.error||error?.message||'Error al enviar la invitación.';
       try{if(error?.context instanceof Response){const r=await error.context.clone().json();detail=r.error||detail;}}catch{}
       status.textContent=detail;
     }else{status.textContent=data.mensaje||'Invitación enviada correctamente.';form.reset();}
   }catch{status.textContent='No fue posible enviar la invitación.';}
   finally{procesando=false;button.disabled=!operativo;}
 });
 status.textContent='Verificando autorización administrativa...';
 try {
   const {data,error}=await supabaseClient.functions.invoke('invitar-administrador',{body:{accion:'verificar'}});
   if(error){status.textContent=error.context?.status===403?'Solo un administrador puede enviar invitaciones.':
     'No fue posible verificar permisos. La función debe estar desplegada.';return;}
   if(data?.ok!==true||data.autorizado!==true){status.textContent='Permisos insuficientes.';return;}
   operativo=data.modo==='operativo';
   button.disabled=!operativo;
   status.textContent=operativo?'Permisos verificados. Puedes invitar un nuevo administrador.':
     'Permisos verificados. Invitaciones deshabilitadas hasta completar y publicar la configuración en Supabase.';
 }catch{status.textContent='Error de conexión. El envío sigue deshabilitado.';}
});
