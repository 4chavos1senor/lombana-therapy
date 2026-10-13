
/* =========================================
   LOMBANA THERAPY
   CONFIGURACIÓN DE SUPABASE
   Unidad 3 - Servicio Web
========================================= */

/*
  CONFIGURACIÓN PÚBLICA

  La URL y la clave publicable pueden
  utilizarse en el frontend.

  NUNCA colocar aquí:
  - service_role
  - sb_secret_...
  - contraseñas de usuarios
  - secretos JWT
*/

const SUPABASE_URL =
  "https://pqeqarxybindwbgsbdlq.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_bh_S678j3018LiFEUpNWJg_4fRZGPD3";


/* =========================================
   VALIDACIÓN DE CONFIGURACIÓN
========================================= */

function validarConfiguracionSupabase() {

  // Comprobar que existe la URL
  if (
    !SUPABASE_URL ||
    !SUPABASE_URL.startsWith("https://")
  ) {
    throw new Error(
      "Configuración inválida: SUPABASE_URL."
    );
  }

  // Comprobar que existe la clave publicable
  if (
    !SUPABASE_ANON_KEY ||
    !SUPABASE_ANON_KEY.startsWith("sb_publishable_")
  ) {
    throw new Error(
      "Configuración inválida: clave publicable."
    );
  }

  // Comprobar que no se utilizó una clave secreta
  if (
    SUPABASE_ANON_KEY.startsWith("sb_secret_")
  ) {
    throw new Error(
      "No se permite utilizar una clave secreta en el navegador."
    );
  }

  // Comprobar que la librería de Supabase esté cargada
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
   CREACIÓN DEL CLIENTE
========================================= */

validarConfiguracionSupabase();

/*
  Conservamos el nombre supabaseClient
  porque otros archivos del proyecto
  lo utilizan:

  - auth.js
  - terapias.js
  - agenda.js
  - admin.js
*/

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
