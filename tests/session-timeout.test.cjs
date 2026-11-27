'use strict';

// Pruebas aisladas: no usan red, Docker ni credenciales de Supabase.
// Este archivo se coloca en tests/session-timeout.test.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const archivo = path.resolve(__dirname, '../js/session-timeout.js');
const codigo = fs.readFileSync(archivo, 'utf8');
const habilitacion = "const TIMEOUT_ACTIVO = typeof window !== 'undefined' && window.LOMBANA_CONFIG?.security?.sessionTimeoutEnabled === true;";
const AHORA = Date.parse('2026-11-27T12:00:00Z');
const SESION = {
  access_token: 'token-simulado',
  user: { id: 'usuario-prueba', last_sign_in_at: '2026-11-27T11:00:00Z' }
};
const CLAVE =
  'lombana_ultima_actividad_v2_usuario-prueba_2026-11-27T11:00:00Z';

function claveDe(sesion) {
  return 'lombana_ultima_actividad_v2_' +
    sesion.user.id + '_' + sesion.user.last_sign_in_at;
}

function entorno({
  inactivoMs,
  fallaCierre = false,
  sesion = SESION,
  almacenCompartido = null,
  ahoraInicial = AHORA
}) {
  assert.ok(codigo.includes(habilitacion),
    'La bandera del control debe ser configurable');

  // Se activa SOLO una copia EN MEMORIA, nunca el archivo original.
  const codigoSimulado = codigo.replace(
    habilitacion, 'const TIMEOUT_ACTIVO = true;'
  );

  let ahora = ahoraInicial;
  let cierres = 0;
  let redireccion = null;
  let pantalla = null;
  let monitorIntervalMs = null;
  let monitorCallback = null;
  const almacen = almacenCompartido || new Map();
  const clave = sesion ? claveDe(sesion) : null;
  if (clave && !almacen.has(clave)) {
    almacen.set(clave, String(ahora - inactivoMs));
  }
  const eventosDocumento = new Map();
  const eventosVentana = new Map();

  function elemento(etiqueta) {
    return {
      etiqueta,
      style: {},
      textContent: '',
      hijos: [],
      setAttribute() {},
      append(...hijos) { this.hijos.push(...hijos); }
    };
  }

  const contexto = {
    console: { error() {} },
    Date: class extends Date { static now() { return ahora; } },
    setInterval(callback, ms) {
      monitorIntervalMs = ms;
      monitorCallback = callback;
    },
    localStorage: {
      getItem(clave) { return almacen.has(clave) ? almacen.get(clave) : null; },
      setItem(clave, valor) { almacen.set(clave, String(valor)); },
      removeItem(clave) { almacen.delete(clave); }
    },
    document: {
      hidden: false,
      createElement: elemento,
      body: { replaceChildren(...nodos) { pantalla = nodos; } },
      addEventListener(nombre, funcion) { eventosDocumento.set(nombre, funcion); }
    },
    window: {
      addEventListener(nombre, funcion) { eventosVentana.set(nombre, funcion); },
      location: { replace(destino) { redireccion = destino; } }
    },
    supabaseClient: {
      auth: {
        async getSession() { return { data: { session: sesion }, error: null }; },
        async signOut({ scope }) {
          assert.equal(scope, 'local');
          cierres++;
          return { error: fallaCierre ? new Error('Sin conexión simulada') : null };
        }
      }
    }
  };

  vm.runInNewContext(codigoSimulado, contexto, { timeout: 1000 });

  return {
    almacen,
    clave,
    avanzar(ms) { ahora += ms; },
    evento(nombre) {
      const funcion = eventosDocumento.get(nombre);
      assert.equal(typeof funcion, 'function', `Falta el evento ${nombre}`);
      funcion();
    },
    revisar() {
      if (monitorCallback) monitorCallback();
    },
    get intervaloMs() { return monitorIntervalMs; },
    foco() {
      const funcion = eventosVentana.get('focus');
      assert.equal(typeof funcion, 'function');
      funcion();
    },
    cambioAlmacen(claveModificada = clave) {
      const funcion = eventosVentana.get('storage');
      assert.equal(typeof funcion, 'function');
      funcion({ key: claveModificada });
    },
    get cierres() { return cierres; },
    get redireccion() { return redireccion; },
    get pantalla() { return pantalla; }
  };
}

function vaciarMicrotareas() {
  return new Promise(resolve => setImmediate(resolve));
}

test('Desactivado: no consulta Supabase', () => {
  assert.ok(codigo.includes(habilitacion));
  let consultas = 0;
  vm.runInNewContext(codigo, {
    supabaseClient: {
      auth: { getSession() { consultas++; throw new Error('Consulta inesperada'); } }
    }
  }, { timeout: 1000 });
  assert.equal(consultas, 0);
});

test('Actividad válida renueva el contador sin cerrar sesión', async () => {
  const sim = entorno({ inactivoMs: 10 * 1000 });
  await vaciarMicrotareas();
  sim.evento('pointerdown');
  assert.equal(sim.almacen.get(CLAVE), String(AHORA));
  sim.avanzar(14 * 1000);
  sim.foco();
  await vaciarMicrotareas();
  assert.equal(sim.cierres, 0);
  assert.equal(sim.redireccion, null);
});

test('Un clic después del vencimiento no renueva la sesión', async () => {
  const sim = entorno({ inactivoMs: 29 * 1000 });
  await vaciarMicrotareas();
  sim.avanzar(2000);
  sim.evento('pointerdown');
  await vaciarMicrotareas();
  assert.equal(sim.cierres, 1);
  assert.equal(sim.almacen.has(CLAVE), false);
  assert.equal(sim.redireccion, 'login.html?motivo=inactividad');
});

