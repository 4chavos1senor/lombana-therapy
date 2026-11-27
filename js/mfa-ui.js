
/*
 * LOMBANA THERAPY
 * Controlador de interfaz MFA (TOTP)
 *
 * Estado: preparación.
 * Sin operaciones de autenticación activas.
 */

(() => {
  'use strict';

  function inicializarMFA() {
    const estado = document.getElementById('estado-mfa');
    const botonActivar =
      document.getElementById('btn-activar-mfa');
    const botonVerificar =
      document.getElementById('btn-verificar-mfa');
    const codigo =
      document.getElementById('codigo-mfa');
    const qr =
      document.getElementById('codigo-qr');

    if (
      !estado ||
      !botonActivar ||
      !botonVerificar ||
      !codigo ||
      !qr
    ) {
      console.warn(
        'No se encontraron todos los controles MFA.'
      );
      return;
    }

    // No activar funciones sin pruebas de integración.
    botonActivar.disabled = true;
    botonVerificar.disabled = true;
    codigo.disabled = true;
    qr.hidden = true;
    qr.removeAttribute('src');

    if (window.LombanaMFA) {
      estado.textContent =
        'Módulo de seguridad preparado. ' +
        'La activación de dos factores estará ' +
        'disponible después de las verificaciones.';
    } else {
      estado.textContent =
        'El módulo de seguridad no está disponible.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      inicializarMFA,
      { once: true }
    );
  } else {
    inicializarMFA();
  }
})();
