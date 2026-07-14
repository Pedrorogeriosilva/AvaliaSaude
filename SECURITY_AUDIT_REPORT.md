# Security Audit Report

## 1. Resumo executivo

Foi realizada uma auditoria de segurança no projeto `Avalia Saúde`, cobrindo autenticação, autorização, Server Actions, middleware, tratamento de erros, exposição de dados sensíveis, uso de `service role`, headers HTTP e hardening de RLS no Supabase.

O foco foi impedir bypass de permissão, reduzir exposição de CPF, endurecer a área de gestão de usuários e garantir que falhas do Supabase não vazem detalhes técnicos para o usuário final.

## 2. Principais riscos encontrados

- Decisões críticas ainda podiam depender de sessão local em vez de validação forte com `getUser()`.
- A rota `app/api/patients/search/route.ts` não fazia checagem explícita de role.
- Dados de pacientes apareciam além do necessário no fluxo de avaliação e no painel.
- A área de usuários precisava de reforço adicional e documentação clara do gate temporário.
- Algumas telas ainda exibiam UI de escrita para perfis sem permissão.
- Faltava um script dedicado para reforçar RLS, grants e views no banco.

## 3. Correções aplicadas

- `lib/auth.ts`
  - `getCurrentProfile()` usa `supabase.auth.getUser()`.
  - Helpers centralizados de permissão.

- `lib/admin-gate.ts`
  - Gate HMAC assinado.
  - Cookie `httpOnly`, `sameSite='strict'`, `secure` em produção, escopo curto e expiração curta.
  - Gate vinculado ao `profile.id`.
  - Cooldown para tentativas inválidas.

- `app/login/actions.ts`
  - Login validado com e-mail normalizado.
  - Usuário sem profile ativo/role válida é removido da sessão.
  - Logout limpa o gate administrativo.

- `app/(app)/avalie/actions.ts`
  - Permissão server-side obrigatória.
  - Validação de UUID, enums, datas, notas e profissionais da unidade.
  - Erros sanitizados.

- `app/(app)/cadastros/actions.ts`
  - Ações críticas protegidas por helpers server-side.
  - Validação de nome, CPF, e-mail, role, status, datas e IDs.
  - Autoexclusão e auto-remoção de acesso admin bloqueadas.
  - Rollback do Auth ao falhar criação do `profile`.

- `app/api/patients/search/route.ts`
  - Busca protegida por `assertCanCreateEvaluation()`.
  - Query normalizada e limitada.
  - Falha responde com lista vazia e `403`.

- `lib/app-data.ts`
  - Marcado como `server-only`.
  - CPF mascarado nos dados do formulário de avaliação.
  - Nome de paciente ofuscado nas observações recentes do painel.

- `app/(app)/avalie/page.tsx`
  - `viewer` não entra no fluxo de criação de avaliação.

- `app/(app)/cadastros/page.tsx`
  - Card de usuários visível apenas para admin.

- `app/(app)/cadastros/pacientes/page.tsx`
  - UI de escrita oculta para quem não pode editar.
  - CPF mascarado na listagem resumida.

- `app/(app)/cadastros/profissionais/page.tsx`
  - Criação, edição e exclusão visíveis só para admin.

- `app/(app)/cadastros/unidades/page.tsx`
  - Criação, edição e exclusão visíveis só para admin.

- `components/forms/evaluation-form.tsx`
  - Limites básicos no client para reduzir abuso.
  - `general_notes` limitado a 2000 caracteres.

- `app/layout.tsx`
  - `robots: { index: false, follow: false }`.

- `pages/_document.tsx`
  - Adicionado `_document` mínimo para estabilizar o build no ambiente atual.

## 4. Arquivos alterados

