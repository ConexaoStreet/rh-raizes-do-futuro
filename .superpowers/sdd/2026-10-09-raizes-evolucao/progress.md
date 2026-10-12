# SDD ledger - plan: docs/superpowers/plans/2026-10-09-raizes-evolucao.md
Base: 524316bba0b338b0545893f09b0cc069fdacf311.
Pre-flight: componentes preservam props e RPCs. Task 3 produz watcher consumido por Shell e Notifications.
Authorization: usuário solicitou execução completa e deu permissão total; revisão e publicação estão dentro do pedido.
Baseline: 20 arquivos / 69 testes passaram. Banco sem índices inválidos, sem triggers desativadas ou tabelas públicas sem RLS. Constraint NOT VALID pertence ao schema realtime gerenciado.

Task 1: Figma com login/painel desktop e boletim mobile, componentes editáveis e 14 tokens. Frontend com login editorial, saudação contextual, navegação e Ctrl+K.
Task 2: GradebookMobile preserva 0/ausente e snapshots de pesos; tabela desktop mantida; histórico responsivo.
Task 3: watcher+queries owner/RH/unread. Migration 20261009165950 aplicada e conferida: publication 1, índice válido, RLS true e política preservada.
Task 4: verify aprovado com 73 unitários e 40 testes PostgreSQL; bundle 162,38 KiB JS incluindo modulepreloads e 15,92 KiB CSS. Auditoria npm zero vulnerabilidades. Revisão independente encontrou grade tablet econtador em troca de owner; ambos corrigidos e regressões cobertas. Publicação e conferência final em andamento no PR 90.
Testes finais de interface: 24 passaram, incluindo troca de sessão com consulta pendente, troca de aluno e menu mobile.
