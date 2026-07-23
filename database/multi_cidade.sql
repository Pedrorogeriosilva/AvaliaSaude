-- ============================================================
-- Multi-cidade: separação de dados e acessos por município
-- Execute este arquivo no SQL Editor do Supabase.
-- Idempotente: pode rodar mais de uma vez sem quebrar.
-- ============================================================
--
-- O que este script faz:
--
-- 1. Cria a tabela `cities` (nome + UF).
-- 2. Liga unidades e pacientes a uma cidade (`city_id`).
-- 3. Dá a cada usuário uma cidade (`profiles.city_id`) e uma marca de
--    usuário master (`profiles.is_master`).
-- 4. Reescreve o RLS para que cada gestor enxergue e altere apenas a sua
--    cidade, enquanto o master enxerga e administra todas.
-- 5. Remove `patients.birth_date` (não é mais coletado).
-- 6. Migra os dados que já existem para uma primeira cidade.
--
-- Modelo de acesso:
--   - is_master = true  → dono da plataforma. Vê todas as cidades, cria
--                         cidades e usuários. city_id fica nulo.
--   - is_master = false → preso a uma cidade. O papel (admin/operator/viewer)
--                         define o que pode fazer DENTRO dessa cidade:
--       admin    → gerencia unidades, profissionais, pacientes e avaliações
--                  da própria cidade.
--       operator → registra avaliações e pacientes da própria cidade.
--       viewer   → somente leitura da própria cidade.
--   A criação de usuários é exclusiva do master.
--
-- Por que is_master é uma coluna booleana e não um valor de enum:
--   `alter type ... add value` não pode ser usado na mesma transação em que é
--   criado. Como o SQL Editor roda o arquivo inteiro em uma transação, um novo
--   valor de enum quebraria o script. A coluna booleana roda sem esse problema.
-- ============================================================

set search_path = public, extensions;

-- ------------------------------------------------------------
-- 1. Tabela de cidades
-- ------------------------------------------------------------

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state_uf char(2) not null,
  status public.record_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cities_name_min_length check (char_length(trim(name)) >= 2),
  constraint cities_state_uf_format check (state_uf ~ '^[A-Z]{2}$'),
  constraint cities_name_uf_unique unique (name, state_uf)
);

comment on table public.cities is 'Municípios atendidos pela plataforma. Cada gestor pertence a uma cidade.';

drop trigger if exists trg_cities_updated_at on public.cities;
create trigger trg_cities_updated_at
before update on public.cities
for each row execute function public.set_updated_at();

create index if not exists idx_cities_status_name on public.cities(status, name);

-- ------------------------------------------------------------
-- 2. Colunas de cidade e de master
-- ------------------------------------------------------------

alter table public.profiles
  add column if not exists city_id uuid references public.cities(id) on delete restrict,
  add column if not exists is_master boolean not null default false;

comment on column public.profiles.city_id is 'Cidade do usuário. Nulo apenas para o usuário master.';
comment on column public.profiles.is_master is 'true = dono da plataforma, enxerga e administra todas as cidades.';

alter table public.health_units
  add column if not exists city_id uuid references public.cities(id) on delete restrict;

alter table public.patients
  add column if not exists city_id uuid references public.cities(id) on delete restrict;

-- Data de nascimento deixou de ser coletada.
alter table public.patients drop column if exists birth_date;

-- ------------------------------------------------------------
-- 3. Migração dos dados existentes
-- ------------------------------------------------------------
-- Cria a primeira cidade e vincula tudo o que já existe a ela. Ajuste o nome e
-- a UF se o seu município for outro. O bloco só age quando ainda há registros
-- sem cidade, então rodar de novo não duplica nada.

do $$
declare
  default_city_id uuid;
  has_orphans boolean;
