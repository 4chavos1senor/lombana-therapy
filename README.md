> **INTEGRACIÓN CON GALI:** Lee primero [LEEME_INTEGRACION_FINAL.md](LEEME_INTEGRACION_FINAL.md) y [Pendientes en Supabase](docs/PENDIENTES_SUPABASE_INTEGRACION.md). No todos los servicios externos están habilitados automáticamente.

# Lombana Therapy — Práctica P1U3: Configuración de un servicio web

## Qué hace
Sitio de terapias con catálogo, registro, inicio de sesión, reservas de citas y panel administrativo. Incluye **API HTTP local** en Node.js nativo (`server.cjs`) con endpoints REST, JSON uniforme, validación, códigos HTTP, errores centralizados, logs, CORS limitado, cabeceras de seguridad y página 404. Mantiene la conexión directa actual del frontend con Supabase para evitar romper las funciones existentes durante la práctica.

> IMPORTANTE: Tener una API local implementada **no significa que el frontend ya use esa API**. Las páginas HTML siguen utilizando `supabase-js`. El servidor API se prueba por separado con Postman/curl; consultar al docente si exige migrar todas las operaciones del navegador al backend. Los ejemplos del PDF utilizan Express; esta adaptación usa Node HTTP nativo con las mismas ideas, sin dependencias adicionales para el servidor.

## Tecnologías
- Frontend: HTML5, CSS, JavaScript, Supabase JS v2 empaquetado localmente en `js/vendor/supabase.bundle.js`.
- Backend de la práctica: Node.js 20+, módulo `http` nativo; `fetch` a la API REST/Autenticación de Supabase.
- BD y autenticación: PostgreSQL y Supabase Auth, **servicios externos administrados**.
- Dependencias: `package.json`, `package-lock.json`; no subir `node_modules`.

## Requisitos previos
1. Node.js 20+ y npm.
2. Acceso al proyecto de Supabase y clave **publicable** (`sb_publishable_...`). Nunca usar claves `sb_secret_` o `service_role` en frontend ni en capturas.
3. Proyecto de Supabase con tablas `profiles`, `therapies`, `appointments`, relaciones y políticas RLS verificadas.
4. Puerto 3000 libre en localhost.

## Instalación y ejecución en localhost
```powershell
# 1. Entrar a la carpeta del proyecto
npm install

# 2. Crear configuración local (PowerShell)
Copy-Item .env.example .env

# 3. Abrir .env y sustituir SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY
#    por los datos PUBLICABLES de la instancia; mantener .env fuera de Git.

# 4. Generar js/config.js (solo datos públicos para el navegador)
npm run build:config

# 5. Ejecutar servidor local (incluye HTML y API)
npm start
```
Abrir `http://127.0.0.1:3000/index.html`. No se necesita Live Server para esta práctica. Si usas Live Server en `5502`, debes revisar `ALLOWED_ORIGIN` en `.env` y generar `js/config.js` igualmente. La API sigue escuchando en `3000`.

El frontend usa `js/config.js`, generado localmente y excluido de Git. **Repite `npm run build:config` si cambias `.env`**. La clave publicable es visible para quien usa el navegador; se protege el acceso a datos mediante RLS, no escondiendo esa clave.

### Validación de arranque (Bloque 3)
1. Con `.env` y sus valores reales: `npm run build:config` y `npm start` deben funcionar.
2. Renombra temporalmente `.env` a `.env.bak`; ambos comandos deben detenerse con un mensaje de archivo faltante.
3. Restaura `.env`. Comprueba `git check-ignore .env` (debe mostrar `.env`) y `git ls-files .env` (no debe mostrar nada).
4. No guardes en Git capturas de tokens personales, secretos ni contraseñas.

## Variables de entorno
| Variable | Ejemplo | Uso |
|---|---|---|
| `PORT` | `3000` | Servidor Node local |
| `APP_ENV` | `development` | Entorno de trabajo |
| `LOCAL_URL` | `http://127.0.0.1:3000` | URL de referencia documental |
| `SUPABASE_URL` | `https://TU_PROYECTO.supabase.co` | Servicio externo Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | Clave pública únicamente |
| `ALLOWED_ORIGIN` | `http://127.0.0.1:5502,http://localhost:5502` | Orígenes CORS autorizados, separados por coma |
| `LOG_LEVEL` | `development` | Nivel declarado; registro actual de peticiones es básico en consola |

## Rutas y códigos HTTP
Base: `http://127.0.0.1:3000/api`.

