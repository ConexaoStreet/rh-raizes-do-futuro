# SDD ledger: docs/superpowers/plans/2026-10-09-live-workspaces.md

Execução autorizada pelo pedido integral do usuário e permissão total persistente. Método: implementação nesta sessão, com revisão independente antes de cada pacote publicado.

Pre-flight: Task 1 produz feed público independente de Auth; Tasks 2 e 3 compartilham autorização de setor e migration; Task 4 confirma versões sem escrita anônima.

Decisão: ampliar em dois pacotes principais, acompanhamento primeiro e funcionalidades depois, para reduzir builds. O usuário escolheu chat por setor e geral.

Decisão: ver tudo significa dados de negócio do RH; não ampliar T.I. ou segredo para instrutor. Custo se interpretado diferente: acrescentar outra permissão de negócio explicitamente.

Manutenção ativada em settings.version 8, enabled true, allow_managers false, título O site está em manutenção, iniciado em 2026-10-09T22:19:57Z. Ainda pendente aviso público e acompanhamento.

Task 1: concluída e publicada por PR 92, main d553907dd9ca7b905f7849ae1f8bfad75c784c8b, deployment dpl_CU6GFe6c5VQ4GjmoDdD2EzjoNuhx READY. Login e acompanhamento confirmados no navegador público. Versão 1.1.0 e etapa real do pacote 2 registradas.

Provas: RED por módulo e RPC ausentes; GREEN 74 testes unitários, 40 testes de negócio existentes e 6 de manutenção pública. Playwright verificou 320,390,768,1440px, navegação sem login e controle de tema abaixo do aviso. Lint, build e orçamento aprovados (163.04 KiB JS, 15.92 KiB CSS).

Revisão independente encontrou sobreposição do controle fixo de tema com o link de manutenção no login. Corrigido para posição absoluta dentro do login, coberto por geometria no navegador; parecer final aprovado.

Migration live_maintenance_feed aplicada em produção sob versão 20261009223058. Projeção pública ativa, três etapas reais registradas, Realtime habilitado; escrita anon e leitura de settings privados negadas. Nome local alinhado ao histórico remoto.

Interface entregue: SiteStatus, useSiteStatus e public.site_status. Nenhum segredo ou dado de pessoas no feed; somente textos públicos curados.

CI detectou assertion antiga que exigia position fixed no tema. Substituída por geometria do canto superior do painel; nova revisão independente aprovada. Suite completa local 25/25 E2E e todos os checks remotos verdes antes do merge.

Tasks 2 e 3: RED workspace_snapshot ausente e chat-files module ausente. GREEN inicial: 13 testes de acesso, tarefas, censura, flood, idempotência, anexos e denúncias; 2 testes de arquivos. Interfaces e telas em implementação.

Decisão técnica: serializar envio e reserva por lock da linha do perfil, com idempotência por autor/request_id. Advisory lock interrompia o runner PGlite; lock de linha é transacional, funciona em Postgres e tem cobertura local. Resposta de envio deriva do registro criado, sem depender de ser a última mensagem da sala.

Pacote 2 implementado: espaços do setor, visão de gestores, abas do instrutor, chat geral e por setor, upload privado, moderação e fila de denúncias. Versões geradas por commit; monitor privado consulta manifesto público a cada cinco minutos quando pg_cron disponível. Sem segredo ou escrita pública no monitor.

Validação completa: npm verify aprovado com 84 testes unitários, 46 verificações de negócio, 6 de manutenção, 17 de setores/chat, 7 de manifesto e 10 de monitor. Suite Playwright completa 32/32. Auditoria npm de produção: zero vulnerabilidades. Verificações de configuração Auth e privacidade aprovadas. Funções Edge serão verificadas pelo CI com Deno, indisponível neste runtime.

Revisões independentes: corrigidas limpeza de upload vencido após transferência de setor e concorrência entre Storage e envio/descarte. Revisor final aprovou condicionado à reabertura de denúncias; regressão RED confirmada e correção GREEN 17/17, exit 0. Nenhum dado de teste escrito em produção.

Publicação preparada em PR 93. Checks GitHub e Vercel RH/TI do primeiro commit verdes. A aplicação grande retornava Invalid or expired requestState. Nova tentativa resolveu com partes menores, revisadas independentemente; somente revogações preventivas extras entre etapas, sem ampliar acesso.

Migrations aplicadas: automatic_release_history 20261010054143; workspaces_chat_schema 20261010054325; workspaces_chat_operations 20261010054339; workspaces_chat_access 20261010054432. Confirmados seis canais, bucket privado, cron ativo a cada cinco minutos, RLS nas seis tabelas e ausência de RPC/escrita direta para anon. Sincronizados nomes locais com histórico remoto. Suite completa de banco passou após divisão.

Advisors: sem erro de segurança do pacote. RLS sem policy do monitor privado é intencional; não há grants para clientes. Índices novos ainda sem uso são esperados antes da publicação. Aviso existente sobre proteção contra senhas vazadas permanece e não foi habilitado serviço pago. Ainda conferir deploy público e desligar manutenção somente após produção READY.
