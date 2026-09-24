import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Presentation,
} from "lucide-react";
import { client, rpc, runAction, signedUrl, useAsync } from "./api";
import { useAuth } from "./auth";
import {
  Empty,
  ErrorState,
  Field,
  Heading,
  Loading,
  Modal,
  Stat,
} from "./components";
import { dateLabel, localDate, number } from "./domain";
import {
  buildPdf,
  exportReport,
  slideContents,
  tableRows,
  type ExportFormat,
  type ReportConfig,
} from "./exports";
import type { ReportSnapshot } from "./Dashboard";
import type { ManagerResult } from "./ManagerReviews";
export default function Reports({
  presentation = false,
}: {
  presentation?: boolean;
}) {
  const [params] = useSearchParams();
  const { user, can } = useAuth();
  const date = localDate(new Date(user.server_time));
  const [start, setStart] = useState(
    params.get("data") || date.slice(0, 7) + "-01",
  );
  const [end, setEnd] = useState(params.get("data") || date);
  const [employee, setEmployee] = useState(params.get("colaborador") || "");
  const [classId, setClassId] = useState(params.get("turma") || "");
  const [kind, setKind] = useState("consolidated");
  const [cycle, setCycle] = useState("");
  const [notes, setNotes] = useState({
    positive: "",
    attention: "",
    actions: "",
    conclusion: "",
  });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const [slide, setSlide] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const reference = useAsync(async () => {
    const [employees, classes, cycles] = await Promise.all([
      client()
        .from("employees")
        .select("id,full_name")
        .order("full_name")
        .limit(1000),
      client().from("classes").select("*").order("name"),
      client()
        .from("manager_review_cycles")
        .select("*")
        .in("status", ["closed", "archived"])
        .order("end_date", { ascending: false })
        .limit(100),
    ]);
    if (employees.error || classes.error || cycles.error)
      throw employees.error || classes.error || cycles.error;
    return {
      employees: employees.data,
      classes: classes.data,
      cycles: cycles.data,
    };
  }, []);
  const data = useAsync(
    async () =>
      rpc("report_snapshot", {
        period_start: start,
        period_end: end,
        employee_identifier: employee || null,
        class_identifier: classId || null,
      }) as unknown as Promise<ReportSnapshot>,
    [start, end, employee, classId],
  );
  const management = useAsync(
    async () =>
      cycle
        ? (rpc("manager_results", {
            cycle_identifier: cycle,
          }) as unknown as Promise<ManagerResult>)
        : null,
    [cycle],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const config: ReportConfig = {
    title: presentation ? "Gestão de RH" : "Relatório de RH",
    kind,
    employee_id: employee || null,
    class_id: classId || null,
    ...notes,
    managerResults: management.data ? [management.data] : [],
  };
  const slides = data.data ? slideContents(data.data, config) : [];
  async function generate(format: ExportFormat) {
    if (!data.data) return;
    setBusy(true);
    await runAction(
      () => exportReport(data.data!, config, format, presentation),
      "Arquivo gerado.",
    );
    setBusy(false);
  }
  return (
    <>
      <Heading
        title={presentation ? "Apresentações" : "Relatórios"}
        eyebrow="RESULTADOS DO RH"
      >
        <button onClick={() => setHistoryOpen(true)}>
          Histórico de arquivos
        </button>
      </Heading>
      <section className="panel report-filters">
        <div className="filters">
          <label>
            De
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <label>
            Turma
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">Todas</option>
              {reference.data?.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Colaborador
            <select
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
            >
              <option value="">Todos</option>
              {reference.data?.employees.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Relatório
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {[
                ["consolidated", "Consolidado"],
                ["attendance", "Presença"],
                ["absences", "Faltas"],
                ["lateness", "Atrasos"],
                ["performance", "Desempenho"],
                ["feedback", "Feedbacks"],
                ["management", "Gestão"],
              ].map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="period-shortcuts">
          {["Hoje", "7 dias", "30 dias", "Mês atual", "Mês anterior"].map(
            (text, i) => (
              <button
                key={text}
                onClick={() => {
                  if (i === 0) {
                    setStart(date);
                    setEnd(date);
                  } else if (i < 3) {
                    const d = new Date(date + "T12:00:00");
                    d.setDate(d.getDate() - (i === 1 ? 6 : 29));
                    setStart(localDate(d));
                    setEnd(date);
                  } else if (i === 3) {
                    setStart(date.slice(0, 7) + "-01");
                    setEnd(date);
                  } else {
                    const last = new Date(
                      Number(date.slice(0, 4)),
                      Number(date.slice(5, 7)) - 1,
                      0,
                      12,
                    );
                    setStart(localDate(last).slice(0, 7) + "-01");
                    setEnd(localDate(last));
                  }
                }}
              >
                {text}
              </button>
            ),
          )}
        </div>
      </section>
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <ErrorState retry={data.reload} />
      ) : (
        data.data && (
          <>
            <div className="stats-grid">
              <Stat
                title="Presença"
                value={
                  data.data.metrics.attendance_rate === null
                    ? "-"
                    : `${number(data.data.metrics.attendance_rate, 1)}%`
                }
              />
              <Stat title="Faltas" value={data.data.metrics.absent} />
              <Stat title="Atrasos" value={data.data.metrics.late} />
              <Stat
                title="Média das notas"
                value={number(data.data.metrics.performance_average, 1)}
              />
            </div>
            {presentation ? (
              <section className="panel slide-preview">
                <div className="preview-slide">
                  <span className="eyebrow">RAÍZES DO FUTURO / RH</span>
                  <h2>{slides[slide]?.title}</h2>
                  <strong>{slides[slide]?.subtitle}</strong>
                  <p>{slides[slide]?.body}</p>
                  <small>
                    {dateLabel(start)} a {dateLabel(end)}
                  </small>
                </div>
                <div className="slide-navigation">
                  <button
                    className="icon-button"
                    disabled={slide === 0}
                    aria-label="Slide anterior"
                    onClick={() => setSlide((s) => s - 1)}
                  >
                    <ChevronLeft />
                  </button>
                  <span>
                    {slide + 1} / {slides.length}
                  </span>
                  <button
                    className="icon-button"
                    disabled={slide >= slides.length - 1}
                    aria-label="Próximo slide"
                    onClick={() => setSlide((s) => s + 1)}
                  >
                    <ChevronRight />
                  </button>
                </div>
              </section>
            ) : (
              <section className="panel report-preview">
                <div className="panel-heading">
                  <h2>Prévia do relatório</h2>
                  <button
                    onClick={() =>
                      void runAction(async () => {
                        const blob = await buildPdf(data.data!, config);
                        setPreview(URL.createObjectURL(blob));
                      }, "")
                    }
                  >
                    Visualizar PDF
                  </button>
                </div>
                {data.data.series.length > 0 && (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.data.series}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="present" name="Presenças" fill="#245e4b" />
                      <Bar dataKey="absent" name="Faltas" fill="#dfa782" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <ReportTable
                  rows={tableRows(data.data, kind, config.managerResults).slice(
                    0,
                    20,
                  )}
                />
                <p className="table-caption">
                  Prévia dos primeiros 20 registros. A exportação inclui todos
                  os registros filtrados.
                </p>
              </section>
            )}
            <section className="panel padded">
              <h2>Observações do RH</h2>
              <div className="form-grid">
                <Field label="Ciclo de avaliação da gestão" wide>
                  <select
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value)}
                  >
                    <option value="">Sem ciclo selecionado</option>
                    {reference.data?.cycles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </Field>
                {[
                  ["positive", "Pontos positivos"],
                  ["attention", "Pontos de atenção"],
                  ["actions", "Ações recomendadas"],
                  ["conclusion", "Conclusão"],
                ].map(([key, title]) => (
                  <Field key={key} label={title}>
                    <textarea
                      maxLength={500}
                      value={notes[key as keyof typeof notes]}
                      onChange={(e) =>
                        setNotes((n) => ({ ...n, [key]: e.target.value }))
                      }
                    />
                  </Field>
                ))}
              </div>
            </section>
            {can("report.export") && (
              <div className="export-actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void generate("pdf")}
                >
                  <FileText size={18} />
                  {busy ? "Gerando..." : "Gerar PDF"}
                </button>
                <button disabled={busy} onClick={() => void generate("pptx")}>
                  <Presentation size={18} />
                  Gerar PowerPoint
                </button>
                {!presentation && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => void generate("xlsx")}
                    >
                      <Download size={17} />
                      Excel
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void generate("csv")}
                    >
                      CSV
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void generate("png")}
                    >
                      Imagem do gráfico
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )
      )}
      <Modal
        title="Prévia do PDF"
        open={Boolean(preview)}
        onClose={() => setPreview("")}
        wide
      >
        {preview && (
          <iframe
            title="Relatório em PDF"
            src={preview}
            className="pdf-preview"
          />
        )}
      </Modal>
      <Modal
        title="Histórico de arquivos"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        wide
      >
        {historyOpen && <ExportHistory />}
      </Modal>
    </>
  );
}
function ReportTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length)
    return <Empty text="Nenhum registro para os filtros selecionados." />;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {Object.keys(rows[0]).map((key) => (
              <th key={key}>{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {Object.entries(row).map(([key, value]) => (
                <td data-label={key} key={key}>
                  {String(value ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function ExportHistory() {
  const data = useAsync(async () => {
    const { data, error } = await client()
      .from("report_exports")
      .select("*,reports(title,period_start,period_end)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data as unknown as {
      id: string;
      path: string;
      format: string;
      created_at: string;
      reports: { title: string; period_start: string; period_end: string };
    }[];
  }, []);
  return data.loading ? (
    <Loading />
  ) : data.error ? (
    <ErrorState retry={data.reload} />
  ) : !data.data?.length ? (
    <Empty text="Nenhum arquivo gerado." />
  ) : (
    <>
      {data.data.map((file) => (
        <div className="file-row" key={file.id}>
          <FileText size={23} />
          <span>
            {file.reports?.title}
            <small>
              {dateLabel(file.created_at, true)} · {file.format.toUpperCase()}
            </small>
          </span>
          <button
            onClick={() =>
              void runAction(async () => {
                window.open(
                  await signedUrl("exports", file.path),
                  "_blank",
                  "noopener,noreferrer",
                );
              }, "")
            }
          >
            Baixar
          </button>
        </div>
      ))}
    </>
  );
}
