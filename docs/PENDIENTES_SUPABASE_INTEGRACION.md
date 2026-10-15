# Pendientes en Supabase antes de habilitar todas las funciones

**No se ejecutó SQL ni se desplegaron funciones a tu instancia en la preparación del ZIP.** El SMTP Gmail ya lo configuraste y validaste durante las pruebas anteriores. No compartas contraseñas de aplicaciones, `service_role`, tokens JWT ni Access Token de Mercado Pago.

## 1. Revisar esquema y duplicados (consultas de solo lectura)

```sql
SELECT table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public'
AND table_name IN ('profiles','therapies','appointments','mp_orders','cash_bookings')
ORDER BY table_name,ordinal_position;

SELECT fecha,hora_inicio,COUNT(*) AS citas_activas
FROM public.appointments WHERE status <> 'cancelada'
GROUP BY fecha,hora_inicio HAVING COUNT(*)>1;

SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public'
AND tablename IN ('profiles','therapies','appointments','mp_orders','cash_bookings');
```

Si ya existen `mp_orders` o `cash_bookings`, no apliques otra vez los SQL sin comparar las definiciones. El esquema de `appointments` debe admitir `id` UUID, `therapy_id`, `slot_id`, `fecha`, `hora_inicio`, `hora_fin`, `status`; terapias debe tener `id`, `nombre`, `precio`, `activo`. Verifica `status` y si usa ENUM. No se asumió su compatibilidad.

## 2. Pago en establecimiento

- Respaldar BD y revisar duplicados de citas.
- Revisar y, si son compatibles, ejecutar `supabase/sql/01_mercado_pago.sql` y `supabase/sql/02_pagos_en_establecimiento.sql` por ese orden.
- Desplegar `cash-booking` a través de Supabase CLI / Edge Functions, con el nombre exacto.
- Confirmar permisos y secretos (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, solo dentro de Supabase); probar con un paciente y un horario libre.
- El pago aparece como `pending_in_person`. No se considera pagado hasta una actualización autorizada. El ZIP no incorpora un panel para conciliar pagos.

## 3. Mercado Pago

- Configurar una aplicación oficial Checkout Pro y credenciales de **prueba** en Mercado Pago Developers.
- Revisión de `mp_orders`, `appointments` y protección de doble reserva; la inserción durante el webhook puede entrar en conflicto y exigir revisión.
- Desplegar `mp-checkout` y `mp-webhook` con la configuración en `supabase/config.toml`.
- Añadir secretos exclusivamente en **Supabase Edge Function Secrets**:
  - `MERCADOPAGO_ACCESS_TOKEN`
  - `MERCADOPAGO_WEBHOOK_SECRET`
  - `PUBLIC_SITE_URL` (HTTPS, **incluye la subcarpeta** en GitHub Pages, por ejemplo `https://usuario.github.io/lombana-therapy/`)
  - `MP_WEBHOOK_URL` (`https://<project-ref>.supabase.co/functions/v1/mp-webhook`)
- Configurar evento `payment` en Mercado Pago y su secret HMAC, probar pagos de sandbox, aprobación, rechazo, duplicados, reembolsos y conciliación. No aceptar dinero real antes de verificar todo esto.
- Los métodos visibles en la UI son informativos; Mercado Pago controla si ofrece tarjeta o transferencia.

## 4. Invitación de administradores

La función `invitar-administrador` de la base estaba en **modo prueba**. El nuevo código está preparado en `supabase/functions/invitar-administrador/index.ts` y **no está desplegado**.

- Respaldar la función actual (ya tienes respaldos), revisar RLS, `lt_controlar_rol_perfil` y las funciones asociadas a triggers en `auth.users`.
- Desplegar la nueva función **con la bandera desactivada**. El cliente de `admin.html` consultará `accion: 'verificar'` y mantendrá el botón deshabilitado.
- Configurar `ADMIN_INVITE_REDIRECT_URL=http://127.0.0.1:3000/establecer-contrasena.html` para pruebas locales, o la **URL HTTPS pública** para GitHub Pages; la URL debe estar en Authentication > URL Configuration > Redirect URLs.
- Probar que devuelve 200 para admin, 403 para paciente y 401 sin sesión. Confirmar que el cliente sigue bloqueado cuando `ADMIN_INVITES_ENABLED` no está en true.
- Solo después de la revisión de seguridad, configurar **en los secretos de la Edge Function** `ADMIN_INVITES_ENABLED=true` para habilitar el envío real. No hace falta guardar contraseñas administrativas en navegador.
- Enviar una invitación a un correo de prueba que **todavía no sea usuario**. Al abrir el correo en la misma computadora si usa 127.0.0.1, verificar `establecer-contrasena.html`, contraseña, rol y acceso a `admin.html`.
- Probar que el correo para un usuario existente no eleva su rol y que una invitación incompleta se atiende manualmente. El envío de correo y la asignación del rol **no forman una transacción atómica**.
- El endpoint utiliza `withSupabase({auth:'user'})` y comprueba rol en DB. Si se usa la autenticación del gateway, ajustar `verify_jwt` de manera compatible: con claves publicables actuales y autenticación interna se configura `verify_jwt=false`, sin quitar jamás la comprobación de sesión del código.

## 5. Pruebas finales y colaboración

- Revisar que `therapies`, `appointments`, `cash_bookings` y `mp_orders` tengan RLS restrictiva en operaciones accesibles al navegador.
- No hacer pruebas de cobros en producción; emplear usuarios y credenciales de prueba.
- Hacer pruebas con la página publicada y ajustar URL de Site URL, redirecciones y SMTP cuando proceda.
- Incorporar el ZIP en una rama del **repositorio del equipo**, revisar diferencias y fusionar mediante Pull Request. No sobrescribir directamente la rama `main`.
