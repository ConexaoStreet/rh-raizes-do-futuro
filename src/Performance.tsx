import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Plus, Settings2 } from "lucide-react";
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
import { dateLabel, number, weightedAverage } from "./domain";
import type { Row } from "./database.types";

type Review = Row<"performance_reviews"> & {
  employees: { full_name: string; registration: string };
  performance_cycles: {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    status: string;
  };
  performance_scores: Row<"performance_scores">[];
};

type EmployeeOption = {
  id: string;
  full_name: string;
  registration: string;
};

const editorRoles = new Set([
  "SUPER_ADMIN",
  "MANAGER",
  "DIRECTOR",
  "INSTRUCTOR",
]);

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => value != null);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export default function Performance() {
  const { can, user } = useAuth();
  const roleCanGrade = user.roles.some((role) => editorRoles.has(role));
  const canGrade = roleCanGrade && can("performance.grade");
  const [edit, setEdit] = useState<Review | null | undefined>();
  const [employeeId, setEmployeeId] = useState(user.employee_id || "");

  const employees = useAsync(async () => {
    const { data, error } = await client()
      .from("employees")
      .select("id,full_name,registration")
      .eq("status", "active")
      .order("full_name")
      .limit(1000);
    if (error) throw error;
    return data as EmployeeOption[];
  }, []);

  useEffect(() => {
    if (!employeeId && employees.data?.length) {
      setEmployeeId(employees.data[0].id);
    }
  }, [employeeId, employees.data]);

  const cycles = useAsync(async () => {
    const { data, error } = await client()
      .from("performance_cycles")
      .select("*")
      .order("start_date", { ascending: true })
      .limit(100);
    if (error) throw error;
    return data;
  }, []);

  const criteria = useAsync(async () => {
    const { data, error } = await client()
      .from("performance_criteria")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return data;
  }, []);

  const data = useAsync(async () => {
    if (!employeeId) return [] as Review[];
    const { data, error } = await client()
      .from("performance_reviews")
      .select(
        "*,employees(full_name,registration),performance_cycles(id,title,start_date,end_date,status),performance_scores(*)",
      )
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data as unknown as Review[];
  }, [employeeId]);

  const reviews = data.data || [];
  const selectedEmployee =
    employees.data?.find((employee) => employee.id === employeeId) ||
    (reviews[0]
      ? {
          id: reviews[0].employee_id,
          full_name: reviews[0].employees.full_name,
          registration: reviews[0].employees.registration,
        }
      : null);

  const visibleCycles = (cycles.data || []).filter(
    (cycle) =>
      can("performance.view") ||
      reviews.some((review) => review.cycle_id === cycle.id),
  );

  const criteriaRows =
    criteria.data?.length
      ? criteria.data
      : Array.from(
          new Map(
            reviews
              .flatMap((review) => review.performance_scores)
              .map((score) => [
                score.criterion_id,
                {
                  id: score.criterion_id,
                  name: score.criterion_name,
                  weight: score.weight,
                },
              ]),
          ).values(),
        );

  const reviewByCycle = new Map(reviews.map((review) => [review.cycle_id, review]));
  const cycleAverages = visibleCycles.map((cycle) =>
    weightedAverage(reviewByCycle.get(cycle.id)?.performance_scores || []),
  );
  const overallAverage = average(cycleAverages);
  const bestAverage =
    cycleAverages.filter((value): value is number => value != null).length > 0
      ? Math.max(
          ...cycleAverages.filter((value): value is number => value != null),
        )
      : null;

  return (
    <>
      <Heading title="Boletim e notas" eyebrow="DESENVOLVIMENTO">
        {can("performance.manage") && (
          <Link className="button" to="/configuracoes/ciclos">
            <Settings2 size={17} />
            Períodos
          </Link>
        )}
        {can("settings.manage") && (
          <Link className="button" to="/configuracoes/criterios">
            Critérios e pesos
          </Link>
        )}
        {canGrade && (
          <button className="primary" onClick={() => setEdit(null)}>
            <Plus size={18} />
            Lançar notas
          </button>
        )}
      </Heading>

      <section className="panel gradebook-toolbar">
        <div>
          <span className="gradebook-kicker">BOLETIM ESCOLAR</span>
          <h2>{selectedEmployee?.full_name || "Selecione um aluno"}</h2>
          <p>
            {selectedEmployee?.registration
              ? `Matrícula ${selectedEmployee.registration} · escala de 0 a 10`
              : "Notas por período, média de cada competência e média geral."}
          </p>
        </div>
        {can("performance.view") ? (
          <label className="gradebook-student-picker">
            <span>Aluno</span>
            <select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              aria-label="Selecionar aluno do boletim"
            >
              <option value="">Selecionar</option>
              {employees.data?.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="gradebook-readonly">
            <BookOpen size={18} />
            Seu boletim
          </div>
        )}
      </section>

      {employees.loading || cycles.loading || criteria.loading || data.loading ? (
        <Loading />
      ) : data.error || employees.error || cycles.error || criteria.error ? (
        <ErrorState retry={() => {
          employees.reload();
          cycles.reload();
          criteria.reload();
          data.reload();
        }} />
      ) : !employeeId ? (
        <Empty text="Selecione um aluno para abrir o boletim." />
      ) : (
        <>
          <section className="gradebook-summary" aria-label="Resumo do boletim">
            <article>
              <span>Média geral</span>
              <strong>{number(overallAverage, 1)}</strong>
              <small>Média dos períodos avaliados</small>
            </article>
            <article>
              <span>Períodos avaliados</span>
              <strong>{reviews.length}</strong>
              <small>Com lançamento de notas</small>
            </article>
            <article>
              <span>Maior média</span>
              <strong>{number(bestAverage, 1)}</strong>
              <small>Melhor resultado entre os períodos</small>
            </article>
            <article>
              <span>Liberados</span>
              <strong>{reviews.filter((review) => review.released).length}</strong>
              <small>Visíveis para o aluno</small>
            </article>
          </section>

          <section className="panel gradebook-panel">
            <div className="gradebook-section-heading">
              <div>
                <span className="gradebook-icon">
                  <BookOpen size={19} />
                </span>
                <div>
                  <h2>Boletim</h2>
                  <p>
                    Cada coluna representa um período. A média final do critério
                    considera apenas os períodos que já possuem nota.
                  </p>
                </div>
              </div>
              {canGrade && (
                <button className="primary" onClick={() => setEdit(null)}>
                  <Plus size={17} />
                  Novo lançamento
                </button>
              )}
            </div>

            {!visibleCycles.length ? (
              <Empty text="Ainda não existem períodos disponíveis para este boletim." />
            ) : (
              <div className="table-scroll gradebook-scroll">
                <table className="gradebook-table">
                  <thead>
                    <tr>
                      <th>Competência</th>
                      {visibleCycles.map((cycle) => (
                        <th key={cycle.id}>
                          <span>{cycle.title}</span>
                          <small>{dateLabel(cycle.end_date)}</small>
                        </th>
                      ))}
                      <th>Média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteriaRows.map((criterion) => {
                      const scores = visibleCycles.map((cycle) =>
                        reviewByCycle
                          .get(cycle.id)
                          ?.performance_scores.find(
                            (score) => score.criterion_id === criterion.id,
                          )?.score,
                      );
                      return (
                        <tr key={criterion.id}>
                          <td>
                            <strong>{criterion.name}</strong>
                            <small>Peso {number(criterion.weight, 1)}</small>
                          </td>
                          {scores.map((score, index) => (
                            <td key={visibleCycles[index].id}>
                              <span className={score == null ? "grade-empty" : "grade-score"}>
                                {number(score, 1)}
                              </span>
                            </td>
                          ))}
                          <td>
                            <strong className="grade-average">
                              {number(average(scores), 1)}
                            </strong>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="gradebook-final-row">
                      <td>
                        <strong>Média do período</strong>
                      </td>
                      {visibleCycles.map((cycle) => (
                        <td key={cycle.id}>
                          <strong>
                            {number(
                              weightedAverage(
                                reviewByCycle.get(cycle.id)?.performance_scores || [],
                              ),
                              1,
                            )}
                          </strong>
                        </td>
                      ))}
                      <td>
                        <strong>{number(overallAverage, 1)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="gradebook-section-heading">
              <div>
                <div>
                  <h2>Lançamentos por período</h2>
                  <p>
                    Histórico das avaliações usadas para montar o boletim.
                  </p>
                </div>
              </div>
            </div>
            {!reviews.length ? (
              <Empty text="Nenhuma nota registrada para este aluno." />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th>Média</th>
                      <th>Visibilidade</th>
                      <th>Atualização</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map((review) => (
                      <tr key={review.id}>
                        <td data-label="Período">
                          {review.performance_cycles?.title}
                        </td>
                        <td data-label="Média">
                          <strong className="grade-number">
                            {number(weightedAverage(review.performance_scores), 1)}
                          </strong>
                        </td>
                        <td data-label="Visibilidade">
                          {review.released ? "Liberado" : "Reservado"}
                        </td>
                        <td data-label="Atualização">
                          {dateLabel(review.updated_at, true)}
                        </td>
                        <td className="row-actions">
                          <button onClick={() => setEdit(review)}>
                            {canGrade ? "Editar" : "Ver detalhes"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {edit !== undefined && (
        <ReviewForm
          review={edit}
          defaultEmployeeId={employeeId}
          onClose={() => setEdit(undefined)}
          onSaved={data.reload}
        />
      )}
    </>
  );
}

function ReviewForm({
  review,
  defaultEmployeeId,
  onClose,
  onSaved,
}: {
  review: Review | null;
  defaultEmployeeId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { can, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const roleCanGrade = user.roles.some((role) => editorRoles.has(role));
  const editable = roleCanGrade && can("performance.grade");

  const reference = useAsync(async () => {
    const [employees, cycles, criteria] = await Promise.all([
      client()
        .from("employees")
        .select("id,full_name")
        .eq("status", "active")
        .order("full_name")
        .limit(1000),
      client()
        .from("performance_cycles")
        .select("*")
        .eq("status", "open")
        .order("end_date", { ascending: false }),
      client()
        .from("performance_criteria")
        .select("*")
        .eq("active", true)
        .order("name"),
    ]);
    if (employees.error || cycles.error || criteria.error)
      throw employees.error || cycles.error || criteria.error;
    return {
      employees: employees.data,
      cycles: cycles.data,
      criteria: criteria.data,
    };
  }, []);

  return (
    <Modal
      open
      title={review ? "Notas do período" : "Novo lançamento de notas"}
      onClose={onClose}
      wide
    >
      {reference.loading ? (
        <Loading />
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!editable) return;
            if (review && !confirm("Confirmar a alteração das notas?")) return;
            setBusy(true);
            const form = new FormData(event.currentTarget);
            const scores = reference.data?.criteria.map((criterion) => ({
              criterion_id: criterion.id,
              score: Number(form.get(criterion.id)),
            }));
            const ok = await runAction(() =>
              rpc("save_performance", {
                employee_identifier:
                  review?.employee_id || String(form.get("employee_id")),
                cycle_identifier:
                  review?.cycle_id || String(form.get("cycle_id")),
                scores: json(scores),
                notes: String(form.get("notes")),
                released: form.get("released") === "on",
                expected_version: review?.version || null,
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
            <Field label="Aluno">
              <select
                name="employee_id"
                required
                defaultValue={review?.employee_id || defaultEmployeeId}
                disabled={Boolean(review) || !editable}
              >
                <option value="">Selecionar</option>
                {reference.data?.employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Período">
              <select
                name="cycle_id"
                required
                defaultValue={review?.cycle_id}
                disabled={Boolean(review) || !editable}
              >
                <option value="">Selecionar</option>
                {review &&
                  !reference.data?.cycles.some(
                    (cycle) => cycle.id === review.cycle_id,
                  ) && (
                    <option value={review.cycle_id}>
                      {review.performance_cycles.title}
                    </option>
                  )}
                {reference.data?.cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="criteria-form">
            {(editable
              ? reference.data?.criteria
              : review?.performance_scores.map((score) => ({
                  id: score.criterion_id,
                  name: score.criterion_name,
                  weight: score.weight,
                }))
            )?.map((criterion) => (
              <div className="criterion-row" key={criterion.id}>
                <label htmlFor={criterion.id}>
                  {criterion.name}
                  <small>Peso {number(criterion.weight, 1)}</small>
                </label>
                <input
                  id={criterion.id}
                  name={criterion.id}
                  type="number"
                  min={0}
                  max={10}
                  step="0.1"
                  required
                  disabled={!editable}
                  defaultValue={
                    review?.performance_scores.find(
                      (score) => score.criterion_id === criterion.id,
                    )?.score
                  }
                />
                <span>/ 10</span>
              </div>
            ))}
          </div>

          {review && (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={review.performance_scores}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <XAxis type="number" domain={[0, 10]} />
                <YAxis
                  dataKey="criterion_name"
                  type="category"
                  width={125}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar dataKey="score" name="Nota" fill="#245e4b" />
              </BarChart>
            </ResponsiveContainer>
          )}

          <Field label="Observações">
            <textarea
              name="notes"
              defaultValue={review?.notes || ""}
              disabled={!editable}
            />
          </Field>

          <label className="check">
            <input
              name="released"
              type="checkbox"
              defaultChecked={review?.released || false}
              disabled={!editable}
            />
            Liberar este período no boletim do aluno
          </label>

          {review && (
            <p className="muted">
              Registrado em {dateLabel(review.created_at, true)}{" "}
              <Badge value={review.released ? "active" : "draft"} />
            </p>
          )}

          {editable && (
            <div className="modal-footer">
              <button
                className="primary"
                disabled={busy || !reference.data?.criteria.length}
              >
                {busy ? "Salvando..." : "Salvar notas"}
              </button>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
