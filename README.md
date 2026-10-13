# Lombana Therapy

Sitio de terapias con catálogo, registro, inicio de sesión y agendamiento de citas.

## Tecnología
HTML5, CSS, JavaScript sin backend propio. La base de datos PostgreSQL, autenticación y API REST son servicios gestionados por **Supabase** (`supabase-js` v2 cargado desde CDN).

## Ejecutar en local
1. Descarga/descomprime el repositorio.
2. Abre la carpeta con Visual Studio Code.
3. Ejecuta **Live Server** sobre `index.html`, o `python -m http.server 5500` desde la raíz y abre `http://localhost:5500`.
4. Revisa `js/supabase.js`: contiene URL del proyecto y una **clave publicable**, no una clave secreta. Si se usa otro proyecto Supabase se cambian esos valores públicos. `*.env` no es leído por este sitio estático: `.env.example` es una referencia de configuración, no una integración automática.
5. En el panel de Supabase, comprueba las tablas `profiles`, `therapies`, `appointments`, autenticación, relaciones y políticas de acceso (RLS). Sin eso la aplicación no podrá operar correctamente.

## Páginas
- `index.html`: inicio.
- `terapias.html`, `terapia-detalle.html`: catálogo e información.
- `registro.html`, `login.html`: autenticación.
- `agendar.html`, `mis-citas.html`: citas.
- `admin.html`: administración. El control de pantalla **no sustituye** RLS.
- `404.html`: página de error personalizada; para que se sirva automáticamente ante URL inexistente hay que configurar el hosting.

## Interfaz REST y códigos HTTP
Esta versión **no implementa endpoints propios** ni un contrato JSON `{ok,data,error}`. `supabase-js` consume la API REST/PostgREST de Supabase, por ejemplo `/rest/v1/therapies` y `/rest/v1/appointments`. Los códigos HTTP, CORS y las cabeceras los determina Supabase o el hosting, no un middleware Express local.

## Seguridad y configuración pendientes
- Confirmar/crear RLS adecuado para `profiles`, `therapies`, `appointments`, incluyendo permisos de admin, filtrado por usuario y prohibición de autoasignarse `rol=admin`.
- Crear restricción única parcial de horarios si se confirma que **una sola cita activa** puede ocupar cada fecha/hora. Ver `supabase/REVISION_SQL.md`.
- Configurar cabeceras de seguridad y ruta 404 en hosting cuando sea posible; Live Server no equivale a hosting de producción.
- Probar con las herramientas del navegador, Postman o curl usando únicamente la **clave publicable** y una sesión de prueba; nunca guardar tokens reales en capturas/repositorios.
- La versión de `supabase-js` está acotada a la familia 2 pero aún se carga desde CDN, no localmente; esto **no cubre al 100%** el requisito de dependencias locales.
- Licencia: aún debe elegirla el titular del código. No se aplicó automáticamente una licencia abierta sin autorización.

## Documentos de revisión
`AUDITORIA.md`, `docs/PRUEBAS.md`, `supabase/REVISION_SQL.md`.

## Autoría y licencia
Proyecto Lombana Therapy. **Licencia pendiente de elección por sus titulares**.
