-- LOMBANA THERAPY: RESERVAS CON PAGO EN ESTABLECIMIENTO
-- Esta migracion NO inserta, actualiza ni elimina citas existentes.
-- No requiere ejecutar 01_mercado_pago.sql.
-- Requiere supabase/sql/03_agenda_un_terapeuta.sql ya instalado.
-- Se despliega separadamente supabase/functions/cash-booking/index.ts.

BEGIN;

CREATE TABLE IF NOT EXISTS public.cash_bookings (
  appointment_id uuid PRIMARY KEY
    REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  payment_status text NOT NULL DEFAULT 'pending_in_person'
    CHECK (payment_status IN ('pending_in_person', 'paid_in_person')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE public.cash_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cash_bookings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.cash_bookings TO authenticated;

DROP POLICY IF EXISTS "Ver mis pagos presenciales" ON public.cash_bookings;
CREATE POLICY "Ver mis pagos presenciales"
  ON public.cash_bookings
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.create_cash_booking(
  p_user_id uuid,
  p_therapy_id text,
  p_fecha date,
  p_hora_inicio time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_therapy_id uuid;
  v_cita_id uuid;
  v_fin time;
  v_dia integer;
  v_hora integer;
  v_mp_ocupado boolean := false;
BEGIN
  -- Se invoca unicamente mediante el servidor con service_role.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_therapy_id IS NULL
     OR p_fecha IS NULL OR p_hora_inicio IS NULL THEN
    RAISE EXCEPTION 'Datos incompletos' USING ERRCODE = '22023';
  END IF;

  IF p_therapy_id !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RAISE EXCEPTION 'Identificador de terapia invalido'
      USING ERRCODE = '22023';
  END IF;
  v_therapy_id := p_therapy_id::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.therapies
    WHERE id = v_therapy_id AND activo IS TRUE
  ) THEN
    RAISE EXCEPTION 'Terapia no disponible' USING ERRCODE = '22023';
  END IF;

  v_dia := EXTRACT(DOW FROM p_fecha);
  v_hora := EXTRACT(HOUR FROM p_hora_inicio);

  IF v_dia = 0
     OR v_hora < 9
     OR v_hora >= (CASE WHEN v_dia = 6 THEN 15 ELSE 18 END)
     OR EXTRACT(MINUTE FROM p_hora_inicio) <> 0
     OR EXTRACT(SECOND FROM p_hora_inicio) <> 0
     OR (p_fecha + p_hora_inicio)
         <= (now() AT TIME ZONE 'America/Mexico_City')
  THEN
    RAISE EXCEPTION 'Horario invalido' USING ERRCODE = '22023';
  END IF;

  v_fin := (p_hora_inicio + INTERVAL '1 hour')::time;

  -- Misma llave transaccional que el trigger de agenda global.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    416001,
    p_fecha - DATE '2000-01-01'
  );

  -- Los horarios cancelados NO bloquean nuevas reservas.
  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.fecha = p_fecha
      AND a.status = 'confirmada'
      AND a.hora_inicio < v_fin
      AND a.hora_fin > p_hora_inicio
  ) THEN
    RAISE EXCEPTION 'Horario ocupado' USING ERRCODE = '23P01';
  END IF;

  -- Si existe la tabla de Mercado Pago, respetar reservas pendientes.
  -- SQL dinamico para que esta migracion funcione sin instalar Mercado Pago.
  IF pg_catalog.to_regclass('public.mp_orders') IS NOT NULL THEN
    EXECUTE '
      SELECT EXISTS (
        SELECT 1 FROM public.mp_orders
        WHERE fecha = $1
          AND status = ''pending''
          AND expires_at > now()
          AND hora_inicio < $3
          AND hora_fin > $2
      )'
      INTO v_mp_ocupado
      USING p_fecha, p_hora_inicio, v_fin;

    IF v_mp_ocupado THEN
      RAISE EXCEPTION 'Horario reservado temporalmente para pago'
        USING ERRCODE = '23P01';
    END IF;
  END IF;

  -- Cita + pago pendiente quedan en una unica transaccion.
  INSERT INTO public.appointments (
    user_id, therapy_id, slot_id, fecha, hora_inicio, hora_fin, status
  ) VALUES (
    p_user_id, v_therapy_id, NULL, p_fecha,
    p_hora_inicio, v_fin, 'confirmada'
  )
  RETURNING id INTO v_cita_id;

  INSERT INTO public.cash_bookings (appointment_id, user_id)
  VALUES (v_cita_id, p_user_id);

  RETURN pg_catalog.jsonb_build_object(
    'appointment_id', v_cita_id,
    'payment_status', 'pending_in_person'
  );
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.create_cash_booking(uuid,text,date,time)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_cash_booking(uuid,text,date,time)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
