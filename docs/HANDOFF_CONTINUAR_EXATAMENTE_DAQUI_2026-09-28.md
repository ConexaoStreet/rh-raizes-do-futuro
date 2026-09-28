# HANDOFF - CONTINUAR EXATAMENTE DAQUI - 28/09/2026

> **INSTRUÇÃO OBRIGATÓRIA PARA O PRÓXIMO CHAT**
>
> NÃO recomeçar a análise, NÃO refazer o que já foi concluído e NÃO pedir para o usuário repetir contexto.
> Continue **exatamente do ponto técnico descrito em “PONTO EXATO DE CONTINUAÇÃO”**.
> O usuário autorizou continuar e quer execução direta.
> Antes de qualquer correção geral, preservar a prioridade solicitada: **Boletim/Pesos mobile → notificações RH automáticas → redesign dos cards/identidade → correção dos erros da varredura**.

## Projeto

- Repositório: `ConexaoStreet/rh-raizes-do-futuro`
- Branch principal: `main`
- Supabase project ref: `fiuealmgufpmtgmxxpna`
- Stack: React/Vite/TypeScript + Supabase + Vercel + Resend.
- RH e Central T.I. são sistemas separados no mesmo repositório. **Não misturar notificações comuns de RH com eventos da Central T.I.**
- Base funcional observada antes deste handoff: `ef8fb42a3899184372a83e93d85cc66b4bcbce04`.
- Histórico recente de Vercel teve `build-rate-limit`; evitar commits/deploys desnecessários. Verificar o status do `main` antes de declarar algo como publicado.

---

# PEDIDO ATUAL DO USUÁRIO

1. Fazer uma **varredura extremamente completa** do projeto e relatar no chat todos os erros, riscos, inconsistências e melhorias.
2. Antes de sair corrigindo tudo:
   - melhorar muito o layout do **Boletim / Notas / Peso**, principalmente no mobile;
   - criar um sistema **auto-notificável**:
     - tudo que envolver o usuário nominalmente no RH deve gerar notificação;
     - exemplos: alteração de dados, falta, presença, atraso, justificativa, feedback, nota/boletim e demais ocorrências normais de RH;
     - entregar notificação **no site + push quando habilitado + e-mail altamente personalizado para o e-mail/Gmail do usuário**;
     - **eventos da Central T.I., administração técnica, logs técnicos, infraestrutura etc. NÃO devem ser enviados ao colaborador como notificação de RH**;
   - redesenhar os cards/padrões de nome/identidade.
3. A imagem enviada pelo usuário mostrava o pequeno card quadrado verde com `RH`. No código ele corresponde ao `.workspace-icon` em `src/App.tsx`. Esse padrão visual também deve ser melhorado; não tratar como simples troca de texto.

---

# O QUE JÁ FOI VARREDO

## 1. Estrutura do repositório

Já foram mapeados:
- todo `src/`;
- `apps/ti/`;
- Edge Functions;
- migrations;
- testes e E2E;
- scripts de segurança/bundle;
- push notifications;
- páginas de Boletim, Presença, Pessoas, Administração e App shell.

Não repetir esse inventário.

## 2. Boletim / Pesos - estado atual

Arquivo principal:
- `src/Performance.tsx`

Achados:
- peso aparece como texto pequeno `Peso X` dentro da primeira coluna da tabela;
- o boletim usa tabela horizontal com primeira coluna sticky;
- em mobile a tabela continua essencialmente desktop/horizontal;
- resumo usa grid 2x2 no mobile;
- formulário de nota também mostra `Peso X` em cada critério;
- CSS principal do boletim está no final de `src/styles.css`:
  - `.gradebook-toolbar`
  - `.gradebook-summary`
  - `.gradebook-table`
  - `.criterion-row`
  - media queries em 900px e 560px.

**Direção já decidida:** no mobile, peso/competência deve virar uma leitura mais clara, com peso visualmente separado (badge/chip/medidor), notas por período legíveis sem esmagar coluna. Não remover cálculo ponderado nem contratos de `save_performance`.

## 3. Sistema de notificações existente

Já existe:
- tabela `public.notifications`;
- página `/notificacoes`;
- contador no sino do topo;
- `mark_notification`;
- web push:
  - `src/push.ts`
  - `supabase/functions/push-notify/index.ts`
  - migration `20260924171425_add_web_push_notifications.sql`;
- trigger `notifications_web_push` após INSERT em `public.notifications`;
- `push-notify` ACTIVE no Supabase.

Hoje as notificações de RH NÃO cobrem tudo. Foram encontradas inserções específicas apenas em alguns fluxos:
- novo cadastro pendente → administradores/gestores;
- feedback liberado → colaborador;
- justificativa aguardando análise → responsáveis;
- justificativa analisada → colaborador;
- avaliação de gestão em alguns fluxos.

Faltam, entre outros:
- presença;
- falta;
- atraso;
- alteração de presença;
- lançamento/alteração/liberação de nota;
- alteração de dados do colaborador;
- respostas/alterações de feedback em todos os casos relevantes;
- demais eventos normais de RH que afetem aquele usuário.