begin
  select exists (
    select 1 from public.health_units where city_id is null
    union all
    select 1 from public.patients where city_id is null
  ) into has_orphans;

  if not has_orphans then
    return;
  end if;

  insert into public.cities (name, state_uf)
  values ('Porto Alegre do Norte', 'MT')
  on conflict (name, state_uf) do nothing;

  select id into default_city_id
  from public.cities
  where name = 'Porto Alegre do Norte' and state_uf = 'MT';

  update public.health_units set city_id = default_city_id where city_id is null;
  update public.patients set city_id = default_city_id where city_id is null;

  -- Administradores atuais viram master (mantêm o alcance total que já tinham).
  -- Os demais ficam presos à primeira cidade. Reveja isto na seção 7.
  update public.profiles set is_master = true, city_id = null
  where role = 'admin' and is_master = false and city_id is null;

  update public.profiles set city_id = default_city_id
  where is_master = false and city_id is null;
end
$$;

-- Agora que todo registro tem cidade, torna a coluna obrigatória.
alter table public.health_units alter column city_id set not null;
alter table public.patients alter column city_id set not null;

create index if not exists idx_health_units_city_status on public.health_units(city_id, status);
create index if not exists idx_patients_city_status on public.patients(city_id, status);
create index if not exists idx_profiles_city on public.profiles(city_id);

-- ------------------------------------------------------------
-- 4. Funções auxiliares de escopo
-- ------------------------------------------------------------

create or replace function public.is_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_master from public.profiles where id = auth.uid() and status = 'active'),
    false
  );
$$;

create or replace function public.current_user_city()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select city_id from public.profiles where id = auth.uid() and status = 'active';
$$;

comment on function public.is_master() is 'true se o usuário logado é master (vê todas as cidades).';
comment on function public.current_user_city() is 'Cidade do usuário logado. Base do isolamento entre municípios.';

-- ------------------------------------------------------------
-- 5. Row Level Security
-- ------------------------------------------------------------

alter table public.cities enable row level security;

-- Cidades -----------------------------------------------------
drop policy if exists "cities_select_scoped" on public.cities;
drop policy if exists "cities_master_insert" on public.cities;
drop policy if exists "cities_master_update" on public.cities;
drop policy if exists "cities_master_delete" on public.cities;

create policy "cities_select_scoped"
on public.cities
for select
to authenticated
using (
  public.is_active_user()
  and (public.is_master() or id = public.current_user_city())
);

create policy "cities_master_insert"
on public.cities
for insert
to authenticated
with check (public.is_master());

create policy "cities_master_update"
on public.cities
for update
to authenticated
using (public.is_master())
with check (public.is_master());

create policy "cities_master_delete"
on public.cities
for delete
to authenticated
using (public.is_master());

-- Profiles ----------------------------------------------------
-- Master administra todos; o gestor admin enxerga os perfis da própria cidade
-- (para saber quem tem acesso), mas a criação/edição de usuários é do master.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_admin_insert" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "profiles_admin_delete" on public.profiles;
drop policy if exists "profiles_select_scoped" on public.profiles;
drop policy if exists "profiles_master_insert" on public.profiles;
drop policy if exists "profiles_master_update" on public.profiles;
drop policy if exists "profiles_master_delete" on public.profiles;

create policy "profiles_select_scoped"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_master()
  or (public.has_app_role(array['admin']::public.app_user_role[]) and city_id = public.current_user_city())
);

create policy "profiles_master_insert"
on public.profiles
for insert
to authenticated
with check (public.is_master());

create policy "profiles_master_update"
on public.profiles
for update
to authenticated
using (public.is_master())
with check (public.is_master());

create policy "profiles_master_delete"
on public.profiles
for delete
to authenticated
using (public.is_master());

-- Unidades de saúde ------------------------------------------
drop policy if exists "health_units_read_authenticated" on public.health_units;
drop policy if exists "health_units_write_admin" on public.health_units;
drop policy if exists "health_units_update_admin" on public.health_units;
drop policy if exists "health_units_delete_admin" on public.health_units;
drop policy if exists "health_units_select_scoped" on public.health_units;
drop policy if exists "health_units_insert_scoped" on public.health_units;
drop policy if exists "health_units_update_scoped" on public.health_units;
drop policy if exists "health_units_delete_scoped" on public.health_units;

create policy "health_units_select_scoped"
on public.health_units
for select
to authenticated
using (
  public.is_active_user()
  and (public.is_master() or city_id = public.current_user_city())
);

