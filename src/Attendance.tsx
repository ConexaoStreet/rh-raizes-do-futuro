import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  Clock3,
  History,
  LockKeyhole,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { client, json, rpc, runAction, useAsync } from "./api";
import { useAuth, Verification } from "./auth";
import {
  Badge,
  Empty,
  ErrorState,
  Field,
  Heading,
  Loading,
  Modal,
  Pagination,
  Stat,
} from "./components";
import { attendanceLabels, dateLabel, localDate } from "./domain";
import type { Row } from "./database.types";
import { capture } from "./telemetry";
type CourseStatus = {
  server_time: string;
  has_course: boolean;
  can_open: boolean;
};
export default function Attendance({ history = false }: { history?: boolean }) {
  const { user, can } = useAuth();
  const [params] = useSearchParams();
  const [classId, setClassId] = useState(params.get("turma") || "");
  const [sessionId, setSessionId] = useState(params.get("chamada") || "");
  const [month, setMonth] = useState(
    localDate(new Date(user.server_time)).slice(0, 7),
  );
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const classes = useAsync(async () => {
    const { data, error } = await client()
      .from("classes")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return data;
  }, []);
  const classValue = classId || classes.data?.[0]?.id || "";
  const course = useAsync(
    async () =>
      classValue
        ? (rpc("course_status", {
            class_identifier: classValue,
            day: localDate(new Date(user.server_time)),
          }) as unknown as Promise<CourseStatus>)
        : null,
    [classValue, user.server_time],
  );
  const sessions = useAsync(async () => {
    let q = client()
      .from("attendance_sessions")
      .select("*", { count: "exact" })
      .order("scheduled_date", { ascending: false })
      .range(page * 25, page * 25 + 24);
    if (classId) q = q.eq("class_id", classId);
    if (status) q = q.eq("status", status);
    if (history && month) {
      q = q
        .gte("scheduled_date", month + "-01")
        .lt(
          "scheduled_date",
          new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1, 12)
            .toISOString()
            .slice(0, 10),
        );
    }
    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: data, total: count || 0 };
  }, [classId, month, status, page, history]);
  if (sessionId)
    return (
      <AttendanceSession
        id={sessionId}
        onBack={() => {
          setSessionId("");
          sessions.reload();
        }}
      />
    );
  return (
    <>
      <Heading
        title={history ? "Histórico de chamadas" : "Chamada do dia"}
        eyebrow="PRESENÇA"
      />
      {!history && (
        <section className="panel start-attendance">
          <div className="start-attendance-icon">
            <ClipboardSymbol />
          </div>
          <div>
            <h2>{dateLabel(localDate(new Date(user.server_time)))}</h2>
            <p>Chamada disponível das 08:00 às 14:00.</p>
          </div>
          <Field label="Turma">
            <select
              value={classValue}
              onChange={(e) => setClassId(e.target.value)}
            >
              {classes.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <button
            className="primary"
            disabled={busy || !course.data?.can_open}
            onClick={async () => {
              setBusy(true);
              await runAction(async () => {
                const id = await rpc("open_attendance", {
                  class_identifier: classValue,
                });
                setSessionId(String(id));
              }, "");
              setBusy(false);
            }}
          >
            Abrir chamada
          </button>
          {!course.loading && !course.data?.can_open && (
            <div className="closed-message">
              <LockKeyhole size={16} />
              {!classValue
                ? "Cadastre uma turma para começar."
                : !course.data?.has_course
                  ? "Não há curso nesta data."
                  : "Chamada indisponível neste horário."}
            </div>
          )}
        </section>
      )}
      <section className="panel">
        <div className="table-toolbar">
          <div className="filters">
            <label>
              Turma
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Todas</option>
                {classes.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {history && (
              <label>
                Mês
                <input
                  type="month"
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
            )}
            <label>
              Situação
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Todas</option>
                <option value="editing">Em preenchimento</option>
                <option value="finalized">Finalizada</option>
                <option value="maintenance">Em manutenção</option>
              </select>
            </label>
          </div>
        </div>
        {sessions.loading ? (
          <Loading />
        ) : sessions.error ? (
          <ErrorState retry={sessions.reload} />
        ) : !sessions.data?.rows.length ? (
          <Empty text="Nenhuma chamada registrada." />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Turma</th>
                  <th>Pessoas</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessions.data.rows.map((s) => (
                  <tr key={s.id}>
                    <td data-label="Data">{dateLabel(s.scheduled_date)}</td>
                    <td data-label="Turma">
                      {classes.data?.find((c) => c.id === s.class_id)?.name ||
                        "Turma"}
                    </td>
                    <td data-label="Pessoas">{s.original_member_count}</td>
                    <td>
                      <Badge value={s.status} />
                    </td>
                    <td className="row-actions">
                      <button onClick={() => setSessionId(s.id)}>Abrir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          total={sessions.data?.total || 0}
          onChange={setPage}
        />
      </section>
      {!history && can("settings.manage") && !classes.data?.length && (
        <Link to="/configuracoes/turmas" className="button">
          Cadastrar turma
        </Link>
      )}
    </>
  );
}
function ClipboardSymbol() {
  return <CheckCheck size={26} />;
}
function AttendanceSession({ id, onBack }: { id: string; onBack: () => void }) {
  const { user, can, refresh } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [detail, setDetail] = useState<Row<"attendance_members"> | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const savingRef = useRef(false);
  const data = useAsync(async () => {
    const [session, members, maintenance] = await Promise.all([
      client().from("attendance_sessions").select("*").eq("id", id).single(),
      client()
        .from("attendance_members")
        .select("*")
        .eq("session_id", id)
        .order("full_name_snapshot")
        .limit(1000),
      client()
        .from("attendance_maintenance")
        .select("*")
        .eq("session_id", id)
        .order("opened_at", { ascending: false }),
    ]);
    if (session.error || members.error || maintenance.error)
      throw session.error || members.error || maintenance.error;
    if (session.data.original_member_count > 1000)
      throw new Error("NARROW_PERIOD");
    const course = await rpc("course_status", {
      class_identifier: session.data.class_id,
      day: session.data.scheduled_date,
    });
    return {
      session: session.data,
      members: members.data,
      maintenance: maintenance.data,
      course: course as unknown as CourseStatus,
    };
  }, [id]);
  const reloadAttendance = data.reload;
  useEffect(() => {
    const timer = setInterval(() => {
      if (!savingRef.current) reloadAttendance();
    }, 20000);
    return () => clearInterval(timer);
  }, [reloadAttendance]);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (savingRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, []);
  async function save(changes: Record<string, unknown>[]) {
    if (data.data?.session.status === "maintenance" && !user.recently_verified) {
      setSecurityOpen(true);
      return false;
    }
    setBusy(true);
    savingRef.current = true;
    const ok = await runAction(
      () =>
        rpc("save_attendance", {
          session_identifier: id,
          changes: json(changes),
        }),
      "Salvo",
    );
    setBusy(false);
    savingRef.current = false;
    if (ok) capture("attendance_saved", { maintenance: data.data?.session.status === "maintenance" });
    data.reload();
    return ok;
  }
  if (securityOpen)
    return (
      <Verification
        onCancel={() => setSecurityOpen(false)}
        onDone={async () => {
          await refresh();
          setSecurityOpen(false);
          capture("attendance_reauthentication_success");
        }}
      />
    );
  if (data.loading && !data.data) return <Loading />;
  if (data.error) return <ErrorState retry={data.reload} />;
  if (!data.data) return null;
  const { session, members, maintenance, course } = data.data;
  const editable =
    session.status === "maintenance"
      ? can("attendance.maintenance")
      : session.status === "editing" &&
        course.can_open &&
        can("attendance.manage");
  const filtered = members.filter(
    (m) =>
      (!status || m.status === status) &&
      `${m.full_name_snapshot} ${m.registration_snapshot}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const filled = members.filter((m) => m.status !== "pending").length;
  const present = members.filter((m) =>
    ["present", "late", "early_exit", "occurrence"].includes(m.status),
  ).length;
  return (
    <>
      <button className="back-button" onClick={onBack}>
        <ChevronLeft size={18} />
        Voltar às chamadas
      </button>
      <Heading
        title={`Chamada · ${dateLabel(session.scheduled_date)}`}
        eyebrow="PRESENÇA DA TURMA"
      >
        <Badge value={session.status} />
        {can("report.view") && (
          <Link
            className="button"
            to={`/relatorios?data=${session.scheduled_date}&turma=${session.class_id}`}
          >
            Gerar relatório
          </Link>
        )}
        {can("attendance.maintenance") &&
          session.status !== "maintenance" &&
          (session.status !== "editing" || !course.can_open) && (
            <button onClick={() => user.recently_verified ? setReasonOpen(true) : setSecurityOpen(true)}>
              <Settings2 size={17} />
              Manutenção
            </button>
          )}
        {session.status === "maintenance" && can("attendance.maintenance") && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              if (!user.recently_verified) { setSecurityOpen(true); return; }
              void runAction(async () => {
                await rpc("end_maintenance", { session_identifier: id });
                capture("attendance_maintenance_closed");
                data.reload();
              }, "Manutenção encerrada.");
            }}
          >
            Encerrar manutenção
          </button>
        )}
      </Heading>
      <div className="stats-grid">
        <Stat title="Pessoas na turma" value={session.original_member_count} />
        <Stat title="Presentes" value={present} />
        <Stat
          title="Faltas"
          value={
            members.filter((m) => ["absent", "justified"].includes(m.status))
              .length
          }
        />
        <Stat
          title="Atrasos"
          value={members.filter((m) => (m.delay_minutes || 0) > 0).length}
        />
      </div>
      {session.status === "maintenance" && (
        <div className="notice">
          <Settings2 size={18} />
          <span>
            Em manutenção · {maintenance.find((m) => !m.closed_at)?.reason}
          </span>
        </div>
      )}
      {!editable && session.status === "editing" && (
        <div className="notice">
          Horário da chamada encerrado. Para corrigir um registro, use
          Manutenção da Chamada.
        </div>
      )}
      {maintenance.length > 0 && (
        <button
          className="maintenance-history"
          onClick={() => setHistoryOpen(true)}
        >
          <History size={16} />
          Esta chamada possui histórico de manutenção.
        </button>
      )}
      <section className="panel attendance-list">
        <div className="attendance-progress">
          <span>
            {filled} de {members.length} registros preenchidos
          </span>
          <strong>
            {Math.round((filled / Math.max(1, members.length)) * 100)}%
          </strong>
          <div className="progress-track">
            <div
              style={{
                width: `${(filled / Math.max(1, members.length)) * 100}%`,
              }}
            />
          </div>
        </div>
        <div className="table-toolbar sticky-toolbar">
          <div className="search-input">
            <Search size={18} />
            <input
              aria-label="Buscar na chamada"
              placeholder="Nome ou matrícula"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            aria-label="Filtrar presença"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas as situações</option>
            {Object.entries(attendanceLabels).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
          {editable && (
            <button
              disabled={busy}
              onClick={() => {
                const pending = members.filter((m) => m.status === "pending");
                if (!pending.length) return;
                if (
                  confirm(
                    `Marcar ${pending.length} registros não preenchidos como presentes?`,
                  )
                )
                  void save(
                    pending.map((m) => ({
                      id: m.id,
                      version: m.version,
                      status: "present",
                    })),
                  );
              }}
            >
              <CheckCheck size={17} />
              Marcar pendentes como presentes
            </button>
          )}
          <span className="save-state" aria-live="polite">
            {busy ? "Salvando..." : "Salvo"}
          </span>
        </div>
        <div className="attendance-rows">
          {filtered.slice(page * 75, (page + 1) * 75).map((member) => (
            <div className="attendance-row" key={member.id}>
              <div className="person-name">
                <span className="avatar">
                  {member.full_name_snapshot
                    .split(" ")
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join("")}
                </span>
                <div>
                  <strong>{member.full_name_snapshot}</strong>
                  <small>
                    {member.registration_snapshot}
                    {(member.delay_minutes || 0) > 0
                      ? ` · ${member.delay_minutes} min de atraso`
                      : ""}
                  </small>
                </div>
              </div>
              <div className="attendance-status">
                <Badge value={member.status} />
                {member.actual_arrival && (
                  <small>{member.actual_arrival.slice(0, 5)}</small>
                )}
              </div>
              {editable ? (
                <div className="attendance-controls">
                  <button
                    className={
                      member.status === "present"
                        ? "status-selected present"
                        : ""
                    }
                    disabled={busy}
                    aria-label={`Presente: ${member.full_name_snapshot}`}
                    onClick={() =>
                      void save([
                        {
                          id: member.id,
                          version: member.version,
                          status: "present",
                          actual_arrival: null,
                          actual_departure: null,
                        },
                      ])
                    }
                  >
                    <Check size={18} />
                    <span>Presente</span>
                  </button>
                  <button
                    className={
                      member.status === "absent" ? "status-selected absent" : ""
                    }
                    disabled={busy}
                    aria-label={`Falta: ${member.full_name_snapshot}`}
                    onClick={() =>
                      void save([
                        {
                          id: member.id,
                          version: member.version,
                          status: "absent",
                          actual_arrival: null,
                          actual_departure: null,
                        },
                      ])
                    }
                  >
                    <X size={18} />
                    <span>Falta</span>
                  </button>
                  <button
                    disabled={busy}
                    aria-label={`Detalhes: ${member.full_name_snapshot}`}
                    onClick={() => setDetail(member)}
                  >
                    <Clock3 size={18} />
                    <span>Outros</span>
                  </button>
                </div>
              ) : (
                <button
                  className="text-button"
                  onClick={() => setDetail(member)}
                >
                  Detalhes
                </button>
              )}
            </div>
          ))}
        </div>
        <Pagination
          page={page}
          size={75}
          total={filtered.length}
          onChange={setPage}
        />
        {session.status === "editing" && editable && (
          <div className="panel-footer">
            <span>{members.length - filled} pendentes</span>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                let reason: string | null = null;
                if (filled !== members.length) {
                  reason = prompt(
                    "Há registros não preenchidos. Informe o motivo para finalizar mesmo assim:",
                  );
                  if (!reason) return;
                } else if (!confirm("Finalizar esta chamada?")) return;
                await runAction(async () => {
                  await rpc("finalize_attendance", {
                    session_identifier: id,
                    reason,
                  });
                  data.reload();
                }, "Chamada finalizada.");
              }}
            >
              Finalizar chamada
            </button>
          </div>
        )}
      </section>
      {detail && (
        <Modal
          title={detail.full_name_snapshot}
          open
          onClose={() => setDetail(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (
                await save([
                  {
                    id: detail.id,
                    version: detail.version,
                    status: form.get("status"),
                    actual_arrival: form.get("actual_arrival") || null,
                    actual_departure: form.get("actual_departure") || null,
                    notes: form.get("notes"),
                  },
                ])
              )
                setDetail(null);
            }}
          >
            <div className="form-grid">
              <Field label="Presença" wide>
                <select
                  name="status"
                  defaultValue={detail.status}
                  disabled={!editable}
                >
                  {Object.entries(attendanceLabels).map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Entrada real">
                <input
                  type="time"
                  name="actual_arrival"
                  defaultValue={detail.actual_arrival?.slice(0, 5)}
                  disabled={!editable}
                />
              </Field>
              <Field label="Saída real">
                <input
                  type="time"
                  name="actual_departure"
                  defaultValue={detail.actual_departure?.slice(0, 5)}
                  disabled={!editable}
                />
              </Field>
              <Field label="Observação" wide>
                <textarea
                  name="notes"
                  defaultValue={detail.notes}
                  disabled={!editable}
                />
              </Field>
            </div>
            {editable && (
              <div className="modal-footer">
                <button className="primary" disabled={busy}>
                  Salvar
                </button>
              </div>
            )}
          </form>
        </Modal>
      )}
      {reasonOpen && (
        <Modal
          title="Motivo da manutenção"
          open
          onClose={() => setReasonOpen(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const reason = String(
                new FormData(e.currentTarget).get("reason"),
              );
              await runAction(async () => {
                await rpc("start_maintenance", {
                  session_identifier: id,
                  reason,
                });
                capture("attendance_maintenance_opened");
                setReasonOpen(false);
                data.reload();
              }, "Manutenção aberta.");
            }}
          >
            <Field label="Motivo">
              <textarea name="reason" required minLength={3} autoFocus />
            </Field>
            <div className="modal-footer">
              <button className="primary">Abrir manutenção</button>
            </div>
          </form>
        </Modal>
      )}
      <Modal
        title="Histórico de manutenção"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      >
        {maintenance.map((item) => (
          <div className="timeline-item" key={item.id}>
            <strong>{item.reason}</strong>
            <p>Abertura: {dateLabel(item.opened_at, true)}</p>
            <p>Encerramento: {dateLabel(item.closed_at, true)}</p>
            <Link
              to={`/auditoria?manutencao=${item.id}`}
              className="text-button"
            >
              Ver alterações
            </Link>
          </div>
        ))}
      </Modal>
    </>
  );
}
