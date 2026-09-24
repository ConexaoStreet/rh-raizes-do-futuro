type MascotMood =
  | "idle"
  | "email"
  | "password"
  | "peek"
  | "code"
  | "error"
  | "success";

export function LoginMascot({ mood }: { mood: MascotMood }) {
  return (
    <div className={"login-mascot mood-" + mood} aria-hidden="true">
      <div className="mascot-leaf leaf-left" />
      <div className="mascot-leaf leaf-right" />
      <div className="mascot-head">
        <div className="mascot-eye eye-left"><i /></div>
        <div className="mascot-eye eye-right"><i /></div>
        <div className="mascot-mouth" />
      </div>
      <div className="mascot-hand hand-left" />
      <div className="mascot-hand hand-right" />
      <div className="mascot-note">
        {mood === "password" ? "não tô vendo nada 👀" :
         mood === "peek" ? "aí você mostrou kkk" :
         mood === "email" ? "hmm… quem vem lá?" :
         mood === "code" ? "código secreto?" :
         mood === "error" ? "ih…" :
         mood === "success" ? "bora trabalhar" : "psiu…"}
      </div>
    </div>
  );
}
