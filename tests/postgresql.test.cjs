
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createApp } = require('../server.cjs');
const {
  consultarSaludPostgres
} = require('../scripts/postgresql.cjs');

const cfg = {
  SUPABASE_URL: 'https://ejemplo.supabase.co',
  SUPABASE_PUBLISHABLE_KEY:
    'sb_publishable_solo_para_pruebas',
  ALLOWED_ORIGIN: 'http://localhost:8080'
};

test('PostgreSQL rechaza configuracion incompleta',
  async () => {
    await assert.rejects(
      consultarSaludPostgres({}),
      /Configuracion local de PostgreSQL incompleta/
    );
  }
);

test('PostgreSQL rechaza un puerto invalido',
  async () => {
    const config = {
      DB_HOST: 'localhost',
      DB_PORT: '99999',
      DB_NAME: 'prueba',
      DB_USER: 'prueba',
      DB_PASSWORD: 'solo_prueba'
    };

    await assert.rejects(
      consultarSaludPostgres(config),
      /DB_PORT invalido/
    );
  }
);

test('GET /api/db/salud devuelve 503 sin PostgreSQL',
  async () => {
    const servidor = http.createServer(createApp(cfg));

    await new Promise(resolve => {
      servidor.listen(0, '127.0.0.1', resolve);
    });

    try {
      const puerto = servidor.address().port;

      const respuesta = await fetch(
        `http://127.0.0.1:${puerto}/api/db/salud`
      );

      assert.equal(respuesta.status, 503);

      const datos = await respuesta.json();

      assert.equal(datos.ok, false);
      assert.equal(
        datos.error.codigo,
        'POSTGRESQL_NO_DISPONIBLE'
      );
    } finally {
      await new Promise(resolve => {
        servidor.close(resolve);
      });
    }
  }
);
