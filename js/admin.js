document.addEventListener('DOMContentLoaded', async function () {
  const autorizado = await protegerAdmin();

  if (!autorizado) {
    return;
  }

  cargarPreciosTerapias();
});
async function protegerAdmin() {
  const { data: sessionData } = await supabaseClient.auth.getSession();

  if (!sessionData.session) {
    alert('Debes iniciar sesión.');
    window.location.href = 'login.html';
    return false;
  }

  const user = sessionData.session.user;

  const { data: perfil, error } = await supabaseClient
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (error || !perfil || perfil.rol !== 'admin') {
    alert('No tienes permiso para entrar al panel del terapeuta.');
    window.location.href = 'index.html';
    return false;
  }

  cargarCitasAdmin();

  return true;
}

async function cargarCitasAdmin() {
  const tbody = document.getElementById('tabla-citas');
  const fechaFiltro = document.getElementById('fecha-citas')?.value;

  tbody.innerHTML = `
    <tr>
      <td colspan="7">Cargando citas...</td>
    </tr>
  `;

  let query = supabaseClient
    .from('appointments')
    .select(`
      id,
      fecha,
      hora_inicio,
      status,
      therapies (
        nombre
      ),
      profiles (
        nombre,
        telefono
      )
    `)
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (fechaFiltro) {
    query = query.eq('fecha', fechaFiltro);
  }

  const { data, error } = await query;

  if (error) {
    tbody.replaceChildren();
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7; td.textContent = 'No fue posible cargar citas. Verifica los permisos de acceso.';
    tr.appendChild(td); tbody.appendChild(tr);
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">No hay citas registradas.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';

  data.forEach(cita => {
    const tr = document.createElement('tr');
    const add = value => { const td=document.createElement('td');td.textContent=String(value??'');tr.appendChild(td);return td; };
    add(cita.fecha);
    add(formatearHora(cita.hora_inicio));
    add(cita.therapies?.nombre || 'Sin terapia');
    add(cita.profiles?.nombre || 'Sin paciente');
    add(cita.profiles?.telefono || '');
    add(cita.status);
    const acciones=document.createElement('td');
    if(normalizarTexto(cita.status || '') === 'cancelada'){
      const status=document.createElement('span');status.className='status-cancelada';status.textContent='Cancelada';acciones.appendChild(status);
    } else {
      const boton=document.createElement('button');boton.type='button';boton.className='btn-danger';boton.textContent='Cancelar cita';boton.addEventListener('click',()=>cancelarCita(cita.id));acciones.appendChild(boton);
    }
    tr.appendChild(acciones);tbody.appendChild(tr);
  });
}

async function cerrarSesion() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}

function formatearHora(hora) {
  if (!hora) return '';
  return hora.substring(0, 5);
}
async function cancelarCita(id) {
  const confirmar = confirm(
    '¿Seguro que deseas cancelar esta cita? La cita permanecerá guardada en el historial.'
  );

  if (!confirmar) {
    return;
  }

  const { error } = await supabaseClient
    .from('appointments')
    .update({
      status: 'cancelada'
    })
    .eq('id', id);

  if (error) {
    alert('Error al cancelar la cita: ' + error.message);
    return;
  }

  alert('Cita cancelada correctamente.');

  cargarCitasAdmin();

  const inicio = document.getElementById('fecha-inicio')?.value;
  const fin = document.getElementById('fecha-fin')?.value;

  if (inicio && fin) {
    cargarDashboard();
  }
}
async function cargarPreciosTerapias() {
  const contenedor = document.getElementById('lista-precios-terapias');

  if (!contenedor) return;

  const { data, error } = await supabaseClient
    .from('therapies')
    .select('id, nombre, precio')
    .order('nombre', { ascending: true });

  if (error) {
    contenedor.innerHTML = `<p>Error al cargar terapias: ${error.message}</p>`;
    return;
  }

  contenedor.innerHTML = '';

  data.forEach(terapia => {
    const div = document.createElement('div');div.classList.add('precio-terapia-row');
    const label=document.createElement('label');label.textContent=terapia.nombre||'Terapia';
    const input=document.createElement('input');input.type='text';input.id=`precio-${terapia.id}`;input.value=terapia.precio||'';
    const btn=document.createElement('button');btn.type='button';btn.textContent='Guardar';btn.addEventListener('click',()=>actualizarPrecioTerapia(terapia.id));
    div.append(label,input,btn);contenedor.appendChild(div);
  });
}

