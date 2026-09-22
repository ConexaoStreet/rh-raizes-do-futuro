# Vercel — configuração inicial

Projeto GitHub: `ConexaoStreet/rh-raizes-do-futuro`

## Importação

1. No painel da Vercel, escolha **Add New → Project**.
2. Importe o repositório `ConexaoStreet/rh-raizes-do-futuro`.
3. Framework Preset: **Vite**.
4. Root Directory: `./`.
5. Build Command: `npm run build`.
6. Output Directory: `dist`.
7. Install Command: `npm install` ou o padrão detectado pela Vercel.

O arquivo `vercel.json` já contém o rewrite de SPA para `index.html`.

## Variáveis públicas do frontend

Cadastre em **Production**, **Preview** e **Development**:

```env
VITE_SUPABASE_URL=https://fiuealmgufpmtgmxxpna.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_s63zvAG5397aTQG1V4hOeQ_CYa_7gSs
VITE_POSTHOG_KEY=phc_mn2tpC5fdmebBtDenSPZfDaAaeGaiUL2TZhDWRYSwD8L
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_BASE_PATH=/
```

As chaves acima são públicas/client-side. Não cadastrar no frontend `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` ou `OTP_HMAC_SECRET`.

## Depois do primeiro deploy

1. Copie a URL de produção gerada pela Vercel.
2. Adicione essa URL às URLs autorizadas do Supabase Auth.
3. Atualize o secret `ALLOWED_ORIGINS` da Edge Function `email-2fa` com a URL exata de produção.
4. Para previews que exigirem 2FA, autorize apenas hosts específicos de homologação; não use wildcard aberto.
5. Teste login, cadastro, recuperação, 2FA, chamada, manutenção, justificativas e relatórios.
