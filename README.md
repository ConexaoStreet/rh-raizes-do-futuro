# Raízes do Futuro — Gestão de RH

Sistema de gestão de RH para acompanhamento de colaboradores, presença, justificativas, feedbacks, desempenho, avaliação da gestão, relatórios e administração.

## Stack

React + Vite + TypeScript no frontend, Supabase para PostgreSQL/Auth/RLS/Storage/Edge Functions, Resend para e-mail transacional, PostHog para telemetria sem PII, Vercel para previews/deploy e GitHub para versionamento/CI.

## Ambiente

Copie `.env.example` para `.env.local` e informe apenas variáveis públicas do frontend. Nunca coloque service role, senha, `RESEND_API_KEY` ou `OTP_HMAC_SECRET` no Vite.

A Edge Function `email-2fa` utiliza secrets do Supabase: `OTP_HMAC_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` e `ALLOWED_ORIGINS`.

## Comandos

- `npm run dev` — desenvolvimento
- `npm run build` — build de produção
- `npm run test:database` — regressão do banco
- `npm run verify` — lint, testes e build

## Segurança

O banco usa RLS em todas as tabelas expostas. Operações privilegiadas passam por RPCs e 2FA; correções de presença em manutenção exigem verificação recente. Avaliações de gestão separam elegibilidade da resposta anônima.
