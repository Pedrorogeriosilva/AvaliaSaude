Atualizações aplicadas nesta versão

1. Logo atualizada
- Removido o subtítulo "Porto Alegre do Norte" da marca horizontal.
- Arquivos públicos de logo substituídos em /public e /public/brand.

2. Dashboard
- Corrigido o gráfico de barras do painel.
- As barras agora usam cor azul institucional.
- O valor da nota aparece visível no gráfico, sem depender apenas do hover.
- Ajustado o layout do gráfico para leitura mais clara das unidades.

3. Cadastros mais compactos
- Pacientes, profissionais, unidades e usuários agora usam cards recolhidos.
- As opções de editar, inativar e excluir ficam dentro de um botão/área expansível.
- Isso reduz a poluição visual da tela de cadastros.

4. Revisão do formulário de avaliação
- Removido o alert nativo do navegador para confirmação.
- Ao clicar em "Revisar avaliação", os dados preenchidos aparecem na tela.
- O envio só acontece após clicar em "Confirmar e enviar avaliação".

Validação executada
- npm run lint
- npx tsc --noEmit
- npm run build
