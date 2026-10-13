
const esbuild = require("esbuild");

esbuild.build({
  stdin: {
    contents: `
      import { createClient } from "@supabase/supabase-js";

      window.supabase = {
        createClient
      };
    `,
    resolveDir: process.cwd(),
    sourcefile: "supabase-entry.js",
    loader: "js"
  },

  bundle: true,
  platform: "browser",
  format: "iife",
  target: ["es2020"],

  outfile: "js/vendor/supabase.bundle.js",

  minify: true,
  sourcemap: false
}).then(() => {
  console.log(
    "Supabase generado correctamente."
  );
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
