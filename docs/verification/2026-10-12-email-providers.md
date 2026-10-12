# Pacote 05: e-mail de qualquer provedor

O primeiro acesso do RH deve aceitar um endereço válido de qualquer provedor, confirmar o endereço no serviço de autenticação e aplicar exclusivamente o cargo, setor e turma autorizados no pré-cadastro.

## Alterações

- Retirada a regra exclusiva de Gmail dos dois passos do primeiro acesso e da ativação de gestores. O formato do endereço continua validado; não há lista de provedores permitidos.
- A função de ativação de gestores usa a mesma validação do navegador. Convite, limitação de tentativas, origem permitida, senha forte e segunda etapa de segurança foram preservados.
- A nova migration mantém a definição real da conclusão do perfil em produção, que já usava cargo, setor e turma do pré-cadastro. A confirmação Auth continua obrigatória. A seleção do identificador do pré-cadastro deixou de usar `min(uuid)`, e o nome mostrado da turma corresponde à turma efetivamente vinculada.
- Campos, orientações e mensagem de confirmação usam “e-mail”. O envio dos templates ao Supabase passa a ocorrer automaticamente quando esses arquivos mudam na branch principal.
- O pacote tem cinco descrições em linguagem simples para o histórico público.

## Evidências antes da publicação do frontend

| Verificação | Resultado |
| --- | --- |
| Vitest completo | 108 testes aprovados em 27 arquivos |
| Banco completo | 121 verificações aprovadas; 10 novas verificam ativação e proteções de acesso |
| Navegador local | 100 cenários existentes aprovados; os 4 novos passaram após corrigir um seletor do próprio teste |
| Cadastro no navegador local | Outlook, domínio de empresa com alias e caixa temporária seguem até a solicitação de confirmação |
| Endereço inválido e senhas divergentes | Recusados, sem pedido de criação da conta |
| Banco: colaborador, gestor, instrutor e diretor | Ativam com outros provedores; dados submetidos não promovem a conta nem trocam seu setor e turma |
| Banco: confirmação, termos, pré-cadastro e revogação | Recusas mantidas; contas recusadas não recebem cargo nem vínculo |
| Senha, templates e observabilidade | Verificações de configuração aprovadas |
| Compilação da função de gestores | Deno 2.9.6, `--node-modules-dir=manual --no-lock`, aprovado |
| Compilação, privacidade e dependências | RH e TI compilados; lint e privacidade aprovados; npm sem vulnerabilidades |
| Tamanho inicial RH | JS 163,43 e CSS 14,80 KiB gzip; limites 200 e 16 |
| Tamanho inicial TI | JS 137,88 e CSS 11,98 KiB gzip; limites 150 e 12 |

A função `manager-activation` foi publicada como versão 8, incluindo o módulo compartilhado. A mudança de conclusão do perfil foi aplicada no Supabase e conferida: sem exigência de Gmail, com confirmação obrigatória e nome da turma preservado. A aplicação inicial do corpo completo recebeu erro `Invalid or expired requestState`; uma migration direcionada, que valida a definição atual e modifica somente os trechos revisados, foi aplicada com sucesso. Não foram alterados os dados normais do RH.

## Uso real com caixa temporária privada

A conta de auditoria Colaborador A tinha confirmado o endereço fora do Gmail pelo link real recebido anteriormente. Após a alteração, uma nova entrada com a senha real retornou sucesso. O registro de entrada foi salvo, a conclusão do perfil retornou sucesso e uma nova consulta mostrou a conta pronta, ativa, com somente `COLLABORATOR`, seu setor de auditoria e a turma correta. A tentativa de enviar `SUPER_ADMIN` no formulário não concedeu esse cargo. Credenciais e tokens ficam fora do repositório e dos relatórios.

Este registro distingue o uso real do serviço e do banco dos cenários locais com respostas de teste. Os fluxos autenticados completos de todos os módulos no navegador publicado continuam no roteiro da auditoria de RH; estes resultados não declaram todo o site aprovado. A revisão independente não identificou problemas concretos no pacote. A liberação final depende dos checks do PR e da conferência do frontend publicado.
