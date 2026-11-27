-- BORRADOR EDUCATIVO — NO EJECUTAR EN PRODUCCION.
-- Supabase Password Verification Attempt Hook: disponible en Teams y Enterprise.
-- Regla solicitada: 3 fallos -> 1 minuto; otros 3 fallos -> 2 minutos.
-- IMPORTANTE: bloquear una cuenta por fallos de cualquiera permite ataques DoS.
-- No desplegar antes de revisión antiabuso y pruebas en proyecto de desarrollo.
-- No modifica ninguna cuenta hasta que un operador lo instale y active.

create schema if not exists lt_auth_security;
revoke all on schema lt_auth_security from public, anon, authenticated;
grant usage on schema lt_auth_security to supabase_auth_admin;

create table if not exists lt_auth_security.password_lockouts (
  user_id uuid primary key,
  failed_count integer not null default 0 check (failed_count >= 0),
  block_count integer not null default 0 check (block_count >= 0),
  first_failed_at timestamptz not null default now(),
  locked_until timestamptz
);
alter table lt_auth_security.password_lockouts enable row level security;
revoke all on lt_auth_security.password_lockouts from public, anon, authenticated;
grant select, insert, update, delete on lt_auth_security.password_lockouts to supabase_auth_admin;

-- Borrador de primera instalación: no reejecutar sin auditar políticas.
create policy "Solo hook de autenticacion"
  on lt_auth_security.password_lockouts
  for all to supabase_auth_admin using (true) with check (true);

create or replace function lt_auth_security.password_verification_attempt(event jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_user uuid;
  v_valid boolean;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_count integer;
  v_block_count integer;
  v_first timestamptz;
  v_until timestamptz;
  v_lock_minutes integer;
begin
  v_user := (event->>'user_id')::uuid;
  v_valid := (event->>'valid')::boolean;
  if v_user is null or v_valid is null then
    return pg_catalog.jsonb_build_object('decision', 'continue');
  end if;

  -- No permite solicitudes paralelas que evadan el contador.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_user::text)::bigint);

  select failed_count, block_count, first_failed_at, locked_until
    into v_count, v_block_count, v_first, v_until
    from lt_auth_security.password_lockouts
   where user_id = v_user for update;

  if v_until is not null and v_until > v_now then
    return pg_catalog.jsonb_build_object(
      'decision', 'reject',
      'message', 'Acceso temporalmente suspendido. Intenta mas tarde.',
      'should_logout_user', false);
  end if;

  if v_valid then
    delete from lt_auth_security.password_lockouts where user_id = v_user;
    return pg_catalog.jsonb_build_object('decision', 'continue');
  end if;

  v_block_count := pg_catalog.coalesce(v_block_count, 0);
  if v_first is null or v_first < v_now - interval '24 hours' then
    v_block_count := 0;
    v_first := v_now;
    v_count := 1;
  elsif v_until is not null then
    v_first := v_now;
    v_count := 1;
  else
    v_count := v_count + 1;
  end if;

  if v_count >= 3 then
    v_lock_minutes := case when v_block_count = 0 then 1 else 2 end;
    v_until := v_now + pg_catalog.make_interval(mins => v_lock_minutes);
    v_block_count := v_block_count + 1;
    v_count := 0;
  else
    v_until := null;
  end if;

  insert into lt_auth_security.password_lockouts
    (user_id, failed_count, block_count, first_failed_at, locked_until)
  values (v_user, v_count, v_block_count, v_first, v_until)
  on conflict (user_id) do update
    set failed_count = excluded.failed_count,
        block_count = excluded.block_count,
        first_failed_at = excluded.first_failed_at,
        locked_until = excluded.locked_until;

  if v_until is not null then
    return pg_catalog.jsonb_build_object(
      'decision', 'reject',
      'message', 'Demasiados intentos incorrectos. Acceso suspendido.',
      'should_logout_user', false);
  end if;

  return pg_catalog.jsonb_build_object('decision', 'continue');
end;
$$;

revoke all on function lt_auth_security.password_verification_attempt(jsonb)
  from public, anon, authenticated;
grant execute on function lt_auth_security.password_verification_attempt(jsonb)
  to supabase_auth_admin;

-- Pendiente: pruebas del hook con cuentas propias de desarrollo y auditoría
-- contra denegación de servicio, revocación, concurrencia y recuperación.
-- Los avisos por correo sobre bloqueo NO están implementados.
