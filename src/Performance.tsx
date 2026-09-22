import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Settings2 } from "lucide-react";
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
  Pagination,
} from "./components";
import { dateLabel, number, weightedAverage } from "./domain";
import type { Row } from "./database.types";
type Review = Row<"performance_reviews"> & {
  employees: { full_name: string };
  performance_cycles: { title: string };
  performance_scores: Row<"performance_scores">[];
};
export default function Performance() {
  const { can } = useAuth();
  const [edit, setEdit] = useState<Review | null | undefined>();
  const [page, setPage] = useState(0);
  const [cycle, setCycle] = useState("");
  const cycles = useAsync(async () => {
    const { data, error } = await client()
      .from("performance_cycles")
      .select("*")
      .order("end_date", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }, []);
  const data = useAsync(async () => {
    let q = client()
      .from("performance_reviews")
      .select(
        "*,employees(full_name),performance_cycles(title),performance_scores(*)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(page * 25, page * 25 + 24);
    if (cycle) q = q.eq("cycle_id", cycle);
    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: data as unknown as Review[], total: count || 0 };
  }, [cycle, page]);
  return (
    <>
      <Heading title="Notas e evolução" eyebrow="DESENVOLVIMENTO">
        {can("performance.manage") && (
          <>
            <Link className="button" to="/configuracoes/ciclos">
              <Settings2 size={17} />
              Ciclos
            </Link>
            <button className="primary" onClick={() => setEdit(null)}>
              <Plus size={18} />
              Nova nota
            </button>
          </>
        )}
      </Heading>
      <section className="panel">
        <div className="table-toolbar">
          <select
            aria-label="Ciclo de avaliação"
            value={cycle}
            onChange={(e) => {
              setCycle(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todos os ciclos</option>
            {cycles.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          {can("settings.manage") && (
            <Link className="text-button" to="/configuracoes/criterios">
              Critérios e pesos
            </Link>
          )}
        </div>
        {data.loading ? (
          <Loading />
        ) : data.error ? (
          <ErrorState retry={data.reload} />
        ) : !data.data?.rows.length ? (
          <Empty text="Nenhuma nota registrada." />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Ciclo</th>
                  <th>Média</th>
                  <th>Visibilidade</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data.rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Colaborador">{row.employees?.full_name}</td>
                    <td data-label="Ciclo">{row.performance_cycles?.title}</td>
                    <td data-label="Média">
                      <strong className="grade-number">
                        {number(weightedAverage(row.performance_scores), 1)}
                      </strong>
                    </td>
                    <td>{row.released ? "Liberada" : "Reservada"}</td>
                    <td className="row-actions">
                      <button onClick={() => setEdit(row)}>
                        {can("performance.manage") ? "Editar" : "Ver notas"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          total={data.data?.total || 0}
          onChange={setPage}
        />
      </section>
      {edit !== undefined && (
        <ReviewForm
          review={edit}
          onClose={() => setEdit(undefined)}
          onSaved={data.reload}
        />
      )}
    </>
  );
}
function ReviewForm({
  review,
  onClose,
  onSaved,
}: {
  review: Review | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { can } = useAuth();
  const [busy, setBusy] = useState(false);
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
  const editable = can("performance.manage");
  return (
    <Modal
      open
      title={review ? "Notas do colaborador" : "Nova avaliação"}
      onClose={onClose}
      wide
    >
      {reference.loading ? (
        <Loading />
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (review && !confirm("Confirmar a alteração das notas?")) return;
            setBusy(true);
            const f = new FormData(e.currentTarget);
            const scores = reference.data?.criteria.map((c) => ({
              criterion_id: c.id,
              score: Number(f.get(c.id)),
            }));
            const ok = await runAction(() =>
              rpc("save_performance", {
                employee_identifier:
                  review?.employee_id || String(f.get("employee_id")),
                cycle_identifier: review?.cycle_id || String(f.get("cycle_id")),
                scores: json(scores),
                notes: String(f.get("notes")),
                released: f.get("released") === "on",
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
            <Field label="Colaborador">
              <select
                name="employee_id"
                required
                defaultValue={review?.employee_id}
                disabled={Boolean(review) || !editable}
              >
                <option value="">Selecionar</option>
                {reference.data?.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ciclo">
              <select
                name="cycle_id"
                required
                defaultValue={review?.cycle_id}
                disabled={Boolean(review) || !editable}
              >
                <option value="">Selecionar</option>
                {review &&
                  !reference.data?.cycles.some(
                    (c) => c.id === review.cycle_id,
                  ) && (
                    <option value={review.cycle_id}>
                      {review.performance_cycles.title}
                    </option>
                  )}
                {reference.data?.cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="criteria-form">
            {(editable
              ? reference.data?.criteria
              : review?.performance_scores.map((s) => ({
                  id: s.criterion_id,
                  name: s.criterion_name,
                  weight: s.weight,
                }))
            )?.map((criterion) => (
              <div className="criterion-row" key={criterion.id}>
                <label htmlFor={criterion.id}>
                  {criterion.name}
                  <small>Peso {criterion.weight}</small>
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
                      (s) => s.criterion_id === criterion.id,
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
            Liberar para o colaborador
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
                Salvar notas
              </button>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
