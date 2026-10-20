> **INTEGRACIÓN CON GALI:** Lee primero [LEEME_INTEGRACION_FINAL.md](LEEME_INTEGRACION_FINAL.md) y [Pendientes en Supabase](docs/PENDIENTES_SUPABASE_INTEGRACION.md). No todos los servicios externos están habilitados automáticamente.

# Lombana Therapy — Práctica P1U3: Configuración de un servicio web

## Qué hace

Sitio de terapias con catálogo, registro, inicio de sesión, reservas de citas y panel administrativo. Incluye **API HTTP local** en Node.js nativo (`server.cjs`) con endpoints REST, JSON uniforme, validación, códigos HTTP, errores centralizados, logs, CORS limitado, cabeceras de seguridad y página 404.

Mantiene la conexión directa del frontend principal con Supabase para evitar romper las funciones existentes.

> **IMPORTANTE:** Tener una API local implementada no significa que todas las páginas utilicen esa API. Las páginas principales siguen utilizando `supabase-js`. En la Práctica 2 se agregó una página independiente que sí consulta una ruta de Node.js conectada a PostgreSQL local. Las operaciones de pacientes, citas y pagos no se migraron. Los ejemplos del PDF utilizan Express; esta adaptación usa Node HTTP nativo, sin Express, y el controlador `pg` para la demostración PostgreSQL.

## Tecnologías

- Frontend: HTML5, CSS, JavaScript y Supabase JS v2 empaquetado localmente en `js/vendor/supabase.bundle.js`.
- Backend de la práctica: Node.js 20+, módulo `http` nativo y `fetch` a la API REST/Autenticación de Supabase.
- Base de datos y autenticación de las operaciones existentes: PostgreSQL administrado por Supabase y Supabase Auth.
- Base de datos de demostración: PostgreSQL 16 local en Docker, con el controlador `pg` para Node.js.
- Dependencias: `package.json` y `package-lock.json`; no subir `node_modules`.

## Requisitos previos

1. Node.js 20+ y npm para la ejecución directa del servidor.
2. Acceso al proyecto de Supabase y clave **publicable** (`sb_publishable_...`). Nunca usar claves `sb_secret_` o `service_role` en el frontend ni en capturas.
3. Proyecto de Supabase con tablas `profiles`, `therapies`, `appointments`, relaciones y políticas RLS verificadas para las operaciones reales.
4. Puerto 3000 libre en localhost.

## Instalación y ejecución en localhost

```powershell
# 1. Entrar a la carpeta del proyecto e instalar dependencias
npm install

# 2. Crear configuración local
Copy-Item .env.example .env

# 3. Abrir .env y configurar SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY
#    con valores publicables. Mantener .env fuera de Git.

# 4. Generar js/config.js
npm run build:config

# 5. Iniciar servidor Node.js
npm start
```

Abrir `http://127.0.0.1:3000/index.html`.

No se necesita Live Server para esta práctica. Si se utiliza Live Server en el puerto 5502, debe revisarse `ALLOWED_ORIGIN` en `.env` y generarse `js/config.js`.

El frontend utiliza `js/config.js`, generado localmente y excluido de Git. **Repite `npm run build:config` si cambias `.env`.**

La clave publicable es visible para quien utiliza el navegador. La protección del acceso a datos depende de las políticas RLS, no de ocultar esa clave.

La conexión PostgreSQL de demostración requiere que la base local esté disponible y que las variables `DB_*` estén configuradas. La ejecución aislada de Node.js no inicia PostgreSQL automáticamente.

### Validación de arranque — Bloque 3

1. Con `.env` configurado, comprobar que `npm run build:config` y `npm start` funcionan.
2. Renombrar temporalmente `.env` a `.env.bak` y comprobar que la generación de configuración falla con un mensaje de archivo faltante.
3. Restaurar `.env`. Ejecutar `git check-ignore .env`, que debe mostrar `.env`, y `git ls-files .env`, que no debe mostrar nada.
4. No guardar en Git capturas de tokens personales, secretos ni contraseñas.

## Variables de entorno

