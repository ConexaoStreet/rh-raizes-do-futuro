# Ledger - plan: docs/superpowers/plans/2026-10-12-native-authenticator.md

Base: afa5780, feature branch feat/native-authenticator-pack07-20261012, worktree isolada.

Autorização: o usuário pediu todas as correções, testes e publicação e continuidade imediata para T.I.; não solicitar novamente aprovação de escolhas normais de implementação. Execução pelo agente principal, com revisão independente antes da publicação.

Pre-flight: Task 1 produz confirm_authenticator_session e Task 2 consome exatamente esse nome, sem parâmetros. Task 2 onDone utiliza os callbacks existentes que conferem ready/recently_verified. Task 3 aplica o mesmo protocolo em contas próprias e encerra a janela apenas após publicar ambas as telas.

Task 0: viabilidade real aprovada - enroll/challengeAndVerify 200, aal2, métodos password/totp, mesmo usuário e sessão; segundo código atualizou timestamp e auth.mfa_amr_claims.updated_at. Nenhum registro de confirmação do aplicativo foi escrito nesse probe.

Ruling: registrar a identidade de fator nativo e invalidar a prova ao removê-lo; limpar vínculo na verificação por e-mail - evita uma prova sobreviver à remoção do fator e preserva o método antigo - custo se errado: exigir nova conferência indevidamente.

Ruling: usar as definições remotas atuais de account_ready/bootstrap e preservar a janela no rollout; harness local fecha a janela por padrão e testa exceção explicitamente - a produção contém comportamento ausente do código anterior - custo se errado: diferença de acesso entre instâncias, por isso testar ambos os estados.

Baseline: npm test no novo workspace, 118 testes esperados; confirmar saída antes de Task 1.

Task 1 GREEN: RED 42883, RPC ausente; 18 testes de prova nativa passaram após implementação. Banco completo: 139 verificações (46 RH, 25 T.I./suporte, 6 manutenção, 17 chat/setores, 7 versão, 10 publicações, 10 onboarding, 18 MFA). Atividades: novo teste RED com texto genérico, depois 11/11 GREEN. Harness fecha janela por padrão; exceção é testada. Nenhuma migration aplicada ao serviço ainda.

Task 2 RED: teste de controller acusa módulo ausente. Dois novos cadastros próprios (T.I. e administração) tiveram envio/recebimento, confirmação e login por senha reais; cargos elevados concedidos só aos registros da turma de auditoria.

Task 2 GREEN: controller 12/12, interfaces focadas 6/6 com RED do botão inexistente e de resposta sem destinatário. QR local codificado, configuração explícita, descarte apenas de fator pendente, fator confirmado preservado, cancelamento bloqueado durante conferência, RPC recusada não retoma formulário. MFA_CHALLENGE_VERIFIED não chama bootstrap intermediário. npm run verify: lint/privacidade, 131 testes unitários, 139 de banco, build e orçamento RH passaram; T.I. build e orçamento passaram (139,91 KiB JS, 11,98 KiB CSS). Revisão React aplicada sem avisos.

Task 2 Ruling: exigir destinatário válido também na T.I. e explicar erros de entrega antes de oferecer aplicativo - reproduzida a falha de HTTP 200 incompleto - custo se errado: manter a conferência aberta até resposta completa.

Task 3 em andamento: primeira execução completa de interface foi interrompida após 7 casos sem resumo final; isso não conta como aprovação. Nova execução com dois trabalhadores para obter resultado completo e reduzir concorrência no ambiente. Revisão independente ocorrerá antes da migration e da publicação.

Task 3: suíte completa anterior à revisão terminou com 113/113 interfaces. Revisão independente afa5780..9100283 encontrou duas corridas importantes e uma indicação de sucesso incorreta do RH.

Final: fixed descarte durante verificação - teste de promises controladas RED (unenroll chamado) e GREEN, aceita nativa preservada mesmo com RPC recusada; controller aguarda operação em voo e mantém conjunto de fatores aceitos.

Final: fixed ação retomada após desmontagem - teste de saída em outra aba durante bootstrap RED (duas requisições de alteração) e GREEN (somente tentativa original); isCurrent chega ao callback e é conferido após cada espera, junto com usuário e session_id originais. Identidade da sessão: 7 testes GREEN; controller: 13 GREEN.

Final: fixed confirmação RH sem ready/recently_verified - teste RED (tela fechada) e GREEN (erro humano e conferência mantida), verificação explícita antes de refresh/fechamento/telemetria. Reclassificação Important: o anúncio incorreto atrapalha a conferência do acesso, embora não ignore permissão do banco. Quatro fluxos focados de interface GREEN após a passagem.

