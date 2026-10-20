
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const swaggerUi = require('swagger-ui-dist');

const swaggerPath = swaggerUi.getAbsoluteFSPath();

const openapiPath = path.join(
  __dirname,
  '..',
  'openapi.yaml'
);

const assets = {
  '/api-docs/swagger-ui.css': [
    'swagger-ui.css',
    'text/css; charset=utf-8'
  ],
  '/api-docs/swagger-ui-bundle.js': [
    'swagger-ui-bundle.js',
    'text/javascript; charset=utf-8'
  ],
  '/api-docs/swagger-ui-standalone-preset.js': [
    'swagger-ui-standalone-preset.js',
    'text/javascript; charset=utf-8'
  ]
};

function responder(req, res, contenido, tipo) {
  const datos = Buffer.isBuffer(contenido)
    ? contenido
    : Buffer.from(contenido);

  res.writeHead(200, {
    'Content-Type': tipo,
    'Content-Length': datos.length,
    'Cache-Control': 'no-store'
  });

  res.end(req.method === 'HEAD' ? undefined : datos);
}

async function handleSwaggerDocs(req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  if (
    url.pathname === '/api-docs' ||
    url.pathname === '/api-docs/'
  ) {
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Lombana Therapy - Swagger UI</title>
  <link rel="stylesheet"
        href="/api-docs/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>

  <script src="/api-docs/swagger-ui-bundle.js"></script>
  <script src="/api-docs/swagger-ui-standalone-preset.js"></script>

  <script>
    window.onload = function () {
      SwaggerUIBundle({
        url: '/api-docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: 'StandaloneLayout'
      });
    };
  </script>
</body>
</html>`;

    responder(req, res, html, 'text/html; charset=utf-8');
    return;
  }

  if (url.pathname === '/api-docs/openapi.json') {
    const contenido = await fs.promises.readFile(
      openapiPath,
      'utf8'
    );

    const documento = YAML.parse(contenido);

    responder(
      req,
      res,
      JSON.stringify(documento),
      'application/json; charset=utf-8'
    );
    return;
  }

  const archivo = assets[url.pathname];

  if (!archivo) {
    res.writeHead(404);
    res.end('Recurso no encontrado');
    return;
  }

  const contenido = await fs.promises.readFile(
    path.join(swaggerPath, archivo[0])
  );

  responder(req, res, contenido, archivo[1]);
}

module.exports = { handleSwaggerDocs };
