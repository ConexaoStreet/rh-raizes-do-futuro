import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Boxes,
  CheckCircle2,
  Database,
  FileClock,
  FolderOpen,
  GitBranch,
  Globe2,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  RefreshCw,
  Save,
  Search,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import { client, rpc, updateSetting } from "./api";
import { Brand, useAuth } from "./auth";
import { ThemeToggle } from "./theme";

type JsonObject = Record<string, unknown>;
type View =
  | "overview"
  | "datasul"
  | "users"
  | "rh"
  | "storage"
  | "notifications"
  | "database"
  | "integrations"
  | "site"
  | "security"
  | "support"
  | "logs";

type SettingRow = { key: string; value: unknown };
type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  last_seen_at: string | null;
  espro_photo_path: string | null;
  espro_photo_status: string;
  espro_photo_rejection_reason: string | null;
};
type EmployeeRow = {
  id: string;
  profile_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  registration: string;
  status: string;
  member_group: string;
  access_role_code: string;
  class_id: string | null;
  department_id: string | null;
  job_position_id: string | null;
  manager_id: string | null;
  version: number;
};
type RoleRow = {
  id: string;
  code: string;
  name: string;
  level: number;
  privileged: boolean;
};
type UserRoleRow = { user_id: string; role_id: string };
type NamedRow = { id: string; name: string };
type ClassRow = { id: string; name: string; code: string };
type AuditRow = {
  id: string;
  created_at: string;
  actor_name: string | null;
  action: string;
  module: string;
  event_type: string;
  severity: string;
  success: boolean;
};
type DatasulOperation = {
  id: string;
  created_at: string;
  actor_name: string | null;
  method: string;
  path: string;
  response_status: number | null;
  success: boolean;
  duration_ms: number;
  error_message: string | null;
};
type SupportTicket = {
  id: string;
  user_id: string;
  category: string;
  subject: string;
  description: string;
  page_path: string;
  page_title: string;
  technical_context: JsonObject;
  attachment_path: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
  updated_at: string;
};
type SessionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  current: boolean;
  revoked: boolean;
};
type BucketInfo = {
  id: string;
  name: string;
  public: boolean;
  file_size_limit: number | null;
  allowed_mime_types: string[] | null;
  top_level_items: number;
};
type StorageItem = {
  name: string;
  id: string | null;
  updated_at: string | null;
  metadata?: { size?: number } | null;
};
type DatabaseTable = {
  schema: string;
  table: string;
  estimated_rows: number;
  dead_rows: number;
  last_analyze: string | null;
  last_autoanalyze: string | null;
  size_bytes: number;
};
type DatabaseSnapshot = {
  tables: DatabaseTable[];
  rls: { schema: string; table: string; enabled: boolean; forced: boolean }[];
  extensions: { name: string; schema: string; version: string }[];
  database_size_bytes: number;
  connections: number;
  server_time: string;
};
type Snapshot = {
  profiles_total?: number;
  profiles_active?: number;
  employees_total?: number;
  employees_active?: number;
  auth_sessions?: number;
  push_devices?: number;
  notifications_unread?: number;
  audit_24h?: number;
  feedbacks?: number;
  attendance_sessions?: number;
  storage_objects?: number;
  datasul_operations_24h?: number;
  datasul_failures_24h?: number;
  roles?: Record<string, number>;
  photo_status?: Record<string, number>;
};
type Inventory = {
  snapshot?: Snapshot;
  buckets?: BucketInfo[];
  roles?: RoleRow[];
  profiles_count?: number;
};
type DatasulResponse = {
  ok?: boolean;
  status?: number;
  duration_ms?: number;
  configured?: boolean;
  capabilities?: JsonObject;
  data?: unknown;
  preview?: unknown;
  sample?: unknown[];
  keys?: string[];
  total_returned?: number;
  state?: JsonObject;
  required_secrets?: string[];
  error?: string;
  message?: string;
};

