-- LOMBANA THERAPY: AGENDA UNICA PARA UN TERAPEUTA
-- No modifica, elimina ni reescribe ninguna cita existente.
-- Ejecutar UNA vez en Supabase > SQL Editor con el proyecto correcto.
-- Opera en INSERT y cambios futuros de estado/fecha/horas.
-- Los horarios de citas canceladas vuelven a estar disponibles.
-- Los conflictos historicos se conservan tal como estan.

BEGIN;

CREATE OR REPLACE FUNCTION public.lt_bloquear_empalmes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
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

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_lt_evitar_empalmes ON public.appointments;
CREATE TRIGGER trg_lt_evitar_empalmes
  BEFORE INSERT OR UPDATE OF fecha, hora_inicio, hora_fin, status
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.lt_bloquear_empalmes();

-- Solo devuelve intervalos ocupados, sin correos, pacientes ni identificadores.
-- SECURITY DEFINER permite comprobar TODOS los horarios, aunque RLS limite
-- que un usuario vea las citas de otros pacientes.
CREATE OR REPLACE FUNCTION public.lt_horarios_ocupados(p_fecha date)
RETURNS TABLE (hora_inicio time, hora_fin time)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $func$
  SELECT a.hora_inicio, a.hora_fin
  FROM public.appointments AS a
  WHERE a.fecha = p_fecha
    AND a.status = 'confirmada'
    AND p_fecha >= (now() AT TIME ZONE 'America/Mexico_City')::date
  ORDER BY a.hora_inicio, a.hora_fin;
$func$;

REVOKE ALL ON FUNCTION public.lt_horarios_ocupados(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lt_horarios_ocupados(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.lt_horarios_ocupados(date) TO authenticated;

-- Refrescar el esquema expuesto por PostgREST para la nueva RPC.
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Verificacion de solo lectura, inmediatamente despues del despliegue:
-- SELECT tgname, tgenabled FROM pg_trigger
-- WHERE tgrelid='public.appointments'::regclass
--   AND tgname='trg_lt_evitar_empalmes';
-- SELECT * FROM public.lt_horarios_ocupados(CURRENT_DATE);