create policy "health_units_insert_scoped"
on public.health_units
for insert
to authenticated
with check (
  public.is_master()
  or (public.has_app_role(array['admin']::public.app_user_role[]) and city_id = public.current_user_city())
);

create policy "health_units_update_scoped"
on public.health_units
for update
to authenticated
using (
  public.is_master()
  or (public.has_app_role(array['admin']::public.app_user_role[]) and city_id = public.current_user_city())
)
with check (
  public.is_master()
  or (public.has_app_role(array['admin']::public.app_user_role[]) and city_id = public.current_user_city())
);

create policy "health_units_delete_scoped"
on public.health_units
for delete
to authenticated
using (
  public.is_master()
  or (public.has_app_role(array['admin']::public.app_user_role[]) and city_id = public.current_user_city())
);

-- Profissionais (cidade derivada da unidade) -----------------
drop policy if exists "professionals_read_authenticated" on public.professionals;
drop policy if exists "professionals_write_admin" on public.professionals;
drop policy if exists "professionals_update_admin" on public.professionals;
drop policy if exists "professionals_delete_admin" on public.professionals;
drop policy if exists "professionals_select_scoped" on public.professionals;
drop policy if exists "professionals_insert_scoped" on public.professionals;
drop policy if exists "professionals_update_scoped" on public.professionals;
drop policy if exists "professionals_delete_scoped" on public.professionals;

create policy "professionals_select_scoped"
on public.professionals
for select
to authenticated
using (
  public.is_active_user()
  and (
    public.is_master()
    or exists (
      select 1 from public.health_units hu
      where hu.id = professionals.health_unit_id
        and hu.city_id = public.current_user_city()
    )
  )
);

create policy "professionals_insert_scoped"
on public.professionals
for insert
to authenticated
with check (
  public.is_master()
  or (
    public.has_app_role(array['admin']::public.app_user_role[])
    and exists (
      select 1 from public.health_units hu
      where hu.id = professionals.health_unit_id
        and hu.city_id = public.current_user_city()
    )
  )
);

create policy "professionals_update_scoped"
on public.professionals
for update
to authenticated
using (
  public.is_master()
  or (
    public.has_app_role(array['admin']::public.app_user_role[])
    and exists (
      select 1 from public.health_units hu
      where hu.id = professionals.health_unit_id
        and hu.city_id = public.current_user_city()
    )
  )
)
with check (
  public.is_master()
  or (
    public.has_app_role(array['admin']::public.app_user_role[])
    and exists (
      select 1 from public.health_units hu
      where hu.id = professionals.health_unit_id
        and hu.city_id = public.current_user_city()
    )
  )
);

create policy "professionals_delete_scoped"
on public.professionals
for delete
to authenticated
using (
  public.is_master()
  or (
    public.has_app_role(array['admin']::public.app_user_role[])
    and exists (
      select 1 from public.health_units hu
      where hu.id = professionals.health_unit_id
        and hu.city_id = public.current_user_city()
    )
  )
);

-- Pacientes ---------------------------------------------------
drop policy if exists "patients_read_authenticated" on public.patients;
drop policy if exists "patients_write_admin_operator" on public.patients;
drop policy if exists "patients_update_admin_operator" on public.patients;
drop policy if exists "patients_delete_admin" on public.patients;
drop policy if exists "patients_select_scoped" on public.patients;
drop policy if exists "patients_insert_scoped" on public.patients;
drop policy if exists "patients_update_scoped" on public.patients;
drop policy if exists "patients_delete_scoped" on public.patients;

create policy "patients_select_scoped"
on public.patients
for select
to authenticated
using (
  public.is_active_user()
  and (public.is_master() or city_id = public.current_user_city())
);

create policy "patients_insert_scoped"
on public.patients
for insert
to authenticated
with check (
  public.is_master()
  or (public.has_app_role(array['admin','operator']::public.app_user_role[]) and city_id = public.current_user_city())
);

