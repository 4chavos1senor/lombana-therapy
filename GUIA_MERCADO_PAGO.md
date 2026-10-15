# Mercado Pago + Lombana Therapy — Instalación

Este proyecto integra **Checkout Pro** (redirige al paciente al sitio oficial de Mercado Pago). El HTML por sí solo NO puede procesar cobros: falta desplegar funciones de Supabase y configurar credenciales de tu propia cuenta.

## 5 librerías usadas

1. `@supabase/supabase-js@2` — sesión, consultas, Edge Functions y estado del pedido.
2. `dayjs@1` — formato de fecha en el componente de resumen de cita.
3. `sweetalert2@11` — avisos de pago y errores.
4. `lucide@0.468.0` — íconos del resumen de pago y seguridad.
5. `dompurify@3` — sanea texto que aparece en el resumen.

## 6 componentes de interfaz

En `js/pagos-componentes.js`: 1) pasos, 2) terapia y precio, 3) fecha y hora, 4) método, 5) estado del pago y 6) aviso de seguridad.

## Activación paso a paso

1. Haz copia de seguridad de la base de datos. Revisa en Supabase que las tablas se llamen `therapies` y `appointments` con las columnas usadas en `js/agenda.js`. **Antes de ejecutar SQL**, confirma que `appointments.id`, `therapy_id`, los horarios y el tipo del estado sean compatibles con la función. `mp_orders.appointment_id` se definió como UUID; cámbialo si tus IDs no son UUID. No aplicar índices UNIQUE sobre citas históricas: usar el trigger del archivo 03 para evitar nuevos empalmes.
2. En Supabase > SQL Editor ejecuta `supabase/sql/01_mercado_pago.sql`. Esto crea `mp_orders`, su política RLS de solo lectura por propietario (sin crear índices UNIQUE en citas históricas). No publiques credenciales privadas en SQL ni GitHub.
3. En [Mercado Pago Developers](https://www.mercadopago.com.mx/developers/) crea una aplicación de Checkout Pro, obtén el **Access Token de prueba** y después el de producción, y configura Webhooks (evento `payment`) con su clave secreta. No necesitas exponer la Public Key en este checkout redirigido.
4. Despliega el proyecto en una dirección **HTTPS pública** (ejemplo `https://tudominio.mx`). Live Server `127.0.0.1:5502` permite probar la interfaz, pero **no las redirecciones productivas ni los webhooks públicos**.
5. Instala Supabase CLI e inicia sesión, luego vincula el proyecto:
   ```bash
   supabase login
   supabase link --project-ref pqeqarxybindwbgsbdlq
   ```
6. Configura los secretos **solo** en Supabase Edge Function Secrets (o CLI `supabase secrets set NOMBRE=VALOR`). Nunca pongas `MERCADOPAGO_ACCESS_TOKEN` ni `MERCADOPAGO_WEBHOOK_SECRET` en `.env` público o JavaScript del navegador.
   - `MERCADOPAGO_ACCESS_TOKEN`: token secreto de Mercado Pago.
   - `MERCADOPAGO_WEBHOOK_SECRET`: clave de firma de notificaciones.
   - `PUBLIC_SITE_URL`: URL HTTPS donde está publicado el sitio (sin la barra final; si lo instalas en subcarpeta, modifica las back_urls).
   - `MP_WEBHOOK_URL`: `https://pqeqarxybindwbgsbdlq.supabase.co/functions/v1/mp-webhook`.
   - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: habitualmente disponibles como secretos de Supabase; la función también intenta `SUPABASE_SECRET_KEYS` de configuración moderna.
7. Ejecuta:
   ```bash
   supabase functions deploy mp-checkout --no-verify-jwt
   supabase functions deploy mp-webhook --no-verify-jwt
   ```
   La función de checkout valida explícitamente la sesión usando el JWT del usuario, aunque no use la validación automática de gateway. El webhook valida el HMAC de Mercado Pago antes de consultar el pago.
8. En Mercado Pago configura el webhook con la misma URL del paso 6. Prueba con **cuentas de prueba** (vendedor y comprador diferentes) y confirma en Supabase que el pedido `mp_orders.status` se actualiza a `approved` y la cita aparece en `appointments`. **No uses dinero real antes de completar estas pruebas.**

## Comportamiento y límites

- El precio se obtiene en el servidor de `therapies.precio`, no desde lo que envía el navegador.
- Se reserva un horario mientras el pedido esté `pending` durante 30 minutos. El estado final depende del webhook, no de los parámetros de retorno.
- Si Mercado Pago aprueba una operación vencida, fallida, con precio distinto o existe un conflicto de horario, podría requerir intervención/reembolso manual. El estado `review` indica revisión obligatoria. No debes tratarlo como cita confirmada.
- Los pagos aprobados crean una cita con status `confirmada` solo cuando Supabase puede insertarla. El trigger del archivo 03 impide reservas confirmadas que se superpongan, sin alterar las filas existentes. Las otras funciones del sitio (por ejemplo un administrador que inserta citas) deben respetar la misma restricción.
- La página `pago-resultado.html` muestra el pedido más reciente del usuario autenticado. Para soporte profesional conviene ampliar el seguimiento de transacciones, los reembolsos, pagos tardíos, el historial y los avisos al cliente.
- Debes adaptar tipos de IDs o campos si el esquema real es diferente; **no afirmamos haber probado pagos reales**.

## Archivos clave

`agendar.html`, `js/agenda.js`, `js/pagos-componentes.js`, `css/pagos.css`, `pago-resultado.html`, `supabase/sql/01_mercado_pago.sql`, `supabase/functions/mp-checkout/index.ts`, `supabase/functions/mp-webhook/index.ts`, `supabase/config.toml`.
