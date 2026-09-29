import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  FileBarChart2,
  MessageSquare,
  Settings,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { rpc, useAsync } from "./api";
import { useAuth } from "./auth";
import { ErrorState, Heading, Loading, Stat } from "./components";
import { localDate, number } from "./domain";

type InstructorSnapshot = {
  metrics: {
    employees: number;
    active_employees: number;
    present: number;
    absent: number;
    late: number;
    feedback_count: number;
    attendance_rate: number | null;
    performance_average: number | null;
  };
};

const shortcuts = [
  {
    title: "Chamada",
    detail: "Abrir, revisar e manter registros de presença.",
    path: "/chamada",
    icon: ClipboardCheck,
  },
  {
    title: "Boletim e notas",
    detail: "Lançar notas e acompanhar desempenho.",
    path: "/notas",
    icon: Star,
  },
  {
    title: "Feedbacks",
    detail: "Registrar e acompanhar devolutivas.",
    path: "/feedbacks",
    icon: MessageSquare,
  },
  {
    title: "Avaliação da gestão",
    detail: "Gerenciar ciclos e acompanhar resultados.",
    path: "/gestao",
    icon: BarChart3,
  },
  {
    title: "Relatórios",
    detail: "Consolidar indicadores e exportar relatórios.",
    path: "/relatorios",
    icon: FileBarChart2,
  },
  {
    title: "Pessoas e acessos",
    detail: "Acompanhar usuários e equipe do RH.",
    path: "/usuarios",
    icon: Users,
  },
  {
    title: "Calendário",
    detail: "Organizar datas, aulas, eventos e reposições.",
    path: "/calendario",
    icon: CalendarDays,
  },
  {
    title: "Configurações",
    detail: "Administrar parâmetros operacionais do RH.",
    path: "/configuracoes",
    icon: Settings,
  },
] as const;

export default function InstructorHub() {
  const { user } = useAuth();
  const serverDate = localDate(new Date(user.server_time));
  const month = serverDate.slice(0, 7);
  const periodStart = month + "-01";
  const periodEnd = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
    12,
  )
    .toISOString()
    .slice(0, 10);

  const snapshot = useAsync(
    async () =>
      (await rpc("dashboard_snapshot", {
        period_start: periodStart,
        period_end: periodEnd,
      })) as unknown as InstructorSnapshot,
    [periodStart, periodEnd],
  );

  return (
    <>
      <Heading
        title="Central do Instrutor"
        eyebrow="GESTÃO PEDAGÓGICA · RAÍZES DO FUTURO"
      >
        <Link className="button primary" to="/relatorios">
          Gerar relatório
          <ArrowUpRight size={16} />
        </Link>
      </Heading>

      <section className="panel padded">
        <div className="actions">
          <ShieldCheck size={24} />
          <div>
            <h2>Visão de gestão do RH</h2>
            <p className="muted">
              O Instrutor acompanha a operação, pessoas, presença, notas,
              feedbacks, avaliações, relatórios e configurações do RH. A Central
              T.I. permanece separada e restrita ao Desenvolvedor e à equipe
              técnica autorizada.
            </p>
          </div>
        </div>
      </section>

      {snapshot.loading ? (
        <Loading />
      ) : snapshot.error ? (
        <ErrorState retry={snapshot.reload} />
      ) : (
        <div className="stats-grid executive-metrics">
          <Stat
            variant="primary"
            title="Colaboradores ativos"
            value={number(snapshot.data?.metrics.active_employees || 0)}
            detail={`${number(snapshot.data?.metrics.employees || 0)} cadastrados`}
            icon={<Users size={18} />}
          />
          <Stat
            title="Presença"
            value={
              snapshot.data?.metrics.attendance_rate == null
                ? "-"
                : `${number(snapshot.data.metrics.attendance_rate, 1)}%`
            }
            detail={`${number(snapshot.data?.metrics.present || 0)} presenças no período`}
            icon={<ClipboardCheck size={18} />}
          />
          <Stat
            variant={(snapshot.data?.metrics.late || 0) > 0 ? "attention" : "default"}
            title="Atrasos"
            value={number(snapshot.data?.metrics.late || 0)}
            detail={`${number(snapshot.data?.metrics.absent || 0)} faltas no período`}
            icon={<CalendarDays size={18} />}
          />
          <Stat
            title="Média de notas"
            value={
              snapshot.data?.metrics.performance_average == null
                ? "-"
                : number(snapshot.data.metrics.performance_average, 1)
            }
            detail={`${number(snapshot.data?.metrics.feedback_count || 0)} feedbacks`}
            icon={<Star size={18} />}
          />
        </div>
      )}

      <div className="role-cards">
        {shortcuts.map((item) => (
          <section className="panel role-card" key={item.path}>
            <item.icon size={24} />
            <h2>{item.title}</h2>
            <p>{item.detail}</p>
            <div className="actions">
              <Link className="button" to={item.path}>
                Abrir
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </section>
        ))}
      </div>

      <section className="panel padded">
        <div className="eyebrow">HIERARQUIA DO RH</div>
        <h2>Desenvolvedor → Instrutor → Diretor → Gestor → Colaborador</h2>
        <p className="muted">
          O Instrutor pode gerir níveis inferiores dentro do RH. Contas de
          Desenvolvedor, Administração T.I. e outras contas de Instrutor não
          podem ser alteradas por esse papel.
        </p>
      </section>
    </>
  );
}
