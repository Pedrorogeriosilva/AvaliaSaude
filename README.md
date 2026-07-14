# Avalia Saúde - Porto Alegre do Norte

Sistema municipal de avaliação da saúde pública, construído com Next.js App Router, TypeScript, Tailwind e Supabase.

## Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Supabase Auth + PostgreSQL
- Recharts

## Configuração inicial

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar o banco

Execute no Supabase SQL Editor:

```text
database/schema.sql
database/security_hardening.sql
```

### 3. Configurar variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
ADMIN_CREATION_PASSWORD=SUA_SENHA_EXTRA
ADMIN_GATE_SECRET=UM_SECRET_FORTE_E_EXCLUSIVO
```

## Fluxo correto de desenvolvimento

Use este comando ao começar a trabalhar, após atualizar arquivos, ou quando receber uma nova versão do projeto:

```bash
npm run dev:fresh
```

Abra `http://localhost:3000`.

### Regras importantes

- Nunca copie a pasta `.next` de uma versão do projeto para outra.
- Nunca copie `node_modules` entre máquinas.
- Nunca envie `.next`, `.vercel`, `.turbo` ou caches em ZIP.
- Feche o terminal do `npm run dev` antes de substituir arquivos do projeto no Windows.
- Não extraia um ZIP novo por cima de uma pasta antiga com `.next`.
- Se possível, use um caminho simples, por exemplo `C:\Projetos\AvaliaSaude`.

### Se aparecer erro de chunk ou cache

Se aparecer erro como `Cannot find module './xxx.js'`, `ENOENT` em `.next`, `prerender-manifest.json` ausente ou erro lendo `/_app`, pare o servidor e rode:

```bash
npm run dev:fresh
```

## Fluxo correto de produção local

`next start` exige um build válido anterior. Use sempre:

```bash
npm run build:fresh
npm run start
```

Se editar o código, gere um novo build antes de usar `npm run start` novamente.

## Comandos úteis

```bash
npm run dev
npm run dev:fresh
npm run lint
npm run typecheck
npm run check
npm run clean
npm run build
npm run build:fresh
npm run rebuild
npm run start
```

## Segurança

- `SUPABASE_SERVICE_ROLE_KEY` fica somente no servidor.
- Nunca use secrets com prefixo `NEXT_PUBLIC_`.
- Nunca envie `.env.local` para o GitHub.
- Use `ADMIN_GATE_SECRET` exclusivo para assinar o gate administrativo.

## Deploy na Vercel

Configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_CREATION_PASSWORD`
- `ADMIN_GATE_SECRET`

Na Vercel, não envie `.next`.
