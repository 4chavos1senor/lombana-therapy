
/*
 * LOMBANA THERAPY
 * Verificación del segundo factor (TOTP)
 *
 * Preparado para integración.
 * Deshabilitado hasta completar pruebas.
 */

(() => {
  'use strict';

  const MFA_HABILITADO = false;

  async function inicializarVerificacion() {
    const codigo = document.getElementById(
      'codigo-verificacion'
    );

    const boton = document.getElementById(
      'btn-confirmar-codigo'
    );

    const mensaje = document.getElementById(
      'mensaje-verificacion'
    );

    if (!codigo || !boton || !mensaje) {
      return;
    }

    // No iniciar autenticación mientras falten pruebas.
    codigo.disabled = true;
    boton.disabled = true;

    if (!MFA_HABILITADO) {
      mensaje.textContent =
        'La verificación en dos pasos está ' +
        'preparada, pero aún no está habilitada.';
      return;
    }

    // Este bloque se conectará después de comprobar
    // la configuración de Supabase y la seguridad
    // de las cuentas existentes.
    mensaje.textContent =
      'Pendiente de integración segura con Supabase.';
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      inicializarVerificacion,
      { once: true }
    );
  } else {
    inicializarVerificacion();
  }
})();