**Arquitetura recomendada já definida:** criar uma camada central de eventos/notificações RH no banco para evitar duplicação e garantir que o mesmo evento alimente:
1. `public.notifications` (site);
2. web push existente;
3. e-mail transacional.

Não espalhar chamadas de e-mail diretamente pelo frontend.

## 4. E-mail / Resend

Conexão Resend foi inspecionada.

Encontrado:
- 2 API keys existentes:
  - `RH Raizes do Futuro 2FA`
  - `Onboarding`
- **nenhum domínio verificado** no Resend;
- **nenhum webhook** configurado;
- 6 templates publicados, todos voltados para T.I.;
- `email-2fa` já usa `RESEND_API_KEY` + `EMAIL_FROM` no Supabase e envia por API Resend.

Consequência:
- infraestrutura de envio existe e pode ser reaproveitada;
- porém o sistema de notificações RH precisa de template próprio e delivery tracking;
- não usar templates de T.I. para colaboradores;
- não afirmar que Gmail é o provedor do backend: o requisito é “chegar no Gmail/e-mail do usuário”; o canal transacional deve continuar via Resend/Supabase.

## 5. Supabase - estado real

Tabelas públicas possuem RLS habilitado.
Edge Functions ativas incluíam:
- `email-2fa` v7
- `datasul-bridge` v4
- `platform-bridge` v3
- `manager-activation` v6
- `push-notify` v3
- `registration-bootstrap` v6
- `profile-photo-verify` v3
- `ti-admin-bridge` v4
- `ti-code-login` v4

Advisors de segurança:
- 3 INFO de RLS sem policy em tabelas **private**:
  - `private.edge_rate_limits`
  - `private.ti_access_code_attempts`
  - `private.ti_access_codes`
  Isso é compatível com tabelas privadas sem acesso direto e não deve ser “corrigido” cegamente.
- 1 WARN: leaked password protection desabilitada. Já se sabe que isso depende de recurso/plano que o usuário não quer habilitar se for pago.

Advisors de performance:
- 37 índices marcados como unused.
- **Não remover automaticamente**; banco é recente e baixo volume, então “unused” não prova que o índice é inútil.

RLS relevante já conferida:
- colaborador só lê suas notificações;
- colaborador lê seus próprios registros;
- performance só fica visível ao colaborador quando `released=true`;
- feedback só fica visível ao colaborador quando liberado;
- push subscriptions só são manipuláveis pelo próprio usuário.

## 6. ACHADO ALTO - DRIFT DE MIGRATIONS

**IMPORTANTE: produção tem migrations aplicadas que NÃO existem no `main` do GitHub.**

Produção listou:
- `20260928042130_maximum_security_hardening_phase_one`
- `20260928042157_repair_edge_rate_limit_ambiguity`
- `20260928043011_persist_pre_registered_role_authorization`

A busca no `main` não encontrou nenhum desses arquivos/nomes.

Isso é risco real de reprodutibilidade e disaster recovery.
**Antes de criar migrations substitutas, procurar essas migrations em branches/commits/PRs antigos.**
Se existirem em outro commit, restaurar o conteúdo exato.
Não inventar SQL equivalente enquanto o original puder ser recuperado.

## 7. Segurança / GitHub

Durante a varredura foi observado:
- repositório ainda público;
- `main` sem proteção efetiva observada na checagem anterior.

Não alterar visibilidade sem confirmar impacto em Vercel/integrações.
Registrar como risco alto no relatório.

## 8. Secrets / código

Busca por padrões perigosos:
- nenhum `dangerouslySetInnerHTML`;
- nenhum `eval(`;
- nenhum `@ts-ignore`;
- `SUPABASE_SERVICE_ROLE_KEY` e `RESEND_API_KEY` aparecem apenas como nomes de variáveis de ambiente/secret, não como valores hardcoded;
- observabilidade usa logs estruturados.

---

# PONTO EXATO DE CONTINUAÇÃO - NÃO RECOMEÇAR

A varredura parou **exatamente na auditoria estrutural final do Supabase**.

A última consulta grande retornou principalmente o inventário de triggers, então foi iniciada uma segunda rodada separando as verificações para evitar truncamento. O próximo chat deve começar **NESTA LINHA DE EXECUÇÃO**, sem voltar para o inventário geral:

### PRIMEIRA AÇÃO DO PRÓXIMO CHAT

Executar separadamente e ler os resultados destas três verificações no Supabase:

```sql
-- A. integridade estrutural
select
 (select count(*) from pg_index where not indisvalid) invalid_indexes,
 (select count(*) from pg_constraint where not convalidated) unvalidated_constraints,
 (select count(*) from pg_trigger where not tgisinternal and tgenabled='D') disabled_triggers,
 (select count(*) from pg_tables where schemaname='public' and not rowsecurity) public_tables_without_rls;
```

```sql
-- B. SECURITY DEFINER sem search_path explícito
select n.nspname schema_name,
       p.proname,
       pg_get_function_identity_arguments(p.oid) args
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where p.prosecdef
  and n.nspname in ('public','private')
  and not exists (
    select 1
    from unnest(coalesce(p.proconfig,array[]::text[])) cfg
    where cfg like 'search_path=%'
  )
order by 1,2;
```

