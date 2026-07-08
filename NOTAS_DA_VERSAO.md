# Notas da versão

Esta versão foi revisada para melhorar estabilidade, navegação, visual institucional e integração com Supabase.

## Principais ajustes

- Logo nova aplicada em `public/brand`.
- Header mais limpo, com navegação sem prefetch para reduzir erro de chunk em ambiente local.
- Tratamento de erro aprimorado nas páginas protegidas.
- Login e logout corrigidos.
- Salvamento de avaliação corrigido.
- Validação de perfil ativo pela tabela `profiles`.
- SQL adicional para corrigir permissões 401/403 no Supabase.
- Cards, tabelas e formulários ajustados para visual mais clean.

## Arquivos importantes

- `database/schema.sql`: schema principal atualizado.
- `database/configurar_admin.sql`: configura o primeiro administrador.
- `database/corrigir_permissoes_e_admin.sql`: correção rápida para 401/403 e perfil admin.
- `CORRECOES_APLICADAS.md`: resumo técnico do que foi alterado.

## Validação

Foram executados com sucesso:

```bash
npm run lint
npx tsc --noEmit
```

Também foi validado que o login abre corretamente em ambiente local e que rotas protegidas redirecionam para o login quando o Supabase não está configurado.