const settingKeys = [
  "ti_control",
  "ti_datasul",
  "ti_github",
  "ti_vercel",
  "ti_email",
  "ti_site",
  "maintenance",
];

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function flag(value: unknown) {
  return value === true;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function errorText(value: unknown) {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Falha inesperada.";
}

function formatBytes(value: number | null | undefined) {
  const bytes = value || 0;
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function labelStatus(value: unknown) {
  const status = text(value, "unknown");
  if (status === "connected" || status === "healthy") return "Conectado";
  if (status === "partial") return "Parcial";
  if (status === "needs_secret") return "Credencial necessária";
  if (status === "needs_connection") return "Conexão necessária";
  if (status === "error") return "Erro";
  return "Não verificado";
}

function toneFor(value: unknown) {
  const status = text(value);
  if (
    status === "connected" ||
    status === "healthy" ||
    status === "active" ||
    status === "approved" ||
    status === "basic_passed"
  )
    return "ok";
  if (
    status === "error" ||
    status === "blocked" ||
    status === "rejected" ||
    status === "inactive"
  )
    return "error";
  return "warn";
}

export default function App() {
  const { user, can } = useAuth();
  const [view, setView] = useState<View>("overview");
  const [settings, setSettings] = useState<Record<string, JsonObject>>({});
  const [snapshot, setSnapshot] = useState<Snapshot>({});
  const [inventory, setInventory] = useState<Inventory>({});
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [departments, setDepartments] = useState<NamedRow[]>([]);
  const [positions, setPositions] = useState<NamedRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [datasulOps, setDatasulOps] = useState<DatasulOperation[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [moduleErrors, setModuleErrors] = useState<Record<string, string>>({});
  const [database, setDatabase] = useState<DatabaseSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<ProfileRow | null>(
    null,
  );
  const [editingProfile, setEditingProfile] = useState<ProfileRow | null>(null);
  const [profileStatus, setProfileStatus] = useState("active");
  const [profileRoleId, setProfileRoleId] = useState("");
  const [profileReason, setProfileReason] = useState("");
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeRow | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [storageBucket, setStorageBucket] = useState("");
  const [storagePrefix, setStoragePrefix] = useState("");
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [datasulResult, setDatasulResult] = useState<unknown>(null);
  const [platformResult, setPlatformResult] = useState<unknown>(null);
  const [companyId, setCompanyId] = useState("");
  const [healthPath, setHealthPath] = useState("");
  const [employeesPath, setEmployeesPath] = useState("");
  const [departmentsPath, setDepartmentsPath] = useState("");
  const [positionsPath, setPositionsPath] = useState("");
  const [attendancePath, setAttendancePath] = useState("");
  const [requestMethod, setRequestMethod] = useState("GET");
  const [requestPath, setRequestPath] = useState("");
  const [requestBody, setRequestBody] = useState("{\n\n}");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [notificationTarget, setNotificationTarget] = useState("");
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationBody, setNotificationBody] = useState("");
  const [notificationPath, setNotificationPath] = useState("/");

  const datasul = settings.ti_datasul || {};
  const github = settings.ti_github || {};
  const vercel = settings.ti_vercel || {};
  const email = settings.ti_email || {};
  const site = settings.ti_site || {};
  const maintenance = settings.maintenance || {};

  const rolesById = useMemo(
    () => Object.fromEntries(roles.map((role) => [role.id, role])),
    [roles],
  );
  const roleByUser = useMemo(() => {
    const map: Record<string, RoleRow[]> = {};
    for (const item of userRoles) {
      const role = rolesById[item.role_id];
      if (!role) continue;
      (map[item.user_id] ||= []).push(role);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => b.level - a.level);
    }
    return map;
  }, [rolesById, userRoles]);

  async function invokeFunction(
    name: string,
    body: JsonObject,
  ): Promise<unknown> {
    const { data, error: invokeError } = await client().functions.invoke(name, {
      body,
    });
    if (invokeError) throw invokeError;
    return data;
  }

  async function run(
    key: string,
    action: () => Promise<void>,
    success = "",
  ) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await action();
      if (success) setNotice(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ação não concluída.");
    } finally {
      setBusy("");
    }
  }

  async function reload() {
    setLoading(true);
    setError("");
    const tasks: { key: string; run: () => Promise<void> }[] = [
      {
        key: "configurações",
        run: async () => {
          const result = await client()
            .from("settings")
            .select("key,value")
            .in("key", settingKeys);
          if (result.error) throw result.error;
          const nextSettings: Record<string, JsonObject> = {};
          for (const row of (result.data || []) as SettingRow[]) {
            nextSettings[row.key] = object(row.value);
          }
          setSettings(nextSettings);
        },
      },
      {
        key: "auditoria",
        run: async () => {
          const result = await client()
            .from("audit_logs")
            .select("id,created_at,actor_name,action,module,event_type,severity,success")
            .order("created_at", { ascending: false })
            .limit(80);
          if (result.error) throw result.error;
          setAudit((result.data || []) as AuditRow[]);
        },
      },
      {
        key: "usuários",
        run: async () => {
          const result = await client()
            .from("profiles")
            .select("id,full_name,email,phone,status,last_seen_at,espro_photo_path,espro_photo_status,espro_photo_rejection_reason")
            .order("full_name")
            .limit(500);
          if (result.error) throw result.error;
          setProfiles((result.data || []) as ProfileRow[]);
        },
      },
      {
        key: "colaboradores",
        run: async () => {
          const result = await client()
            .from("employees")
            .select("id,profile_id,full_name,email,phone,registration,status,member_group,access_role_code,class_id,department_id,job_position_id,manager_id,version")
            .order("full_name")
            .limit(1000);
          if (result.error) throw result.error;
          setEmployees((result.data || []) as EmployeeRow[]);
        },
      },
      {
        key: "cargos",
        run: async () => {
          const result = await client()
            .from("roles")
            .select("id,code,name,level,privileged")
            .eq("active", true)
            .eq("archived", false)
            .order("level", { ascending: false });
          if (result.error) throw result.error;
          setRoles((result.data || []) as RoleRow[]);
        },
      },
      {
        key: "permissões",
        run: async () => {
          const result = await client()
            .from("user_roles")
            .select("user_id,role_id")
            .limit(2000);
          if (result.error) throw result.error;
          setUserRoles((result.data || []) as UserRoleRow[]);
        },
      },
      {
        key: "departamentos",
        run: async () => {
          const result = await client()
            .from("departments")
            .select("id,name")
            .eq("active", true)
            .order("name");
          if (result.error) throw result.error;
          setDepartments((result.data || []) as NamedRow[]);
        },
      },
      {
        key: "cargos RH",
        run: async () => {
          const result = await client()
            .from("job_positions")
            .select("id,name")
            .eq("active", true)
            .order("name");
          if (result.error) throw result.error;
          setPositions((result.data || []) as NamedRow[]);
        },
      },
      {
        key: "turmas",
        run: async () => {
          const result = await client()
            .from("classes")
            .select("id,name,code")
            .eq("active", true)
            .order("name");
          if (result.error) throw result.error;
          setClasses((result.data || []) as ClassRow[]);
        },
      },
      {
        key: "Datasul",
        run: async () => {
          const result = await client()
            .from("ti_datasul_operations")
            .select("id,created_at,actor_name,method,path,response_status,success,duration_ms,error_message")
            .order("created_at", { ascending: false })
            .limit(100);
          if (result.error) throw result.error;
          setDatasulOps((result.data || []) as DatasulOperation[]);
        },
      },
      {
        key: "chamados",
        run: async () => {
          const result = await client()
            .from("ti_support_tickets")
            .select("id,user_id,category,subject,description,page_path,page_title,technical_context,attachment_path,status,created_at,updated_at")
            .order("created_at", { ascending: false })
            .limit(250);
          if (result.error) throw result.error;
          setSupportTickets((result.data || []) as SupportTicket[]);
        },
      },
      {
        key: "indicadores",
        run: async () => {
          setSnapshot(object(await rpc("ti_snapshot")) as Snapshot);
        },
      },
      {
        key: "inventário",
        run: async () => {
          setInventory(
            object(await invokeFunction("ti-admin-bridge", { action: "inventory" })) as Inventory,
          );
        },
      },
    ];

    const results = await Promise.allSettled(tasks.map((task) => task.run()));
    const failures: Record<string, string> = {};
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        failures[tasks[index].key] = errorText(result.reason);
      }
    });
    setModuleErrors(failures);

    const failedCount = Object.keys(failures).length;
    if (failedCount === tasks.length) {
      setError("A Central T.I. não conseguiu carregar nenhum módulo. Verifique a sessão e o Supabase.");
    } else if (failedCount > 0) {
      setNotice(
        `Central carregada parcialmente: ${failedCount} módulo(s) indisponível(is). O restante continua operacional.`,
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    setCompanyId(text(datasul.company_id));
    setHealthPath(text(datasul.health_path, "/api/btb/v1/companies"));
    setEmployeesPath(text(datasul.employees_path));
    setDepartmentsPath(text(datasul.departments_path));
    setPositionsPath(text(datasul.positions_path));
    setAttendancePath(text(datasul.attendance_path));
    setMaintenanceTitle(
      text(site.maintenance_title, "Sistema em manutenção"),
    );
    setMaintenanceMessage(
      text(
        site.maintenance_message,
        "Alguns recursos podem ficar temporariamente indisponíveis.",
      ),
    );
  }, [datasul, site]);

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter((profile) =>
      [profile.full_name, profile.email, profile.status]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [profiles, search]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) =>
      [
        employee.full_name,
        employee.email || "",
        employee.registration,
        employee.status,
        employee.access_role_code,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [employees, search]);

  async function saveDatasulSettings() {
    await updateSetting("ti_datasul", {
      ...datasul,
      company_id: companyId || null,
      health_path: healthPath || "/api/btb/v1/companies",
      employees_path: employeesPath || null,
      departments_path: departmentsPath || null,
      positions_path: positionsPath || null,
      attendance_path: attendancePath || null,
    });
    await reload();
  }

  async function invokeDatasul(body: JsonObject) {
    const data = (await invokeFunction(
      "datasul-bridge",
      body,
    )) as DatasulResponse;
    setDatasulResult(data);
    await reload();
    return data;
  }

  async function runDatasulRequest() {
    let payload: unknown = undefined;
    if (requestMethod !== "GET") {
      try {
        payload = requestBody.trim() ? JSON.parse(requestBody) : null;
      } catch {
        throw new Error("O corpo precisa ser JSON válido.");
      }
    }
    if (
      requestMethod === "DELETE" &&
      !window.confirm(
        "Confirmar exclusão no Datasul? Esta ação pode ser irreversível.",
      )
    )
      return;

    await invokeDatasul({
      action: "request",
      method: requestMethod,
      path: requestPath,
      payload,
    });
  }

  async function invokePlatform() {
    setPlatformResult(
      await invokeFunction("platform-bridge", { action: "status" }),
    );
    await reload();
  }

  async function saveMaintenance() {
    const title = maintenanceTitle.trim() || "Sistema em manutenção";
    const message =
      maintenanceMessage.trim() ||
      "Estamos realizando ajustes no sistema. Tente novamente em instantes.";
    await Promise.all([
      updateSetting("maintenance", {
        ...maintenance,
        title,
        message,
      }),
      updateSetting("ti_site", {
        ...site,
        maintenance_title: title,
        maintenance_message: message,
      }),
    ]);
    await reload();
  }

  async function toggleMaintenance() {
    const next = !flag(maintenance.enabled);
    if (
      !window.confirm(
        next
          ? "Ativar manutenção global do RH?"
          : "Desativar manutenção e liberar o RH?",
      )
    )
      return;
    const title = maintenanceTitle.trim() || "Sistema em manutenção";
    const message =
      maintenanceMessage.trim() ||
      "Estamos realizando ajustes no sistema. Tente novamente em instantes.";
    await updateSetting("maintenance", {
      ...maintenance,
      enabled: next,
      title,
      message,
      started_at: next ? new Date().toISOString() : null,
      ended_at: next ? null : new Date().toISOString(),
    });
    await reload();
  }

  function openManageProfile(profile: ProfileRow) {
    const currentRoles = roleByUser[profile.id] || [];
    setEditingProfile(profile);
    setProfileStatus(profile.status);
    setProfileRoleId(currentRoles[0]?.id || roles[0]?.id || "");
    setProfileReason("");
  }

  async function saveProfileAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProfile || !profileRoleId) return;
    if (profileReason.trim().length < 3)
      throw new Error("Informe um motivo com pelo menos 3 caracteres.");
    await rpc("manage_user", {
      user_identifier: editingProfile.id,
      new_status: profileStatus,
      role_identifiers: [profileRoleId],
      reason: profileReason.trim(),
    });
    setEditingProfile(null);
    setProfileReason("");
    await reload();
  }

  async function loadSessions(profile: ProfileRow) {
    setSelectedProfile(profile);
    const data = (await rpc("my_sessions", {
      target_user: profile.id,
    })) as SessionRow[];
    setSessions(Array.isArray(data) ? data : []);
  }

  async function revokeSession(sessionId: string) {
    if (!window.confirm("Revogar esta sessão?")) return;
    await rpc("revoke_session", { session_identifier: sessionId });
    if (selectedProfile) await loadSessions(selectedProfile);
  }

  async function reviewPhoto(profile: ProfileRow, status: "approved" | "rejected") {
    let reason: string | null = null;
    if (status === "rejected") {
      reason = window.prompt("Motivo da rejeição:");
      if (!reason) return;
    }
    await rpc("ti_review_espro_photo", {
      target_profile: profile.id,
      review_status: status,
      review_reason: reason,
    });
    await reload();
  }

  async function openPhoto(profile: ProfileRow) {
    if (!profile.espro_photo_path) return;
    const { data, error: signedError } = await client()
      .storage.from("espro-profile-photos")
      .createSignedUrl(profile.espro_photo_path, 120);
    if (signedError) throw signedError;
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function saveEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEmployee) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      id: selectedEmployee.id,
      full_name: String(form.get("full_name") || ""),
      email: String(form.get("email") || "") || null,
      phone: String(form.get("phone") || "") || null,
      status: String(form.get("status") || "active"),
      member_group: String(form.get("member_group") || "class"),
      access_role_code: String(
        form.get("access_role_code") || "COLLABORATOR",
      ),
      class_id: String(form.get("class_id") || "") || null,
      department_id: String(form.get("department_id") || "") || null,
      job_position_id: String(form.get("job_position_id") || "") || null,
    };
    await rpc("save_entity", {
      entity: "employees",
      payload,
      expected_version: selectedEmployee.version,
    });
    setSelectedEmployee(null);
    await reload();
  }

  async function loadStorage(bucket: string, prefix = "") {
    setStorageBucket(bucket);
    setStoragePrefix(prefix);
    const result = object(
      await invokeFunction("ti-admin-bridge", {
        action: "storage_list",
        bucket,
        prefix,
        limit: 300,
      }),
    );
    setStorageItems(
      Array.isArray(result.items) ? (result.items as StorageItem[]) : [],
    );
  }

  async function deleteStorageItem(item: StorageItem) {
    const path = storagePrefix
      ? storagePrefix.replace(/\/$/, "") + "/" + item.name
      : item.name;
    const typed = window.prompt(
      "Digite EXCLUIR para remover este arquivo: " + path,
    );
    if (typed !== "EXCLUIR") return;
    await invokeFunction("ti-admin-bridge", {
      action: "storage_delete",
      bucket: storageBucket,
      path,
    });
    await loadStorage(storageBucket, storagePrefix);
    await reload();
  }

  async function loadDatabase() {
    setDatabase(
      (await invokeFunction("ti-admin-bridge", {
        action: "database",
      })) as DatabaseSnapshot,
    );
  }

  async function openSupportAttachment(ticket: SupportTicket) {
    if (!ticket.attachment_path) return;
    const { data, error: signedError } = await client()
      .storage.from("ti-support")
      .createSignedUrl(ticket.attachment_path, 300);
    if (signedError) throw signedError;
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function updateSupportTicketStatus(
    ticketId: string,
    status: SupportTicket["status"],
  ) {
    const { error: updateError } = await client()
      .from("ti_support_tickets")
      .update({ status })
      .eq("id", ticketId);
    if (updateError) throw updateError;
    await reload();
  }

  async function sendNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!notificationTarget) throw new Error("Selecione um usuário.");
    await rpc("ti_send_notification", {
      target_user: notificationTarget,
      notification_title: notificationTitle,
      notification_body: notificationBody,
      notification_path: notificationPath || "/",
    });
    setNotificationTitle("");
    setNotificationBody("");
    setNotice("Notificação enviada.");
    await reload();
  }

  const healthScore = useMemo(() => {
    const values = [
      text(datasul.status),
      text(github.status),
      text(vercel.status),
      text(email.status),
    ];
    const ok = values.filter((value) =>
      ["connected", "healthy"].includes(value),
    ).length;
    const partial = values.filter((value) => value === "partial").length;
    return Math.round(((ok + partial * 0.5 + 1) / 5) * 100);
  }, [datasul.status, github.status, vercel.status, email.status]);

  const rhSite =
    import.meta.env.VITE_RH_SITE_URL ||
    "https://rh-raizes-do-futuro.vercel.app";

  const nav: { view: View; label: string; icon: ReactNode; permission?: string }[] = [
    { view: "overview", label: "Visão geral", icon: <LayoutDashboard /> },
    { view: "datasul", label: "Datasul", icon: <Database />, permission: "ti.datasul.read" },
    { view: "users", label: "Usuários e acessos", icon: <UserCog />, permission: "ti.users.manage" },
    { view: "rh", label: "Dados do RH", icon: <Users />, permission: "employee.manage" },
    { view: "storage", label: "Arquivos e Storage", icon: <HardDrive />, permission: "ti.storage.manage" },
    { view: "notifications", label: "Notificações", icon: <BellRing />, permission: "ti.notifications.manage" },
    { view: "database", label: "Banco de dados", icon: <Boxes />, permission: "ti.database.view" },
    { view: "integrations", label: "GitHub e Vercel", icon: <GitBranch /> },
    { view: "site", label: "Site RH", icon: <Globe2 />, permission: "ti.manage" },
    { view: "security", label: "Segurança", icon: <ShieldCheck />, permission: "ti.security.view" },
    { view: "support", label: "Chamados T.I.", icon: <Wrench />, permission: "ti.manage" },
    { view: "logs", label: "Logs", icon: <Activity /> },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="environment">
          <span className="pulse" />
          Produção
        </div>
        <nav>
          {nav
            .filter((item) => !item.permission || can(item.permission))
            .map((item) => (
              <NavButton
                key={item.view}
                active={view === item.view}
                icon={item.icon}
                onClick={() => {
                  setView(item.view);
                  setSearch("");
                  setError("");
                  setNotice("");
                  if (item.view === "database" && !database)
                    void run("database", loadDatabase);
                }}
              >
                {item.label}
              </NavButton>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <a
            className="external-link"
            href={rhSite}
            target="_blank"
            rel="noreferrer"
          >
            <ArrowUpRight size={16} />
            Abrir RH
          </a>
          <button className="logout" onClick={() => void client().auth.signOut()}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <main id="ti-main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">CENTRAL TÉCNICA</span>
            <h1>{titleFor(view)}</h1>
          </div>
          <div className="operator">
            <button
              className="icon-button"
              aria-label="Atualizar dados"
              onClick={() => void run("reload", reload)}
              disabled={busy !== ""}
            >
              <RefreshCw size={17} />
            </button>
            <ThemeToggle compact />
            <div>
              <strong>{user.profile.full_name}</strong>
              <span>{user.roles.join(" · ")}</span>
            </div>
            <div className="operator-avatar">
              {user.profile.full_name.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="content">
          {error && <Notice tone="error">{error}</Notice>}
          {notice && <Notice tone="ok">{notice}</Notice>}
          {Object.keys(moduleErrors).length > 0 && (
            <div className="module-health-warning">
              <AlertTriangle size={18} />
              <div>
                <strong>Operação parcial</strong>
                <span>
                  {Object.entries(moduleErrors)
                    .map(([module]) => module)
                    .join(" · ")}
                </span>
              </div>
              <button onClick={() => void run("reload", reload)}>
                <RefreshCw size={15} /> Tentar novamente
              </button>
            </div>
          )}
          {flag(maintenance.enabled) && view !== "datasul" && (
            <button
              className="maintenance-console-strip"
              onClick={() => setView("datasul")}
            >
              <Wrench size={18} />
              <span>
                <strong>RH em manutenção</strong>
                Acesso técnico permanece ativo. Abrir Datasul.
              </span>
              <ArrowUpRight size={16} />
            </button>
          )}
          {loading ? (
            <div className="loading-panel">
              <div className="loader" />
              Carregando operação técnica...
            </div>
          ) : (
            <>
              {view === "overview" && (
                <>
                  <section className="hero">
                    <div>
                      <span className="eyebrow">OPERAÇÃO CENTRAL</span>
                      <h2>Controle técnico completo do Raízes do Futuro.</h2>
                      <p>
                        Usuários, Datasul, banco, storage, deploys, segurança,
                        notificações e operação do RH em um único console.
                      </p>
                    </div>
                    <div className="health-ring">
                      <strong>{healthScore}%</strong>
                      <span>saúde técnica</span>
                    </div>
                  </section>
                  <div className="stats-grid ti-stats">
                    <Stat title="Perfis" value={numberValue(snapshot.profiles_total)} detail={numberValue(snapshot.profiles_active) + " ativos"} />
                    <Stat title="Colaboradores" value={numberValue(snapshot.employees_total)} detail={numberValue(snapshot.employees_active) + " ativos"} />
                    <Stat title="Sessões Auth" value={numberValue(snapshot.auth_sessions)} detail="sessões abertas" />
                    <Stat title="Push" value={numberValue(snapshot.push_devices)} detail="dispositivos" />
                    <Stat title="Storage" value={numberValue(snapshot.storage_objects)} detail="objetos" />
                    <Stat title="Auditoria 24h" value={numberValue(snapshot.audit_24h)} detail="eventos" />
                    <Stat title="Datasul 24h" value={numberValue(snapshot.datasul_operations_24h)} detail={numberValue(snapshot.datasul_failures_24h) + " falhas"} />
                    <Stat title="Fotos Espro" value={numberValue(snapshot.photo_status?.basic_passed) + numberValue(snapshot.photo_status?.approved)} detail="válidas ou aprovadas" />
                  </div>
                  <ServiceGrid
                    datasul={datasul}
                    github={github}
                    vercel={vercel}
                    email={email}
                    maintenance={maintenance}
                  />
                  <div className="two-columns">
                    <Panel title="Atividade recente" kicker="AUDITORIA" icon={<FileClock />}>
                      <AuditList rows={audit.slice(0, 8)} />
                    </Panel>
                    <Panel title="Estado operacional" kicker="SERVIÇOS" icon={<Server />}>
                      <StateRow name="RH" value={flag(maintenance.enabled) ? "Manutenção" : "Operação normal"} tone={flag(maintenance.enabled) ? "warn" : "ok"} />
                      <StateRow name="Datasul" value={labelStatus(datasul.status)} tone={toneFor(datasul.status)} />
                      <StateRow name="GitHub" value={labelStatus(github.status)} tone={toneFor(github.status)} />
                      <StateRow name="Vercel" value={labelStatus(vercel.status)} tone={toneFor(vercel.status)} />
                      <StateRow name="E-mail" value={labelStatus(email.status)} tone={toneFor(email.status)} />
                    </Panel>
                  </div>
                </>
              )}

              {view === "datasul" && (
                <>
                  {flag(maintenance.enabled) && (
                    <section className="datasul-maintenance-banner" role="status" aria-live="polite">
                      <div className="datasul-maintenance-icon">
                        <Wrench size={30} />
                      </div>
                      <div className="datasul-maintenance-copy">
                        <span>MANUTENÇÃO GLOBAL ATIVA</span>
                        <h2>
                          {text(
                            maintenance.title,
                            text(site.maintenance_title, "Sistema em manutenção"),
                          )}
                        </h2>
                        <p>
                          {text(
                            maintenance.message,
                            text(
                              site.maintenance_message,
                              "Estamos realizando ajustes no sistema. O acesso será liberado novamente assim que a manutenção for concluída.",
                            ),
                          )}
                        </p>
                        <small>
                          O RH está bloqueado para usuários comuns. A Central T.I. e este console Datasul continuam ativos para diagnóstico e correção; qualquer operação aqui continua afetando dados reais.
                        </small>
                      </div>
                      <button
                        className="maintenance-manage-button"
                        onClick={() => setView("site")}
                      >
                        <Settings2 size={16} />
                        Gerenciar manutenção
                      </button>
                    </section>
                  )}
                  <div className="two-columns">
                    <Panel title="Conexão Datasul RH" kicker="CONFIGURAÇÃO" icon={<Database />}>
                      <div className="form-grid">
                        <Field label="Company ID">
                          <input value={companyId} onChange={(event) => setCompanyId(event.target.value)} />
                        </Field>
                        <Field label="Health endpoint">
                          <input value={healthPath} onChange={(event) => setHealthPath(event.target.value)} />
                        </Field>
                        <Field label="Colaboradores" wide>
                          <input value={employeesPath} onChange={(event) => setEmployeesPath(event.target.value)} placeholder="/api/rh/v1/employees" />
                        </Field>
                        <Field label="Departamentos">
                          <input value={departmentsPath} onChange={(event) => setDepartmentsPath(event.target.value)} />
                        </Field>
                        <Field label="Cargos">
                          <input value={positionsPath} onChange={(event) => setPositionsPath(event.target.value)} />
                        </Field>
                        <Field label="Frequência" wide>
                          <input value={attendancePath} onChange={(event) => setAttendancePath(event.target.value)} />
                        </Field>
                      </div>
                      <div className="actions">
                        <button onClick={() => void run("datasul-save", saveDatasulSettings, "Configuração salva.")}>
                          <Save size={16} /> Salvar endpoints
                        </button>
                        <button className="primary-button" onClick={() => void run("datasul-health", async () => { await invokeDatasul({ action: "health" }); })}>
                          <RefreshCw size={16} /> Testar conexão
                        </button>
                        <button onClick={() => void run("datasul-preview", async () => { await invokeDatasul({ action: "preview" }); })} disabled={!employeesPath}>
                          <Users size={16} /> Prévia de colaboradores
                        </button>
                      </div>
                      <Notice>
                        Credenciais permanecem apenas nos Secrets do Supabase.
                        O navegador nunca recebe usuário ou senha do Datasul.
                      </Notice>
                    </Panel>

                    <Panel title="Console de API" kicker="OPERAÇÃO TOTAL" icon={<KeyRound />}>
                      <div className="request-grid">
                        <Field label="Método">
                          <select value={requestMethod} onChange={(event) => setRequestMethod(event.target.value)}>
                            {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => <option key={method}>{method}</option>)}
                          </select>
                        </Field>
                        <Field label="Endpoint" wide>
                          <input value={requestPath} onChange={(event) => setRequestPath(event.target.value)} placeholder="/api/..." />
                        </Field>
                      </div>
                      {requestMethod !== "GET" && (
                        <Field label="JSON">
                          <textarea rows={10} value={requestBody} onChange={(event) => setRequestBody(event.target.value)} spellCheck={false} />
                        </Field>
                      )}
                      <button
                        className={requestMethod === "DELETE" ? "danger-button" : "primary-button"}
                        onClick={() => void run("datasul-request", runDatasulRequest)}
                        disabled={!requestPath || busy !== ""}
                      >
                        <Send size={16} />
                        Executar {requestMethod}
                      </button>
                      <p className="panel-copy">
                        Escritas e exclusões exigem MFA recente e entram no
                        histórico técnico.
                      </p>
                    </Panel>
                  </div>
                  {datasulResult !== null && (
                    <Panel title="Resposta do Datasul" kicker="RESULTADO" icon={<Activity />}>
                      <pre>{JSON.stringify(datasulResult, null, 2)}</pre>
                    </Panel>
                  )}
                  <Panel title="Histórico Datasul" kicker="AUDITORIA DE API" icon={<FileClock />}>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Data</th><th>Operador</th><th>Método</th><th>Endpoint</th><th>HTTP</th><th>Duração</th><th>Status</th></tr></thead>
                        <tbody>
                          {datasulOps.map((row) => (
                            <tr key={row.id}>
                              <td>{formatDate(row.created_at)}</td>
                              <td>{row.actor_name || "Sistema"}</td>
                              <td><code>{row.method}</code></td>
                              <td><code>{row.path}</code></td>
                              <td>{row.response_status || "-"}</td>
                              <td>{row.duration_ms} ms</td>
                              <td><Badge tone={row.success ? "ok" : "error"}>{row.success ? "OK" : row.error_message || "Falha"}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                </>
              )}

              {view === "users" && (
                <>
                  <Toolbar search={search} setSearch={setSearch} placeholder="Buscar usuário, e-mail ou status" />
                  <Panel title="Usuários e acessos" kicker="AUTH + CARGOS" icon={<UserCog />}>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Usuário</th><th>Status</th><th>Cargo</th><th>Foto Espro</th><th>Último acesso</th><th>Ações</th></tr></thead>
                        <tbody>
                          {filteredProfiles.map((profile) => {
                            const userRole = roleByUser[profile.id]?.[0];
                            return (
                              <tr key={profile.id}>
                                <td><strong>{profile.full_name}</strong><small>{profile.email}</small></td>
                                <td><Badge tone={toneFor(profile.status)}>{profile.status}</Badge></td>
                                <td>{userRole?.name || "-"}</td>
                                <td><Badge tone={toneFor(profile.espro_photo_status)}>{profile.espro_photo_status}</Badge></td>
                                <td>{formatDate(profile.last_seen_at)}</td>
                                <td>
                                  <div className="row-actions">
                                    {profile.id !== user.profile.id && (
                                      <button onClick={() => openManageProfile(profile)}>Gerenciar</button>
                                    )}
                                    <button onClick={() => void run("sessions", () => loadSessions(profile))}>Sessões</button>
                                    {profile.espro_photo_path && (
                                      <button onClick={() => void run("photo-open", () => openPhoto(profile))}>Foto</button>
                                    )}
                                    {["basic_passed", "pending"].includes(profile.espro_photo_status) && (
                                      <>
                                        <button onClick={() => void run("photo-approve", () => reviewPhoto(profile, "approved"), "Foto aprovada.")}>Aprovar foto</button>
                                        <button className="danger-text" onClick={() => void run("photo-reject", () => reviewPhoto(profile, "rejected"), "Foto rejeitada.")}>Rejeitar</button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                  {editingProfile && (
                    <Panel
                      title={"Gerenciar " + editingProfile.full_name}
                      kicker="ACESSO E CARGO"
                      icon={<UserCog />}
                    >
                      <form
                        className="form-grid"
                        onSubmit={(event) =>
                          void run(
                            "user-save",
                            () => saveProfileAccess(event),
                            "Acesso atualizado.",
                          )
                        }
                      >
                        <Field label="Status">
                          <select
                            value={profileStatus}
                            onChange={(event) => setProfileStatus(event.target.value)}
                          >
                            <option value="active">Ativo</option>
                            <option value="suspended">Suspenso</option>
                            <option value="inactive">Inativo</option>
                            <option value="blocked">Bloqueado</option>
                          </select>
                        </Field>
                        <Field label="Cargo">
                          <select
                            value={profileRoleId}
                            onChange={(event) => setProfileRoleId(event.target.value)}
                            required
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name} | nível {role.level}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Motivo" wide>
                          <textarea
                            rows={4}
                            value={profileReason}
                            onChange={(event) => setProfileReason(event.target.value)}
                            required
                          />
                        </Field>
                        <div className="actions wide">
                          <button className="primary-button" disabled={busy !== ""}>
                            <Save size={16} />
                            Salvar acesso
                          </button>
                          <button type="button" onClick={() => setEditingProfile(null)}>
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </Panel>
                  )}
                  {selectedProfile && (
                    <Panel title={"Sessões de " + selectedProfile.full_name} kicker="SEGURANÇA" icon={<ShieldCheck />}>
                      <div className="session-list">
                        {sessions.length ? sessions.map((session) => (
                          <div className="session-row" key={session.id}>
                            <div>
                              <strong>{session.current ? "Sessão atual" : session.id.slice(0, 8)}</strong>
                              <span>Criada em {formatDate(session.created_at)} | Atualizada em {formatDate(session.updated_at)}</span>
                            </div>
                            <Badge tone={session.revoked ? "error" : "ok"}>{session.revoked ? "Revogada" : "Ativa"}</Badge>
                            {!session.current && !session.revoked && (
                              <button className="danger-text" onClick={() => void run("revoke-session", () => revokeSession(session.id), "Sessão revogada.")}>Revogar</button>
                            )}
                          </div>
                        )) : <Empty text="Nenhuma sessão encontrada." />}
                      </div>
                    </Panel>
                  )}
                </>
              )}

              {view === "rh" && (
                <>
                  <Toolbar search={search} setSearch={setSearch} placeholder="Buscar colaborador, matrícula ou cargo" />
                  <Panel title="Base de colaboradores" kicker="RH OPERACIONAL" icon={<Users />}>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Nome</th><th>Matrícula</th><th>Grupo</th><th>Cargo</th><th>Status</th><th>Ação</th></tr></thead>
                        <tbody>
                          {filteredEmployees.map((employee) => (
                            <tr key={employee.id}>
                              <td><strong>{employee.full_name}</strong><small>{employee.email || "-"}</small></td>
                              <td>{employee.registration}</td>
                              <td>{employee.member_group}</td>
                              <td>{employee.access_role_code}</td>
                              <td><Badge tone={toneFor(employee.status)}>{employee.status}</Badge></td>
                              <td><button onClick={() => setSelectedEmployee(employee)}>Editar</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                  {selectedEmployee && (
                    <Panel title={"Editar " + selectedEmployee.full_name} kicker="CADASTRO" icon={<Settings2 />}>
                      <form className="form-grid" onSubmit={(event) => void run("employee-save", () => saveEmployee(event), "Cadastro atualizado.")}>
                        <Field label="Nome" wide><input name="full_name" defaultValue={selectedEmployee.full_name} required /></Field>
                        <Field label="E-mail"><input name="email" type="email" defaultValue={selectedEmployee.email || ""} /></Field>
                        <Field label="Telefone"><input name="phone" defaultValue={selectedEmployee.phone || ""} /></Field>
                        <Field label="Status">
                          <select name="status" defaultValue={selectedEmployee.status}>
                            {["active", "inactive", "suspended", "blocked"].map((value) => <option key={value}>{value}</option>)}
                          </select>
                        </Field>
                        <Field label="Grupo">
                          <select name="member_group" defaultValue={selectedEmployee.member_group}>
                            <option value="class">Turma</option>
                            <option value="rh">Equipe RH</option>
                          </select>
                        </Field>
                        <Field label="Cargo de acesso">
                          <select name="access_role_code" defaultValue={selectedEmployee.access_role_code}>
                            <option value="COLLABORATOR">Colaborador</option>
                            <option value="MANAGER">Gestor</option>
                            <option value="DIRECTOR">Diretor</option>
                            <option value="INSTRUCTOR">Instrutor</option>
                          </select>
                        </Field>
                        <Field label="Turma">
                          <select name="class_id" defaultValue={selectedEmployee.class_id || ""}>
                            <option value="">Sem turma</option>
                            {classes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                          </select>
                        </Field>
                        <Field label="Departamento">
                          <select name="department_id" defaultValue={selectedEmployee.department_id || ""}>
                            <option value="">Sem departamento</option>
                            {departments.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                          </select>
                        </Field>
                        <Field label="Cargo interno">
                          <select name="job_position_id" defaultValue={selectedEmployee.job_position_id || ""}>
                            <option value="">Sem cargo interno</option>
                            {positions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                          </select>
                        </Field>
                        <div className="actions wide">
                          <button className="primary-button" disabled={busy !== ""}><Save size={16} />Salvar</button>
                          <button type="button" onClick={() => setSelectedEmployee(null)}>Cancelar</button>
                        </div>
                      </form>
                    </Panel>
                  )}
                </>
              )}

              {view === "storage" && (
                <>
                  <div className="bucket-grid">
                    {(inventory.buckets || []).map((bucket) => (
                      <button
                        key={bucket.id}
                        className={storageBucket === bucket.id ? "bucket-card active" : "bucket-card"}
                        onClick={() => void run("storage-list", () => loadStorage(bucket.id))}
                      >
                        <FolderOpen size={22} />
                        <strong>{bucket.name}</strong>
                        <span>{bucket.public ? "Público" : "Privado"} | limite {formatBytes(bucket.file_size_limit)}</span>
                      </button>
                    ))}
                  </div>
                  {storageBucket && (
                    <Panel title={storageBucket} kicker="STORAGE" icon={<HardDrive />}>
                      <div className="actions">
                        <Field label="Prefixo">
                          <input value={storagePrefix} onChange={(event) => setStoragePrefix(event.target.value)} placeholder="pasta/subpasta" />
                        </Field>
                        <button onClick={() => void run("storage-list", () => loadStorage(storageBucket, storagePrefix))}><RefreshCw size={16} />Listar</button>
                      </div>
                      <div className="file-list">
                        {storageItems.length ? storageItems.map((item) => (
                          <div className="file-row" key={item.name}>
                            <FolderOpen size={18} />
                            <span><strong>{item.name}</strong><small>{formatBytes(item.metadata?.size)} | {formatDate(item.updated_at)}</small></span>
                            {item.id && (
                              <button className="danger-text" onClick={() => void run("storage-delete", () => deleteStorageItem(item), "Arquivo removido.")}>
                                <Trash2 size={16} /> Excluir
                              </button>
                            )}
                          </div>
                        )) : <Empty text="Nenhum item neste nível." />}
                      </div>
                    </Panel>
                  )}
                </>
              )}

              {view === "notifications" && (
                <div className="two-columns">
                  <Panel title="Enviar notificação" kicker="PUSH + INTERNA" icon={<BellRing />}>
                    <form onSubmit={(event) => void run("notification", () => sendNotification(event))}>
                      <Field label="Usuário">
                        <select value={notificationTarget} onChange={(event) => setNotificationTarget(event.target.value)} required>
                          <option value="">Selecionar usuário</option>
                          {profiles.filter((profile) => profile.status === "active").map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name} | {profile.email}</option>)}
                        </select>
                      </Field>
                      <Field label="Título"><input value={notificationTitle} onChange={(event) => setNotificationTitle(event.target.value)} maxLength={100} required /></Field>
                      <Field label="Mensagem"><textarea rows={5} value={notificationBody} onChange={(event) => setNotificationBody(event.target.value)} maxLength={500} required /></Field>
                      <Field label="Destino no app"><input value={notificationPath} onChange={(event) => setNotificationPath(event.target.value)} /></Field>
                      <button className="primary-button" disabled={busy !== ""}><Send size={16} />Enviar notificação</button>
                    </form>
                  </Panel>
                  <Panel title="Estado das notificações" kicker="MÉTRICAS" icon={<Activity />}>
                    <Stat title="Não lidas" value={numberValue(snapshot.notifications_unread)} />
                    <Stat title="Dispositivos push" value={numberValue(snapshot.push_devices)} />
                    <p className="panel-copy">
                      O envio cria a notificação interna e o gatilho Web Push tenta
                      entregar nos dispositivos registrados.
                    </p>
                  </Panel>
                </div>
              )}

              {view === "database" && (
                <>
                  <div className="actions">
                    <button className="primary-button" onClick={() => void run("database", loadDatabase)}><RefreshCw size={16} />Atualizar diagnóstico</button>
                  </div>
                  {database ? (
                    <>
                      <div className="stats-grid">
                        <Stat title="Tamanho do banco" value={formatBytes(database.database_size_bytes)} />
                        <Stat title="Conexões" value={database.connections} />
                        <Stat title="Tabelas" value={database.tables.length} />
                        <Stat title="Extensões" value={database.extensions.length} />
                      </div>
                      <Panel title="Tabelas" kicker="POSTGRES" icon={<Database />}>
                        <div className="table-wrap">
                          <table>
                            <thead><tr><th>Tabela</th><th>Linhas estimadas</th><th>Mortas</th><th>Tamanho</th><th>Análise</th></tr></thead>
                            <tbody>
                              {database.tables.map((row) => (
                                <tr key={row.schema + "." + row.table}>
                                  <td><code>{row.schema}.{row.table}</code></td>
                                  <td>{row.estimated_rows}</td>
                                  <td>{row.dead_rows}</td>
                                  <td>{formatBytes(row.size_bytes)}</td>
                                  <td>{formatDate(row.last_autoanalyze || row.last_analyze)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Panel>
                      <Panel title="RLS" kicker="SEGURANÇA DE LINHAS" icon={<ShieldCheck />}>
                        <div className="rls-grid">
                          {database.rls.filter((row) => row.schema === "public").map((row) => (
                            <div className="rls-item" key={row.schema + row.table}>
                              <code>{row.table}</code>
                              <Badge tone={row.enabled ? "ok" : "error"}>{row.enabled ? "RLS ativo" : "RLS desligado"}</Badge>
                            </div>
                          ))}
                        </div>
                      </Panel>
                    </>
                  ) : <Empty text="Carregue o diagnóstico do banco." />}
                </>
              )}

              {view === "integrations" && (
                <div className="two-columns">
                  <Panel title="GitHub + Vercel" kicker="DEPLOYS E CI" icon={<GitBranch />}>
                    <p className="panel-copy">
                      Consulta Actions e deploys usando tokens mantidos apenas
                      nos Secrets do Supabase.
                    </p>
                    <button className="primary-button" onClick={() => void run("platform", invokePlatform)}><RefreshCw size={16} />Verificar plataforma</button>
                    {platformResult !== null && <pre>{JSON.stringify(platformResult, null, 2)}</pre>}
                  </Panel>
                  <Panel title="Configuração" kicker="STATUS" icon={<Server />}>
                    <StateRow name="GitHub" value={labelStatus(github.status)} tone={toneFor(github.status)} />
                    <StateRow name="Repositório" value={text(github.repository, "-")} tone="ok" />
                    <StateRow name="Vercel" value={labelStatus(vercel.status)} tone={toneFor(vercel.status)} />
                    <StateRow name="Projeto" value={text(vercel.project, "-")} tone="ok" />
                  </Panel>
                </div>
              )}

              {view === "site" && (
                <div className="two-columns">
                  <Panel title="Manutenção global" kicker="SITE RH" icon={<Wrench />}>
                    <div className="maintenance-state">
                      <span className={flag(maintenance.enabled) ? "status-dot warn" : "status-dot ok"} />
                      <div>
                        <strong>{flag(maintenance.enabled) ? "Manutenção ativa" : "Operação normal"}</strong>
                        <span>A Central T.I. mantém acesso técnico durante manutenção.</span>
                      </div>
                    </div>
                    <button className={flag(maintenance.enabled) ? "primary-button" : "danger-button"} onClick={() => void run("maintenance", toggleMaintenance, "Estado de manutenção atualizado.")}>
                      <Wrench size={16} />
                      {flag(maintenance.enabled) ? "Desativar manutenção" : "Ativar manutenção"}
                    </button>
                  </Panel>
                  <Panel title="Mensagem de manutenção" kicker="COMUNICAÇÃO" icon={<Mail />}>
                    <Field label="Título"><input value={maintenanceTitle} onChange={(event) => setMaintenanceTitle(event.target.value)} /></Field>
                    <Field label="Mensagem"><textarea rows={5} value={maintenanceMessage} onChange={(event) => setMaintenanceMessage(event.target.value)} /></Field>
                    <button className="primary-button" onClick={() => void run("maintenance-text", saveMaintenance, "Mensagem salva.")}><Save size={16} />Salvar</button>
                  </Panel>
                </div>
              )}

              {view === "security" && (
                <>
                  <div className="two-columns">
                    <Panel title="Camada de segurança" kicker="ACESSO TÉCNICO" icon={<ShieldCheck />}>
                      <StateRow name="Auth" value="Supabase Auth" tone="ok" />
                      <StateRow name="MFA privilegiado" value="Obrigatório" tone="ok" />
                      <StateRow name="RLS" value="Ativo nas tabelas expostas" tone="ok" />
                      <StateRow name="Secrets" value="Somente servidor" tone="ok" />
                      <StateRow name="Permissões T.I." value={user.permissions.filter((permission) => permission.startsWith("ti.")).length + " concedidas"} tone="ok" />
                    </Panel>
                    <Panel title="Pendências conhecidas" kicker="HARDENING" icon={<AlertTriangle />}>
                      <Notice tone="warn">Leaked Password Protection segue desativada no Supabase Auth.</Notice>
                      <Notice tone="warn">A extensão pg_net permanece no schema public porque o push atual depende dela.</Notice>
                    </Panel>
                  </div>
                  <Panel title="Minhas permissões" kicker="RBAC" icon={<KeyRound />}>
                    <div className="permission-cloud">
                      {user.permissions.map((permission) => <code key={permission}>{permission}</code>)}
                    </div>
                  </Panel>
                </>
              )}

              {view === "support" && (
                <>
                  <div className="support-summary">
                    <Stat
                      title="Abertos"
                      value={supportTickets.filter((ticket) => ticket.status === "open").length}
                      detail="aguardando triagem"
                    />
                    <Stat
                      title="Em andamento"
                      value={supportTickets.filter((ticket) => ticket.status === "in_progress").length}
                      detail="em atendimento"
                    />
                    <Stat
                      title="Resolvidos"
                      value={supportTickets.filter((ticket) => ticket.status === "resolved").length}
                      detail="solucionados"
                    />
                    <Stat
                      title="Total"
                      value={supportTickets.length}
                      detail="chamados carregados"
                    />
                  </div>
                  <Panel title="Fila de chamados T.I." kicker="SUPORTE INTERNO" icon={<Wrench />}>
                    {supportTickets.length === 0 ? (
                      <Empty text="Nenhum chamado de T.I. registrado." />
                    ) : (
                      <div className="ticket-list">
                        {supportTickets.map((ticket) => {
                          const owner = profiles.find((profile) => profile.id === ticket.user_id);
                          return (
                            <article className="ticket-card" key={ticket.id}>
                              <div className="ticket-card-head">
                                <div>
                                  <span className="eyebrow">{ticket.category.toUpperCase()}</span>
                                  <h3>{ticket.subject}</h3>
                                  <small>
                                    {owner?.full_name || ticket.user_id} · {formatDate(ticket.created_at)}
                                  </small>
                                </div>
                                <select
                                  aria-label={"Status do chamado " + ticket.subject}
                                  value={ticket.status}
                                  onChange={(event) =>
                                    void run(
                                      "ticket-" + ticket.id,
                                      () =>
                                        updateSupportTicketStatus(
                                          ticket.id,
                                          event.target.value as SupportTicket["status"],
                                        ),
                                      "Chamado atualizado.",
                                    )
                                  }
                                >
                                  <option value="open">Aberto</option>
                                  <option value="in_progress">Em andamento</option>
                                  <option value="resolved">Resolvido</option>
                                  <option value="closed">Fechado</option>
                                </select>
                              </div>
                              <p>{ticket.description}</p>
                              <div className="ticket-meta">
                                <code>{ticket.page_path || "/"}</code>
                                <span>{ticket.page_title || "Página não informada"}</span>
                                {ticket.attachment_path && (
                                  <button
                                    onClick={() =>
                                      void run(
                                        "ticket-attachment-" + ticket.id,
                                        () => openSupportAttachment(ticket),
                                      )
                                    }
                                  >
                                    <FolderOpen size={14} /> Abrir anexo
                                  </button>
                                )}
                              </div>
                              <details>
                                <summary>Contexto técnico</summary>
                                <pre>{JSON.stringify(ticket.technical_context || {}, null, 2)}</pre>
                              </details>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </Panel>
                </>
              )}

              {view === "logs" && (
                <>
                  <Panel title="Auditoria geral" kicker="ÚLTIMOS EVENTOS" icon={<Activity />}>
                    <AuditList rows={audit} full />
                  </Panel>
                  <Panel title="Operações Datasul" kicker="API" icon={<Database />}>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Data</th><th>Operador</th><th>Método</th><th>Endpoint</th><th>HTTP</th><th>Status</th></tr></thead>
                        <tbody>
                          {datasulOps.map((row) => (
                            <tr key={row.id}>
                              <td>{formatDate(row.created_at)}</td>
                              <td>{row.actor_name || "-"}</td>
                              <td>{row.method}</td>
                              <td><code>{row.path}</code></td>
                              <td>{row.response_status || "-"}</td>
                              <td><Badge tone={row.success ? "ok" : "error"}>{row.success ? "Sucesso" : "Falha"}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function titleFor(view: View) {
  return {
    overview: "Visão geral",
    datasul: "Datasul RH",
    users: "Usuários e acessos",
    rh: "Dados do RH",
    storage: "Arquivos e Storage",
    notifications: "Notificações",
    database: "Banco de dados",
    integrations: "GitHub e Vercel",
    site: "Controle do site",
    security: "Segurança",
    support: "Chamados de T.I.",
    logs: "Logs e auditoria",
  }[view];
}

function NavButton({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={active ? "nav-button active" : "nav-button"} onClick={onClick}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toolbar({
  search,
  setSearch,
  placeholder,
}: {
  search: string;
  setSearch: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="toolbar">
      <Search size={18} />
      <input
        value={search}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          setSearch(event.target.value)
        }
        placeholder={placeholder}
      />
    </div>
  );
}

function Notice({
  children,
  tone = "warn",
}: {
  children: ReactNode;
  tone?: "warn" | "error" | "ok";
}) {
  return <div className={"notice " + tone}>{children}</div>;
}

function Empty({ text: value }: { text: string }) {
  return <div className="empty-state">{value}</div>;
}

function Badge({
  children,
  tone = "warn",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"status-badge " + tone}>{children}</span>;
}

function Stat({
  title,
  value,
  detail = "",
}: {
  title: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <article className="stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

function Panel({
  title,
  kicker,
  icon,
  children,
}: {
  title: string;
  kicker: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div className="panel-icon">{icon}</div>
        <div>
          <span>{kicker}</span>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function StateRow({
  name,
  value,
  tone,
}: {
  name: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="state-row">
      <span>{name}</span>
      <strong>{value}</strong>
      <span className={"status-dot " + tone} />
    </div>
  );
}

function AuditList({
  rows,
  full = false,
}: {
  rows: AuditRow[];
  full?: boolean;
}) {
  if (!rows.length) return <Empty text="Nenhum evento encontrado." />;
  return (
    <div className={full ? "audit-list full" : "audit-list"}>
      {rows.map((row) => (
        <div className="audit-row" key={row.id}>
          <div className="audit-icon">
            {row.success ? (
              <CheckCircle2 size={17} />
            ) : (
              <XCircle size={17} />
            )}
          </div>
          <div>
            <strong>{row.action}</strong>
            <span>
              {row.actor_name || "Sistema"} | {row.module}
            </span>
          </div>
          <Badge tone={row.success ? "ok" : "error"}>
            {row.success ? "OK" : "Falha"}
          </Badge>
          <time>{formatDate(row.created_at)}</time>
        </div>
      ))}
    </div>
  );
}

function ServiceGrid({
  datasul,
  github,
  vercel,
  email,
  maintenance,
}: {
  datasul: JsonObject;
  github: JsonObject;
  vercel: JsonObject;
  email: JsonObject;
  maintenance: JsonObject;
}) {
  return (
    <section className="service-grid">
      <Service icon={<Globe2 />} title="Site RH" subtitle="Produção" status={flag(maintenance.enabled) ? "Manutenção" : "Online"} tone={flag(maintenance.enabled) ? "warn" : "ok"} />
      <Service icon={<Database />} title="Datasul" subtitle="ERP / RH" status={labelStatus(datasul.status)} tone={toneFor(datasul.status)} />
      <Service icon={<GitBranch />} title="GitHub" subtitle={text(github.repository, "Repositório")} status={labelStatus(github.status)} tone={toneFor(github.status)} />
      <Service icon={<Server />} title="Vercel" subtitle={text(vercel.project, "Deploy")} status={labelStatus(vercel.status)} tone={toneFor(vercel.status)} />
      <Service icon={<Mail />} title="E-mail" subtitle="Resend" status={labelStatus(email.status)} tone={toneFor(email.status)} />
    </section>
  );
}

function Service({
  icon,
  title,
  subtitle,
  status,
  tone,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  status: string;
  tone: string;
}) {
  return (
    <article className="service-card">
      <div className="service-icon">{icon}</div>
      <div className="service-text">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <Badge tone={tone}>{status}</Badge>
    </article>
  );
}
