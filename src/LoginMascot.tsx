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
  const autocomplete =
    field instanceof HTMLInputElement ? field.autocomplete.toLowerCase() : "";
  const passwordField =
    name.toLowerCase().includes("password") ||
    autocomplete === "current-password" ||
    autocomplete === "new-password";
  if (name === "access_code" || field.classList.contains("weekly-access-code"))
    return "code";
  if (field instanceof HTMLInputElement && field.type === "email")
    return "email";
  if (passwordField) {
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
    (field.getAttribute("name")?.toLowerCase().includes("password") ||
      field.autocomplete.toLowerCase() === "current-password" ||
      field.autocomplete.toLowerCase() === "new-password") &&
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

const MASCOT_STYLES = `.root-mascot {
  --mascot-gaze-x: 0px;
  --mascot-gaze-y: 0px;
  --mascot-head-tilt: 0deg;
  position: relative;
  width: 152px;
  height: 142px;
  pointer-events: none;
  transform-origin: 50% 80%;
  filter: drop-shadow(0 18px 25px rgba(0,0,0,.28));
  isolation: isolate;
}
.root-mascot-body {
  position: absolute;
  left: 36px;
  top: 72px;
  width: 84px;
  height: 62px;
  border: 1px solid rgba(198,220,205,.12);
  border-radius: 48% 48% 42% 42%;
  background:
    radial-gradient(circle at 42% 28%, rgba(208,230,214,.18), transparent 30%),
    linear-gradient(145deg,#2b4b39 0%,#193226 54%,#0b1e14 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.045),
    inset 0 -12px 25px rgba(0,0,0,.22);
  animation: rootMascotBreath 4.8s ease-in-out infinite;
}
.root-mascot-head {
  position: absolute;
  z-index: 3;
  left: 25px;
  top: 24px;
  width: 104px;
  height: 84px;
  border: 1px solid rgba(188,218,198,.15);
  border-radius: 46% 46% 41% 41% / 48% 48% 39% 39%;
  transform: rotate(var(--mascot-head-tilt));
  transform-origin: 50% 75%;
  transition: transform .15s ease-out;
  background:
    radial-gradient(ellipse at 30% 24%, rgba(224,239,227,.2), transparent 21%),
    radial-gradient(ellipse at 70% 28%, rgba(188,218,195,.16), transparent 23%),
    radial-gradient(ellipse at 48% 70%, rgba(4,13,8,.22), transparent 44%),
    linear-gradient(145deg,#365744 0%,#213b2d 46%,#10251a 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.05),
    inset 0 -12px 26px rgba(0,0,0,.22);
}
.root-mascot-ear {
  position: absolute;
  z-index: 2;
  top: 15px;
  width: 38px;
  height: 45px;
  border: 1px solid rgba(185,215,193,.13);
  background: linear-gradient(145deg,#1e382b,#0e2118);
  box-shadow: inset 0 0 18px rgba(0,0,0,.18);
}
.root-mascot-ear.ear-left {
  left: 26px;
  border-radius: 82% 18% 72% 28%;
  transform: rotate(-24deg);
}
.root-mascot-ear.ear-right {
  right: 25px;
  border-radius: 18% 82% 28% 72%;
  transform: rotate(24deg);
}
.root-mascot-brow {
  position: absolute;
  z-index: 5;
  top: 23px;
  width: 28px;
  height: 6px;
  border-top: 3px solid rgba(173,201,181,.45);
  border-radius: 50%;
  transition: transform .2s ease;
}
.brow-left { left: 17px; transform: rotate(-4deg); }
.brow-right { right: 17px; transform: rotate(4deg); }
.root-mascot-eye {
  position: absolute;
  z-index: 4;
  top: 29px;
  width: 27px;
  height: 23px;
  overflow: hidden;
  border: 1px solid rgba(15,29,21,.45);
  border-radius: 48% 48% 46% 46%;
  background:
    radial-gradient(circle at 50% 42%,#f0eee4 0%,#d8ddd3 72%,#aab6ac 100%);
  box-shadow:
    inset 0 -3px 7px rgba(37,52,43,.18),
    0 1px 4px rgba(0,0,0,.22);
}
.root-mascot-eye.eye-left { left: 20px; }
.root-mascot-eye.eye-right { right: 20px; }
.root-mascot-iris {
  position: absolute;
  left: 7px;
  top: 5px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  transform: translate(var(--mascot-gaze-x),var(--mascot-gaze-y));
  transition: transform .08s linear;
  background:
    radial-gradient(circle at 38% 34%,#d2e5af 0 11%,#7f9f62 24%,#314d35 58%,#14251a 100%);
  box-shadow: 0 0 0 1px rgba(18,35,23,.5);
}
.root-mascot-iris i {
  position: absolute;
  left: 4px;
  top: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #07110b;
}
.root-mascot-iris b {
  position: absolute;
  left: 3px;
  top: 2px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255,255,255,.9);
}
.root-mascot-eyelid {
  position: absolute;
  z-index: 6;
  inset: -1px -1px auto;
  height: 25px;
  border-radius: 50% 50% 44% 44%;
  transform: translateY(-104%);
  transform-origin: 50% 0;
  background: linear-gradient(180deg,#20392d,#172c22);
  animation: rootMascotBlink 6.4s infinite;
}
.root-mascot-muzzle {
  position: absolute;
  z-index: 5;
  left: 34px;
  top: 51px;
  width: 37px;
  height: 26px;
  border-radius: 48% 48% 52% 52%;
  background:
    radial-gradient(ellipse at 50% 5%,rgba(176,198,181,.18),transparent 60%),
    rgba(87,118,95,.16);
}
.root-mascot-nose {
  position: absolute;
  left: 13px;
  top: 3px;
  width: 12px;
  height: 8px;
  border-radius: 55% 55% 60% 60%;
  background: radial-gradient(circle at 35% 25%,#566158,#121a15 55%,#070b08);
  box-shadow: 0 1px 2px rgba(0,0,0,.35);
}
.root-mascot-mouth {
  position: absolute;
  left: 12px;
  top: 13px;
  width: 14px;
  height: 7px;
  border-bottom: 1.5px solid rgba(184,205,190,.45);
  border-radius: 0 0 12px 12px;
}
.root-mascot-paw {
  position: absolute;
  z-index: 7;
  bottom: 17px;
  width: 34px;
  height: 27px;
  border: 1px solid rgba(190,214,198,.12);
  border-radius: 52% 52% 42% 42%;
  background:
    radial-gradient(circle at 50% 20%,rgba(165,197,176,.12),transparent 38%),
    linear-gradient(180deg,#1c3429,#102219);
  transition: transform .32s cubic-bezier(.16,1,.3,1);
}
.root-mascot-paw.paw-left { left: 31px; transform: rotate(8deg); }
.root-mascot-paw.paw-right { right: 30px; transform: rotate(-8deg); }
.root-mascot-note {
  position: absolute;
  z-index: 9;
  right: 116px;
  top: 7px;
  padding: 8px 10px;
  border-radius: 11px 11px 3px 11px;
  background: rgba(6,15,10,.91);
  color: #8fa69a;
  font-size: .58rem;
  white-space: nowrap;
  opacity: 0;
  transform: translate(5px,4px);
}
.root-mascot:not(.mood-idle) .root-mascot-note,
.root-mascot.is-typing .root-mascot-note {
  opacity: 1;
  transform: none;
}
.root-mascot.is-typing .root-mascot-head {
  animation: rootMascotListening .42s ease-out;
}
.root-mascot.mood-password .root-mascot-paw.paw-left {
  transform: translate(14px,-48px) rotate(12deg);
}
.root-mascot.mood-password .root-mascot-paw.paw-right {
  transform: translate(-14px,-48px) rotate(-12deg);
}
.root-mascot.mood-peek .root-mascot-paw.paw-left {
  transform: translate(13px,-46px) rotate(12deg);
}
.root-mascot.mood-peek .root-mascot-paw.paw-right {
  transform: translate(-4px,-22px) rotate(-24deg);
}
.root-mascot.mood-peek .root-mascot-eye.eye-right {
  transform: scaleY(.78);
}
.root-mascot.mood-alert .root-mascot-ear.ear-left { transform: rotate(-34deg); }
.root-mascot.mood-alert .root-mascot-ear.ear-right { transform: rotate(34deg); }
.root-mascot.mood-alert .root-mascot-note {
  color: #e0b779;
  border-color: rgba(226,177,102,.22);
}
.root-mascot.mood-error .brow-left { transform: rotate(14deg); }
.root-mascot.mood-error .brow-right { transform: rotate(-14deg); }
.root-mascot.mood-error .root-mascot-mouth {
  transform: rotate(180deg) translateY(-5px);
  border-bottom-color: #d58e87;
}
.root-mascot.mood-success .root-mascot-mouth {
  height: 10px;
  border-bottom-color: #a7d0af;
}
.root-mascot.mood-success {
  animation: rootMascotApprove .55s ease-out;
}
.root-mascot-login {
  position: absolute;
  z-index: 4;
  top: -103px;
  right: 27px;
}
.datasul-command-header {
  position: relative;
  overflow: visible;
}
.datasul-mascot-perch {
  position: relative;
  z-index: 5;
  width: 196px;
  min-width: 196px;
  min-height: 196px;
  display: grid;
  place-items: end center;
  align-self: end;
  overflow: visible;
  pointer-events: none;
  background: radial-gradient(circle at 50% 68%,rgba(154,210,127,.10),transparent 64%);
}
.root-mascot-datasul {
  transform: scale(1.08);
  transform-origin: 50% 100%;
}
.root-mascot-datasul .root-mascot-note {
  right: 106px;
  top: 1px;
}
@keyframes rootMascotBlink {
  0%,44%,47%,79%,82%,100% { transform: translateY(-104%); }
  45%,46%,80%,81% { transform: translateY(0); }
}
@keyframes rootMascotBreath {
  0%,100% { transform: scaleY(1) translateY(0); }
  50% { transform: scaleY(1.025) translateY(-1px); }
}
@keyframes rootMascotListening {
  0% { transform: rotate(var(--mascot-head-tilt)) translateY(0); }
  45% { transform: rotate(var(--mascot-head-tilt)) translateY(-2px); }
  100% { transform: rotate(var(--mascot-head-tilt)) translateY(0); }
}
@keyframes rootMascotApprove {
  0% { transform: rotate(0); }
  35% { transform: rotate(2deg) translateY(-3px); }
  70% { transform: rotate(-1deg) translateY(-1px); }
  100% { transform: rotate(0); }
}
html[data-theme="light"] .root-mascot-head {
  background:
    radial-gradient(ellipse at 28% 28%,rgba(255,255,255,.46),transparent 24%),
    radial-gradient(ellipse at 72% 28%,rgba(255,255,255,.3),transparent 22%),
    linear-gradient(145deg,#789985,#557461 54%,#375141);
}
html[data-theme="light"] .root-mascot-body,
html[data-theme="light"] .root-mascot-paw,
html[data-theme="light"] .root-mascot-ear {
  background: linear-gradient(145deg,#71927e,#476653);
}
html[data-theme="light"] .root-mascot-note {
  color: #486152;
  background: rgba(249,252,250,.94);
}
@media(max-width:1150px){
  .datasul-command-header {
    grid-template-columns:minmax(0,1fr) 150px 240px;
    gap:20px;
  }
  .datasul-mascot-perch {
    width:176px;
    min-width:176px;
    min-height:176px;
  }
  .root-mascot-datasul {
    transform:scale(1);
  }
}
@media(max-width:980px){
  .datasul-command-header{
    grid-template-columns:minmax(0,1fr) 150px;
    align-items:center;
  }
  .datasul-command-copy {
    padding-right:0;
  }
  .datasul-command-status {
    grid-column:1 / -1;
  }
  .datasul-mascot-perch {
    justify-self:end;
  }
}
@media(max-width:620px){
  .root-mascot-login {
    right: 13px;
    top: -91px;
    transform: scale(.82);
    transform-origin: bottom right;
  }
  .datasul-command-header {
    grid-template-columns:1fr;
  }
  .datasul-mascot-perch {
    width: 100%;
    min-width: 0;
    min-height: 176px;
    height: auto;
    margin: 4px 0 0;
    justify-self: stretch;
    place-items: end center;
  }
  .root-mascot-datasul {
    transform: scale(.98);
  }
  .datasul-command-copy {
    padding-right: 0;
  }
}
@media(min-width:3000px){
  .root-mascot-login {
    transform: scale(2);
    transform-origin: bottom right;
  }
}
@media(min-width:5000px){
  .root-mascot-login {
    transform: scale(4);
  }
}
@media(prefers-reduced-motion:reduce){
  .root-mascot,
  .root-mascot * {
    animation: none!important;
    transition-duration: .01ms!important;
  }
}`;

export function LoginMascot({
  mood = "idle",
  placement = "login",
  scopeSelector,
}: MascotProps) {
  const mascotRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const pointerTargetRef = useRef({ x: 0, y: 0 });
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
      if (pointerFrameRef.current) window.cancelAnimationFrame(pointerFrameRef.current);
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
    const handlePointerMove = (event: PointerEvent) => {
      const active = document.activeElement;
      if (isTrackable(active) && inScope(active)) return;
      if (scopeSelector) {
        const target = event.target;
        if (!(target instanceof Element) || !target.closest(scopeSelector)) return;
      }
      pointerTargetRef.current = { x: event.clientX, y: event.clientY };
      if (pointerFrameRef.current) return;
      pointerFrameRef.current = window.requestAnimationFrame(() => {
        pointerFrameRef.current = null;
        const mascot = mascotRef.current;
        if (!mascot) return;
        const mascotRect = mascot.getBoundingClientRect();
        const centerX = mascotRect.left + mascotRect.width * 0.52;
        const centerY = mascotRect.top + mascotRect.height * 0.42;
        const dx = pointerTargetRef.current.x - centerX;
        const dy = pointerTargetRef.current.y - centerY;
        setGaze({
          x: clamp(dx / 34, -6, 6),
          y: clamp(dy / 38, -4.2, 4.2),
          tilt: clamp(dx / 220, -2.8, 2.8),
        });
      });
    };
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
    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("selectionchange", handleSelection);
    window.addEventListener("resize", handleViewport);
    window.addEventListener("scroll", handleViewport, true);

    return () => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("focusout", handleBlur);
      document.removeEventListener("input", handleInput);
      document.removeEventListener("keyup", handleKey);
      document.removeEventListener("click", handlePointer);
      document.removeEventListener("pointermove", handlePointerMove);
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
    <>
      <style>{MASCOT_STYLES}</style>
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
      role="img"
      aria-label={placement === "datasul" ? "Mascote Raízes acompanhando a operação do Datasul" : "Mascote Raízes acompanhando o acesso"}
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
    </>
  );
}
