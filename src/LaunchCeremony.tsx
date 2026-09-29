import { useCallback, useEffect, useRef, useState } from "react";
import "./launch-ceremony.css";

const THEME_COLOR = "#07110d";
const THEME_KEY = "raizes-inauguracao-theme-v4";
const EXIT_MS = 460;

export interface LaunchCeremonyProps {
  remaining: string;
  mode: "preview" | "official";
  onEnter: () => void;
}

function chooseTheme() {
  const params = new URLSearchParams(window.location.search);
  const requested = Number(params.get("tema"));
  if (Number.isInteger(requested) && requested >= 1 && requested <= 5) {
    return requested - 1;
  }

  try {
    const stored = Number(window.localStorage.getItem(THEME_KEY));
    if (Number.isInteger(stored) && stored >= 0 && stored <= 4) {
      return stored;
    }
  } catch {
    void 0;
  }

  let next = Math.floor(Math.random() * 5);
  try {
    if (typeof window.crypto?.getRandomValues === "function") {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      next = values[0] % 5;
    }
    window.localStorage.setItem(THEME_KEY, String(next));
  } catch {
    void 0;
  }

  return next;
}

export default function LaunchCeremony({
  remaining,
  mode,
  onEnter,
}: LaunchCeremonyProps) {
  const onEnterRef = useRef(onEnter);
  const exitTimer = useRef<number | undefined>(undefined);
  const [theme] = useState(chooseTheme);
  const [leaving, setLeaving] = useState(false);
  const themeNumber = theme + 1;
  const mobileSrc = `/launch/mobile-${themeNumber}.webp?v=5`;
  const desktopSrc = `/launch/desktop-${themeNumber}.webp?v=5`;

  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);

  useEffect(() => {
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = "hidden";

    const metas = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
    );
    const previousColors = metas.map((meta) => meta.content);
    let createdMeta: HTMLMetaElement | null = null;

    if (metas.length > 0) {
      metas.forEach((meta) => {
        meta.content = THEME_COLOR;
      });
    } else {
      createdMeta = document.createElement("meta");
      createdMeta.name = "theme-color";
      createdMeta.content = THEME_COLOR;
      document.head.appendChild(createdMeta);
    }

    return () => {
      html.style.overflow = previousOverflow;
      metas.forEach((meta, index) => {
        meta.content = previousColors[index];
      });
      if (createdMeta) createdMeta.remove();
    };
  }, []);

  useEffect(
    () => () => {
      if (exitTimer.current !== undefined) {
        window.clearTimeout(exitTimer.current);
      }
    },
    [],
  );

  const handleEnter = useCallback(() => {
    if (exitTimer.current !== undefined) return;
    setLeaving(true);
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    exitTimer.current = window.setTimeout(
      () => onEnterRef.current(),
      reduceMotion ? 0 : EXIT_MS,
    );
  }, []);

  return (
    <div
      className={leaving ? "lc lc--leaving" : "lc"}
      role="dialog"
      aria-modal="true"
      aria-label="Inauguração do Raízes do Futuro"
      lang="pt-BR"
    >
      <button
        type="button"
        className="lc__artboard"
        onClick={handleEnter}
        aria-label="Entrar no Raízes do Futuro"
      >
        <picture className="lc__picture" aria-hidden="true">
          <source media="(max-width: 760px)" srcSet={mobileSrc} />
          <img
            className="lc__image"
            src={desktopSrc}
            alt=""
            decoding="async"
            fetchPriority="high"
            draggable={false}
          />
        </picture>

        <span className="lc__shade" aria-hidden="true" />

        <span className="lc__sr">
          Raízes do Futuro. Gestão de RH. Hoje, o projeto ganha vida.
          Inauguração em 29 de setembro de 2026. Apresentação das 08:00 às
          14:00. Espro, Anhanguera, Turma 16807. Entrar no Raízes.
        </span>
      </button>

      <div className="lc__status" aria-live="polite">
        <span>{mode === "preview" ? "Prévia · abre em" : "Ao vivo · encerra em"}</span>
        <strong>{remaining}</strong>
      </div>

      <div className="lc__hint" aria-hidden="true">
        Toque para entrar
      </div>
    </div>
  );
}
