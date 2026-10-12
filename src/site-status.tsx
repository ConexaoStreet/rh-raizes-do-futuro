import { createContext, useContext, useEffect, type ReactNode } from "react";
import { rpc, supabase, useAsync } from "./api";

export type MaintenanceState = {
  enabled: boolean;
  title?: string;
  message?: string;
  started_at?: string | null;
  updated_at?: string;
};
export type SiteUpdate = {
  sequence: number;
  pack: number;
  kind: "progress" | "release";
  status: "planned" | "working" | "verifying" | "published" | "blocked";
  title: string;
  body: string;
  release_tag: string | null;
  created_at: string;
  updated_at: string;
};
export type SiteStatus = {
  maintenance: MaintenanceState;
  updates: SiteUpdate[];
  server_time: string;
};
type StatusContext = {
  data: SiteStatus | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
};
const SiteContext = createContext<StatusContext | null>(null);

export function SiteStatusProvider({ children }: { children: ReactNode }) {
  const status = useAsync(async () => {
    const value = (await rpc("site_status", {})) as unknown as SiteStatus;
    if (!value?.maintenance || !Array.isArray(value.updates))
      throw new Error("STATUS_UNAVAILABLE");
    return value;
  });
  const { reload } = status;
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (document.visibilityState === "visible") reload();
      }, 150);
    };
    const channel = supabase
      ?.channel(`site-status-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_updates" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_maintenance" },
        refresh,
      )
      .subscribe((state) => {
        if (state === "SUBSCRIBED") refresh();
      });
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearTimeout(debounce);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [reload]);
  return <SiteContext.Provider value={status}>{children}</SiteContext.Provider>;
}

export function useSiteStatus() {
  const value = useContext(SiteContext);
  if (!value) throw new Error("SITE_STATUS_REQUIRED");
  return value;
}
