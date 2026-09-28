import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { observe, observeError } from "../_shared/observability.ts";

type NotificationPayload = {
  id: string;
  user_id: string;
  title: string;
  body?: string;
  path?: string;
  scope?: string;
};

const appOrigin = "https://rh-raizes-do-futuro.vercel.app";
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

Deno.serve(async (request) => {
  const startedAt = Date.now();
  if (request.method !== "POST") return respond({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const emailFrom = Deno.env.get("EMAIL_FROM");
    if (!url || !serviceRole || !resendKey || !emailFrom)
      return respond({ error: "CONFIGURATION_REQUIRED" }, 503);

    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: config, error: configError } = await admin
      .from("push_config")
      .select("webhook_secret")
      .eq("id", 1)
      .single();
    if (configError || !config) return respond({ error: "CONFIGURATION_REQUIRED" }, 503);

    const secret = request.headers.get("x-push-webhook-secret");
    if (!secret || secret !== config.webhook_secret)
      return respond({ error: "FORBIDDEN" }, 403);

    const raw = await request.text();
    if (raw.length > 20000) return respond({ error: "INVALID_REQUEST" }, 400);
    const parsed = JSON.parse(raw || "{}") as { notification?: NotificationPayload };
    const notification = parsed.notification;

    if (
      !notification?.id ||
      !notification.user_id ||
      !notification.title ||
      (notification.scope || "rh") !== "rh"
    ) {
      return respond({ ok: true, skipped: true });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("full_name,email,status")
      .eq("id", notification.user_id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.email || profile.status !== "active")
      return respond({ ok: true, skipped: true });

    const firstName = (profile.full_name || "Olá").trim().split(/\s+/)[0] || "Olá";
    const bodyText = notification.body || "Você tem uma nova atualização no RH.";
    const targetUrl = `${appOrigin}/#${notification.path || "/notificacoes"}`;
    const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#07110d;font-family:Arial,Helvetica,sans-serif;color:#eef7f1"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#07110d;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#0d1f17;border:1px solid #234433;border-radius:20px;overflow:hidden"><tr><td style="padding:30px 34px 22px;background:linear-gradient(135deg,#0b1a13,#153827);border-bottom:1px solid #234433"><div style="font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#9bc8a9;font-weight:700">Raízes do Futuro · Gestão de RH</div><div style="font-size:28px;line-height:1.15;font-weight:800;color:#fff;margin-top:12px">${escapeHtml(notification.title)}</div></td></tr><tr><td style="padding:28px 34px"><div style="font-size:17px;font-weight:800;color:#fff">Oi, ${escapeHtml(firstName)}.</div><div style="font-size:15px;line-height:1.7;color:#b7cbbd;margin-top:10px">${escapeHtml(bodyText)}</div><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px"><tr><td><a href="${targetUrl}" style="display:inline-block;background:#b9df78;color:#07110d;text-decoration:none;font-size:14px;font-weight:800;padding:13px 20px;border-radius:10px">Ver no RH</a></td></tr></table><div style="font-size:12px;line-height:1.6;color:#6f8b7a;margin-top:26px">Este aviso foi gerado porque uma informação do RH ligada ao seu cadastro foi criada ou alterada.</div></td></tr></table></td></tr></table></body></html>`;

    const email = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `rh-notification-${notification.id}`,
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [profile.email],
        subject: `${notification.title} | Raízes do Futuro`,
        text: `Oi, ${firstName}. ${bodyText} Acesse: ${targetUrl}`,
        html,
      }),
    });

    if (!email.ok) {
      observe("rh_notify.email", {
        outcome: "delivery_failed",
        status: email.status,
        latency_ms: Date.now() - startedAt,
      });
      return respond({ error: "EMAIL_DELIVERY_FAILED" }, 502);
    }

    observe("rh_notify.email", {
      outcome: "ok",
      status: 200,
      latency_ms: Date.now() - startedAt,
    });
    return respond({ ok: true });
  } catch (error) {
    observeError("rh_notify.error", error, {
      status: 503,
      latency_ms: Date.now() - startedAt,
    });
    return respond({ error: "UNAVAILABLE" }, 503);
  }
});
