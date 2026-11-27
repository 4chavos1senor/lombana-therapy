
/*
 * Lombana Therapy
 * Session Timeout - cierre por inactividad
 *
 * Preparado para integración.
 * No activar sin pruebas.
 */

(() => {
  'use strict';

  const TIMEOUT_MINUTOS = 15;
  const TIMEOUT_MS = TIMEOUT_MINUTOS * 60 * 1000;

  // Mantener desactivado hasta comprobar el flujo.
  const TIMEOUT_ACTIVO = false;

  const STORAGE_KEY = 'lombana_ultima_actividad';
  let cerrandoSesion = false;

  function registrarActividad() {
    if (!cerrandoSesion) {
      localStorage.setItem(
        STORAGE_KEY,
        String(Date.now())
      );
    }
  }

  async function comprobarInactividad() {
    if (cerrandoSesion) return;

    const ultimaActividad = Number(
      localStorage.getItem(STORAGE_KEY)
    );

    if (!ultimaActividad) return;

    const tiempoInactivo =
      Date.now() - ultimaActividad;

    if (tiempoInactivo < TIMEOUT_MS) return;

    cerrandoSesion = true;

    try {
      const { error } =
        await supabaseClient.auth.signOut({
          scope: 'local'
        });

      if (error) throw error;

      localStorage.removeItem(STORAGE_KEY);

      window.location.replace(
        'login.html?motivo=inactividad'
      );
    } catch (error) {
      console.error(
        'No fue posible confirmar el cierre de sesión.'
      );
      // Pendiente: bloquear la interfaz protegida
      // y gestionar el fallo de cierre de forma segura.
    }
  }

  async function inicializar() {
    if (!TIMEOUT_ACTIVO) return;

    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error || !data.session) return;

    if (!localStorage.getItem(STORAGE_KEY)) {
      registrarActividad();
    }

    await comprobarInactividad();

    const eventos = [
      'pointerdown',
      'keydown',
      'touchstart'
    ];

    eventos.forEach(evento => {
      document.addEventListener(
        evento,
        registrarActividad,
        { passive: true }
      );
    });

    window.addEventListener(
      'focus',
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

    setInterval(comprobarInactividad, 15000);
  }

  inicializar().catch(() => {
    console.error(
      'No fue posible preparar el control de inactividad.'
    );
  });
})();
