-- ============================================================
-- Avalia Saúde - Hardening de segurança
-- Execute após database/schema.sql
-- Objetivo: reforçar RLS, grants, views e funções auxiliares
-- Script idempotente e não destrutivo
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Funções auxiliares seguras
-- ------------------------------------------------------------

create or replace function public.current_user_role()
returns public.app_user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and status = 'active'
  limit 1;
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.has_app_role(allowed_roles public.app_user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = any(allowed_roles);
$$;

-- ------------------------------------------------------------
-- 2. Views com security invoker, quando suportado
-- ------------------------------------------------------------

do $$
begin
  begin
    execute 'alter view public.v_city_monthly_metrics set (security_invoker = true)';
  exception when others then
    raise notice 'security_invoker não suportado para v_city_monthly_metrics neste ambiente.';
  end;

  begin
    execute 'alter view public.v_unit_metrics set (security_invoker = true)';
  exception when others then
    raise notice 'security_invoker não suportado para v_unit_metrics neste ambiente.';
  end;

  begin
    execute 'alter view public.v_unit_monthly_metrics set (security_invoker = true)';
  exception when others then
    raise notice 'security_invoker não suportado para v_unit_monthly_metrics neste ambiente.';
  end;

  begin
    execute 'alter view public.v_professional_metrics set (security_invoker = true)';
  exception when others then
    raise notice 'security_invoker não suportado para v_professional_metrics neste ambiente.';
  end;
end $$;

-- ------------------------------------------------------------
-- 3. RLS obrigatório
-- ------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

alter table public.patients enable row level security;
alter table public.patients force row level security;

alter table public.health_units enable row level security;
alter table public.health_units force row level security;

alter table public.professionals enable row level security;
alter table public.professionals force row level security;

alter table public.evaluations enable row level security;
alter table public.evaluations force row level security;

alter table public.evaluation_professionals enable row level security;
alter table public.evaluation_professionals force row level security;

-- ------------------------------------------------------------
-- 4. Políticas
-- ------------------------------------------------------------

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_admin_insert" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "profiles_admin_delete" on public.profiles;

drop policy if exists "patients_read_authenticated" on public.patients;
drop policy if exists "patients_write_admin_operator" on public.patients;
drop policy if exists "patients_update_admin_operator" on public.patients;
drop policy if exists "patients_delete_admin" on public.patients;

drop policy if exists "health_units_read_authenticated" on public.health_units;
drop policy if exists "health_units_write_admin" on public.health_units;
drop policy if exists "health_units_update_admin" on public.health_units;
drop policy if exists "health_units_delete_admin" on public.health_units;

drop policy if exists "professionals_read_authenticated" on public.professionals;
drop policy if exists "professionals_write_admin" on public.professionals;
drop policy if exists "professionals_update_admin" on public.professionals;
drop policy if exists "professionals_delete_admin" on public.professionals;

drop policy if exists "evaluations_read_authenticated" on public.evaluations;
drop policy if exists "evaluations_write_admin_operator" on public.evaluations;
drop policy if exists "evaluations_update_admin_operator" on public.evaluations;
drop policy if exists "evaluations_delete_admin" on public.evaluations;

drop policy if exists "evaluation_professionals_read_authenticated" on public.evaluation_professionals;
drop policy if exists "evaluation_professionals_write_admin_operator" on public.evaluation_professionals;
drop policy if exists "evaluation_professionals_update_admin_operator" on public.evaluation_professionals;
drop policy if exists "evaluation_professionals_delete_admin" on public.evaluation_professionals;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.has_app_role(array['admin']::public.app_user_role[])
);

create policy "profiles_admin_insert"
on public.profiles
for insert
to authenticated
with check (public.has_app_role(array['admin']::public.app_user_role[]));

create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]))
with check (public.has_app_role(array['admin']::public.app_user_role[]));

create policy "profiles_admin_delete"
on public.profiles
for delete
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]));

create policy "patients_read_authenticated"
on public.patients
for select
to authenticated
using (public.is_active_user());