| Variable | Ejemplo | Uso |
|---|---|---|
| `PORT` | `3000` | Servidor Node local |
| `APP_ENV` | `development` | Entorno de trabajo |
| `LOCAL_URL` | `http://127.0.0.1:3000` | URL de referencia documental |
| `SUPABASE_URL` | `https://TU_PROYECTO.supabase.co` | Proyecto Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_TU_CLAVE_AQUI` | Clave pública únicamente |
| `ALLOWED_ORIGIN` | `http://127.0.0.1:5502,http://localhost:8080` | Orígenes CORS autorizados |
| `LOG_LEVEL` | `development` | Nivel declarado; logs básicos en consola |
| `DB_HOST` | `db` | Servicio PostgreSQL en Docker |
| `DB_PORT` | `5432` | Puerto interno de PostgreSQL |
| `DB_NAME` | `lombana_practica` | Base de datos local |
| `DB_USER` | `lombana_app` | Usuario local |
| `DB_PASSWORD` | Configuración privada | Contraseña local, nunca versionada |

## Rutas y códigos HTTP

Base: `http://127.0.0.1:3000/api`.

| Método | Ruta | Descripción | HTTP esperado |
|---|---|---|---|
| GET | `/salud` | Estado básico del servidor, sin comprobar la BD | 200 |
| GET | `/db/salud` | Consulta de solo lectura a PostgreSQL local | 200, 503 |
| GET | `/terapias` | Listar terapias activas | 200, 502, 503 |
| GET | `/terapias/:slug` | Obtener terapia por slug | 200, 400, 404 |
| GET | `/citas` | Listar citas del usuario autenticado | 200, 401 |
| GET | `/citas/:id` | Obtener cita propia | 200, 400, 401, 404 |
| POST | `/citas` | Registrar cita del usuario autenticado | 201, 400, 401, 409, 502/503 |
| PUT/PATCH | `/citas/:id` | Cancelar cita propia con `{"status":"cancelada"}` | 200, 400, 401, 404 |
| DELETE | `/citas/:id` | Cancelación lógica de cita propia, sin borrado físico | 204, 400, 401, 404 |
| Cualquiera | `/api/no-existe` | Ruta API inexistente | 404 JSON |
| GET | `/no-existe` | Página inexistente | 404 HTML personalizado |

Los códigos del proveedor se traducen a respuestas HTTP del servicio. Una falla de red se traduce en 503.

El **409 por doble reserva requiere una restricción adecuada en la base administrada por Supabase**. Las pruebas automatizadas comprobaron el manejo de ese error de forma simulada; no sustituyen la verificación de las restricciones y políticas reales.

La respuesta HTTP 204 no incluye cuerpo.

### Contrato de respuesta

Éxito:

```json
{"ok":true,"data":{}}
```

Listas:

```json
{"ok":true,"data":[],"total":0}
```

Error:

```json
{"ok":false,"error":{"codigo":"VALIDACION","mensaje":"..."}}
```

### Autenticación en la API

`/api/citas` exige la cabecera `Authorization: Bearer <ACCESS_TOKEN_DE_SESION>`.

El servidor valida el token mediante Supabase Auth antes de obtener el identificador del usuario y transfiere el mismo token a PostgREST. No utiliza credenciales administrativas.

Nunca compartir tokens de acceso en Git ni en capturas.

La protección de los datos reales depende de RLS y de las reglas de negocio configuradas en Supabase.

### Consultas rápidas sin token

```powershell
curl.exe -i http://127.0.0.1:3000/api/salud
curl.exe -i http://127.0.0.1:3000/api/terapias
curl.exe -i http://127.0.0.1:3000/api/db/salud
curl.exe -i http://127.0.0.1:3000/api/no-existe
curl.exe -i http://127.0.0.1:3000/pagina-inexistente
```

La ruta `/api/db/salud` requiere PostgreSQL local disponible y sus variables de configuración.

## Pruebas

