-- ============================================================
-- Avalia Saúde - Configuração do usuário administrador inicial
-- ============================================================
-- Use este arquivo APÓS criar o usuário abaixo no Supabase Auth:
--
-- Authentication > Users > Add user
-- E-mail: admin@seudominio.com
-- Senha:  defina uma senha forte localmente
--
-- Depois execute este SQL no SQL Editor para garantir perfil admin.
-- Troque o e-mail se você criou outro usuário.
-- ============================================================

insert into public.profiles (id, full_name, email, role, status)
select
  au.id,
  'Administrador Avalia Saúde',
  au.email,
  'admin',
  'active'
from auth.users au
where au.email = 'admin@seudominio.com'
on conflict (id) do update
set
  full_name = 'Administrador Avalia Saúde',
  email = excluded.email,
  role = 'admin',
  status = 'active',
  updated_at = now();

select id, full_name, email, role, status, created_at, updated_at
from public.profiles
where email = 'admin@seudominio.com';
