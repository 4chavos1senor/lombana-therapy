# Revisión de seguridad en Supabase — NO EJECUTAR A CIEGAS

Antes de aplicar SQL real, consultar columnas y políticas actuales en Supabase. No conocemos el esquema completo ni si ya existen restricciones/políticas; un cambio incorrecto puede bloquear operaciones o borrar funcionalidad.

## Confirmar en dashboard
- `profiles`: la lectura/edición del perfil propio; un paciente **no puede modificar rol** en su propio registro ni asignarse rol administrador, incluso a través de `upsert`.
- `therapies`: lectura de terapias activas para el público; inserción/edición/precios solo por administradores autorizados.
- `appointments`: cada paciente ve, crea y cancela únicamente sus citas; administrativo autorizado puede consultarlas según función; no confiar solamente en ocultar botones HTML.
- Si `profiles.rol` es modificable por el usuario y RLS permite actualizar toda la fila, hay riesgo de escalación a admin: resolver con columnas/permisos, trigger o RPC controlada.
- Definir si habrá una o varias salas/terapeutas. Solo si una fecha+hora puede tener UNA cita no cancelada, considerar índice parcial único:

```sql
-- PROPUESTA: revisar datos duplicados existentes y nombres de columna/estado antes de ejecutar.
-- CREATE UNIQUE INDEX appointments_un_horario_activo
-- ON public.appointments (fecha, hora_inicio)
-- WHERE status IS DISTINCT FROM 'cancelada';
```

La comprobación frontend previa en `js/agenda.js` **no previene condiciones de carrera**.

## Configuraciones externas
- Verificar URLs de redirección autorizadas en Supabase Auth.
- Revisar CORS/headers según proveedor real de alojamiento.
- Usar sólo llave publicable en `js/supabase.js` (nunca secret/service_role).
- Aplicar pruebas de aislamiento con dos usuarios de prueba y uno administrativo.
