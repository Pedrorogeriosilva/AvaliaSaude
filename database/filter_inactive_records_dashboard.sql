-- Ajuste idempotente para garantir que dashboard, ranking e formulário
-- considerem apenas registros ativos.
-- Execute este arquivo no SQL Editor do Supabase.

create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_patients_status on public.patients(status);
create index if not exists idx_health_units_type_status on public.health_units(type, status);
create index if not exists idx_professionals_health_unit_status on public.professionals(health_unit_id, status);
create index if not exists idx_evaluations_patient_id on public.evaluations(patient_id);
create index if not exists idx_evaluations_health_unit_id on public.evaluations(health_unit_id);
create index if not exists idx_evaluation_professionals_professional_id on public.evaluation_professionals(professional_id);

create or replace view public.v_city_monthly_metrics as
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
left join public.profiles pr
  on pr.id = e.created_by
where e.created_by is null
   or pr.status = 'active'
group by date_trunc('month', e.attendance_date)
order by month;

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
