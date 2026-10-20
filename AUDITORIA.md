# Auditoría — P1U3, Lombana Therapy

**Fecha de preparación original:** 14/10/2026.

La auditoría original se basó en inspección estática y doce pruebas automatizadas aisladas. En ese momento no se había verificado la instancia real de Supabase, GitHub, políticas RLS ni pruebas manuales completas.

**Última actualización de la Práctica 2:** 20/10/2026.

Convenciones de estado:

- ✅ Implementado o comprobado según la evidencia indicada.
- ⚠️ Implementación o evidencia parcialmente pendiente.
- ❌ Requiere decisión o trabajo adicional.
- ➖ Sin cambios o sin nueva comprobación.

## Tabla de auditoría

| # | Requisito de la práctica | Estado inicial del ZIP | Estado final de archivos preparados | Evidencia / siguiente acción | Estado después de la práctica 2 |
|---|---|---|---|---|---|
| 1 | `.gitignore` excluye `.env` y dependencias | ✅ | ✅ | `.gitignore`; comprobar archivos ignorados | ✅ `.env` y `node_modules/` ignorados; `.env` no incluido en los commits |
| 2 | Datos sensibles fuera del código | ✅ clave publicable | ⚠️ | `.env`, `js/config.js` y revisión de historial | ⚠️ `.env` excluido de Git y Docker; revisión completa del historial pendiente |
| 3 | `.env.example` sin secretos | ✅ | ✅ | `.env.example` y `npm run build:config` | ✅ Valores de ejemplo y `DB_PASSWORD` vacío; sin contraseña real |
| 4 | Endpoints con nombres claros | ❌ | ✅ | `server.cjs`, `/api/terapias`, `/api/citas` | ✅ Cuatro rutas GET documentadas y comprobadas en Swagger UI; nueva ruta `/api/db/salud` |
| 5 | Respuestas JSON uniformes | ❌ | ✅ | Contrato `ok`, `data`, `total`, `error` | ✅ Respuestas JSON correctas en endpoints de salud, terapias y PostgreSQL |
| 6 | Validación de entradas | ⚠️ frontend | ⚠️ | Validación de formato, tipo y límite de 100 kB | ⚠️ Validaciones y pruebas automatizadas; revisión de RLS y reglas reales pendiente |
| 7 | Códigos HTTP adecuados | ⚠️ externo | ⚠️ | Respuestas 200, 201, 204, 400, 401, 404, 409, 502 y 503 | ⚠️ Cuatro GET respondieron 200; manejo 503 comprobado; 409 de reservas reales pendiente |
| 8 | Manejo centralizado de errores | ⚠️ | ✅ | Errores centralizados en `server.cjs` | ✅ 39 pruebas aprobadas, incluida la respuesta controlada 503 de PostgreSQL |
| 9 | 404 de API controlado | ❌ | ✅ | `/api/no-existe` devuelve JSON 404 | ✅ Comportamiento conservado y comprobado por pruebas automatizadas |
| 10 | CORS restrictivo | ⚠️ | ✅ en servidor local | Variable `ALLOWED_ORIGIN` | ✅ Origen `http://localhost:8080` verificado; revisión integral de seguridad pendiente |
| 11 | Cabeceras de seguridad | ⚠️ | ✅ básico | `server.cjs` y CSP compatible | ⚠️ Cabeceras implementadas; sigue pendiente revisar el uso de `unsafe-inline` |
| 12 | HTML `head` completo | ✅ parcial | ✅ | Revisar metadatos del sitio | ➖ Sin cambios en esta integración; revisión exhaustiva pendiente |
| 13 | Fuentes alojadas localmente | ✅ fuentes del sistema | ✅ | No se requieren Google Fonts | ➖ Se conserva la configuración existente |
| 14 | Página 404 personalizada | ⚠️ archivo existente | ✅ servidor local | `404.html` y `nginx/default.conf` | ✅ Página 404 personalizada comprobada durante la práctica |
| 15 | `LICENSE` | ❌ | ❌ | Autorización de titulares requerida originalmente | ✅ Licencia MIT autorizada, archivo `LICENSE` incluido y `package.json` actualizado |
| 16 | README con instalación real | ⚠️ desactualizado | ✅ preparado | Instrucciones Docker y ejecución local | ✅ README actualizado; clonación independiente y demostración PostgreSQL verificadas |
| 17 | Logs de peticiones | ❌ sin API propia | ✅ servidor local | Método, ruta, código y tiempo | ✅ Logs observados en Node.js; ejecución y consulta mediante Docker documentadas |
| 18 | Versiones de dependencias fijadas | ✅ | ✅ | `package-lock.json` y recursos locales | ⚠️ Dependencias registradas; algunas etiquetas Docker como `nginx:alpine` no fijan digest |

## Evidencias externas registradas en la Práctica 1

La siguiente lista se conserva como referencia histórica. Algunas actividades fueron atendidas parcialmente durante la Práctica 2.