test('Si falla signOut la pantalla queda bloqueada', async () => {
  const sim = entorno({ inactivoMs: 31 * 1000, fallaCierre: true });
  await vaciarMicrotareas();
  assert.equal(sim.cierres, 1);
  assert.equal(sim.redireccion, null);
  assert.ok(sim.pantalla?.length > 0, 'Debe sustituirse la pantalla');
  assert.ok(
    sim.pantalla[0].hijos.some(n =>
      n.textContent.includes('No se pudo confirmar el cierre de sesión')
    ),
    'Debe mostrar un aviso de cierre no confirmado'
  );
});


test('Varias pestañas comparten actividad de la misma sesión', async () => {
  const tab1 = entorno({ inactivoMs: 10 * 1000 });
  const tab2 = entorno({
    inactivoMs: 10 * 1000,
    almacenCompartido: tab1.almacen
  });
  await vaciarMicrotareas();

  // La primera pestaña está activa, y la segunda se comprueba más tarde.
  tab1.evento('pointerdown');
  tab2.avanzar(14 * 1000);
  tab2.cambioAlmacen();
  await vaciarMicrotareas();

  assert.equal(tab1.almacen.get(tab1.clave), String(AHORA));
  assert.equal(tab2.cierres, 0);
  assert.equal(tab2.redireccion, null);
});

test('Cambiar de cuenta no reutiliza la actividad de otro usuario', async () => {
  const usuarioAnterior = entorno({ inactivoMs: 31 * 1000 });
  await vaciarMicrotareas();
  assert.equal(usuarioAnterior.cierres, 1);

  const nuevaSesion = {
    access_token: 'token-simulado',
    user: {
      id: 'usuario-nuevo',
      last_sign_in_at: '2026-11-27T11:30:00Z'
    }
  };
  const nuevaCuenta = entorno({
    inactivoMs: 10 * 1000,
    sesion: nuevaSesion,
    almacenCompartido: usuarioAnterior.almacen
  });
  await vaciarMicrotareas();

  assert.notEqual(nuevaCuenta.clave, usuarioAnterior.clave);
  assert.equal(nuevaCuenta.cierres, 0);
  assert.equal(nuevaCuenta.redireccion, null);
});

test('Reabrir una pestaña tras 30 segundos no renueva sesión vencida', async () => {
  const primeraApertura = entorno({ inactivoMs: 10 * 1000 });
  await vaciarMicrotareas();
  assert.equal(primeraApertura.cierres, 0);

  const nuevaApertura = entorno({
    inactivoMs: 10 * 1000,
    ahoraInicial: AHORA + 31 * 1000,
    almacenCompartido: primeraApertura.almacen
  });
  await vaciarMicrotareas();

  assert.equal(nuevaApertura.cierres, 1);
  assert.equal(nuevaApertura.redireccion,
    'login.html?motivo=inactividad');
  assert.equal(nuevaApertura.almacen.has(nuevaApertura.clave), false);
});


test('Sin sesión iniciada no se activa el temporizador ni se cierra el acceso', async () => {
  const sim = entorno({ inactivoMs: 0, sesion: null });
  await vaciarMicrotareas();
  assert.equal(sim.intervaloMs, null);
  assert.equal(sim.cierres, 0);
  assert.equal(sim.redireccion, null);
});

test('A los 29 segundos no se cierra, al llegar a 30 segundos sí', async () => {
  const sim = entorno({ inactivoMs: 0 });
  await vaciarMicrotareas();
  assert.equal(sim.intervaloMs, 1000, 'Revisar cada segundo');
  sim.avanzar(29_000);
  sim.revisar();
  await vaciarMicrotareas();
  assert.equal(sim.cierres, 0);
  sim.avanzar(1000);
  sim.revisar();
  await vaciarMicrotareas();
  assert.equal(sim.cierres, 1);
  assert.equal(sim.redireccion, 'login.html?motivo=inactividad');
});

test('Desplazamiento y movimiento de puntero reinician la inactividad', async () => {
  const sim = entorno({ inactivoMs: 10_000 });
  await vaciarMicrotareas();

  sim.avanzar(15_000);
  sim.evento('scroll');
  assert.equal(sim.almacen.get(sim.clave), String(AHORA + 15_000));

  sim.avanzar(29_000);
  sim.evento('pointermove');
  await vaciarMicrotareas();
  assert.equal(sim.cierres, 0);

  sim.avanzar(29_000);
  sim.revisar();
  await vaciarMicrotareas();
  assert.equal(sim.cierres, 0);
});

test('Cuando la ventana recupera el foco se comprueba el tiempo vencido', async () => {
  const sim = entorno({ inactivoMs: 0 });
  await vaciarMicrotareas();
  sim.avanzar(31_000);
  sim.foco();
  await vaciarMicrotareas();
  assert.equal(sim.cierres, 1);
});

test('Desactivado por bandera no consulta al proveedor de sesión', () => {
  let consultas = 0;
  vm.runInNewContext(codigo, {
    window: { LOMBANA_CONFIG: { security: { sessionTimeoutEnabled: false } } },
    supabaseClient: { auth: { getSession() { consultas++; } } }
  }, { timeout: 1000 });
  assert.equal(consultas, 0);
});

test('El límite configurado es exactamente de 30 segundos', () => {
  assert.match(codigo, /const TIMEOUT_SEGUNDOS = 30;/);
  assert.match(codigo, /const TIMEOUT_MS = TIMEOUT_SEGUNDOS \* 1000;/);
});
