
/*
 * Lombana Therapy - Session Timeout
 *
 * Cierre por inactividad: 15 minutos.
 * Preparado para pruebas; NO ACTIVADO.
 *
 * Este módulo no sustituye los controles
 * de autorización y expiración del servidor.
 */

(() => {
  'use strict';

  const TIMEOUT_MINUTOS = 15;
  const TIMEOUT_MS = TIMEOUT_MINUTOS * 60 * 1000;

  // Mantener desactivado hasta completar pruebas.
  const TIMEOUT_ACTIVO = false;

  const PREFIJO = 'lombana_ultima_actividad_v2_';

  let claveSesion = null;
  let cerrandoSesion = false;

  function identificarSesion(sesion) {
    // Identificador usado solo para separar contadores.
    // No se usa como prueba de autenticación.
    try {
      const fragmento = sesion.access_token.split('.')[1];

      const base64 = fragmento
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const relleno = base64.padEnd(
        Math.ceil(base64.length / 4) * 4,
        '='
      );

      const datos = JSON.parse(atob(relleno));

      if (
        typeof datos.session_id === 'string' &&
        datos.session_id
      ) {
        return datos.session_id;
      }
    } catch (_) {
      // Utilizar identificación alternativa.
    }

    return sesion.user.id + '_' +
      (sesion.user.last_sign_in_at ||
       sesion.user.created_at);
  }

  function ultimaActividad() {
    const valor = localStorage.getItem(claveSesion);

    if (valor === null) return null;

    const numero = Number(valor);

    return Number.isFinite(numero) && numero > 0
      ? numero
      : null;
  }

  function mostrarBloqueo(mensaje) {
    const contenido = document.createElement('main');

    contenido.setAttribute('role', 'alert');
    contenido.style.cssText =
      'max-width:32rem;margin:12vh auto;' +
      'padding:1.5rem;font-family:Arial,sans-serif;';

    const titulo = document.createElement('h1');
    titulo.textContent = 'Lombana Therapy';

    const parrafo = document.createElement('p');
    parrafo.id = 'mensaje-timeout';
    parrafo.textContent = mensaje;

    contenido.append(titulo, parrafo);
    document.body.replaceChildren(contenido);

    return parrafo;
  }

  async function cerrarPorInactividad() {
    if (cerrandoSesion) return;

    cerrandoSesion = true;

    const mensaje = mostrarBloqueo(
      'Sesión inactiva. Cerrando el acceso...'
    );

    try {
      const { error } =
        await supabaseClient.auth.signOut({
          scope: 'local'
        });

      if (error) throw error;

      localStorage.removeItem(claveSesion);

      window.location.replace(
        'login.html?motivo=inactividad'
      );

    } catch (_) {
      mensaje.textContent =
        'No se pudo confirmar el cierre de sesión. ' +
        'La pantalla quedó bloqueada. ' +
        'Cuando vuelva la conexión, recarga esta ' +
        'página para reintentarlo.';

      console.error(
        'No fue posible confirmar el cierre ' +
        'de sesión por inactividad.'
      );
    }
  }

  function comprobarInactividad() {
    if (cerrandoSesion || !claveSesion) return;

    const momento = ultimaActividad();
    const ahora = Date.now();

    if (
      momento === null ||
      momento > ahora ||
      ahora - momento >= TIMEOUT_MS
    ) {
      void cerrarPorInactividad();
    }
  }

  function registrarActividad() {
    if (cerrandoSesion || !claveSesion) return;

    const momento = ultimaActividad();
    const ahora = Date.now();

    // No renovar una sesión que ya venció.
    if (
      momento === null ||
      momento > ahora ||
      ahora - momento >= TIMEOUT_MS
    ) {
      void cerrarPorInactividad();
      return;
    }

    // Evitar escrituras excesivas en localStorage.
    if (ahora - momento >= 1000) {
      localStorage.setItem(
        claveSesion,
        String(ahora)
      );
    }
  }

  async function inicializar() {
    if (!TIMEOUT_ACTIVO) return;

    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) throw error;
    if (!data?.session) return;

    claveSesion =
      PREFIJO + identificarSesion(data.session);

    if (localStorage.getItem(claveSesion) === null) {
      localStorage.setItem(
        claveSesion,
        String(Date.now())
      );
    }

    comprobarInactividad();

    if (cerrandoSesion) return;

    for (const evento of [
      'pointerdown',
      'keydown',
      'touchstart'
    ]) {
      document.addEventListener(
        evento,
        registrarActividad,
        { passive: true }
      );
    }

    window.addEventListener(
      'focus',
      comprobarInactividad
    );

    window.addEventListener(
      'pageshow',
      comprobarInactividad
    );

    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) {
          comprobarInactividad();
        }
      }
    );

    window.addEventListener('storage', evento => {
      if (evento.key === claveSesion) {
        comprobarInactividad();
      }
    });

    setInterval(comprobarInactividad, 15000);
  }

  inicializar().catch(() => {
    if (TIMEOUT_ACTIVO) {
      mostrarBloqueo(
        'No se pudo preparar el control de sesión. ' +
        'Recarga para reintentarlo.'
      );

      console.error(
        'Error al iniciar el control de inactividad.'
      );
    }
  });
})();