create policy "patients_update_scoped"
on public.patients
for update
to authenticated
using (
  public.is_master()
  or (public.has_app_role(array['admin','operator']::public.app_user_role[]) and city_id = public.current_user_city())
)
with check (
  public.is_master()
  or (public.has_app_role(array['admin','operator']::public.app_user_role[]) and city_id = public.current_user_city())
);

create policy "patients_delete_scoped"
on public.patients
for delete
to authenticated
using (
  public.is_master()
  or (public.has_app_role(array['admin']::public.app_user_role[]) and city_id = public.current_user_city())
);

-- Avaliações (cidade derivada da unidade) --------------------
drop policy if exists "evaluations_read_authenticated" on public.evaluations;
drop policy if exists "evaluations_write_admin_operator" on public.evaluations;
drop policy if exists "evaluations_update_admin_operator" on public.evaluations;
drop policy if exists "evaluations_delete_admin" on public.evaluations;
drop policy if exists "evaluations_select_scoped" on public.evaluations;
drop policy if exists "evaluations_insert_scoped" on public.evaluations;
drop policy if exists "evaluations_update_scoped" on public.evaluations;
drop policy if exists "evaluations_delete_scoped" on public.evaluations;

create policy "evaluations_select_scoped"
on public.evaluations
for select
to authenticated
using (
  public.is_active_user()
  and (
    public.is_master()
    or exists (
      select 1 from public.health_units hu
      where hu.id = evaluations.health_unit_id
        and hu.city_id = public.current_user_city()
    )
  )
);

create policy "evaluations_insert_scoped"
on public.evaluations
for insert
to authenticated
with check (
  public.is_master()
  or (
    public.has_app_role(array['admin','operator']::public.app_user_role[])
    and exists (
      select 1 from public.health_units hu
      where hu.id = evaluations.health_unit_id
        and hu.city_id = public.current_user_city()
    )
  )
);

create policy "evaluations_update_scoped"
on public.evaluations
for update
to authenticated
using (
  public.is_master()
  or (
    public.has_app_role(array['admin','operator']::public.app_user_role[])
    and exists (
      select 1 from public.health_units hu
      where hu.id = evaluations.health_unit_id
        and hu.city_id = public.current_user_city()
    )
  )
)
with check (
  public.is_master()
  or (
    public.has_app_role(array['admin','operator']::public.app_user_role[])
    and exists (
      select 1 from public.health_units hu
      where hu.id = evaluations.health_unit_id
        and hu.city_id = public.current_user_city()
    )
  )
);

create policy "evaluations_delete_scoped"
on public.evaluations
for delete
to authenticated
using (
  public.is_master()
  or (
    public.has_app_role(array['admin']::public.app_user_role[])
    and exists (
      select 1 from public.health_units hu
      where hu.id = evaluations.health_unit_id
        and hu.city_id = public.current_user_city()
    )
  )
);

-- Notas por profissional (cidade derivada da avaliação) ------
drop policy if exists "evaluation_professionals_read_authenticated" on public.evaluation_professionals;
drop policy if exists "evaluation_professionals_write_admin_operator" on public.evaluation_professionals;
drop policy if exists "evaluation_professionals_update_admin_operator" on public.evaluation_professionals;
drop policy if exists "evaluation_professionals_delete_admin" on public.evaluation_professionals;
drop policy if exists "evaluation_professionals_select_scoped" on public.evaluation_professionals;
drop policy if exists "evaluation_professionals_insert_scoped" on public.evaluation_professionals;
drop policy if exists "evaluation_professionals_update_scoped" on public.evaluation_professionals;
drop policy if exists "evaluation_professionals_delete_scoped" on public.evaluation_professionals;

create policy "evaluation_professionals_select_scoped"
on public.evaluation_professionals
for select
to authenticated
using (
  public.is_active_user()
  and (
    public.is_master()
    or exists (
      select 1
      from public.evaluations e
      join public.health_units hu on hu.id = e.health_unit_id
      where e.id = evaluation_professionals.evaluation_id
        and hu.city_id = public.current_user_city()
    )
  )
);

