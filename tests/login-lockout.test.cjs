'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const codigo = fs.readFileSync(path.join(root, 'js/login-lockout.js'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'js/auth.js'), 'utf8');

function escenario() {
  let ahora = Date.parse('2026-11-27T12:00:00Z');
  const almacenamiento = new Map();
  const avisos = [];
  const estadoVisual = { hidden: true, textContent: '', dataset: {} };
  const boton = { disabled: false };
  const correo = { value: 'prueba@example.test', addEventListener() {} };
  const contrasena = { value: 'Contraseña-Incorrecta' };
  const documento = {
    readyState: 'complete',
    getElementById(id) {
      return ({
        email: correo,
        password: contrasena,
        'btn-entrar': boton,
        'aviso-bloqueo-login': estadoVisual
      })[id] || null;
    },
    addEventListener() {}
  };
  const window = {
    localStorage: {
      getItem(k) { return almacenamiento.has(k) ? almacenamiento.get(k) : null; },
      setItem(k, v) { almacenamiento.set(k, String(v)); },
      removeItem(k) { almacenamiento.delete(k); }
    },
    addEventListener() {},
    setInterval() {},
    alert(texto) { avisos.push(texto); },
    location: { search: '', href: 'https://test.example/login.html' }
  };
  const reloj = class extends Date {
    static now() { return ahora; }
  };
  const contexto = { window, document: documento, Date: reloj, URL, URLSearchParams };
  vm.runInNewContext(codigo, contexto, { filename: 'js/login-lockout.js' });
  return {
    api: window.LombanaLoginLockout, window, documento,
    almacenamiento, avisos, estadoVisual, boton, correo, contrasena,
    avanzar: milisegundos => { ahora += milisegundos; }
  };
}

test('Dos fallos dejan dos y un intento restante', () => {
  const e = escenario();
  assert.equal(e.api.registrarFallo('prueba@example.test').restantes, 2);
  assert.equal(e.api.registrarFallo('prueba@example.test').restantes, 1);
  assert.equal(e.api.estado('prueba@example.test').bloqueado, false);
});

test('Tres fallos bloquean localmente por exactamente un minuto', () => {
  const e = escenario();
  for (let i = 0; i < 2; i++) e.api.registrarFallo(e.correo.value);
  const s = e.api.registrarFallo(e.correo.value);
  assert.equal(s.bloqueado, true);
  assert.equal(s.minutos, 1);
  assert.equal(s.segundos, 60);
  e.avanzar(59_000);
  assert.equal(e.api.estado(e.correo.value).bloqueado, true);
  e.avanzar(1_000);
  assert.equal(e.api.estado(e.correo.value).bloqueado, false);
});

test('Después del primer bloqueo otros tres fallos bloquean por dos minutos', () => {
  const e = escenario();
  for (let i = 0; i < 3; i++) e.api.registrarFallo(e.correo.value);
  e.avanzar(60_000);
  for (let i = 0; i < 2; i++) {
    assert.equal(e.api.registrarFallo(e.correo.value).bloqueado, false);
  }
  const segundo = e.api.registrarFallo(e.correo.value);
  assert.equal(segundo.minutos, 2);
  assert.equal(segundo.segundos, 120);
  e.avanzar(119_000);
  assert.equal(e.api.estado(e.correo.value).bloqueado, true);
  e.avanzar(1_000);
  assert.equal(e.api.estado(e.correo.value).bloqueado, false);
});

test('Una cuenta distinta no comparte el contador local', () => {
  const e = escenario();
  for (let i = 0; i < 3; i++) e.api.registrarFallo('prueba@example.test');
  assert.equal(e.api.estado('prueba@example.test').bloqueado, true);
  assert.equal(e.api.estado('otra@example.test').bloqueado, false);
});

test('Un inicio correcto reinicia contador y escalamiento', () => {
  const e = escenario();
  for (let i = 0; i < 3; i++) e.api.registrarFallo(e.correo.value);
  e.avanzar(60_000);
  e.api.registrarExito(e.correo.value);
  for (let i = 0; i < 2; i++) e.api.registrarFallo(e.correo.value);
  assert.equal(e.api.registrarFallo(e.correo.value).minutos, 1);
});