Final Ruling: teste anterior completo não cobre intercalações assíncronas; efetuar nova suíte após os três ajustes - as falhas foram reproduzidas antes das correções - custo se errado: uma ação antiga ou anúncio indevido sobreviver à saída. Declined to judge do revisor: implantação, serviço real e visual ainda serão conferidos na Task 3, sem inferir aprovação pelos testes locais.

Final fix pass GREEN: npm run verify passou com 139/139 unitários e 139 de banco, build RH/orçamentos (165,29 KiB JS; 14,80 CSS); suite completa Playwright 115/115 em 1,8 minuto, dois trabalhadores, sem retentativa. O revisor aprovou a vinculação da RPC e a ausência de ampliação de permissões; as três falhas de UI foram cobertas por RED/GREEN. Não há minor adiado nesta revisão.

Rollout banco: apply_migration retornou success=true, versão real 20261012150820. O arquivo criado via CLI foi renomeado para a versão efetivamente aplicada; conteúdo SHA256 db2636a9beebba5164ee3e0c1b70d8911a6517031c847a3043e7b345c0d40ba8 permanece igual. Nenhuma definição remota havia mudado no preflight. T.I. final build/orçamento 140,18 KiB JS, 11,98 KiB CSS.

RH real adicional: chamada da turma fictícia foi aberta no horário normal real, presenças elegíveis (2, não os 7 cargos administrativos) salvas/lidas, conflito rejeitado, finalização persistida e repetição/edição posterior recusadas; quatro checks passaram. Calendário dessa turma foi restaurado. A primeira tentativa errou a expectativa do driver de auditoria; a consulta de elegibilidade confirmou que o snapshot do site estava correto.

Task 3 real: Native MFA aceito em T.I., SUPER_ADMIN e colaborador B; RPC real criou a prova, repetição manteve prazos, colaborador permaneceu sem acesso de T.I. Novo cadastro INSTRUCTOR confirmou e ativou; DIRECTOR recebeu limite real de envio em duas tentativas, nenhuma confirmação artificial.

T.I. real: indicadores, banco, catálogos internos, pessoa/versionamento, configuração com valores preservados, notificação só própria/leitura, chamado/PDF, limites de cargo, suspensão/reativação, mudança/restauração de cargos e revogação de sessão passaram. Inventory/platform/storage_delete retornam REGION_NOT_ALLOWED. Consulta dos logs confirma country e forwarded_country BR em cliente node e pg_net da região sa-east-1; não foi adicionado cabeçalho de país pelo cliente. Causa interna ainda não comprovada.

Blocker de aprovação automática: o diagnóstico temporário da resposta de ti-admin-bridge foi rejeitado no passo seguinte, por mudança da resposta de segurança e exposição de metadados de origem. O deploy havia retornado ACTIVE v5; restaurar os arquivos de v4 e verificar antes de finalizar. Não contornar a rejeição com método equivalente. Proceder nas partes independentes.

Restauracao verificada: ti-admin-bridge v6 tem todos os arquivos exatamente iguais aos de v4 e verify_jwt=true; nenhum origin_check permaneceu. O hash do bundle não é usado como prova de identidade entre versões; os conteúdos dos arquivos foram comparados. T.I. real fechada com 17 checks: 14 pass, 3 REGION_NOT_ALLOWED. Instructor novo confirmou visão geral dos dois setores. Diretor novamente recebeu limite real; cadastro segue pendente.

Ruling de integração: o usuário já autorizou publicar e continuar autonomamente, então executar criação de PR, checks e merge na main sem repetir o menu de permissão da skill de finalização. O pai público será lido novamente; não usar force-push nem substituir alterações remotas.

Publicação preparada: release-notes pack7, relatório factual e proposta concreta de diagnóstico temporário restrito a contas próprias, com prazo fixo de cinco minutos, sem execução após a rejeição automática. Testes finais de unidade 139 e banco 139 passaram após o rename canonical da migration e atualização de notas.

Continuidade real: o diretor recebeu o e-mail, confirmou pelo link normal, fez login por senha e ativou seu cadastro. Os sete cargos agora têm contas distintas confirmadas. A conta de diretor também passou pelo código nativo e pela RPC normal; repetição manteve o prazo, totalizando quatro contas com prova nativa real. As anotações anteriores de limite de envio são históricas e não representam mais uma pendência de cadastro.

Publicação isolada RED: CI TI App 114908977057 e instalação limpa somente em apps/ti reproduziram TS2307 no React importado pelo componente compartilhado e TS7006 consequente. O ambiente local anterior resolvia React pelo node_modules raiz e ocultava a falha. Correção mínima: caminho de tipos React no tsconfig da T.I., como já existia para jsx-runtime. GREEN: instalação isolada compilou, protegeu os assets e passou no orçamento de 140,18 KiB JS e 11,98 KiB CSS. Nenhuma dependência ou comportamento de negócio foi acrescentado.
