import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Radio,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { Brand, ErrorState, Loading } from "./components";
import { ThemeToggle } from "./theme";
import { useSiteStatus, type SiteUpdate } from "./site-status";
import "./styles/live-maintenance.css";

const labels: Record<SiteUpdate["status"], string> = {
  planned: "Na próxima etapa",
  working: "Em andamento",
  verifying: "Estamos conferindo",
  published: "Concluído",
  blocked: "Precisa de um ajuste",
};
function time(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
export default function LiveMaintenance() {
  const { data, loading, error, reload } = useSiteStatus();
  const [filter, setFilter] = useState<"all" | "release">("all");
  const updates =
    data?.updates.filter(
      (update) => filter === "all" || update.kind === "release",
    ) || [];
  const packs = [
    ...new Set(data?.updates.map((update) => update.pack) || []),
  ].sort((a, b) => a - b);
  return (
    <main className="live-maintenance-page">
      <header className="live-topbar">
        <Brand />
        <ThemeToggle compact />
      </header>
      <section className="live-hero">
        <span className="eyebrow">
          <Radio size={15} /> ACOMPANHAMENTO DO RAÍZES
        </span>
        <h1>
          {!data
            ? "Estamos conferindo o andamento."
            : data.maintenance.enabled
              ? "Estamos cuidando do Raízes."
              : "O Raízes está disponível."}
        </h1>
        <p>
          {data?.maintenance.enabled
            ? "Cada etapa aparece aqui com o que está sendo feito, o que já foi conferido e o que falta publicar."
            : "Veja as melhorias que chegaram ao site e o histórico de cada etapa."}
        </p>
        <div className="live-actions">
          <Link className="button" to="/">
            <ArrowLeft size={17} /> Voltar ao site
          </Link>
          <button onClick={reload} disabled={loading}>
            <RefreshCw size={17} /> Conferir agora
          </button>
        </div>
        {data && (
          <span className="live-last-check">
            <Clock3 size={15} /> Última conferência: {time(data.server_time)}. O
            andamento atualiza sozinho.
          </span>
        )}
      </section>
      {Boolean(error) && (
        <section className="panel padded">
          <p>
            Não conseguimos conferir o andamento agora. O histórico abaixo
            mostra a última informação recebida.
          </p>
          <ErrorState retry={reload} />
        </section>
      )}
      {loading && !data ? (
        <Loading />
      ) : (
        <>
          <div className="live-pack-list">
            {packs.map((pack) => {
              const entries = data!.updates.filter(
                (update) => update.pack === pack,
              );
              const complete = entries.some(
                (update) =>
                  update.kind === "release" && update.status === "published",
              );
              return (
                <div className="live-pack" key={pack}>
                  {complete ? <CheckCircle2 size={22} /> : <Wrench size={22} />}
                  <div>
                    <strong>Pacote {String(pack).padStart(2, "0")}</strong>
                    <span>
                      {complete
                        ? "Publicado e conferido"
                        : "Em preparação e conferência"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="live-history-heading">
            <h2>O que está acontecendo</h2>
            <div className="live-filters" aria-label="Filtrar acompanhamento">
              <button
                aria-pressed={filter === "all"}
                onClick={() => setFilter("all")}
              >
                Tudo
              </button>
              <button
                aria-pressed={filter === "release"}
                onClick={() => setFilter("release")}
              >
                Versões publicadas
              </button>
            </div>
          </div>
          {updates.length === 0 ? (
            <section className="panel padded">
              <p>
                {filter === "release"
                  ? "Nenhum pacote novo foi publicado nesta etapa ainda."
                  : "A próxima etapa será registrada aqui assim que começar."}
              </p>
            </section>
          ) : (
            <ol className="live-timeline">
              {updates.map((update) => (
                <li
                  className={`live-update live-update-${update.status}`}
                  key={update.sequence}
                >
                  <div className="live-update-meta">
                    <span>
                      Atualização #{String(update.sequence).padStart(3, "0")} ·
                      Pacote {String(update.pack).padStart(2, "0")}
                    </span>
                    <time dateTime={update.updated_at}>
                      {time(update.updated_at)}
                    </time>
                  </div>
                  <span className="live-status">{labels[update.status]}</span>
                  <h3>{update.title}</h3>
                  <p>{update.body}</p>
                  {update.release_tag && (
                    <span className="live-release-tag">
                      Versão {update.release_tag}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      <footer className="live-footer">
        Raízes do Futuro · Pessoas, aprendizado e possibilidades.
      </footer>
    </main>
  );
}
