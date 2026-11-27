# Diagnóstico de correo de confirmación — Lombana Therapy

**Estado: configuración del proveedor de correo pendiente de comprobar.**
Ningún correo se ha enviado como parte de esta revisión; no se han
creado ni modificado cuentas de pacientes.

## Qué hace la página

`reenviar-confirmacion.html` invoca
`supabaseClient.auth.resend({ type: 'signup', email, options: { emailRedirectTo } })`.

Este flujo **solo aplica a cuentas de correo y contraseña que tengan la
confirmación de registro pendiente**. Quien entra con Google normalmente
ya tiene su dirección verificada por el proveedor y no necesita un
segundo correo de confirmación de Lombana Therapy.

Una respuesta exitosa de `resend()` confirma la aceptación de la
petición, **no demuestra que el mensaje haya llegado al buzón**.
La respuesta no revela si existe una cuenta con ese correo.

## Causa frecuente: correo predeterminado de Supabase

Desde las reglas vigentes de Supabase, el SMTP integrado para pruebas
solo entrega a direcciones autorizadas del equipo del proyecto; no es
una solución de correo para pacientes. Puede responder con un error
como `email_address_not_authorized` o aplicar límites de frecuencia.
Se requiere SMTP propio para destinatarios externos.

Documentación actual:
https://supabase.com/docs/guides/auth/auth-smtp

## Pasos de administrador (sin colocar secretos en GitHub)

1. En Supabase, abrir **Authentication → SMTP Settings** y comprobar si
   está configurado un proveedor SMTP externo. No compartir contraseñas.
2. Elegir un servicio de correo transaccional y verificar el dominio de
   envío en ese servicio (SPF/DKIM según instrucciones del proveedor).
3. Configurar host, puerto, usuario, contraseña de SMTP y remitente
   exclusivamente en el panel privado de Supabase, no en `.env` del
   frontend ni en el repositorio.
4. Comprobar **Authentication → Email Templates → Confirm sign up**,
   que el enlace de confirmación no esté roto, y
   **Authentication → URL Configuration** para el dominio publicado
   y el retorno local autorizado.
5. Confirmar que la verificación de correo esté habilitada para los
   registros que la requieran.
6. Con una **cuenta de pruebas creada con correo y contraseña** que aún
   no esté confirmada, solicitar un reenvío una sola vez y revisar
   bandeja de entrada y spam. Verificar los registros Auth de Supabase
   y de entregabilidad del proveedor SMTP sin exponer el destinatario.
7. Si Supabase devuelve `429`, respetar la espera: no repetir
   envíos en un ciclo.

## Errores que distingue el frontend

- Destinatario no autorizado: servicio aún no disponible para el correo.
- Límite 429: aviso de esperar antes de reintentar.
- Otro error: solicitud no enviada, consultar soporte.
- Solicitud aceptada: aviso neutro sin prometer entrega.

## Seguridad

No enviar correos masivos a pacientes para probar el servidor.
No crear cuentas falsas ni modificar `auth.users` para una prueba.
No almacenar SMTP Password, JWT ni tokens en el repositorio o
documentación. No se ha alterado la configuración de correo real.
