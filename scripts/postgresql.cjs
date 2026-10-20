
'use strict';

const { Client } = require('pg');

// Consulta de solo lectura a PostgreSQL local.
// No modifica Supabase, citas, pagos ni pacientes.
async function consultarSaludPostgres(cfg) {
  const requeridas = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
  ];

  const faltantes = requeridas.filter(
    clave => !String(cfg?.[clave] || '').trim()
  );

  if (faltantes.length) {
    throw new Error(
      'Configuracion local de PostgreSQL incompleta'
    );
  }

  const puerto = Number(cfg.DB_PORT);

  if (
    !Number.isInteger(puerto) ||
    puerto < 1 ||
    puerto > 65535
  ) {
    throw new Error('DB_PORT invalido');
  }

  const cliente = new Client({
    host: cfg.DB_HOST,
    port: puerto,
    database: cfg.DB_NAME,
    user: cfg.DB_USER,
    password: cfg.DB_PASSWORD,
    ssl: false,
    connectionTimeoutMillis: 3000,
    statement_timeout: 3000
  });

  try {
    await cliente.connect();

    const resultado = await cliente.query(
      'SELECT COUNT(*)::integer AS total ' +
      'FROM public.docker_practice_status'
    );

    return {
      estado: 'activo',
      tabla: 'docker_practice_status',
      registros: resultado.rows[0].total
    };

  } finally {
    await cliente.end().catch(() => {});
  }
}

module.exports = { consultarSaludPostgres };