create policy "evaluation_professionals_insert_scoped"
on public.evaluation_professionals
for insert
to authenticated
with check (
  public.is_master()
  or (
    public.has_app_role(array['admin','operator']::public.app_user_role[])
    and exists (
      select 1
      from public.evaluations e
      join public.health_units hu on hu.id = e.health_unit_id
      where e.id = evaluation_professionals.evaluation_id
        and hu.city_id = public.current_user_city()
    )
  )
);

create policy "evaluation_professionals_update_scoped"
on public.evaluation_professionals
for update
to authenticated
using (
  public.is_master()
  or (
    public.has_app_role(array['admin','operator']::public.app_user_role[])
    and exists (
      select 1
      from public.evaluations e
      join public.health_units hu on hu.id = e.health_unit_id
      where e.id = evaluation_professionals.evaluation_id
        and hu.city_id = public.current_user_city()
    )
  )
)
with check (
  public.is_master()
  or (
    public.has_app_role(array['admin','operator']::public.app_user_role[])
    and exists (
      select 1
      from public.evaluations e
      join public.health_units hu on hu.id = e.health_unit_id
      where e.id = evaluation_professionals.evaluation_id
        and hu.city_id = public.current_user_city()
    )
  )
);

create policy "evaluation_professionals_delete_scoped"
on public.evaluation_professionals
for delete
to authenticated
using (
  public.is_master()
  or (
    public.has_app_role(array['admin']::public.app_user_role[])
    and exists (
      select 1
      from public.evaluations e
      join public.health_units hu on hu.id = e.health_unit_id
      where e.id = evaluation_professionals.evaluation_id
        and hu.city_id = public.current_user_city()
    )
  )
);

-- ------------------------------------------------------------
-- 5.5 Views de métricas com RLS aplicada
-- ------------------------------------------------------------
-- O painel e o ranking leem destas views. Sem `security_invoker`, uma view roda
-- com a permissão do dono e IGNORA o RLS das tabelas — ou seja, um gestor veria
-- as métricas de TODAS as cidades. Com `security_invoker = true` a view herda o
-- RLS por cidade definido acima, então o isolamento vale também no dashboard.
--
-- `is_active_profile` evita depender do RLS de `profiles` (que restringe linhas)
-- ao checar se o autor da avaliação está ativo. É recriada aqui para o script
-- ser autossuficiente; se você já rodou `views_rls_e_performance.sql`, a
-- definição é idêntica e não há efeito colateral.

