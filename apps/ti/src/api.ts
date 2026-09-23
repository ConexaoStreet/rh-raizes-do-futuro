import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && key);

export const supabase = configured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;

export function client() {
  if (!supabase) throw new Error("NOT_CONFIGURED");
  return supabase;
}

export async function rpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client().rpc(name, args);
  if (error) throw error;
  return data;
}

export async function updateSetting(key: string, value: Record<string, unknown>) {
  const { error } = await client()
    .from("settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw error;
}
