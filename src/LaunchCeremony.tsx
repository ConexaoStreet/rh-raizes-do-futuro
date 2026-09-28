import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import "./launch-ceremony.css";

const THEME_COLOR = "#07110d";
const EXIT_MS = 460;
const THEME_COUNT = 5;
const THEME_KEY = "raizes-inauguracao-theme-2026";

export interface LaunchCeremonyProps {
  remaining: string;
  onEnter: () => void;
}

function pickThemeIndex() {
  try {
    const stored = Number(window.localStorage.getItem(THEME_KEY));
    if (Number.isInteger(stored) && stored >= 0 && stored < THEME_COUNT) {
      return stored;
    }

    let randomValue = Math.floor(Math.random() * 4294967296);
    if (
      window.crypto &&
      typeof window.crypto.getRandomValues === "function"
    ) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      randomValue = values[0] ?? randomValue;
    }

    const next = randomValue % THEME_COUNT;
    window.localStorage.setItem(THEME_KEY, String(next));
    return next;
  } catch {
    return Math.floor(Math.random() * THEME_COUNT);
  }
}

export default function LaunchCeremony({
  remaining,
  onEnter,
}: LaunchCeremonyProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const onEnterRef = useRef(onEnter);
  const exitTimer = useRef<number | undefined>(undefined);
  const [themeIndex] = useState(pickThemeIndex);
  const [leaving, setLeaving] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const theme = themeIndex + 1;

  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
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

    rootRef.current?.focus({ preventScroll: true });

    return () => {
      html.style.overflow = previousOverflow;
      metas.forEach((meta, index) => {
        meta.content = previousColors[index];
      });
      if (createdMeta) createdMeta.remove();
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus?.({ preventScroll: true });
      }
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      ctaRef.current?.focus();
    }
  };

  return (
    <div
      ref={rootRef}
      className={[
        "lc",
        leaving ? "lc--leaving" : "",
        imageFailed ? "lc--image-failed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-theme={theme}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lc-title"
      aria-describedby="lc-desc"
      lang="pt-BR"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <picture className="lc__picture" aria-hidden="true">
        <source
          media="(max-width: 760px)"
          srcSet={`/brand/inauguracao/mobile-${theme}.webp`}
        />
        <img
          className="lc__art"
          src={`/brand/inauguracao/desktop-${theme}.webp`}
          alt=""
          loading="eager"
          decoding="async"
          fetchPriority="high"
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      </picture>

      <div className="lc__shade" aria-hidden="true" />

      <div className="lc__semantic">
        <h1 id="lc-title">Hoje, o projeto ganha vida.</h1>
        <p id="lc-desc">
          Raízes do Futuro, Gestão de RH. Depois de planejamento,
          desenvolvimento e muitas decisões, o Raízes do Futuro abre suas
          portas em 29 de setembro de 2026, das 08:00 às 14:00. Espro,
          Anhanguera, Turma 16807.
        </p>
      </div>

      {imageFailed ? (
        <div className="lc__fallback" aria-hidden="true">
          <img src="/brand/raizes-logo-mark.png" alt="" />
          <p>Raízes do Futuro</p>
          <h2>
            Hoje, o projeto <em>ganha vida.</em>
          </h2>
          <span>29.09.2026 · 08:00 às 14:00</span>
        </div>
      ) : null}

      <div className="lc__timer" aria-label={`Tempo restante: ${remaining}`}>
        <span>Encerra em</span>
        <strong>{remaining}</strong>
      </div>

      <button
        ref={ctaRef}
        type="button"
        className="lc__cta-hit"
        onClick={handleEnter}
        aria-label="Entrar no Raízes do Futuro"
        title="Entrar no Raízes"
      >
        <span className="lc__semantic">Entrar no Raízes do Futuro</span>
      </button>
    </div>
  );
}