async function actualizarPrecioTerapia(id) {
  const input = document.getElementById(`precio-${id}`);
  const nuevoPrecio = input.value.trim();

  const { error } = await supabaseClient
    .from('therapies')
    .update({ precio: nuevoPrecio })
    .eq('id', id);

  if (error) {
    alert('Error al actualizar precio: ' + error.message);
    return;
  }

  alert('Precio actualizado correctamente.');
}
async function cargarDashboard() {
  const inicio = document.getElementById('fecha-inicio').value;
  const fin = document.getElementById('fecha-fin').value;

  if (!inicio || !fin) {
    alert('Selecciona fecha inicio y fecha fin.');
    return;
  }

  const { data, error } = await supabaseClient
    .from('appointments')
    .select(`
      id,
      fecha,
      hora_inicio,
      status,
      therapies (
        nombre,
        precio
      ),
      profiles (
        nombre,
        genero
      )
    `)
    .gte('fecha', inicio)
    .lte('fecha', fin)
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (error) {
    alert('Error al cargar dashboard: ' + error.message);
    return;
  }

  const citas = data || [];

  const citasCanceladas = citas.filter(cita => {
    return normalizarTexto(cita.status || '') === 'cancelada';
  });

  const citasValidas = citas.filter(cita => {
    return normalizarTexto(cita.status || '') !== 'cancelada';
  });

  mostrarMasFrecuente(
    citasValidas,
    'terapia-mas-agendada',
    cita => cita.therapies?.nombre || 'Sin terapia'
  );

  mostrarMasFrecuente(
    citasValidas,
    'cliente-mas-frecuente',
    cita => cita.profiles?.nombre || 'Sin cliente'
  );

  mostrarMasFrecuente(
    citasValidas,
    'genero-mas-agenda',
    cita => cita.profiles?.genero || 'Sin género'
  );

  mostrarMasFrecuente(
    citasValidas,
    'dia-mas-agendado',
    cita => obtenerNombreDia(cita.fecha)
  );

  calcularGanancias(citasValidas);
  mostrarCancelaciones(citasCanceladas);
}
function calcularGanancias(citas) {
  let totalGanancias = 0;

  citas.forEach(cita => {
    const nombreTerapia = normalizarTexto(cita.therapies?.nombre || '');

    if (nombreTerapia.includes('aromaterapia')) {
      return;
    }

    const precio = convertirPrecioANumero(cita.therapies?.precio);

    totalGanancias += precio;
  });

  const elementoGanancias = document.getElementById('ganancias-totales');

  elementoGanancias.textContent = formatearDinero(totalGanancias);
}
function mostrarCancelaciones(citasCanceladas) {
  const contador = document.getElementById('total-cancelaciones');
  const tabla = document.getElementById('tabla-cancelaciones');

  const total = citasCanceladas.length;

  contador.textContent =
    total === 1
      ? '1 cancelación'
      : `${total} cancelaciones`;

  if (total === 0) {
    tabla.innerHTML = `
      <tr>
        <td colspan="5">No hubo citas canceladas en este rango de fechas.</td>
      </tr>
    `;
    return;
  }

  tabla.innerHTML = '';

  citasCanceladas.forEach(cita => {
    const fila=document.createElement('tr');
    for(const valor of [cita.fecha,formatearHora(cita.hora_inicio),cita.profiles?.nombre||'Sin paciente',cita.therapies?.nombre||'Sin terapia',cita.status]){
      const celda=document.createElement('td');celda.textContent=String(valor??'');fila.appendChild(celda);
    }
    tabla.appendChild(fila);
  });
}
function convertirPrecioANumero(precio) {
  if (precio === null || precio === undefined || precio === '') {
    return 0;
  }

  if (typeof precio === 'number') {
    return precio;
  }

  const precioLimpio = String(precio).replace(/[^\d.-]/g, '');
  const precioNumerico = Number(precioLimpio);

  return isNaN(precioNumerico) ? 0 : precioNumerico;
}

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatearDinero(cantidad) {
  return cantidad.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN'
  });
}
function mostrarMasFrecuente(data, elementoId, obtenerValor) {
  const conteo = {};

  data.forEach(item => {
    const valor = obtenerValor(item);
    conteo[valor] = (conteo[valor] || 0) + 1;
  });

  let mayorValor = 'Sin datos';
  let mayorCantidad = 0;

  Object.keys(conteo).forEach(valor => {
    if (conteo[valor] > mayorCantidad) {
      mayorValor = valor;
      mayorCantidad = conteo[valor];
    }
  });

  document.getElementById(elementoId).textContent =
    mayorCantidad > 0
      ? `${mayorValor} (${mayorCantidad} citas)`
      : 'Sin datos';
}

function obtenerNombreDia(fechaTexto) {
  const fecha = new Date(fechaTexto + 'T00:00:00');

  const dias = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado'
  ];

  return dias[fecha.getDay()];
}