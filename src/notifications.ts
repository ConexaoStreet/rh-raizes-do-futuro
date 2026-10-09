import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type NotificationClient = Pick<
  SupabaseClient<Database>,
  "channel" | "removeChannel"
>;
export function watchNotifications(
  api: NotificationClient,
  userId: string,
  onChange: () => void,
  win: EventTarget = window,
  doc: EventTarget & { visibilityState: string } = document,
) {
  let disposed = false;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    if (disposed || doc.visibilityState !== "visible") return;
    clearTimeout(pending);
    pending = setTimeout(() => {
      if (!disposed && doc.visibilityState === "visible") onChange();
    }, 200);
  };
  const channel = api
    .channel(`rh-notifications-${userId}-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      refresh,
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") refresh();
    });
  const interval = setInterval(refresh, 60_000);
  win.addEventListener("focus", refresh);
  win.addEventListener("online", refresh);
  doc.addEventListener("visibilitychange", refresh);
  return () => {
    disposed = true;
    clearTimeout(pending);
    clearInterval(interval);
    win.removeEventListener("focus", refresh);
    win.removeEventListener("online", refresh);
    doc.removeEventListener("visibilitychange", refresh);
    void api.removeChannel(channel);
  };
}
