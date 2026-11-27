'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const raiz = path.resolve(__dirname, '..');
const leer = archivo => fs.readFileSync(path.join(raiz, archivo), 'utf8');

function crearMfa({ activo = false, nivel = { currentLevel: 'aal1', nextLevel: 'aal2' } } = {}) {
  const llamadas = { nivel: 0, enroll: [], challenge: [], verify: [] };
  const respuesta = {
    auth: {
      mfa: {
        async getAuthenticatorAssuranceLevel() {
          llamadas.nivel++;
          return { data: nivel, error: null };
        },
        async listFactors() {
          return { data: { totp: [
            { id: 'verificado', status: 'verified' },
            { id: 'pendiente', status: 'unverified' }
          ] }, error: null };
        },
        async enroll(datos) {
          llamadas.enroll.push(datos);
          return {
            data: { id: 'nuevo-factor', totp: { qr_code: 'data:image/svg+xml;base64,AAA' } },
            error: null
          };
        },
        async challenge(datos) {
          llamadas.challenge.push(datos);
          return { data: { id: 'reto-1' }, error: null };
        },
        async verify(datos) {
          llamadas.verify.push(datos);
          return { error: null };
        }
      }
    }
  };
  const window = { LOMBANA_CONFIG: { security: { mfaEnabled: activo } } };
  vm.runInNewContext(leer('js/mfa.js'), { window, supabaseClient: respuesta });
  return { api: window.LombanaMFA, llamadas };
}

test('MFA apagado no consulta Supabase', async () => {
  const { api, llamadas } = crearMfa({ activo: false });
  assert.equal(api.estaActivo(), false);
  assert.equal(await api.requiereVerificacion(), false);
  assert.equal(llamadas.nivel, 0);
});

test('MFA con AAL1 y siguiente AAL2 requiere reto', async () => {
  const { api } = crearMfa({ activo: true });
  assert.equal(await api.requiereVerificacion(), true);
});

test('MFA verificado AAL2 no repite el reto', async () => {
  const { api } = crearMfa({ activo: true, nivel: { currentLevel: 'aal2', nextLevel: 'aal2' } });
  assert.equal(await api.requiereVerificacion(), false);
});

test('MFA no exige reto a una cuenta sin segundo factor', async () => {
  const { api } = crearMfa({ activo: true, nivel: { currentLevel: 'aal1', nextLevel: 'aal1' } });
  assert.equal(await api.requiereVerificacion(), false);
});

test('MFA solo enumera factores TOTP verificados', async () => {
  const { api } = crearMfa();
  const factores = await api.obtenerFactores();
  assert.equal(factores.length, 1);
  assert.equal(factores[0].id, 'verificado');
});

test('MFA prepara QR sin exponer secreto en un log', async () => {
  const { api, llamadas } = crearMfa();
  const dato = await api.iniciarConfiguracion();
  assert.equal(dato.factorId, 'nuevo-factor');
  assert.match(dato.codigoQR, /^data:image\/svg\+xml/);
  assert.equal(llamadas.enroll[0].factorType, 'totp');
});

test('MFA valida longitud y forma del código TOTP', async () => {
  const { api, llamadas } = crearMfa();
  await assert.rejects(api.verificarCodigo('factor-1', '12345'), /seis dígitos/);
  await assert.rejects(api.verificarCodigo('factor-1', 'abcdef'), /seis dígitos/);
  assert.equal(llamadas.challenge.length, 0);
});

test('MFA pide challenge y verify antes de confirmar', async () => {
  const { api, llamadas } = crearMfa();
  await api.verificarCodigo('factor-1', '123456');
  assert.equal(llamadas.challenge[0].factorId, 'factor-1');
  assert.equal(llamadas.verify[0].factorId, 'factor-1');
  assert.equal(llamadas.verify[0].challengeId, 'reto-1');
  assert.equal(llamadas.verify[0].code, '123456');
});

test('CAPTCHA y MFA apagados; Session Timeout habilitado a los 30 segundos', () => {
  const source = leer('js/config.js');
  const window = {};
  vm.runInNewContext(source, { window });
  assert.equal(window.LOMBANA_CONFIG.security.captchaEnabled, false);
  assert.equal(window.LOMBANA_CONFIG.security.mfaEnabled, false);
  assert.equal(window.LOMBANA_CONFIG.security.sessionTimeoutEnabled, true);
  assert.equal(window.LOMBANA_CONFIG.security.turnstileSiteKey, '');
});

test('Los scripts de inactividad se cargan después del cliente Supabase', () => {
  for (const archivo of [
    'index.html','terapias.html','terapia-detalle.html',
    'login.html','registro.html','agendar.html','admin.html',
    'mis-citas.html','seguridad-2fa.html','verificar-2fa.html',
    'cita-confirmada.html','pago-resultado.html','cita-demo.html',
    'reenviar-confirmacion.html'
  ]) {
    const html = leer(archivo);
    const sdk = html.indexOf('src="js/supabase.js"');
    const timer = html.indexOf('src="js/session-timeout.js"');
    assert.ok(sdk >= 0 && timer > sdk, archivo);
  }
});

test('Verificación MFA carga el cliente Supabase y el módulo TOTP', () => {
  const html = leer('verificar-2fa.html');
  assert.ok(html.indexOf('src="js/supabase.js"') < html.indexOf('src="js/mfa.js"'));
  assert.ok(html.indexOf('src="js/mfa.js"') < html.indexOf('src="js/mfa-verificacion.js"'));
});

test('Login y callback cargan MFA antes del control de acceso', () => {
  for (const archivo of ['login.html', 'auth-callback.html']) {
    const html = leer(archivo);
    assert.ok(html.indexOf('src="js/mfa.js"') < html.indexOf('src="js/auth.js"'), archivo);
  }
});

test('La recuperación de contraseña administrativa no fue modificada', () => {
  const html = leer('establecer-contrasena.html');
  assert.match(html, /supabaseClient\.auth\.updateUser\(/);
});

test('La protección contra bloqueo es solo un borrador, no una migración', () => {
  assert.match(leer('docs/ACCOUNT_LOCKOUT_U4_HOOK_BORRADOR.sql'), /NO EJECUTAR EN PRODUCCION/);
  assert.match(leer('docs/U4_SEGURIDAD_INTEGRACION.md'), /NO activado en producción/);
});


test('El regreso al login muestra el motivo de inactividad al usuario', () => {
  const html = leer('login.html');
  assert.match(html, /id="aviso-timeout-login"/);
  assert.match(html, /params\.get\('motivo'\) === 'inactividad'/);
  assert.match(html, /30 segundos sin actividad/);
});

test('La configuración generada activa el timeout por defecto y respeta false explícito', () => {
  const codigo = leer('scripts/build-config.cjs');
  assert.match(codigo, /SESSION_TIMEOUT_ENABLED \|\| "true"/);
  assert.match(leer('.env.example'), /SESSION_TIMEOUT_ENABLED=true/);
});
