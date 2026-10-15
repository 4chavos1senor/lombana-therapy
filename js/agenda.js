let horarioSeleccionado = null;
let terapiasAgenda = [];
let usuarioActual = null;

const paramsAgenda = new URLSearchParams(window.location.search);
const terapiaPreseleccionada = paramsAgenda.get('terapia');

document.addEventListener('DOMContentLoaded', async function () {
  const autorizado = await protegerAgenda();

  if (!autorizado) {
    return;
  }

  configurarFechaMinima();
  await cargarTerapiasAgenda();

  const fechaInput = document.getElementById('fecha');

  if (fechaInput) {
    fechaInput.addEventListener('change', cargarHorariosDisponibles);
  }
});

async function protegerAgenda() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error('Error al obtener sesión:', error);
    alert('Ocurrió un error al verificar tu sesión. Inicia sesión nuevamente.');

    const regreso = encodeURIComponent(
      window.location.pathname.split('/').pop() + window.location.search
    );

    window.location.replace('login.html?redirect=' + regreso);
    return false;
  }

  if (!data || !data.session || !data.session.user) {
    alert('Debes iniciar sesión para agendar una cita.');

    const regreso = encodeURIComponent(
      window.location.pathname.split('/').pop() + window.location.search
    );

    window.location.replace('login.html?redirect=' + regreso);
    return false;
  }

  usuarioActual = data.session.user;
  return true;
}

function configurarFechaMinima() {
  const fechaInput = document.getElementById('fecha');

  if (!fechaInput) {
    return;
  }

  const hoy = obtenerFechaActualTexto();

  fechaInput.min = hoy;

  if (fechaInput.value && fechaInput.value < hoy) {
    fechaInput.value = '';
  }
}

