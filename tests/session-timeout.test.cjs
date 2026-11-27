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
const habilitacion = 'const TIMEOUT_ACTIVO = false;';
const AHORA = Date.parse('2026-11-27T12:00:00Z');
const SESION = {
  access_token: 'token-simulado',
  user: { id: 'usuario-prueba', last_sign_in_at: '2026-11-27T11:00:00Z' }
};
const CLAVE =
  'lombana_ultima_actividad_v2_usuario-prueba_2026-11-27T11:00:00Z';

function entorno({ inactivoMs, fallaCierre = false }) {
  assert.ok(codigo.includes(habilitacion),
    'El módulo de producción debe seguir desactivado');

  // Se activa SOLO una copia EN MEMORIA, nunca el archivo original.
  const codigoSimulado = codigo.replace(
    habilitacion, 'const TIMEOUT_ACTIVO = true;'
  );

  let ahora = AHORA;
  let cierres = 0;
  let redireccion = null;
  let pantalla = null;
  const almacen = new Map([[CLAVE, String(AHORA - inactivoMs)]]);
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
    setInterval() {},
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
        async getSession() { return { data: { session: SESION }, error: null }; },
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
    avanzar(ms) { ahora += ms; },
    evento(nombre) {
      const funcion = eventosDocumento.get(nombre);
      assert.equal(typeof funcion, 'function', `Falta el evento ${nombre}`);
      funcion();
    },
    foco() {
      const funcion = eventosVentana.get('focus');
      assert.equal(typeof funcion, 'function');
      funcion();
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
  const sim = entorno({ inactivoMs: 10 * 60 * 1000 });
  await vaciarMicrotareas();
  sim.evento('pointerdown');
  assert.equal(sim.almacen.get(CLAVE), String(AHORA));
  sim.avanzar(14 * 60 * 1000);
  sim.foco();
  await vaciarMicrotareas();
  assert.equal(sim.cierres, 0);
  assert.equal(sim.redireccion, null);
});

test('Un clic después del vencimiento no renueva la sesión', async () => {
  const sim = entorno({ inactivoMs: 14 * 60 * 1000 + 59 * 1000 });
  await vaciarMicrotareas();
  sim.avanzar(2000);
  sim.evento('pointerdown');
  await vaciarMicrotareas();
  assert.equal(sim.cierres, 1);
  assert.equal(sim.almacen.has(CLAVE), false);
  assert.equal(sim.redireccion, 'login.html?motivo=inactividad');
});

test('Si falla signOut la pantalla queda bloqueada', async () => {
  const sim = entorno({ inactivoMs: 16 * 60 * 1000, fallaCierre: true });
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