```sql
-- C. views públicas/privadas para revisar possível bypass de RLS
select schemaname, viewname, definition
from pg_views
where schemaname in ('public','private')
order by schemaname, viewname;
```

Depois:
1. concluir o relatório da varredura com prioridades **CRÍTICO / ALTO / MÉDIO / BAIXO**;
2. relatar no chat sem esconder achados;
3. **não começar corrigindo tudo ainda**;
4. implementar primeiro os pedidos visuais/funcionais aprovados:
   - Boletim/Pesos mobile;
   - pipeline central de notificações RH + site + push + e-mail;
   - redesign do `workspace-icon RH` e dos cards/padrões de identidade;
5. só depois atacar os erros gerais encontrados.

---

# REQUISITOS PARA O PIPELINE DE NOTIFICAÇÃO

O usuário pediu “tudo que envolva o nome dela”. Traduzir isso tecnicamente como **evento de RH direcionado ao employee/profile**, e não como busca textual ingênua pelo nome.

Deve notificar o usuário afetado quando houver mudança normal de RH, incluindo pelo menos:
- cadastro/vínculo aprovado ou alterado;
- dados pessoais/profissionais alterados;
- presença marcada;
- falta marcada;
- atraso;
- saída antecipada/ocorrência;
- alteração posterior de presença;
- justificativa criada/analisada;
- feedback criado/liberado/alterado/respondido;
- nota lançada/alterada/liberada;
- boletim alterado;
- eventos direcionados ao colaborador, se houver vínculo explícito;
- outras alterações normais ligadas ao `employee_id/profile_id`.

Excluir:
- T.I.;
- saúde técnica do sistema;
- deploy;
- logs;
- banco;
- segurança interna;
- operações da Central T.I.;
- suporte técnico administrativo, salvo quando a própria ação for uma comunicação explícita destinada ao usuário.

### Anti-spam / consistência
- usar ID de evento/idempotência;
- não enviar e-mail duplicado em retry;
- site notification deve ser a fonte central;
- push e e-mail são canais de entrega;
- registrar status de envio/falha;
- idealmente adicionar categoria/tipo de evento à notificação em nova migration;
- manter conteúdo personalizado com nome, contexto, data e CTA seguro;
- **não colocar dado sensível desnecessário no subject do e-mail**.

---

# REQUISITOS DE UI - BOLETIM

Principalmente em <=560px:
- abandonar sensação de “tabela desktop espremida”;
- peso deve ficar claramente separado do nome do critério;
- mostrar `Peso 1,0`, `Peso 2,0` etc. como chip/badge visual;
- permitir leitura fácil de competência, nota, peso e média;
- manter acesso aos períodos sem cortar conteúdo;
- não alterar fórmula `weightedAverage`;
- não alterar contratos/RPCs;
- preservar permissões `performance.view`, `performance.manage`, `performance.grade`;
- revisar também o modal `ReviewForm`, especialmente `.criterion-row` no mobile.

---

# REQUISITOS DE UI - CARDS / IDENTIDADE

Alvo explícito da imagem:
```tsx
<span className="workspace-icon">RH</span>
```
em `src/App.tsx`.

Redesenhar para ficar menos “badge padrão”.
Pode usar marca/ícone real da plataforma e uma composição mais refinada.
Para cards de pessoa/nome:
- priorizar foto quando existir e for permitida;
- fallback de iniciais só quando não houver foto;
- nome e função/status com hierarquia limpa;
- mobile sem cards gigantes;
- não alterar rosto/foto nem gerar avatar artificial.

---

# CONTROLES DE QUALIDADE

Antes de merge:
- lint;
- testes unitários;
- testes de banco;
- build;
- bundle budget;
- E2E;
- revisar mobile 320/390/430/560;
- conferir que nenhum fluxo T.I. passou a disparar notificações RH;
- conferir RLS;
- conferir que e-mail não vaza informação de outro colaborador;
- conferir idempotência;
- não desabilitar segurança para “fazer funcionar”.

Se um ajuste exigir nova migration:
- migration versionada no GitHub;
- aplicar no Supabase;
- depois confirmar `list_migrations` sem novo drift.

---

# NÃO FAZER

- não recriar Supabase;
- não recriar Auth;
- não remover Vercel;
- não apagar módulos;
- não usar mocks em produção;
- não expor secrets;
- não habilitar serviço pago sem autorização;
- não misturar Central T.I. com RH;
- não apagar índices apenas porque advisor diz “unused”;
- não alterar RLS sem necessidade;
- não declarar deploy live sem verificar;
- não pedir confirmação para continuar este trabalho: **o usuário já aprovou a continuação**.

---

## COMANDO FINAL PARA O PRÓXIMO CHAT

**CONTINUE EXATAMENTE DO “PONTO EXATO DE CONTINUAÇÃO” DESTE ARQUIVO. A PRIMEIRA AÇÃO É RODAR AS 3 CONSULTAS ESTRUTURAIS SEPARADAS DO SUPABASE. NÃO REFAÇA A VARREDURA JÁ CONCLUÍDA.**
