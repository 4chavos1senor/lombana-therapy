/* Simulación SIN cobro; solo el botón realiza una reserva REAL en Supabase. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'lombana_demo_cita';
  const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  function ahoraConsultorio() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone:'America/Mexico_City', year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
    }).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
    return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second;
  }
  function datosValidos(d) {
    if (!d || typeof d !== 'object' || typeof d.folio!=='string'
      || !d.folio.startsWith('DEMO-') || typeof d.terapia!=='string'
      || !UUID.test(String(d.therapy_id||''))
      || !/^\d{4}-\d{2}-\d{2}$/.test(String(d.fecha||''))
      || !/^(?:0[9]|1[0-7]):00$/.test(String(d.horario||''))) return false;
    const date=new Date(d.fecha+'T12:00:00Z');
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==d.fecha) return false;
    const dia=date.getUTCDay(),hora=Number(d.horario.slice(0,2));
    return dia!==0 && hora<(dia===6?15:18);
  }

  const estado=$('demo-status'), boton=$('btn-agendar-demo'), aviso=$('demo-error');
  let datos;
  try { datos=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null'); }catch{datos=null}
  if(!datosValidos(datos)){
    estado.textContent='No hay simulación válida. Regresa a Agendar terapia y vuelve a elegir tus datos.';
    return;
  }
  for(const [campo,valor] of Object.entries({
    folio:datos.folio,terapia:datos.terapia,fecha:datos.fecha,hora:datos.horario
  })) $('demo-'+campo).textContent=valor;
  $('demo-details').hidden=false;
  boton.hidden=false;
  estado.textContent='La demostración terminó. Tu horario aún no está reservado.';
  let procesando=false;
  boton.addEventListener('click',async()=>{
    if(procesando)return;
    procesando=true;boton.disabled=true;aviso.hidden=true;
    estado.textContent='Comprobando el horario y registrando la cita en Supabase...';
    try {
      if(datos.fecha+'T'+datos.horario+':00'<=ahoraConsultorio())
        throw new Error('El horario ya pasó. Selecciona otro en la agenda.');
      const {data:identidad,error:sesionError}=await supabaseClient.auth.getUser();
      if(sesionError||!identidad?.user?.id)
        throw new Error('Tu sesión caducó. Inicia sesión y vuelve a realizar la simulación.');
      const hora=Number(datos.horario.slice(0,2));
      const inicio=datos.horario+':00';
      const fin=String(hora+1).padStart(2,'0')+':00:00';
      const {data:ocupados,error:disponibilidadError}=await supabaseClient
        .rpc('lt_horarios_ocupados',{p_fecha:datos.fecha});
      if(disponibilidadError||!Array.isArray(ocupados))
        throw new Error('No se pudo comprobar disponibilidad. Revisa la función de horarios de Supabase.');
      if(ocupados.some(x=>x.hora_inicio<fin&&x.hora_fin>inicio))
        throw new Error('Horario ocupado. Regresa a la agenda y elige otro.');
      // La identidad procede del servidor de autenticación, no del borrador DEMO.
      // El trigger PostgreSQL es la validación definitiva ante reservas simultáneas.
      const {data:cita,error:errorCita}=await supabaseClient.from('appointments')
        .insert({
          user_id:identidad.user.id,therapy_id:datos.therapy_id,slot_id:null,
          fecha:datos.fecha,hora_inicio:inicio,hora_fin:fin,status:'confirmada'
        }).select('id').single();
      if(errorCita){
        if(errorCita.code==='23P01'||errorCita.code==='23505'
          ||/ocupado|empalm|superpon|duplicate key/i.test(errorCita.message||''))
          throw new Error('Otro paciente reservó ese horario. Elige uno diferente.');
        console.error('Error al registrar cita:',errorCita);
        throw new Error('Supabase no pudo guardar la cita. Revisa la sesión y los permisos de citas.');
      }
      if(!cita?.id||!UUID.test(cita.id))
        throw new Error('Sin folio verificable. Consulta Mis citas antes de reintentar.');
      sessionStorage.removeItem(STORAGE_KEY);
      $('demo-estado').textContent='Confirmada en Supabase (sin cobro)';
      estado.textContent='Cita real agendada. Abriendo confirmación...';
      window.location.assign('cita-confirmada.html?id='+encodeURIComponent(cita.id));
    }catch(error){
      estado.textContent='Todavía no se ha confirmado la cita.';
      aviso.textContent=error.message||'No se pudo completar la reserva.';
      aviso.hidden=false;
    }finally{procesando=false;boton.disabled=false}
  });
})();
