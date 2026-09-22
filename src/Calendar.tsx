import { useState } from "react";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { client, json, rpc, runAction, useAsync } from "./api";
import { useAuth } from "./auth";
import { Badge, Field, Heading, Loading, Modal } from "./components";
import { dateLabel, localDate } from "./domain";
import { parseCsv } from "./imports";
import type { Row } from "./database.types";
export default function Calendar() {
  const { can } = useAuth();
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [classId, setClassId] = useState("");
  const [day, setDay] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const data = useAsync(async () => {
    const next = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5)),
      1,
      12,
    )
      .toISOString()
      .slice(0, 10);
    const [calendar, classes, events] = await Promise.all([
      client()
        .from("course_calendar")
        .select("*")
        .gte("scheduled_date", month + "-01")
        .lt("scheduled_date", next),
      client().from("classes").select("*").eq("active", true).order("name"),
      client()
        .from("events")
        .select("*")
        .gte("event_date", month + "-01")
        .lt("event_date", next),
    ]);
    if (calendar.error || classes.error || events.error)
      throw calendar.error || classes.error || events.error;
    return {
      calendar: calendar.data,
      classes: classes.data,
      events: events.data,
    };
  }, [month]);
  const first = new Date(month + "-01T12:00:00");
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)),
    0,
  ).getDate();
  function changeMonth(delta: number) {
    const next = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5)) - 1 + delta,
      1,
      12,
    );
    setMonth(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  function rule(date: string) {
    return (
      data.data?.calendar.find(
        (row) => row.scheduled_date === date && row.class_id === classId,
      ) ||
      data.data?.calendar.find(
        (row) => row.scheduled_date === date && row.class_id === null,
      )
    );
  }
  return (
    <>
      <Heading title="Calendário de cursos" eyebrow="TURMAS E DATAS">
        {can("calendar.manage") && (
          <>
            <Link className="button" to="/configuracoes/eventos">
              Eventos
            </Link>
            <button onClick={() => setImportOpen(true)}>
              <Upload size={17} />
              Importar feriados
            </button>
          </>
        )}
      </Heading>
      <section className="panel calendar-panel">
        <div className="table-toolbar">
          <div className="actions">
            <button
              className="icon-button"
              aria-label="Mês anterior"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft size={19} />
            </button>
            <h2>
              {new Intl.DateTimeFormat("pt-BR", {
                month: "long",
                year: "numeric",
              }).format(first)}
            </h2>
            <button
              className="icon-button"
              aria-label="Próximo mês"
              onClick={() => changeMonth(1)}
            >
              <ChevronRight size={19} />
            </button>
          </div>
          <select
            aria-label="Turma do calendário"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">Calendário geral</option>
            {data.data?.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {data.loading ? (
          <Loading />
        ) : (
          <div className="calendar-grid">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((name) => (
              <div className="calendar-weekday" key={name}>
                {name}
              </div>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <div className="calendar-blank" key={`blank${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, "0")}`;
              const entry = rule(date);
              const hasCourse =
                entry?.has_course ??
                new Date(date + "T12:00:00").getDay() === 2;
              const events = data.data?.events.filter(
                (event) =>
                  event.event_date === date &&
                  (!classId || !event.class_id || event.class_id === classId),
              );
              return (
                <button
                  className={`calendar-day ${date === localDate() ? "is-today" : ""} ${hasCourse ? "has-course" : ""}`}
                  key={date}
                  onClick={() => setDay(date)}
                >
                  <strong>{i + 1}</strong>
                  {hasCourse ? (
                    <span className="course-label">
                      {entry?.kind === "replacement"
                        ? "Reposição"
                        : "Curso previsto"}
                    </span>
                  ) : (
                    entry && (
                      <span className="no-course-label">
                        {entry.kind === "holiday" ? "Feriado" : "Sem curso"}
                      </span>
                    )
                  )}
                  {events?.map((event) => (
                    <span className="calendar-event" key={event.id}>
                      {event.title}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        )}
      </section>
      {day && (
        <CalendarDay
          date={day}
          classId={classId}
          entry={
            data.data?.calendar.find(
              (row) =>
                row.scheduled_date === day &&
                row.class_id === (classId || null),
            ) || null
          }
          inherited={rule(day)}
          onClose={() => setDay("")}
          onSaved={data.reload}
        />
      )}{" "}
      {importOpen && (
        <CalendarImport
          classId={classId}
          onClose={() => setImportOpen(false)}
          onSaved={data.reload}
        />
      )}
    </>
  );
}
function CalendarDay({
  date,
  classId,
  entry,
  inherited,
  onClose,
  onSaved,
}: {
  date: string;
  classId: string;
  entry: Row<"course_calendar"> | null;
  inherited?: Row<"course_calendar">;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { can } = useAuth();
  return (
    <Modal open title={dateLabel(date)} onClose={onClose}>
      {can("calendar.manage") ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const ok = await runAction(() =>
              rpc("save_entity", {
                entity: "course_calendar",
                payload: json({
                  ...(entry ? { id: entry.id } : {}),
                  class_id: classId || null,
                  scheduled_date: date,
                  has_course: f.get("has_course") === "yes",
                  kind: f.get("kind"),
                  reason: f.get("reason"),
                }),
                expected_version: entry?.version || null,
              }),
            );
            if (ok) {
              onSaved();
              onClose();
            }
          }}
        >
          <div className="form-stack">
            <Field label="Tem curso nesta data?">
              <select
                name="has_course"
                defaultValue={
                  (entry?.has_course ??
                  inherited?.has_course ??
                  new Date(date + "T12:00:00").getDay() === 2)
                    ? "yes"
                    : "no"
                }
              >
                <option value="yes">Sim</option>
                <option value="no">Não</option>
              </select>
            </Field>
            <Field label="Tipo">
              <select name="kind" defaultValue={entry?.kind || "holiday"}>
                <option value="holiday">Feriado</option>
                <option value="recess">Recesso</option>
                <option value="cancelled">Cancelamento</option>
                <option value="replacement">Reposição</option>
                <option value="exception">Aula excepcional</option>
                <option value="normal">Curso</option>
              </select>
            </Field>
            <Field label="Motivo">
              <textarea
                name="reason"
                defaultValue={entry?.reason}
                minLength={3}
                required
              />
            </Field>
          </div>
          <div className="modal-footer">
            <button className="primary">Salvar data</button>
          </div>
        </form>
      ) : (
        <div className="detail-text">
          <Badge value={inherited?.kind || "normal"} />
          <p>{inherited?.reason || "Curso previsto às terças-feiras."}</p>
        </div>
      )}
    </Modal>
  );
}
function CalendarImport({
  classId,
  onClose,
  onSaved,
}: {
  classId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<
    { scheduled_date: string; reason: string }[]
  >([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Importar feriados" open onClose={onClose}>
      <p>CSV com as colunas Data e Motivo. Datas no formato AAAA-MM-DD.</p>
      <input
        type="file"
        accept=".csv"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const grid = parseCsv(await file.text());
            const header = grid[0].map((s) => s.toLowerCase().trim());
            const di = header.indexOf("data"),
              ri = header.indexOf("motivo");
            const parsed = grid
              .slice(1)
              .map((r) => ({ scheduled_date: r[di], reason: r[ri] }));
            if (
              di < 0 ||
              ri < 0 ||
              parsed.some(
                (r) =>
                  !/^\d{4}-\d{2}-\d{2}$/.test(r.scheduled_date) ||
                  r.reason?.length < 3,
              ) ||
              parsed.length > 1000
            )
              throw new Error("INVALID");
            setRows(parsed);
            setError("");
          } catch {
            setError("Revise as colunas Data e Motivo.");
          }
        }}
      />
      {error && <div className="notice danger">{error}</div>}
      <div className="import-preview">
        {rows.map((row, i) => (
          <div className="list-item" key={i}>
            {dateLabel(row.scheduled_date)} · {row.reason}
          </div>
        ))}
      </div>
      <div className="modal-footer">
        <button
          className="primary"
          disabled={!rows.length || busy}
          onClick={async () => {
            if (!confirm(`Importar ${rows.length} datas sem curso?`)) return;
            setBusy(true);
            const ok = await runAction(() =>
              rpc("import_calendar", {
                rows: json(
                  rows.map((r) => ({
                    ...r,
                    class_id: classId || null,
                    kind: "holiday",
                    has_course: false,
                  })),
                ),
              }),
            );
            setBusy(false);
            if (ok) {
              onSaved();
              onClose();
            }
          }}
        >
          Confirmar importação
        </button>
      </div>
    </Modal>
  );
}
