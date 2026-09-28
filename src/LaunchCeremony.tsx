import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import "./launch-ceremony.css";

const LOGO_SRC = "/brand/raizes-logo-mark.png";
const THEME_COLOR = "#07110d";
const EXIT_MS = 460;

export interface LaunchCeremonyProps {
  remaining: string;
  onEnter: () => void;
}

const cssVars = (vars: Record<string, string>): CSSProperties =>
  vars as unknown as CSSProperties;

const at = (ms: number): CSSProperties => cssVars({ "--d": `${ms}ms` });

export default function LaunchCeremony({
  remaining,
  onEnter,
}: LaunchCeremonyProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const desktopCtaRef = useRef<HTMLButtonElement>(null);
  const mobileCtaRef = useRef<HTMLButtonElement>(null);
  const onEnterRef = useRef(onEnter);
  const exitTimer = useRef<number | undefined>(undefined);
  const [leaving, setLeaving] = useState(false);

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
    if (event.key !== "Tab") return;
    event.preventDefault();
    const mobile =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 760px)").matches;
    const target = mobile ? mobileCtaRef.current : desktopCtaRef.current;
    target?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={leaving ? "lc lc--leaving" : "lc"}
      role="dialog"
      aria-modal="true"
      aria-label="Inauguração do Raízes do Futuro"
      lang="pt-BR"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="lc__desktop">
        <div className="lc__frame">
          <header className="lc__top">
            <div className="lc__brand">
              <img
                className="lc__logo lc__fx"
                style={at(300)}
                src={LOGO_SRC}
                alt=""
                decoding="async"
                draggable={false}
              />
              <p className="lc__brandtext lc__fx" style={at(420)}>
                <strong>Raízes do Futuro</strong>
                <span>Gestão de RH</span>
              </p>
            </div>
            <p className="lc__label lc__label--mid lc__fx" style={at(680)}>
              Inauguração oficial
            </p>
            <p className="lc__label lc__label--end lc__fx" style={at(760)}>
              Dia 01
            </p>
          </header>

          <div className="lc__stage">
            <div className="lc__sky">
              <h1 className="lc__title">
                <span className="lc__mask">
                  <span className="lc__rise" style={at(780)}>
                    Hoje, o projeto
                  </span>
                </span>{" "}
                <span className="lc__mask">
                  <em className="lc__rise" style={at(900)}>
                    ganha vida.
                  </em>
                </span>
              </h1>

              <time className="lc__date" dateTime="2026-09-29">
                <span className="lc__sr">29 de setembro de 2026, terça-feira</span>
                <span className="lc__mask lc__mask--num" aria-hidden="true">
                  <span className="lc__num lc__rise" style={at(520)}>
                    29
                  </span>
                </span>
                <span className="lc__meta lc__fx" style={at(980)} aria-hidden="true">
                  <span>Setembro</span>
                  <span>2026</span>
                  <span>Terça-feira</span>
                </span>
              </time>
            </div>

            <div className="lc__ground">
              <div className="lc__horizon" aria-hidden="true" />
              <span className="lc__node" aria-hidden="true" />

              <div
                className="lc__col lc__col--lede"
                style={cssVars({ "--h": "100%", "--d": "520ms" })}
              >
                <p className="lc__lede lc__fx" style={at(1000)}>
                  Depois de planejamento, desenvolvimento e muitas decisões, o Raízes do
                  Futuro abre suas portas.
                </p>
              </div>

              <div
                className="lc__col lc__col--time"
                style={cssVars({ "--h": "70%", "--d": "640ms" })}
              >
                <p className="lc__label lc__fx" style={at(1080)}>
                  Apresentação
                </p>
                <p className="lc__time lc__fx" style={at(1130)}>
                  <span className="lc__sr">
                    Das 08:00 às 14:00, horário de São Paulo
                  </span>
                  <span aria-hidden="true">08:00</span>
                  <span className="lc__dash" aria-hidden="true">
                    &mdash;
                  </span>
                  <span aria-hidden="true">14:00</span>
                </p>
                <p className="lc__until lc__fx" style={at(1190)}>
                  Restam {remaining}
                </p>
              </div>

              <div
                className="lc__col lc__col--cta"
                style={cssVars({ "--h": "88%", "--d": "760ms" })}
              >
                <button
                  ref={desktopCtaRef}
                  type="button"
                  className="lc__cta lc__fx"
                  style={at(1240)}
                  onClick={handleEnter}
                  aria-label="Entrar no Raízes do Futuro"
                >
                  <span className="lc__cta-text">Entrar no Raízes</span>
                  <svg
                    className="lc__cta-arrow"
                    viewBox="0 0 56 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M0 6H54M49 1L54 6L49 11" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <footer className="lc__foot">
            <p className="lc__foot-item lc__foot-id lc__fx" style={at(1320)}>
              <span>Espro · Anhanguera</span>
              <span className="lc__sep" aria-hidden="true">
                /
              </span>
              <span>Turma 16807</span>
            </p>
            <p className="lc__foot-item lc__foot-live lc__fx" style={at(1380)}>
              <i className="lc__dot" aria-hidden="true" />
              Em andamento
            </p>
            <p className="lc__foot-item lc__foot-tz lc__fx" style={at(1440)}>
              São Paulo · UTC-3
            </p>
          </footer>
        </div>
      </div>

      <div className="lc__mobile">
        <header className="lcm__top">
          <div className="lcm__brand">
            <img
              className="lcm__logo lc__fx"
              style={at(220)}
              src={LOGO_SRC}
              alt=""
              decoding="async"
              draggable={false}
            />
            <div className="lcm__brand-copy lc__fx" style={at(320)}>
              <strong>Raízes do Futuro</strong>
              <span>Gestão de RH</span>
            </div>
          </div>
          <div className="lcm__edition lc__fx" style={at(420)}>
            Inauguração
            <br />
            29.09.2026
          </div>
        </header>

        <main className="lcm__main">
          <div className="lcm__date lc__fx" style={at(520)}>
            <strong className="lcm__date-number">29</strong>
            <span className="lcm__date-copy">
              <span>Set</span>
              <span>2026</span>
            </span>
          </div>

          <div>
            <p className="lcm__eyebrow lc__fx" style={at(620)}>
              Abertura especial · Dia 01
            </p>
            <h1 className="lcm__title">
              <span className="lc__mask">
                <span className="lc__rise" style={at(700)}>
                  Hoje, o projeto
                </span>
              </span>
              <span className="lc__mask">
                <em className="lc__rise" style={at(820)}>
                  ganha vida.
                </em>
              </span>
            </h1>
          </div>

          <div className="lcm__axis" aria-hidden="true" />

          <p className="lcm__copy lc__fx" style={at(940)}>
            Depois de planejamento, desenvolvimento e muitas decisões, o Raízes do
            Futuro abre suas portas.
          </p>

          <div className="lcm__bottom">
            <div className="lcm__schedule lc__fx" style={at(1060)}>
              <div className="lcm__schedule-block">
                <small>Apresentação</small>
                <strong>
                  08:00 <span aria-hidden="true">&mdash;</span> 14:00
                </strong>
              </div>
              <div className="lcm__schedule-block">
                <small>Tempo restante</small>
                <strong aria-live="polite">{remaining}</strong>
              </div>
            </div>

            <button
              ref={mobileCtaRef}
              type="button"
              className="lcm__cta lc__fx"
              style={at(1160)}
              onClick={handleEnter}
              aria-label="Entrar no Raízes do Futuro"
            >
              <span>Entrar no Raízes</span>
              <svg
                className="lcm__cta-arrow"
                viewBox="0 0 56 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M0 6H54M49 1L54 6L49 11" />
              </svg>
            </button>
          </div>
        </main>

        <footer className="lcm__footer lc__fx" style={at(1260)}>
          <span>Espro · Anhanguera</span>
          <span>Turma 16807</span>
        </footer>
      </div>
    </div>
  );
}
