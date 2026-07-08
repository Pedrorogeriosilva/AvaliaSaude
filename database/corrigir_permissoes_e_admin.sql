-- ============================================================
-- Avalia Saúde - Correção rápida de permissões e primeiro admin
-- ============================================================
-- Use este arquivo se o sistema estiver retornando 401/403 no painel
-- ou se o login entrar, mas as telas ficarem sem permissão.
--
-- 1. Troque o e-mail abaixo pelo e-mail criado em Authentication > Users.
-- 2. Execute tudo no SQL Editor do Supabase.
-- 3. Recarregue o sistema e faça login novamente.
-- ============================================================

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

insert into public.profiles (id, full_name, email, role, status)
select
  au.id,
  coalesce(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1), 'Administrador Avalia Saúde'),
  au.email,
  'admin',
  'active'
from auth.users au
where au.email = 'admin@seudominio.com'
on conflict (id) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  role = 'admin',
  status = 'active',
  updated_at = now();

select id, full_name, email, role, status, created_at, updated_at
from public.profiles
where email = 'admin@seudominio.com';
