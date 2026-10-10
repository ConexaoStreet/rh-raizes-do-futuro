# Raízes Live Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Publicar manutenção acompanhável e entregar espaços por setor, gestores e instrutor, chat com anexos e uma revisão completa do RH.

**Architecture:** Primeiro publicar acompanhamento público limitado a informações de manutenção. Depois publicar espaços e chat autorizados no Postgres e Storage em um pacote completo. O andamento muda no banco; versões são identificadas por manifesto gerado no build e confirmadas no histórico após deploy.

**Tech Stack:** React 19, TypeScript, Vite 7, Supabase Postgres/Auth/Storage/Realtime, Vitest, PGlite PG17, Playwright, Figma.

**Spec:** docs/superpowers/specs/2026-10-09-live-workspaces-design.md

## Global Constraints

- Nenhum dado falso ou usuário de teste em produção.
- Preservar Auth, dados, RLS e separação de T.I.; complementar autorização apenas conforme o escopo de RH solicitado.
- Nenhum serviço pago ou segredo no cliente.
- Chat geral e por setor; textos de 2000 caracteres, anexos privados de 10 MiB e 3 por mensagem.
- Andamento honesto no banco, sem rebuild por mensagem; publicação em pacotes.
- Texto humano em português, sem NBSP, comentários de código ou em dash no repositório.

## Review Focus

- Troca de conta ou sala não pode mostrar mensagens, tarefas ou anexos da conta anterior.
- Usuário sem vínculo de setor recebe orientação, sem acesso automático a outro setor.
- Erro no envio ou upload não deve duplicar mensagem nem deixar um anexo acessível a outra sala.
- Manutenção e acompanhamento continuam acessíveis para quem não tem sessão ou está bloqueado pela manutenção.
- Atualização de versão não perde um formulário ou mensagem em edição com reload automático.

### Task 1: Publicar aviso e acompanhamento

**Files:** src/site-status.tsx, src/MaintenanceNotice.tsx, src/LiveMaintenance.tsx, src/styles/live-maintenance.css, src/App.tsx, src/database.types.ts, tests/site-live.mjs, src/MaintenanceNotice.test.tsx, e2e/live-maintenance.e2e.ts, supabase/migrations/*live_maintenance_feed.sql.

**Interfaces:** Produz SiteStatus {maintenance,updates,server_time}, useSiteStatus(), public.site_status(). Feed com sequence,pack,title,body,kind,status,created_at,updated_at; maintenance com enabled,title,message,started_at.

- [x] Testar aviso ativo/inativo e link /ao-vivo antes da implementação; esperar falha por módulo ausente.
- [x] Implementar projeção pública com RLS e status SQL invoker; verificar anonimato, bloqueio de escrita e sincronização do controle.
- [x] Implementar provider compartilhado, aviso e rota pública, erro/retry e atualização visível sem polling em background.
- [x] Testar login e acompanhamento em 320,390,768,1440px, sem overflow e sem campos de pessoas na página pública.
- [x] Executar lint, testes, build e orçamento; revisar; aplicar migration, registrar andamento verdadeiro e publicar pacote 1. Confirmar produção.

### Task 2: Espaços por setor e visão geral

**Files:** src/workspaces.ts, src/SectorWorkspace.tsx, src/OverviewWorkspace.tsx, src/styles/workspaces.css, src/layout/RhNavigation.ts, src/Shell.tsx, src/database.types.ts, tests/workspaces-chat.mjs, e2e/workspaces-chat.e2e.ts, supabase/migrations/*workspaces_chat.sql.

**Interfaces:** public.workspace_snapshot(department_identifier uuid default null), public.save_sector_task(payload jsonb,expected_version integer default null); auth.roles orienta a navegação, autorização de setor vem do servidor. Chat consome public.chat_rooms com department_id.

- [x] Testar acesso do próprio setor, negativa de outro setor, ausência de vínculo e visão de gestores/instrutor.
- [x] Implementar RPCs e tabelas com RLS, tarefas versionadas, dados agregados e seções com uma aba por vez.
- [x] Implementar painéis personalizados e atalhos com as permissões atuais; integrar navegação e manter rotas antigas.
- [x] Testar tarefas, abas, ações e troca de sessão em desktop/celular.
- [x] Conferir testes e registrar etapa concluída no acompanhamento, sem deploy intermediário.

### Task 3: Chat, moderação e anexos

**Files:** src/chat.ts, src/Chat.tsx, src/styles/chat.css, src/chat-files.test.ts, tests/workspaces-chat.mjs, e2e/workspaces-chat.e2e.ts, src/database.types.ts, migration de Task 2.

**Interfaces:** public.send_chat_message(room_identifier uuid,body text,attachment_identifiers uuid[] default '{}',request_identifier uuid default gen_random_uuid()), public.reserve_chat_attachment(payload jsonb), public.report_chat_message(message_identifier uuid,reason text), public.moderate_chat_message(message_identifier uuid,reason text). Mensagens paginadas e realtime; anexos privados e links de 120 segundos.

- [x] Testar censura no servidor, flood, idempotência, sala indevida, anexos de outro dono/sala, arquivos perigosos e tamanho.
- [x] Implementar políticas de sala/mensagem/anexo, RPCs privados com wrappers invoker e grants restritos; bucket privado sem upsert.
- [x] Implementar conversa, histórico paginado, estado de envio, denúncia, moderação, anexos e retry com idempotência.
- [x] Testar conexão, troca de sala/conta durante resposta pendente, publicação filtrada e anexos no navegador.
- [x] Executar testes e registrar etapa real no acompanhamento.

### Task 4: Versões, Figma e revisão completa

**Files:** scripts/generate-release.mjs, src/ReleaseNotice.tsx, src/release-version.ts, package.json, tests/release-version.test.mjs, docs/verification/2026-10-09-live-workspaces.md e testes de módulos existentes.

**Interfaces:** manifesto release.json {version,commit,published_at,changes}; versão baseada em commit; sem reload automático de rascunhos. Histórico público numerado após deploy via conexão autorizada.

- [x] Testar resumo humano, identificação de versão e rascunho preservado.
- [x] Implementar manifesto e aviso de versão; reutilizar a identidade aprovada no Figma existente nas telas de setores/chat/instrutor.
- [x] Auditar todos os módulos e RPCs existentes; cobrir operações de negócio em banco local e fluxos no navegador, corrigir falhas encontradas.
- [x] Executar npm run verify, testes de funções Edge, privacidade, auditoria de dependências e suite Playwright completa; verificar Supabase advisors e acesso a arquivos.
- [ ] Revisão independente do pacote final, correções com regressões, commit e publicação apenas após checks verdes.
- [ ] Confirmar produção, registrar versão publicada, desativar manutenção, conferir acesso normal e entregar relatório com limitações reais.
