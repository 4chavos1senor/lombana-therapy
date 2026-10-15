
const fs = require("node:fs");
const path = require("node:path");
const { readEnvironment } = require("./env.cjs");

const raiz = path.resolve(__dirname, "..");
const archivoEnv = path.join(raiz, ".env");

// Las variables se leen en Node; nunca se sirve el archivo .env al navegador.
const variables = readEnvironment(archivoEnv);

const url = variables.SUPABASE_URL?.trim();
const clave = variables.SUPABASE_PUBLISHABLE_KEY?.trim();

// Validar variables obligatorias
if (!url || !clave) {
  console.error(
    "ERROR: Faltan variables de Supabase en .env"
  );
  process.exit(1);
}

let urlValida = false;

try {
  const direccion = new URL(url);

  urlValida =
    direccion.protocol === "https:" &&
    direccion.hostname.endsWith(".supabase.co");
} catch {
  urlValida = false;
}

if (!urlValida) {
  console.error("ERROR: SUPABASE_URL no es válida");
  process.exit(1);
}

if (!clave.startsWith("sb_publishable_")) {
  console.error(
    "ERROR: Se requiere una clave publicable"
  );
  process.exit(1);
}

// Solo exportamos valores públicos al navegador
const configuracion = {
  supabaseUrl: url,
  supabasePublishableKey: clave
};

const contenido =
  "window.LOMBANA_CONFIG = Object.freeze(" +
  JSON.stringify(configuracion, null, 2) +
  ");\n";

// Generar archivo público local
fs.writeFileSync(
  path.join(raiz, "js", "config.js"),
  contenido,
  "utf8"
);

console.log("Configuración generada correctamente.");
