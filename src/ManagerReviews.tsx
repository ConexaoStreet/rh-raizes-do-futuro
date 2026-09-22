import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, LockKeyhole, Plus } from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { client, json, rpc, runAction, useAsync } from "./api";
import { useAuth } from "./auth";
import {
  Badge,
  Empty,
  ErrorState,
  Field,
  Heading,
  Loading,
  Modal,
} from "./components";
import { dateLabel, localDate, number } from "./domain";
import type { Row } from "./database.types";
type ReviewTask = {
  cycle_id: string;
  manager_id: string;
  manager_name: string;
  title: string;
  end_date: string;
  used: boolean;
  criteria: { id: string; name: string }[];
};
export type ManagerResult = {
  available: boolean;
  title?: string;
  managers: {
    manager_name: string;
    available: boolean;
    responses?: number;
    participation?: number;
    criteria?: { name: string; average: number }[];
    themes?: { theme: string; mentions: number }[];
  }[];
};
export default function ManagerReviews() {
  const { can } = useAuth();
  const [newCycle, setNewCycle] = useState(false);
  const [selected, setSelected] = useState<ReviewTask | null>(null);
  const [results, setResults] = useState("");
  const [edit, setEdit] = useState<Row<"manager_review_cycles"> | null>(null);
  const tasks = useAsync(
    async () => rpc("my_review_tasks", {}) as unknown as Promise<ReviewTask[]>,
    [],
  );
  const cycles = useAsync(async () => {
    if (!can("review.manage")) return [];
    const { data, error } = await client()
      .from("manager_review_cycles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }, []);
  return (
    <>
      <Heading title="Avaliação da gestão" eyebrow="ESCUTA DA EQUIPE">
        {can("review.manage") && (
          <>
            <Link className="button" to="/configuracoes/criterios-gestao">
              Critérios
            </Link>
            <button className="primary" onClick={() => setNewCycle(true)}>
              <Plus size={17} />
              Novo ciclo
            </button>
          </>
        )}
      </Heading>
      <div className="privacy-banner">
        <LockKeyhole size={20} />
        <p>
          Respostas sem autoria. Resultados agrupados após o encerramento, com
          pelo menos 5 avaliações.
        </p>
      </div>
      {tasks.loading ? (
        <Loading />
      ) : tasks.error ? (
        <ErrorState retry={tasks.reload} />
      ) : (
        Boolean(tasks.data?.length) && (
          <div className="review-task-grid">
            {tasks.data?.map((task) => (
              <section
                className="panel review-task"
                key={task.cycle_id + task.manager_id}
              >
                <span className="eyebrow">{task.title}</span>
                <h2>{task.manager_name}</h2>
                <p>Até {dateLabel(task.end_date)}</p>
                {task.used ? (
                  <span className="review-completed">
                    <CheckCircle2 size={18} />
                    Avaliação enviada
                  </span>
                ) : (
                  <button className="primary" onClick={() => setSelected(task)}>
                    Avaliar gestor
                  </button>
                )}
              </section>
            ))}
          </div>
        )
      )}
      {can("review.manage") ? (
        <section className="panel">
          {cycles.loading ? (
            <Loading />
          ) : cycles.error ? (
            <ErrorState retry={cycles.reload} />
          ) : !cycles.data?.length ? (
            <Empty text="Nenhum ciclo criado." />
          ) : (
            cycles.data.map((cycle) => (
              <div className="cycle-row" key={cycle.id}>
                <div>
                  <h3>{cycle.title}</h3>
                  <small>
                    {dateLabel(cycle.start_date)} a {dateLabel(cycle.end_date)}
                  </small>
                </div>
                <Badge value={cycle.status} />
                <div className="actions">
                  {["draft", "scheduled"].includes(cycle.status) && (
                    <>
                      <button onClick={() => setEdit(cycle)}>Editar</button>
                      <button
                        className="primary"
                        onClick={() =>
                          void runAction(async () => {
                            await rpc("set_review_cycle_status", {
                              identifier: cycle.id,
                              next_status: "open",
                              expected_version: cycle.version,
                            });
                            cycles.reload();
                          }, "Ciclo aberto.")
                        }
                      >
                        Abrir ciclo
                      </button>
                    </>
                  )}
                  {cycle.status === "open" && (
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            "Encerrar este ciclo? As respostas não poderão ser alteradas.",
                          )
                        )
                          void runAction(async () => {
                            await rpc("set_review_cycle_status", {
                              identifier: cycle.id,
                              next_status: "closed",
                              expected_version: cycle.version,
                            });
                            cycles.reload();
                          }, "Ciclo encerrado.");
                      }}
                    >
                      Encerrar ciclo
                    </button>
                  )}
                  {["closed", "archived"].includes(cycle.status) && (
                    <button onClick={() => setResults(cycle.id)}>
                      Ver resultados
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      ) : (
        !tasks.data?.length &&
        !tasks.loading && (
          <section className="panel">
            <Empty text="Nenhuma avaliação disponível." />
          </section>
        )
      )}
      {(newCycle || edit) && (
        <CycleForm
          cycle={edit}
          onClose={() => {
            setNewCycle(false);
            setEdit(null);
          }}
          onSaved={cycles.reload}
        />
      )}{" "}
      {selected && (
        <VoteForm
          task={selected}
          onClose={() => setSelected(null)}
          onSaved={tasks.reload}
        />
      )}{" "}
      {results && (
        <Modal
          title="Resultados da gestão"
          open
          onClose={() => setResults("")}
          wide
        >
          <ManagerResults id={results} />
        </Modal>
      )}
    </>
  );
}
function CycleForm({
  cycle,
  onClose,
  onSaved,
}: {
  cycle: Row<"manager_review_cycles"> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const data = useAsync(async () => {
    const { data, error } = await client()
      .from("managers")
      .select("*")
      .eq("active", true)
      .order("full_name");
    if (error) throw error;
    const targets = cycle
      ? await client()
          .from("manager_cycle_targets")
          .select("*")
          .eq("cycle_id", cycle.id)
      : null;
    if (targets?.error) throw targets.error;
    return {
      managers: data,
      targets: targets?.data?.map((t) => t.manager_id) || data.map((m) => m.id),
    };
  }, [cycle?.id]);
  return (
    <Modal title={cycle ? "Editar ciclo" : "Novo ciclo"} open onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          const ok = await runAction(() =>
            rpc("save_review_cycle", {
              payload: json({
                ...(cycle ? { id: cycle.id } : {}),
                title: f.get("title"),
                description: f.get("description"),
                start_date: f.get("start_date"),
                end_date: f.get("end_date"),
                minimum_responses: Number(f.get("minimum_responses")),
              }),
              manager_identifiers: f.getAll("managers").map(String),
              expected_version: cycle?.version || null,
            }),
          );
          setBusy(false);
          if (ok) {
            onSaved();
            onClose();
          }
        }}
      >
        <div className="form-grid">
          <Field label="Título" wide>
            <input name="title" required defaultValue={cycle?.title} />
          </Field>
          <Field label="Início">
            <input
              name="start_date"
              type="date"
              required
              defaultValue={cycle?.start_date || localDate()}
            />
          </Field>
          <Field label="Fim">
            <input
              name="end_date"
              type="date"
              required
              defaultValue={cycle?.end_date}
            />
          </Field>
          <Field label="Descrição" wide>
            <textarea name="description" defaultValue={cycle?.description} />
          </Field>
          <Field label="Mínimo de respostas">
            <input
              type="number"
              name="minimum_responses"
              min={5}
              required
              defaultValue={cycle?.minimum_responses || 5}
            />
          </Field>
        </div>
        <h3>Gestores avaliados</h3>
        {data.data?.managers.map((manager) => (
          <label className="check" key={manager.id}>
            <input
              type="checkbox"
              name="managers"
              value={manager.id}
              defaultChecked={data.data?.targets.includes(manager.id)}
            />
            {manager.full_name}
          </label>
        ))}
        <div className="modal-footer">
          <button className="primary" disabled={busy || data.loading}>
            Salvar ciclo
          </button>
        </div>
      </form>
    </Modal>
  );
}
function VoteForm({
  task,
  onClose,
  onSaved,
}: {
  task: ReviewTask;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open title={`Avaliar ${task.manager_name}`} onClose={onClose} wide>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            !confirm(
              "Enviar avaliação? Depois do envio, as respostas não poderão ser alteradas.",
            )
          )
            return;
          setBusy(true);
          const f = new FormData(e.currentTarget);
          const scores = Object.fromEntries(
            task.criteria.map((c) => [c.id, Number(f.get(c.id))]),
          );
          const ok = await runAction(
            () =>
              rpc("submit_manager_review", {
                cycle_identifier: task.cycle_id,
                manager_identifier: task.manager_id,
                scores: json(scores),
                strengths: String(f.get("strengths")),
                improvements: String(f.get("improvements")),
                message: String(f.get("message")),
              }),
            "Avaliação enviada.",
          );
          setBusy(false);
          if (ok) {
            onSaved();
            onClose();
          }
        }}
      >
        <div className="rating-legend">
          1 Muito ruim · 2 Ruim · 3 Regular · 4 Bom · 5 Excelente
        </div>
        {task.criteria.map((c) => (
          <fieldset className="rating-row" key={c.id}>
            <legend>{c.name}</legend>
            <div>
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value}>
                  <input type="radio" name={c.id} value={value} required />
                  <span>{value}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="form-stack">
          <Field label="O que este gestor faz bem?">
            <textarea name="strengths" maxLength={1500} />
          </Field>
          <Field label="O que poderia melhorar?">
            <textarea name="improvements" maxLength={1500} />
          </Field>
          <Field label="Existe algo que você gostaria que o RH soubesse?">
            <textarea name="message" maxLength={1500} />
          </Field>
        </div>
        <p className="muted">
          Evite nomes e detalhes que identifiquem você ou outra pessoa.
        </p>
        <div className="modal-footer">
          <button className="primary" disabled={busy}>
            Enviar avaliação
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ManagerResults({ id }: { id: string }) {
  const data = useAsync(
    async () =>
      rpc("manager_results", {
        cycle_identifier: id,
      }) as unknown as Promise<ManagerResult>,
    [id],
  );
  if (data.loading) return <Loading />;
  if (data.error) return <ErrorState retry={data.reload} />;
  if (!data.data?.available)
    return <Empty text="Resultados disponíveis após o encerramento." />;
  return (
    <div className="manager-results">
      {data.data.managers.map((result) => (
        <section key={result.manager_name}>
          <h2>{result.manager_name}</h2>
          {!result.available ? (
            <Empty text="Ainda não há respostas suficientes para exibir resultados." />
          ) : (
            <>
              <div className="results-summary">
                <strong>{result.responses} respostas</strong>
                <span>{number(result.participation, 1)}% de participação</span>
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={result.criteria}
                  layout="vertical"
                  margin={{ left: 10, right: 25 }}
                >
                  <XAxis type="number" domain={[0, 5]} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={160}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="average"
                    name="Média"
                    fill="#245e4b"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              {Boolean(result.themes?.length) && (
                <>
                  <h3>Temas citados pela equipe</h3>
                  <div className="theme-tags">
                    {result.themes?.map((theme) => (
                      <span key={theme.theme}>
                        {theme.theme} · {theme.mentions}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      ))}
    </div>
  );
}
