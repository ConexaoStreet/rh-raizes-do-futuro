import { client, rpc } from "./api";

const VAPID_PUBLIC_KEY =
  "BCBiKlyQH9HK2q2DxWy7KE2dcRMZ_8TvyEKSC0W4HoEsPUX_T3JJ42bUlpPuVeaaNMVUjrA-2EagJtcasmvHPJY";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function enablePushNotifications() {
  if (!pushSupported()) throw new Error("PUSH_UNSUPPORTED");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("PUSH_PERMISSION_REQUIRED");

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(VAPID_PUBLIC_KEY),
    });
  }

  const serialized = subscription.toJSON();
  if (!subscription.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth)
    throw new Error("PUSH_SUBSCRIPTION_INVALID");

  await rpc("register_push_subscription", {
    endpoint_value: subscription.endpoint,
    p256dh_value: serialized.keys.p256dh,
    auth_value: serialized.keys.auth,
    user_agent_value: navigator.userAgent,
  });

  const { data, error } = await client().functions.invoke("push-notify", {
    body: { action: "sync", limit: 5 },
  });
  if (error) throw error;

  return data;
}
