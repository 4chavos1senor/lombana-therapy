# Lombana Therapy — Account Lockout (U4)

## Regla solicitada (27/11/2026)

- Primer grupo de **3 credenciales incorrectas**: aviso y **1 minuto** de suspensión.
- Tras terminar el primer minuto, otros **3 intentos incorrectos**:
  aviso y **2 minutos** de suspensión.
- Los siguientes grupos mantienen 2 minutos.
- Un inicio de sesión correcto reinicia la progresión.
- Solo cuentan errores específicos de credenciales (`invalid_credentials`),
  no errores de red, CAPTCHA, límites de Supabase ni correo sin confirmar.
- El inicio de sesión mediante Google OAuth no se bloquea por este control.

## Estado real y garantías

En `js/login-lockout.js` existe un **control local del navegador**:
se conserva por cuenta en `localStorage` mediante una clave derivada del correo
(no se almacena el correo literal), sobrevive a recargas y muestra el
tiempo restante. Es **demostrativo**, no un bloqueo seguro de la cuenta:
`localStorage` puede borrarse y las peticiones directas a Supabase Auth o
desde otro navegador no se bloquean. No equiparar esto con protección
de servidor ni anunciarlo como una defensa contra ataques reales.

Un bloqueo real requiere interceptar los intentos del lado de Supabase Auth.
El **Password Verification Attempt Hook** está disponible en planes
Teams/Enterprise según la documentación actual:
https://supabase.com/docs/guides/auth/auth-hooks

El archivo `docs/ACCOUNT_LOCKOUT_U4_HOOK_BORRADOR.sql` es solo un
**borrador sin ejecutar** de esa estrategia, actualizado a la regla 3/1/2.
No se ha activado el hook ni alterado la base remota.

## Riesgo: bloqueo malicioso de cuentas

Cualquiera podría enviar repetidamente contraseñas equivocadas contra una
cuenta conocida y hacer que su dueño quede bloqueado. Antes de activar
un hook real, diseñar mitigaciones anti-DoS, observabilidad, recuperación
y pruebas autorizadas. Supabase recomienda considerar avisos de seguridad
en vez de bloquear al usuario por fallos provocados por terceros.

## Avisos

Los avisos actuales son **en la interfaz**, al llegar a cada tercer fallo.
**No se envían correos de alerta de bloqueo.** Un sistema de notificación
por correo necesita proveedor SMTP autorizado, rate limits y garantías
antiabuso adicionales.

## Verificación y restricciones

- Tests automáticos con reloj y cliente Supabase simulados.
- Pruebas reales de servidor aún pendientes.
- No tocar pacientes, contraseñas, pagos ni citas históricas.
- No fusionar a `main` sin validación final autorizada.
