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
    const titulo = document.getElementById('titulo-estado-confirmacion');
    if (!boton || !estado) return;

    // Leer y ocultar el token de la barra de direcciones lo antes posible.
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');

    if (window.history?.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    if (!tokenHash || !/^[a-z0-9_-]{20,256}$/i.test(tokenHash)) {
      estado.textContent =
        'Este enlace no es válido o ya fue utilizado. Si anteriormente ' +
        'confirmaste tu correo, puedes iniciar sesión. De lo contrario, ' +
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
        if (titulo) titulo.textContent = '¡Cuenta ya verificada!';
        estado.textContent =
          'Tu correo quedó confirmado correctamente. ' +
          'Ya puedes iniciar sesión en Lombana Therapy.';
        boton.hidden = true;
      } catch (_) {
        if (titulo) titulo.textContent = 'Revisa la confirmación de tu cuenta';
        estado.textContent =
          'Este enlace ya fue utilizado o caducó. Si ya confirmaste ' +
          'tu correo, tu cuenta está lista para iniciar sesión. ' +
          'Si aún no está confirmada, solicita otro enlace de confirmación.';
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