- `.env.example`
- `.gitignore`
- `README.md`
- `SECURITY_AUDIT_REPORT.md`
- `database/security_hardening.sql`
- `app/layout.tsx`
- `app/(app)/layout.tsx`
- `app/api/patients/search/route.ts`
- `app/(app)/avalie/page.tsx`
- `app/(app)/cadastros/page.tsx`
- `app/(app)/cadastros/pacientes/page.tsx`
- `app/(app)/cadastros/profissionais/page.tsx`
- `app/(app)/cadastros/unidades/page.tsx`
- `app/(app)/cadastros/usuarios/page.tsx`
- `app/(app)/cadastros/actions.ts`
- `components/layout/main-nav.tsx`
- `components/forms/evaluation-form.tsx`
- `lib/admin-gate.ts`
- `lib/app-data.ts`
- `lib/auth.ts`
- `lib/format.ts`
- `lib/supabase/admin.ts`
- `lib/supabase/server.ts`
- `pages/_document.tsx`

## 5. Regras de permissão finais

- `admin`
  - Visualiza tudo.
  - Cria, edita e exclui pacientes.
  - Cria, edita e exclui profissionais.
  - Cria, edita e exclui unidades.
  - Cria avaliações.
  - Gerencia usuários após liberar o gate adicional.

- `operator`
  - Visualiza módulos liberados.
  - Cria avaliações.
  - Cria e edita pacientes.
  - Não acessa gestão de usuários.
  - Não cria/edita/exclui unidades e profissionais.
  - Não executa exclusões admin-only.

- `viewer`
  - Apenas leitura.
  - Não cria avaliações.
  - Não cria, edita ou exclui registros.

## 6. Como funciona o gate da gestão de usuários

- Exige perfil `admin`.
- Exige senha adicional validada no servidor.
- Libera cookie assinado e temporário.
- O cookie fica vinculado ao `profile.id`.
- Troca de usuário invalida o gate.
- Tentativas inválidas entram em cooldown.
- Logout remove o gate.

## 7. Onde o service role é usado

- `lib/supabase/admin.ts`
- `app/(app)/cadastros/actions.ts`
- `app/(app)/cadastros/usuarios/page.tsx`
- `scripts/create-admin-user.mjs`

Sempre somente no servidor.

## 8. Como os erros são sanitizados

- `lib/supabase/errors.ts` traduz erros técnicos para mensagens amigáveis.
- Actions fazem redirect apenas com mensagens sanitizadas.
- Error boundaries não exibem stack trace.
- A rota protegida de pacientes não devolve detalhes internos do banco.

## 9. Headers de segurança adicionados/revisados

- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`
- `Strict-Transport-Security` em produção

## 10. Policies RLS revisadas

- `profiles`
- `patients`
- `health_units`
- `professionals`
- `evaluations`
- `evaluation_professionals`

O arquivo `database/security_hardening.sql` reforça:

- `force row level security`
- recriação idempotente de policies
- grants mínimos
- `security_invoker` nas views quando suportado

## 11. SQLs que precisam ser executados no Supabase

1. `database/schema.sql`
2. `database/security_hardening.sql`
3. `database/corrigir_permissoes_e_admin.sql` apenas se necessário para o primeiro admin

## 12. Testes manuais executados / pendentes

- Validação automatizada concluída com `lint`, `tsc` e `build`.
- Os cenários manuais de login, logout, viewer/operator/admin e salvamento de avaliação ainda devem ser confirmados no navegador com credenciais reais.

## 13. Resultado dos comandos

- `npm run lint`: ok
- `npx tsc --noEmit`: ok
- `npm run build`: ok
- `npm audit`: 2 vulnerabilidades moderadas em `postcss` transitivo via `next`; `npm audit fix --force` sugeriria mudança breaking e não foi aplicado
- `npm outdated`: consultado; há updates disponíveis, mas sem aplicação automática nesta auditoria

## 14. Pendências e recomendações futuras

- Implementar rate limit distribuído para ações críticas em produção.
- Considerar trilha de auditoria administrativa em tabela própria.
- Validar no navegador todos os cenários reais com perfis `admin`, `operator` e `viewer`.

## 15. Orientações para deploy seguro na Vercel

- Configurar `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_CREATION_PASSWORD` e `ADMIN_GATE_SECRET` apenas como secrets server-side.
- Não expor `.env.local`.
- Rodar `database/security_hardening.sql` antes do deploy final.
- Validar headers e CSP em produção.
- Confirmar que usuários inativos e perfis inválidos ficam bloqueados após login.
