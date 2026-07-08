# Correções de acesso e exclusão definitiva

Esta versão adiciona uma confirmação extra antes de abrir a página de usuários do sistema e completa as permissões de edição/exclusão nos cadastros operacionais.

## Usuários do sistema

A rota `Cadastros > Usuários do sistema` agora exige a variável `ADMIN_CREATION_PASSWORD` antes de exibir a página.

Fluxo aplicado:

1. O administrador clica em `Usuários do sistema`.
2. O sistema solicita a senha adicional.
3. Após validação, a página é liberada temporariamente neste navegador.
4. Para criar, promover ou excluir administradores, a senha adicional continua sendo exigida na ação.

## Cadastros operacionais

Foram adicionadas ações para editar e excluir definitivamente:

- Pacientes
- Unidades de saúde
- Profissionais
- Administradores
- Operadores
- Leitores

## Exclusões com vínculos

Para evitar erro de chave estrangeira no Supabase:

- Ao excluir paciente, são removidas também as avaliações vinculadas.
- Ao excluir unidade de saúde, são removidos os profissionais e avaliações vinculadas.
- Ao excluir profissional, são removidas as notas individuais vinculadas a ele.

A exclusão definitiva fica restrita a administradores e usa `SUPABASE_SERVICE_ROLE_KEY` no servidor.
