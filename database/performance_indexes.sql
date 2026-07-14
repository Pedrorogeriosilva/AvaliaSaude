-- Índices adicionais de performance para o Avalia Saúde
-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists pg_trgm;

create index if not exists idx_patients_cpf on public.patients(cpf);
create index if not exists idx_patients_status_created_at on public.patients(status, created_at desc);
create index if not exists idx_health_units_status_name on public.health_units(status, name);
create index if not exists idx_professionals_status_full_name on public.professionals(status, full_name);
create index if not exists idx_professionals_health_unit_status_full_name on public.professionals(health_unit_id, status, full_name);
create index if not exists idx_evaluations_created_at on public.evaluations(created_at desc);
create index if not exists idx_evaluations_health_unit_created_at on public.evaluations(health_unit_id, created_at desc);
create index if not exists idx_evaluations_patient_id on public.evaluations(patient_id);

create index if not exists idx_patients_full_name_trgm
  on public.patients
  using gin (full_name gin_trgm_ops);

create index if not exists idx_professionals_full_name_trgm
  on public.professionals
  using gin (full_name gin_trgm_ops);

create index if not exists idx_health_units_name_trgm
  on public.health_units
  using gin (name gin_trgm_ops);
