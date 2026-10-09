# Raízes do Futuro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Atualizar visual, navegação, boletim mobile e notificações mantendo o sistema real.
**Architecture:** Evolução dos componentes existentes e uma migration aditiva. Figma documenta a composição e os tokens; React continua responsável pela interface e Supabase por autenticação/autorização.
**Tech Stack:** React 19, TypeScript, Vite 7, Supabase, Playwright, Vitest, PGlite, Vercel.
**Spec:** docs/superpowers/specs/2026-10-09-raizes-evolucao-design.md

## Global Constraints
- Preservar dados, módulos, logo oficial, controle de acesso e separação entre RH e T.I.
- Não enviar e-mails de teste ou retransmitir mensagens antigas.
- Não mudar média ponderada e contratos de notas.
- Não ativar pagamentos nem desabilitar segurança.

## Review Focus
- Notificações de outro usuário ou T.I. não podem aparecer no RH.
- Troca de aluno/período não pode mostrar a nota anterior durante carregamento.
- Janela escondida e reconexões não podem multiplicar canais/intervalos.
- Sem dados, conexão lenta e falhas devem ter estados recuperáveis.
- Celular de 320 px, nomes longos, teclado e tema escuro devem continuar legíveis.

### Task 1: Experiência visual e navegação
**Files:** src/auth.tsx, src/Dashboard.tsx, src/Shell.tsx, src/main.tsx, src/styles/rh-evolution.css, e2e/evolution.e2e.ts.
**Interfaces:** preserva props dos componentes e permissões existentes.
- [ ] Compor login e painel desktop, boletim mobile e componentes no Figma; verificar fontes e layers editáveis.
- [ ] Implementar tokens, login, saudação, contexto e atalhos de busca/menu.
- [ ] Verificar visual e navegação em ambos os temas, teclado, 320/390/430/560 e desktop.

### Task 2: Boletim mobile
**Files:** src/Performance.tsx, src/GradebookMobile.tsx, e2e/evolution.e2e.ts.
**Interfaces:** GradebookMobile consome competências, ciclos e notas por competência; nenhuma escrita ou novo RPC.
- [ ] Cobrir seleção de período, zero, nota ausente e peso com testes de interação.
- [ ] Implementar cards com nota e peso, preservar tabela no desktop e cálculo weightedAverage.
- [ ] Verificar troca de aluno, estados vazios e nota 0.

### Task 3: Notificações e Realtime
**Files:** src/notifications.ts, src/Administration.tsx, src/Shell.tsx, src/database.types.ts, supabase/migrations/*_notification_realtime.sql, tests/notification-refresh.test.ts.
**Interfaces:** watchNotifications(client,userId,onChange): () => void; filtros user_id e scope='rh'; callback com debounce e teardown.
- [ ] Testar eventos, retorno à janela, debounce e desmontagem antes de implementar.
- [ ] Implementar watcher, contador, filtros e estados de atualização; adicionar índice e publication de forma aditiva.
- [ ] Verificar isolamento no banco, aplicação versionada e advisors.

### Task 4: Desempenho, revisão e publicação
**Files:** vite.config.ts, public/release.json, docs/verification/2026-10-09-evolution.md.
**Interfaces:** Vite rollupOptions manualChunks; release.json registra versão da experiência.
- [ ] Usar rollupOptions compatível com Vite 7 e dividir exportações/gráficos em chunks carregados sob demanda.
- [ ] Executar npm run verify e E2E; comparar bundles e revisar o diff com um revisor independente.
- [ ] Publicar uma atualização consolidada e verificar checks/deploy/SHA servido.