- Suite automatizada: `npm test`.
- **39 pruebas aprobadas y 0 fallidas** en la comprobación del 20/10/2026.
- Las pruebas utilizan simulaciones y casos aislados; no realizan escrituras en la base real durante las comprobaciones documentadas.
- Tres pruebas específicas de PostgreSQL verifican configuración incompleta, puerto inválido y respuesta HTTP 503 controlada.
- Postman: importar `docs/POSTMAN_Lombana_Therapy.postman_collection.json`, configurar variables locales y ejecutar los casos autorizados con una cuenta de prueba.
- Las llamadas POST/PUT/DELETE a endpoints reales pueden modificar datos de Supabase; no deben ejecutarse sobre pacientes o citas existentes sin autorización.
- Registrar evidencias adicionales en `docs/PRUEBAS.md`.

Las pruebas automáticas no reemplazan la revisión de seguridad ni las verificaciones manuales exigidas por el docente.

## Seguridad y límites

- Cabeceras `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y CSP compatibles con los HTML existentes.
- Debido al código inline existente, la CSP utiliza `'unsafe-inline'`; consultar `docs/SEGURIDAD_Y_PENDIENTES.md`.
- CORS limita la cabecera `Access-Control-Allow-Origin` a los orígenes declarados. CORS no autentica usuarios y curl no está sujeto a estas restricciones del navegador.
- `.env` no se sirve ni versiona.
- `js/config.js` se entrega al navegador únicamente con datos publicables y está excluido de Git.
- El administrador requiere roles correctos y políticas RLS; ocultar un botón no representa autorización.
- La creación administrativa de usuarios requiere una implementación segura separada. Nunca colocar `service_role` en el navegador.
- El frontend principal continúa conectado directamente a Supabase.
- La ruta `/api/db/salud` y la página de demostración realizan exclusivamente consultas de lectura a PostgreSQL local.

## Estado de licencia

El proyecto Lombana Therapy utiliza la **licencia MIT**, autorizada por los titulares del proyecto.

El archivo `LICENSE` contiene los términos completos correspondientes a 2026.

La licencia permite utilizar, modificar y distribuir el código bajo las condiciones establecidas en MIT. Los recursos de terceros conservan sus propias licencias cuando corresponda.

## Documentación de la práctica

- `AUDITORIA.md`
- `docs/PRUEBAS.md`
- `docs/POSTMAN_Lombana_Therapy.postman_collection.json`
- `docs/CUESTIONARIO_BORRADOR.md`
- `docs/SEGURIDAD_Y_PENDIENTES.md`
- `docs/CONFIRMACIONES_NECESARIAS.md`
- `supabase/REVISION_SQL.MD`

## Git y cierre

La rama y el historial no viajan dentro de un ZIP descargado.

En una copia Git original se deben revisar los cambios con `git status`, guardarlos en una rama, solicitar revisión y fusionar únicamente después de validar.

No utilizar `push --force` ni incluir `.env`.

---

# Práctica 2 — Distribución de servicios web

## Descripción

Lombana Therapy es un proyecto integrador de servicios web que permite consultar terapias, gestionar usuarios y realizar reservaciones.

En la Práctica 2 se implementaron:

- Imágenes Docker para backend y frontend.
- Docker Compose para ejecutar tres servicios.
- PostgreSQL 16 local con volumen persistente.
- Nginx para publicar las páginas del sitio.
- Documentación OpenAPI 3.0.3 y Swagger UI.
- Integración de demostración entre frontend, Node.js y PostgreSQL local.
- Pruebas automatizadas y una instalación independiente de verificación.

## Requisitos

Para ejecutar el proyecto mediante Docker se necesita:

- Docker Desktop o Docker Engine.
- Docker Compose.
- Git.
- Acceso a una instancia compatible de Supabase para las funciones que dependan de ese servicio.

Node.js no necesita instalarse manualmente cuando se ejecuta todo mediante Docker.

## Instalación y ejecución con Docker

**1. Clonar el repositorio:**

```powershell
git clone https://github.com/4chavos1senor/lombana-therapy.git
```

**2. Entrar a la carpeta:**

```powershell
cd lombana-therapy
```

**3. Seleccionar la rama de la práctica mientras el Pull Request no esté fusionado:**

```powershell
git switch practica-distribucion
```

**4. Crear el archivo de configuración local:**

```powershell
Copy-Item .env.example .env
```

En Linux o macOS se puede utilizar:

```bash
cp .env.example .env
```

**5. Configurar `.env`:**

- URL y clave publicable de Supabase.
- Orígenes CORS correspondientes al entorno local.
- Variables de PostgreSQL local.
- Una contraseña propia para `DB_PASSWORD`.

No utilizar claves secretas ni publicar el archivo `.env`.

**6. Construir e iniciar los contenedores:**

```powershell
docker compose up --build -d
```

Docker Compose inicia los tres servicios definidos para la práctica.

**7. Verificar los servicios:**

```powershell
docker compose ps
```

El resultado esperado es que backend y frontend aparezcan activos y PostgreSQL alcance el estado `healthy`.

## Accesos

Una vez iniciados los contenedores:

| Servicio | Dirección |
|---|---|
| Frontend principal | http://localhost:8080 |
| Backend | http://localhost:3000 |
| API de salud | http://localhost:3000/api/salud |
| API de salud PostgreSQL | http://localhost:3000/api/db/salud |
| API de terapias | http://localhost:3000/api/terapias |
| Swagger UI | http://localhost:3000/api-docs |
| Demostración PostgreSQL | http://localhost:8080/verificacion-postgresql.html |

## Arquitectura Docker

El proyecto utiliza tres servicios.

### Backend

Servidor HTTP desarrollado con Node.js nativo. Proporciona los endpoints REST, la documentación OpenAPI y una ruta de verificación de PostgreSQL local.

Las operaciones existentes de usuarios, terapias y citas que dependen de Supabase conservan su integración original.

### Frontend

Servidor Nginx que publica los HTML, CSS, JavaScript e imágenes de Lombana Therapy.

Además, publica una página independiente de demostración para comprobar la consulta a la API Node.js.

### Base de datos

Contenedor PostgreSQL 16 con un volumen persistente y una comprobación de salud.

La tabla `public.docker_practice_status` permite comprobar la conexión mediante una operación `SELECT`.

**Importante:** PostgreSQL local está integrado con el backend para una consulta de demostración. No sustituye la base de datos real de pacientes, terapias, reservaciones ni pagos administrada por Supabase.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `APP_ENV` | Entorno de ejecución |
| `PORT` | Puerto del backend |
| `LOCAL_URL` | Dirección local de referencia |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Clave publicable de Supabase |
| `ALLOWED_ORIGIN` | Orígenes permitidos mediante CORS |
| `LOG_LEVEL` | Configuración de registros |
| `DB_HOST` | Nombre del servicio PostgreSQL |
| `DB_PORT` | Puerto interno de PostgreSQL |
| `DB_NAME` | Base de datos local |
| `DB_USER` | Usuario de PostgreSQL local |
| `DB_PASSWORD` | Contraseña local de PostgreSQL |

Docker Compose establece `HOST=0.0.0.0` y `PORT=3000` en el backend.

`.env.example` contiene valores de ejemplo y debe adaptarse antes de ejecutar el proyecto. `.env` está excluido de Git.

## Documentación de la API

La especificación OpenAPI está en:

`openapi.yaml`

Swagger UI está disponible en:

http://localhost:3000/api-docs

### Endpoints documentados

| Método | Endpoint | Función |
|---|---|---|
| GET | `/api/salud` | Verificar el servidor |
| GET | `/api/db/salud` | Consultar PostgreSQL local |
| GET | `/api/terapias` | Listar terapias activas |
| GET | `/api/terapias/{slug}` | Consultar una terapia por su identificador |

**Los cuatro endpoints se comprobaron mediante Swagger UI y respondieron HTTP 200.**

La ruta `GET /api/db/salud` utiliza el controlador `pg` y consulta la tabla `docker_practice_status` mediante una operación de solo lectura.

El contrato esperado para una consulta correcta es:

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

El número de registros puede variar según el estado de la base.

Si PostgreSQL no está disponible, la ruta devuelve un error HTTP 503 con un código de error controlado.

## Integración PostgreSQL — Práctica 2

Se implementó y comprobó una comunicación de demostración:

**Frontend Nginx → Backend Node.js → PostgreSQL local**

Los componentes agregados son:

- Dependencia `pg` para Node.js.
- Módulo `scripts/postgresql.cjs`.
- Endpoint `GET /api/db/salud`.
- Documentación del endpoint en `openapi.yaml`.
- Página `docker-demo/verificacion-postgresql.html`.
- Pruebas `tests/postgresql.test.cjs`.

### Página de demostración

En Docker, abrir:

http://localhost:8080/verificacion-postgresql.html

Presionar el botón **Consultar PostgreSQL**.

La página realiza una petición al backend, presenta el resultado JSON y muestra un mensaje indicando si la consulta se completó correctamente.

Se comprobó que la consulta devolvió `ok: true`, estado `activo` y un registro.

### Alcance de la integración

La integración es de demostración y de solo lectura.

No se sustituyeron las funciones originales de Lombana Therapy. El frontend principal sigue usando Supabase para sus operaciones existentes.

No se migraron pacientes, reservaciones, pagos ni autenticación a PostgreSQL local.

## Comandos de Docker Compose

Consultar servicios:

```powershell
docker compose ps
```

Consultar logs del backend:

```powershell
docker compose logs -f backend
```

Detener contenedores sin eliminar volúmenes:

```powershell
docker compose down
```

Iniciar en segundo plano:

```powershell
docker compose up -d
```

Reconstruir imágenes e iniciar:

```powershell
docker compose up --build -d
```

**Precaución:** `docker compose down -v` también elimina los volúmenes locales. No debe utilizarse si se desea conservar la información de PostgreSQL.

## Pruebas realizadas

Durante la Práctica 2 se comprobó:

- Construcción de la imagen Docker del backend.
- Ejecución aislada del servidor.
- Construcción del frontend Nginx.
- Inicio de los tres servicios mediante Docker Compose.
- PostgreSQL en estado `healthy`.
- Consulta SQL de lectura a `docker_practice_status`.
- Funcionamiento del frontend y de la página 404 personalizada.
- Acceso a Swagger UI y documentación OpenAPI 3.0.3.
- Respuestas HTTP 200 de los cuatro endpoints documentados.
- Conexión real entre Node.js y PostgreSQL local.
- Comunicación desde la página de demostración al backend.
- CORS permitido para `http://localhost:8080`.
- Manejo de error HTTP 503 cuando la configuración de PostgreSQL no está disponible.
- **39 pruebas automatizadas aprobadas y 0 fallidas.**
- Comprobación de cambios con `git diff --check`.
- Instalación desde una clonación independiente en la misma computadora.

