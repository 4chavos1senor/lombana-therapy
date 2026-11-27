-- BORRADOR U4 — NO EJECUTAR EN PRODUCCION SIN REVISION.
-- Requiere Supabase Teams/Enterprise: Auth > Hooks > Password Verification Attempt.
-- 5 intentos fallidos -> bloqueo temporal de 15 minutos.
-- El hook recibe user_id y valid desde Supabase, NUNCA contraseñas.
-- Revisar y ensayar primero en un proyecto de pruebas autorizado.
create schema if not exists lt_auth_security;
revoke all on schema lt_auth_security from public, anon, authenticated;
grant usage on schema lt_auth_security to supabase_auth_admin;

create table if not exists lt_auth_security.password_lockouts (
  user_id uuid primary key,
  failed_count integer not null default 0 check (failed_count >= 0),
  first_failed_at timestamptz not null default now(),
  locked_until timestamptz
);
alter table lt_auth_security.password_lockouts enable row level security;
revoke all on lt_auth_security.password_lockouts from public, anon, authenticated;
grant select, insert, update, delete on lt_auth_security.password_lockouts to supabase_auth_admin;

create policy "Solo hook de autenticacion" on lt_auth_security.password_lockouts
  for all to supabase_auth_admin using (true) with check (true);

create or replace function lt_auth_security.password_verification_attempt(event jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_user uuid;
  v_valid boolean;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_count integer;
  v_first timestamptz;
  v_until timestamptz;
begin
  v_user := (event->>'user_id')::uuid;
  v_valid := (event->>'valid')::boolean;
  if v_user is null or v_valid is null then
    return pg_catalog.jsonb_build_object('decision', 'continue');
  end if;

  -- Serializar intentos del mismo usuario contra solicitudes paralelas.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_user::text)::bigint);

  select failed_count, first_failed_at, locked_until
    into v_count, v_first, v_until
    from lt_auth_security.password_lockouts
   where user_id = v_user for update;

  if v_until is not null and v_until > v_now then
    return pg_catalog.jsonb_build_object(
      'decision', 'reject',
      'message', 'No fue posible iniciar sesion. Intenta mas tarde.',
      'should_logout_user', false);
  end if;

  if v_valid then
    delete from lt_auth_security.password_lockouts where user_id = v_user;
    return pg_catalog.jsonb_build_object('decision', 'continue');
  end if;

  if v_first is null or v_first < v_now - interval '15 minutes'
     or v_until is not null then
    v_first := v_now;
    v_count := 1;
  else
    v_count := v_count + 1;
  end if;

  if v_count >= 5 then
    v_until := v_now + interval '15 minutes';
  else
    v_until := null;
  end if;

  insert into lt_auth_security.password_lockouts
    (user_id, failed_count, first_failed_at, locked_until)
  values (v_user, v_count, v_first, v_until)
  on conflict (user_id) do update
    set failed_count = excluded.failed_count,
        first_failed_at = excluded.first_failed_at,
        locked_until = excluded.locked_until;

  if v_until is not null then
    return pg_catalog.jsonb_build_object(
      'decision', 'reject',
      'message', 'No fue posible iniciar sesion. Intenta mas tarde.',
      'should_logout_user', false);
  end if;

  return pg_catalog.jsonb_build_object('decision', 'continue');
end;
$$;

revoke all on function lt_auth_security.password_verification_attempt(jsonb)
  from public, anon, authenticated;
grant execute on function lt_auth_security.password_verification_attempt(jsonb)
  to supabase_auth_admin;

-- Al preparar la instalación real:
-- 1) revisar si el esquema/función/política existen (reaplicar POLICY requiere DROP controlado).
-- 2) configurar el hook SQL en Authentication > Hooks en Teams/Enterprise.
-- 3) probar 4 fallos, 5o fallo, contraseña correcta durante bloqueo,
--    expiración tras 15 minutos, concurrencia y recuperación autorizada.
-- 4) observar protección anti-DoS: un atacante puede bloquear cuentas conocidas.
