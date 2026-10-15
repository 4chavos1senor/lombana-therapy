# Confirmaciones necesarias antes de marcar P1U3 como entregada

1. **Docente:** ¿acepta el backend local en Node.js nativo y la API propia de demostración mientras el frontend continúa usando Supabase directamente, o exige Express y que el frontend consuma las rutas `/api`? El PDF permite adaptar ideas a otros stacks, pero el criterio de evaluación debe confirmarse.
2. **Titulares/equipo:** elegir MIT, Apache 2.0, GPL v3, AGPL v3 u otra licencia y proporcionar cómo desean identificar a los titulares (sin compartir datos personales innecesarios). No se adjuntó LICENSE porque sería una autorización legal no confirmada.
3. **Supabase:** enviar exportación sin secretos del esquema de columnas, claves y políticas (ideal SQL de `pg_policies`, restricciones de tablas y esquema). NUNCA envíes service_role, sb_secret, passwords, access tokens ni `.env` real.
4. **Negocio:** confirmar si se permite únicamente una cita activa por fecha y hora o varias según terapeuta. El índice único solo se implementa con esta respuesta.
5. **Pruebas:** indicar si disponen de 2 cuentas de paciente de prueba y 1 admin, sin facilitar contraseñas. Se requiere que prueben RLS y agendamiento real desde su computadora.
6. **Entrega escolar:** confirmar si necesitan las respuestas del cuestionario en documento independiente y capturas de GitHub/Postman; se incluyen borrador y plantilla, pero deben completarse con evidencias propias.

Para continuar inmediatamente, lo más valioso es **(a) decisión del profesor sobre Express/API, (b) esquema/RLS de Supabase sin secretos, y (c) licencia acordada**.
