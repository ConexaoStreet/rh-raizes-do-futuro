import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Database, Json } from "./database.types";
import { errorMessage } from "./domain";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const configured = Boolean(url && key);
export const supabase = configured
  ? createClient<Database>(url!, key!, {
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
export async function rpc<N extends keyof Database["public"]["Functions"]>(
  name: N,
  args: Database["public"]["Functions"][N]["Args"],
) {
  const { data, error } = await client().rpc(name, args);
  if (error) throw error;
  return data;
}
export function json(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
export function useAsync<T>(
  loader: () => Promise<T>,
  dependencies: unknown[] = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);
  const ref = useRef(loader);
  ref.current = loader;
  const key = JSON.stringify(dependencies);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    ref
      .current()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, loading, error, reload, setData };
}
export async function runAction(
  action: () => Promise<unknown>,
  success = "Salvo com sucesso.",
) {
  try {
    await action();
    if (success) toast.success(success);
    return true;
  } catch (error) {
    toast.error(errorMessage(error));
    return false;
  }
}
export function useDebounce<T>(value: T, delay = 250) {
  const [result, setResult] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setResult(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return result;
}
export async function uploadAttachment(
  file: File,
  employeeId: string,
  links: { justificationId?: string; feedbackId?: string } = {},
) {
  const allowed = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (file.size > 10 * 1024 * 1024 || !allowed.includes(file.type))
    throw new Error("INVALID_FILE");
  const ext =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "bin";
  const bucket = links.justificationId
    ? "justifications"
    : links.feedbackId
      ? "feedback-files"
      : "documents";
  const path = `${employeeId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await client()
    .storage.from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return rpc("attach_file", {
    payload: json({
      employee_id: employeeId,
      justification_id: links.justificationId || null,
      feedback_id: links.feedbackId || null,
      bucket,
      path,
      filename: file.name,
      size_bytes: file.size,
      mime_type: file.type,
    }),
  });
}
export async function signedUrl(bucket: string, path: string) {
  const { data, error } = await client()
    .storage.from(bucket)
    .createSignedUrl(path, 120);
  if (error) throw error;
  return data.signedUrl;
}
