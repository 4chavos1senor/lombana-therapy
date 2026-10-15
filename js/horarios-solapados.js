/* Comparacion de intervalos [inicio, fin): una cita a las 11-12
   no bloquea otra a las 12-13. Los intervalos parciales si se bloquean. */
(function (root) {
  'use strict';
  function minutos(hora) {
    if (typeof hora !== 'string') return NaN;
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hora);
    if (!m) return NaN;
    const h = Number(m[1]), min = Number(m[2]), sec = Number(m[3] || 0);
    return (h >= 0 && h < 24 && min >= 0 && min < 60 && sec >= 0 && sec < 60)
      ? h * 3600 + min * 60 + sec : NaN;
  }
  function seSuperponen(primero, segundo) {
    const ai = minutos(primero?.hora_inicio);
    const af = minutos(primero?.hora_fin);
    const bi = minutos(segundo?.hora_inicio);
    const bf = minutos(segundo?.hora_fin);
    if (![ai, af, bi, bf].every(Number.isFinite)) return true; // Fallar en modo seguro
    return ai < bf && bi < af;
  }
  const api = Object.freeze({seSuperponen});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LombanaHorarios = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
