
/* =========================================
   LOMBANA THERAPY
   CONFIGURACIÓN DE SUPABASE
   Unidad 3 - Servicio Web
========================================= */

/*
  Los valores públicos se obtienen de
  js/config.js, generado desde .env.

  NUNCA utilizar aquí:
  - service_role
  - sb_secret_
  - Contraseñas
  - Secretos JWT
*/

/* =========================================
   CARGAR VARIABLES DE CONFIGURACIÓN
========================================= */

const configuracion = window.LOMBANA_CONFIG;

const SUPABASE_URL =
  configuracion?.supabaseUrl;

const SUPABASE_ANON_KEY =
  configuracion?.supabasePublishableKey;

/* =========================================
   VALIDACIÓN DE CONFIGURACIÓN
========================================= */

function validarConfiguracionSupabase() {

  if (!configuracion) {
    throw new Error(
      "No se encontró js/config.js. " +
      "Ejecuta node scripts/build-config.cjs"
    );
  }

  if (
    !SUPABASE_URL ||
    !SUPABASE_URL.startsWith("https://")
  ) {
    throw new Error(
      "Configuración inválida: SUPABASE_URL."
    );
  }

  if (
    !SUPABASE_ANON_KEY ||
    !SUPABASE_ANON_KEY.startsWith("sb_publishable_")
  ) {
    throw new Error(
      "Configuración inválida: clave publicable."
    );
  }

  if (
    typeof supabase === "undefined" ||
    typeof supabase.createClient !== "function"
  ) {
    throw new Error(
      "No se cargó correctamente la librería de Supabase."
    );
  }

  return true;
}

/* =========================================
   CREACIÓN DEL CLIENTE SUPABASE
========================================= */

validarConfiguracionSupabase();

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);
