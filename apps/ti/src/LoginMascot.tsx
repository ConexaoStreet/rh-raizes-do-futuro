import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

export type MascotMood =
  | "idle"
  | "email"
  | "password"
  | "peek"
  | "code"
  | "work"
  | "alert"
  | "error"
  | "success";

type Placement = "login" | "datasul";

type MascotProps = {
  mood?: MascotMood;
  placement?: Placement;
  scopeSelector?: string;
};

type Gaze = {
  x: number;
  y: number;
  tilt: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isTrackable(
  node: EventTarget | Element | null,
): node is HTMLInputElement | HTMLTextAreaElement {
  if (node instanceof HTMLTextAreaElement) return true;
  if (!(node instanceof HTMLInputElement)) return false;
  return ![
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ].includes(node.type);
}

function moodForField(
  field: HTMLInputElement | HTMLTextAreaElement,
): MascotMood {
  const name = field.getAttribute("name") || "";
  if (name === "access_code" || field.classList.contains("weekly-access-code"))
    return "code";
  if (field instanceof HTMLInputElement && field.type === "email")
    return "email";
  if (name.toLowerCase().includes("password")) {
    if (field instanceof HTMLInputElement && field.type === "text")
      return "peek";
    return "password";
  }
  return "work";
}

function caretPoint(
  field: HTMLInputElement | HTMLTextAreaElement,
): { x: number; y: number } {
  const rect = field.getBoundingClientRect();
  const position = field.selectionStart ?? field.value.length;
  const style = window.getComputedStyle(field);
  const mirror = document.createElement("div");
  const marker = document.createElement("span");

  mirror.style.position = "fixed";
  mirror.style.left = rect.left + "px";
  mirror.style.top = rect.top + "px";
  mirror.style.width = field.clientWidth + "px";
  mirror.style.height = field.clientHeight + "px";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontStyle = style.fontStyle;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.textTransform = style.textTransform;
  mirror.style.textIndent = style.textIndent;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.overflow = "hidden";

  if (field instanceof HTMLTextAreaElement) {
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordBreak = "break-word";
    mirror.style.overflowWrap = "break-word";
  } else {
    mirror.style.whiteSpace = "pre";
  }

  let prefix = field.value.slice(0, position);
  if (
    field instanceof HTMLInputElement &&
    field.getAttribute("name")?.toLowerCase().includes("password") &&
    field.type === "password"
  ) {
    prefix = "•".repeat(prefix.length);
  }

  mirror.textContent = prefix;
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const lineHeight =
    Number.parseFloat(style.lineHeight) ||
    Number.parseFloat(style.fontSize) * 1.2;

  const point = {
    x: markerRect.left - mirrorRect.left + rect.left - field.scrollLeft,
    y:
      markerRect.top -
      mirrorRect.top +
      rect.top -
      field.scrollTop +
      lineHeight * 0.5,
  };

  mirror.remove();
  return point;
}

// redeploy marker: Vercel retry 2026-09-24
export function LoginMascot({
  mood = "idle",
  placement = "login",
  scopeSelector,
}: MascotProps) {
  const mascotRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const [trackedMood, setTrackedMood] = useState<MascotMood | null>(null);
  const [typing, setTyping] = useState(false);
  const [gaze, setGaze] = useState<Gaze>({ x: 0, y: 0, tilt: 0 });

  useEffect(() => {
    const inScope = (
      field: HTMLInputElement | HTMLTextAreaElement,
    ) => {
      if (!scopeSelector) return true;
      const scope = document.querySelector(scopeSelector);
      return Boolean(scope?.contains(field));
    };

    const update = (
      field: HTMLInputElement | HTMLTextAreaElement | null,
      markTyping = false,
    ) => {
      if (!field || !inScope(field)) {
        setTrackedMood(null);
        setGaze({ x: 0, y: 0, tilt: 0 });
        return;
      }

      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(() => {
        const mascot = mascotRef.current;
        if (!mascot) return;

        const point = caretPoint(field);
        const mascotRect = mascot.getBoundingClientRect();
        const centerX = mascotRect.left + mascotRect.width * 0.52;
        const centerY = mascotRect.top + mascotRect.height * 0.42;
        const dx = point.x - centerX;
        const dy = point.y - centerY;

        setGaze({
          x: clamp(dx / 34, -6, 6),
          y: clamp(dy / 38, -4.2, 4.2),
          tilt: clamp(dx / 220, -2.8, 2.8),
        });
        setTrackedMood(moodForField(field));
      });

      if (markTyping) {
        setTyping(true);
        if (typingTimer.current) window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setTyping(false), 520);
      }
    };

    const fromEvent = (event: Event, markTyping = false) => {
      const target = event.target;
      if (isTrackable(target)) update(target, markTyping);
    };

    const handleFocus = (event: FocusEvent) => fromEvent(event);
    const handleInput = (event: Event) => fromEvent(event, true);
    const handleKey = (event: KeyboardEvent) => fromEvent(event, true);
    const handlePointer = (event: MouseEvent) => fromEvent(event);
    const handleSelection = () => {
      const active = document.activeElement;
      if (isTrackable(active)) update(active);
    };
    const handleBlur = () => {
      window.setTimeout(() => {
        const active = document.activeElement;
        if (!isTrackable(active) || !inScope(active)) {
          setTrackedMood(null);
          setGaze({ x: 0, y: 0, tilt: 0 });
        }
      }, 0);
    };
    const handleViewport = () => {
      const active = document.activeElement;
      if (isTrackable(active)) update(active);
    };

    document.addEventListener("focusin", handleFocus);
    document.addEventListener("focusout", handleBlur);
    document.addEventListener("input", handleInput);
    document.addEventListener("keyup", handleKey);
    document.addEventListener("click", handlePointer);
    document.addEventListener("selectionchange", handleSelection);
    window.addEventListener("resize", handleViewport);
    window.addEventListener("scroll", handleViewport, true);

    return () => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("focusout", handleBlur);
      document.removeEventListener("input", handleInput);
      document.removeEventListener("keyup", handleKey);
      document.removeEventListener("click", handlePointer);
      document.removeEventListener("selectionchange", handleSelection);
      window.removeEventListener("resize", handleViewport);
      window.removeEventListener("scroll", handleViewport, true);
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [scopeSelector]);

  const forcedMood =
    mood === "error" ||
    mood === "success" ||
    mood === "alert" ||
    (placement === "datasul" && mood === "work");
  const effectiveMood = forcedMood ? mood : trackedMood || mood;
  const style = {
    "--mascot-gaze-x": gaze.x.toFixed(2) + "px",
    "--mascot-gaze-y": gaze.y.toFixed(2) + "px",
    "--mascot-head-tilt": gaze.tilt.toFixed(2) + "deg",
  } as CSSProperties;

  const note =
    effectiveMood === "password"
      ? "segredo guardado"
      : effectiveMood === "peek"
        ? "agora eu vi"
        : effectiveMood === "email"
          ? "acompanhando..."
          : effectiveMood === "code"
            ? "código em foco"
            : effectiveMood === "work"
              ? "de olho nos dados"
              : effectiveMood === "alert"
                ? "manutenção ativa"
                : effectiveMood === "error"
                  ? "algo saiu do eixo"
                  : effectiveMood === "success"
                    ? "tudo certo"
                    : placement === "datasul"
                      ? "monitorando"
                      : "psiu...";

  return (
    <div
      ref={mascotRef}
      className={[
        "root-mascot",
        "root-mascot-" + placement,
        "mood-" + effectiveMood,
        typing ? "is-typing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      aria-hidden="true"
    >
      <div className="root-mascot-body">
      </div>
      <div className="root-mascot-ear ear-left">
      </div>
      <div className="root-mascot-ear ear-right">
      </div>
      <div className="root-mascot-head">
        <div className="root-mascot-brow brow-left" />
        <div className="root-mascot-brow brow-right" />
        <div className="root-mascot-eye eye-left">
          <div className="root-mascot-iris">
            <i />
            <b />
          </div>
          <div className="root-mascot-eyelid" />
        </div>
        <div className="root-mascot-eye eye-right">
          <div className="root-mascot-iris">
            <i />
            <b />
          </div>
          <div className="root-mascot-eyelid" />
        </div>
        <div className="root-mascot-muzzle">
          <div className="root-mascot-nose" />
          <div className="root-mascot-mouth" />
        </div>
      </div>
      <div className="root-mascot-paw paw-left" />
      <div className="root-mascot-paw paw-right" />
      <div className="root-mascot-note">{note}</div>
    </div>
  );
}
