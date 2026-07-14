# Dashboard and Next Runtime Fix Report

## 1. Causa dos dados faltantes na dashboard

- A dashboard estava misturando consultas independentes por seção, o que deixava o painel inconsistente quando uma query falhava.
- `Profissionais em destaque` dependia de `v_professional_metrics`; se a view estivesse desatualizada no banco, a seção quebrava mesmo com dados válidos nas tabelas base.
- `Observações recentes` filtrava dados ativos corretamente em partes, mas o layout ficava estranho quando havia poucos itens.
- O painel fazia múltiplas leituras separadas em vez de trabalhar com um snapshot único dos dados.

## 2. Causa do erro em “Profissionais em destaque”

- A causa mais provável era dependência excessiva de view SQL potencialmente desatualizada ou divergente do frontend.
- Para eliminar esse ponto frágil, a seção passou a ser calculada diretamente a partir de `professionals`, `evaluation_professionals`, `evaluations`, `patients`, `health_units` e `profiles`, sempre filtrando registros ativos.

## 3. Queries e views corrigidas

- `lib/app-data.ts`
  - `getDashboardData()` agora retorna:
    - `units`
    - `monthly`
    - `highlightedProfessionals`
    - `notes`
    - `errors` por seção
  - Erros parciais ficam isolados.
  - Logs seguros em development são emitidos por seção.
- `getDashboardProfessionalsData()` agora usa agregação direta das tabelas base.
- `getDashboardNotesData()` foi reforçada para:
  - considerar apenas observações preenchidas
  - excluir pacientes/unidades/usuários inativos
  - retornar vazio quando não houver dados
- `getRankingData()` passou a reutilizar dados confiáveis e filtrados.

## 4. Arquivos alterados

- `lib/app-data.ts`
- `app/(app)/painel/page.tsx`
- `components/dashboard/monthly-chart.tsx`
- `components/dashboard/unit-bar-chart.tsx`
- `components/ui/empty-state.tsx`
- `types/index.ts`
- `next.config.ts`
- `package.json`
- `package-lock.json`
- `.gitignore`
- `README.md`
- `scripts/clean.mjs`
- `scripts/ensure-build.mjs`
- `database/dashboard_active_records_views.sql`
- `pages/.gitkeep`
- Removido do versionamento: `tsconfig.tsbuildinfo`

## 5. SQL criado/alterado e instrução de execução

- Novo arquivo: `database/dashboard_active_records_views.sql`
- Objetivo:
  - recriar views da dashboard com filtros de ativos
  - garantir colunas esperadas pelo frontend
  - reforçar índices para consultas do painel/ranking

### Execute no Supabase SQL Editor

```text
database/dashboard_active_records_views.sql
```

## 6. Como registros inativos são filtrados

- Dashboard e ranking consideram apenas:
  - `patients.status = 'active'`
  - `health_units.status = 'active'`
  - `professionals.status = 'active'`
  - `profiles.status = 'active'` quando `created_by` existe
- `Profissionais em destaque` não considera avaliações ligadas a pacientes ou unidades inativas.
- `Observações recentes` não exibe paciente, unidade ou usuário inativo.

## 7. Correção do erro SegmentViewNode / React Client Manifest

- Removida flag experimental desnecessária do `next.config.ts`.
- Mantida config estável com `devIndicators: false`.
- Adicionado fluxo de limpeza previsível com:
  - `npm run clean`
  - `npm run dev:fresh`
  - `npm run build:fresh`
- Criada pasta mínima `pages/` com `pages/.gitkeep` para evitar `ENOENT scandir ...\\pages` em tooling/devtools que tenta escanear esse diretório.

## 8. Correção do erro `__webpack_modules__[moduleId] is not a function`

- O projeto foi estabilizado com:
  - limpeza determinística de `.next`, `.turbo`, `.vercel/output` e `tsconfig.tsbuildinfo`
  - remoção de legado conflitante do Pages Router
  - manutenção dos gráficos em componentes client-only com `next/dynamic`
  - revisão dos imports dinâmicos de Recharts
- Isso reduz o risco de manifest/chunks inconsistentes entre rebuilds.

## 9. Correção do ENOENT da pasta pages

- Foi criada `pages/.gitkeep`.
- Não foram recriados `_app`, `_document` ou páginas legadas.
- Isso evita o erro de scanner sem reintroduzir conflito de rotas.

## 10. Versão do Next

- Mantida em `15.5.20`.
- Alinhadas as versões em `package.json`/`package-lock.json` para evitar drift.
- `react` e `react-dom` ficaram sincronizados com o lock atual.

## 11. Scripts adicionados/alterados

### `package.json`

- `dev`
- `dev:fresh`
- `build`
- `build:fresh`
- `start`
- `lint`
- `typecheck`
- `check`
- `clean`
- `rebuild`

### Scripts novos

- `scripts/clean.mjs`
- `scripts/ensure-build.mjs`

## 12. Resultado das validações

- `npm run lint` ✅
- `npx tsc --noEmit` ✅
- `npm run build` ✅
- `npm run build:fresh` ✅
- `npm run clean` ✅
- `npm run rebuild` ✅
- `npm audit` ⚠️ retornou 2 vulnerabilidades moderadas transitivas relacionadas a `postcss` via `next`; a correção sugerida pelo npm exige `npm audit fix --force` com downgrade/breaking change, então não foi aplicada.

## 13. Testes manuais realizados

- `npm run dev:fresh` ✅
- Acesso a `/login` em dev ✅ (`200`)
- Inicialização do dev server sem `ENOENT scandir ...\\pages` no teste executado ✅
- Inicialização do dev server sem erro `SegmentViewNode` no teste executado ✅
- Build de produção compilando `/painel` com sucesso ✅

### Limitação do ambiente

- Não foi possível validar manualmente o conteúdo autenticado de `/painel` no navegador com sessão real do usuário dentro do CLI.
- Mesmo assim:
  - o build compilou `/painel`
  - as queries foram reforçadas
  - as falhas por seção foram isoladas
  - o runtime dev subiu limpo no teste executado

## 14. Recomendações para desenvolvimento no Windows

- Sempre iniciar com:

```bash
npm run dev:fresh
```

- Para produção local:

```bash
npm run build:fresh
npm run start
```

- Fechar o terminal do `next dev` antes de substituir arquivos.
- Não extrair ZIP por cima de uma cópia antiga do projeto.
- Não copiar `.next` nem `node_modules` entre máquinas.
- Preferir caminho curto e sem sincronização em nuvem, por exemplo:

```text
C:\Projetos\AvaliaSaude
```
