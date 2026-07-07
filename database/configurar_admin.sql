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
-- ============================================================

update public.profiles
set
  full_name = 'Administrador Avalia Saúde',
  role = 'admin',
  status = 'active',
  updated_at = now()
where email = 'admin@seudominio.com';

select id, full_name, email, role, status, created_at, updated_at
from public.profiles
where email = 'admin@seudominio.com';