- Capturas del funcionamiento real del frontend con Supabase: registro, sesión, catálogo, reservas y administración.
- Resultados de peticiones Postman/curl y verificaciones HTTP, seguridad y CORS.
- Revisión de la estructura real de la base de datos, restricciones contra reservas duplicadas y políticas RLS.
- Confirmación de la licencia y revisión de recursos de terceros.
- Instalación del proyecto en otra computadora siguiendo el README.
- Evidencias de ramas, commits, revisión y fusión de GitHub.

La licencia MIT fue autorizada durante la Práctica 2. La instalación independiente se comprobó mediante una clonación local en la misma computadora, pero no en otro equipo físico.

## Tres mejoras UI/UX detectadas — Bloque 9

1. Unificar mensajes de error de Supabase sin mostrar información interna al paciente. Pendiente de verificación manual.
2. Agregar un indicador de envío y evitar dobles clics en «Confirmar cita» durante el guardado. Pendiente de implementación y pruebas.
3. Revisar contraste, navegación por teclado y estados de foco del menú móvil. Pendiente de comprobación exhaustiva.

Estas mejoras no forman parte de los cambios de integración PostgreSQL y no se realizaron durante esta práctica.

---

## Actualización — Práctica 2, 19/10/2026

Esta sección conserva los resultados obtenidos antes de incorporar el endpoint PostgreSQL al backend.

### Alcance inicial

Se prepararon los siguientes archivos:

- `Dockerfile`
- `.dockerignore`
- `Dockerfile.frontend`
- `docker-compose.yml`
- `nginx/default.conf`
- `db/init.sql`
- `openapi.yaml`
- `scripts/swagger-docs.cjs`

### Evidencias obtenidas inicialmente

- Docker Compose inició los servicios backend, frontend y db.
- PostgreSQL alcanzó el estado `healthy`.
- Se comprobó una instalación independiente en `lombana-therapy-verificacion`, en la misma computadora.
- Se abrió el frontend en `http://localhost:8080`.
- Se comprobó `GET /api/salud` en `http://localhost:3000`.
- Se abrió Swagger UI en `http://localhost:3000/api-docs`.
- Tres rutas GET respondieron HTTP 200 desde Swagger UI.
- OpenAPI 3.0.3 se validó mediante YAML y Swagger Editor.
- Una consulta SQL de solo lectura devolvió un registro de `docker_practice_status`.
- La suite existente aprobó 36 pruebas, sin fallos.
- Se creó el Pull Request #11 en borrador.

En esta etapa, la existencia de PostgreSQL local no demostraba todavía una conexión con la API Node.js. Esa integración se añadió y comprobó posteriormente.

---

## Actualización de integración — 20/10/2026

### Objetivo

Comprobar la comunicación completa entre:

**Frontend Nginx → API Node.js → PostgreSQL local**

Se implementó una integración de demostración sin sustituir las funciones existentes de Supabase.

### Componentes implementados

- Dependencia `pg`, versión 8.23.1 en la instalación local comprobada.
- Módulo `scripts/postgresql.cjs`.
- Endpoint `GET /api/db/salud`.
- Documentación actualizada en `openapi.yaml`.
- Página `docker-demo/verificacion-postgresql.html`.
- Incorporación de la página a `Dockerfile.frontend`.
- Archivo `tests/postgresql.test.cjs`.
- Actualización de `README.md` y `AUDITORIA.md`.

### Conexión a PostgreSQL

El módulo `scripts/postgresql.cjs` utiliza las variables de entorno:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

No contiene contraseñas escritas directamente en el código.

La consulta utilizada es de solo lectura:

```sql
SELECT COUNT(*)::integer AS total
FROM public.docker_practice_status;
```

La consulta no modifica pacientes, reservaciones, pagos ni otros datos existentes.

### Endpoint implementado

**Método:** GET

**Ruta:** `/api/db/salud`

**Respuesta correcta observada:** HTTP 200.

Ejemplo de la respuesta comprobada:

```json
{
  "ok": true,
  "data": {
    "estado": "activo",
    "tabla": "docker_practice_status",
    "registros": 1
  }
}
```

Se comprobó un registro en la tabla local.

Cuando falta la configuración de PostgreSQL o la consulta no puede realizarse, el endpoint devuelve un error HTTP 503 controlado, con el código `POSTGRESQL_NO_DISPONIBLE`.

### Verificación mediante Swagger UI

La especificación OpenAPI 3.0.3 documenta cuatro endpoints:

1. `GET /api/salud`
2. `GET /api/db/salud`
3. `GET /api/terapias`
4. `GET /api/terapias/{slug}`

Las cuatro rutas respondieron HTTP 200 en las comprobaciones realizadas mediante Swagger UI.

La nueva ruta mostró el estado activo y un registro de PostgreSQL.

### Prueba desde el frontend

Se creó una página independiente:

`docker-demo/verificacion-postgresql.html`

Disponible mediante Docker en:

http://localhost:8080/verificacion-postgresql.html

La página contiene un botón **Consultar PostgreSQL** que realiza una solicitud a:

http://localhost:3000/api/db/salud

Se comprobó que:

- La página abrió correctamente desde Nginx.
- El botón ejecutó la consulta.
- El backend respondió con JSON válido.
- La respuesta indicó `ok: true`.
- PostgreSQL devolvió estado `activo`.
- La tabla consultada fue `docker_practice_status`.
- Se obtuvo un registro.
- La interfaz mostró el mensaje de consulta correcta.

Esto demuestra la comunicación de lectura entre los tres componentes de la práctica.

### Verificación de CORS

Se realizó una petición HTTP al backend incluyendo el origen:

`http://localhost:8080`

El servidor respondió con:

- Código HTTP 200.
- Cabecera `Access-Control-Allow-Origin: http://localhost:8080`.

Esto verifica que el origen utilizado por la demostración está permitido en la configuración comprobada.

No sustituye una auditoría integral de seguridad de CORS.

### Pruebas automatizadas

Se ejecutó:

```powershell
npm.cmd test
```

**Resultados finales observados:**

| Indicador | Resultado |
|---|---|
| Pruebas ejecutadas | 39 |
| Pruebas aprobadas | 39 |
| Pruebas fallidas | 0 |
| Pruebas canceladas | 0 |
| Pruebas omitidas | 0 |

Las tres pruebas agregadas para PostgreSQL comprobaron:

1. Rechazo de configuración incompleta.
2. Rechazo de un puerto inválido.
3. Respuesta HTTP 503 cuando PostgreSQL no está disponible.

La prueba del error 503 es intencional. El mensaje `POSTGRESQL_NO_DISPONIBLE` aparece en los registros esperados de la prueba, aunque esta se complete correctamente.

La respuesta HTTP 200 con PostgreSQL en ejecución se comprobó mediante Docker, PowerShell, Swagger UI y la página de demostración.

### Verificaciones de Git

Se realizaron las siguientes comprobaciones:

- `git diff --check` sin errores.
- `git diff --cached --check` sin errores.
- Archivo `.env` excluido de los cambios preparados.
- Diez archivos incluidos en el commit de integración.
- 555 líneas agregadas y 3 eliminadas en ese commit.
- Rama de trabajo `practica-distribucion`.

**Commit de integración:**

`c1064df` — `feat: integrar frontend Node.js y PostgreSQL local`

Se publicó correctamente en GitHub.

### Pull Request

**Repositorio:**

https://github.com/4chavos1senor/lombana-therapy

**Pull Request:**

https://github.com/4chavos1senor/lombana-therapy/pull/11

**Estado comprobado al 20/10/2026:**

- Pull Request #11 abierto.
- Estado Draft (borrador).
- Rama de origen `practica-distribucion`.
- Rama de destino `main`.
- Cuatro commits.
- Dieciocho archivos cambiados.
- Commit más reciente `c1064df`.
- Sin conflictos de fusión detectados por GitHub.
- Sin ejecución de CI registrada en la última comprobación.
- Todavía no fusionado con `main`.

Las 39 pruebas se ejecutaron localmente; no deben presentarse como pruebas ejecutadas automáticamente por GitHub Actions.

## Alcance y limitaciones

La integración PostgreSQL se utiliza exclusivamente para una demostración de consulta de lectura.

El sitio principal mantiene sus operaciones reales mediante Supabase.

No se migraron:

- Autenticación de usuarios.
- Información de pacientes.
- Reservaciones históricas.
- Disponibilidad real de citas.
- Pagos electrónicos.
- Funciones administrativas.

Tampoco se ejecutaron operaciones de escritura para comprobar esta integración.

Las 39 pruebas automatizadas y las comprobaciones manuales no representan una validación completa de seguridad, producción ni de las reglas de negocio reales de Supabase.

La clonación independiente se realizó en la misma computadora; la verificación en otra computadora sigue pendiente.

## Pendientes antes de la entrega definitiva

- Obtener la revisión cruzada de otro equipo y su reporte.
- Revisar los cambios del Pull Request #11 antes de fusionarlos.
- Completar las comprobaciones de seguridad y de los flujos reales que requiera el profesor, utilizando entornos y datos autorizados.
- Decidir la aprobación y fusión del Pull Request.
- Crear y publicar el Release `v1.0.0` cuando corresponda.
- Incorporar al informe final las nuevas evidencias de PostgreSQL, Swagger UI y las 39 pruebas.

## Conclusión

La Práctica 2 permitió construir y ejecutar Lombana Therapy mediante Docker Compose, documentar endpoints REST con OpenAPI y Swagger UI y demostrar la comunicación entre Nginx, Node.js y PostgreSQL local.

Se comprobó el funcionamiento de los tres servicios y se obtuvo una respuesta HTTP 200 al consultar la base de datos desde el navegador.

Las 39 pruebas automatizadas finalizaron sin fallos.

La integración se mantiene separada de las operaciones reales del sitio para conservar las funcionalidades existentes de Supabase, citas, pagos y administración.

**Estado final:** integración académica implementada y comprobada localmente; Pull Request publicado en borrador, pendiente de revisión, fusión y Release.