function obtenerMomentoConsultorio() {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Mexico_City',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date())
      .filter(parte => parte.type !== 'literal')
      .map(parte => [parte.type, parte.value])
  );
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}:${partes.second}`
  };
}
function obtenerFechaActualTexto() {
  return obtenerMomentoConsultorio().fecha;
}

function obtenerSlug(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function cargarTerapiasAgenda() {
  const select = document.getElementById('terapia');

  if (!select) {
    console.error('No se encontró el select con id="terapia".');
    return;
  }

  select.innerHTML = '<option value="">Cargando terapias...</option>';

  const { data, error } = await supabaseClient
    .from('therapies')
    .select('*')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error al cargar terapias:', error);
    select.replaceChildren();
    const opcion = document.createElement('option');
    opcion.value = ''; opcion.textContent = 'No fue posible cargar terapias.';
    select.appendChild(opcion);
    return;
  }

  terapiasAgenda = data || [];
  select.innerHTML = '<option value="">Selecciona una terapia</option>';

  terapiasAgenda.forEach(terapia => {
    const option = document.createElement('option');

    option.value = terapia.id;
    option.dataset.slug = terapia.slug || obtenerSlug(terapia.nombre);
    option.textContent = `${terapia.nombre} - ${Number(terapia.precio) > 0 ? '$' + Number(terapia.precio).toFixed(2) + ' MXN' : 'Precio por confirmar'}`;

    select.appendChild(option);
  });

  if (terapiaPreseleccionada) {
    const terapia = terapiasAgenda.find(item => {
      return (item.slug || obtenerSlug(item.nombre)) === terapiaPreseleccionada;
    });

    if (terapia) {
      select.value = terapia.id;
    }
  }
}

async function cargarHorariosDisponibles() {
  const autorizado = await protegerAgenda();

  if (!autorizado) {
    return;
  }

  const fechaInput = document.getElementById('fecha');
  const contenedor = document.getElementById('horarios');

  if (!fechaInput || !contenedor) {
    console.error('No se encontró el input fecha o el contenedor horarios.');
    return;
  }

  const fecha = fechaInput.value;

  horarioSeleccionado = null;
  const estadoHorario = document.getElementById('horario-estado');
  if (estadoHorario) estadoHorario.textContent = 'Ningún horario seleccionado.';
  contenedor.innerHTML = '';

  if (!fecha) {
    contenedor.innerHTML = '<p>Selecciona una fecha.</p>';
    return;
  }

  if (fechaEsAnteriorAHoy(fecha)) {
    fechaInput.value = '';
    contenedor.innerHTML = '<p>No puedes agendar citas en fechas anteriores a hoy.</p>';
    alert('No puedes agendar citas en fechas anteriores a hoy.');
    return;
  }

  const dia = obtenerDiaSemana(fecha);

  if (dia === 0) {
    contenedor.innerHTML = '<p>El consultorio no abre los domingos.</p>';
    return;
  }

  contenedor.innerHTML = '<p>Cargando horarios...</p>';

  const horariosDelDia = generarHorariosPorFecha(fecha);

  const horariosVigentes = horariosDelDia.filter(horario => {
    return !horarioYaPaso(horario);
  });

  if (horariosVigentes.length === 0) {
    contenedor.innerHTML = '<p>Ya no hay horarios disponibles para este día.</p>';
    return;
  }

  // Fuente autoritativa de TODOS los horarios confirmados.
  // Una consulta directa a appointments no basta: RLS puede ocultar las
  // citas de los otros pacientes y mostrar un horario ocupado como libre.
  const { data: intervalosOcupados, error } = await supabaseClient
    .rpc('lt_horarios_ocupados', { p_fecha: fecha });

  if (error || !Array.isArray(intervalosOcupados)) {
    console.error('Error al consultar disponibilidad global:', error);
    contenedor.textContent = 'No se puede verificar la disponibilidad. Instala el SQL 03_agenda_un_terapeuta.sql en Supabase o vuelve a intentar.';
    return;
  }
  const ocupado = horario => intervalosOcupados.some(
    cita => LombanaHorarios.seSuperponen(cita, horario)
  );

  contenedor.innerHTML = '';

  horariosVigentes.forEach(horario => {
    const button = document.createElement('button');

    button.type = 'button';
    button.classList.add('slot-btn');
    button.setAttribute('aria-pressed', 'false');

    const horaInicioCorta = formatearHora(horario.hora_inicio);

    if (ocupado(horario)) {
      button.disabled = true;
      button.classList.add('slot-disabled');
      button.textContent = horaInicioCorta + ' - Ocupado';
    } else {
      button.textContent = horaInicioCorta;

      button.onclick = function () {
        seleccionarHorario(horario, button);
      };
    }

    contenedor.appendChild(button);
  });

  const horariosLibres = horariosVigentes.filter(horario => {
    return !ocupado(horario);
  });

  if (horariosLibres.length === 0) {
    contenedor.insertAdjacentHTML(
      'beforeend',
      '<p>Todos los horarios disponibles de este día ya están ocupados.</p>'
    );
  }
}

function generarHorariosPorFecha(fecha) {
  const dia = obtenerDiaSemana(fecha);

  let horaInicio = 9;
  let horaFin = 18;

  if (dia === 6) {
    horaFin = 15;
  }

  const horarios = [];

  for (let hora = horaInicio; hora < horaFin; hora++) {
    horarios.push({
      fecha: fecha,
      hora_inicio: String(hora).padStart(2, '0') + ':00:00',
      hora_fin: String(hora + 1).padStart(2, '0') + ':00:00'
    });
  }

  return horarios;
}

function seleccionarHorario(horario, button) {
  if (horarioYaPaso(horario)) {
    alert('Este horario ya no está disponible porque la hora ya pasó.');
    cargarHorariosDisponibles();
    return;
  }

  horarioSeleccionado = horario;

  document.querySelectorAll('.slot-btn').forEach(btn => {
    btn.classList.remove('selected');
  });

  document.querySelectorAll('.slot-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
  button.setAttribute('aria-pressed', 'true');
  button.classList.add('selected');
  const estado = document.getElementById('horario-estado');
  if (estado) estado.textContent = 'Horario seleccionado: ' + formatearHora(horario.hora_inicio);
}

async function reservarCitaDirecta() {
  const autorizado = await protegerAgenda();

  if (!autorizado) {
    return;
  }

  const terapiaSelect = document.getElementById('terapia');

  if (!terapiaSelect) {
    alert('No se encontró el campo de terapia.');
    return;
  }

  const terapiaId = terapiaSelect.value;

  if (!terapiaId) {
    alert('Selecciona una terapia.');
    return;
  }

  if (!horarioSeleccionado) {
    alert('Selecciona un horario disponible.');
    return;
  }

  if (fechaEsAnteriorAHoy(horarioSeleccionado.fecha)) {
    alert('No puedes agendar citas en fechas anteriores a hoy.');
    horarioSeleccionado = null;
    cargarHorariosDisponibles();
    return;
  }

  if (horarioYaPaso(horarioSeleccionado)) {
    alert('Este horario ya pasó. Selecciona otro horario disponible.');
    horarioSeleccionado = null;
    cargarHorariosDisponibles();
    return;
  }

  const user = usuarioActual;

  if (!user || !user.id) {
    alert('Tu sesión no es válida. Inicia sesión nuevamente.');
    window.location.replace('login.html');
    return;
  }

  // La comprobacion final ocurre en PostgreSQL mediante el trigger
  // trg_lt_evitar_empalmes y un bloqueo transaccional por fecha.
  // No hacer SELECT + INSERT como sustituto: tiene una condicion de carrera.

  /*
    Se valida nuevamente justo antes de insertar,
    por si el usuario dejó abierta la página varios minutos.
  */
  if (horarioYaPaso(horarioSeleccionado)) {
    alert('El horario seleccionado acaba de vencer. Selecciona otro horario.');
    horarioSeleccionado = null;
    cargarHorariosDisponibles();
    return;
  }

  const { data: nuevaCita, error: citaError } = await supabaseClient
    .from('appointments')
    .insert({
      user_id: user.id,
      therapy_id: terapiaId,
      slot_id: null,
      fecha: horarioSeleccionado.fecha,
      hora_inicio: horarioSeleccionado.hora_inicio,
      hora_fin: horarioSeleccionado.hora_fin,
      status: 'confirmada'
    })
    .select('id')
    .single();

  if (citaError) {
    console.error('Error al confirmar cita:', citaError);
    if (citaError.code === '23P01' || /Horario ocupado|superpone/i.test(citaError.message || '')) {
      alert('El horario fue ocupado por otra cita. Selecciona otro.');
      await cargarHorariosDisponibles();
    } else {
      alert('No se pudo confirmar la cita: ' + citaError.message);
    }
    return;
  }

  // Nunca mostrar confirmación sin un ID real persistido en Supabase.
  if (!nuevaCita?.id) {
    alert('La reserva pudo registrarse, pero no se pudo recuperar el folio. Revisa Mis citas.');
    window.location.assign('mis-citas.html');
    return;
  }
  window.location.assign('cita-confirmada.html?id=' + encodeURIComponent(nuevaCita.id));
}

function fechaEsAnteriorAHoy(fechaTexto) {
  const hoy = obtenerFechaActualTexto();

  return fechaTexto < hoy;
}

function horarioYaPaso(horario) {
  if (!horario?.fecha || !/^\d{2}:\d{2}(?::\d{2})?$/.test(horario.hora_inicio || '')) {
    return true;
  }
  const actual = obtenerMomentoConsultorio();
  const horaInicio = horario.hora_inicio.length === 5
    ? horario.hora_inicio + ':00' : horario.hora_inicio;
  return `${horario.fecha}T${horaInicio}` <= `${actual.fecha}T${actual.hora}`;
}

async function cerrarSesion() {
  await supabaseClient.auth.signOut();
  window.location.replace('login.html');
}

function obtenerDiaSemana(fechaTexto) {
  const fecha = new Date(fechaTexto + 'T00:00:00');
  return fecha.getDay();
}

function formatearHora(hora) {
  if (!hora) {
    return '';
  }

  return hora.substring(0, 5);
}

// Se mantiene la reserva real original y se agregan las modalidades de "gali".
let ltProcesando = false;
function ltEstadoReserva(texto) {
  const estado = document.getElementById('estado-reserva');
  if (estado) estado.textContent = texto;
}
async function ltErrorFuncion(error, alternativo) {
  try {
    const respuesta = error?.context instanceof Response ? await error.context.clone().json() : null;
    return respuesta?.error || error?.message || alternativo;
  } catch { return error?.message || alternativo; }
}
async function confirmarCita() {
  if (ltProcesando) return;
  const metodo = document.querySelector('input[name="lt-forma-cita"]:checked')?.value || 'reserva';
  if (metodo === 'reserva') {
    ltProcesando=true;
    const b=document.getElementById('btn-pagar');
    if(b)b.disabled=true;
    try { return await reservarCitaDirecta(); }
    finally { ltProcesando=false; if(b)b.disabled=false; }
  }
  if (!(await protegerAgenda())) return;
  const terapiaId = document.getElementById('terapia')?.value;
  if (!terapiaId || !horarioSeleccionado) {
    ltEstadoReserva('Selecciona una terapia, fecha y horario.'); return;
  }
  if (fechaEsAnteriorAHoy(horarioSeleccionado.fecha) || horarioYaPaso(horarioSeleccionado)) {
    ltEstadoReserva('El horario ya pasó. Selecciona otro.'); return;
  }
  const boton = document.getElementById('btn-pagar');
  ltProcesando = true;
  if (boton) boton.disabled = true;
  ltEstadoReserva('Procesando solicitud...');
  try {
    if (metodo === 'demo') {
      const elegido = document.getElementById('terapia')?.selectedOptions?.[0]?.textContent?.trim();
      const datos = {
        folio: 'DEMO-' + Date.now().toString(36).toUpperCase(),
        terapia: elegido || 'Terapia elegida',
        fecha: horarioSeleccionado.fecha,
        horario: horarioSeleccionado.hora_inicio.slice(0,5),
        metodo: 'Simulación escolar — sin cobro, reserva pendiente',
        therapy_id: String(terapiaId),
        creado: new Date().toISOString()
      };
      sessionStorage.setItem('lombana_demo_cita',JSON.stringify(datos));
      window.location.assign('cita-demo.html');
      return;
    }
    const funcion = metodo === 'efectivo' ? 'cash-booking' : 'mp-checkout';
    const {data,error} = await supabaseClient.functions.invoke(funcion,{
      body:{therapy_id:String(terapiaId),fecha:horarioSeleccionado.fecha,hora_inicio:horarioSeleccionado.hora_inicio}
    });
    if (error || data?.error) {
      ltEstadoReserva(await ltErrorFuncion(error, data?.error || 'No fue posible procesar la operación. Comprueba las funciones de Supabase.'));
      return;
    }
    if (metodo === 'efectivo' && /^[0-9a-f-]{36}$/i.test(data?.appointment_id || '')) {
      window.location.assign('cita-confirmada.html?id='+encodeURIComponent(data.appointment_id));
    } else if (metodo === 'mercadopago' && /^https:\/\//i.test(data?.checkout_url || '') && /^[0-9a-f-]{36}$/i.test(data?.order_id || '')) {
      const destino = new URL(data.checkout_url);
      if (!['mercadopago.com','mercadopago.com.mx'].some(x=>destino.hostname===x||destino.hostname.endsWith('.'+x))) {
        ltEstadoReserva('La URL de cobro no pertenece a Mercado Pago.'); return;
      }
      sessionStorage.setItem('lombana_payment_order_id',data.order_id);
      window.location.assign(destino.href);
    } else {
      ltEstadoReserva('La respuesta del servidor no contiene datos válidos de confirmación.');
    }
  } catch (error) {
    console.error('Error al agendar o pagar',error);
    ltEstadoReserva('No se pudo procesar la operación. No se mostró una confirmación sin verificarla.');
  } finally { ltProcesando = false; if(boton) boton.disabled = false; }
}
