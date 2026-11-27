# U4 — Integración de seguridad (en revisión)

**Estado del paquete:** rama de trabajo y Pull Request; **NO activado en producción**.
**Fecha:** 27 de noviembre de 2026.

## Rubrica y alcance

| Criterio | Preparado en código | Prueba real pendiente |
| --- | --- | --- |
| Autenticación de usuarios | Contraseña + Google OAuth existentes preservados | Sí: sesión, roles, redirecciones |
| CAPTCHA | Turnstile con configuración pública + envío captchaToken en login y registro | Sí: Cloudflare + Supabase |
| MFA (TOTP) | Enrolamiento voluntario, QR, desafío de 6 cifras, redirección y UI bajo bandera | Sí: aplicación autenticadora, pruebas de acceso; RLS/AAL2 para rutas sensibles |
| Session Timeout | 15 min y carga de script en páginas de sesión, bandera configurable | Sí: prueba navegando entre pestañas |
| Account Lockout | Avisos y bloqueo local 3/1/2 en navegador; borrador de hook SQL | Sí: el bloqueo real de cuentas **no está desplegado**, requiere Teams/Enterprise y pruebas antiabuso |
| Corrección | Tests locales sin red y flujo existente preservado | Sí: regresión real en entorno de pruebas |

## Interruptores del frontend

El archivo `js/config.js` público contiene `security` con:
- `captchaEnabled` — por defecto `false`.
- `turnstileSiteKey` — clave PUBLICA, por defecto vacía.
- `mfaEnabled` — por defecto `false`.
- `sessionTimeoutEnabled` — por defecto `false`.

En desarrollo `scripts/build-config.cjs` exporta esos valores desde
`CAPTCHA_ENABLED`, `TURNSTILE_SITE_KEY`, `MFA_ENABLED` y `SESSION_TIMEOUT_ENABLED`
en `.env`. **NUNCA poner la Secret Key de Turnstile en `.env` del frontend**.
La Secret Key debe configurarse únicamente en Supabase Authentication > Bot and Abuse Protection.

## Secuencia de habilitación (solo en entorno autorizado de pruebas)

1. Confirmar políticas CSP y lista de dominios de Cloudflare (GitHub Pages y localhost).
2. Preparar una cuenta de prueba no relacionada con pacientes y guardar evidencia sin credenciales.
3. Añadir la Site Key PUBLICA y activar `captchaEnabled` únicamente en la versión de prueba.
4. Probar primero captchaToken y mensajes para login/registro; después habilitar CAPTCHA en **Supabase de pruebas**, y repetir.
5. Probar MFA optativo con cuenta de prueba, incluyendo enrolamiento, verificación TOTP, redirección desde Google y contraseña y reingreso. El segundo factor debe reforzarse con políticas RLS del servidor si se usa para proteger datos sensibles.
6. Habilitar `sessionTimeoutEnabled` en pruebas y verificar cierre a los 15 minutos, múltiples pestañas y error al cerrar sesión.
7. **No activar el SQL de bloqueo en la base de producción.** El Password Verification Attempt Hook solo se incluye en los planes Teams y Enterprise según documentación oficial (2026-11-20); consultar el plan antes de implementarlo. No simular "bloqueo seguro" con localStorage.
8. Realizar regresión de agenda, pagos y administración sin modificar citas existentes ni cobrar dinero real.

## Limitaciones

- Un control de acceso solo en el navegador **no es Account Lockout de servidor**: borrar localStorage o usar otra máquina evade el contador. Los avisos de bloqueo son solo visuales, no correos electrónicos.
- El SQL de Account Lockout es un borrador **no ejecutado ni validado** y requiere un ensayo en entorno de prueba.
- Activar MFA optativo puede afectar la recuperación de acceso si un usuario pierde su autenticador; disponer de soporte autorizado y proceso de recuperación.
- Estas pruebas automatizadas son simulaciones: no confirman todavía que Google OAuth, Cloudflare o Supabase estén operando en vivo.

## Fuentes técnicas verificadas

- https://supabase.com/docs/guides/auth/auth-captcha
- https://supabase.com/docs/guides/auth/auth-mfa/totp
- https://supabase.com/docs/guides/auth/auth-hooks
- https://supabase.com/docs/guides/auth/auth-hooks/password-verification-hook
