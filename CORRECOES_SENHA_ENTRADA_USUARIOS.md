# Correção aplicada: senha somente na entrada da gestão de usuários

A tela **Cadastros > Usuários do sistema** agora pede a senha adicional apenas antes de abrir a página protegida.

Alterações:

- Removido o campo **Senha adicional para administrador** do formulário de criação de usuários.
- Removido o campo de senha adicional das ações de edição e exclusão de usuários.
- A criação, edição, promoção, rebaixamento, alteração de senha, inativação e exclusão de administradores, operadores e leitores passam a depender do acesso previamente liberado na entrada da página.
- As server actions agora validam também o cookie seguro de liberação da página, evitando execução direta sem ter passado pela senha de entrada.
- A senha adicional continua vindo da variável `ADMIN_CREATION_PASSWORD` no servidor/Vercel.

Variáveis necessárias:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_CREATION_PASSWORD=
```