create or replace function public.is_active_profile(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_id is null
      or exists (
        select 1 from public.profiles
        where id = target_id and status = 'active'
      );
$$;

grant execute on function public.is_active_profile(uuid) to authenticated;

drop view if exists public.v_city_monthly_metrics;
drop view if exists public.v_unit_metrics;
drop view if exists public.v_unit_monthly_metrics;
drop view if exists public.v_professional_metrics;

-- Agrupada por cidade + mês para o painel do master poder filtrar por cidade.
-- Na visão "todas as cidades", o aplicativo reagrupa por mês ponderando pela
-- quantidade de avaliações (média de médias seria incorreta).
create view public.v_city_monthly_metrics
with (security_invoker = true) as
select
  hu.city_id,
  date_trunc('month', e.attendance_date)::date as month,
  count(*)::integer as total_evaluations,
  round(avg(e.general_score), 2) as avg_general_score,
  round(avg(e.satisfaction_score), 2) as avg_satisfaction_score,
  round(avg(e.service_quality_score), 2) as avg_service_quality_score,
  round(avg(e.wait_time_minutes), 2) as avg_wait_time_minutes,
  round(100.0 * count(*) filter (where e.resolution = 'resolved') / nullif(count(*), 0), 2) as resolution_rate
from public.evaluations e
join public.patients p on p.id = e.patient_id and p.status = 'active'
join public.health_units hu on hu.id = e.health_unit_id and hu.status = 'active'
where public.is_active_profile(e.created_by)
group by hu.city_id, date_trunc('month', e.attendance_date);

create view public.v_unit_metrics
with (security_invoker = true) as
select
  hu.id as health_unit_id,
  hu.name as health_unit_name,
  hu.type as health_unit_type,
  hu.status as health_unit_status,
  hu.city_id,
  count(e.id)::integer as total_evaluations,
  round(avg(e.general_score), 2) as avg_general_score,
  round(avg(e.satisfaction_score), 2) as avg_satisfaction_score,
  round(avg(e.structure_score), 2) as avg_structure_score,
  round(avg(e.clarity_score), 2) as avg_clarity_score,
  round(avg(e.service_quality_score), 2) as avg_service_quality_score,
  round(avg(e.wait_time_minutes), 2) as avg_wait_time_minutes,
  round(100.0 * count(e.id) filter (where e.resolution = 'resolved') / nullif(count(e.id), 0), 2) as resolution_rate,
  max(e.attendance_date) as last_evaluation_date
from public.health_units hu
left join public.evaluations e
  on e.health_unit_id = hu.id
 and public.is_active_profile(e.created_by)
 and exists (select 1 from public.patients p where p.id = e.patient_id and p.status = 'active')
where hu.status = 'active'
group by hu.id, hu.name, hu.type, hu.status, hu.city_id;

create view public.v_unit_monthly_metrics
with (security_invoker = true) as
select
  hu.id as health_unit_id,
  hu.name as health_unit_name,
  date_trunc('month', e.attendance_date)::date as month,
  count(e.id)::integer as total_evaluations,
  round(avg(e.general_score), 2) as avg_general_score,
  round(avg(e.satisfaction_score), 2) as avg_satisfaction_score,
  round(avg(e.service_quality_score), 2) as avg_service_quality_score,
  round(avg(e.wait_time_minutes), 2) as avg_wait_time_minutes,
  round(100.0 * count(e.id) filter (where e.resolution = 'resolved') / nullif(count(e.id), 0), 2) as resolution_rate
from public.evaluations e
join public.health_units hu on hu.id = e.health_unit_id and hu.status = 'active'
join public.patients p on p.id = e.patient_id and p.status = 'active'
where public.is_active_profile(e.created_by)
group by hu.id, hu.name, date_trunc('month', e.attendance_date);

create view public.v_professional_metrics
with (security_invoker = true) as
select
  p.id as professional_id,
  p.full_name as professional_name,
  p.position,
  p.health_unit_id,
  hu.name as health_unit_name,
  hu.city_id,
  p.status as professional_status,
  hu.status as health_unit_status,
  count(e.id)::integer as total_evaluations,
  round(avg(ep.score), 2) as avg_professional_score,
  max(e.attendance_date) as last_evaluation_date
from public.professionals p
join public.health_units hu on hu.id = p.health_unit_id
left join public.evaluation_professionals ep on ep.professional_id = p.id
left join public.evaluations e
  on e.id = ep.evaluation_id
 and public.is_active_profile(e.created_by)
 and exists (select 1 from public.patients pa where pa.id = e.patient_id and pa.status = 'active')
 and exists (select 1 from public.health_units ehu where ehu.id = e.health_unit_id and ehu.status = 'active')
group by p.id, p.full_name, p.position, p.health_unit_id, hu.name, hu.city_id, p.status, hu.status;

-- ------------------------------------------------------------
-- 6. Grants e permissões de API
-- ------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public to authenticated;
    grant select, insert, update, delete on table public.cities to authenticated;
    grant execute on function public.is_master() to authenticated;
    grant execute on function public.current_user_city() to authenticated;
    grant select on public.v_city_monthly_metrics to authenticated;
    grant select on public.v_unit_metrics to authenticated;
    grant select on public.v_unit_monthly_metrics to authenticated;
    grant select on public.v_professional_metrics to authenticated;
  end if;
end
$$;

-- ============================================================
-- 7. AJUSTE MANUAL DE ACESSOS (leia)
-- ============================================================
-- A migração marcou os administradores atuais como MASTER (veem tudo). Se algum
-- deles deveria ser gestor de uma cidade específica, rode algo assim:
--
--   update public.profiles
--   set is_master = false,
--       city_id = (select id from public.cities where name = 'Nome' and state_uf = 'MT')
--   where email = 'gestor@dominio.com';
--
-- Para promover alguém a master:
--
--   update public.profiles set is_master = true, city_id = null
--   where email = 'dono@dominio.com';
-- ============================================================
