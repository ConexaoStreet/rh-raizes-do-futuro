import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import webpush from "npm:web-push@3.6.7";
import { observe, observeError } from "../_shared/observability.ts";
import {
  isBrazilRequest,
  requestFingerprint,
  timingSafeEqual,
} from "../_shared/request-security.ts";

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  path: string;
  created_at: string;
};

type PushConfig = {
  vapid_public_key: string;
  vapid_private_key: string;
  webhook_secret: string;
};

const appOrigin = "https://rh-raizes-do-futuro.vercel.app";

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin === appOrigin ? origin : appOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
  Vary: "Origin",
});

const respond = (origin: string, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(origin) });

Deno.serve(async (request) => {
  const startedAt = Date.now();
  const origin = request.headers.get("origin") || "";

  if (request.method === "OPTIONS") {
    if (origin !== appOrigin || !isBrazilRequest(request))
      return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (request.method !== "POST")
    return respond(origin, { error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const raw = await request.text();
    if (raw.length > 20000)
      return respond(origin, { error: "INVALID_REQUEST" }, 400);

    let body: {
      action?: "sync" | "webhook";
      limit?: number;
      notification?: NotificationRow;
    };
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return respond(origin, { error: "INVALID_REQUEST" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRole)
      return respond(origin, { error: "CONFIGURATION_REQUIRED" }, 503);

    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: configRows, error: configError } = await admin.rpc(
      "service_push_config",
    );
    const config = (
      Array.isArray(configRows) ? configRows[0] : configRows
    ) as PushConfig | null;

    if (
      configError ||
      !config?.vapid_public_key ||
      !config.vapid_private_key ||
      !config.webhook_secret
    )
      return respond(origin, { error: "PUSH_NOT_CONFIGURED" }, 503);

    webpush.setVapidDetails(
      "mailto:rhraizesdofuturo@outlook.com.br",
      config.vapid_public_key,
      config.vapid_private_key,
    );

    async function sendToUser(userId: string, notification: NotificationRow) {
      const { data: subscriptions, error } = await admin
        .from("push_subscriptions")
        .select("id,endpoint,p256dh,auth")
        .eq("user_id", userId);

      if (error) throw error;
      if (!subscriptions?.length) return 0;

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body || "Você tem uma nova notificação no RH.",
        url: `${appOrigin}/#${notification.path || "/notificacoes"}`,
        tag: `raizes-${notification.id}`,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
      });

      let sent = 0;
      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            payload,
            { TTL: 86400, urgency: "high" },
          );
          sent += 1;
        } catch (error) {
          const statusCode =
            typeof error === "object" && error && "statusCode" in error
              ? Number((error as { statusCode?: number }).statusCode || 0)
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            await admin
              .from("push_subscriptions")
              .delete()
              .eq("id", subscription.id);
            continue;
          }
          observeError("push_notify.delivery_error", error, {
            status: statusCode || 500,
          });
        }
      }
      return sent;
    }

    if (body.action === "webhook") {
      const secret = request.headers.get("x-push-webhook-secret") || "";
      if (
        !secret ||
        !timingSafeEqual(secret, String(config.webhook_secret || ""))
      ) {
        const fingerprint = await requestFingerprint(
          request,
          serviceRole,
          "push-notify:webhook-denied",
        );
        const { data: allowed } = await admin.rpc("consume_edge_rate_limit", {
          rate_scope: "push-notify:webhook-denied",
          fingerprint_hash: fingerprint,
          max_attempts: 20,
          window_seconds: 300,
        });
        observe("push_notify.webhook", {
          outcome: allowed === false ? "rate_limited" : "forbidden",
          status: allowed === false ? 429 : 403,
          latency_ms: Date.now() - startedAt,
        });
        return respond(
          origin,
          { error: allowed === false ? "RATE_LIMITED" : "FORBIDDEN" },
          allowed === false ? 429 : 403,
        );
      }

      const notification = body.notification;
      if (!notification?.id || !notification.user_id || !notification.title)
        return respond(origin, { error: "INVALID_NOTIFICATION" }, 400);

      const sent = await sendToUser(notification.user_id, notification);
      observe("push_notify.webhook", {
        outcome: "ok",
        status: 200,
        deliveries: sent,
        latency_ms: Date.now() - startedAt,
      });
      return respond(origin, { ok: true, sent });
    }

    if (body.action === "sync") {
      if (origin !== appOrigin)
        return respond(origin, { error: "ORIGIN_NOT_ALLOWED" }, 403);
      if (!isBrazilRequest(request))
        return respond(origin, { error: "REGION_NOT_ALLOWED" }, 403);

      const fingerprint = await requestFingerprint(
        request,
        serviceRole,
        "push-notify:sync",
      );
      const { data: rateAllowed, error: rateError } = await admin.rpc(
        "consume_edge_rate_limit",
        {
          rate_scope: "push-notify:sync",
          fingerprint_hash: fingerprint,
          max_attempts: 30,
          window_seconds: 300,
        },
      );
      if (rateError)
        return respond(origin, { error: "SECURITY_CHECK_UNAVAILABLE" }, 503);
      if (rateAllowed !== true)
        return respond(origin, { error: "RATE_LIMITED" }, 429);

      const authorization = request.headers.get("authorization") || "";
      const token = authorization.replace(/^Bearer\s+/i, "").trim();
      if (!token) return respond(origin, { error: "AUTH_REQUIRED" }, 401);

      const { data: authData, error: authError } =
        await admin.auth.getUser(token);
      if (authError || !authData.user)
        return respond(origin, { error: "AUTH_REQUIRED" }, 401);

      const { data: profile } = await admin
        .from("profiles")
        .select("status")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profile?.status !== "active")
        return respond(origin, { error: "ACCOUNT_NOT_READY" }, 403);

      const limit = Math.max(1, Math.min(Number(body.limit || 5), 5));
      const { data: notifications, error: notificationsError } = await admin
        .from("notifications")
        .select("id,user_id,title,body,path,created_at")
        .eq("user_id", authData.user.id)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (notificationsError) throw notificationsError;

      let sent = 0;
      for (const notification of (notifications || []).reverse()) {
        sent += await sendToUser(
          authData.user.id,
          notification as NotificationRow,
        );
      }

      observe("push_notify.sync", {
        outcome: "ok",
        status: 200,
        notification_count: notifications?.length || 0,
        deliveries: sent,
        latency_ms: Date.now() - startedAt,
      });
      return respond(origin, {
        ok: true,
        notifications: notifications?.length || 0,
        deliveries: sent,
      });
    }

    observe("push_notify.request", {
      outcome: "invalid_action",
      status: 400,
      latency_ms: Date.now() - startedAt,
    });
    return respond(origin, { error: "INVALID_ACTION" }, 400);
  } catch (error) {
    observeError("push_notify.error", error, {
      status: 503,
      latency_ms: Date.now() - startedAt,
    });
    return respond(origin, { error: "UNAVAILABLE" }, 503);
  }
});
