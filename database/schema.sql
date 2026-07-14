-- ============================================================
-- Avalia Saúde - Porto Alegre do Norte
-- Schema inicial para Supabase/PostgreSQL
-- Versão: 1.0
-- Data: 2026-07-07
-- ============================================================

-- Recomendado executar este arquivo no SQL Editor do Supabase.
-- Este schema usa Supabase Auth para login/senha e a tabela public.profiles
-- para controlar perfil, status e permissões dentro do sistema.

-- ============================================================
-- 1. EXTENSÕES
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 2. TIPOS ENUMERADOS
-- ============================================================

do $$ begin
  create type public.app_user_role as enum ('admin', 'operator', 'viewer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.record_status as enum ('active', 'inactive');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.health_unit_type as enum ('psf', 'hospital', 'other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.contact_type as enum ('phone', 'whatsapp', 'in_person');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.resolution_status as enum ('resolved', 'partial', 'unresolved');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.manifestation_type as enum ('praise', 'complaint', 'suggestion', 'neutral');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 3. FUNÇÃO PADRÃO PARA updated_at
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 4. TABELA DE PERFIS/USUÁRIOS DO SISTEMA
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.app_user_role not null default 'viewer',
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_full_name_min_length check (char_length(trim(full_name)) >= 3)
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

comment on table public.profiles is 'Usuários administrativos do sistema. A senha fica no Supabase Auth, não nesta tabela.';
comment on column public.profiles.role is 'admin: acesso total; operator: cadastros operacionais e avaliações; viewer: somente leitura.';

-- Cria automaticamente um perfil básico quando um usuário é criado no Supabase Auth.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Novo usuário'),
    new.email,
    'viewer',
    'active'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- ============================================================
-- 5. TABELAS PRINCIPAIS
-- ============================================================

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  cpf text,
  birth_date date,
  phone text,
  whatsapp text,
  address text,
  neighborhood text,
  status public.record_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint patients_full_name_min_length check (char_length(trim(full_name)) >= 3),
  constraint patients_cpf_format check (cpf is null or cpf ~ '^\d{11}$')
);

create trigger trg_patients_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

comment on table public.patients is 'Pacientes que tiveram atendimento avaliado ou foram cadastrados previamente.';
comment on column public.patients.cpf is 'CPF opcional, armazenado somente com números, quando informado.';

create table if not exists public.health_units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.health_unit_type not null default 'psf',
  address text not null,
  neighborhood text,
  phone text,
  manager_name text,
  status public.record_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint health_units_name_min_length check (char_length(trim(name)) >= 3),
  constraint health_units_address_min_length check (char_length(trim(address)) >= 5)
);

create trigger trg_health_units_updated_at
before update on public.health_units
for each row execute function public.set_updated_at();

comment on table public.health_units is 'Unidades de saúde, PSFs, hospital ou outros pontos de atendimento.';

create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  position text not null,
  professional_license text,
  health_unit_id uuid not null references public.health_units(id) on delete restrict,
  work_schedule text,
  status public.record_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint professionals_full_name_min_length check (char_length(trim(full_name)) >= 3),
  constraint professionals_position_min_length check (char_length(trim(position)) >= 2)
);

create trigger trg_professionals_updated_at
before update on public.professionals
for each row execute function public.set_updated_at();

comment on table public.professionals is 'Profissionais vinculados às unidades de saúde.';
comment on column public.professionals.position is 'Cargo/função do profissional. Ex.: médico, enfermeiro, recepcionista, técnico de enfermagem.';
comment on column public.professionals.work_schedule is 'Horário de trabalho livre. Ex.: Segunda a sexta, 07h às 13h.';

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  health_unit_id uuid not null references public.health_units(id) on delete restrict,
  attendance_date date not null,
  contact_type public.contact_type not null,
  wait_time_minutes integer,
  resolution public.resolution_status not null,
  general_score numeric(4,2) not null,
  satisfaction_score numeric(4,2) not null,
  structure_score numeric(4,2) not null,
  clarity_score numeric(4,2) not null,
  service_quality_score numeric(4,2) not null,
  manifestation public.manifestation_type not null default 'neutral',
  general_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint evaluations_wait_time_positive check (wait_time_minutes is null or wait_time_minutes >= 0),
  constraint evaluations_general_score_range check (general_score between 0 and 10),
  constraint evaluations_satisfaction_score_range check (satisfaction_score between 0 and 10),
  constraint evaluations_structure_score_range check (structure_score between 0 and 10),
  constraint evaluations_clarity_score_range check (clarity_score between 0 and 10),
  constraint evaluations_service_quality_score_range check (service_quality_score between 0 and 10),
  constraint evaluations_attendance_date_not_future check (attendance_date <= current_date)
);

