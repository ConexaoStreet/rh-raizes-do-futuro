# Native Authenticator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Permitir confirmar acesso e ações do RH/T.I. por aplicativo, com prova real do Supabase Auth.

**Architecture:** Supabase Auth valida o TOTP; uma RPC própria valida a prova e a sessão atual antes de registrar a confirmação usada pelos recursos existentes. Um componente compartilhado configura ou usa o fator nas duas telas de segurança.

**Tech Stack:** React 19, TypeScript 5.9, Supabase JS 2.116.0, Postgres 17, Vitest, PGlite e Playwright.

**Spec:** docs/superpowers/specs/2026-10-12-native-authenticator-design.md

## Global Constraints

- Entrada por senha, endereço confirmado, perfil active com onboarding e termos e sessão real não revogada.
- Prova JWT aal2/password/totp; fator verified do mesmo usuário e sessão; timestamp do JWT igual ao segundo de updated_at da prova.
- Prova com no máximo 15 minutos e no máximo 30 segundos no futuro; validade da sessão de confirmação de 8 horas a partir da prova.
- Repetição não renova verified_at/verified_until; remoção do fator invalida prova nativa; verificação por e-mail limpa vínculo nativo.
- Sem segredos, códigos, QR ou corpo de provedor em logs, relatórios, Gmail ou repositório.
- Não alterar dados reais de pessoas, permissões globais de cargos ou relógio para passar testes.
- Fechar registration_access_window somente após implantação das duas telas e confirmação real do método.
- RH JS/CSS inicial: 200/16 KiB gzip. T.I.: 150/12 KiB gzip.

## Review Focus

- Fator removido após a confirmação: identidade não continua validada por ponteiro antigo.
- RPC repetida com o mesmo JWT: não estende confirmação recente nem prazo de acesso.
- HTTP 200 com recusa ou resultado incompleto: não retoma rascunho nem anuncia sucesso.
- Cancelamento ou desmontagem durante pedido: nenhuma ação anterior é retomada.
- MFA_CHALLENGE_VERIFIED anterior à RPC: bootstrap intermediário não perde o formulário.

## Task 1: Prova nativa e consumidores no banco

**Files:** nova migration criada com supabase migration new; tests/setup-database.mjs; tests/native-mfa.mjs; package.json; src/database.types.ts; shared/activity-language.ts; src/activity-language.test.ts.

**Interfaces:** Produz public.confirm_authenticator_session() -> jsonb {ok:true,verified_at,verified_until}; private.mfa_session_verified() -> boolean; coluna private.session_security.verified_factor_id uuid nullable. Reconciliar account_ready/bootstrap/recently_verified preservando a janela e a manutenção atuais; issue_otp/verify_otp limpam vínculo quando necessário.

- [x] Escrever testes de banco para prova válida, aal1, método sem senha, fator não verificado/alheio, timestamp antigo/futuro/divergente, sessão revogada, perfil inativo/sem confirmação, repetição sem renovação, fator removido e ausência de novas permissões ao colaborador.
- [x] Rodar node tests/native-mfa.mjs e observar falha pela ausência da RPC. O stub Auth apenas reproduz as tabelas usadas; não marcar proof do app manualmente nesse teste positivo.
- [x] Criar migration com CLI e implementar a validação descrita no spec, wrappers e privilégios explícitos. Acrescentar campos de Auth necessários ao harness local.
- [x] Rodar testes novos e npm run test:database. Todos devem passar; restaurar saída gerada do relatório.
- [x] Registrar os resultados no ledger e fazer commit.

## Task 2: Componente compartilhado e integração nas telas

**Files:** shared/native-authenticator.ts; shared/NativeAuthenticator.tsx; src/native-authenticator.test.ts; src/auth.tsx; apps/ti/src/auth.tsx; e2e/native-authenticator.e2e.ts; e2e/ti-operations.e2e.ts.

**Interfaces:** createNativeAuthenticatorApi(auth, confirmProof) entrega list/enroll/verify/discardPending; verify usa challengeAndVerify e exige {ok:true} da RPC. NativeAuthenticator recebe api, onDone, onBack e onBusyChange. Não retorna nem registra o segredo fora da apresentação de configuração.

- [x] Escrever testes de serviço na fronteira SDK para recusa, fator existente, descarte só de unverified, QR externo recusado e confirmação incompleta.
- [x] Escrever testes de interface com respostas preparadas para configurar fator, verificar fator existente, preservar rascunho, recusar resposta incompleta, cancelar e caber em 320 px; observar RED.
- [x] Implementar controller e componente com cancelamento/montagem, SVG codificado em img e mensagens humanas. Instanciar nas duas Verification somente quando o método for escolhido.
- [x] Tratar MFA_CHALLENGE_VERIFIED para atualizar bootstrap somente após a RPC; callbacks existing seguem exigindo conta pronta e confirmação recente.
- [x] Rodar npm test e testes focados de interface; GREEN. Conferir builds/orçamentos e commit.

## Task 3: Auditoria real completa da T.I. e publicação

**Files:** docs/verification/2026-10-12-pack07-ti-audit.md; public/release-notes.json; evidências públicas e ledger.

- [ ] Aplicar o método no serviço real só após suíte verde e revisão independente; validá-lo com senha e fator próprio, sem escrever verified_at por conector.
- [ ] Conferir os painéis e executar ações protegidas apenas sobre registros de auditoria: usuário, pessoa, chamado, anexo, configurações de teste e diagnóstico/integrações conforme capacidades. Verificar negativas com colaborador.
- [ ] Retomar cadastros por cargo quando o limite real de e-mail permitir, sem fazer confirmações artificiais.
- [ ] Rodar npm run verify, teste completo de interface, build/orçamento T.I. e revisão de React após editar múltiplos TSX. Corrigir todos os problemas importantes reproduzidos.
- [ ] Revisão final independente da mudança inteira, incluindo fator removido, repetição, cancelamento e resposta recusada.
- [ ] Publicar um pacote em GitHub/Vercel, conferir ambos os commits/aliases, fechar a janela temporária com o método comprovado, repetir fluxos e conferir o registro automático.
- [ ] Encerrar somente contas, sessões, fatores e registros de auditoria, mantendo histórico. Atualizar acompanhamento e Gmail HTML com resultados e pendências concretas.
