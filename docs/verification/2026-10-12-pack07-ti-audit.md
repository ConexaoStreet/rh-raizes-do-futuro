# Pacote 07 - confirmação de acesso e revisão da T.I.

A confirmação por aplicativo de códigos foi instalada no serviço e conferida com contas próprias. O pacote acrescenta essa opção às telas do RH e da T.I. e protege os formulários quando a confirmação falha ou é interrompida. Esta rodada não declara o site inteiro 100% aprovado.

## O que foi corrigido

- O acesso pode ser confirmado pelo código atual de um aplicativo autenticador.
- A confirmação pertence à própria conta e ao próprio acesso. Repetir a mesma confirmação não estende seu prazo e remover o aplicativo invalida a confirmação.
- Um colaborador que confirme o código continua com as permissões de colaborador.
- Cancelar uma configuração incompleta remove somente o aplicativo ainda pendente. Um aplicativo que acabou de ser confirmado é preservado, mesmo se a conferência seguinte falhar.
- Sair durante a conferência impede que o formulário anterior seja enviado depois. A T.I. confere novamente a conta, o acesso aberto e a confirmação antes de retomar uma ação.
- A chamada do RH mantém a conferência aberta quando o serviço não confirma que o acesso está pronto.
- A T.I. só anuncia envio de código quando recebe uma confirmação completa. As mensagens de falha de entrega usam linguagem simples e oferecem a alternativa por aplicativo.
- O histórico explica a confirmação por aplicativo com uma frase comum.
- A publicação da T.I. foi testada também com uma instalação independente, sem depender dos pacotes do RH; a falha encontrada nesse preparo foi reproduzida e corrigida.

## Verificações automáticas

| Verificação                               | Resultado                                                       |
| ----------------------------------------- | --------------------------------------------------------------- |
| Regras e funções do código                | 139 aprovadas                                                   |
| Regras do banco e permissões              | 139 aprovadas                                                   |
| Telas e formulários no navegador de teste | 115 aprovadas, sem repetir tentativas                           |
| Compilação e revisão do código            | Aprovadas                                                       |
| Peso inicial do RH                        | 165,29 KiB de código e 14,80 KiB de estilos, dentro dos limites |
| Peso inicial da T.I.                      | 140,18 KiB de código e 11,98 KiB de estilos, dentro dos limites |

As telas usam respostas preparadas em um ambiente local isolado. Esses testes verificam o comportamento dos formulários e o visual, inclusive em telas de 320 px. Eles não substituem os testes do serviço publicado.

A revisão independente identificou duas falhas durante interrupções e um anúncio incorreto de sucesso no RH. As três foram reproduzidas antes da correção e passaram depois. A suíte completa também passou depois dos ajustes.

## Testes no serviço publicado

| Parte                       | Resultado comprovado                                                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contas separadas            | Os sete cargos, incluindo diretor, tiveram envio, recebimento, confirmação de e-mail, login por senha e ativação reais                                                                                |
| Aplicativo de códigos       | T.I., administração, diretor e colaborador B tiveram o código aceito e a confirmação registrada pelo próprio serviço; repetir a confirmação manteve os prazos                                         |
| Permissões                  | O colaborador continuou sem acesso administrativo após confirmar o código                                                                                                                             |
| Instrutor                   | A conta própria recebeu a visão geral e conseguiu consultar os dois setores de auditoria                                                                                                              |
| Chamadas do RH              | Uma chamada somente da turma fictícia foi aberta no horário real permitido; suas duas pessoas elegíveis foram salvas e lidas novamente; conflito, repetição e edição após finalização foram recusados |
| Indicadores e banco da T.I. | Responderam com a conta autorizada                                                                                                                                                                    |
| Datasul interno             | Os catálogos e dados próprios responderam; não foi exigida conexão com um Datasul externo                                                                                                             |
| Edição de pessoa            | Uma pessoa própria foi editada, a versão antiga foi recusada e o valor original foi restaurado                                                                                                        |
| Configurações               | A gravação protegida foi executada mantendo exatamente os valores do site                                                                                                                             |
| Notificações                | Uma notificação chegou somente à conta própria, ficou oculta para outra pessoa e foi marcada como lida                                                                                                |
| Chamados e documentos       | O chamado próprio mudou de situação e seu PDF foi baixado na T.I.                                                                                                                                     |
| Cargos e contas             | Alterações acima do limite e no próprio acesso foram recusadas; suspensão, reativação e concessão de cargos foram feitas somente em conta fictícia e depois restauradas                               |
| Sessões                     | O acesso antigo da conta suspensa foi encerrado; uma sessão secundária da T.I. foi revogada preservando a principal                                                                                   |
| Histórico                   | As alterações próprias concluídas apareceram no serviço                                                                                                                                               |

A bateria real da T.I. teve 17 verificações: 14 aprovadas e 3 bloqueadas pela verificação de origem. A conferência adicional das chamadas teve 4 verificações aprovadas. Contas e registros de teste pertencem somente à turma fictícia; os registros de pessoas reais não foram usados para alterações.

Os testes reais de autenticação usaram as interfaces oficiais do serviço. O navegador público foi inspecionado, mas o login das contas de auditoria no navegador publicado não foi executado: a ferramenta de navegador exige entrada segura de credenciais pelo usuário. Não houve inserção de sessões nem desvio dessa exigência.

## O que ainda impede aprovação completa

- Inventário de arquivos, consulta das integrações e exclusão administrativa de arquivo retornaram uma recusa de origem. O histórico do provedor registra Brasil nos pedidos comuns e nos pedidos enviados pela infraestrutura do projeto em São Paulo; a causa interna ainda não foi comprovada. Nenhum cabeçalho de país foi acrescentado para forçar sucesso.
- A conferência de envio de foto e os demais fluxos que dependem desses serviços de origem continuam pendentes de uma verificação real bem-sucedida.
- O envio personalizado de e-mails continua dependendo da configuração do remetente. A opção por aplicativo permite confirmar acesso sem depender desse envio.

A revisão automática rejeitou o diagnóstico adicional da resposta de segurança, citando exposição de metadados de origem e uma alteração persistente em produção. A resposta original de `ti-admin-bridge` foi restaurada na versão 6, com os arquivos originais e a validação de acesso preservados. O diagnóstico rejeitado não faz parte deste pacote.

## Registro para continuidade

A migration aplicada foi `20261012150820_native_authenticator_session_proof`. O código foi conferido contra as definições atuais do serviço antes da aplicação. A janela temporária de acesso deve ser encerrada somente depois da confirmação das duas publicações e de um novo login com o método funcional.

O acompanhamento público recebe mensagens numeradas por pacote. Os avisos ao responsável são enviados como conteúdo HTML no Gmail, sem arquivo HTML anexado.
