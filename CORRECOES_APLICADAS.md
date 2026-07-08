# Correções aplicadas nesta versão

## Erros corrigidos

- Corrigido o fluxo de login/logout para não capturar indevidamente o `redirect()` do Next.js.
- Corrigido o salvamento de avaliações, que podia cair em erro mesmo após salvar com sucesso.
- Melhorado o tratamento de erros do Supabase para evitar tela 500 em consultas comuns.
- Adicionado tratamento específico para erros 401/403, RLS e permissões insuficientes.
- O layout protegido agora valida o perfil na tabela `profiles` e bloqueia usuários inativos ou sem perfil configurado.
- Adicionado SQL de correção rápida de permissões em `database/corrigir_permissoes_e_admin.sql`.
- Adicionados grants explícitos no schema para reduzir problemas de 401/403 na API do Supabase.

## Performance

- Rotas protegidas marcadas como dinâmicas e sem cache indevido.
- Menu principal com `prefetch={false}` para evitar erro de chunk e carregamento desnecessário.
- Layout global simplificado, sem ícones pesados no header.
- Consultas independentes agrupadas com `Promise.all`.
- Tabelas continuam paginadas.
- Gráficos permanecem carregados de forma dinâmica no cliente.
- Timeout de carregamento de chunk aumentado no `next.config.ts`.

## Visual

- Header mais limpo e institucional.
- Cards, tabelas, botões e estados vazios refinados para visual branco, sóbrio e governamental.
- Logo nova mantida em `public/brand` e aplicada pelo componente `SiteLogo`.
- Favicon institucional mantido.

## Validação local realizada

- `npm run lint`: executado sem erros.
- `npx tsc --noEmit`: executado sem erros.
- `npm run dev`: login respondeu 200 e rota protegida redirecionou corretamente quando o Supabase não estava configurado.
- `npm run build`: compilação, lint e verificação de tipos passaram; neste sandbox o processo ficou preso em `Collecting build traces`, comportamento do ambiente/Next, mesmo gerando `.next`. Recomendo rodar o build novamente no seu ambiente local/Vercel.

## Importante para o Supabase

Se ainda aparecer 401/403 no painel depois de subir esta versão, execute no SQL Editor:

```sql
-- ajuste o e-mail antes de executar
-- arquivo: database/corrigir_permissoes_e_admin.sql
```

Troque `admin@seudominio.com` pelo e-mail real do administrador criado em Authentication > Users.
