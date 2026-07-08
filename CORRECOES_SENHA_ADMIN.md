# Correção: senha adicional para administradores

Alterações aplicadas nesta versão:

- Adicionado campo **Senha adicional para administrador** em `Cadastros > Usuários`.
- A senha adicional é exigida somente ao criar um novo usuário com perfil **Administrador**.
- Também é exigida ao promover um usuário existente para **Administrador**, impedindo o contorno pela edição de perfil.
- Operadores e perfis de leitura continuam podendo ser criados sem essa senha adicional.
- O administrador logado não pode remover o próprio acesso por acidente, evitando bloqueio do sistema.
- A senha é validada no servidor por `ADMIN_CREATION_PASSWORD`.
- Como compatibilidade, `ADMIN_PASSWORD` também funciona como fallback, mas o recomendado é usar `ADMIN_CREATION_PASSWORD`.

Variável necessária no `.env.local` ou na Vercel:

```env
ADMIN_CREATION_PASSWORD=SUA_SENHA_EXTRA
```

Se desejar que seja a mesma senha do administrador principal, configure essa variável com o mesmo valor da senha desse usuário, sem salvar a senha no código.
