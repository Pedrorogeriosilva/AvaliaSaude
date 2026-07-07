# Notas da versão inicial

Esta versão é uma base funcional para o projeto Avalia Saúde.

## Entrega atual

- Sistema com estrutura visual pronta.
- Autenticação com Supabase Auth.
- Rotas protegidas.
- CRUD inicial com criação, busca, listagem e ativação/inativação.
- Registro de avaliação com notas gerais e notas por profissional.
- Painel e ranking consumindo views do banco.

## Limitações conscientes desta primeira versão

- Ainda não há tela de edição completa dos registros.
- O cadastro de usuários ainda depende do Supabase Auth e ajuste de perfil via SQL.
- A revisão antes de salvar a avaliação usa confirmação simples do navegador.
- Os filtros avançados de período/unidade ainda serão implementados.
- A geração de relatórios PDF/Excel ainda não está incluída.

## Próxima etapa sugerida

Implementar edição de registros e filtros avançados no painel.
