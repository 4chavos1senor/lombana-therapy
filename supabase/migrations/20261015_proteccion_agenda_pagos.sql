-- Lombana Therapy: compatibilidad entre agenda directa, efectivo y MP.
-- No reescribe datos. Se puede revertir recuperando las versiones anteriores.
BEGIN;

CREATE OR REPLACE FUNCTION public.lt_bloquear_empalmes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_hoy date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  -- Las cancelaciones y los demas estados no ocupan un horario CONFIRMADO.
  IF NEW.status IS DISTINCT FROM 'confirmada' THEN
    RETURN NEW;
  END IF;

  -- Evitar revalidar innecesariamente una cita existente si el intervalo
  -- y el estado no cambiaron (conservar duplicados historicos intactos).
  IF TG_OP = 'UPDATE' THEN
    IF NEW.fecha IS NOT DISTINCT FROM OLD.fecha
       AND NEW.hora_inicio IS NOT DISTINCT FROM OLD.hora_inicio
       AND NEW.hora_fin IS NOT DISTINCT FROM OLD.hora_fin
       AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.fecha IS NULL OR NEW.hora_inicio IS NULL OR NEW.hora_fin IS NULL
     OR NEW.hora_inicio >= NEW.hora_fin THEN
    RAISE EXCEPTION 'Fecha u horario de cita no valido'
      USING ERRCODE = '22023';
  END IF;

  -- Empezar ahora, sin intentar corregir ni bloquear registros del pasado.
  IF NEW.fecha < v_hoy THEN
    RETURN NEW;
  END IF;

  -- Un solo terapeuta: se serializan TODAS las reservas del mismo dia,
  -- incluso si empiezan en horas diferentes. Se evita la carrera entre
  -- dos usuarios al confirmar simultaneamente desde distintos dispositivos.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    416001,
    NEW.fecha - DATE '2000-01-01'
  );

  IF EXISTS (
    SELECT 1
    FROM public.appointments AS a
    WHERE a.fecha = NEW.fecha
      AND a.status = 'confirmada'
      AND a.id IS DISTINCT FROM NEW.id
      AND a.hora_inicio < NEW.hora_fin
      AND a.hora_fin > NEW.hora_inicio
  ) THEN
    RAISE EXCEPTION 'Horario ocupado: ya existe otra cita confirmada que se superpone'
      USING ERRCODE = '23P01';
  END IF;

  -- Protege tambien ordenes pendientes de Mercado Pago del mismo dia.
  -- Solo aplica a las nuevas confirmaciones; no altera citas existentes.
  IF EXISTS (
    SELECT 1 FROM public.mp_orders AS m
    WHERE m.fecha = NEW.fecha
      AND m.status = 'pending'
      AND m.expires_at > now()
      AND m.hora_inicio < NEW.hora_fin
      AND m.hora_fin > NEW.hora_inicio
  ) THEN
    RAISE EXCEPTION 'Horario temporalmente reservado para pago'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.lt_confirmar_pago_mp(p_order_id uuid, p_payment_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_fecha date;
    v_orden public.mp_orders%ROWTYPE;
    v_cita_id uuid;
BEGIN
    -- Solo el servidor puede confirmar pagos.
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Acceso denegado'
            USING ERRCODE = '42501';
    END IF;

    IF p_order_id IS NULL
       OR p_payment_id IS NULL
       OR p_payment_id !~ '^[0-9]{1,30}$'
    THEN
        RAISE EXCEPTION 'Datos de pago invalidos'
            USING ERRCODE = '22023';
    END IF;

    -- Primero obtener la fecha sin bloquear la orden.
    SELECT fecha
    INTO v_fecha
    FROM public.mp_orders
    WHERE id = p_order_id;

    IF NOT FOUND OR v_fecha IS NULL THEN
        RAISE EXCEPTION 'Orden no encontrada'
            USING ERRCODE = '22023';
    END IF;

    -- Primero bloquear la fecha.
    -- Mismo orden de bloqueo que la agenda y pagos en efectivo.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        416001,
        v_fecha - DATE '2000-01-01'
    );

    -- Después bloquear la orden.
    SELECT *
    INTO v_orden
    FROM public.mp_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden no encontrada';
    END IF;

    IF v_orden.fecha IS DISTINCT FROM v_fecha THEN
        RAISE EXCEPTION 'La fecha de la orden cambio';
    END IF;

    -- Evitar duplicados si Mercado Pago envía
    -- varias veces la misma notificación.
    IF v_orden.status = 'approved' THEN
        IF v_orden.mp_payment_id = p_payment_id
           AND v_orden.appointment_id IS NOT NULL
        THEN
            RETURN pg_catalog.jsonb_build_object(
                'estado', 'approved',
                'appointment_id', v_orden.appointment_id
            );
        END IF;

        RAISE EXCEPTION
            'Orden aprobada con datos inconsistentes';
    END IF;

    -- Una orden que dejó de estar pendiente
    -- necesita revisión manual si recibe un pago aprobado.
    IF v_orden.status IS DISTINCT FROM 'pending'
       OR v_orden.expires_at <= now()
       OR v_orden.hora_inicio IS NULL
       OR v_orden.hora_fin IS NULL
       OR v_orden.hora_inicio >= v_orden.hora_fin
       OR (v_orden.fecha + v_orden.hora_inicio)
          <= (now() AT TIME ZONE 'America/Mexico_City')
       OR (
           v_orden.mp_payment_id IS NOT NULL
           AND v_orden.mp_payment_id <> p_payment_id
       )
    THEN
        UPDATE public.mp_orders
        SET status = 'review',
            mp_payment_id = COALESCE(
                mp_payment_id, p_payment_id
            )
        WHERE id = p_order_id;

        RETURN pg_catalog.jsonb_build_object(
            'estado', 'review'
        );
    END IF;

    -- Un solo terapeuta:
    -- no permitir horarios superpuestos.
    IF EXISTS (
        SELECT 1
        FROM public.appointments AS a
        WHERE a.fecha = v_orden.fecha
          AND a.status = 'confirmada'
          AND a.hora_inicio < v_orden.hora_fin
          AND a.hora_fin > v_orden.hora_inicio
    ) THEN
        UPDATE public.mp_orders
        SET status = 'review',
            mp_payment_id = p_payment_id
        WHERE id = p_order_id;

        RETURN pg_catalog.jsonb_build_object(
            'estado', 'review'
        );
    END IF;

    -- Ambas operaciones se realizan dentro
    -- de una misma transacción.
    BEGIN
        -- Convertir la propia orden a aprobada primero, en la MISMA
        -- subtransaccion; asi el trigger permite su cita y sigue
        -- bloqueando otras ordenes pendientes.
        UPDATE public.mp_orders
        SET status = 'approved', mp_payment_id = p_payment_id
        WHERE id = p_order_id;

        INSERT INTO public.appointments (
            user_id,
            therapy_id,
            slot_id,
            fecha,
            hora_inicio,
            hora_fin,
            status
        )
        VALUES (
            v_orden.user_id,
            v_orden.therapy_id::uuid,
            NULL,
            v_orden.fecha,
            v_orden.hora_inicio,
            v_orden.hora_fin,
            'confirmada'
        )
        RETURNING id INTO v_cita_id;

        UPDATE public.mp_orders
        SET appointment_id = v_cita_id
        WHERE id = p_order_id;

        RETURN pg_catalog.jsonb_build_object(
            'estado', 'approved',
            'appointment_id', v_cita_id
        );

    EXCEPTION
        WHEN exclusion_violation
          OR unique_violation
          OR foreign_key_violation
          OR check_violation
          OR not_null_violation
          OR invalid_text_representation
        THEN
            -- No dejar una cita parcialmente registrada.
            UPDATE public.mp_orders
            SET status = 'review',
                mp_payment_id = COALESCE(
                    mp_payment_id, p_payment_id
                )
            WHERE id = p_order_id;

            RETURN pg_catalog.jsonb_build_object(
                'estado', 'review'
            );
    END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.lt_horarios_ocupados(p_fecha date)