La clonación de verificación se realizó localmente; no equivale a una instalación comprobada en otro equipo físico.

Las pruebas automatizadas no representan una validación integral de seguridad ni de todos los flujos reales de pacientes, citas y pagos.

## GitHub y estado de publicación

Repositorio:

https://github.com/4chavos1senor/lombana-therapy

Rama de trabajo:

`practica-distribucion`

Pull Request:

https://github.com/4chavos1senor/lombana-therapy/pull/11

Commit de integración PostgreSQL:

`c1064df`

Al 20/10/2026, el Pull Request #11 permanece abierto en borrador, con cuatro commits y sin fusionar a `main`.

**Pendientes:** revisión cruzada por otro equipo, aprobación de la integración, decisión de fusión y publicación del Release `v1.0.0`.

## Integrantes del equipo

**Equipo:** Lombana Therapy

**Asignatura:** Servicios para la Web

**Fecha de entrega:** 20/10/2026

- Navarro Martínez Maximiliano
- Soto Cuevas Erick
- Vargas Lombana Federico
- Utrera Robles Galilea
- Emeterio Anaya Yamil

## Licencia

El proyecto utiliza la licencia MIT, autorizada por sus titulares.

Copyright (c) 2026 Lombana.

Consultar `LICENSE` para conocer los términos completos.