# Avalia Saúde - Porto Alegre do Norte

Base inicial do sistema **Avalia Saúde - Porto Alegre do Norte**, preparada para Next.js, Supabase e deploy na Vercel.

## O que jÃ¡ estÃ¡ incluÃ­do

- Layout institucional com menu principal: Painel, Avalie, Ranking e Cadastros.
- Login com Supabase Auth usando cookies/SSR.
- ProteÃ§Ã£o de rotas via middleware.
- Painel inicial com cards e grÃ¡ficos.
- Ranking de unidades e profissionais.
- Cadastro/listagem de pacientes.
- Cadastro/listagem de unidades de saÃºde.
- Cadastro/listagem de profissionais.
- Listagem de usuÃ¡rios/perfis.
- Tela de nova avaliaÃ§Ã£o com seleÃ§Ã£o dinÃ¢mica de profissionais pela unidade.
- ConexÃ£o com as views criadas no schema SQL.

## Stack

- Next.js com App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase/PostgreSQL
- Recharts
- Vercel

## Como rodar localmente

### 1. Instalar dependÃªncias

```bash
npm install
```

### 2. Criar o projeto no Supabase

Crie um projeto no Supabase e execute o arquivo:

```text
database/schema.sql
```

Use o SQL Editor do Supabase.

### 3. Configurar variÃ¡veis de ambiente

Copie o arquivo `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

Preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

Esses valores ficam no painel do Supabase em **Project Settings > API**.

### 4. Criar o primeiro usuÃ¡rio

No Supabase, vÃ¡ em:

```text
Authentication > Users > Add user
```

Crie o e-mail e a senha do primeiro administrador.

Depois, no SQL Editor, execute:

```sql
update public.profiles
set role = 'admin', status = 'active', full_name = 'Administrador'
where email = 'email-do-admin@dominio.com';
```

Troque o e-mail pelo e-mail real criado.

### 5. Rodar o projeto

```bash
npm run dev
```

Abra:

```text
http://localhost:3000
```

## Deploy na Vercel

1. Suba este projeto para um repositÃ³rio GitHub.
2. Importe o projeto na Vercel.
3. Configure as variÃ¡veis de ambiente na Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. FaÃ§a o deploy.

## ObservaÃ§Ãµes importantes

- A senha dos usuÃ¡rios fica no Supabase Auth, nÃ£o na tabela `profiles`.
- As permissÃµes estÃ£o no banco via RLS.
- UsuÃ¡rios com perfil `viewer` visualizam dados, mas nÃ£o devem alterar cadastros.
- UsuÃ¡rios `operator` podem cadastrar pacientes e avaliaÃ§Ãµes.
- UsuÃ¡rios `admin` tÃªm acesso completo.

## PrÃ³ximo passo recomendado

A prÃ³xima etapa Ã© melhorar a parte de CRUD com:

- ediÃ§Ã£o completa de pacientes;
- ediÃ§Ã£o completa de unidades;
- ediÃ§Ã£o completa de profissionais;
- tela administrativa para alterar perfil dos usuÃ¡rios;
- filtros por perÃ­odo no painel e no ranking;
- revisÃ£o visual mais completa antes de salvar avaliaÃ§Ã£o;
- exportaÃ§Ã£o de relatÃ³rios.
