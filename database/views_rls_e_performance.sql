-- ============================================================
-- Views com RLS aplicada + índices de performance
-- Execute este arquivo no SQL Editor do Supabase.
-- Script idempotente, seguro e não destrutivo.
-- ============================================================
--
-- O que este script resolve:
--
-- 1. SEGURANÇA — as views de métricas eram criadas sem `security_invoker`.
--    Uma view assim roda com as permissões de quem a criou (o dono), e não com
--    as de quem consulta, então ela ignora as políticas de RLS das tabelas por
--    baixo. Na prática, qualquer usuário autenticado no projeto Supabase podia
--    ler as métricas do município direto pela API REST, mesmo sem perfil ativo
--    no sistema. Com `security_invoker = true` a RLS volta a valer.
--
-- 2. CORREÇÃO DE EFEITO COLATERAL — as views checavam o status do autor da
--    avaliação com um join em `public.profiles`. Como a RLS de `profiles`
--    só deixa cada pessoa ver a própria linha (ou tudo, se for admin), ativar
--    `security_invoker` faria operadores e leitores perderem toda avaliação
--    criada por outra pessoa. Por isso a checagem passa a ser feita pela função
--    `public.is_active_profile`, que é `security definer` e devolve apenas um
--    booleano — sem expor nenhum dado de perfil.
--
-- 3. PERFORMANCE — índices para as consultas do painel e das buscas por nome.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Função auxiliar para checar o autor sem vazar perfis
-- ------------------------------------------------------------

create or replace function public.is_active_profile(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_id is null
      or exists (
        select 1
        from public.profiles
        where id = target_id
          and status = 'active'
      );
$$;

comment on function public.is_active_profile(uuid) is
  'Informa se o perfil está ativo sem expor a linha de public.profiles. Usado pelas views de métricas para não depender da RLS de profiles.';

grant execute on function public.is_active_profile(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2. Views recriadas com security_invoker
-- ------------------------------------------------------------

create or replace view public.v_city_monthly_metrics
with (security_invoker = true) as
select
  date_trunc('month', e.attendance_date)::date as month,
  count(*)::integer as total_evaluations,
  round(avg(e.general_score), 2) as avg_general_score,
  round(avg(e.satisfaction_score), 2) as avg_satisfaction_score,
  round(avg(e.service_quality_score), 2) as avg_service_quality_score,
  round(avg(e.wait_time_minutes), 2) as avg_wait_time_minutes,
  round(
    100.0 * count(*) filter (where e.resolution = 'resolved') / nullif(count(*), 0),
    2
  ) as resolution_rate
from public.evaluations e
join public.patients p
  on p.id = e.patient_id
 and p.status = 'active'
join public.health_units hu
  on hu.id = e.health_unit_id
 and hu.status = 'active'
where public.is_active_profile(e.created_by)
group by date_trunc('month', e.attendance_date)
order by month;

comment on view public.v_city_monthly_metrics is 'Indicadores mensais consolidados da cidade.';

create or replace view public.v_unit_metrics
with (security_invoker = true) as
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
 and public.is_active_profile(e.created_by)
 and exists (
   select 1
   from public.patients p
   where p.id = e.patient_id
     and p.status = 'active'
 )
where hu.status = 'active'
group by hu.id, hu.name, hu.type, hu.status;

comment on view public.v_unit_metrics is 'Indicadores consolidados por unidade de saúde.';

create or replace view public.v_unit_monthly_metrics
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
where public.is_active_profile(e.created_by)
group by hu.id, hu.name, date_trunc('month', e.attendance_date)
order by month, hu.name;

comment on view public.v_unit_monthly_metrics is 'Evolução mensal dos indicadores por unidade.';

-- Nota: `count(e.id)` (e não `count(ep.id)`) garante que uma linha de vínculo
-- sem avaliação correspondente não infle o total de avaliações.
create or replace view public.v_professional_metrics
with (security_invoker = true) as
select
  p.id as professional_id,
  p.full_name as professional_name,
  p.position,
  p.health_unit_id,
  hu.name as health_unit_name,
  p.status as professional_status,
  hu.status as health_unit_status,
  count(e.id)::integer as total_evaluations,
  round(avg(ep.score), 2) as avg_professional_score,
  max(e.attendance_date) as last_evaluation_date
from public.professionals p
join public.health_units hu
  on hu.id = p.health_unit_id
left join public.evaluation_professionals ep
  on ep.professional_id = p.id
left join public.evaluations e
  on e.id = ep.evaluation_id
 and public.is_active_profile(e.created_by)
 and exists (
   select 1
   from public.patients pa
   where pa.id = e.patient_id
     and pa.status = 'active'
 )
 and exists (
   select 1
   from public.health_units ehu
   where ehu.id = e.health_unit_id
     and ehu.status = 'active'
 )
group by p.id, p.full_name, p.position, p.health_unit_id, hu.name, p.status, hu.status;

comment on view public.v_professional_metrics is 'Indicadores consolidados por profissional.';

-- ------------------------------------------------------------
-- 3. Permissões: apenas usuários autenticados, nunca anônimos
-- ------------------------------------------------------------

revoke all on public.v_city_monthly_metrics from anon;
revoke all on public.v_unit_metrics from anon;
revoke all on public.v_unit_monthly_metrics from anon;
revoke all on public.v_professional_metrics from anon;

grant select on public.v_city_monthly_metrics to authenticated;
grant select on public.v_unit_metrics to authenticated;
grant select on public.v_unit_monthly_metrics to authenticated;
grant select on public.v_professional_metrics to authenticated;

-- ------------------------------------------------------------
-- 4. Índices de apoio
-- ------------------------------------------------------------

create extension if not exists pg_trgm;

-- "Observações recentes" no painel: ordena por created_at e descarta os
-- registros sem comentário. O índice parcial cobre exatamente esse recorte.
create index if not exists idx_evaluations_notes_created_at
  on public.evaluations (created_at desc)
  where general_notes is not null;

-- Busca de pacientes por nome e por CPF (`ilike '%termo%'`). Os índices GIN de
-- tsvector que já existiam não atendem busca por substring; os de trigrama sim.
create index if not exists idx_patients_full_name_trgm
  on public.patients using gin (full_name gin_trgm_ops);

create index if not exists idx_patients_cpf_trgm
  on public.patients using gin (cpf gin_trgm_ops);

create index if not exists idx_professionals_full_name_trgm
  on public.professionals using gin (full_name gin_trgm_ops);

create index if not exists idx_health_units_name_trgm
  on public.health_units using gin (name gin_trgm_ops);

-- Junções mais usadas pelo painel e pelo ranking.
create index if not exists idx_evaluations_patient_id on public.evaluations(patient_id);
create index if not exists idx_evaluations_health_unit_id on public.evaluations(health_unit_id);
create index if not exists idx_evaluations_created_by on public.evaluations(created_by);
create index if not exists idx_evaluation_professionals_professional_id
  on public.evaluation_professionals(professional_id);
create index if not exists idx_evaluation_professionals_evaluation_id
  on public.evaluation_professionals(evaluation_id);
create index if not exists idx_profiles_status on public.profiles(status);

analyze public.evaluations;
analyze public.evaluation_professionals;
analyze public.patients;
