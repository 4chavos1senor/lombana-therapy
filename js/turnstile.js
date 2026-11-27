
/*
 * LOMBANA THERAPY
 * Protección CAPTCHA - Cloudflare Turnstile
 *
 * Preparado para Supabase Auth.
 * No activar hasta completar las pruebas.
 */

(() => {
  'use strict';

  const CAPTCHA_ACTIVO = false;

  // Aquí se configurará solamente la Site Key pública.
  // NUNCA colocar la Secret Key en JavaScript.
  const SITE_KEY = '';

  let captchaToken = null;
  let widgetId = null;

  function estaActivo() {
    return CAPTCHA_ACTIVO;
  }

  function obtenerToken() {
    return captchaToken;
  }

  function mostrarMensaje(texto) {
    const mensaje = document.getElementById(
      'mensaje-captcha'
    );

    if (mensaje) {
      mensaje.textContent = texto;
      mensaje.hidden = false;
    }
  }

  function reiniciar() {
    captchaToken = null;

    if (
      widgetId !== null &&
      window.turnstile
    ) {
      window.turnstile.reset(widgetId);
    }
  }

  function iniciar() {
    if (!CAPTCHA_ACTIVO) return;

    const contenedor = document.getElementById(
      'contenedor-captcha'
    );

    if (!contenedor) return;

    if (!SITE_KEY) {
      mostrarMensaje(
        'La verificación CAPTCHA no está configurada.'
      );
      return;
    }

    contenedor.hidden = false;

    const script = document.createElement('script');

    script.src =
      'https://challenges.cloudflare.com/' +
      'turnstile/v0/api.js?render=explicit';

    script.async = true;

    script.onload = () => {
      widgetId = window.turnstile.render(
        contenedor,
        {
          sitekey: SITE_KEY,

          callback: token => {
            captchaToken = token;
          },

          'expired-callback': () => {
            captchaToken = null;
          },

          'error-callback': () => {
            captchaToken = null;
            mostrarMensaje(
              'No se pudo completar la verificación.'
            );
          }
        }
      );
    };

    script.onerror = () => {
      mostrarMensaje(
        'No se pudo cargar la verificación CAPTCHA.'
      );
    };

    document.head.appendChild(script);
  }

  window.LombanaTurnstile = Object.freeze({
    estaActivo,
    obtenerToken,
    reiniciar
  });

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      iniciar,
      { once: true }
    );
  } else {
    iniciar();
  }
})();
