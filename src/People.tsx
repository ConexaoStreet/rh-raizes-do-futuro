import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, FileUp, Paperclip, Plus, TriangleAlert, Upload } from "lucide-react";
import {
  client,
  json,
  rpc,
  runAction,
  signedUrl,
  uploadAttachment,
  useAsync,
  useDebounce,
} from "./api";
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
  Stat,
} from "./components";
import { EntityForm, EntityPage, specs, type EntityRecord } from "./entities";
import { dateLabel, label, localDate, number } from "./domain";
import type { Row } from "./database.types";
import { ImportEmployees } from "./imports";
type Mode =
  | "employees"
  | "profile"
  | "absences"
  | "lateness"
  | "justifications"
  | "feedbacks";
export default function People({ mode }: { mode: Mode }) {
  const [importOpen, setImportOpen] = useState(false);
  const [feedback, setFeedback] = useState<EntityRecord | null>(null);
  const [version, setVersion] = useState(0);
  const [peopleGroup, setPeopleGroup] = useState<"class" | "rh">("class");
  if (mode === "employees")
    return (
      <>
        <EntityPage
          key={version}
          spec={specs.colaboradores}
          filter={{ key: "member_group", value: peopleGroup }}
          subnav={
            <div className="tabs" role="tablist" aria-label="Grupos de pessoas">
              <button
                role="tab"
                aria-selected={peopleGroup === "rh"}
                className={peopleGroup === "rh" ? "active" : ""}
                onClick={() => setPeopleGroup("rh")}
              >
                Equipe de RH
              </button>
              <button
                role="tab"
                aria-selected={peopleGroup === "class"}
                className={peopleGroup === "class" ? "active" : ""}
                onClick={() => setPeopleGroup("class")}
              >
                Turma
              </button>
            </div>
          }
          extra={
            <button onClick={() => setImportOpen(true)}>
              <Upload size={17} />
              Importar
            </button>
          }
        />
        {importOpen && (
          <ImportEmployees
            onClose={() => setImportOpen(false)}
            onSaved={() => setVersion((v) => v + 1)}
          />
        )}
      </>
    );
  if (mode === "profile") return <EmployeeProfile />;
  if (mode === "feedbacks")
    return (
      <>
        <EntityPage spec={specs.feedbacks} onSelect={setFeedback} />
        {feedback && (
          <FeedbackDetail
            feedback={feedback as unknown as Row<"feedbacks">}
            onClose={() => setFeedback(null)}
          />
        )}
      </>
    );
  if (mode === "justifications") return <Justifications />;
  if (mode === "absences")
    return (
      <>
        <div className="notice maintenance-notice">
          <TriangleAlert size={20} />
          <div>
            <strong>Histórico da planilha importado</strong>
            <span>As faltas e presenças registradas na planilha já estão no sistema. A base histórica contém ocorrências; nomes ausentes em uma data não foram convertidos automaticamente em presença.</span>
          </div>
        </div>
        <Occurrences />
      </>
    );
  return <Occurrences late={mode === "lateness"} />;
}
function EmployeeProfile() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const identifier = id || user.employee_id || "";
  const [tab, setTab] = useState("Resumo");
  const [edit, setEdit] = useState(false);
  const data = useAsync(async () => {
    const { data, error } = await client()
      .from("employees")
      .select("*")
      .eq("id", identifier)
      .single();
    if (error) throw error;
    return data;
  }, [identifier]);
  const summary = useAsync(async () => {
    const [members, grades, feedbacks] = await Promise.all([
      client()
        .from("attendance_members")
        .select("status,delay_minutes")
        .eq("employee_id", identifier)
        .limit(1000),
      client()
        .from("performance_reviews")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", identifier),
      client()
        .from("feedbacks")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", identifier),
    ]);
    if (members.error || grades.error || feedbacks.error)
      throw members.error || grades.error || feedbacks.error;
    return {
      members: members.data || [],
      grades: grades.count || 0,
      feedbacks: feedbacks.count || 0,
    };
  }, [identifier]);
  if (!identifier)
    return (
      <Empty text="Seu cadastro ainda não foi vinculado a um colaborador." />
    );
  if (data.loading) return <Loading />;
  if (data.error || !data.data) return <ErrorState retry={data.reload} />;
  const employee = data.data;
  const filled =
    summary.data?.members.filter((m) => m.status !== "pending") || [];
  const present = filled.filter((m) =>
    ["present", "late", "early_exit", "occurrence"].includes(m.status),
  );
  return (
    <>
      <Heading
        title={employee.social_name || employee.full_name}
        eyebrow="RAÍZES DO FUTURO · TURMA 16807"
      >
        <Badge value={employee.status} />
        {can("employee.manage") && (
          <button onClick={() => setEdit(true)}>Editar cadastro</button>
        )}
        {can("report.view") && (
          <Link to={`/relatorios?colaborador=${identifier}`} className="button">
            Gerar relatório
          </Link>
        )}
      </Heading>
      <div className="tabs" role="tablist">
        {[
          "Resumo",
          "Presença",
          "Feedbacks",
          "Notas",
          "Documentos",
          ...(can("employee.manage") ? ["Histórico", "Observações"] : []),
        ].map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            className={tab === name ? "active" : ""}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {tab === "Resumo" && (
        <>
          <div className="stats-grid">
            <Stat
              title="Presença registrada"
              value={
                filled.length
                  ? `${Math.round((present.length / filled.length) * 100)}%`
                  : "-"
              }
            />
            <Stat
              title="Faltas"
              value={
                filled.filter((m) => ["absent", "justified"].includes(m.status))
                  .length
              }
            />
            <Stat
              title="Atrasos"
              value={filled.filter((m) => (m.delay_minutes || 0) > 0).length}
            />
            <Stat title="Feedbacks" value={summary.data?.feedbacks || 0} />
          </div>
          <section className="panel detail-grid">
            {[
              ["Nome completo", employee.full_name],
              ["E-mail", employee.email],
              ["Telefone", employee.phone],
              ["Código interno", employee.registration],
              ["Data de entrada", dateLabel(employee.join_date)],
              [
                "Horário",
                `${employee.expected_arrival.slice(0, 5)} às ${employee.expected_departure.slice(0, 5)}`,
              ],
            ].map(([title, value]) => (
              <div key={title}>
                <small>{title}</small>
                <strong>{value || "-"}</strong>
              </div>
            ))}
          </section>
        </>
      )}
      {tab === "Presença" && <Occurrences employeeId={identifier} />}{" "}
      {tab === "Feedbacks" && <EmployeeFeedbacks id={identifier} />}{" "}
      {tab === "Notas" && <EmployeeGrades id={identifier} />}{" "}
      {tab === "Documentos" && <Documents employeeId={identifier} />}{" "}
      {tab === "Histórico" && <EmployeeHistory id={identifier} />}{" "}
      {tab === "Observações" && <AdminNotes id={identifier} />}{" "}
      {edit && (
        <EntityForm
          spec={specs.colaboradores}
          record={employee as unknown as EntityRecord}
          onClose={() => setEdit(false)}
          onSaved={data.reload}
        />
      )}
    </>
  );
}
function EmployeeFeedbacks({ id }: { id: string }) {
  const [selected, setSelected] = useState<Row<"feedbacks"> | null>(null);
  const data = useAsync(async () => {
    const { data, error } = await client()
      .from("feedbacks")
      .select("*")
      .eq("employee_id", id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }, [id]);
  return (
    <section className="panel">
      {data.loading ? (
        <Loading />
      ) : data.data?.length ? (
        data.data.map((row) => (
          <button
            className="list-item"
            key={row.id}
            onClick={() => setSelected(row)}
          >
            <span>
              <strong>{row.title}</strong>
              <small>{dateLabel(row.created_at)}</small>
            </span>
            <Badge value={row.status} />
          </button>
        ))
      ) : (
        <Empty />
      )}
      {selected && (
        <FeedbackDetail feedback={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
function FeedbackDetail({
  feedback,
  onClose,
}: {
  feedback: Row<"feedbacks">;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [read, setRead] = useState(Boolean(feedback.read_at));
  const comments = useAsync(async () => {
    const { data, error } = await client()
      .from("feedback_followups")
      .select("*")
      .eq("feedback_id", feedback.id)
      .order("created_at");
    if (error) throw error;
    return data;
  }, [feedback.id]);
  return (
    <Modal title={feedback.title} open onClose={onClose} wide>
      <div className="feedback-detail">
        <div className="actions">
          <Badge value={feedback.kind} />
          <Badge value={feedback.status} />
          <span>Prazo: {dateLabel(feedback.due_date)}</span>
        </div>
        {[
          ["Descrição", feedback.description],
          ["Pontos positivos", feedback.strengths],
          ["Pontos a desenvolver", feedback.improvements],
          ["Ações combinadas", feedback.actions],
        ]
          .filter(([, value]) => value)
          .map(([title, value]) => (
            <div key={title}>
              <h3>{title}</h3>
              <p className="preserve-lines">{value}</p>
            </div>
          ))}
        {user.employee_id === feedback.employee_id && feedback.released && (
          <button
            disabled={read}
            onClick={() =>
              void runAction(async () => {
                await rpc("feedback_reply", {
                  identifier: feedback.id,
                  body: null,
                  mark_read: true,
                });
                setRead(true);
              })
            }
          >
            {read ? "Leitura confirmada" : "Li este feedback"}
          </button>
        )}
        <h3>Acompanhamento</h3>
        {comments.data?.map((comment) => (
          <div className="comment" key={comment.id}>
            <p>{comment.body}</p>
            <small>
              {dateLabel(comment.created_at, true)}
              {comment.author_id === user.profile.id ? " · Você" : ""}
            </small>
          </div>
        ))}
        {feedback.allow_response && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const body = String(new FormData(form).get("body"));
              if (
                await runAction(() =>
                  rpc("feedback_reply", {
                    identifier: feedback.id,
                    body,
                    mark_read: false,
                  }),
                )
              ) {
                form.reset();
                comments.reload();
              }
            }}
          >
            <Field label="Resposta">
              <textarea name="body" required maxLength={5000} />
            </Field>
            <div className="modal-footer">
              <button className="primary">Enviar resposta</button>
            </div>
          </form>
        )}
        <Documents employeeId={feedback.employee_id} feedbackId={feedback.id} />
      </div>
    </Modal>
  );
}
function EmployeeGrades({ id }: { id: string }) {
  const data = useAsync(async () => {
    const { data, error } = await client()
      .from("performance_reviews")
      .select("*,performance_scores(*)")
      .eq("employee_id", id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data as unknown as (Row<"performance_reviews"> & {
      performance_scores: Row<"performance_scores">[];
    })[];
  }, [id]);
  return (
    <section className="panel">
      {data.loading ? (
        <Loading />
      ) : !data.data?.length ? (
        <Empty />
      ) : (
        data.data.map((review) => {
          const total = review.performance_scores.reduce(
            (s, c) => s + c.weight,
            0,
          );
          const avg =
            review.performance_scores.reduce(
              (s, c) => s + c.score * c.weight,
              0,
            ) / total;
          return (
            <div className="grade-summary" key={review.id}>
              <h3>
                {dateLabel(review.created_at)} · Média {number(avg, 1)}
              </h3>
              <div className="score-grid">
                {review.performance_scores.map((s) => (
                  <div key={s.id}>
                    <span>{s.criterion_name}</span>
                    <strong>{number(s.score, 1)}</strong>
                  </div>
                ))}
              </div>
              <p>{review.notes}</p>
            </div>
          );
        })
      )}
    </section>
  );
}
export function Documents({
  employeeId,
  justificationId,
  feedbackId,
}: {
  employeeId: string;
  justificationId?: string;
  feedbackId?: string;
}) {
  const { can } = useAuth();
  const [uploading, setUploading] = useState(false);
  const data = useAsync(async () => {
    let q = client()
      .from("attachments")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(100);
    if (justificationId) q = q.eq("justification_id", justificationId);
    if (feedbackId) q = q.eq("feedback_id", feedbackId);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }, [employeeId, justificationId, feedbackId]);
  return (
    <section className="documents">
      <div className="panel-heading">
        <h3>Documentos</h3>
        <label className="button upload-button">
          <Paperclip size={17} />
          {uploading ? "Enviando..." : "Anexar arquivo"}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.docx"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              await runAction(async () => {
                await uploadAttachment(file, employeeId, {
                  justificationId,
                  feedbackId,
                });
                data.reload();
              }, "Arquivo anexado.");
              setUploading(false);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {data.loading ? (
        <Loading />
      ) : data.data?.length ? (
        data.data.map((file) => (
          <div className="file-row" key={file.id}>
            <FileUp size={21} />
            <span>
              {file.filename}
              <small>
                {Math.ceil(file.size_bytes / 1024)} KB ·{" "}
                {dateLabel(file.created_at)}
              </small>
            </span>
            <button
              className="icon-button"
              aria-label={`Baixar ${file.filename}`}
              onClick={() =>
                void runAction(async () => {
                  const url = await signedUrl(file.bucket, file.path);
                  window.open(url, "_blank", "noopener,noreferrer");
                }, "")
              }
            >
              <Download size={18} />
            </button>
            {can("files.manage") && (
              <button
                className="text-button danger"
                onClick={() => {
                  const reason = prompt("Motivo para arquivar o arquivo:");
                  if (reason)
                    void runAction(async () => {
                      await rpc("archive_attachment", {
                        identifier: file.id,
                        reason,
                      });
                      data.reload();
                    });
                }}
              >
                Arquivar
              </button>
            )}
          </div>
        ))
      ) : (
        <Empty text="Nenhum documento anexado." />
      )}
    </section>
  );
}
function AdminNotes({ id }: { id: string }) {
  const data = useAsync(async () => {
    const { data, error } = await client()
      .from("employee_admin_notes")
      .select("*")
      .eq("employee_id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }, [id]);
  return (
    <section className="panel padded">
      <form
        key={data.data?.version}
        onSubmit={async (e) => {
          e.preventDefault();
          await runAction(async () => {
            await rpc("save_entity", {
              entity: "employee_admin_notes",
              payload: json({
                ...(data.data?.id ? { id: data.data.id } : {}),
                employee_id: id,
                notes: String(new FormData(e.currentTarget).get("notes")),
              }),
              expected_version: data.data?.version || null,
            });
            data.reload();
          });
        }}
      >
        <Field label="Observações administrativas">
          <textarea
            name="notes"
            defaultValue={data.data?.notes || ""}
            rows={6}
          />
        </Field>
        <div className="modal-footer">
          <button className="primary">Salvar</button>
        </div>
      </form>
    </section>
  );
}
function EmployeeHistory({ id }: { id: string }) {
  const data = useAsync(async () => {
    const { data, error } = await client()
      .from("audit_logs")
      .select("*")
      .or(
        `entity_id.eq.${id},new_values->>employee_id.eq.${id},old_values->>employee_id.eq.${id}`,
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }, [id]);
  return (
    <section className="panel padded">
      {data.loading ? (
        <Loading />
      ) : (
        data.data?.map((log) => (
          <div className="timeline-item" key={log.id}>
            <strong>{log.actor_name || "Sistema"}</strong>
            <span>
              {log.action} · {log.module}
            </span>
            <small>{dateLabel(log.created_at, true)}</small>
          </div>
        ))
      )}
    </section>
  );
}
type OccurrenceRow = Row<"attendance_members"> & {
  attendance_sessions: { scheduled_date: string; class_id: string };
};
function Occurrences({
  late = false,
  employeeId,
}: {
  late?: boolean;
  employeeId?: string;
}) {
  const { user, can } = useAuth();
  const [start, setStart] = useState(
    localDate(new Date(user.server_time)).slice(0, 7) + "-01",
  );
  const [end, setEnd] = useState(localDate(new Date(user.server_time)));
  const [search, setSearch] = useState("");
  const query = useDebounce(search);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<OccurrenceRow | null>(null);
  const data = useAsync(async () => {
    let q = client()
      .from("attendance_members")
      .select("*,attendance_sessions!inner(scheduled_date,class_id)", {
        count: "exact",
      })
      .gte("attendance_sessions.scheduled_date", start)
      .lte("attendance_sessions.scheduled_date", end)
      .order("created_at", { ascending: false })
      .range(page * 25, page * 25 + 24);
    if (employeeId) q = q.eq("employee_id", employeeId);
    else if (late) q = q.gt("delay_minutes", 0);
    else q = q.in("status", ["absent", "justified"]);
    if (query)
      q = q.ilike("full_name_snapshot", `%${query.replace(/[%_]/g, "")}%`);
    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: data as unknown as OccurrenceRow[], total: count || 0 };
  }, [start, end, query, page, late, employeeId]);
  return (
    <>
      {!employeeId && (
        <Heading title={late ? "Atrasos" : "Faltas"} eyebrow="PRESENÇA">
          {can("attendance.manage") && (
            <Link to="/chamada" className="button primary">
              <Plus size={17} />
              Registrar na chamada
            </Link>
          )}
        </Heading>
      )}
      <section className="panel">
        <div className="table-toolbar">
          <div className="filters">
            <label>
              De
              <input
                type="date"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              Até
              <input
                type="date"
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              Nome
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </label>
          </div>
        </div>
        {data.loading ? (
          <Loading />
        ) : data.error ? (
          <ErrorState retry={data.reload} />
        ) : !data.data?.rows.length ? (
          <Empty />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Data</th>
                  <th>Presença</th>
                  <th>Entrada</th>
                  <th>Atraso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data.rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Colaborador">{row.full_name_snapshot}</td>
                    <td data-label="Data">
                      {dateLabel(row.attendance_sessions.scheduled_date)}
                    </td>
                    <td>
                      <Badge value={row.status} />
                    </td>
                    <td data-label="Entrada">
                      {row.actual_arrival?.slice(0, 5) || "-"}
                    </td>
                    <td data-label="Atraso">{row.delay_minutes} min</td>
                    <td className="row-actions">
                      <button onClick={() => setSelected(row)}>
                        Justificar
                      </button>
                      {can("attendance.maintenance") && (
                        <Link
                          className="text-button"
                          to={`/presenca?chamada=${row.session_id}`}
                        >
                          Corrigir chamada
                        </Link>
                      )}
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
      {selected && (
        <JustificationForm
          member={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function JustificationForm({
  member,
  onClose,
}: {
  member: OccurrenceRow;
  onClose: () => void;
}) {
  const [created, setCreated] = useState("");
  const categories = useAsync(async () => {
    const { data, error } = await client()
      .from("justification_categories")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return data;
  }, []);
  return (
    <Modal open title="Nova justificativa" onClose={onClose}>
      {created ? (
        <>
          <div className="notice">Justificativa enviada.</div>
          <Documents
            employeeId={member.employee_id}
            justificationId={created}
          />
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await runAction(async () => {
              const id = await rpc("submit_justification", {
                member_identifier: member.id,
                category_identifier: String(f.get("category_id")),
                reason: String(f.get("reason")),
              });
              setCreated(String(id));
            });
          }}
        >
          <p>
            {member.full_name_snapshot} ·{" "}
            {dateLabel(member.attendance_sessions.scheduled_date)}
          </p>
          <div className="form-stack">
            <Field label="Tipo">
              <select name="category_id" required>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Motivo">
              <textarea name="reason" minLength={3} required />
            </Field>
          </div>
          <div className="modal-footer">
            <button className="primary">Enviar justificativa</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
function Justifications() {
  const { can } = useAuth();
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<
    | (Row<"absence_justifications"> & { employees: { full_name: string } })
    | null
  >(null);
  const data = useAsync(async () => {
    let q = client()
      .from("absence_justifications")
      .select("*,employees(full_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * 25, page * 25 + 24);
    if (status) q = q.eq("status", status);
    const { data, error, count } = await q;
    if (error) throw error;
    return {
      rows: data as unknown as (Row<"absence_justifications"> & {
        employees: { full_name: string };
      })[],
      total: count || 0,
    };
  }, [status, page]);
  return (
    <>
      <Heading title="Justificativas" eyebrow="PRESENÇA">
        <Link className="button" to="/faltas">
          Nova justificativa
        </Link>
      </Heading>
      <section className="panel">
        <div className="table-toolbar">
          <select
            aria-label="Situação da justificativa"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas</option>
            <option value="pending">Pendentes</option>
            <option value="accepted">Aceitas</option>
            <option value="rejected">Recusadas</option>
          </select>
        </div>
        {data.loading ? (
          <Loading />
        ) : data.error ? (
          <ErrorState retry={data.reload} />
        ) : !data.data?.rows.length ? (
          <Empty />
        ) : (
          data.data.rows.map((row) => (
            <button
              key={row.id}
              className="list-item"
              onClick={() => setSelected(row)}
            >
              <span>
                <strong>{row.employees?.full_name}</strong>
                <small>{row.reason}</small>
              </span>
              <Badge value={row.status} />
            </button>
          ))
        )}
        <Pagination
          page={page}
          total={data.data?.total || 0}
          onChange={setPage}
        />
      </section>
      {selected && (
        <Modal
          title="Justificativa"
          open
          onClose={() => setSelected(null)}
          wide
        >
          <div className="detail-text">
            <h3>{selected.employees?.full_name}</h3>
            <Badge value={selected.status} />
            <p>{selected.reason}</p>
            {selected.review_comment && (
              <p>Análise: {selected.review_comment}</p>
            )}
          </div>
          <Documents
            employeeId={selected.employee_id}
            justificationId={selected.id}
          />
          {can("justification.manage") && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const decision = String(f.get("decision"));
                if (!confirm(`${label(decision)}: confirmar análise?`)) return;
                await runAction(async () => {
                  await rpc("review_justification", {
                    identifier: selected.id,
                    decision,
                    note: String(f.get("note")),
                    expected_version: selected.version,
                  });
                  setSelected(null);
                  data.reload();
                });
              }}
            >
              <div className="form-grid">
                <Field label="Decisão">
                  <select name="decision">
                    <option value="accepted">Aceitar</option>
                    <option value="rejected">Recusar</option>
                  </select>
                </Field>
                <Field label="Comentário da análise" wide>
                  <textarea name="note" required minLength={3} />
                </Field>
              </div>
              <div className="modal-footer">
                <button className="primary">Confirmar análise</button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