create trigger trg_evaluations_updated_at
before update on public.evaluations
for each row execute function public.set_updated_at();

comment on table public.evaluations is 'Avaliação geral de um atendimento realizado em uma unidade de saúde.';
comment on column public.evaluations.resolution is 'resolved: resolvido; partial: parcialmente resolvido; unresolved: não resolvido.';

create table if not exists public.evaluation_professionals (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  score numeric(4,2) not null,
  notes text,
  created_at timestamptz not null default now(),

  constraint evaluation_professionals_score_range check (score between 0 and 10),
  constraint evaluation_professionals_unique unique (evaluation_id, professional_id)
);

comment on table public.evaluation_professionals is 'Notas individuais dos profissionais selecionados em cada avaliação.';

-- ============================================================
-- 6. ÍNDICES PARA BUSCA, FILTROS E DASHBOARD
-- ============================================================

create index if not exists idx_profiles_role_status on public.profiles(role, status);
create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_patients_full_name on public.patients using gin (to_tsvector('portuguese', full_name));
create index if not exists idx_patients_status on public.patients(status);
create index if not exists idx_health_units_name on public.health_units using gin (to_tsvector('portuguese', name));
create index if not exists idx_health_units_type_status on public.health_units(type, status);
create index if not exists idx_professionals_full_name on public.professionals using gin (to_tsvector('portuguese', full_name));
create index if not exists idx_professionals_health_unit_status on public.professionals(health_unit_id, status);
create index if not exists idx_evaluations_patient_id on public.evaluations(patient_id);
create index if not exists idx_evaluations_health_unit_id on public.evaluations(health_unit_id);
create index if not exists idx_evaluations_health_unit_date on public.evaluations(health_unit_id, attendance_date);
create index if not exists idx_evaluations_attendance_date on public.evaluations(attendance_date);
create index if not exists idx_evaluations_resolution on public.evaluations(resolution);
create index if not exists idx_evaluations_manifestation on public.evaluations(manifestation);
create index if not exists idx_evaluation_professionals_evaluation_id on public.evaluation_professionals(evaluation_id);
create index if not exists idx_evaluation_professionals_professional_id on public.evaluation_professionals(professional_id);

-- ============================================================
-- 7. VIEWS PARA DASHBOARD E RANKING
-- ============================================================

create or replace view public.v_city_monthly_metrics as
select
  date_trunc('month', attendance_date)::date as month,
  count(*)::integer as total_evaluations,
  round(avg(general_score), 2) as avg_general_score,
  round(avg(satisfaction_score), 2) as avg_satisfaction_score,
  round(avg(service_quality_score), 2) as avg_service_quality_score,
  round(avg(wait_time_minutes), 2) as avg_wait_time_minutes,
  round(
    100.0 * count(*) filter (where resolution = 'resolved') / nullif(count(*), 0),
    2
  ) as resolution_rate
from public.evaluations e
join public.patients p
  on p.id = e.patient_id
 and p.status = 'active'
join public.health_units hu
  on hu.id = e.health_unit_id
 and hu.status = 'active'
left join public.profiles pr
  on pr.id = e.created_by
where e.created_by is null
   or pr.status = 'active'
group by date_trunc('month', e.attendance_date)
order by month;

comment on view public.v_city_monthly_metrics is 'Indicadores mensais consolidados da cidade.';

