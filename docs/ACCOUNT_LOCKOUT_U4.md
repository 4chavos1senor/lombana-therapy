
# Lombana Therapy — Account Lockout

## Estado
Diseño preparado. No implementado ni activado.

## Objetivo
Proteger el inicio de sesión frente a intentos
repetidos de contraseñas incorrectas.

## Reglas propuestas
- Máximo: 5 intentos fallidos.
- Duración del bloqueo: 15 minutos.
- La restricción debe aplicarse en el servidor.
- No almacenar contraseñas ni tokens.
- No revelar si una cuenta existe.
- Evitar bloqueos abusivos de cuentas legítimas.
- Mantener recuperación segura de acceso.

## Arquitectura actual
La autenticación utiliza Supabase Auth mediante
signInWithPassword() desde js/auth.js.

## Implementación pendiente
1. Comprobar el plan y capacidades de Supabase.
2. Revisar los límites de solicitudes de Auth.
3. Configurar CAPTCHA cuando corresponda.
4. Evaluar Password Verification Hook.
5. Implementar bloqueo real si está soportado.
6. Probar con cuentas autorizadas de prueba.
7. Verificar que el bloqueo no sea evadible.
8. Ejecutar pruebas de regresión.

## Restricciones
No modificar usuarios, contraseñas, pacientes,
citas, pagos ni permisos existentes.

No activar en producción sin pruebas.
