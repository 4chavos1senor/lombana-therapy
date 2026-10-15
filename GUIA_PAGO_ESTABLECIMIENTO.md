# Reservación con pago presencial

## Cambios
- En Agendar, elegir "Efectivo en establecimiento" y pulsar "Agendar cita y pagar en establecimiento".
- Se reserva el horario y se muestra `cita-confirmada.html` con folio, servicio, fecha y hora.
- La cita queda **confirmada** y el pago queda **pendiente en establecimiento**. No se afirma que el dinero ya fue recibido.
- Mis citas muestra el estado de pago presencial cuando está disponible.
- Los demás métodos continúan con Checkout Pro de Mercado Pago.

## Instalación indispensable (antes de probar)
1. En Supabase > SQL Editor, ejecutar `supabase/sql/01_mercado_pago.sql` si aún no existe la estructura y luego `supabase/sql/02_pagos_en_establecimiento.sql`.
2. Ejecutar antes `supabase/sql/03_agenda_un_terapeuta.sql` para proteger la agenda sin cambiar duplicados históricos.
3. Desplegar la función `cash-booking` desde `supabase/functions/cash-booking/index.ts` con autenticación JWT activada.
4. Verificar en Supabase el secreto de servidor `SUPABASE_SERVICE_ROLE_KEY` (nunca en JS público); Supabase proporciona `SUPABASE_URL`.
5. Probar con un usuario autenticado, terapia, fecha y horario válidos y comprobar la pantalla de confirmación y Mis citas.

## Consideraciones
- La columna `appointments.id` se supone UUID, igual que en `mp_orders`; verificar el esquema antes de ejecutar SQL.
- El procedimiento SQL usa un bloqueo transaccional para evitar dos reservas presenciales simultáneas en un mismo horario y comprueba reservas pendientes de Mercado Pago.
- La integración existente Mercado Pago puede tener otra condición de carrera si no maneja las reservas presenciales mientras inicia el cobro. Probar el flujo de extremo a extremo antes de usar en producción.
- El pago en efectivo se marca como pendiente. Solo el personal autorizado debe marcarlo posteriormente como pagado con un flujo administrativo seguro (no incluido).
- Los cambios requieren despliegue de Supabase; abrir el HTML con Live Server por sí solo no activa nuevas reservas.