| Método | Ruta | Descripción | HTTP esperado |
|---|---|---|---|
| GET | `/salud` | Estado básico del servidor (no comprueba BD) | 200 |
| GET | `/terapias` | Listar terapias activas | 200, 502, 503 |
| GET | `/terapias/:slug` | Obtener terapia por slug | 200, 400, 404 |
| GET | `/citas` | Listar citas del usuario autenticado | 200, 401 |
| GET | `/citas/:id` | Obtener cita propia | 200, 400, 401, 404 |
| POST | `/citas` | Registrar cita del usuario autenticado | 201, 400, 401, 409, 502/503 |
| PUT/PATCH | `/citas/:id` | Cancelar cita propia con `{"status":"cancelada"}` | 200, 400, 401, 404 |
| DELETE | `/citas/:id` | Cancelación lógica de cita propia (no borrado físico) | 204, 400, 401, 404 |
| Cualquiera | `/api/no-existe` | Ruta inexistente | 404 JSON |
| GET | `/no-existe` | Página inexistente | 404 HTML personalizado |

Los códigos del proveedor se asignan a códigos del servicio; una falla de red se traduce en 503. El **409 por doble reserva requiere un índice/restricción apropiada en PostgreSQL**; no está garantizado hasta confirmar y aplicar la regla de negocio con RLS y SQL. Una ruta 204 no incluye body por definición.

### Contrato de respuesta
Éxito: `{"ok":true,"data":{...}}`, listas `{"ok":true,"data":[...],"total":N}`.
Error: `{"ok":false,"error":{"codigo":"VALIDACION","mensaje":"..."}}`.

### Autenticación en la API
`/api/citas` exige cabecera `Authorization: Bearer <ACCESS_TOKEN_DE_SESION>`; el servidor **valida ese token con Supabase Auth** antes de obtener el ID de usuario, y transfiere el mismo token a PostgREST. No utiliza credenciales administrativas. Nunca compartas un access token en Git ni capturas. **La protección real depende de RLS**; hay que verificarla en Supabase.

### Consultas rápidas sin token
```powershell
curl.exe -i http://127.0.0.1:3000/api/salud
curl.exe -i http://127.0.0.1:3000/api/terapias
curl.exe -i http://127.0.0.1:3000/api/no-existe
curl.exe -i http://127.0.0.1:3000/pagina-inexistente
```

## Pruebas
- Pruebas automatizadas **aisladas/mocks**, sin modificar BD real: `npm test` (12 casos).
- Postman: importar `docs/POSTMAN_Lombana_Therapy.postman_collection.json`, configurar variables locales y ejecutar casos con **una cuenta de prueba**. Las llamadas POST/PUT/DELETE sí pueden modificar datos reales.
- Completar evidencias y resultados en `docs/PRUEBAS.md`; pruebas automáticas no reemplazan las capturas ni verificaciones reales que exige el docente.