create or replace view public.v_unit_metrics as
select
  hu.id as health_unit_id,
  hu.name as health_unit_name,
  hu.type as health_unit_type,
  hu.status as health_unit_status,
  count(e.id)::integer as total_evaluations,
  round(avg(e.general_score), 2) as avg_general_score,
  round(avg(e.satisfaction_score), 2) as avg_satisfaction_score,
  round(avg(e.structure_score), 2) as avg_structure_score,
  round(avg(e.clarity_score), 2) as avg_clarity_score,
  round(avg(e.service_quality_score), 2) as avg_service_quality_score,
  round(avg(e.wait_time_minutes), 2) as avg_wait_time_minutes,
  round(
    100.0 * count(e.id) filter (where e.resolution = 'resolved') / nullif(count(e.id), 0),
    2
  ) as resolution_rate,
  max(e.attendance_date) as last_evaluation_date
from public.health_units hu
left join public.evaluations e
  on e.health_unit_id = hu.id
left join public.patients p
  on p.id = e.patient_id
 and p.status = 'active'
left join public.profiles pr
  on pr.id = e.created_by
 and pr.status = 'active'
where hu.status = 'active'
  and (e.id is null or (p.id is not null and (e.created_by is null or pr.id is not null)))
group by hu.id, hu.name, hu.type, hu.status;

comment on view public.v_unit_metrics is 'Indicadores consolidados por unidade de saúde.';

create or replace view public.v_unit_monthly_metrics as
select
  hu.id as health_unit_id,
  hu.name as health_unit_name,
  date_trunc('month', e.attendance_date)::date as month,
  count(e.id)::integer as total_evaluations,
  round(avg(e.general_score), 2) as avg_general_score,
  round(avg(e.satisfaction_score), 2) as avg_satisfaction_score,
  round(avg(e.service_quality_score), 2) as avg_service_quality_score,
  round(avg(e.wait_time_minutes), 2) as avg_wait_time_minutes,
  round(
    100.0 * count(e.id) filter (where e.resolution = 'resolved') / nullif(count(e.id), 0),
    2
  ) as resolution_rate
from public.evaluations e
join public.health_units hu
  on hu.id = e.health_unit_id
 and hu.status = 'active'
join public.patients p
  on p.id = e.patient_id
 and p.status = 'active'
left join public.profiles pr
  on pr.id = e.created_by
where e.created_by is null
   or pr.status = 'active'
group by hu.id, hu.name, date_trunc('month', e.attendance_date)
order by month, hu.name;

comment on view public.v_unit_monthly_metrics is 'Evolução mensal dos indicadores por unidade.';

create or replace view public.v_professional_metrics as
select
  p.id as professional_id,
  p.full_name as professional_name,
  p.position,
  p.health_unit_id,
  hu.name as health_unit_name,
  p.status as professional_status,
  hu.status as health_unit_status,
  count(ep.id)::integer as total_evaluations,
  round(avg(ep.score), 2) as avg_professional_score,
  max(e.attendance_date) as last_evaluation_date
from public.professionals p
join public.health_units hu
  on hu.id = p.health_unit_id
 and hu.status = 'active'
left join public.evaluation_professionals ep
  on ep.professional_id = p.id
left join public.evaluations e
  on e.id = ep.evaluation_id
left join public.patients pa
  on pa.id = e.patient_id
 and pa.status = 'active'
left join public.profiles pr
  on pr.id = e.created_by
 and pr.status = 'active'
where p.status = 'active'
  and (e.id is null or (pa.id is not null and (e.created_by is null or pr.id is not null)))
group by p.id, p.full_name, p.position, p.health_unit_id, hu.name, p.status, hu.status;

comment on view public.v_professional_metrics is 'Indicadores consolidados por profissional.';

-- ============================================================
-- 8. FUNÇÕES AUXILIARES DE PERMISSÃO
-- ============================================================

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

-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.health_units enable row level security;
alter table public.professionals enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_professionals enable row level security;

-- Remove políticas antigas caso o script seja executado novamente.
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

-- Profiles
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.has_app_role(array['admin']::public.app_user_role[]));

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

-- Patients
create policy "patients_read_authenticated"
on public.patients
for select
to authenticated
using (public.is_active_user());

