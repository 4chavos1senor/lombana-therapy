/*
 * Lombana Therapy - segundo factor en inicio de sesión.
 * Nunca se activa sin configuración explícita.
 */
(() => {
  'use strict';

  async function destinoSeguro() {
    const params = new URLSearchParams(window.location.search);
    const solicitado = params.get('redirect');
    const permitidos = new Set([
      'index.html', 'agendar.html', 'mis-citas.html',
      'terapias.html', 'terapia-detalle.html'
    ]);

    if (solicitado !== 'admin.html') {
      return permitidos.has(solicitado) ? solicitado : 'index.html';
    }

    // Nunca autorizar un panel administrativo desde un parámetro de URL.
    const { data, error } = await supabaseClient.auth.getUser();
    if (error || !data?.user) return 'index.html';

    const respuesta = await supabaseClient
      .from('profiles').select('rol').eq('id', data.user.id).maybeSingle();
    return !respuesta.error && respuesta.data?.rol === 'admin'
      ? 'admin.html'
      : 'index.html';
  }

  async function inicializarVerificacion() {
    const codigo = document.getElementById('codigo-verificacion');
    const boton = document.getElementById('btn-confirmar-codigo');
    const mensaje = document.getElementById('mensaje-verificacion');
    if (!codigo || !boton || !mensaje) return;

    codigo.disabled = true;
    boton.disabled = true;

    const mfa = window.LombanaMFA;
    if (!mfa?.estaActivo?.()) {
      mensaje.textContent = 'La verificación en dos pasos todavía no está habilitada.';
      return;
    }

    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error || !data?.session) {
        mensaje.textContent = 'No tienes una sesión válida. Vuelve al inicio de sesión.';
        return;
      }

      const nivel = await mfa.obtenerNivel();
      if (nivel?.currentLevel === 'aal2') {
        window.location.replace(await destinoSeguro());
        return;
      }

      const factores = await mfa.obtenerFactores();
      if (!factores.length) {
        mensaje.textContent = 'No existe un autenticador verificado para esta cuenta.';
        return;
      }

      const factorId = factores[0].id;
      codigo.disabled = false;
      boton.disabled = false;
      mensaje.textContent = 'Introduce el código de tu aplicación de autenticación.';

      boton.addEventListener('click', async () => {
        boton.disabled = true;
        try {
          const nuevoNivel = await mfa.verificarCodigo(factorId, codigo.value.trim());
          if (nuevoNivel?.currentLevel !== 'aal2') throw new Error('Nivel insuficiente');
          codigo.value = '';
          window.location.replace(await destinoSeguro());
        } catch (_) {
          mensaje.textContent = 'No se pudo verificar el código. Inténtalo nuevamente.';
          boton.disabled = false;
        }
      });
    } catch (_) {
      mensaje.textContent = 'No se pudo comprobar el segundo factor. Vuelve a iniciar sesión.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { void inicializarVerificacion(); }, { once: true });
  } else {
    void inicializarVerificacion();
  }
})();
