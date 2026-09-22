# PROJECT_STATUS

Atualizado em 22/09/2026.

## Backend

Supabase de produção: `RH Raízes do Futuro` (`fiuealmgufpmtgmxxpna`, sa-east-1). Schema, RLS, Storage, RPCs, auditoria, 2FA e hardening de acesso aplicados. Advisor de segurança sem avisos após a última auditoria.

## Segurança adicional

- OTP consumido quando sessão é revogada.
- Registro de `verified_at` e janela de verificação recente de 15 minutos.
- Alterações sensíveis e manutenção de presença protegidas por reautenticação recente.
- Justificativas somente após chamada finalizada, com elegibilidade e duplicidade controladas.
- Tabelas `private` com negação explícita de acesso direto.

## Integrações

- GitHub: repositório público dedicado `ConexaoStreet/rh-raizes-do-futuro`.
- PostHog: projeto configurado como `RH Raízes do Futuro`, IP anonimizado, autocapture desativado, sem session replay e eventos explícitos sem PII.
- Resend: Edge Function preparada para envio do 2FA; secrets permanecem fora do repositório.
- Vercel: `vercel.json` e CI preparados para preview/deploy.
- Linear: projeto e backlog de produção ativos.

## Produção Vercel

- Projeto: `rh-raizes-do-futuro`
- Domínio principal: `https://rh-raizes-do-futuro.vercel.app`
- Status do primeiro deploy: `Ready`
- Fonte: GitHub `main`
- Próximo ajuste obrigatório: configurar Supabase Auth URL Configuration e o secret `ALLOWED_ORIGINS` da Edge Function `email-2fa`.

## Frontend

A base recebida foi atualizada para entender `recently_verified`, pedir nova verificação antes de manutenção da presença e emitir telemetria mínima de segurança/uso sem nomes, e-mails, telefones, matrícula, justificativas ou notas.

## Verificação

A validação local anterior foi bloqueada por falha de resolução do registry do npm. A CI do GitHub passa a ser a validação limpa e reproduzível desta versão. O workflow gera `package-lock.json` automaticamente se o repositório ainda não possuir o arquivo.
