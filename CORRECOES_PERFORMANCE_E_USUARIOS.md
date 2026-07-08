# Correções aplicadas nesta versão

## Performance de navegação

- Reativei o prefetch das rotas principais e criei `components/layout/main-nav.tsx`.
- O menu agora pré-carrega Painel, Avalie, Ranking e Cadastros em segundo plano depois que a tela estabiliza.
- Removi a chamada de autenticação completa do middleware em toda troca de página. Agora o middleware faz uma checagem leve do cookie e a validação real continua no layout protegido.
- `getCurrentProfile` passou a usar a sessão existente e consultar apenas o perfil ativo necessário, reduzindo chamadas extras ao Supabase.
- O painel passou a limitar dados mais pesados de gráfico/listagem para reduzir tempo de carregamento inicial.
- Mantive tratamento de erro e loading para evitar tela quebrada durante carregamento.

## Usuários administradores pelo site

- Adicionado cliente administrativo seguro em `lib/supabase/admin.ts`.
- Adicionada criação de usuários em `Cadastros > Usuários`.
- Administradores podem criar usuários com perfil `admin`, `operator` ou `viewer`.
- Administradores podem alterar perfil e status dos usuários existentes.
- Para funcionar em produção, configure `SUPABASE_SERVICE_ROLE_KEY` nas variáveis de ambiente do servidor/Vercel.
- A service role não é exposta no frontend.

## Paciente criado durante a avaliação

- A tela `Avalie` agora permite cadastrar o paciente diretamente durante o preenchimento da avaliação.
- O paciente criado ali é salvo automaticamente na tabela `patients` e aparece depois no cadastro/histórico de pacientes.
- Também é possível vincular a avaliação a um paciente já cadastrado.
- Quando CPF é informado e já existe, o sistema reaproveita o paciente existente para evitar duplicidade.

## Banco e dashboard

- Mantidas as consultas pelas tabelas/views do schema existente.
- Mantido tratamento amigável de 401/403/500 para não quebrar a interface.
- Revisadas as queries principais de Painel, Avalie, Ranking e Cadastros.

## Validação local

Executado com sucesso:

```bash
npm run lint
npx tsc --noEmit
```

O `npm run build` compila e passa pela checagem de tipos, mas neste sandbox permanece travado na etapa final `Collecting build traces`, comportamento que já acontecia na versão anterior neste ambiente. Recomendo validar o build final na sua máquina/Vercel após configurar as variáveis do Supabase.