create policy "patients_write_admin_operator"
on public.patients
for insert
to authenticated
with check (public.has_app_role(array['admin','operator']::public.app_user_role[]));

create policy "patients_update_admin_operator"
on public.patients
for update
to authenticated
using (public.has_app_role(array['admin','operator']::public.app_user_role[]))
with check (public.has_app_role(array['admin','operator']::public.app_user_role[]));

create policy "patients_delete_admin"
on public.patients
for delete
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]));

-- Health Units
create policy "health_units_read_authenticated"
on public.health_units
for select
to authenticated
using (public.is_active_user());

create policy "health_units_write_admin"
on public.health_units
for insert
to authenticated
with check (public.has_app_role(array['admin']::public.app_user_role[]));

create policy "health_units_update_admin"
on public.health_units
for update
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]))
with check (public.has_app_role(array['admin']::public.app_user_role[]));

create policy "health_units_delete_admin"
on public.health_units
for delete
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]));

-- Professionals
create policy "professionals_read_authenticated"
on public.professionals
for select
to authenticated
using (public.is_active_user());

create policy "professionals_write_admin"
on public.professionals
for insert
to authenticated
with check (public.has_app_role(array['admin']::public.app_user_role[]));

create policy "professionals_update_admin"
on public.professionals
for update
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]))
with check (public.has_app_role(array['admin']::public.app_user_role[]));

create policy "professionals_delete_admin"
on public.professionals
for delete
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]));

-- Evaluations
create policy "evaluations_read_authenticated"
on public.evaluations
for select
to authenticated
using (public.is_active_user());

create policy "evaluations_write_admin_operator"
on public.evaluations
for insert
to authenticated
with check (public.has_app_role(array['admin','operator']::public.app_user_role[]));

create policy "evaluations_update_admin_operator"
on public.evaluations
for update
to authenticated
using (public.has_app_role(array['admin','operator']::public.app_user_role[]))
with check (public.has_app_role(array['admin','operator']::public.app_user_role[]));

create policy "evaluations_delete_admin"
on public.evaluations
for delete
to authenticated
using (public.has_app_role(array['admin']::public.app_user_role[]));

-- Evaluation Professionals
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

-- ============================================================
-- 10. GRANTS PARA VIEWS E FUNÇÕES
-- ============================================================

grant usage on schema public to authenticated;
grant select on public.v_city_monthly_metrics to authenticated;
grant select on public.v_unit_metrics to authenticated;
grant select on public.v_unit_monthly_metrics to authenticated;
grant select on public.v_professional_metrics to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.has_app_role(public.app_user_role[]) to authenticated;


-- ============================================================
-- 10.1 GRANTS EXPLÍCITOS PARA EVITAR ERROS 401/403 NA API
-- ============================================================
-- Em alguns projetos Supabase novos, as permissões de API podem não ser
-- aplicadas automaticamente a todas as tabelas customizadas. Estes grants
-- liberam o acesso para usuários autenticados; a regra final continua sendo
-- controlada pelas políticas de RLS acima.

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

-- ============================================================
-- 11. DADOS DE EXEMPLO OPCIONAIS
-- ============================================================
-- Estes inserts podem ser usados para testar a interface depois.
-- Eles não criam usuário/senha. O usuário deve ser criado em Authentication > Users.

-- insert into public.health_units (name, type, address, neighborhood, phone, manager_name, status)
-- values
--   ('PSF Centro', 'psf', 'Endereço a confirmar', 'Centro', null, null, 'active'),
--   ('Hospital Municipal', 'hospital', 'Endereço a confirmar', 'Centro', null, null, 'active');

-- ============================================================
-- 12. PRIMEIRO ADMINISTRADOR
-- ============================================================
-- Depois de criar o primeiro usuário no Supabase Auth, rode um update como este:
--
-- update public.profiles
-- set role = 'admin', status = 'active', full_name = 'Administrador'
-- where email = 'email-do-admin@dominio.com';
--
-- Não armazene senha em tabelas públicas. Use o Supabase Auth.
-- ============================================================
