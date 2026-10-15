-- Ejecutar desde Supabase SQL Editor. Revisa los nombres de columnas de tus tablas.
create table if not exists public.mp_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 therapy_id text not null,
 fecha date not null,
 hora_inicio time not null,
 hora_fin time not null,
 amount numeric(12,2) not null check(amount>0),
 status text not null default 'pending' check (status in ('pending','approved','failed','expired','rejected','refunded','review')),
 mp_preference_id text,
 mp_payment_id text unique,
 appointment_id uuid,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '30 minutes')
);
create unique index if not exists mp_orders_one_live_slot
 on public.mp_orders(fecha,hora_inicio) where status = 'pending';
create index if not exists mp_orders_by_user on public.mp_orders(user_id,created_at desc);
alter table public.mp_orders enable row level security;
revoke all on public.mp_orders from anon,authenticated;
grant select on public.mp_orders to authenticated;
drop policy if exists "Usuario lee sus pagos" on public.mp_orders;
create policy "Usuario lee sus pagos" on public.mp_orders for select to authenticated using (user_id=auth.uid());
-- La agenda global y los empalmes se controlan mediante el trigger
-- supabase/sql/03_agenda_un_terapeuta.sql.
-- NO usar indices UNIQUE sobre (fecha,hora_inicio): hay citas historicas
-- duplicadas que se deben preservar y ese indice no detecta superposiciones.
