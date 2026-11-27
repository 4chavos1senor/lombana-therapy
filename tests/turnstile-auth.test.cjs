'use strict';

/**
 * Lombana Therapy — pruebas locales de CAPTCHA para inicio de sesion y registro.
 * No requiere Supabase ni Cloudflare; ejecuta js/auth.js con dependencias simuladas.
 * Copiar a tests/turnstile-auth.test.cjs y ejecutar:
 * node --test .\tests\turnstile-auth.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const authFile = path.resolve(__dirname, '..', 'js', 'auth.js');
const authCode = fs.readFileSync(authFile, 'utf8');

function prepararEscenario({ captchaActivo = false, token = null, conCaptcha = true } = {}) {
  const llamadas = { login: [], registro: [], reinicios: 0, avisos: [] };
  const valores = {
    nombre: { value: 'Paciente Prueba' },
    telefono: { value: '5555555555' },
    genero: { value: 'otro' },
    email: { value: 'prueba@example.test' },
    password: { value: 'ClaveSeguraPrueba123' }
  };
  const window = {
    location: { href: 'https://ejemplo.test/registro.html', search: '' }
  };
  if (conCaptcha) {
    window.LombanaTurnstile = {
      estaActivo: () => captchaActivo,
      obtenerToken: () => token,
      reiniciar: () => { llamadas.reinicios++; }
    };
  }
  const contexto = {
    window,
    document: {
      getElementById: id => {
        assert.ok(id in valores, `Elemento no simulado: ${id}`);
        return valores[id];
      }
    },
    alert: mensaje => llamadas.avisos.push(String(mensaje)),
    supabaseClient: {
      auth: {
        async signInWithPassword(credenciales) {
          llamadas.login.push(credenciales);
          return { error: { message: 'Error simulado, sin autenticacion real' } };
        },
        async signUp(credenciales) {
          llamadas.registro.push(credenciales);
          return { data: null, error: { message: 'Error simulado, sin crear cuentas' } };
        }
      }
    },
    URL,
    URLSearchParams,
    console
  };
  vm.runInNewContext(authCode, contexto, { filename: 'js/auth.js' });
  const evento = () => ({ preventDefault() {} });
  return { contexto, llamadas, evento };
}

test('Login sin CAPTCHA mantiene la llamada original', async () => {
  const { contexto, llamadas, evento } = prepararEscenario({ conCaptcha: false });
  await contexto.iniciarSesion(evento());
  assert.equal(llamadas.login.length, 1);
  assert.equal(llamadas.login[0].email, 'prueba@example.test');
  assert.equal(llamadas.login[0].password, 'ClaveSeguraPrueba123');
  assert.equal(lamadasOpciones(llamadas.login[0]), false);
});

test('Login con CAPTCHA activo sin token no consulta autenticacion', async () => {
  const { contexto, llamadas, evento } = prepararEscenario({ captchaActivo: true });
  await contexto.iniciarSesion(evento());
  assert.equal(llamadas.login.length, 0);
  assert.equal(llamadas.reinicios, 0);
  assert.ok(llamadas.avisos.some(x => /verificaci[oó]n/i.test(x)));
});

test('Login con token adjunta captchaToken y reinicia el widget', async () => {
  const { contexto, llamadas, evento } = prepararEscenario({ captchaActivo: true, token: 'token-simulado' });
  await contexto.iniciarSesion(evento());
  assert.equal(llamadas.login.length, 1);
  assert.equal(llamadas.login[0].options?.captchaToken, 'token-simulado');
  assert.equal(llamadas.reinicios, 1);
});

test('Registro sin CAPTCHA conserva metadatos y redireccion', async () => {
  const { contexto, llamadas, evento } = prepararEscenario({ conCaptcha: false });
  await contexto.registrarUsuario(evento());
  assert.equal(llamadas.registro.length, 1);
  const parametros = llamadas.registro[0];
  assert.equal(parametros.email, 'prueba@example.test');
  assert.equal(parametros.password, 'ClaveSeguraPrueba123');
  assert.equal(parametros.options.data.nombre, 'Paciente Prueba');
  assert.equal(parametros.options.data.telefono, '5555555555');
  assert.equal(parametros.options.data.genero, 'otro');
  assert.equal(parametros.options.emailRedirectTo, 'https://ejemplo.test/login.html');
  assert.equal(Object.hasOwn(parametros.options, 'captchaToken'), false);
});

test('Registro con CAPTCHA activo sin token no crea cuentas', async () => {
  const { contexto, llamadas, evento } = prepararEscenario({ captchaActivo: true });
  await contexto.registrarUsuario(evento());
  assert.equal(llamadas.registro.length, 0);
  assert.equal(llamadas.reinicios, 0);
});

test('Registro con token envia captchaToken y conserva metadatos', async () => {
  const { contexto, llamadas, evento } = prepararEscenario({ captchaActivo: true, token: 'token-registro' });
  await contexto.registrarUsuario(evento());
  assert.equal(llamadas.registro.length, 1);
  const parametros = llamadas.registro[0];
  assert.equal(parametros.options.captchaToken, 'token-registro');
  assert.equal(parametros.options.data.nombre, 'Paciente Prueba');
  assert.equal(parametros.options.emailRedirectTo, 'https://ejemplo.test/login.html');
  assert.equal(llamadas.reinicios, 1);
});

function lamadasOpciones(credenciales) {
  return Object.hasOwn(credenciales, 'options');
}
