# Correções aplicadas nesta versão

## Performance de navegação

- Removido o pré-carregamento automático de todas as rotas do menu, que podia disparar várias consultas ao Supabase em segundo plano e deixar a troca de páginas pesada.
- Mantido pré-carregamento apenas por interação, ao passar o mouse ou focar um item do menu.
- Criado `lib/app-data.ts` para centralizar consultas de painel, ranking e dados do formulário de avaliação.
- Quando `SUPABASE_SERVICE_ROLE_KEY` está configurada no servidor, painel, ranking e dados base do formulário usam cache curto de servidor com revalidação automática.
- Após salvar avaliação, cadastrar paciente, unidade ou profissional, o sistema limpa os caches relacionados para manter a dashboard atualizada.

## Observações das avaliações

- O Painel agora mostra a seção “Observações recentes das avaliações”.
- A seção exibe tipo de manifestação, data, nota, unidade, paciente e o texto da observação preenchida no formulário.
- Falha ao carregar observações não quebra mais a dashboard inteira.

## Usuários do sistema

- A tela `Cadastros > Usuários` agora permite editar nome, e-mail, senha, perfil e status.
- Administradores podem excluir usuários cadastrados pelo próprio site.
- A exclusão remove o usuário do Supabase Auth e também limpa o perfil correspondente.
- O administrador logado não consegue excluir a própria conta nem remover o próprio acesso.
- Criar, promover ou excluir administradores continua exigindo `ADMIN_CREATION_PASSWORD`.

## Validação

Executado com sucesso:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Atualização complementar

- A página **Cadastros > Usuários do sistema** agora solicita a senha adicional antes de exibir a lista e os formulários de administradores, operadores e leitores.
- O desbloqueio da página de usuários é temporário e fica restrito ao navegador atual.
- A senha adicional continua sendo exigida para criar, promover ou excluir administradores.
- Pacientes, unidades de saúde e profissionais agora podem ser editados diretamente nas páginas de cadastro.
- Pacientes, unidades de saúde e profissionais também podem ser excluídos definitivamente por administrador.
- Ao excluir paciente, as avaliações vinculadas também são removidas para evitar bloqueio por relacionamento no banco.
- Ao excluir unidade, profissionais e avaliações vinculadas também são removidos.
- Ao excluir profissional, as notas individuais vinculadas a ele também são removidas.
