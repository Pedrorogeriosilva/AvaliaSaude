Correções aplicadas

- Mensagens técnicas do Supabase/Postgres deixaram de aparecer diretamente para o usuário.
- Erros de constraint, RLS, permissão, duplicidade, CPF inválido, e-mail duplicado, UUID inválido e campos obrigatórios agora são traduzidos para mensagens simples.
- Validação de CPF adicionada antes de enviar paciente ao banco.
- Telas que exibem `params.error` agora passam por sanitização centralizada.
- Fluxo de avaliação também sanitiza erros vindos do Supabase antes de exibir ao usuário.
- Mensagens globais de erro continuam genéricas e sem detalhes técnicos.

Validação executada:
- npm run lint
- npx tsc --noEmit
- npm run build
