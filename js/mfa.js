
/*
 * LOMBANA THERAPY
 * Autenticación de dos factores (TOTP)
 *
 * Preparado para Supabase Auth.
 * No activar sin pruebas de integración.
 * No almacenar códigos ni secretos.
 */

window.LombanaMFA = (() => {
  function obtenerMFA() {
    if (
      typeof supabaseClient === 'undefined' ||
      !supabaseClient.auth?.mfa
    ) {
      throw new Error('Supabase Auth no disponible');
    }

    return supabaseClient.auth.mfa;
  }

  function validarCodigo(codigo) {
    if (
      typeof codigo !== 'string' ||
      !/^[0-9]{6}$/.test(codigo)
    ) {
      throw new Error(
        'Introduce un código de seis dígitos.'
      );
    }
  }

  // Consultar el nivel de autenticación.
  async function obtenerNivel() {
    const { data, error } =
      await obtenerMFA()
        .getAuthenticatorAssuranceLevel();

    if (error) throw error;

    return data;
  }

  // Consultar factores TOTP ya verificados.
  async function obtenerFactores() {
    const { data, error } =
      await obtenerMFA().listFactors();

    if (error) throw error;

    return (data.totp || []).filter(
      factor => factor.status === 'verified'
    );
  }

  // Iniciar configuración de un autenticador.
  // Solo llamar tras una acción explícita del usuario.
  async function iniciarConfiguracion() {
    const { data, error } =
      await obtenerMFA().enroll({
        factorType: 'totp',
        friendlyName: 'Lombana Therapy'
      });

    if (error) throw error;

    return {
      factorId: data.id,
      codigoQR: data.totp.qr_code
    };
  }

  // Verificar un código con Supabase.
  async function verificarCodigo(factorId, codigo) {
    validarCodigo(codigo);

    if (!factorId) {
      throw new Error(
        'No se encontró un autenticador.'
      );
    }

    const mfa = obtenerMFA();

    const { data: reto, error: errorReto } =
      await mfa.challenge({ factorId });

    if (errorReto) throw errorReto;

    const { error: errorVerificacion } =
      await mfa.verify({
        factorId,
        challengeId: reto.id,
        code: codigo
      });

    if (errorVerificacion) {
      throw errorVerificacion;
    }

    return await obtenerNivel();
  }

  return Object.freeze({
    obtenerNivel,
    obtenerFactores,
    iniciarConfiguracion,
    verificarCodigo
  });
})();