## Seguridad y límites
- Se entregan cabeceras `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y una CSP compatible con el HTML actual. Debido a código inline existente, la CSP usa `'unsafe-inline'`; ver `docs/SEGURIDAD_Y_PENDIENTES.md`.
- CORS restringe la cabecera `Access-Control-Allow-Origin` a los orígenes listados. CORS **no autentica** y curl no está sujeto a CORS.
- `.env` no se sirve ni versiona. `js/config.js` sí se entrega al navegador (solo variables públicas) y está ignorado en Git.
- El administrador requiere rol correcto en `profiles` y reglas RLS; **un botón oculto no es autorización**.
- Creación de usuarios desde el panel admin no se habilita: requiere función administrativa segura (Edge Function o servidor con privilegios separados). No usar `service_role` en el navegador.
- El frontend aún se comunica directamente con Supabase; las rutas de Node quedan listas para demostración y transición posterior.

## Estado de licencia

El proyecto Lombana Therapy utiliza la licencia MIT, autorizada por los titulares del proyecto.

El archivo `LICENSE` contiene los términos completos de la licencia, correspondientes al año 2026.

La licencia permite utilizar, modificar y distribuir el código bajo las condiciones establecidas en MIT. Los recursos de terceros conservan sus propias licencias cuando corresponda.

La propiedad intelectual y los derechos de los autores se reconocen conforme al archivo `LICENSE`.

## Documentación de la práctica
`AUDITORIA.md`, `docs/PRUEBAS.md`, `docs/POSTMAN_Lombana_Therapy.postman_collection.json`, `docs/CUESTIONARIO_BORRADOR.md`, `docs/SEGURIDAD_Y_PENDIENTES.md`, `docs/CONFIRMACIONES_NECESARIAS.md` y `supabase/REVISION_SQL.MD`.

## Git y cierre
La rama y el historial **no viajan dentro del ZIP**. En tu copia Git original revisa `git status`, guarda commits en tu rama personal, solicita revisión del equipo y fusiona después de validar, **sin `push --force`** ni incluir `.env`.



---

# Práctica 2 — Distribución de servicios web

## Descripción

Lombana Therapy es un proyecto integrador de servicios web que permite consultar terapias, gestionar usuarios y realizar reservaciones.

En esta práctica se implementó Docker para distribuir el proyecto mediante contenedores, Docker Compose para orquestar los servicios y OpenAPI con Swagger UI para documentar y probar la API REST.

## Requisitos

Para ejecutar el proyecto mediante Docker se necesita:

- Docker Desktop o Docker Engine.
- Docker Compose.
- Git.
- Acceso a una instancia compatible de Supabase para las funciones que dependen de ese servicio.

Node.js no necesita instalarse manualmente cuando se utiliza Docker.

## Instalación y ejecución con Docker

1. Clonar el repositorio:

```powershell
git clone https://github.com/4chavos1senor/lombana-therapy.git
```

2. Entrar a la carpeta:

```powershell
cd lombana-therapy
```

3. Crear el archivo de configuración local:

```powershell
Copy-Item .env.example .env
```

En Linux o macOS se puede utilizar:

```bash
cp .env.example .env
```

4. Abrir `.env` y configurar las variables necesarias, incluyendo los valores publicables de Supabase y una contraseña propia para PostgreSQL local.

No utilizar claves secretas ni publicar el archivo `.env`.

5. Construir e iniciar los contenedores:

```powershell
docker compose up --build
```

Docker Compose inicia los tres servicios definidos para la práctica.

## Accesos

Una vez que los contenedores estén funcionando:

| Servicio | Dirección |
|---|---|
| Frontend | http://localhost:8080 |
| Backend | http://localhost:3000 |
| API de salud | http://localhost:3000/api/salud |
| API de terapias | http://localhost:3000/api/terapias |
| Swagger UI | http://localhost:3000/api-docs |

## Arquitectura Docker

El proyecto utiliza tres servicios:

### Backend

Servidor HTTP desarrollado con Node.js nativo. Proporciona los endpoints de la API REST y la documentación OpenAPI.

### Frontend

Servidor Nginx que publica las páginas HTML, estilos CSS, JavaScript e imágenes de Lombana Therapy.

### Base de datos

Contenedor PostgreSQL 16 utilizado como base local de práctica, con volumen persistente y comprobación de salud.

Importante: el backend y el frontend actuales siguen utilizando Supabase para las operaciones existentes. PostgreSQL local está separado y todavía no sustituye ni integra la base de datos real de pacientes y reservaciones.

## Variables de entorno

| Variable | Descripción |
|---|---|
| APP_ENV | Entorno de ejecución |
| PORT | Puerto del backend |
| LOCAL_URL | Dirección local de referencia |
| SUPABASE_URL | URL del proyecto Supabase |
| SUPABASE_PUBLISHABLE_KEY | Clave publicable de Supabase |
| ALLOWED_ORIGIN | Orígenes autorizados mediante CORS |
| LOG_LEVEL | Configuración de registros |
| DB_HOST | Nombre del servicio PostgreSQL |
| DB_PORT | Puerto interno de PostgreSQL |
| DB_NAME | Nombre de la base de datos local |
| DB_USER | Usuario de PostgreSQL local |
| DB_PASSWORD | Contraseña local de PostgreSQL |

La variable HOST del backend se establece en Docker Compose como 0.0.0.0.

El archivo `.env.example` contiene valores de ejemplo y debe adaptarse antes de ejecutar el proyecto. El archivo `.env` está excluido de Git.

## Documentación de la API

La documentación OpenAPI se encuentra en:

openapi.yaml

La interfaz Swagger UI está disponible en:

http://localhost:3000/api-docs

Endpoints documentados:

- GET /api/salud
- GET /api/terapias
- GET /api/terapias/{slug}

Los tres endpoints se probaron desde Swagger UI utilizando Try it out y respondieron con HTTP 200.

## Comandos de Docker Compose

Consultar los servicios activos:

```powershell
docker compose ps
```

Consultar los registros del backend:

```powershell
docker compose logs -f backend
```

Detener los contenedores:

```powershell
docker compose down
```

Iniciar en segundo plano:

```powershell
docker compose up -d
```

El comando docker compose down -v elimina también los volúmenes locales. No debe utilizarse si se desea conservar la información de PostgreSQL.

## Pruebas realizadas

- Construcción de imagen Docker del backend.
- Ejecución aislada del contenedor.
- Inicio de tres servicios mediante Docker Compose.
- Verificación de PostgreSQL en estado healthy.
- Comprobación del frontend y la página 404 personalizada.
- Ejecución de 36 pruebas automatizadas, con 0 fallidas.
- Pruebas de tres endpoints mediante Swagger UI.
- Validación visual de OpenAPI mediante Swagger Editor.

Pendiente antes de la entrega final: validar una clonación completamente limpia y resolver las diferencias de integración señaladas anteriormente.

## Integrantes del equipo

- Vargas Lombana Federico, Soto Cuevas Erick, Navarro Martínez Maximiliano, Utrera Robles Galilea, Emeterio Anaya Yamil

## Licencia

El proyecto utiliza la licencia MIT.

Copyright (c) 2026 Lombana.

Consultar el archivo LICENSE para conocer los términos completos.