create policy "patients_write_admin_operator"
on public.patients
for insert
to authenticated
with check (
  public.has_app_role(array['admin','operator']::public.app_user_role[])
  and (created_by is null or created_by = auth.uid())
);

create policy "patients_update_admin_operator"
on public.patients
for update
to authenticated
using (public.has_app_role(array['admin','operator']::public.app_user_role[]))
with check (
  public.has_app_role(array['admin','operator']::public.app_user_role[])
  and (created_by is null or created_by = auth.uid())
);

create policy "patients_delete_admin"
on public.patients
for delete
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]));

create policy "health_units_read_authenticated"
on public.health_units
for select
to authenticated
using (public.is_active_user());

create policy "health_units_write_admin"
on public.health_units
for insert
to authenticated
with check (
  public.has_app_role(array['admin']::public.app_user_role[])
  and (created_by is null or created_by = auth.uid())
);

create policy "health_units_update_admin"
on public.health_units
for update
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]))
with check (
  public.has_app_role(array['admin']::public.app_user_role[])
  and (created_by is null or created_by = auth.uid())
);

create policy "health_units_delete_admin"
on public.health_units
for delete
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]));

create policy "professionals_read_authenticated"
on public.professionals
for select
to authenticated
using (public.is_active_user());

create policy "professionals_write_admin"
on public.professionals
for insert
to authenticated
with check (
  public.has_app_role(array['admin']::public.app_user_role[])
  and (created_by is null or created_by = auth.uid())
);

create policy "professionals_update_admin"
on public.professionals
for update
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]))
with check (
  public.has_app_role(array['admin']::public.app_user_role[])
  and (created_by is null or created_by = auth.uid())
);

create policy "professionals_delete_admin"
on public.professionals
for delete
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]));

create policy "evaluations_read_authenticated"
on public.evaluations
for select
to authenticated
using (public.is_active_user());

create policy "evaluations_write_admin_operator"
on public.evaluations
for insert
to authenticated
with check (
  public.has_app_role(array['admin','operator']::public.app_user_role[])
  and (created_by is null or created_by = auth.uid())
);

create policy "evaluations_update_admin_operator"
on public.evaluations
for update
to authenticated
using (public.has_app_role(array['admin','operator']::public.app_user_role[]))
with check (
  public.has_app_role(array['admin','operator']::public.app_user_role[])
  and (created_by is null or created_by = auth.uid())
);

create policy "evaluations_delete_admin"
on public.evaluations
for delete
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]));

create policy "evaluation_professionals_read_authenticated"
on public.evaluation_professionals
for select
to authenticated
using (public.is_active_user());

create policy "evaluation_professionals_write_admin_operator"
on public.evaluation_professionals
for insert
to authenticated
with check (public.has_app_role(array['admin','operator']::public.app_user_role[]));

create policy "evaluation_professionals_update_admin_operator"
on public.evaluation_professionals
for update
to authenticated
using (public.has_app_role(array['admin','operator']::public.app_user_role[]))
with check (public.has_app_role(array['admin','operator']::public.app_user_role[]));

create policy "evaluation_professionals_delete_admin"
on public.evaluation_professionals
for delete
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]));

-- ------------------------------------------------------------
-- 5. Grants mínimos
-- ------------------------------------------------------------

revoke all on schema public from anon;
revoke all on table
  public.profiles,
  public.patients,
  public.health_units,
  public.professionals,
  public.evaluations,
  public.evaluation_professionals
from anon, public;

revoke all on table
  public.v_city_monthly_metrics,
  public.v_unit_metrics,
  public.v_unit_monthly_metrics,
  public.v_professional_metrics
from anon, public;

revoke all on function public.current_user_role() from anon, public;
revoke all on function public.is_active_user() from anon, public;
revoke all on function public.has_app_role(public.app_user_role[]) from anon, public;

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.patients,
  public.health_units,
  public.professionals,
  public.evaluations,
  public.evaluation_professionals
to authenticated;

grant select on table
  public.v_city_monthly_metrics,
  public.v_unit_metrics,
  public.v_unit_monthly_metrics,
  public.v_professional_metrics
to authenticated;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.has_app_role(public.app_user_role[]) to authenticated;

commit;
