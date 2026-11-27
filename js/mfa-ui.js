/*
 * Lombana Therapy - configuración voluntaria de MFA con TOTP.
 * Inactiva hasta que LOMBANA_CONFIG.security.mfaEnabled sea true.
 * No registra códigos, QR ni secretos en logs.
 */
(() => {
  'use strict';

  async function inicializarMFA() {
    const estado = document.getElementById('estado-mfa');
    const activar = document.getElementById('btn-activar-mfa');
    const verificar = document.getElementById('btn-verificar-mfa');
    const codigo = document.getElementById('codigo-mfa');
    const qr = document.getElementById('codigo-qr');

    if (!estado || !activar || !verificar || !codigo || !qr) return;

    activar.disabled = true;
    verificar.disabled = true;
    codigo.disabled = true;
    qr.hidden = true;
    qr.removeAttribute('src');

    const mfa = window.LombanaMFA;
    if (!mfa?.estaActivo?.()) {
      estado.textContent = 'La verificación en dos pasos está preparada, pero no está habilitada.';
      return;
    }

    try {
      const { data, error } = await supabaseClient.auth.getUser();
      if (error || !data?.user) {
        estado.textContent = 'Inicia sesión para administrar la seguridad de tu cuenta.';
        return;
      }

      const factores = await mfa.obtenerFactores();
      if (factores.length) {
        estado.textContent = 'Tu cuenta ya tiene un autenticador verificado.';
        return;
      }

      estado.textContent = 'Puedes activar un autenticador para tu cuenta.';
      activar.disabled = false;
      let factorPendiente = null;

      activar.addEventListener('click', async () => {
        activar.disabled = true;
        estado.textContent = 'Preparando el código QR...';
        try {
          const respuesta = await mfa.iniciarConfiguracion();
          factorPendiente = respuesta.factorId;
          qr.src = respuesta.codigoQR;
          qr.hidden = false;
          codigo.disabled = false;
          verificar.disabled = false;
          estado.textContent = 'Escanea el QR con tu aplicación y escribe el código de seis dígitos.';
        } catch (_) {
          estado.textContent = 'No se pudo iniciar la configuración. Vuelve a intentarlo.';
          activar.disabled = false;
        }
      });

      verificar.addEventListener('click', async () => {
        if (!factorPendiente) return;
        verificar.disabled = true;
        try {
          const nivel = await mfa.verificarCodigo(factorPendiente, codigo.value.trim());
          if (nivel?.currentLevel !== 'aal2') {
            throw new Error('Segundo factor no confirmado');
          }
          codigo.value = '';
          codigo.disabled = true;
          qr.hidden = true;
          qr.removeAttribute('src');
          factorPendiente = null;
          estado.textContent = 'Verificación en dos pasos activada para esta cuenta.';
        } catch (_) {
          estado.textContent = 'Código no válido o no fue posible verificarlo. Inténtalo de nuevo.';
          verificar.disabled = false;
        }
      });
    } catch (_) {
      estado.textContent = 'No se pudo consultar la seguridad de tu cuenta.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { void inicializarMFA(); }, { once: true });
  } else {
    void inicializarMFA();
  }
})();
