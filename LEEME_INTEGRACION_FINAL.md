# Lombana Therapy — integración conservando el proyecto original

## Qué se integró desde `gali.zip`

- Accesibilidad: menú compacto, contraste, escala de texto, modo oscuro, lectura y funciones de voz condicionadas al navegador (`js/accesibilidad.js`). No implica certificación WCAG.
- Chatbot informativo que consulta `therapies` para precios y duración; no es una IA generativa.
- Agenda con resumen y modalidades diferenciadas: **reserva real sin cobro registrado** (conserva la operación original), **efectivo pendiente** (requiere `cash-booking`), **Mercado Pago Checkout Pro** (requiere infraestructura externa) y **simulación escolar** claramente identificada.
- `cita-demo.html` (simulación, sin crear cita), `cita-confirmada.html` (verificación de una cita real con la sesión), `pago-resultado.html` (verifica pedido en `mp_orders`, no confía en URL), visualización opcional de pago presencial en Mis citas.
- Código fuente del backend opcional bajo `supabase/functions` y migraciones bajo `supabase/sql`.
- Flujo de administradores desde `admin.html` y Edge Function `invitar-administrador`, bloqueado por defecto hasta habilitación consciente con secretos de Supabase.
- Se conserva la API de Node `server.cjs`, los métodos de acceso originales y la gestión de clientes y terapias.

## Abrir en VS Code localmente

1. Extraer este ZIP y abrir `lombana-therapy-main` (la carpeta que contiene `package.json`).
2. Copiar **tu `.env` local original** a esta carpeta. Ese archivo no se incluye en el ZIP por seguridad. ¡Nunca lo subas a GitHub!
3. En PowerShell ejecutar, en este orden:

```powershell
npm install
npm run build:config
npm start
```

4. Abrir `http://127.0.0.1:3000/index.html`.
5. Probar acceso, terapias, agenda, Mis citas, accesibilidad y chatbot. Para la confirmación de citas reales necesitas autenticación y políticas RLS correctas en Supabase.
6. Si se modifica `server.cjs`, reiniciar `npm start`.

**Nota:** el archivo `js/config.js` se genera desde `.env` y contiene únicamente la URL y la clave publicable de Supabase. El ZIP deliberadamente no incluye configuración de una cuenta concreta.

## Estado real de la integración

| Función | Preparación | Requisito para usarla |
| --- | --- | --- |
| Sitio, inicio de sesión y catálogo | Archivos integrados | Configuración `js/config.js` y Supabase con las políticas actuales |
| API `/api/*` en VS Code | Conservada | `npm start` en tu computadora |
| Accesibilidad y chatbot | Archivos integrados | Navegador compatible; catálogo desde Supabase para precios |
| Reserva real directa | Conservada con recibo verificable | Permisos RLS para `appointments`, disponibilidad y protección contra concurrencia |
| Simulación escolar | Disponible | No modifica datos ni procesa dinero |
| Pago presencial | Cliente y servidor preparados | SQL `01`, `02` y desplegar `cash-booking`; **NO disponible solo con el ZIP** |
| Mercado Pago real | Cliente y servidor preparados | Cuenta de Mercado Pago, secretos, SQL, functions y webhook; **NO probado con dinero real** |
| Nuevos administradores | Código preparado, bloqueado | Desplegar función, probar correo e invitación, establecer `ADMIN_INVITES_ENABLED=true` |
| GitHub Pages | Workflow incluido | Repositorio, permisos Pages, secrets de claves **públicas** y URL de redirección HTTPS |

## IMPORTANTE sobre pagos

La versión de `gali.zip` incluía archivos de simulación y scripts de servidor de pagos, pero el agendamiento visible del ZIP simula la confirmación sin guardar la cita. Esta integración **separa explícitamente** ese modo de las reservas reales para no presentar como pagado o confirmado algo que no se ha registrado.

No ejecutes migraciones sin consultar primero `docs/PENDIENTES_SUPABASE_INTEGRACION.md`. En caso de aprobarse un pago tardío o existir conflicto de horario, un webhook puede requerir revisión manual; no asumas que cada cobro genera automáticamente una cita.

## Integración a GitHub Pages

Se incluye `.github/workflows/publicar-paginas.yml` para generar `js/config.js` a partir de secrets del repositorio y publicar **únicamente HTML, CSS, JS y assets**. La API de Node (`server.cjs`) **no se ejecuta** en GitHub Pages; sí se pueden llamar directamente las Edge Functions y Supabase desde el frontend.

Antes de ejecutar el workflow hay que activar GitHub Pages con *Source = GitHub Actions* y definir `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` en *GitHub Actions Secrets* (son datos de cliente, nunca `service_role`). Revisa cuál repositorio del equipo se usa y no sobrescribas las contribuciones de otras personas al sincronizar.

Los enlaces de invitación enviados desde internet deben usar `https://.../establecer-contrasena.html` en **Redirect URLs** y como `ADMIN_INVITE_REDIRECT_URL`. `127.0.0.1` funciona solo en el equipo donde corre Node.

## Seguridad de archivos y respaldos

Se excluyeron `.env`, `node_modules`, configuraciones privadas y capturas de evidencia que podrían contener tokens. Tus evidencias anteriores permanecen en el proyecto original. El historial de Git y los datos de producción no han sido modificados por esta integración.
