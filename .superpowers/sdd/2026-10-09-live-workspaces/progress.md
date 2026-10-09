# SDD ledger: docs/superpowers/plans/2026-10-09-live-workspaces.md

Execução autorizada pelo pedido integral do usuário e permissão total persistente. Método: implementação nesta sessão, com revisão independente antes de cada pacote publicado.

Pre-flight: Task 1 produz feed público independente de Auth; Tasks 2 e 3 compartilham autorização de setor e migration; Task 4 confirma versões sem escrita anônima.

Decisão: ampliar em dois pacotes principais, acompanhamento primeiro e funcionalidades depois, para reduzir builds. O usuário escolheu chat por setor e geral.

Decisão: ver tudo significa dados de negócio do RH; não ampliar T.I. ou segredo para instrutor. Custo se interpretado diferente: acrescentar outra permissão de negócio explicitamente.

Manutenção ativada em settings.version 8, enabled true, allow_managers false, título O site está em manutenção, iniciado em 2026-10-09T22:19:57Z. Ainda pendente aviso público e acompanhamento.

Task 1: implementação concluída e revisão independente aprovada; publicação pendente.

Provas: RED por módulo e RPC ausentes; GREEN 74 testes unitários, 40 testes de negócio existentes e 6 de manutenção pública. Playwright verificou 320,390,768,1440px, navegação sem login e controle de tema abaixo do aviso. Lint, build e orçamento aprovados (163.04 KiB JS, 15.92 KiB CSS).

Revisão independente encontrou sobreposição do controle fixo de tema com o link de manutenção no login. Corrigido para posição absoluta dentro do login, coberto por geometria no navegador; parecer final aprovado.

Migration live_maintenance_feed aplicada em produção sob versão 20261009223058. Projeção pública ativa, três etapas reais registradas, Realtime habilitado; escrita anon e leitura de settings privados negadas. Nome local alinhado ao histórico remoto.

Interface entregue: SiteStatus, useSiteStatus e public.site_status. Nenhum segredo ou dado de pessoas no feed; somente textos públicos curados.
