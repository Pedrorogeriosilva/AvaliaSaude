Mapeamento completo de erros aplicado

1. Centralização das mensagens
- Criado mapeamento ampliado em lib/supabase/errors.ts.
- Todas as mensagens vindas por query string (?error=) passam pelo mapeador antes de aparecer na tela.
- As actions de cadastro e avaliação passam erros técnicos pelo mapeador antes do redirect.

2. Erros tratados com mensagens amigáveis
- CPF inválido.
- CPF duplicado.
- E-mail duplicado.
- Campos obrigatórios ausentes.
- Campos com tamanho mínimo inválido.
- Notas fora do intervalo permitido.
- Tempo de espera negativo.
- Data de atendimento futura.
- Data inválida.
- Tipo de contato inválido.
- Resolução inválida.
- Tipo de manifestação inválido.
- Tipo de unidade inválido.
- Status inválido.
- Registro não encontrado.
- UUID ou seleção inválida.
- Vínculos existentes impedindo alteração/exclusão.
- Falta de permissão, RLS, 401 e 403.
- Sessão expirada ou token inválido.
- Service role ausente.
- Variáveis do Supabase ausentes.
- Tabela, coluna, função, view ou schema ausente/desatualizado.
- Erro de schema cache do Supabase.
- Erro de rede, timeout ou falha de conexão.
- Rate limit ou muitas tentativas.
- Senha fraca/curta.
- E-mail inválido.
- Usuário não encontrado.

3. Validações preventivas antes do banco
- CPF validado antes de salvar paciente.
- Formulário de avaliação valida data, opções, notas, tempo de espera e notas individuais antes de enviar ao Supabase.

4. Páginas de erro
- Removidos detalhes técnicos e digest das error boundaries.
- Falhas inesperadas mostram mensagem institucional simples.

Validação executada:
- npm run lint
- npx tsc --noEmit
- npm run build
