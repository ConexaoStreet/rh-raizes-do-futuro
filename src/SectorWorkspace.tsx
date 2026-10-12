import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Plus,
  Users,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "./auth";
import { rpc, json, runAction, useAsync } from "./api";
import { ErrorState, Loading, Modal } from "./components";
import { dateLabel } from "./domain";
import {
  priorityLabels,
  sectorIdentity,
  taskLabels,
  type Workspace,
  type SectorTask,
} from "./workspaces";
import "./styles/workspaces.css";

export default function SectorWorkspace({
  overview = false,
  instructor = false,
}: {
  overview?: boolean;
  instructor?: boolean;
}) {
  const { user } = useAuth();
  const [department, setDepartment] = useState("");
  const state = useAsync(
    async () =>
      (await rpc("workspace_snapshot", {
        department_identifier: department || undefined,
      })) as unknown as Workspace,
    [user.profile.id, department],
  );
  const data =
    state.data?.viewer === user.profile.id &&
    (!department || state.data.department?.id === department)
      ? state.data
      : null;
  if (!data && state.loading) return <Loading />;
  if (!data || (!data.department && !data.overview))
    return (
      <section className="panel padded workspace-empty">
        {Boolean(state.error) ? (
          <ErrorState retry={state.reload} />
        ) : (
          <>
            <Users size={32} />
            <h1>Seu espaço está quase pronto.</h1>
            <p>
              Seu cadastro ainda não está vinculado a um setor. Peça ao RH para
              conferir o vínculo; a conversa geral já está disponível.
            </p>
            <Link className="button primary" to="/conversas">
              Abrir conversa geral
            </Link>
          </>
        )}
      </section>
    );
  return (
    <>
      <header className="workspace-heading">
        <div>
          <span className="eyebrow">
            {overview
              ? "TODOS OS SETORES, UM PASSO DE CADA VEZ"
              : "SEU ESPAÇO NO RAÍZES"}
          </span>
          <h1>
            {instructor
              ? "Área do instrutor"
              : overview
                ? "Área de gestores"
                : "Meu setor"}
          </h1>
          <p>
            {instructor
              ? "Acompanhe a turma e os setores com uma aba de cada vez."
              : overview
                ? "Veja o andamento das equipes e encontre o que precisa de atenção."
                : "Os combinados, as pessoas e as entregas da sua equipe."}
          </p>
        </div>
        {data.overview && (
          <label className="workspace-picker">
            Setor
            <select
              value={data.department?.id || ""}
              onChange={(event) => setDepartment(event.target.value)}
            >
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {Boolean(state.error) && <ErrorState retry={state.reload} />}
      {overview && (
        <div className="workspace-sector-grid">
          {data.departments.map((d) => (
            <button
              className={`workspace-sector-card ${data.department?.id === d.id ? "selected" : ""}`}
              key={d.id}
              onClick={() => setDepartment(d.id)}
              aria-pressed={data.department?.id === d.id}
            >
              <span style={{ background: sectorIdentity(d.name).accent }}>
                {sectorIdentity(d.name).icon}
              </span>
              <strong>{d.name}</strong>
              <small>
                {d.members} pessoas · {d.open_tasks} tarefas abertas
              </small>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      )}
      {data.department ? (
        <SectorBody
          key={`${data.viewer}:${data.department.id}`}
          data={data}
          reload={state.reload}
          instructor={instructor}
        />
      ) : (
        <div className="panel padded">
          Nenhum setor ativo foi cadastrado ainda.
        </div>
      )}
    </>
  );
}

function SectorBody({
  data,
  reload,
  instructor,
}: {
  data: Workspace;
  reload: () => void;
  instructor: boolean;
}) {
  const { user, can } = useAuth();
  const [tab, setTab] = useState("summary");
  const [editor, setEditor] = useState<SectorTask | "new" | null>(null);
  const [filter, setFilter] = useState("open");
  const identity = sectorIdentity(data.department!.name);
  const tasks = data.tasks.filter(
    (task) =>
      filter === "all" ||
      (filter === "done" ? task.status === "done" : task.status !== "done"),
  );
  const canEdit = (task: SectorTask) =>
    data.overview ||
    task.created_by === user.profile.id ||
    task.assigned_to === user.profile.id;
  const shortcuts = [
    {
      to: "/presenca",
      title: "Presença e chamada",
      permission: "attendance.view",
    },
    {
      to: "/notas",
      title: "Notas e desenvolvimento",
      permission: "performance.view",
    },
    { to: "/feedbacks", title: "Feedbacks", permission: "feedback.view" },
    {
      to: "/justificativas",
      title: "Justificativas",
      permission: "justification.view",
    },
    { to: "/relatorios", title: "Relatórios", permission: "report.view" },
    {
      to: "/gestao",
      title: "Avaliação da gestão",
      permission: "review.results",
    },
  ];
  return (
    <div className="sector-workspace">
      <section
        className="sector-hero"
        style={{
          background: `linear-gradient(125deg, ${identity.accent}, #123c2e)`,
        }}
      >
        <span className="sector-monogram" aria-hidden="true">
          {identity.icon}
        </span>
        <div>
          <span className="eyebrow">{data.department!.name}</span>
          <h2>{identity.title}</h2>
          <p>{identity.description}</p>
        </div>
        <Link to={`/conversas?setor=${data.department!.id}`} className="button">
          <MessageCircle size={17} />
          Conversar com a equipe
        </Link>
      </section>
      <div className="workspace-tabs" role="tablist" aria-label="Área do setor">
        {[
          ["summary", "Resumo"],
          ["tasks", "Tarefas"],
          ["people", "Equipe"],
          ...(data.overview
            ? [
                [
                  "followup",
                  instructor
                    ? "Turma e acompanhamento"
                    : "Acompanhamento do RH",
                ],
              ]
            : []),
        ].map(([value, label]) => (
          <button
            role="tab"
            aria-selected={tab === value}
            aria-controls={`workspace-${value}`}
            id={`tab-${value}`}
            key={value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`workspace-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
        {tab === "summary" && (
          <>
            <div className="workspace-metrics">
              {[
                [Users, data.metrics.active_members, "Pessoas na equipe"],
                [ClipboardList, data.metrics.open_tasks, "Tarefas abertas"],
                [
                  CheckCircle2,
                  data.metrics.completed_tasks,
                  "Entregas concluídas",
                ],
              ].map(([Icon, value, label]) => {
                const MetricIcon = Icon as typeof Users;
                return (
                  <div className="panel workspace-metric" key={String(label)}>
                    <MetricIcon size={21} />
                    <strong>{String(value)}</strong>
                    <span>{String(label)}</span>
                  </div>
                );
              })}
            </div>
            <div className="workspace-summary-grid">
              <section className="panel padded">
                <h3>Nosso foco</h3>
                <ul className="sector-focus">
                  {identity.focus.map((focus) => (
                    <li key={focus}>
                      <CheckCircle2 size={16} />
                      {focus}
                    </li>
                  ))}
                </ul>
                <Link to="/calendario">
                  Ver calendário de cursos <ArrowUpRight size={15} />
                </Link>
              </section>
              <section className="panel padded">
                <h3>Próximas entregas</h3>
                {data.tasks
                  .filter((t) => t.status !== "done")
                  .slice(0, 3)
                  .map((t) => (
                    <div className="workspace-next-task" key={t.id}>
                      <strong>{t.title}</strong>
                      <span>
                        {t.due_date
                          ? dateLabel(t.due_date)
                          : "Sem prazo definido"}{" "}
                        · {taskLabels[t.status]}
                      </span>
                    </div>
                  ))}
                {!data.tasks.some((t) => t.status !== "done") && (
                  <p>As próximas entregas da equipe vão aparecer aqui.</p>
                )}
                <button onClick={() => setTab("tasks")}>
                  Organizar tarefas <ArrowUpRight size={15} />
                </button>
              </section>
            </div>
          </>
        )}
        {tab === "tasks" && (
          <>
            <div className="workspace-task-heading">
              <h3>Entregas de {data.department!.name}</h3>
              <div>
                <label className="sr-only" htmlFor="task-filter">
                  Filtrar tarefas
                </label>
                <select
                  id="task-filter"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="open">Em aberto</option>
                  <option value="done">Concluídas</option>
                  <option value="all">Todas</option>
                </select>
                <button className="primary" onClick={() => setEditor("new")}>
                  <Plus size={17} />
                  Nova tarefa
                </button>
              </div>
            </div>
            <div className="workspace-task-list">
              {tasks.map((task) => (
                <article className="panel workspace-task" key={task.id}>
                  <div>
                    <span
                      className={`task-priority task-priority-${task.priority}`}
                    >
                      Prioridade {priorityLabels[task.priority].toLowerCase()}
                    </span>
                    <h4>{task.title}</h4>
                    <p>{task.description}</p>
                    <small>
                      {task.due_date
                        ? `Prazo: ${dateLabel(task.due_date)}`
                        : "Sem prazo definido"}
                      {task.assigned_to &&
                        ` · ${data.members.find((m) => m.profile_id === task.assigned_to)?.full_name || "Responsável vinculado"}`}
                    </small>
                  </div>
                  <div className="workspace-task-actions">
                    <span>{taskLabels[task.status]}</span>
                    {canEdit(task) && (
                      <button onClick={() => setEditor(task)}>
                        Editar tarefa
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {!tasks.length && (
              <div className="panel padded">
                <h4>Nenhuma tarefa neste filtro.</h4>
                <p>Use “Nova tarefa” para combinar uma entrega com a equipe.</p>
              </div>
            )}
          </>
        )}
        {tab === "people" && (
          <div className="workspace-members">
            {data.members.map((member) => (
              <article className="panel workspace-member" key={member.id}>
                <span aria-hidden="true">
                  {member.full_name
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")}
                </span>
                <div>
                  <strong>{member.full_name}</strong>
                  <small>
                    {member.profile_id
                      ? "Conta vinculada ao RH"
                      : "Cadastro no RH"}
                  </small>
                </div>
                {can("employee.view") && (
                  <Link
                    to={`/colaboradores/${member.id}`}
                    aria-label={`Abrir perfil de ${member.full_name}`}
                  >
                    <ArrowUpRight size={18} />
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
        {tab === "followup" && (
          <div className="panel padded">
            <h3>
              {instructor
                ? "Uma visão organizada da turma"
                : "Acompanhe o RH por assunto"}
            </h3>
            <p>
              Escolha o assunto para consultar os registros e usar as ações
              permitidas no seu acesso.
            </p>
            <div className="workspace-shortcuts">
              {shortcuts
                .filter((s) => can(s.permission))
                .map((s) => (
                  <Link className="button" key={s.to} to={s.to}>
                    {s.title}
                    <ArrowUpRight size={17} />
                  </Link>
                ))}
            </div>
            <p className="muted">
              Neste setor: {data.metrics.attendance_records || 0} registros de
              presença nos últimos 30 dias e{" "}
              {data.metrics.pending_justifications || 0} justificativas
              aguardando análise.
            </p>
          </div>
        )}
      </section>
      {editor && (
        <Modal
          title={editor === "new" ? "Nova tarefa do setor" : "Editar tarefa"}
          open
          onClose={() => setEditor(null)}
        >
          <TaskEditor
            data={data}
            task={editor === "new" ? null : editor}
            done={() => {
              setEditor(null);
              reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
function TaskEditor({
  data,
  task,
  done,
}: {
  data: Workspace;
  task: SectorTask | null;
  done: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const ok = await runAction(() =>
      rpc("save_sector_task", {
        payload: json({
          ...Object.fromEntries(form),
          id: task?.id,
          department_id: data.department!.id,
        }),
        expected_version: task?.version,
      }),
    );
    setBusy(false);
    if (ok) done();
  }
  return (
    <form
      className="workspace-task-form"
      onSubmit={(event) => void save(event)}
    >
      <label>
        Título
        <input
          name="title"
          defaultValue={task?.title}
          required
          minLength={3}
          maxLength={140}
        />
      </label>
      <label>
        Descrição
        <textarea
          name="description"
          defaultValue={task?.description}
          maxLength={2000}
          rows={4}
        />
      </label>
      <div className="form-grid">
        <label>
          Andamento
          <select name="status" defaultValue={task?.status || "todo"}>
            {Object.entries(taskLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioridade
          <select name="priority" defaultValue={task?.priority || "normal"}>
            {Object.entries(priorityLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prazo
          <input
            type="date"
            name="due_date"
            defaultValue={task?.due_date || ""}
          />
        </label>
        <label>
          Responsável
          <select name="assigned_to" defaultValue={task?.assigned_to || ""}>
            <option value="">A combinar</option>
            {data.members
              .filter((m) => m.profile_id && m.account_active)
              .map((m) => (
                <option key={m.id} value={m.profile_id!}>
                  {m.full_name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Salvando..." : "Salvar tarefa"}
      </button>
    </form>
  );
}
