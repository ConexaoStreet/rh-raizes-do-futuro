import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { observe, observeError } from "../_shared/observability.ts";

type NotificationPayload = {
  id: string;
  user_id: string;
  title: string;
  body?: string;
  path?: string;
  scope?: string;
  event_type?: string;
  created_at?: string;
};

type PushConfig = {
  webhook_secret: string | null;
};

const appOrigin = "https://rh-raizes-do-futuro.vercel.app";

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const safePath = (value?: string) =>
  value?.startsWith("/") && !value.startsWith("//") ? value : "/notificacoes";

Deno.serve(async (request) => {
  const startedAt = Date.now();
  let completeOnFailure: (() => Promise<void>) | null = null;

  if (request.method !== "POST")
    return respond({ error: "METHOD_NOT_ALLOWED" }, 405);

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

    const { data: configData, error: configError } =
      await admin.rpc("service_push_config");
    const config = (
      Array.isArray(configData) ? configData[0] : configData
    ) as PushConfig | null;

    if (configError || !config?.webhook_secret)
      return respond({ error: "CONFIGURATION_REQUIRED" }, 503);

    const secret = request.headers.get("x-push-webhook-secret");
    if (!secret || secret !== config.webhook_secret)
      return respond({ error: "FORBIDDEN" }, 403);

    const raw = await request.text();
    if (raw.length > 20000)
      return respond({ error: "INVALID_REQUEST" }, 400);

    const parsed = JSON.parse(raw || "{}") as {
      notification?: NotificationPayload;
    };
    const notification = parsed.notification;

    if (
      !notification?.id ||
      !notification.user_id ||
      !notification.title ||
      (notification.scope || "rh") !== "rh"
    ) {
      return respond({ ok: true, skipped: true });
    }

    const { data: claimData, error: claimError } = await admin.rpc(
      "claim_notification_delivery",
      {
        notification_identifier: notification.id,
        delivery_channel: "email",
      },
    );
    if (claimError) throw claimError;
    const claimed = claimData === true;

    if (!claimed)
      return respond({ ok: true, skipped: true, reason: "already_handled" });

    const complete = async (
      status: "sent" | "skipped" | "failed",
      providerId: string | null = null,
      errorCode: string | null = null,
    ) => {
      const { error } = await admin.rpc("complete_notification_delivery", {
        notification_identifier: notification.id,
        delivery_channel: "email",
        delivery_status: status,
        provider_identifier: providerId,
        error_code: errorCode,
      });
      if (error) throw error;
    };

    completeOnFailure = () => complete("failed", null, "UNAVAILABLE");

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("full_name,email,status")
      .eq("id", notification.user_id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile?.email || profile.status !== "active") {
      await complete("skipped", null, "NO_ACTIVE_EMAIL");
      return respond({ ok: true, skipped: true });
    }

    const firstName =
      (profile.full_name || "Olá").trim().split(/\s+/)[0] || "Olá";
    const rawBody =
      notification.body || "Você tem uma nova atualização no RH.";
    const firstNamePrefix = `${firstName.toLocaleLowerCase("pt-BR")}, `;
    const bodyText = rawBody.toLocaleLowerCase("pt-BR").startsWith(firstNamePrefix)
      ? rawBody.slice(firstName.length + 2)
      : rawBody;
    const targetUrl = `${appOrigin}/#${safePath(notification.path)}`;
    const eventDate = notification.created_at
      ? new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "long",
          timeZone: "America/Sao_Paulo",
        }).format(new Date(notification.created_at))
      : null;

    const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#07110d;font-family:Arial,Helvetica,sans-serif;color:#eef7f1"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#07110d;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#0d1f17;border:1px solid #234433;border-radius:20px;overflow:hidden"><tr><td style="padding:30px 34px 22px;background:linear-gradient(135deg,#0b1a13,#153827);border-bottom:1px solid #234433"><div style="font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#9bc8a9;font-weight:700">Raízes do Futuro · Gestão de RH</div><div style="font-size:28px;line-height:1.15;font-weight:800;color:#fff;margin-top:12px">${escapeHtml(notification.title)}</div></td></tr><tr><td style="padding:28px 34px"><div style="font-size:17px;font-weight:800;color:#fff">Oi, ${escapeHtml(firstName)}.</div><div style="font-size:15px;line-height:1.7;color:#b7cbbd;margin-top:10px">${escapeHtml(bodyText)}</div>${eventDate ? `<div style="font-size:12px;color:#789284;margin-top:12px">Atualização de ${escapeHtml(eventDate)}</div>` : ""}<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px"><tr><td><a href="${targetUrl}" style="display:inline-block;background:#b9df78;color:#07110d;text-decoration:none;font-size:14px;font-weight:800;padding:13px 20px;border-radius:10px">Ver no RH</a></td></tr></table><div style="font-size:12px;line-height:1.6;color:#6f8b7a;margin-top:26px">Este aviso foi gerado porque uma informação do RH ligada ao seu cadastro foi criada ou alterada.</div></td></tr></table></td></tr></table></body></html>`;

    let response: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `rh-notification-${notification.id}`,
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [profile.email],
          subject: "Você tem uma atualização no RH | Raízes do Futuro",
          text: `Oi, ${firstName}. ${bodyText} Acesse: ${targetUrl}`,
          html,
        }),
      });

      if (response.ok) break;
      if (response.status !== 429 && response.status < 500) break;
    }

    if (!response?.ok) {
      let providerErrorName = "";
      let providerErrorMessage = "";
      try {
        const providerError = (await response?.json()) as {
          name?: string;
          message?: string;
        };
        providerErrorName = providerError?.name || "";
        providerErrorMessage = providerError?.message || "";
      } catch {
        providerErrorName = "";
        providerErrorMessage = "";
      }

      const domainRequired =
        response?.status === 403 &&
        providerErrorName === "validation_error" &&
        /only send testing emails|verify a domain/i.test(providerErrorMessage);

      if (domainRequired) {
        await complete("skipped", null, "RESEND_DOMAIN_REQUIRED");
        observe("rh_notify.email", {
          outcome: "configuration_required",
          status: 403,
          latency_ms: Date.now() - startedAt,
        });
        return respond({
          ok: true,
          skipped: true,
          reason: "email_domain_required",
        });
      }

      const errorCode = `RESEND_HTTP_${response?.status || 503}`;
      await complete("failed", null, errorCode);
      observe("rh_notify.email", {
        outcome: "delivery_failed",
        status: response?.status || 503,
        latency_ms: Date.now() - startedAt,
      });
      return respond({ error: "EMAIL_DELIVERY_FAILED" }, 502);
    }

    let providerId: string | null = null;
    try {
      const result = (await response.json()) as { id?: string };
      providerId = result.id || null;
    } catch {
      providerId = null;
    }

    await complete("sent", providerId);
    observe("rh_notify.email", {
      outcome: "ok",
      status: 200,
      latency_ms: Date.now() - startedAt,
    });
    return respond({ ok: true });
  } catch (error) {
    if (completeOnFailure) {
      try {
        await completeOnFailure();
      } catch {
        void 0;
      }
    }
    observeError("rh_notify.error", error, {
      status: 503,
      latency_ms: Date.now() - startedAt,
    });
    return respond({ error: "UNAVAILABLE" }, 503);
  }
});