test('El aviso de bloqueo es visible y también abre alerta', () => {
  const e = escenario();
  for (let i = 0; i < 3; i++) e.api.registrarFallo(e.correo.value);
  e.api.avisar('Bloqueo temporal por 1 minuto.', true);
  assert.equal(e.avisos.length, 1);
  assert.match(e.avisos[0], /1 minuto/);
  assert.equal(e.estadoVisual.hidden, false);
  assert.equal(e.boton.disabled, true);
  e.avanzar(60_000);
  e.api.refrescar();
  assert.equal(e.boton.disabled, false);
});

test('El estado no guarda directamente la dirección de correo', () => {
  const e = escenario();
  e.api.registrarFallo('prueba@example.test');
  const almacen = JSON.stringify([...e.almacenamiento.entries()]);
  assert.ok(!almacen.includes('prueba@example.test'));
});

test('El login muestra advertencias solo con invalid_credentials y mantiene OAuth', async () => {
  const e = escenario();
  const llamadas = { password: 0, oauth: 0 };
  const alertas = [];
  const client = {
    auth: {
      async signInWithPassword() {
        llamadas.password++;
        return { error: { code: 'invalid_credentials', message: 'Credenciales incorrectas' } };
      },
      async signInWithOAuth() {
        llamadas.oauth++;
        return { error: null };
      }
    }
  };
  const c = {
    window: e.window,
    document: e.documento,
    supabaseClient: client,
    alert: s => alertas.push(s),
    console: { error() {} },
    URL,
    URLSearchParams
  };
  vm.runInNewContext(auth, c, { filename: 'js/auth.js' });
  const evento = { preventDefault() {} };
  await c.iniciarSesion(evento);
  await c.iniciarSesion(evento);
  await c.iniciarSesion(evento);
  assert.equal(llamadas.password, 3);
  assert.equal(e.api.estado(e.correo.value).bloqueado, true);
  assert.equal(e.avisos.length, 1);
  assert.match(e.avisos[0], /1 minuto/);
  await c.iniciarSesion(evento);
  assert.equal(llamadas.password, 3, 'No se envían más intentos durante el bloqueo');
  await c.iniciarSesionConGoogle();
  assert.equal(llamadas.oauth, 1, 'Google OAuth permanece independiente');
});

test('Errores de conexión no se cuentan como contraseñas incorrectas', async () => {
  const e = escenario();
  const c = {
    window: e.window, document: e.documento, URL, URLSearchParams,
    alert() {}, console: { error() {} },
    supabaseClient: { auth: {
      async signInWithPassword() { throw new Error('Sin red'); }
    } }
  };
  vm.runInNewContext(auth, c);
  await c.iniciarSesion({ preventDefault() {} });
  assert.equal(e.api.estado(e.correo.value).restantes, 3);
});

test('Errores de rate limit de Supabase no cuentan como contraseña incorrecta', async () => {
  const e = escenario();
  const c = {
    window: e.window, document: e.documento, URL, URLSearchParams,
    alert() {}, console: { error() {} },
    supabaseClient: { auth: {
      async signInWithPassword() {
        return { error: { code: 'over_request_rate_limit', message: 'Limitado' } };
      }
    } }
  };
  vm.runInNewContext(auth, c);
  await c.iniciarSesion({ preventDefault() {} });
  assert.equal(e.api.estado(e.correo.value).restantes, 3);
});

test('Formulario de reenvío mantiene resend de signup y comunica el límite', () => {
  const html = fs.readFileSync(path.join(root, 'reenviar-confirmacion.html'), 'utf8');
  assert.match(html, /supabaseClient\.auth\.resend/);
  assert.match(html, /type: 'signup'/);
  assert.match(html, /emailRedirectTo/);
  assert.match(html, /email_address_not_authorized/);
  assert.match(html, /over_email_send_rate_limit/);
  assert.match(html, /Si accediste con Google/);
});

test('Botón Google sigue siendo independiente del formulario de contraseña', () => {
  const html = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
  assert.match(html, /onclick="iniciarSesionConGoogle\(\)"/);
  assert.match(html, /<button\s+type="button"[\s\S]*?Continuar con Google/);
  assert.match(html, /src="js\/login-lockout\.js"/);
  assert.ok(html.indexOf('src="js/login-lockout.js"') <
    html.indexOf('src="js/auth.js"'));
  assert.match(html, /id="aviso-bloqueo-login"/);
});
