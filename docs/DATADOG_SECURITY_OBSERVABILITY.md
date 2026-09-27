# Datadog Security Observability

## Status

Prepared in code, external ingestion not activated.

The connected Datadog account currently exposes no service, dashboard, or monitor matching Raízes do Futuro or RH. The available connection does not confirm the billing plan or entitlement for log ingestion, log drains, APM, RUM, or additional security products. No paid or potentially paid Datadog resource is enabled by this change.

## Existing telemetry

The browser already uses PostHog with explicit events, IP anonymization, autocapture disabled, and session replay disabled. Datadog must not duplicate browser analytics by default.

The Datadog path is limited to backend and infrastructure observability unless a future approved change explicitly expands that scope.

## Prepared event source

Supabase Edge Functions emit privacy-safe structured JSON through:

`supabase/functions/_shared/observability.ts`

Default metadata:

- `service=raizes-rh`
- `source=supabase-edge`
- `environment` from `APP_ENV`, defaulting to `production`
- `version` from `APP_VERSION`, defaulting to `unknown`
- timestamp
- event name
- low-cardinality operational fields

Instrumented flows:

- `registration-bootstrap`
- `ti-code-login`
- `push-notify`

Priority security and reliability events include denied origin, invalid method, oversized request, invalid code, rate limiting, invalid session, failed confirmation, unavailable dependency, push delivery error, and successful aggregate delivery counts.

## Privacy boundary

The helper rejects fields whose keys indicate sensitive content, including e-mail, full name, phone, document, registration, free-text reason, notes, message body, tokens, secrets, passwords, claims, fingerprints, authorization values, endpoints, stack traces, user IDs, session IDs, and IP addresses.

Errors are reduced to safe type and machine code. Raw error messages and stack traces are not logged by the instrumented functions.

No request body, access code, OTP, e-mail address, person name, notification text, browser fingerprint, token, or authorization header is emitted.

## Datadog activation gate

External ingestion may be enabled only after the current Datadog plan and the selected integration are confirmed to be available without unapproved cost.

Preferred order:

1. Use an official supported Supabase, Vercel, or OpenTelemetry path already included in the current entitlement.
2. Ingest the structured Supabase Edge logs without adding browser RUM.
3. Preserve `service=raizes-rh`, `env`, and `version` tags.
4. Keep session replay disabled.
5. Validate a synthetic event that contains no PII before creating alert rules.
6. Create dashboards and monitors only after real ingestion is visible.

## Initial dashboard scope after ingestion

Recommended backend views:

- Edge Function requests by event and status
- 401, 403, and 429 trends
- T.I. code login rate limiting
- registration bootstrap failures
- push delivery errors by status
- latency for instrumented flows
- error rate by environment and version

## Initial monitor scope after ingestion

Recommended conditions:

- sustained increase in 401 or 403 events
- repeated 429 events in the T.I. code login flow
- `registration_bootstrap.error` above normal baseline
- `ti_code_login.error` or `confirm_failed` above normal baseline
- `push_notify.error` or repeated delivery errors
- sudden rise in Edge Function 5xx responses

Thresholds must be based on real production baselines instead of invented values.

## Secrets

Datadog API keys, application keys, tokens, Supabase service-role credentials, Resend credentials, OTP secrets, and other backend secrets must remain in provider secret stores. They must not be added to the repository, browser environment, log payloads, screenshots, or reports.
