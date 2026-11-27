/*
 * Lombana Therapy - limitador local de intentos para la demostración U4.
 * Este aviso NO es un bloqueo de cuenta del servidor; otro navegador puede evadirlo.
 * En Supabase, un bloqueo real requiere soporte de Auth Hooks en el plan adecuado.
 * No almacenar contraseñas, tokens ni el correo en texto plano.
 */
(() => {
  'use strict';

  const PREFIJO = 'lombana_intentos_login_v1_';
  const INTENTOS = 3;
  const MINUTOS = [1, 2];
  const REINICIO_MS = 24 * 60 * 60 * 1000;
  const reserva = new Map();

  function clave(correo) {
    const identificador = String(correo || '').trim().toLowerCase();
    if (!identificador) return null;

    // Identificador no reversible directamente; NO es una medida de seguridad.
    let hash = 2166136261;
    for (let i = 0; i < identificador.length; i++) {
      hash ^= identificador.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return PREFIJO + (hash >>> 0).toString(16);
  }

  function leer(correo) {
    const id = clave(correo);
    if (!id) return null;

    let valor = null;
    try {
      valor = window.localStorage.getItem(id);
    } catch (_) {
      valor = reserva.get(id) || null;
    }

    if (!valor) return { fallos: 0, bloqueos: 0, hasta: 0, ultimaFalla: 0 };
    try {
      const obj = JSON.parse(valor);
      const valido = [obj.fallos, obj.bloqueos, obj.hasta, obj.ultimaFalla]
        .every(n => Number.isSafeInteger(n) && n >= 0);
      if (!valido) throw new Error('estado inválido');
      if (obj.ultimaFalla && Date.now() - obj.ultimaFalla > REINICIO_MS) {
        return { fallos: 0, bloqueos: 0, hasta: 0, ultimaFalla: 0 };
      }
      return obj;
    } catch (_) {
      return { fallos: 0, bloqueos: 0, hasta: 0, ultimaFalla: 0 };
    }
  }

  function guardar(correo, estado) {
    const id = clave(correo);
    if (!id) return;
    const valor = JSON.stringify(estado);
    reserva.set(id, valor);
    try {
      window.localStorage.setItem(id, valor);
    } catch (_) {
      // El navegador puede impedir el almacenamiento; queda una copia en memoria.
    }
  }

  function estado(correo) {
    const datos = leer(correo);
    if (!datos) return { bloqueado: false, segundos: 0, restantes: INTENTOS };
    const segundos = Math.max(0, Math.ceil((datos.hasta - Date.now()) / 1000));
    return {
      bloqueado: segundos > 0,
      segundos,
      restantes: INTENTOS - datos.fallos,
      bloqueos: datos.bloqueos
    };
  }

  function registrarFallo(correo) {
    const datos = leer(correo);
    if (!datos) return { bloqueado: false, segundos: 0, restantes: INTENTOS };
    const actual = estado(correo);
    if (actual.bloqueado) return actual;

    datos.fallos += 1;
    datos.ultimaFalla = Date.now();
    if (datos.fallos >= INTENTOS) {
      const minutos = MINUTOS[Math.min(datos.bloqueos, MINUTOS.length - 1)];
      datos.bloqueos += 1;
      datos.fallos = 0;
      datos.hasta = Date.now() + minutos * 60 * 1000;
      guardar(correo, datos);
      return { ...estado(correo), minutos };
    }
    datos.hasta = 0;
    guardar(correo, datos);
    return estado(correo);
  }

  function registrarExito(correo) {
    const id = clave(correo);
    if (!id) return;
    reserva.delete(id);
    try {
      window.localStorage.removeItem(id);
    } catch (_) {
      // Ninguna escritura de estado de seguridad se considera confiable.
    }
    refrescar();
  }

  function formato(segundos) {
    const minutos = Math.floor(segundos / 60);
    const resto = segundos % 60;
    return minutos + ':' + String(resto).padStart(2, '0');
  }

  function refrescar() {
    const correo = document.getElementById('email');
    const boton = document.getElementById('btn-entrar');
    const aviso = document.getElementById('aviso-bloqueo-login');
    if (!correo || !boton || !aviso) return;

    const situacion = estado(correo.value);
    boton.disabled = situacion.bloqueado;

    if (situacion.bloqueado) {
      aviso.textContent = 'Intentos suspendidos en este navegador. ' +
        'Vuelve a intentarlo en ' + formato(situacion.segundos) + '.';
      aviso.hidden = false;
      aviso.dataset.bloqueo = 'true';
    } else if (aviso.dataset.bloqueo === 'true') {
      aviso.textContent = '';
      aviso.hidden = true;
      delete aviso.dataset.bloqueo;
    }
  }

  function avisar(mensaje, bloqueo = false) {
    const aviso = document.getElementById('aviso-bloqueo-login');
    if (aviso) {
      aviso.textContent = mensaje;
      aviso.hidden = false;
      if (bloqueo) aviso.dataset.bloqueo = 'true';
    }
    if (bloqueo) window.alert(mensaje);
    if (bloqueo) refrescar();
  }

  function inicializar() {
    const correo = document.getElementById('email');
    if (!correo) return;
    correo.addEventListener('input', refrescar);
    window.addEventListener('storage', refrescar);
    window.setInterval(refrescar, 1000);
    refrescar();
  }

  window.LombanaLoginLockout = Object.freeze({
    estado, registrarFallo, registrarExito, avisar, refrescar
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar, { once: true });
  } else {
    inicializar();
  }
})();