RETURNS TABLE (hora_inicio time, hora_fin time)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $func$
  SELECT x.hora_inicio, x.hora_fin
  FROM (
    SELECT a.hora_inicio, a.hora_fin
    FROM public.appointments AS a
    WHERE a.fecha = p_fecha
      AND a.status = 'confirmada'

    UNION ALL

    SELECT m.hora_inicio, m.hora_fin
    FROM public.mp_orders AS m
    WHERE m.fecha = p_fecha
      AND m.status = 'pending'
      AND m.expires_at > now()
  ) AS x
  WHERE p_fecha >= (now() AT TIME ZONE 'America/Mexico_City')::date
  ORDER BY x.hora_inicio, x.hora_fin;
$func$;

-- Restringir la ejecución directa de helpers de triggers con privilegios.
-- Su uso mediante TRIGGER sigue habilitado.
REVOKE EXECUTE ON FUNCTION public.lt_bloquear_empalmes()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lt_controlar_rol_perfil()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crear_perfil_usuario_nuevo()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crear_horarios_default_al_crear_terapeuta()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.aplicar_horarios_default_terapeuta(uuid)
  FROM PUBLIC, anon, authenticated;

-- Los helpers de administración se utilizan solo con sesión.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.es_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin() TO authenticated;

-- Privilegios SQL innecesarios para clientes HTTP.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE
  public.appointments, public.profiles, public.therapies
FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
