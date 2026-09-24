import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Copy,
  Download,
  History,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { client, json, rpc, runAction, useAsync, useDebounce } from "./api";
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
import { dateLabel, label } from "./domain";
import type { Json, Row } from "./database.types";
export default function Administration({ mode }: { mode: string }) {
  if (mode === "notifications") return <Notifications />;
  if (mode === "sessions") return <Sessions />;
  if (mode === "usuarios") return <UsersPage />;
  if (mode === "cargos") return <RolesPage />;
  if (mode === "auditoria") return <Audit />;
  if (mode === "admin") return <SystemPanel />;
  return <SettingsPage />;
}
function Notifications() {
  const [page, setPage] = useState(0);
  const data = useAsync(async () => {
    const { data, error, count } = await client()
      .from("notifications")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * 25, page * 25 + 24);
    if (error) throw error;
    return { rows: data, total: count || 0 };
  }, [page]);
  return (
    <>
      <Heading title="Notificações" />
      <section className="panel">
        {data.loading ? (
          <Loading />
        ) : data.error ? (
          <ErrorState retry={data.reload} />
        ) : !data.data?.rows.length ? (
          <Empty text="Nenhuma notificação." />
        ) : (
          data.data.rows.map((n) => (
            <div
              className={`notification-row ${!n.read_at ? "unread" : ""}`}
              key={n.id}
            >
              <div>
                <Link to={n.path}>{n.title}</Link>
                <p>{n.body}</p>
                <small>{dateLabel(n.created_at, true)}</small>
              </div>
              {!n.read_at && (
                <button
                  onClick={() =>
                    void runAction(async () => {
                      await rpc("mark_notification", { identifier: n.id });
                      data.reload();
                    }, "")
                  }
                >
                  Marcar como lida
                </button>
              )}
            </div>
          ))
        )}
        <Pagination
          page={page}
          total={data.data?.total || 0}
          onChange={setPage}
        />
      </section>
    </>
  );
}
type UserSession = {
  id: string;
  created_at: string;
  updated_at: string;
  current: boolean;
  revoked: boolean;
};
function Sessions({ target }: { target?: string }) {
  const data = useAsync(
    async () =>
      rpc("my_sessions", { target_user: target || null }) as unknown as Promise<
        UserSession[]
      >,
    [target],
  );
  return (
    <>
      <Heading title={target ? "Sessões do usuário" : "Minhas sessões"} />
      <section className="panel">
        {data.loading ? (
          <Loading />
        ) : data.error ? (
          <ErrorState retry={data.reload} />
        ) : !data.data?.length ? (
          <Empty />
        ) : (
          data.data.map((s) => (
            <div className="list-item" key={s.id}>
              <div>
                <strong>{s.current ? "Sessão atual" : "Outro acesso"}</strong>
                <small>
                  Início: {dateLabel(s.created_at, true)} · Último acesso:{" "}
                  {dateLabel(s.updated_at, true)}
                </small>
              </div>
              <Badge value={s.revoked ? "inactive" : "active"} />
              {!s.revoked && (
                <button
                  onClick={() => {
                    if (confirm("Encerrar esta sessão?"))
                      void runAction(async () => {
                        await rpc("revoke_session", {
                          session_identifier: s.id,
                        });
                        data.reload();
                      }, "Sessão encerrada.");
                  }}
                >
                  Encerrar
                </button>
              )}
            </div>
          ))
        )}
      </section>
    </>
  );
}
function UsersPage() {
  const { can } = useAuth();
  const [query, setQuery] = useState("");
  const search = useDebounce(query);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Row<"profiles"> | null>(null);
  const [sessions, setSessions] = useState("");
  const data = useAsync(async () => {
    let q = client()
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * 25, page * 25 + 24);
    if (search) q = q.ilike("full_name", `%${search.replace(/[%_]/g, "")}%`);
    if (status) q = q.eq("status", status);
    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: data, total: count || 0 };
  }, [search, status, page]);
  return (
    <>
      <Heading title="Usuários" eyebrow="ACESSOS INDIVIDUAIS" />
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={18} />
            <input
              aria-label="Buscar usuários"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar"
            />
          </div>
          <select
            aria-label="Situação do usuário"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas as situações</option>
            {["pending", "active", "suspended", "inactive", "blocked"].map(
              (s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ),
            )}
          </select>
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
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Situação</th>
                  <th>Último acesso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data.rows.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Nome">{p.full_name}</td>
                    <td data-label="E-mail">{p.email}</td>
                    <td>
                      <Badge value={p.status} />
                    </td>
                    <td data-label="Último acesso">
                      {dateLabel(p.last_seen_at, true)}
                    </td>
                    <td className="row-actions">
                      {p.status === "pending" ? (
                        <span className="muted">Aguardando primeiro acesso</span>
                      ) : (
                        can("user.manage") && (
                          <button onClick={() => setSelected(p)}>
                            Gerenciar
                          </button>
                        )
                      )}
                      {can("user.manage") && (
                        <button
                          className="text-button"
                          onClick={() => setSessions(p.id)}
                        >
                          Sessões
                        </button>
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
        <ManageUser
          profile={selected}
          onClose={() => setSelected(null)}
          onSaved={data.reload}
        />
      )}
      <Modal
        title="Controle de acesso"
        open={Boolean(sessions)}
        onClose={() => setSessions("")}
        wide
      >
        {sessions && <Sessions target={sessions} />}
      </Modal>
    </>
  );
}
function ManageUser({
  profile,
  onClose,
  onSaved,
}: {
  profile: Row<"profiles">;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { can, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const data = useAsync(async () => {
    const [roles, employees, assigned] = await Promise.all([
      client().from("roles").select("*").eq("active", true),
      client()
        .from("employees")
        .select("id,full_name,registration")
        .is("profile_id", null)
        .eq("status", "active")
        .order("full_name")
        .limit(1000),
      client().from("user_roles").select("*").eq("user_id", profile.id),
    ]);
    if (roles.error || employees.error || assigned.error)
      throw roles.error || employees.error || assigned.error;
    return {
      roles: roles.data,
      employees: employees.data,
      assigned: assigned.data,
    };
  }, [profile.id]);
  return (
    <Modal title={profile.full_name} open onClose={onClose}>
      <p>{profile.email}</p>
      {profile.status === "pending" && !profile.onboarded_at && (
        <div className="notice">
          O cadastro precisa ser concluído pelo usuário.
        </div>
      )}
      {data.loading ? (
        <Loading />
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (profile.id === user.profile.id) return;
            const f = new FormData(e.currentTarget);
            setBusy(true);
            const ok = await runAction(() =>
              profile.status === "pending"
                ? rpc("approve_user", {
                    user_identifier: profile.id,
                    employee_identifier: String(f.get("employee")),
                    reason: String(f.get("reason")),
                  })
                : rpc("manage_user", {
                    user_identifier: profile.id,
                    new_status: String(f.get("status")),
                    role_identifiers: f.getAll("role").map(String),
                    reason: String(f.get("reason")),
                  }),
            );
            setBusy(false);
            if (ok) {
              onSaved();
              onClose();
            }
          }}
        >
          <div className="form-stack">
            {profile.status === "pending" ? (
              <Field label="Vincular ao colaborador">
                <select name="employee" required>
                  <option value="">Selecionar</option>
                  {data.data?.employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} · {e.registration}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <>
                <Field label="Situação">
                  <select name="status" defaultValue={profile.status}>
                    {["active", "suspended", "inactive", "blocked"].map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </Field>
                <h3>Cargos</h3>
                {can("user.manage") &&
                  data.data?.roles.map((r) => (
                    <label className="check" key={r.id}>
                      <input
                        name="role"
                        type="checkbox"
                        value={r.id}
                        defaultChecked={data.data?.assigned.some(
                          (a) => a.role_id === r.id,
                        )}
                      />
                      {r.name}
                    </label>
                  ))}
              </>
            )}
            <Field label="Motivo">
              <textarea name="reason" required minLength={3} />
            </Field>
          </div>
          <div className="modal-footer">
            <button
              className="primary"
              disabled={
                busy ||
                profile.id === user.profile.id ||
                (profile.status === "pending" && !profile.onboarded_at)
              }
            >
              Confirmar
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
function RolesPage() {
  const [selected, setSelected] = useState<Row<"roles"> | null | undefined>();
  const [duplicate, setDuplicate] = useState(false);
  const [historyId, setHistoryId] = useState("");
  const data = useAsync(async () => {
    const [roles, permissions, links, users] = await Promise.all([
      client().from("roles").select("*").order("level", { ascending: false }),
      client().from("permissions").select("*").order("module"),
      client().from("role_permissions").select("*"),
      client().from("user_roles").select("*"),
    ]);
    if (roles.error || permissions.error || links.error || users.error)
      throw roles.error || permissions.error || links.error || users.error;
    return {
      roles: roles.data,
      permissions: permissions.data,
      links: links.data,
      users: users.data,
    };
  }, []);
  return (
    <>
      <Heading title="Cargos e permissões" eyebrow="ADMINISTRAÇÃO">
        <button
          className="primary"
          onClick={() => {
            setDuplicate(false);
            setSelected(null);
          }}
        >
          <Plus size={18} />
          Novo cargo
        </button>
      </Heading>
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <ErrorState retry={data.reload} />
      ) : (
        data.data && (
          <>
            <div className="role-cards">
              {data.data.roles.map((role) => (
                <section className="panel role-card" key={role.id}>
                  <ShieldCheck size={24} />
                  <h2>{role.name}</h2>
                  <p>{role.description}</p>
                  <span>
                    {
                      data.data!.users.filter((u) => u.role_id === role.id)
                        .length
                    }{" "}
                    usuários
                  </span>
                  <div className="role-meta">
                    <Badge value={role.active ? "active" : "inactive"} />
                    {role.privileged && <span>Acesso elevado</span>}
                  </div>
                  <div className="actions">
                    {role.code !== "SUPER_ADMIN" && (
                      <button
                        onClick={() => {
                          setDuplicate(false);
                          setSelected(role);
                        }}
                      >
                        Editar
                      </button>
                    )}
                    <button
                      className="icon-button"
                      aria-label={`Duplicar ${role.name}`}
                      onClick={() => {
                        setDuplicate(true);
                        setSelected(role);
                      }}
                    >
                      <Copy size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Histórico de ${role.name}`}
                      onClick={() => setHistoryId(role.id)}
                    >
                      <History size={17} />
                    </button>
                  </div>
                </section>
              ))}
            </div>
            <section className="panel">
              <div className="panel-heading">
                <h2>Matriz de permissões</h2>
              </div>
              <div className="table-scroll permissions-table">
                <table>
                  <thead>
                    <tr>
                      <th>Permissão</th>
                      {data.data.roles.map((r) => (
                        <th key={r.id}>{r.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.permissions.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.module}</strong>
                          <small>{p.name}</small>
                        </td>
                        {data.data!.roles.map((r) => (
                          <td key={r.id}>
                            <span
                              aria-label={
                                data.data!.links.some(
                                  (l) =>
                                    l.role_id === r.id &&
                                    l.permission_id === p.id,
                                )
                                  ? "Permitido"
                                  : "Não permitido"
                              }
                              className={
                                data.data!.links.some(
                                  (l) =>
                                    l.role_id === r.id &&
                                    l.permission_id === p.id,
                                )
                                  ? "permission-yes"
                                  : "permission-no"
                              }
                            >
                              {data.data!.links.some(
                                (l) =>
                                  l.role_id === r.id &&
                                  l.permission_id === p.id,
                              )
                                ? "✓"
                                : "-"}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            {selected !== undefined && (
              <RoleForm
                role={selected}
                duplicate={duplicate}
                permissions={data.data.permissions}
                links={data.data.links}
                onClose={() => setSelected(undefined)}
                onSaved={data.reload}
              />
            )}
          </>
        )
      )}
      <Modal
        title="Histórico do cargo"
        open={Boolean(historyId)}
        onClose={() => setHistoryId("")}
        wide
      >
        {historyId && (
          <>
            <RoleHistory id={historyId} onSaved={data.reload} />
            <RoleAssignmentsHistory id={historyId} />
          </>
        )}
      </Modal>
    </>
  );
}
function RoleForm({
  role,
  duplicate,
  permissions,
  links,
  onClose,
  onSaved,
}: {
  role: Row<"roles"> | null;
  duplicate: boolean;
  permissions: Row<"permissions">[];
  links: Row<"role_permissions">[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={
        duplicate ? "Duplicar cargo" : role ? "Editar cargo" : "Novo cargo"
      }
      open
      onClose={onClose}
      wide
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (
            !confirm(
              "Salvar estas permissões? As sessões dos usuários deste cargo serão encerradas.",
            )
          )
            return;
          setBusy(true);
          const ok = await runAction(() =>
            rpc("save_role", {
              payload: json({
                ...(role && !duplicate ? { id: role.id } : {}),
                name: f.get("name"),
                description: f.get("description"),
                active: f.get("active") === "on",
                archived: f.get("archived") === "on",
                level: Number(f.get("level") || 1),
              }),
              permission_identifiers: f.getAll("permission").map(String),
              expected_version: role && !duplicate ? role.version : null,
              reason: String(f.get("reason")),
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
          <Field label="Nome">
            <input
              name="name"
              required
              defaultValue={
                role ? role.name + (duplicate ? " · Cópia" : "") : ""
              }
            />
          </Field>
          <Field label="Nível">
            <input
              name="level"
              type="number"
              min={1}
              max={69}
              defaultValue={Math.min(69, role?.level || 1)}
            />
          </Field>
          <Field label="Descrição" wide>
            <textarea name="description" defaultValue={role?.description} />
          </Field>
        </div>
        <div className="permission-grid">
          {permissions.map((p) => (
            <label className="check" key={p.id}>
              <input
                type="checkbox"
                name="permission"
                value={p.id}
                defaultChecked={links.some(
                  (l) => l.role_id === role?.id && l.permission_id === p.id,
                )}
              />
              <span>
                {p.module}
                <small>{p.name}</small>
              </span>
            </label>
          ))}
        </div>
        <label className="check">
          <input
            name="active"
            type="checkbox"
            defaultChecked={role?.active ?? true}
          />
          Ativo
        </label>
        <label className="check">
          <input
            name="archived"
            type="checkbox"
            defaultChecked={role?.archived || false}
          />
          Arquivado
        </label>
        <Field label="Motivo da alteração">
          <textarea name="reason" minLength={3} required />
        </Field>
        <div className="modal-footer">
          <button className="primary" disabled={busy}>
            Salvar cargo
          </button>
        </div>
      </form>
    </Modal>
  );
}
function RoleAssignmentsHistory({ id }: { id: string }) {
  const data = useAsync(async () => {
    const { data, error } = await client()
      .from("user_role_history")
      .select("*,profiles!user_role_history_user_id_fkey(full_name)")
      .eq("role_id", id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }, [id]);

  return (
    <section className="panel padded">
      <div className="panel-heading">
        <h3>Histórico de atribuições</h3>
      </div>
      {data.loading ? (
        <Loading />
      ) : !data.data?.length ? (
        <Empty text="Nenhuma atribuição registrada." />
      ) : (
        data.data.map((row) => (
          <div className="timeline-item" key={row.id}>
            <strong>{row.profiles?.full_name || "Usuário"}</strong>
            <span>{row.action === "assigned" ? "Cargo atribuído" : "Cargo removido"}</span>
            <small>{dateLabel(row.created_at, true)}</small>
          </div>
        ))
      )}
    </section>
  );
}

type RoleAssignmentHistory = Row<"user_role_history"> & {
  profiles: { full_name: string } | null;
};

function RoleHistory({ id, onSaved }: { id: string; onSaved: () => void }) {
  const data = useAsync(async () => {
    const [changes, assignments] = await Promise.all([
      client()
        .from("audit_logs")
        .select("*")
        .eq("entity_id", id)
        .eq("module", "roles")
        .order("created_at", { ascending: false })
        .limit(100),
      client()
        .from("user_role_history")
        .select("*,profiles!user_role_history_user_id_fkey(full_name)")
        .eq("role_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (changes.error || assignments.error)
      throw changes.error || assignments.error;
    return {
      changes: changes.data,
      assignments: assignments.data as unknown as RoleAssignmentHistory[],
    };
  }, [id]);

  return (
    <>
      {data.loading ? (
        <Loading />
      ) : (
        <>
          <h3>Alterações do cargo</h3>
          {!data.data?.changes.length ? (
            <Empty text="Nenhuma alteração registrada." />
          ) : (
            data.data.changes.map((row) => (
              <div className="timeline-item" key={row.id}>
                <strong>{row.actor_name || "Sistema"}</strong>
                <span>{dateLabel(row.created_at, true)}</span>
                <details>
                  <summary>Antes e depois</summary>
                  <JsonDiff before={row.old_values} after={row.new_values} />
                </details>
                {row.action === "save_role" &&
                  row.old_values &&
                  typeof row.context === "object" &&
                  row.context &&
                  "old_permissions" in row.context && (
                    <button
                      onClick={() => {
                        const reason = prompt(
                          "Motivo para restaurar a configuração anterior:",
                        );
                        if (reason)
                          void runAction(async () => {
                            const { data: role, error } = await client()
                              .from("roles")
                              .select("*")
                              .eq("id", id)
                              .single();
                            if (error) throw error;
                            const context = row.context as {
                              old_permissions: string[];
                            };
                            await rpc("save_role", {
                              payload: row.old_values,
                              permission_identifiers: context.old_permissions,
                              expected_version: role.version,
                              reason,
                            });
                            data.reload();
                            onSaved();
                          });
                      }}
                    >
                      Restaurar configuração
                    </button>
                  )}
              </div>
            ))
          )}

          <h3>Atribuições e remoções</h3>
          {!data.data?.assignments.length ? (
            <Empty text="Nenhuma atribuição de usuário registrada." />
          ) : (
            data.data.assignments.map((row) => (
              <div className="timeline-item" key={row.id}>
                <strong>{row.profiles?.full_name || "Usuário"}</strong>
                <span>
                  {row.action === "assigned" ? "Cargo atribuído" : "Cargo removido"}
                </span>
                <small>
                  {dateLabel(row.created_at, true)}
                  {row.source ? ` · ${row.source}` : ""}
                </small>
              </div>
            ))
          )}
        </>
      )}
    </>
  );
}
function JsonDiff({
  before,
  after,
}: {
  before: Json | null;
  after: Json | null;
}) {
  const old =
    before && typeof before === "object" && !Array.isArray(before)
      ? before
      : {};
  const next =
    after && typeof after === "object" && !Array.isArray(after) ? after : {};
  const keys = [...new Set([...Object.keys(old), ...Object.keys(next)])];
  return (
    <div className="table-scroll">
      <table className="diff-table">
        <thead>
          <tr>
            <th>Campo</th>
            <th>Antes</th>
            <th>Depois</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr
              key={key}
              className={
                JSON.stringify(old[key]) !== JSON.stringify(next[key])
                  ? "changed"
                  : ""
              }
            >
              <td>{key}</td>
              <td>
                {typeof old[key] === "object"
                  ? JSON.stringify(old[key])
                  : String(old[key] ?? "-")}
              </td>
              <td>
                {typeof next[key] === "object"
                  ? JSON.stringify(next[key])
                  : String(next[key] ?? "-")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Audit() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const query = useDebounce(search);
  const [type, setType] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Row<"audit_logs"> | null>(null);
  const data = useAsync(async () => {
    let q = client()
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * 25, page * 25 + 24);
    if (query) q = q.ilike("actor_name", `%${query.replace(/[%_]/g, "")}%`);
    if (type) q = q.eq("event_type", type);
    if (start) q = q.gte("created_at", start + "T00:00:00-03:00");
    if (end) q = q.lte("created_at", end + "T23:59:59-03:00");
    if (params.get("manutencao"))
      q = q.eq("context->>maintenance_id", params.get("manutencao")!);
    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: data, total: count || 0 };
  }, [query, type, start, end, page, params.toString()]);
  return (
    <>
      <Heading title="Logs e auditoria" eyebrow="HISTÓRICO DE ALTERAÇÕES" />
      <section className="panel">
        <div className="table-toolbar">
          <div className="filters">
            <label>
              Quem alterou
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              Tipo
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Todos</option>
                {[
                  ["data_change", "Alteração de dados"],
                  ["security", "Segurança"],
                  ["authentication", "Autenticação"],
                  ["export", "Exportação"],
                  ["permission_change", "Permissões"],
                  ["attendance_maintenance", "Manutenção da chamada"],
                ].map(([value, name]) => (
                  <option value={value} key={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
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
                  <th>Quando</th>
                  <th>Quem alterou</th>
                  <th>Módulo</th>
                  <th>Ação</th>
                  <th>Resultado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data.rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Quando">
                      {dateLabel(row.created_at, true)}
                    </td>
                    <td data-label="Quem alterou">
                      {row.actor_name || "Sistema"}
                    </td>
                    <td data-label="Módulo">{auditModule(row.module)}</td>
                    <td data-label="Ação">{auditAction(row.action)}</td>
                    <td>{row.success ? "Concluído" : "Recusado"}</td>
                    <td>
                      <button onClick={() => setSelected(row)}>Detalhes</button>
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
        <Modal
          title="Detalhes da alteração"
          open
          onClose={() => setSelected(null)}
          wide
        >
          <div className="detail-text">
            <strong>{selected.actor_name || "Sistema"}</strong>
            <p>
              {dateLabel(selected.created_at, true)} ·{" "}
              {auditModule(selected.module)}
            </p>
          </div>
          <JsonDiff before={selected.old_values} after={selected.new_values} />
          {selected.context && (
            <div className="audit-context">
              {typeof selected.context === "object" &&
                "reason" in selected.context && (
                  <p>Motivo: {String(selected.context.reason || "-")}</p>
                )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
const auditModule = (name: string) =>
  ({
    employees: "Colaboradores",
    profiles: "Usuários",
    attendance_sessions: "Chamadas",
    attendance_members: "Presenças",
    attendance_maintenance: "Manutenção",
    feedbacks: "Feedbacks",
    performance_reviews: "Notas",
    roles: "Cargos",
    user_roles: "Cargos dos usuários",
    role_permissions: "Permissões",
    settings: "Configurações",
    security: "Segurança",
    auth: "Acesso",
    reports: "Relatórios",
    attachments: "Documentos",
    course_calendar: "Calendário",
    absence_justifications: "Justificativas",
  })[name] || name;
const auditAction = (name: string) =>
  ({
    insert: "Criou",
    update: "Alterou",
    delete: "Removeu",
    approve: "Aprovou",
    save_role: "Alterou cargo",
    snapshot: "Registrou turma",
    start: "Abriu manutenção",
    end: "Encerrou manutenção",
    export: "Exportou",
    login: "Entrou",
    logout: "Saiu",
    otp_requested: "Solicitou código",
    otp_verified: "Confirmou código",
    otp_failed: "Código recusado",
    revoke_session: "Encerrou sessão",
    change_access: "Alterou acesso",
    scores_saved: "Salvou notas",
    scores_before: "Alterou notas",
  })[name] || name;
function SettingsPage() {
  const [editing, setEditing] = useState("");
  const data = useAsync(async () => {
    const { data, error } = await client().from("settings").select("*");
    if (error) throw error;
    return data;
  }, []);
  const links = [
    ["turmas", "Turmas"],
    ["areas", "Áreas"],
    ["funcoes", "Funções"],
    ["gestores", "Gestores"],
    ["categorias", "Tipos de justificativa"],
    ["criterios", "Critérios e pesos"],
    ["ciclos", "Ciclos de notas"],
    ["criterios-gestao", "Critérios da gestão"],
    ["eventos", "Eventos"],
  ];
  const row = data.data?.find((r) => r.key === editing);
  return (
    <>
      <Heading title="Configurações" eyebrow="GESTÃO DE RH" />
      <div className="settings-links">
        {links.map(([path, title]) => (
          <Link
            to={`/configuracoes/${path}`}
            className="panel setting-link"
            key={path}
          >
            <strong>{title}</strong>
            <span>→</span>
          </Link>
        ))}
        <button
          className="panel setting-link"
          onClick={() => setEditing("lateness")}
        >
          <strong>Limites de atraso</strong>
          <span>→</span>
        </button>
      </div>
      {row && (
        <Modal title="Limites de atraso" open onClose={() => setEditing("")}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await runAction(async () => {
                await rpc("save_entity", {
                  entity: "settings",
                  payload: json({
                    id: row.id,
                    key: row.key,
                    value: {
                      light: Number(f.get("light")),
                      moderate: Number(f.get("moderate")),
                    },
                  }),
                  expected_version: row.version,
                });
                setEditing("");
                data.reload();
              });
            }}
          >
            <div className="form-grid">
              <Field label="Atraso leve até (min)">
                <input
                  name="light"
                  type="number"
                  min={0}
                  defaultValue={Number((row.value as { light: number }).light)}
                  required
                />
              </Field>
              <Field label="Atraso moderado até (min)">
                <input
                  name="moderate"
                  type="number"
                  min={0}
                  defaultValue={Number(
                    (row.value as { moderate: number }).moderate,
                  )}
                  required
                />
              </Field>
            </div>
            <div className="modal-footer">
              <button className="primary">Salvar</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function SystemPanel() {
  const [maintenance, setMaintenance] = useState(false);
  const data = useAsync(
    async () =>
      rpc("system_health", {}) as unknown as Promise<{
        version: string;
        active_users: number;
        pending_users: number;
        sessions: number;
        failed_2fa_today: number;
        exports: number;
        snapshot_errors: number;
        tables_without_rls: number;
      }>,
    [],
  );
  const settings = useAsync(async () => {
    const { data, error } = await client()
      .from("settings")
      .select("*")
      .eq("key", "maintenance")
      .single();
    if (error) throw error;
    return data;
  }, []);
  const releases = useAsync(async () => {
    const { data, error } = await client()
      .from("releases")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }, []);
  return (
    <>
      <Heading title="Administração total" eyebrow="DESENVOLVEDOR DO SISTEMA">
        <Badge value={data.data?.version || "1.0.0"} />
      </Heading>
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <ErrorState retry={data.reload} />
      ) : (
        data.data && (
          <>
            <div className="stats-grid">
              <Stat title="Usuários ativos" value={data.data.active_users} />
              <Stat
                title="Cadastros pendentes"
                value={data.data.pending_users}
              />
              <Stat title="Sessões ativas" value={data.data.sessions} />
              <Stat
                title="Falhas de verificação hoje"
                value={data.data.failed_2fa_today}
              />
            </div>
            <div className="dashboard-grid">
              <section className="panel padded">
                <h2>Integridade do sistema</h2>
                <div className="health-row">
                  <span>Composição das chamadas</span>
                  <Badge
                    value={data.data.snapshot_errors ? "blocked" : "active"}
                  />
                </div>
                <div className="health-row">
                  <span>Proteção das tabelas</span>
                  <Badge
                    value={data.data.tables_without_rls ? "blocked" : "active"}
                  />
                </div>
                <div className="health-row">
                  <span>Arquivos exportados</span>
                  <strong>{data.data.exports}</strong>
                </div>
                <button onClick={data.reload}>Verificar novamente</button>
              </section>
              <section className="panel padded">
                <h2>Manutenção do sistema</h2>
                <p>
                  {(settings.data?.value as { enabled?: boolean })?.enabled
                    ? "Manutenção ativada."
                    : "Acesso normal."}
                </p>
                <button onClick={() => setMaintenance(true)}>
                  Configurar manutenção
                </button>
                <div className="quick-actions">
                  <Link to="/usuarios">Gerenciar acessos</Link>
                  <Link to="/auditoria">Consultar logs de segurança</Link>
                  <a
                    href={
                      new URL(
                        "manual-tecnico.pdf",
                        new URL(import.meta.env.BASE_URL, location.origin),
                      ).href
                    }
                    download
                  >
                    <Download size={16} />
                    Manual técnico
                  </a>
                </div>
              </section>
            </div>
            <section className="panel padded">
              <h2>Histórico de versões</h2>
              {releases.data?.map((release) => (
                <div className="timeline-item" key={release.id}>
                  <strong>
                    {release.version} · {dateLabel(release.created_at)}
                  </strong>
                  <p>{release.changes}</p>
                </div>
              ))}
            </section>
          </>
        )
      )}
      {maintenance && settings.data && (
        <Modal
          title="Manutenção do sistema"
          open
          onClose={() => setMaintenance(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (!confirm("Confirmar mudança no acesso ao sistema?")) return;
              await runAction(async () => {
                await rpc("save_entity", {
                  entity: "settings",
                  payload: json({
                    id: settings.data!.id,
                    key: "maintenance",
                    value: {
                      enabled: f.get("enabled") === "on",
                      allow_managers: f.get("allow_managers") === "on",
                    },
                  }),
                  expected_version: settings.data!.version,
                });
                settings.reload();
                setMaintenance(false);
              });
            }}
          >
            <label className="check">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={Boolean(
                  (settings.data.value as { enabled: boolean }).enabled,
                )}
              />
              Ativar manutenção
            </label>
            <label className="check">
              <input
                name="allow_managers"
                type="checkbox"
                defaultChecked={Boolean(
                  (settings.data.value as { allow_managers: boolean })
                    .allow_managers,
                )}
              />
              Permitir acesso dos gestores
            </label>
            <div className="modal-footer">
              <button className="primary">Confirmar</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
