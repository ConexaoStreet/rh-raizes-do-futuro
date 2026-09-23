# Cloudflare — produção principal

Este repositório mantém dois frontends independentes:

- RH principal: raiz do repositório
- Central T.I.: `apps/ti`

O backend oficial continua sendo o Supabase. Cloudflare hospeda apenas os frontends estáticos e recursos auxiliares de infraestrutura quando necessários.

## Decisão

Usar **Cloudflare Workers Static Assets** para novos deploys.

Motivos:

- suporte nativo a SPA com `not_found_handling = "single-page-application"`;
- integração GitHub por Workers Builds;
- previews de branches/PRs;
- build watch paths para evitar rebuild desnecessário no monorepo;
- arquivos `_headers` para manter os headers de segurança e cache;
- mantém Vercel intacta como redundância;
- não exige migração de Auth, banco, Edge Functions ou Storage do Supabase.

Cloudflare Pages não é a opção principal deste projeto.

## Workers

### RH

- Worker: `rh-raizes-do-futuro`
- Root directory: `/`
- Production branch: `main`
- Build command: `npm ci && npm run verify`
- Deploy command: `npx wrangler@4.135.0 deploy`
- Preview command: `npx wrangler@4.135.0 preview`
- Config: `/wrangler.jsonc`

Build variables públicas necessárias:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_POSTHOG_KEY`
- `VITE_POSTHOG_HOST`
- `VITE_BASE_PATH=/`

Nunca cadastrar no frontend `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `OTP_HMAC_SECRET` ou qualquer segredo de backend.

Build watch paths recomendados para RH:

- incluir: `src/*`, `public/*`, `scripts/*`, `tests/*`, `e2e/*`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `wrangler.jsonc`
- excluir: `apps/ti/*`

### Central T.I.

- Worker: `ti-raizes-do-futuro`
- Root directory: `apps/ti`
- Production branch: `main`
- Build command: `npm ci --no-audit --no-fund && npm audit --audit-level=high && npm run build && npm run check:bundle`
- Deploy command: `npx wrangler@4.135.0 deploy`
- Preview command: `npx wrangler@4.135.0 preview`
- Config: `apps/ti/wrangler.jsonc`

Build variables públicas necessárias:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_RH_SITE_URL`

Build watch path recomendado para T.I.:

- incluir: `apps/ti/*`

## Fluxo de produção

1. Alterações entram por branch/PR.
2. GitHub CI precisa ficar verde antes do merge.
3. O merge em `main` dispara Workers Builds.
4. Cloudflare publica o frontend.
5. Vercel permanece disponível como fallback e deve receber apenas releases consolidados, reduzindo builds.

Não desativar o modo manutenção do Supabase até que o frontend Cloudflare esteja publicado e validado em desktop/mobile, login, 2FA, rotas SPA, PWA e acesso ao Supabase.

## Domínios

Produção desejada:

- domínio principal do RH -> Worker `rh-raizes-do-futuro`;
- subdomínio da T.I. -> Worker `ti-raizes-do-futuro`;
- URLs Vercel permanecem como fallback.

Failover automático por health check não deve ser ativado sem aprovação de custo. Em plano gratuito, manter o fallback Vercel pronto e o domínio sob Cloudflare permite uma troca operacional rápida caso seja necessária.

## Validação antes de produção

- CI GitHub verde;
- build Cloudflare verde;
- rota profunda da SPA abre diretamente;
- assets com hash carregam;
- `sw.js` não fica preso em cache;
- login e sessão Supabase funcionam;
- 2FA por e-mail funciona;
- modo manutenção continua bloqueando usuários não autorizados;
- RH e T.I. permanecem separados;
- nenhum source map é publicado.
