import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "raizes-theme";

function resolveTheme(mode: ThemeMode) {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.style.colorScheme = resolved;
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });

  useEffect(() => {
    applyTheme(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (mode === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  return { mode, setMode: setModeState, resolved: resolveTheme(mode) };
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useTheme();
  const next: ThemeMode = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
  const label = mode === "system" ? "Automático" : mode === "light" ? "Claro" : "Escuro";
  const Icon = mode === "system" ? Monitor : mode === "light" ? Sun : Moon;

  return (
    <button
      type="button"
      className={compact ? "theme-toggle theme-toggle-compact" : "theme-toggle"}
      onClick={() => setMode(next)}
      aria-label={`Tema atual: ${label}. Alterar tema.`}
      title={`Tema: ${label}`}
    >
      <Icon size={17} />
      {!compact && <span>{label}</span>}
    </button>
  );
}

export function initializeTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const mode: ThemeMode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  applyTheme(mode);
}
