# Avalia Saúde - Porto Alegre do Norte

Sistema municipal de avaliação da saúde pública, preparado para Next.js, Supabase e deploy na Vercel.

## Incluído nesta versão

- Layout institucional com menu principal: Painel, Avalie, Ranking e Cadastros.
- Login com Supabase Auth usando cookies/SSR.
- Proteção de rotas via middleware.
- Validação de usuário ativo pela tabela `profiles`.
- Painel com cards e gráficos carregados dinamicamente.
- Ranking de unidades e profissionais.
- Cadastro/listagem de pacientes.
- Cadastro/listagem de unidades de saúde.
- Cadastro/listagem de profissionais.
- Criação e manutenção de usuários/perfis pelo próprio site, quando a chave service role estiver configurada.
- Tela de nova avaliação com seleção dinâmica de profissionais pela unidade.
- SQL de schema, permissões e configuração do primeiro administrador.
- Logo institucional nova em `public/brand`.

## Stack

- Next.js com App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase/PostgreSQL
- Recharts
- Vercel

## Como rodar localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar o Supabase

Crie um projeto no Supabase e execute no SQL Editor:

```text
database/schema.sql
```

### 3. Configurar variáveis de ambiente

Copie `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

Preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

Para criar administradores, operadores e usuários de leitura pelo próprio site em `Cadastros > Usuários`, configure também no servidor/Vercel:

```env
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
```

Essa chave deve ficar somente em variáveis de ambiente do servidor. Nunca exponha no frontend ou em repositório público.

Esses valores ficam em Project Settings > API no Supabase.

### 4. Criar o primeiro administrador

No Supabase, acesse:

```text
Authentication > Users > Add user
```

Crie o usuário administrador com e-mail e senha.

Depois, edite o e-mail dentro de:

```text
database/configurar_admin.sql
```

E execute no SQL Editor.

Se o painel retornar 401/403, execute também:

```text
database/corrigir_permissoes_e_admin.sql
```

Lembre-se de trocar `admin@seudominio.com` pelo e-mail real do administrador.

### 5. Rodar o projeto

```bash
npm run dev
```

Abra:

```text
http://localhost:3000
```

## Deploy na Vercel

1. Suba o projeto para o GitHub.
2. Importe o repositório na Vercel.
3. Configure as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`, caso queira criar usuários pelo site
   - `ADMIN_CREATION_PASSWORD`, caso queira criar ou promover administradores pelo site
4. Faça o deploy.

## Comandos úteis

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Observações importantes

- Senhas ficam no Supabase Auth, nunca em tabela pública.
- Permissões são controladas por RLS no banco.
- Usuários `viewer` visualizam dados.
- Usuários `operator` podem cadastrar pacientes e avaliações.
- Usuários `admin` têm acesso completo e podem criar outros administradores pelo site quando `SUPABASE_SERVICE_ROLE_KEY` estiver configurada.
- O arquivo `.env.local` não deve ser enviado ao GitHub.

## Senha adicional para criar administradores

Para criar ou promover usuários com perfil **Administrador** pelo próprio site, configure também:

```env
ADMIN_CREATION_PASSWORD=SENHA_EXTRA_DE_ADMIN
```

Você pode usar o mesmo valor da senha do seu usuário administrador, mas não coloque essa senha no código fonte. Configure somente no `.env.local` ou nas variáveis de ambiente da Vercel. Operadores e perfis de leitura não exigem essa senha adicional.


## Atualização: performance, observações e gestão de usuários

Esta versão otimiza a navegação entre Painel, Avalie, Ranking e Cadastros. Com `SUPABASE_SERVICE_ROLE_KEY` configurada no servidor, as consultas de dashboard, ranking e dados base do formulário usam cache curto de servidor e são revalidadas automaticamente após cadastros e novas avaliações.

No Painel, a seção **Observações recentes das avaliações** permite ler os comentários preenchidos no campo de observações do formulário.

Em **Cadastros > Usuários**, administradores podem criar, editar, alterar senha, alterar perfil/status e excluir usuários. Para criar, promover ou excluir usuários administradores, configure também:

```env
ADMIN_CREATION_PASSWORD=SUA_SENHA_EXTRA
```
