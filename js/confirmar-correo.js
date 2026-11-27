/*
 * Lombana Therapy — confirmación de registro iniciada por el usuario.
 * El correo lleva un token_hash a esta página, NO un enlace que consuma
 * el token de inmediato. Una vista previa del correo no confirma la cuenta.
 */
(() => {
  'use strict';

  function iniciarConfirmacion() {
    const boton = document.getElementById('btn-confirmar-correo');
    const estado = document.getElementById('estado-confirmacion');
    if (!boton || !estado) return;

    // Leer y ocultar el token de la barra de direcciones lo antes posible.
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');

    if (window.history?.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    if (!tokenHash || !/^[a-z0-9_-]{20,256}$/i.test(tokenHash)) {
      estado.textContent =
        'Este enlace no es válido. Si tu cuenta no está confirmada, ' +
        'solicita un correo nuevo.';
      boton.disabled = true;
      return;
    }

    boton.disabled = false;
    estado.textContent =
      'Pulsa «Confirmar mi correo» para terminar tu registro.';

    let verificando = false;
    boton.addEventListener('click', async () => {
      if (verificando) return;
      verificando = true;
      boton.disabled = true;
      estado.textContent = 'Verificando tu correo...';

      try {
        const { error } = await supabaseClient.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'email'
        });

        if (error) throw error;
        estado.textContent =
          'Tu correo quedó confirmado correctamente. ' +
          'Ya puedes continuar en Lombana Therapy.';
        boton.hidden = true;
      } catch (_) {
        estado.textContent =
          'No se pudo confirmar el correo. El enlace puede haber ' +
          'caducado o haber sido utilizado. Si todavía no puedes ' +
          'iniciar sesión, solicita otro enlace de confirmación.';
        boton.hidden = true;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarConfirmacion, { once: true });
  } else {
    iniciarConfirmacion();
  }
})();
