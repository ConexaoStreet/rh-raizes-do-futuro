import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock3,
  Plus,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { client, rpc, useAsync } from "./api";
import { useAuth } from "./auth";
import { dateLabel, localDate, number } from "./domain";
import { Empty, ErrorState, Heading, Loading, Stat } from "./components";
export type Metrics = {
  employees: number;
  active_employees: number;
  records: number;
  pending: number;
  present: number;
  absent: number;
  justified: number;
  unjustified: number;
  late: number;
  delay_total: number;
  delay_average: number | null;
  attendance_rate: number | null;
  punctuality_rate: number | null;
  performance_average: number | null;
  feedback_count: number;
};
export type ReportSnapshot = {
  period_start: string;
  period_end: string;
  generated_at: string;
  metrics: Metrics;
  previous: Metrics;
  series: {
    month: string;
    present: number;
    absent: number;
    justified: number;
    late: number;
  }[];
  records: Record<string, unknown>[];
  grades: Record<string, unknown>[];
  feedbacks: Record<string, unknown>[];
};
export default function Dashboard({ today = false }: { today?: boolean }) {
  const { user, can } = useAuth();
  const serverDate = localDate(new Date(user.server_time));
  const [month, setMonth] = useState(serverDate.slice(0, 7));
  const start = today ? serverDate : month + "-01";
  const end = today
    ? serverDate
    : new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0, 12)
        .toISOString()
        .slice(0, 10);
  const data = useAsync(async () => {
    const [snapshot, justifications, feedbacks, events] = await Promise.all([
      rpc("dashboard_snapshot", { period_start: start, period_end: end }),
      client()
        .from("absence_justifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      client()
        .from("feedbacks")
        .select("id", { count: "exact", head: true })
        .eq("status", "following"),
      client()
        .from("events")
        .select("*")
        .gte("event_date", serverDate)
        .eq("status", "open")
        .order("event_date")
        .limit(4),
    ]);
    if (justifications.error || feedbacks.error || events.error)
      throw justifications.error || feedbacks.error || events.error;
    return {
      snapshot: snapshot as unknown as ReportSnapshot,
      justifications: justifications.count || 0,
      feedbacks: feedbacks.count || 0,
      events: events.data || [],
    };
  }, [start, end]);
  const stats = data.data?.snapshot.metrics;
  return (
    <>
      <Heading
        title={today ? "Hoje" : "Visão geral"}
        eyebrow={
          today ? dateLabel(serverDate).toUpperCase() : "RH · RAÍZES DO FUTURO"
        }
      >
        {!today && (
          <label className="period-picker">
            <CalendarDays size={17} />
            <input
              aria-label="Mês"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
        )}
        {can("report.export") && (
          <Link className="button" to="/relatorios">
            Gerar relatório
            <ArrowUpRight size={16} />
          </Link>
        )}
      </Heading>
      {!today && (
        <section className="raizes-hero">
          <img
            className="raizes-hero-logo"
            src="/brand/raizes-logo-mark.png"
            alt=""
            aria-hidden="true"
          />
          <div className="raizes-hero-copy">
            <span className="eyebrow">ANHANGUERA · ESPRO · TURMA 16807</span>
            <h2>Raízes do Futuro</h2>
            <p>Gestão de pessoas, presença e desenvolvimento da turma em um único lugar.</p>
            <div className="department-pills">
              <span>Recursos Humanos</span>
              <span>Eventos</span>
              <span>Educação</span>
              <span>Ecológico</span>
              <span>Marketing</span>
            </div>
          </div>
        </section>
      )}
      <div className="notice maintenance-notice">
        <TriangleAlert size={20} />
        <div>
          <strong>Histórico da planilha importado</strong>
          <span>Faltas e registros de presença da base histórica já foram lançados. A planilha registra ocorrências, não uma chamada completa; por isso, quem não aparece nela não foi presumido como presente.</span>
        </div>
      </div>
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <ErrorState retry={data.reload} />
      ) : (
        stats && (
          <>
            <section className="attendance-banner">
              <div className="banner-icon">
                <ClipboardCheck size={25} />
              </div>
              <div>
                <h2>Chamada da turma</h2>
                <p>Terças-feiras · 08:00 às 14:00</p>
              </div>
              <Link to="/chamada" className="button primary">
                Abrir chamada
                <ArrowUpRight size={17} />
              </Link>
            </section>
            <div className="stats-grid">
              <Stat
                title="Colaboradores ativos"
                value={number(stats.active_employees)}
                detail={`${number(stats.employees)} cadastrados`}
                icon={<Users size={18} />}
              />
              <Stat
                title="Presença"
                value={
                  stats.attendance_rate === null
                    ? "—"
                    : `${number(stats.attendance_rate, 1)}%`
                }
                detail={`${stats.present} presenças no período`}
                icon={<Check size={18} />}
              />
              <Stat
                title="Pontualidade"
                value={
                  stats.punctuality_rate === null
                    ? "—"
                    : `${number(stats.punctuality_rate, 1)}%`
                }
                detail={`${stats.late} registros com atraso`}
                icon={<Clock3 size={18} />}
              />
              <Stat
                title="Média das notas"
                value={number(stats.performance_average, 1)}
                detail="Escala de 0 a 10"
                icon={<ArrowUpRight size={18} />}
              />
            </div>
            <div className="dashboard-grid">
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <h2>Presença no período</h2>
                  <div className="legend">
                    <span className="legend-present">Presenças</span>
                    <span className="legend-absent">Faltas</span>
                  </div>
                </div>
                {data.data?.snapshot.series.length ? (
                  <ResponsiveContainer width="100%" height={265}>
                    <BarChart data={data.data.snapshot.series} barGap={6}>
                      <CartesianGrid vertical={false} stroke="#e8ece9" />
                      <XAxis
                        dataKey="month"
                        tickFormatter={(v) => String(v).slice(5)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip labelFormatter={(v) => `Mês ${v}`} />
                      <Bar
                        dataKey="present"
                        name="Presenças"
                        fill="#245e4b"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={45}
                      />
                      <Bar
                        dataKey="absent"
                        name="Faltas"
                        fill="#e3a67f"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={45}
                      />
                      <Bar
                        dataKey="justified"
                        name="Justificadas"
                        fill="#bcc7bf"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={45}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty text="Nenhuma chamada registrada neste período." />
                )}
                <div className="chart-summary">
                  <div>
                    <strong>{stats.absent}</strong>
                    <span>Faltas</span>
                  </div>
                  <div>
                    <strong>{stats.justified}</strong>
                    <span>Justificadas</span>
                  </div>
                  <div>
                    <strong>{number(stats.delay_average, 1)}</strong>
                    <span>Atraso médio · min</span>
                  </div>
                </div>
              </section>
              <section className="panel pending-panel">
                <div className="panel-heading">
                  <h2>Pendências</h2>
                  <span className="count-pill">
                    {(data.data?.justifications || 0) +
                      (data.data?.feedbacks || 0) +
                      stats.pending}
                  </span>
                </div>
                <Link className="pending-row" to="/justificativas">
                  <span className="small-icon amber">
                    <FileBadge />
                  </span>
                  <div>
                    Justificativas<small>Aguardando análise</small>
                  </div>
                  <strong>{data.data?.justifications}</strong>
                  <ArrowUpRight size={17} />
                </Link>
                <Link className="pending-row" to="/feedbacks">
                  <span className="small-icon blue">
                    <Users size={18} />
                  </span>
                  <div>
                    Feedbacks<small>Em acompanhamento</small>
                  </div>
                  <strong>{data.data?.feedbacks}</strong>
                  <ArrowUpRight size={17} />
                </Link>
                <Link className="pending-row" to="/presenca">
                  <span className="small-icon green">
                    <ClipboardCheck size={18} />
                  </span>
                  <div>
                    Chamada<small>Registros não preenchidos</small>
                  </div>
                  <strong>{stats.pending}</strong>
                  <ArrowUpRight size={17} />
                </Link>
                <div className="quick-actions">
                  <h3>Ações rápidas</h3>
                  <Link to="/colaboradores">
                    <Plus size={17} />
                    Novo colaborador
                  </Link>
                  <Link to="/feedbacks">
                    <Plus size={17} />
                    Novo feedback
                  </Link>
                  <Link to="/notas">
                    <Plus size={17} />
                    Nova nota
                  </Link>
                </div>
              </section>
            </div>
            <div className="dashboard-bottom">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Próximos eventos</h2>
                  <Link to="/calendario" className="text-button">
                    Ver calendário
                    <ArrowUpRight size={15} />
                  </Link>
                </div>
                {data.data?.events.length ? (
                  data.data.events.map((event) => (
                    <div className="event-row" key={event.id}>
                      <div className="event-date">
                        {dateLabel(event.event_date).slice(0, 5)}
                      </div>
                      <div>
                        <strong>{event.title}</strong>
                        <small>{event.description}</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty text="Nenhum evento agendado." />
                )}
              </section>
              <section className="panel period-comparison">
                <h2>Comparação com o período anterior</h2>
                <div>
                  <span>Presenças</span>
                  <strong>
                    {data.data?.snapshot.previous.present} → {stats.present}
                  </strong>
                </div>
                <div>
                  <span>Faltas</span>
                  <strong>
                    {data.data?.snapshot.previous.absent} → {stats.absent}
                  </strong>
                </div>
                <div>
                  <span>Feedbacks</span>
                  <strong>
                    {data.data?.snapshot.previous.feedback_count} →{" "}
                    {stats.feedback_count}
                  </strong>
                </div>
              </section>
            </div>
          </>
        )
      )}
    </>
  );
}
function FileBadge() {
  return <CalendarDays size={18} />;
}
