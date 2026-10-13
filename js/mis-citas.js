document.addEventListener('DOMContentLoaded', function () {
  cargarMisCitas();
});

async function cargarMisCitas() {
  const contenedor = document.getElementById('mis-citas-container');

  contenedor.innerHTML = '<p>Cargando citas...</p>';

  const { data: sessionData, error: sessionError } =
    await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    alert('Debes iniciar sesión para ver tus citas.');
    window.location.href = 'login.html?redirect=mis-citas.html';
    return;
  }

  const user = sessionData.session.user;

  const { data: citas, error } = await supabaseClient
    .from('appointments')
    .select(`
      id,
      fecha,
      hora_inicio,
      status,
      therapies (
        nombre
      )
    `)
    .eq('user_id', user.id)
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (error) {
    contenedor.textContent = 'No se pudieron cargar las citas. Intenta nuevamente.';
    return;
  }

  if (!citas || citas.length === 0) {
    contenedor.innerHTML = '<p>No tienes citas registradas.</p>';
    return;
  }

  contenedor.innerHTML = '';

  citas.forEach(cita => {
    const tarjeta = document.createElement('div');
    tarjeta.classList.add('admin-box');

    const nombreTerapia = cita.therapies?.nombre || 'Terapia';
    const estado = normalizarTexto(cita.status || '');
    const estaCancelada = estado === 'cancelada';

    const titulo = document.createElement('h3');
    titulo.textContent = nombreTerapia;
    const detalle = (etiqueta, valor) => {
      const parrafo = document.createElement('p');
      const negrita = document.createElement('strong');
      negrita.textContent = etiqueta + ': ';
      parrafo.append(negrita, document.createTextNode(valor));
      return parrafo;
    };
    const estadoTexto = document.createElement('p');
    const estadoEtiqueta = document.createElement('strong');
    estadoEtiqueta.textContent = 'Estado: ';
    const estadoSpan = document.createElement('span');
    estadoSpan.className = estaCancelada ? 'status-cancelada' : 'status-confirmada';
    estadoSpan.textContent = estaCancelada ? 'Cancelada' : 'Confirmada';
    estadoTexto.append(estadoEtiqueta, estadoSpan);
    tarjeta.append(titulo, detalle('Fecha', cita.fecha || ''),
      detalle('Hora', formatearHora(cita.hora_inicio)), estadoTexto);
    if (estaCancelada) {
      const aviso = document.createElement('p');
      aviso.textContent = 'Esta cita fue cancelada.';
      tarjeta.appendChild(aviso);
    } else {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'btn-danger';
      boton.textContent = 'Cancelar cita';
      boton.addEventListener('click', () => cancelarMiCita(cita.id));
      tarjeta.appendChild(boton);
    }

    contenedor.appendChild(tarjeta);
  });
}

async function cancelarMiCita(id) {
  const confirmar = confirm(
    '¿Seguro que deseas cancelar esta cita? El horario quedará disponible nuevamente.'
  );

  if (!confirmar) {
    return;
  }

  const { data: sessionData, error: sessionError } =
    await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    alert('Tu sesión ha expirado. Inicia sesión nuevamente.');
    window.location.href = 'login.html?redirect=mis-citas.html';
    return;
  }

  const user = sessionData.session.user;

  const { data, error } = await supabaseClient
    .from('appointments')
    .update({
      status: 'cancelada'
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .neq('status', 'cancelada')
    .select('id');

  if (error) {
    alert('Error al cancelar la cita: ' + error.message);
    return;
  }

  if (!data || data.length === 0) {
    alert('La cita ya estaba cancelada o no pudo ser modificada.');
    cargarMisCitas();
    return;
  }

  alert('Tu cita fue cancelada correctamente.');

  cargarMisCitas();
}

function formatearHora(hora) {
  if (!hora) {
    return '';
  }

  return hora.substring(0, 5);
}

function normalizarTexto(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}