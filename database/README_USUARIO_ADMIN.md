# Usuário administrador inicial

Defina um usuário administrativo inicial para o sistema:

```text
E-mail: admin@seudominio.com
Senha: defina uma senha forte localmente
```

## Opção recomendada: criar pelo Supabase

1. Acesse o painel do Supabase.
2. Vá em **Authentication > Users > Add user**.
3. Crie o usuário com o e-mail acima e uma senha forte definida por você.
4. Depois vá em **SQL Editor** e execute:

```text
database/configurar_admin.sql
```

Esse SQL coloca o perfil do usuário como `admin` e `active` na tabela `profiles`.

## Opção automática via script local

Também é possível criar/atualizar o usuário pelo terminal:

1. No `.env.local`, configure:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
ADMIN_EMAIL=admin@seudominio.com
ADMIN_PASSWORD=DEFINA_UMA_SENHA_FORTE_AQUI
ADMIN_NAME=Administrador Avalia Saúde
```

2. Rode:

```bash
npm run setup:admin
```

A `SUPABASE_SERVICE_ROLE_KEY` deve ser usada somente localmente para essa configuração. Não exponha essa chave no frontend e não publique `.env.local` no GitHub.