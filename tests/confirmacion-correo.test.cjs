'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/confirmar-correo.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'confirmar-correo.html'), 'utf8');

const token = 'a'.repeat(64);

function crearContexto({ tokenHash = token, falla = false } = {}) {
  const llamadas = [];
  const datos = [];
  const boton = {
    disabled: false,
    hidden: false,
    addEventListener(evento, fn) {
      assert.equal(evento, 'click');
      this.click = fn;
    }
  };
  const estado = { textContent: '' };
  const window = {
    location: {
      search: tokenHash === null ? '' : '?token_hash=' + tokenHash,
      pathname: '/lombana-therapy/confirmar-correo.html'
    },
    history: {
      replaceState(...args) {
        datos.push(args);
      }
    }
  };
  const document = {
    readyState: 'complete',
    getElementById(id) {
      if (id === 'btn-confirmar-correo') return boton;
      if (id === 'estado-confirmacion') return estado;
      return null;
    }
  };
  const supabaseClient = {
    auth: {
      async verifyOtp(args) {
        llamadas.push(args);
        return { data: {}, error: falla ? new Error('Token expirado') : null };
      }
    }
  };
  vm.runInNewContext(source, {
    document, window, URLSearchParams, supabaseClient
  }, { filename: 'js/confirmar-correo.js' });
  return { boton, estado, llamadas, datos, window };
}

test('Abrir o previsualizar un enlace no consume el token', () => {
  const e = crearContexto();
  assert.equal(e.llamadas.length, 0);
  assert.equal(e.boton.disabled, false);
  assert.match(e.estado.textContent, /Pulsa/);
});

test('El token se oculta de la barra sin imprimir su valor', () => {
  const e = crearContexto();
  assert.equal(e.datos.length, 1);
  assert.equal(e.datos[0][2], '/lombana-therapy/confirmar-correo.html');
  assert.equal(e.estado.textContent.includes(token), false);
});

test('Un clic explícito verifica el token_hash con type email', async () => {
  const e = crearContexto();
  await e.boton.click();
  assert.equal(e.llamadas.length, 1);
  assert.equal(e.llamadas[0].token_hash, token);
  assert.equal(e.llamadas[0].type, 'email');
  assert.match(e.estado.textContent, /correo quedó confirmado/);
  assert.equal(e.boton.hidden, true);
});

test('Clics repetidos no generan verificaciones adicionales', async () => {
  const e = crearContexto();
  await e.boton.click();
  await e.boton.click();
  assert.equal(e.llamadas.length, 1);
});

test('Enlace sin token deja el botón desactivado', () => {
  const e = crearContexto({ tokenHash: null });
  assert.equal(e.boton.disabled, true);
  assert.match(e.estado.textContent, /no es válido/);
  assert.equal(e.llamadas.length, 0);
});

test('Token que no cumple formato no se envía a Supabase', () => {
  const e = crearContexto({ tokenHash: 'invalido' });
  assert.equal(e.boton.disabled, true);
  assert.equal(e.llamadas.length, 0);
});

test('Token caducado informa cómo solicitar otro enlace', async () => {
  const e = crearContexto({ falla: true });
  await e.boton.click();
  assert.match(e.estado.textContent, /solicita otro enlace/);
  assert.equal(e.boton.hidden, true);
});

test('HTML carga el SDK y verifica solo con interacción del usuario', () => {
  assert.match(html, /id="btn-confirmar-correo"/);
  assert.match(html, /type="button"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.match(html, /href="reenviar-confirmacion\.html"/);
  const sdk = html.indexOf('src="js/supabase.js"');
  const confirmacion = html.indexOf('src="js/confirmar-correo.js"');
  assert.ok(sdk >= 0 && confirmacion > sdk);
  assert.doesNotMatch(html, /src="js\/session-timeout.js"/);
});

test('Guía de la plantilla mantiene token de un solo uso sin confirmar en precarga', () => {
  const docs = fs.readFileSync(path.join(root, 'docs/CORRECCION_ENLACES_CONFIRMACION.md'), 'utf8');
  assert.match(docs, /confirmar-correo\.html\?token_hash=\{\{ \.TokenHash \}\}/);
  assert.match(docs, /No activar la plantilla/);
});

test('El acceso Google OAuth original no se ha sustituido', () => {
  const auth = fs.readFileSync(path.join(root, 'js/auth.js'), 'utf8');
  assert.match(auth, /provider: 'google'/);
  assert.match(auth, /signInWithPassword/);
  assert.match(auth, /auth\.signUp/);
});
