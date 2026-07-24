-- ============================================================
-- Ajuste das avaliações + IMS (Índice Municipal de Saúde)
-- Execute este arquivo no SQL Editor do Supabase.
-- Idempotente: pode rodar mais de uma vez sem quebrar.
-- Rode DEPOIS de multi_cidade.sql (depende das views daquele arquivo).
-- ============================================================
--
-- O que este script faz:
--
-- 1. Simplifica os critérios de avaliação. Passam a existir apenas três notas:
--       general_score     -> Nota Geral do Atendimento (também exibida como IMS)
--       structure_score   -> Estrutura
--       wait_time_score    -> Tempo de Espera (NOVO, nota de 0 a 10)
--    Removidas: satisfaction_score, clarity_score, service_quality_score.
-- 2. Remove o campo de minutos de espera (wait_time_minutes). O tempo de espera
--    agora é uma nota, não uma quantidade de minutos.
-- 3. Recria as views de métricas que referenciavam as colunas removidas.
--
-- Sobre o IMS: é a general_score, apenas renomeada no painel. Estrutura e Tempo
-- de Espera são critérios próprios, exibidos à parte, e NÃO entram no índice.
--
-- ATENÇÃO: dropar as colunas apaga os dados históricos de satisfação, clareza,
-- qualidade e minutos de espera. É o comportamento desejado (esses critérios
-- deixaram de existir). Faça backup antes se quiser preservar o histórico.
-- ============================================================

set search_path = public, extensions;

-- ------------------------------------------------------------
-- 1. As views dependem das colunas; precisam cair antes do ALTER TABLE.
-- ------------------------------------------------------------

drop view if exists public.v_city_monthly_metrics;
drop view if exists public.v_unit_metrics;
drop view if exists public.v_unit_monthly_metrics;

-- ------------------------------------------------------------
-- 2. Colunas de avaliação
-- ------------------------------------------------------------

-- Nova nota de tempo de espera (0 a 10). Fica nula nas avaliações antigas;
-- o formulário sempre a envia nas novas. As médias ignoram nulos.
alter table public.evaluations
  add column if not exists wait_time_score numeric(4,2);

alter table public.evaluations
  drop constraint if exists evaluations_wait_time_score_range;
alter table public.evaluations
  add constraint evaluations_wait_time_score_range
  check (wait_time_score is null or wait_time_score between 0 and 10);

comment on column public.evaluations.wait_time_score is 'Nota de 0 a 10 para o tempo de espera. Substitui wait_time_minutes.';

-- Critérios removidos. Dropar a coluna remove junto os checks e a dependência
-- das views (por isso as views caíram acima).
alter table public.evaluations drop column if exists satisfaction_score;
alter table public.evaluations drop column if exists clarity_score;
alter table public.evaluations drop column if exists service_quality_score;
alter table public.evaluations drop column if exists wait_time_minutes;

-- ------------------------------------------------------------
-- 3. Recriação das views de métricas
-- ------------------------------------------------------------
-- Mantêm `security_invoker = true` para herdar o RLS por cidade (senão um gestor
-- veria métricas de todas as cidades). Ver multi_cidade.sql, seção 5.5.

create view public.v_city_monthly_metrics
with (security_invoker = true) as
select
  hu.city_id,
  date_trunc('month', e.attendance_date)::date as month,
  count(e.id)::integer as total_evaluations,
  round(avg(e.general_score), 2) as avg_general_score,
  round(avg(e.structure_score), 2) as avg_structure_score,
  round(avg(e.wait_time_score), 2) as avg_wait_time_score,
  round(100.0 * count(e.id) filter (where e.resolution = 'resolved') / nullif(count(e.id), 0), 2) as resolution_rate
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
  round(avg(e.structure_score), 2) as avg_structure_score,
  round(avg(e.wait_time_score), 2) as avg_wait_time_score,
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
  round(avg(e.structure_score), 2) as avg_structure_score,
  round(avg(e.wait_time_score), 2) as avg_wait_time_score,
  round(100.0 * count(e.id) filter (where e.resolution = 'resolved') / nullif(count(e.id), 0), 2) as resolution_rate
from public.evaluations e
join public.health_units hu on hu.id = e.health_unit_id and hu.status = 'active'
join public.patients p on p.id = e.patient_id and p.status = 'active'
where public.is_active_profile(e.created_by)
group by hu.id, hu.name, date_trunc('month', e.attendance_date);

-- ------------------------------------------------------------
-- 4. Grants (as views foram recriadas, então os grants também)
-- ------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on public.v_city_monthly_metrics to authenticated;
    grant select on public.v_unit_metrics to authenticated;
    grant select on public.v_unit_monthly_metrics to authenticated;
  end if;
end
$$;
