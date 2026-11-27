'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

// Pruebas sin red: no se crean usuarios ni se envían correos reales.
const html = fs.readFileSync(path.resolve(__dirname, '..', 'reenviar-confirmacion.html'), 'utf8');
const match = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/);

function preparar({ activo = false, token = null, respuesta = { error: null } } = {}) {
  const llamadas = [];
  let reinicios = 0;
  let submit;
  const elementos = {
    correo: { value: 'prueba@example.test' },
    'btn-reenviar': { disabled: false },
    mensaje: { textContent: '' },
    'form-confirmacion': { addEventListener: (_, listener) => { submit = listener; } }
  };
  const contexto = {
    document: { getElementById: id => elementos[id] },
    window: {
      location: { href: 'https://ejemplo.test/reenviar-confirmacion.html' },
      LombanaTurnstile: {
        estaActivo: () => activo,
        obtenerToken: () => token,
        reiniciar: () => { reinicios++; }
      }
    },
    supabaseClient: {
      auth: { resend: async data => { llamadas.push(data); return respuesta; } }
    },
    URL,
    console: { warn() {} }
  };
  assert.ok(match, 'Debe existir el script de reenvío');
  vm.runInNewContext(match[1], contexto);
  return { enviar: async () => submit({ preventDefault() {} }), llamadas, elementos, reinicios: () => reinicios };
}

test('El CAPTCHA aparece dentro del formulario y el script se carga', () => {
  assert.ok(html.indexOf('id="contenedor-captcha"') > html.indexOf('id="correo"'));
  assert.ok(html.indexOf('id="contenedor-captcha"') < html.indexOf('id="btn-reenviar"'));
  assert.ok(html.includes('<script src="js/turnstile.js"></script>'));
});

test('Sin CAPTCHA activo conserva el reenvío sin token', async () => {
  const s = preparar();
  await s.enviar();
  assert.equal(s.llamadas.length, 1);
  assert.equal(Object.hasOwn(s.llamadas[0].options, 'captchaToken'), false);
  assert.equal(s.reinicios(), 0);
});

test('CAPTCHA activo sin token impide reenvío', async () => {
  const s = preparar({ activo: true });
  await s.enviar();
  assert.equal(s.llamadas.length, 0);
  assert.match(s.elementos.mensaje.textContent, /verificaci[oó]n/i);
  assert.equal(s.elementos['btn-reenviar'].disabled, false);
});

test('CAPTCHA activo envía token y lo reinicia', async () => {
  const s = preparar({ activo: true, token: 'token-simulado' });
  await s.enviar();
  assert.equal(s.llamadas[0].options.captchaToken, 'token-simulado');
  assert.equal(s.reinicios(), 1);
  assert.equal(s.elementos['btn-reenviar'].disabled, false);
});

test('Error de Supabase reinicia token y habilita botón', async () => {
  const s = preparar({
    activo: true,
    token: 'token-simulado',
    respuesta: { error: { code: 'over_email_send_rate_limit', status: 429 } }
  });
  await s.enviar();
  assert.equal(s.reinicios(), 1);
  assert.equal(s.elementos['btn-reenviar'].disabled, false);
  assert.match(s.elementos.mensaje.textContent, /l[ií]mite/i);
});
