-- Ejecutar tras 01_mercado_pago.sql. Esta función reserva de manera atómica.
-- Antes de ejecutar, verificar que appointments y therapies tengan las columnas esperadas.
create table if not exists public.cash_bookings (
 appointment_id uuid primary key references public.appointments(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 payment_status text not null default 'pending_in_person'
   check (payment_status in ('pending_in_person','paid_in_person')),
 created_at timestamptz not null default now(),
 paid_at timestamptz
);
alter table public.cash_bookings enable row level security;
revoke all on public.cash_bookings from anon, authenticated;
grant select on public.cash_bookings to authenticated;
drop policy if exists "Ver mis pagos presenciales" on public.cash_bookings;
create policy "Ver mis pagos presenciales" on public.cash_bookings
 for select to authenticated using (user_id = auth.uid());

create or replace function public.create_cash_booking(
 p_user_id uuid, p_therapy_id text, p_fecha date, p_hora_inicio time
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_id uuid;
 v_hour integer;
 v_dow integer;
 v_end time;
 v_active boolean;
begin
 -- Únicamente la función de servidor con service_role puede ejecutar esta operación.
 if auth.role() <> 'service_role' then raise exception 'Acceso denegado'; end if;
 if p_user_id is null or p_therapy_id is null then raise exception 'Datos incompletos'; end if;
 select activo into v_active from public.therapies where id::text=p_therapy_id;
 if not coalesce(v_active,false) then raise exception 'Terapia no disponible'; end if;
 v_dow:=extract(dow from p_fecha);
 v_hour:=extract(hour from p_hora_inicio);
 if v_dow=0 or v_hour<9 or v_hour >= case when v_dow=6 then 15 else 18 end
    or extract(minute from p_hora_inicio)<>0 or extract(second from p_hora_inicio)<>0
    or (p_fecha::timestamp+p_hora_inicio) <= (now() at time zone 'America/Mexico_City')
 then raise exception 'Horario inválido'; end if;
 v_end:=(p_hora_inicio+interval '1 hour')::time;
 -- El trigger 03 asegura la exclusion al insertar appointments.
 -- Reservar por fecha tambien evita carreras con otros medios de cobro.
 perform pg_advisory_xact_lock(416001, p_fecha - date '2000-01-01');
 if exists(select 1 from public.appointments
   where fecha=p_fecha and status='confirmada'
     and hora_inicio < v_end and hora_fin > p_hora_inicio)
 or exists(select 1 from public.mp_orders
   where fecha=p_fecha and status='pending' and expires_at>now()
     and hora_inicio < v_end and hora_fin > p_hora_inicio)
 then raise exception 'Horario ocupado'; end if;
 insert into public.appointments (user_id,therapy_id,slot_id,fecha,hora_inicio,hora_fin,status)
 select a.user_id,a.therapy_id,a.slot_id,a.fecha,a.hora_inicio,a.hora_fin,a.status
 from jsonb_populate_record(null::public.appointments, jsonb_build_object(
  'user_id',p_user_id,'therapy_id',p_therapy_id,'slot_id',null,'fecha',p_fecha,
  'hora_inicio',p_hora_inicio,'hora_fin',v_end,'status','confirmada')) as a
 returning id into v_id;
 insert into public.cash_bookings(appointment_id,user_id) values (v_id,p_user_id);
 return jsonb_build_object('appointment_id',v_id);
end $$;
revoke execute on function public.create_cash_booking(uuid,text,date,time) from public,anon,authenticated;
grant execute on function public.create_cash_booking(uuid,text,date,time) to service_role;
