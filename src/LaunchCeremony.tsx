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

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 56 12" aria-hidden="true">
      <path d="M0 6h54M49 1l5 5-5 5" />
    </svg>
  );
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

      <div className="lc__veil" aria-hidden="true" />

      <main className="lc__panel">
        <div className="lc__brand">
          <img src="/brand/raizes-logo-mark.png" alt="" />
          <div>
            <p>Raízes do Futuro</p>
            <span>Gestão de RH</span>
          </div>
        </div>

        <div className="lc__ornament" aria-hidden="true">
          <i />
          <span />
          <i />
        </div>

        <div className="lc__copy">
          <p className="lc__eyebrow">Inauguração · 29.09.2026</p>
          <h1 id="lc-title">
            Hoje, o projeto
            <em>ganha vida.</em>
          </h1>
          <p id="lc-desc">
            Depois de planejamento, desenvolvimento e muitas decisões,
            o Raízes do Futuro abre suas portas.
          </p>
        </div>

        <div className="lc__event">
          <div>
            <CalendarIcon />
            <span>29 / SET / 2026</span>
          </div>
          <div>
            <ClockIcon />
            <span>08:00 — 14:00</span>
          </div>
        </div>

        <div className="lc__meta">
          <span>Espro</span>
          <i>·</i>
          <span>Anhanguera</span>
          <i>·</i>
          <span>Turma 16807</span>
        </div>

        <button
          ref={ctaRef}
          type="button"
          className="lc__cta"
          onClick={handleEnter}
          aria-label="Entrar no Raízes do Futuro"
        >
          <span>Entrar no Raízes</span>
          <ArrowIcon />
        </button>
      </main>

      <div className="lc__timer" aria-label={`Tempo restante: ${remaining}`}>
        <span>Encerra em</span>
        <strong>{remaining}</strong>
      </div>

      <div className="lc__theme-mark" aria-hidden="true">
        Experiência {String(theme).padStart(2, "0")}
      </div>
    </div>
  );
}
