import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  hasNewRelease,
  installedRelease,
  parseRelease,
  type ReleaseVersion,
} from "./release-version";

export default function ReleaseNotice() {
  const [available, setAvailable] = useState<ReleaseVersion | null>(null);
  const [dismissed, setDismissed] = useState("");
  useEffect(() => {
    if (!installedRelease) return;
    let controller: AbortController | null = null;
    let disposed = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || controller) return;
      controller = new AbortController();
      try {
        const response = await fetch(
          new URL("release.json", document.baseURI),
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) return;
        const manifest = parseRelease(await response.json());
        if (!disposed && hasNewRelease(installedRelease, manifest))
          setAvailable(manifest);
      } catch {
        return;
      } finally {
        controller = null;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, []);
  if (!available || available.version === dismissed) return null;
  return (
    <aside
      role="status"
      aria-label="Nova versão disponível"
      className="release-notice"
    >
      <style>{`.release-notice{position:fixed;z-index:80;right:16px;bottom:16px;width:min(370px,calc(100vw - 32px));padding:20px;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:20px;box-shadow:0 16px 60px #10291a30}.release-notice strong{display:block;font-size:18px;margin-bottom:8px}.release-notice p{font-size:13px;line-height:1.55;overflow-wrap:anywhere}.release-notice-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.release-notice-actions a{font-size:13px;padding:8px}.release-notice button{font-size:12px;padding:9px 12px}`}</style>
      <strong>Tem novidade no Raízes</strong>
      <p>
        Versão {available.version}. {available.changes[0]} Atualize quando
        terminar o que está fazendo.
      </p>
      <div className="release-notice-actions">
        <button className="primary" onClick={() => window.location.reload()}>
          Atualizar agora
        </button>
        <Link to="/ao-vivo">Ver o que mudou</Link>
        <button
          className="ghost"
          onClick={() => setDismissed(available.version)}
        >
          Depois
        </button>
      </div>
    </aside>
  );
}
