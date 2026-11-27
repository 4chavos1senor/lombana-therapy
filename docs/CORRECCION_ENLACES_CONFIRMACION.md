# Corrección de enlaces de confirmación de correo

**Fecha:** 27 de noviembre de 2026.

## Diagnóstico confirmado

En Supabase, el registro nuevo de las 16:34 UTC se confirmó a las
16:37 UTC. Después se registraron `One-time token not found` y
`Email link is invalid or has expired`, correspondientes a intentos
de verificar un enlace de uso único más de una vez.
Los registros también contienen un evento separado
`OAuth state not found or expired`, que no implica que el primer
enlace de confirmación haya fallado.

La documentación de Supabase advierte que algunos sistemas
antispam y las vistas previas de correo abren enlaces de manera
automática y consumen los tokens de un solo uso.

Referencia:
https://supabase.com/docs/guides/auth/auth-email-templates#email-prefetching

## Cambio preparado

Se añadió `confirmar-correo.html` con un botón que realiza
`supabaseClient.auth.verifyOtp({ token_hash, type: 'email' })`
solamente al ser pulsado. El token hash desaparece de la barra
de navegación con `history.replaceState` antes de la interacción.
No hay confirmación automática al cargar la página, para que los
escáneres que visitan el enlace no consuman el token.

**ATENCIÓN: no se ha modificado la plantilla activa de Supabase.**
No activar la plantilla de abajo hasta que la nueva página esté
publicada y accesible. Los enlaces existentes no cambian y pueden
continuar mostrando un error si se reutilizan.

## Cambio manual necesario en Supabase

En **Authentication → Emails → Templates → Confirm sign up**, poner:

```html
<h2>Confirma tu correo en Lombana Therapy</h2>
<p>Para completar el registro, abre esta página y pulsa el botón de confirmación:</p>
<p><a href="https://4chavos1senor.github.io/lombana-therapy/confirmar-correo.html?token_hash={{ .TokenHash }}">Confirmar mi correo</a></p>
<p>Si no solicitaste esta cuenta, puedes ignorar el mensaje.</p>
```

Guardar el cambio únicamente DESPUÉS de publicar la nueva página.

No usar `{{ .ConfirmationURL }}` en el enlace directo del correo:
esa URL consume inmediatamente el token al ser visitada.

No compartir tokens de confirmación, enlaces personales completos,
contraseñas de Gmail ni correos de pacientes.

## Prueba final (con cuenta propia autorizada)

1. Verificar que la nueva página está disponible en GitHub Pages.
2. Actualizar la plantilla de confirmación y guardar.
3. Usar un registro de prueba con un correo propio aún no confirmado,
   sin cambiar ni eliminar cuentas preexistentes.
4. Abrir el enlace recibido: la página debe mostrar el botón y NO
   confirmar la cuenta al cargarla.
5. Pulsar el botón una sola vez; debe informar confirmación exitosa.
6. Iniciar sesión con correo y contraseña y verificar acceso.
7. Reabrir el mismo enlace: debe mostrar que el token ya se consumió
   o no es válido, sin afectar la cuenta confirmada.
8. Confirmar que Google OAuth sigue funcionando por separado.

Si el usuario ya estaba confirmado, no es necesario generar nuevos
enlaces para esa cuenta.

## Alcance

No se han modificado cuentas, datos clínicos, citas, pagos,
roles, RLS, políticas de Auth ni ajustes SMTP.
Esta corrección requiere publicación y cambio manual de la plantilla.
