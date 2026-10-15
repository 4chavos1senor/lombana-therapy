# Una agenda, un terapeuta: activacion segura

Esta correccion **no cambia registros existentes**. Respeta los duplicados historicos de mayo de 2026 y las citas futuras que hoy no tienen `therapist_id` o `slot_id`.

## Activacion (obligatoria; el ZIP por si solo NO modifica Supabase)

1. Verifica que estas en Supabase > proyecto Lombana Therapy > SQL Editor. Conserva el respaldo de roles/schema/data que ya generaste.
2. Abre **`supabase/sql/03_agenda_un_terapeuta.sql`** de este ZIP, copia el contenido y ejecútalo en **SQL Editor**. Solo crea/reemplaza funciones y un trigger; no ejecuta `UPDATE`, `DELETE` ni `INSERT` en appointments.
3. Comprueba que se instaló:

```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid='public.appointments'::regclass
  AND tgname='trg_lt_evitar_empalmes';

SELECT * FROM public.lt_horarios_ocupados(CURRENT_DATE);
```

Esperado: estado `O`. La segunda consulta devuelve solo horas confirmadas para la fecha actual, sin nombres ni correos.
4. Usa los archivos nuevos **`js/agenda.js`**, **`js/horarios-solapados.js`** y **`agendar.html`**, o extrae todo el ZIP actualizado. En la carpeta local, conserva tu `.env` anterior; el ZIP no incluye `.env`.
5. `npm install` (si hace falta), `npm run build:config`, `npm start`, y abre `http://127.0.0.1:3000/agendar.html`.
6. Abre un dia con cita confirmada desde una cuenta diferente: debe aparecer ocupado incluso con RLS. Si se cancela una cita de prueba, al recargar debe aparecer libre. Nunca hay que cancelar citas reales para probar.

## Reglas
- Solo `status='confirmada'` ocupa tiempo. Una cita `cancelada` vuelve a liberar el horario.
- Los intervalos se comparan por superposición: `inicio_existente < fin_nuevo AND fin_existente > inicio_nuevo`. `11:00-12:00` y `12:00-13:00` son compatibles; `11:00-12:00` y `11:30-12:30` no.
- Todos los pacientes comparten una agenda global: los 4 registros activos en `therapists` **no amplían** la disponibilidad.
- El bloqueo por fecha y la verificación ocurren dentro de una sola transacción de PostgreSQL. El trigger opera con RLS de consulta restrictiva.
- Los estados históricos `completada` y `cancelada` no bloquean. No se modifican sus filas.
- Si falla el RPC o no se ejecuta el SQL, el calendario falla en modo seguro (no ofrece disponibilidad ficticia).

## Otros flujos de pago
- La reserva directa usa el trigger automáticamente.
- La función `cash-booking` y el pago en establecimiento requieren además `01_mercado_pago.sql`, `02_pagos_en_establecimiento.sql` y desplegar su Edge Function. El SQL 01 ahora **no** intenta crear un índice UNIQUE incompatible con las citas antiguas.
- Mercado Pago NO debe activarse sin probar en sandbox los bloqueos de órdenes `pending`, webhook e idempotencia. No se han probado pagos reales.

## Prueba opcional de no empalme sin modificar registros

**No ejecutar INSERT de prueba directamente en producción sin autorización.** Puedes verificar lectura/instalación con las dos consultas de la sección anterior. Para probar colisiones de escritura de forma aislada se necesita una base de pruebas o transacciones que se reviertan de forma controlada.
