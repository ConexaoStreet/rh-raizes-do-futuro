import { expect, test as base, type Page, type Route } from "@playwright/test";

// Every account, object and response in this suite is synthetic. The browser is
// restricted to Vite and this intercepted API; no cloud mutation can escape.
const tiOrigin = "http://127.0.0.1:4174";
const apiOrigin = "http://127.0.0.1:54321";
const ownerId = "30000000-0000-4000-8000-000000000001";
const personId = "30000000-0000-4000-8000-000000000002";
const employeeId = "30000000-0000-4000-8000-000000000003";
const collaboratorRoleId = "30000000-0000-4000-8000-000000000004";
const managerRoleId = "30000000-0000-4000-8000-000000000005";
const classId = "30000000-0000-4000-8000-000000000006";
const departmentId = "30000000-0000-4000-8000-000000000007";
const positionId = "30000000-0000-4000-8000-000000000008";
const ticketId = "30000000-0000-4000-8000-000000000009";
const currentSessionId = "30000000-0000-4000-8000-000000000010";
const remoteSessionId = "40000000-0000-4000-8000-000000000011";
const when = "2026-10-10T12:00:00Z";
type JsonRecord = Record<string, unknown>;
type ApiCall = { key: string; method: string; url: string; body: JsonRecord };
type Failure = { status: number; message: string };
type Reply = { status: number; json: unknown };
type TiState = {
  nativeFactors: JsonRecord[];
  nativeCodeAccepted: boolean;
  permissions: string[];
  recentlyVerified: boolean;
  settings: Record<string, JsonRecord>;
  settingWrites: JsonRecord[];
  profiles: JsonRecord[];
  employees: JsonRecord[];
  employeeWrites: JsonRecord[];
  userRoles: JsonRecord[];
  sessions: Record<string, JsonRecord[]>;
  tickets: JsonRecord[];
  notifications: JsonRecord[];
  audit: JsonRecord[];
  datasulOperations: JsonRecord[];
  storage: Record<string, JsonRecord[]>;
  database: JsonRecord;
  platformMode: "configured" | "unconfigured" | "error";
};
type TiHarness = {
  state: TiState;
  calls: ApiCall[];
  callsFor: (key: string) => ApiCall[];
  failNext: (key: string, status?: number, message?: string) => void;
  replyNext: (key: string, json: unknown, status?: number) => void;
  failUntilCleared: (
    key: string,
    status?: number,
    message?: string,
  ) => () => void;
  open: () => Promise<void>;
  go: (label: string, title?: string) => Promise<void>;
  refresh: () => Promise<void>;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function initialState(): TiState {
  return {
    nativeFactors: [
      {
        id: "fixture-native-factor",
        factor_type: "totp",
        status: "verified",
        friendly_name: "Aplicativo de teste",
      },
    ],
    nativeCodeAccepted: false,
    permissions: [
      "ti.view",
      "ti.manage",
      "ti.users.manage",
      "employee.view",
      "employee.manage",
      "ti.storage.manage",
      "ti.notifications.manage",
      "ti.database.view",
      "ti.security.view",
      "ti.datasul.read",
      "ti.platform.manage",
      "audit.view",
      "audit.security",
    ],
    recentlyVerified: true,
    settings: {
      ti_control: {},
      ti_datasul: {},
      ti_github: {
        status: "connected",
        repository: "fixture/technical-portal",
        branch: "main",
      },
      ti_vercel: { status: "connected", project: "fixture-rh" },
      ti_email: { status: "healthy" },
      ti_site: {
        maintenance_title: "Manutenção de teste",
        maintenance_message: "Ajuste local controlado.",
      },
      maintenance: {
        enabled: false,
        allow_managers: true,
        title: "Manutenção de teste",
        message: "Ajuste local controlado.",
      },
    },
    settingWrites: [],
    profiles: [
      {
        id: ownerId,
        full_name: "Operadora TI",
        email: "operator@example.test",
        phone: null,
        status: "active",
        last_seen_at: when,
        espro_photo_path: null,
        espro_photo_status: "approved",
        espro_photo_rejection_reason: null,
      },
      {
        id: personId,
        full_name: "Pessoa de Teste",
        email: "person@example.test",
        phone: null,
        status: "active",
        last_seen_at: when,
        espro_photo_path: null,
        espro_photo_status: "approved",
        espro_photo_rejection_reason: null,
      },
      {
        id: "30000000-0000-4000-8000-000000000012",
        full_name: "Conta Bloqueada",
        email: "blocked@example.test",
        phone: null,
        status: "blocked",
        last_seen_at: null,
        espro_photo_path: null,
        espro_photo_status: "rejected",
        espro_photo_rejection_reason: "Fixture",
      },
    ],
    employees: [
      {
        id: employeeId,
        profile_id: personId,
        full_name: "Pessoa de Teste",
        email: "person@example.test",
        phone: "11999990000",
        registration: "FIX-001",
        status: "active",
        member_group: "class",
        access_role_code: "COLLABORATOR",
        class_id: classId,
        department_id: null,
        job_position_id: null,
        manager_id: null,
        version: 7,
      },
    ],
    employeeWrites: [],
    userRoles: [{ user_id: personId, role_id: collaboratorRoleId }],
    sessions: {
      [personId]: [
        {
          id: currentSessionId,
          created_at: when,
          updated_at: when,
          current: true,
          revoked: false,
        },
        {
          id: remoteSessionId,
          created_at: when,
          updated_at: when,
          current: false,
          revoked: false,
        },
      ],
      [ownerId]: [],
    },
    tickets: [
      {
        id: ticketId,
        user_id: personId,
        category: "acesso",
        subject: "Falha ao abrir relatório",
        description: "O relatório não abriu na tela de presenças.",
        page_path: "/presencas",
        page_title: "Presenças",
        technical_context: { viewport: "390x844", connection: "online" },
        attachment_path: null,
        status: "open",
        created_at: when,
        updated_at: when,
      },
    ],
    notifications: [],
    audit: [
      {
        id: "fixture-activity-1",
        actor_name: "Operadora TI",
        action: "update",
        module: "employees",
        entity_id: employeeId,
        event_type: "data_change",
        severity: "info",
        success: true,
        created_at: when,
        old_values: {
          full_name: "Pessoa Anterior",
          status: "inactive",
          version: 6,
        },
        new_values: {
          full_name: "Pessoa de Teste",
          status: "active",
          version: 7,
        },
        context: { reason: "Cadastro conferido" },
      },
    ],
    datasulOperations: [],
    storage: {
      "fixture-documents:": [
        { name: "reports", id: null, updated_at: when, metadata: null },
      ],
      "fixture-documents:reports": [
        {
          name: "fixture.pdf",
          id: "fixture-file-1",
          updated_at: when,
          metadata: { size: 2048 },
        },
      ],
    },
    database: {
      database_size_bytes: 10485760,
      connections: 3,
      server_time: when,
      tables: [
        {
          schema: "public",
          table: "employees",
          estimated_rows: 12,
          dead_rows: 1,
          size_bytes: 8192,
          last_analyze: when,
          last_autoanalyze: null,
        },
      ],
      rls: [
        { schema: "public", table: "employees", enabled: true, forced: false },
        { schema: "auth", table: "users", enabled: false, forced: false },
      ],
      extensions: [{ name: "pgcrypto", schema: "extensions", version: "1.3" }],
    },
    platformMode: "configured",
  };
}

const roles = [
  {
    id: managerRoleId,
    code: "MANAGER",
    name: "Gestor",
    level: 50,
    privileged: true,
    active: true,
    archived: false,
  },
  {
    id: collaboratorRoleId,
    code: "COLLABORATOR",
    name: "Colaborador",
    level: 10,
    privileged: false,
    active: true,
    archived: false,
  },
];

async function seedSession(page: Page) {
  await page.addInitScript(
    ({ ownerId, currentSessionId }) => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const encode = (value: unknown) =>
        btoa(JSON.stringify(value))
          .replaceAll("=", "")
          .replaceAll("+", "-")
          .replaceAll("/", "_");
      const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: ownerId, aud: "authenticated", role: "authenticated", session_id: currentSessionId, exp })}.c2lnbmF0dXJl`;
      localStorage.setItem(
        "sb-127-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture-refresh",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: ownerId,
            aud: "authenticated",
            role: "authenticated",
            email: "operator@example.test",
            app_metadata: {},
            user_metadata: {},
            created_at: "2026-10-01T00:00:00Z",
          },
        }),
      );
      sessionStorage.setItem("raizes-ti-intro-seen", "1");
    },
    { ownerId, currentSessionId },
  );
}

const test = base.extend<{ ti: TiHarness }>({
  ti: async ({ page, context }, runFixture) => {
    const state = initialState();
    const calls: ApiCall[] = [];
    const unexpected: string[] = [];
    const browserErrors: string[] = [];
    const failures = new Map<string, Failure[]>();
    const replies = new Map<string, Reply[]>();
    const persistentFailures = new Map<string, Failure>();
    const expectedHttpFailures = new Set<string>();
    let verificationChallengeSent = false;
    await seedSession(page);
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const source = message.location().url;
      if (
        message.text().startsWith("Failed to load resource:") &&
        expectedHttpFailures.has(source)
      )
        return;
      browserErrors.push(message.text());
    });

    async function fulfill(route: Route, json: unknown, status = 200) {
      if (status >= 400) expectedHttpFailures.add(route.request().url());
      await route.fulfill({
        status,
        json,
        headers: { "access-control-allow-origin": tiOrigin },
      });
    }
    async function reject(route: Route, message: string, status = 403) {
      await fulfill(
        route,
        { code: "FIXTURE_ERROR", message, error: message },
        status,
      );
    }
    async function requireRecentVerification(route: Route) {
      if (state.recentlyVerified) return true;
      // Match the plain PostgREST error object returned by a SQL guard,
      // rather than throwing a browser-side Error instance.
      await fulfill(
        route,
        {
          code: "P0001",
          message: "RECENT_VERIFICATION_REQUIRED",
          details: null,
          hint: null,
        },
        403,
      );
      return false;
    }
    function addAudit(
      action: string,
      module: string,
      entityId: string,
      oldValues: JsonRecord,
      newValues: JsonRecord,
      context: JsonRecord = {},
    ) {
      state.audit.unshift({
        id: "fixture-activity-" + (state.audit.length + 1),
        actor_name: "Operadora TI",
        action,
        module,
        entity_id: entityId,
        old_values: oldValues,
        new_values: newValues,
        context,
        success: true,
        event_type: "data_change",
        severity: "info",
        created_at: when,
      });
    }
    function snapshot() {
      return {
        profiles_total: state.profiles.length,
        profiles_active: state.profiles.filter((row) => row.status === "active")
          .length,
        employees_total: state.employees.length,
        employees_active: state.employees.filter(
          (row) => row.status === "active",
        ).length,
        auth_sessions: 2,
        push_devices: 2,
        attendance_sessions: 4,
        notifications_unread: state.notifications.length,
        audit_24h: state.audit.length,
        storage_objects: Object.values(state.storage)
          .flat()
          .filter((row) => row.id).length,
        datasul_operations_24h: state.datasulOperations.length,
        datasul_failures_24h: state.datasulOperations.filter(
          (row) => !row.success,
        ).length,
        photo_status: { approved: 2 },
      };
    }

    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if ([tiOrigin, "http://127.0.0.1:4173"].includes(url.origin)) {
        await route.continue();
        return;
      }
      if (
        url.pathname === "/brand/raizes-logo-mark.png" &&
        request.resourceType() === "image"
      ) {
        await route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#388363"/></svg>',
        });
        return;
      }
      if (url.origin !== apiOrigin) {
        unexpected.push(request.method() + " " + url.origin + url.pathname);
        await route.abort("blockedbyclient");
        return;
      }
      const body = record(request.postData() ? request.postDataJSON() : {});
      const path = url.pathname;
      const resource = path.split("/").at(-1) || "";
      const key = path.startsWith("/rest/v1/rpc/")
        ? "RPC " + resource
        : path.startsWith("/functions/v1/")
          ? "FUNCTION " + resource + ":" + String(body.action)
          : path.startsWith("/rest/v1/")
            ? "REST " + request.method() + " " + resource
            : request.method() + " " + path;
      calls.push({ key, method: request.method(), url: request.url(), body });
      const reply = replies.get(key)?.shift();
      if (reply) {
        await fulfill(route, reply.json, reply.status);
        return;
      }
      const failure = persistentFailures.get(key) || failures.get(key)?.shift();
      if (failure) {
        await reject(route, failure.message, failure.status);
        return;
      }
      if (path === "/auth/v1/user" && request.method() === "GET") {
        await fulfill(route, {
          id: ownerId,
          aud: "authenticated",
          role: "authenticated",
          email: "operator@example.test",
          app_metadata: {},
          user_metadata: {},
          created_at: when,
          factors: state.nativeFactors,
        });
        return;
      }
      if (path === "/auth/v1/logout") {
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      if (path === "/auth/v1/factors" && request.method() === "POST") {
        state.nativeFactors.push({
          id: "fixture-pending-factor",
          factor_type: "totp",
          status: "unverified",
        });
        await fulfill(route, {
          id: "fixture-pending-factor",
          type: "totp",
          totp: {
            qr_code:
              '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" /></svg>',
            secret: "FIXTUREKEY",
          },
        });
        return;
      }
      if (path.startsWith("/auth/v1/factors/") && path.endsWith("/challenge")) {
        await fulfill(route, {
          id: "fixture-challenge",
          type: "totp",
          expires_at: Math.floor(Date.now() / 1000) + 300,
        });
        return;
      }
      if (path.startsWith("/auth/v1/factors/") && path.endsWith("/verify")) {
        state.nativeCodeAccepted = true;
        const factor = state.nativeFactors.find((f) =>
          path.includes(String(f.id)),
        );
        if (factor) factor.status = "verified";
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token =
          Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
            "base64url",
          ) +
          "." +
          Buffer.from(
            JSON.stringify({
              sub: ownerId,
              role: "authenticated",
              aud: "authenticated",
              exp,
              aal: "aal2",
              session_id: currentSessionId,
            }),
          ).toString("base64url") +
          ".c2lnbmF0dXJl";
        await fulfill(route, {
          access_token: token,
          refresh_token: "fixture-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: ownerId,
            aud: "authenticated",
            role: "authenticated",
            email: "operator@example.test",
            created_at: when,
            factors: state.nativeFactors,
          },
        });
        return;
      }
      if (
        path.startsWith("/auth/v1/factors/") &&
        request.method() === "DELETE"
      ) {
        state.nativeFactors = state.nativeFactors.filter(
          (f) => !path.endsWith(String(f.id)),
        );
        await fulfill(route, {});
        return;
      }
      if (path.startsWith("/rest/v1/rpc/")) {
        if (resource === "confirm_authenticator_session") {
          state.recentlyVerified = state.nativeCodeAccepted;
          await fulfill(route, { ok: state.nativeCodeAccepted });
          return;
        }
        if (resource === "bootstrap") {
          await fulfill(route, {
            profile: {
              id: ownerId,
              full_name: "Operadora TI",
              email: "operator@example.test",
              status: "active",
              onboarded_at: when,
            },
            roles: ["SUPER_ADMIN"],
            permissions: state.permissions,
            privileged: true,
            mfa_verified: true,
            recently_verified: state.recentlyVerified,
            ready: true,
            maintenance: state.settings.maintenance,
          });
          return;
        }
        if (resource === "ti_snapshot") {
          await fulfill(route, snapshot());
          return;
        }
        if (resource === "ti_update_setting") {
          if (!(await requireRecentVerification(route))) return;
          const settingKey = String(body.setting_key);
          if (!Object.hasOwn(state.settings, settingKey)) {
            await reject(route, "SETTING_NOT_FOUND", 404);
            return;
          }
          state.settings[settingKey] = record(body.setting_value);
          state.settingWrites.push(structuredClone(body));
          await fulfill(route, { ok: true });
          return;
        }
        if (resource === "manage_user") {
          const profile = state.profiles.find(
            (row) => row.id === body.user_identifier,
          );
          if (!profile) {
            await reject(route, "USER_NOT_FOUND", 404);
            return;
          }
          const before = {
            status: profile.status,
            roles: state.userRoles
              .filter((row) => row.user_id === profile.id)
              .map((row) => row.role_id),
          };
          profile.status = body.new_status;
          state.userRoles = state.userRoles.filter(
            (row) => row.user_id !== profile.id,
          );
          for (const roleId of body.role_identifiers as string[])
            state.userRoles.push({ user_id: profile.id, role_id: roleId });
          addAudit(
            "change_access",
            "profiles",
            String(profile.id),
            before,
            { status: profile.status, roles: body.role_identifiers },
            { reason: body.reason },
          );
          await fulfill(route, { ok: true });
          return;
        }
        if (resource === "save_entity" && body.entity === "employees") {
          if (!(await requireRecentVerification(route))) return;
          const payload = record(body.payload);
          const employee = state.employees.find((row) => row.id === payload.id);
          if (!employee || employee.version !== body.expected_version) {
            await reject(route, "VERSION_CONFLICT", 409);
            return;
          }
          const before = { ...employee };
          Object.assign(employee, payload, {
            version: Number(employee.version) + 1,
          });
          state.employeeWrites.push(structuredClone(body));
          addAudit("update", "employees", String(employee.id), before, {
            ...employee,
          });
          await fulfill(route, employee);
          return;
        }
        if (resource === "my_sessions") {
          await fulfill(route, state.sessions[String(body.target_user)] || []);
          return;
        }
        if (resource === "revoke_session") {
          const session = Object.values(state.sessions)
            .flat()
            .find((row) => row.id === body.session_identifier);
          if (!session || session.current) {
            await reject(route, "CURRENT_SESSION_PROTECTED");
            return;
          }
          session.revoked = true;
          await fulfill(route, { ok: true });
          return;
        }
        if (resource === "ti_send_notification") {
          state.notifications.push({ ...body });
          addAudit(
            "ti_notification_send",
            "notifications",
            String(body.target_user),
            {},
            { title: body.notification_title, message: body.notification_body },
          );
          await fulfill(route, { ok: true });
          return;
        }
      }
      if (path.startsWith("/rest/v1/") && !path.includes("/rpc/")) {
        if (request.method() === "GET") {
          const tables: Record<string, unknown> = {
            settings: Object.entries(state.settings).map(([key, value]) => ({
              key,
              value,
            })),
            profiles: state.profiles,
            employees: state.permissions.includes("employee.view")
              ? state.employees
              : state.employees.filter((row) => row.profile_id === ownerId),
            roles,
            user_roles: state.userRoles,
            departments: [{ id: departmentId, name: "Tecnologia" }],
            job_positions: [{ id: positionId, name: "Analista" }],
            classes: [{ id: classId, name: "Turma Local", code: "LOCAL" }],
            audit_logs: state.audit,
            ti_datasul_operations: state.datasulOperations,
            ti_support_tickets: state.tickets,
          };
          if (Object.hasOwn(tables, resource)) {
            await fulfill(route, tables[resource]);
            return;
          }
        }
        if (request.method() === "PATCH" && resource === "ti_support_tickets") {
          const id = url.searchParams.get("id")?.replace(/^eq\./, "");
          const ticket = state.tickets.find((row) => row.id === id);
          if (!ticket) {
            await reject(route, "TICKET_NOT_FOUND", 404);
            return;
          }
          const before = { status: ticket.status };
          ticket.status = body.status;
          addAudit("update", "ti_support_tickets", String(ticket.id), before, {
            status: ticket.status,
          });
          await fulfill(route, []);
          return;
        }
      }
      if (path === "/functions/v1/email-2fa") {
        if (body.action === "send") {
          verificationChallengeSent = true;
          await fulfill(route, {
            ok: true,
            masked_email: "op***@example.test",
          });
          return;
        }
        if (body.action === "verify") {
          if (!verificationChallengeSent || body.code !== "123456") {
            await reject(route, "INVALID_CODE", 400);
            return;
          }
          state.recentlyVerified = true;
          verificationChallengeSent = false;
          await fulfill(route, { ok: true });
          return;
        }
      }
      if (path === "/functions/v1/ti-admin-bridge") {
        if (body.action === "inventory") {
          await fulfill(route, {
            snapshot: snapshot(),
            buckets: [
              {
                id: "fixture-documents",
                name: "Documentos locais",
                public: false,
                file_size_limit: 1048576,
                allowed_mime_types: ["application/pdf"],
                top_level_items: 1,
              },
            ],
            roles,
            profiles_count: state.profiles.length,
          });
          return;
        }
        if (body.action === "database") {
          await fulfill(route, state.database);
          return;
        }
        if (body.action === "storage_list") {
          await fulfill(route, {
            items:
              state.storage[String(body.bucket) + ":" + String(body.prefix)] ||
              [],
          });
          return;
        }
        if (body.action === "storage_delete") {
          const fullPath = String(body.path);
          const slash = fullPath.lastIndexOf("/");
          const prefix = slash >= 0 ? fullPath.slice(0, slash) : "";
          const name = fullPath.slice(slash + 1);
          const location = String(body.bucket) + ":" + prefix;
          state.storage[location] = (state.storage[location] || []).filter(
            (row) => row.name !== name,
          );
          addAudit("ti_storage_delete", "storage", fullPath, { name }, {});
          await fulfill(route, { ok: true });
          return;
        }
      }
      if (
        path === "/functions/v1/platform-bridge" &&
        body.action === "status"
      ) {
        const mode = state.platformMode;
        const githubStatus =
          mode === "configured"
            ? "connected"
            : mode === "unconfigured"
              ? "partial"
              : "error";
        const vercelStatus =
          mode === "configured"
            ? "connected"
            : mode === "unconfigured"
              ? "needs_secret"
              : "error";
        Object.assign(state.settings.ti_github, {
          status: githubStatus,
          last_check_at: when,
        });
        Object.assign(state.settings.ti_vercel, {
          status: vercelStatus,
          last_check_at: when,
        });
        await fulfill(route, {
          github: {
            configured: mode !== "unconfigured",
            status: githubStatus,
            mode: mode === "unconfigured" ? "public" : "authenticated",
            runs:
              mode === "configured"
                ? [
                    {
                      id: "fixture-run",
                      name: "Verificação local",
                      status: "completed",
                      conclusion: "success",
                    },
                  ]
                : [],
            ...(mode === "error" ? { http_status: 503 } : {}),
          },
          vercel: {
            configured: mode !== "unconfigured",
            status: vercelStatus,
            deployments:
              mode === "configured"
                ? [
                    {
                      id: "fixture-deploy",
                      state: "READY",
                      url: "fixture.invalid",
                    },
                  ]
                : [],
            ...(mode === "error" ? { http_status: 503 } : {}),
          },
          required_secrets: {
            github: ["GITHUB_TOKEN"],
            vercel: ["VERCEL_TOKEN", "VERCEL_TEAM_ID"],
          },
        });
        return;
      }
      unexpected.push(key);
      await reject(route, "UNMOCKED_ENDPOINT", 501);
    });

    const callsFor = (key: string) => calls.filter((call) => call.key === key);
    async function loaded() {
      await expect(page.locator(".loading-panel")).toHaveCount(0);
    }
    const ti: TiHarness = {
      state,
      calls,
      callsFor,
      failNext: (key, status = 503, message = "FIXTURE_UNAVAILABLE") => {
        const queue = failures.get(key) || [];
        queue.push({ status, message });
        failures.set(key, queue);
      },
      replyNext: (key, json, status = 200) => {
        const queue = replies.get(key) || [];
        queue.push({ json, status });
        replies.set(key, queue);
      },
      failUntilCleared: (
        key,
        status = 503,
        message = "FIXTURE_UNAVAILABLE",
      ) => {
        persistentFailures.set(key, { status, message });
        return () => persistentFailures.delete(key);
      },
      open: async () => {
        await page.goto(tiOrigin + "/");
        await expect(
          page.getByRole("heading", { name: "Visão geral", level: 1 }),
        ).toBeVisible();
        await expect
          .poll(() => callsFor("REST GET settings").length)
          .toBeGreaterThan(0);
        await loaded();
      },
      go: async (label, title = label) => {
        await page
          .getByRole("navigation", {
            name: "Navegação principal da Central T.I.",
          })
          .getByRole("button", { name: label, exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: title, level: 1, exact: true }),
        ).toBeVisible();
        await loaded();
      },
      refresh: async () => {
        const before = callsFor("REST GET settings").length;
        await page
          .getByRole("button", { name: "Atualizar dados", exact: true })
          .click();
        await expect
          .poll(() => callsFor("REST GET settings").length)
          .toBeGreaterThan(before);
        await loaded();
      },
    };
    await runFixture(ti);
    expect(
      unexpected,
      "All network destinations and Supabase endpoints must be explicitly isolated",
    ).toEqual([]);
    expect(
      browserErrors,
      "No unexpected console or uncaught page errors",
    ).toEqual([]);
  },
});

function profileRow(page: Page) {
  return page
    .getByRole("row")
    .filter({ has: page.getByText("person@example.test", { exact: true }) });
}

async function openPersonSessions(page: Page, ti: TiHarness) {
  await ti.go("Usuários e acessos");
  await profileRow(page)
    .getByRole("button", { name: "Sessões", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Sessões de Pessoa de Teste",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".session-row")).toHaveCount(2);
}

test("overview refreshes indicators and remains operational after a partial module failure", async ({
  page,
  ti,
}) => {
  // 503 is automatically retried by the SDK; use a deterministic, terminal
  // denial to exercise the module fallback rather than transport backoff.
  const recoverEmployees = ti.failUntilCleared("REST GET employees", 403);
  await ti.open();
  await expect(
    page.getByText("Operação parcial", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".module-health-warning")).toContainText(
    "colaboradores",
  );
  await expect(
    page.getByRole("region", { name: "Saúde dos serviços" }),
  ).toContainText("Operação normal");
  await expect(
    page.getByRole("list", { name: "Atividades do site" }),
  ).toContainText("Operadora TI");
  recoverEmployees();
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(page.locator(".module-health-warning")).toHaveCount(0);
  await ti.go("Dados do RH");
  await expect(
    page.getByRole("row").filter({ hasText: "FIX-001" }),
  ).toBeVisible();
  await ti.go("Visão geral");
  const before = ti.callsFor("RPC ti_snapshot").length;
  await ti.refresh();
  expect(ti.callsFor("RPC ti_snapshot").length).toBeGreaterThan(before);
});

test("users validate a reason, persist role and status, and show the resulting activity", async ({
  page,
  ti,
}) => {
  await ti.open();
  await ti.go("Usuários e acessos");
  await page
    .getByPlaceholder("Buscar usuário, e-mail ou status")
    .fill("person@example.test");
  await expect(page.getByRole("row")).toHaveCount(2);
  await profileRow(page)
    .getByRole("button", { name: "Gerenciar", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("blocked");
  await page
    .getByRole("combobox", { name: "Cargo", exact: true })
    .selectOption(managerRoleId);
  await page.getByRole("textbox", { name: "Motivo", exact: true }).fill("ab");
  await page
    .getByRole("button", { name: "Salvar acesso", exact: true })
    .click();
  await expect(page.locator(".notice.error")).toHaveText(
    "Informe um motivo com pelo menos 3 caracteres.",
  );
  expect(ti.callsFor("RPC manage_user")).toHaveLength(0);
  await page
    .getByRole("textbox", { name: "Motivo", exact: true })
    .fill("  Revisão aprovada no teste  ");
  await page
    .getByRole("button", { name: "Salvar acesso", exact: true })
    .click();
  await expect(
    page.getByText("Acesso atualizado.", { exact: true }),
  ).toBeVisible();
  expect(ti.callsFor("RPC manage_user")[0].body).toEqual({
    user_identifier: personId,
    new_status: "blocked",
    role_identifiers: [managerRoleId],
    reason: "Revisão aprovada no teste",
  });
  await expect(profileRow(page)).toContainText("blocked");
  await expect(profileRow(page)).toContainText("Gestor");
  await page.reload();
  await ti.go("Usuários e acessos");
  await expect(profileRow(page)).toContainText("blocked");
  await expect(profileRow(page)).toContainText("Gestor");
  await ti.go("Histórico de atividades");
  const activity = page
    .getByRole("list", { name: "Atividades do site" })
    .locator("li")
    .first();
  await activity.locator("summary").click();
  await expect(activity).toContainText("Revisão aprovada no teste");
  await expect(activity).toContainText("Bloqueado");
  await expect(activity).toContainText("Gestor");
});

test("users keep an unsuccessful access edit available for retry", async ({
  page,
  ti,
}) => {
  await ti.open();
  await ti.go("Usuários e acessos");
  await profileRow(page)
    .getByRole("button", { name: "Gerenciar", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Motivo", exact: true })
    .fill("Revisão de teste");
  ti.failNext("RPC manage_user", 403, "ACCESS_DENIED");
  await page
    .getByRole("button", { name: "Salvar acesso", exact: true })
    .click();
  await expect(page.locator(".notice.error")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Motivo", exact: true }),
  ).toHaveValue("Revisão de teste");
  await expect(
    page.getByText("Acesso atualizado.", { exact: true }),
  ).toHaveCount(0);
  expect(ti.state.profiles.find((row) => row.id === personId)?.status).toBe(
    "active",
  );
  await page
    .getByRole("button", { name: "Salvar acesso", exact: true })
    .click();
  await expect(
    page.getByText("Acesso atualizado.", { exact: true }),
  ).toBeVisible();
  expect(ti.callsFor("RPC manage_user")).toHaveLength(2);
});

test("employee edits send the optimistic version and persist all selected RH fields", async ({
  page,
  ti,
}) => {
  await ti.open();
  await ti.go("Dados do RH");
  await page
    .getByPlaceholder("Buscar colaborador, matrícula ou cargo")
    .fill("FIX-001");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nome", exact: true })
    .fill("Pessoa Atualizada");
  await page
    .getByRole("textbox", { name: "E-mail", exact: true })
    .fill("updated@example.test");
  await page
    .getByRole("textbox", { name: "Telefone", exact: true })
    .fill("11888880000");
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("suspended");
  await page
    .getByRole("combobox", { name: "Grupo", exact: true })
    .selectOption("rh");
  await page
    .getByRole("combobox", { name: "Cargo de acesso", exact: true })
    .selectOption("MANAGER");
  await page
    .getByRole("combobox", { name: "Turma", exact: true })
    .selectOption("");
  await page
    .getByRole("combobox", { name: "Departamento", exact: true })
    .selectOption(departmentId);
  await page
    .getByRole("combobox", { name: "Cargo interno", exact: true })
    .selectOption(positionId);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Cadastro atualizado.", { exact: true }),
  ).toBeVisible();
  expect(ti.callsFor("RPC save_entity")[0].body).toEqual({
    entity: "employees",
    expected_version: 7,
    payload: {
      id: employeeId,
      full_name: "Pessoa Atualizada",
      email: "updated@example.test",
      phone: "11888880000",
      status: "suspended",
      member_group: "rh",
      access_role_code: "MANAGER",
      class_id: null,
      department_id: departmentId,
      job_position_id: positionId,
    },
  });
  expect(ti.state.employees[0].version).toBe(8);
  await page.reload();
  await ti.go("Dados do RH");
  await expect(
    page.getByRole("row").filter({ hasText: "FIX-001" }),
  ).toContainText("Pessoa Atualizada");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Departamento", exact: true }),
  ).toHaveValue(departmentId);
  await expect(
    page.getByRole("combobox", { name: "Cargo interno", exact: true }),
  ).toHaveValue(positionId);
  await expect(
    page.getByRole("combobox", { name: "Turma", exact: true }),
  ).toHaveValue("");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Nome", exact: true }),
  ).toHaveCount(0);
});

test("recent verification retries the complete employee form and original version once after its event has ended", async ({
  page,
  ti,
}) => {
  // Represent the SQL result at 16 minutes: login MFA remains valid, but the
  // shorter verification required by a sensitive write has expired.
  ti.state.recentlyVerified = false;
  const original = structuredClone(ti.state.employees[0]);
  const originalAudit = structuredClone(ti.state.audit);
  const fields = {
    full_name: "Pessoa com identidade renovada",
    email: "renewed@example.test",
    phone: "11777770000",
    status: "inactive",
    member_group: "rh",
    access_role_code: "MANAGER",
    class_id: null,
    department_id: departmentId,
    job_position_id: positionId,
  };
  const payload = {
    entity: "employees",
    expected_version: original.version,
    payload: { id: employeeId, ...fields },
  };
  await ti.open();
  await ti.go("Dados do RH");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  for (const [label, value] of [
    ["Nome", fields.full_name],
    ["E-mail", fields.email],
    ["Telefone", fields.phone],
  ]) {
    await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  }
  for (const [label, value] of [
    ["Status", fields.status],
    ["Grupo", fields.member_group],
    ["Cargo de acesso", fields.access_role_code],
    ["Turma", ""],
    ["Departamento", fields.department_id],
    ["Cargo interno", fields.job_position_id],
  ]) {
    await page
      .getByRole("combobox", { name: label, exact: true })
      .selectOption(value);
  }
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Renovar verificação",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  expect(ti.callsFor("RPC save_entity").map((call) => call.body)).toEqual([
    payload,
  ]);
  expect(ti.state.employees[0]).toEqual(original);
  expect(ti.state.employeeWrites).toEqual([]);
  expect(ti.state.audit).toEqual(originalAudit);
  await expect(
    page.getByText("Cadastro atualizado.", { exact: true }),
  ).toHaveCount(0);
  for (const [label, value] of [
    ["Nome", fields.full_name],
    ["E-mail", fields.email],
    ["Telefone", fields.phone],
  ]) {
    await expect(
      page.getByRole("textbox", {
        name: label,
        exact: true,
        includeHidden: true,
      }),
    ).toHaveValue(value);
  }
  for (const [label, value] of [
    ["Status", fields.status],
    ["Grupo", fields.member_group],
    ["Cargo de acesso", fields.access_role_code],
    ["Turma", ""],
    ["Departamento", fields.department_id],
    ["Cargo interno", fields.job_position_id],
  ]) {
    await expect(
      page.getByRole("combobox", {
        name: label,
        exact: true,
        includeHidden: true,
      }),
    ).toHaveValue(value);
  }
  await dialog
    .getByRole("button", { name: "Enviar código", exact: true })
    .click();
  await dialog
    .getByRole("textbox", { name: "Código de verificação", exact: true })
    .fill("123456");
  await dialog
    .getByRole("button", { name: "Verificar código", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Cadastro atualizado.", { exact: true }),
  ).toBeVisible();
  expect(ti.state.recentlyVerified).toBe(true);
  expect(ti.callsFor("RPC save_entity").map((call) => call.body)).toEqual([
    payload,
    payload,
  ]);
  expect(ti.state.employeeWrites).toEqual([payload]);
  expect(ti.state.employees[0]).toEqual({ ...original, ...fields, version: 8 });
  expect(ti.state.audit).toHaveLength(originalAudit.length + 1);
  await page.reload();
  await ti.go("Dados do RH");
  await expect(
    page.getByRole("row").filter({ hasText: "FIX-001" }),
  ).toContainText(fields.full_name);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "E-mail", exact: true }),
  ).toHaveValue(fields.email);
  await expect(
    page.getByRole("combobox", { name: "Departamento", exact: true }),
  ).toHaveValue(departmentId);
  expect(ti.state.employeeWrites).toEqual([payload]);
});

test("employee version conflicts preserve the form until fresh data is loaded", async ({
  page,
  ti,
}) => {
  await ti.open();
  await ti.go("Dados do RH");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nome", exact: true })
    .fill("Edição conflitante");
  ti.state.employees[0].version = 8;
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".notice.error")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Nome", exact: true }),
  ).toHaveValue("Edição conflitante");
  await expect(
    page.getByText("Cadastro atualizado.", { exact: true }),
  ).toHaveCount(0);
  expect(ti.state.employees[0].full_name).toBe("Pessoa de Teste");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await ti.refresh();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nome", exact: true })
    .fill("Edição renovada");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Cadastro atualizado.", { exact: true }),
  ).toBeVisible();
  expect(ti.callsFor("RPC save_entity")[1].body.expected_version).toBe(8);
});

test("storage lists prefixes, requires the exact deletion phrase and refreshes only local files", async ({
  page,
  ti,
}) => {
  await ti.open();
  await ti.go("Arquivos e Storage");
  await page.getByRole("button", { name: /Documentos locais/ }).click();
  await expect(page.locator(".file-row")).toContainText("reports");
  await expect(
    page.getByRole("button", { name: "Excluir", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("textbox", { name: "Prefixo" }).fill("reports");
  await page.getByRole("button", { name: "Listar", exact: true }).click();
  await expect(page.locator(".file-row")).toContainText("fixture.pdf");
  expect(
    ti.callsFor("FUNCTION ti-admin-bridge:storage_list").at(-1)?.body,
  ).toEqual({
    action: "storage_list",
    bucket: "fixture-documents",
    prefix: "reports",
    limit: 300,
  });
  page.once("dialog", (dialog) => dialog.accept("EXCLUIR"));
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(
    page.getByText("Arquivo removido.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Nenhum item neste nível.", { exact: true }),
  ).toBeVisible();
  expect(
    ti.callsFor("FUNCTION ti-admin-bridge:storage_delete")[0].body,
  ).toEqual({
    action: "storage_delete",
    bucket: "fixture-documents",
    path: "reports/fixture.pdf",
  });
  await page.getByRole("button", { name: "Listar", exact: true }).click();
  await expect(page.locator(".file-row")).toHaveCount(0);
});

test("cancelling storage deletion leaves the file and does not announce success", async ({
  page,
  ti,
}) => {
  await ti.open();
  await ti.go("Arquivos e Storage");
  await page.getByRole("button", { name: /Documentos locais/ }).click();
  await page.getByRole("textbox", { name: "Prefixo" }).fill("reports");
  await page.getByRole("button", { name: "Listar", exact: true }).click();
  await expect(page.locator(".file-row")).toContainText("fixture.pdf");
  page.once("dialog", (dialog) => dialog.accept("excluir"));
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Atualizar dados" }),
  ).toBeEnabled();
  expect(ti.callsFor("FUNCTION ti-admin-bridge:storage_delete")).toHaveLength(
    0,
  );
  await expect(page.locator(".file-row")).toContainText("fixture.pdf");
  await expect(
    page.getByText("Arquivo removido.", { exact: true }),
  ).toHaveCount(0);
});

test("notification validates required fields, excludes blocked users and preserves a failed draft", async ({
  page,
  ti,
}) => {
  await ti.open();
  await ti.go("Notificações");
  const submit = page.getByRole("button", {
    name: "Enviar notificação",
    exact: true,
  });
  await submit.click();
  expect(ti.callsFor("RPC ti_send_notification")).toHaveLength(0);
  expect(
    await page
      .getByRole("combobox", { name: "Usuário", exact: true })
      .evaluate((element: HTMLSelectElement) => element.validity.valueMissing),
  ).toBe(true);
  await expect(
    page
      .getByRole("combobox", { name: "Usuário", exact: true })
      .locator("option"),
  ).toHaveCount(3);
  await expect(
    page.getByRole("combobox", { name: "Usuário", exact: true }),
  ).not.toContainText("Conta Bloqueada");
  await page
    .getByRole("combobox", { name: "Usuário", exact: true })
    .selectOption(personId);
  await page
    .getByRole("textbox", { name: "Título", exact: true })
    .fill("Aviso de teste");
  await page
    .getByRole("textbox", { name: "Mensagem", exact: true })
    .fill("Mensagem local para verificar a entrega interna.");
  await page
    .getByRole("textbox", { name: "Destino no app", exact: true })
    .fill("");
  ti.failNext("RPC ti_send_notification");
  await submit.click();
  await expect(page.locator(".notice.error")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Título", exact: true }),
  ).toHaveValue("Aviso de teste");
  expect(ti.state.notifications).toHaveLength(0);
  await submit.click();
  await expect(
    page.getByText("Notificação enviada.", { exact: true }),
  ).toBeVisible();
  expect(ti.callsFor("RPC ti_send_notification").at(-1)?.body).toEqual({
    target_user: personId,
    notification_title: "Aviso de teste",
    notification_body: "Mensagem local para verificar a entrega interna.",
    notification_path: "/",
  });
  await expect(
    page.getByRole("textbox", { name: "Título", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("textbox", { name: "Mensagem", exact: true }),
  ).toHaveValue("");
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Não lidas" })
      .locator("strong"),
  ).toHaveText("1");
  await page.reload();
  await ti.go("Notificações");
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Não lidas" })
      .locator("strong"),
  ).toHaveText("1");
});

test("database loads a diagnostic snapshot, retries a failure and refreshes changed counts", async ({
  page,
  ti,
}) => {
  await ti.open();
  ti.failNext("FUNCTION ti-admin-bridge:database");
  await ti.go("Banco de dados");
  await expect(page.locator(".notice.error")).toBeVisible();
  await expect(
    page.getByText("Carregue o diagnóstico do banco.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Atualizar diagnóstico", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Tabelas do PostgreSQL" }),
  ).toContainText("public.employees");
  await expect(page.getByText("RLS ativo", { exact: true })).toBeVisible();
  await expect(page.locator(".rls-item")).toHaveCount(1);
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Conexões" })
      .locator("strong"),
  ).toHaveText("3");
  ti.state.database.connections = 5;
  await page
    .getByRole("button", { name: "Atualizar diagnóstico", exact: true })
    .click();
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Conexões" })
      .locator("strong"),
  ).toHaveText("5");
  expect(ti.callsFor("FUNCTION ti-admin-bridge:database")).toHaveLength(3);
  expect(
    ti
      .callsFor("FUNCTION ti-admin-bridge:database")
      .every((call) => JSON.stringify(call.body) === '{"action":"database"}'),
  ).toBe(true);
});

for (const mode of ["configured", "unconfigured", "error"] as const) {
  test(`integrations display ${mode} diagnostics and reload their service state`, async ({
    page,
    ti,
  }) => {
    ti.state.platformMode = mode;
    await ti.open();
    await ti.go("GitHub e Vercel");
    await page
      .getByRole("button", { name: "Verificar plataforma", exact: true })
      .click();
    const diagnostic = page.getByRole("region", {
      name: "Diagnóstico de GitHub e Vercel",
    });
    await expect(diagnostic).toBeVisible();
    expect(ti.callsFor("FUNCTION platform-bridge:status")[0].body).toEqual({
      action: "status",
    });
    const cards = page.locator(".ti-integration-card");
    if (mode === "configured") {
      await expect(cards.nth(0)).toContainText("Conectado");
      await expect(cards.nth(1)).toContainText("Conectado");
      await expect(diagnostic).toContainText("fixture-run");
      await expect(diagnostic).toContainText("fixture-deploy");
    } else if (mode === "unconfigured") {
      await expect(cards.nth(0)).toContainText("Parcial");
      await expect(cards.nth(1)).toContainText("Credencial necessária");
      await expect(diagnostic).toContainText('"configured": false');
    } else {
      await expect(cards.nth(0)).toContainText("Erro");
      await expect(cards.nth(1)).toContainText("Erro");
      await expect(diagnostic).toContainText("503");
    }
    await page.reload();
    await ti.go("GitHub e Vercel");
    await expect(page.locator(".ti-integration-card").nth(1)).toContainText(
      mode === "configured"
        ? "Conectado"
        : mode === "unconfigured"
          ? "Credencial necessária"
          : "Erro",
    );
  });
}

test("integration transport failures allow retry without displaying a successful diagnostic", async ({
  page,
  ti,
}) => {
  await ti.open();
  await ti.go("GitHub e Vercel");
  ti.failNext("FUNCTION platform-bridge:status");
  await page
    .getByRole("button", { name: "Verificar plataforma", exact: true })
    .click();
  await expect(page.locator(".notice.error")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Diagnóstico de GitHub e Vercel" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Verificar plataforma", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Diagnóstico de GitHub e Vercel" }),
  ).toContainText("fixture-deploy");
  expect(ti.callsFor("FUNCTION platform-bridge:status")).toHaveLength(2);
});

test("native authenticator keeps the TI draft on rejected proof and resumes it once at 320px", async ({
  page,
  ti,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const draft = await startMaintenanceVerification(
    page,
    ti,
    "Confirmação por aplicativo",
    "Rascunho de auditoria local.",
  );
  const dialog = draft.dialog;
  await dialog
    .getByRole("button", { name: "Usar aplicativo de códigos", exact: true })
    .click();
  await expect(dialog.getByLabel("Código do aplicativo")).toBeVisible();
  expect(ti.callsFor("POST /auth/v1/factors")).toHaveLength(0);
  await dialog.getByLabel("Código do aplicativo").fill("123456");
  ti.replyNext("RPC confirm_authenticator_session", { ok: false });
  await dialog
    .getByRole("button", { name: "Confirmar acesso", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Não foi possível confirmar o acesso",
  );
  await draft.expectUnsaved();
  await dialog
    .getByRole("button", { name: "Confirmar acesso", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(ti.state.settingWrites).toEqual([draft.payload]);
  expect(ti.callsFor("RPC confirm_authenticator_session")).toHaveLength(2);
  expect(ti.callsFor("FUNCTION email-2fa:send")).toHaveLength(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("native setup is explicit and cancelling only discards the pending factor", async ({
  page,
  ti,
}) => {
  ti.state.nativeFactors = [];
  const draft = await startMaintenanceVerification(
    page,
    ti,
    "Configuração local",
    "Rascunho preservado ao voltar.",
  );
  const dialog = draft.dialog;
  await dialog
    .getByRole("button", { name: "Usar aplicativo de códigos", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Configurar aplicativo", exact: true }),
  ).toBeVisible();
  expect(ti.callsFor("POST /auth/v1/factors")).toHaveLength(0);
  await dialog
    .getByRole("button", { name: "Configurar aplicativo", exact: true })
    .click();
  const qr = dialog.getByRole("img", {
    name: "Código QR para configurar seu aplicativo",
  });
  await expect(qr).toBeVisible();
  expect(await qr.getAttribute("src")).toMatch(
    /^data:image\/svg\+xml;charset=utf-8,%3Csvg/,
  );
  await dialog
    .getByRole("button", { name: "Usar e-mail", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Enviar código", exact: true }),
  ).toBeVisible();
  expect(ti.state.nativeFactors).toEqual([]);
  await draft.expectUnsaved();
  await dialog
    .getByRole("button", { name: "Cancelar verificação", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(ti.state.settingWrites).toEqual([]);
});

test("native confirmation blocks cancelling while busy and keeps a verified factor after rejected app proof", async ({
  page,
  ti,
}) => {
  const draft = await startMaintenanceVerification(
    page,
    ti,
    "Cancelamento local",
    "Não retomar sem prova do aplicativo.",
  );
  const dialog = draft.dialog;
  await dialog
    .getByRole("button", { name: "Usar aplicativo de códigos", exact: true })
    .click();
  await dialog.getByLabel("Código do aplicativo").fill("123456");
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/rest/v1/rpc/confirm_authenticator_session",
    async (route) => {
      await gate;
      await route.fulfill({ status: 200, json: { ok: false } });
    },
  );
  await dialog
    .getByRole("button", { name: "Confirmar acesso", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Cancelar verificação", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  release();
  await expect(dialog.getByRole("alert")).toContainText(
    "Não foi possível confirmar o acesso",
  );
  await dialog
    .getByRole("button", { name: "Cancelar verificação", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await draft.expectUnsaved();
  expect(ti.state.nativeFactors[0].status).toBe("verified");
  expect(
    ti.callsFor("DELETE /auth/v1/factors/fixture-native-factor"),
  ).toHaveLength(0);
});

test("TI email verification rejects a missing recipient and explains delivery configuration", async ({
  page,
  ti,
}) => {
  const draft = await startMaintenanceVerification(
    page,
    ti,
    "Envio de código local",
    "Não avançar com resposta incompleta.",
  );
  const dialog = draft.dialog;
  ti.replyNext("FUNCTION email-2fa:send", { ok: true });
  await dialog
    .getByRole("button", { name: "Enviar código", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Não foi possível enviar o código.",
  );
  await expect(
    dialog.getByRole("textbox", { name: "Código de verificação", exact: true }),
  ).toHaveCount(0);
  ti.replyNext(
    "FUNCTION email-2fa:send",
    { ok: false, error: "EMAIL_CONFIGURATION_REQUIRED" },
    503,
  );
  await dialog
    .getByRole("button", { name: "Enviar código", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "O envio de e-mails precisa ser configurado. Você pode usar o aplicativo de códigos para continuar.",
  );
  await draft.expectUnsaved();
});

test("native continuation never replays the TI draft after sign-out during its final bootstrap", async ({
  page,
  ti,
  context,
}) => {
  const draft = await startMaintenanceVerification(
    page,
    ti,
    "Não retomar depois de sair",
    "Interrupção durante a leitura final da conta.",
  );
  await draft.dialog
    .getByRole("button", { name: "Usar aplicativo de códigos", exact: true })
    .click();
  await draft.dialog.getByLabel("Código do aplicativo").fill("123456");
  let release: () => void = () => undefined;
  let arrived: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reached = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  await page.route("**/rest/v1/rpc/bootstrap", async (route) => {
    arrived();
    await gate;
    await route.fulfill({
      status: 200,
      json: { ready: true, recently_verified: true },
    });
  });
  await draft.dialog
    .getByRole("button", { name: "Confirmar acesso", exact: true })
    .click();
  await reached;
  const other = await context.newPage();
  try {
    await other.setViewportSize({ width: 1440, height: 1000 });
    await other.goto(tiOrigin);
    await other.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Entrar na Central/ }),
    ).toBeVisible();
    release();
    await page.waitForTimeout(300);
    expect(ti.callsFor("RPC ti_update_setting")).toHaveLength(1);
    expect(ti.state.settingWrites).toEqual([]);
  } finally {
    release();
    await other.close();
  }
});

async function startMaintenanceVerification(
  page: Page,
  ti: TiHarness,
  title: string,
  message: string,
) {
  ti.state.recentlyVerified = false;
  const original = structuredClone(ti.state.settings.maintenance);
  const payload = {
    setting_key: "maintenance",
    setting_value: {
      ...original,
      title: title.trim(),
      message: message.trim(),
    },
  };
  await ti.open();
  await ti.go("Site RH", "Controle do site");
  await page.getByRole("textbox", { name: "Título", exact: true }).fill(title);
  await page
    .getByRole("textbox", { name: "Mensagem", exact: true })
    .fill(message);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Renovar verificação",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  expect(ti.callsFor("RPC ti_update_setting").map((call) => call.body)).toEqual(
    [payload],
  );
  await expect(
    dialog.getByRole("button", { name: "Enviar código", exact: true }),
  ).toBeEnabled();
  await expect(
    dialog.getByRole("button", { name: "Cancelar verificação", exact: true }),
  ).toBeEnabled();

  async function expectUnsaved() {
    expect(ti.state.recentlyVerified).toBe(false);
    expect(ti.state.settingWrites).toEqual([]);
    expect(ti.state.settings.maintenance).toEqual(original);
    await expect(
      page.getByRole("textbox", {
        name: "Título",
        exact: true,
        includeHidden: true,
      }),
    ).toHaveValue(title);
    await expect(
      page.getByRole("textbox", {
        name: "Mensagem",
        exact: true,
        includeHidden: true,
      }),
    ).toHaveValue(message);
    await expect(
      page.getByText("Mensagem salva.", { exact: true }),
    ).toHaveCount(0);
  }
  await expectUnsaved();
  return { dialog, payload, expectUnsaved };
}

test("recent verification preserves a setting draft through send and code errors, then saves once at 320px", async ({
  page,
  ti,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const draft = await startMaintenanceVerification(
    page,
    ti,
    "  Revisão após confirmação  ",
    "  Rascunho mantido enquanto confirmo minha identidade.  ",
  );
  const { dialog } = draft;
  ti.failNext("FUNCTION email-2fa:send", 503, "EMAIL_SEND_FAILED");
  await dialog
    .getByRole("button", { name: "Enviar código", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Não foi possível enviar o código.",
  );
  await expect(
    dialog.getByRole("textbox", { name: "Código de verificação", exact: true }),
  ).toHaveCount(0);
  await draft.expectUnsaved();
  expect(ti.callsFor("RPC ti_update_setting")).toHaveLength(1);

  await dialog
    .getByRole("button", { name: "Enviar código", exact: true })
    .click();
  await expect(dialog).toContainText("op***@example.test");
  const code = dialog.getByRole("textbox", {
    name: "Código de verificação",
    exact: true,
  });
  await code.fill("000000");
  await dialog
    .getByRole("button", { name: "Verificar código", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Código inválido ou expirado.",
  );
  await expect(code).toHaveValue("000000");
  await draft.expectUnsaved();
  expect(ti.callsFor("RPC ti_update_setting")).toHaveLength(1);
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await code.fill("123456");
  await dialog
    .getByRole("button", { name: "Verificar código", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Mensagem salva.", { exact: true }),
  ).toBeVisible();
  expect(ti.state.recentlyVerified).toBe(true);
  expect(
    ti.callsFor("FUNCTION email-2fa:send").map((call) => call.body),
  ).toEqual([{ action: "send" }, { action: "send" }]);
  expect(
    ti.callsFor("FUNCTION email-2fa:verify").map((call) => call.body),
  ).toEqual([
    { action: "verify", code: "000000" },
    { action: "verify", code: "123456" },
  ]);
  expect(ti.callsFor("RPC ti_update_setting").map((call) => call.body)).toEqual(
    [draft.payload, draft.payload],
  );
  expect(ti.state.settingWrites).toEqual([draft.payload]);
  await page.reload();
  await ti.go("Site RH", "Controle do site");
  await expect(
    page.getByRole("textbox", { name: "Título", exact: true }),
  ).toHaveValue("Revisão após confirmação");
  await expect(
    page.getByRole("textbox", { name: "Mensagem", exact: true }),
  ).toHaveValue("Rascunho mantido enquanto confirmo minha identidade.");
  expect(ti.state.settingWrites).toEqual([draft.payload]);
});

test("recent verification cancellation keeps the draft unsaved until a new verified retry", async ({
  page,
  ti,
}) => {
  const draft = await startMaintenanceVerification(
    page,
    ti,
    "  Rascunho após cancelamento  ",
    "  A confirmação cancelada não publica esta mensagem.  ",
  );
  await draft.dialog
    .getByRole("button", { name: "Enviar código", exact: true })
    .click();
  await expect(
    draft.dialog.getByRole("textbox", {
      name: "Código de verificação",
      exact: true,
    }),
  ).toBeVisible();
  await draft.dialog
    .getByRole("button", { name: "Cancelar verificação", exact: true })
    .click();
  await expect(draft.dialog).toHaveCount(0);
  await draft.expectUnsaved();
  expect(ti.callsFor("FUNCTION email-2fa:verify")).toHaveLength(0);
  expect(ti.callsFor("RPC ti_update_setting")).toHaveLength(1);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(draft.dialog).toBeVisible();
  await draft.expectUnsaved();
  expect(ti.callsFor("RPC ti_update_setting")).toHaveLength(2);
  await draft.dialog
    .getByRole("button", { name: "Enviar código", exact: true })
    .click();
  await draft.dialog
    .getByRole("textbox", { name: "Código de verificação", exact: true })
    .fill("123456");
  await draft.dialog
    .getByRole("button", { name: "Verificar código", exact: true })
    .click();
  await expect(draft.dialog).toHaveCount(0);
  await expect(
    page.getByText("Mensagem salva.", { exact: true }),
  ).toBeVisible();
  expect(ti.state.recentlyVerified).toBe(true);
  expect(ti.callsFor("RPC ti_update_setting").map((call) => call.body)).toEqual(
    [draft.payload, draft.payload, draft.payload],
  );
  expect(ti.state.settingWrites).toEqual([draft.payload]);
  await ti.refresh();
  await expect(
    page.getByRole("textbox", { name: "Mensagem", exact: true }),
  ).toHaveValue("A confirmação cancelada não publica esta mensagem.");
  expect(ti.state.settingWrites).toEqual([draft.payload]);
});

test("recent verification rejects HTTP 200 ok:false responses before resuming the saved draft", async ({
  page,
  ti,
}) => {
  const draft = await startMaintenanceVerification(
    page,
    ti,
    "  Confirmação positiva obrigatória  ",
    "  Uma resposta negada não autoriza a gravação.  ",
  );
  const { dialog } = draft;
  ti.replyNext("FUNCTION email-2fa:send", { ok: false, error: "SEND_DENIED" });
  await dialog
    .getByRole("button", { name: "Enviar código", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Não foi possível enviar o código.",
  );
  await expect(
    dialog.getByRole("textbox", { name: "Código de verificação", exact: true }),
  ).toHaveCount(0);
  await draft.expectUnsaved();
  expect(ti.callsFor("RPC ti_update_setting")).toHaveLength(1);
  await dialog
    .getByRole("button", { name: "Enviar código", exact: true })
    .click();
  const code = dialog.getByRole("textbox", {
    name: "Código de verificação",
    exact: true,
  });
  await code.fill("123456");
  ti.replyNext("FUNCTION email-2fa:verify", {
    ok: false,
    error: "VERIFY_DENIED",
  });
  const bootstrapCalls = ti.callsFor("RPC bootstrap").length;
  await dialog
    .getByRole("button", { name: "Verificar código", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Código inválido ou expirado.",
  );
  await draft.expectUnsaved();
  expect(ti.callsFor("RPC bootstrap")).toHaveLength(bootstrapCalls);
  expect(ti.callsFor("RPC ti_update_setting")).toHaveLength(1);

  await dialog
    .getByRole("button", { name: "Verificar código", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Mensagem salva.", { exact: true }),
  ).toBeVisible();
  expect(ti.state.recentlyVerified).toBe(true);
  expect(ti.callsFor("RPC ti_update_setting").map((call) => call.body)).toEqual(
    [draft.payload, draft.payload],
  );
  expect(ti.state.settingWrites).toEqual([draft.payload]);
  expect(
    ti.callsFor("FUNCTION email-2fa:verify").map((call) => call.body),
  ).toEqual([
    { action: "verify", code: "123456" },
    { action: "verify", code: "123456" },
  ]);
});

test("site maintenance saves its message once, persists toggles and keeps Datasul available", async ({
  page,
  ti,
}) => {
  await ti.open();
  await ti.go("Site RH", "Controle do site");
  await page
    .getByRole("textbox", { name: "Título", exact: true })
    .fill("  Ajuste programado local  ");
  await page
    .getByRole("textbox", { name: "Mensagem", exact: true })
    .fill("  Retorno previsto após verificação.  ");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Mensagem salva.", { exact: true }),
  ).toBeVisible();
  const settingUpdates = ti.callsFor("RPC ti_update_setting");
  expect(settingUpdates).toHaveLength(1);
  const maintenanceUpdate = settingUpdates.find(
    (call) => call.body.setting_key === "maintenance",
  );
  expect(maintenanceUpdate?.body.setting_value).toMatchObject({
    enabled: false,
    allow_managers: true,
    title: "Ajuste programado local",
    message: "Retorno previsto após verificação.",
  });
  expect(settingUpdates[0].body.setting_key).toBe("maintenance");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Ativar manutenção", exact: true })
    .click();
  await expect(
    page.getByText("Estado de manutenção atualizado.", { exact: true }),
  ).toBeVisible();
  expect(ti.state.settings.maintenance).toMatchObject({
    enabled: true,
    allow_managers: true,
    ended_at: null,
  });
  expect(ti.state.settings.maintenance.started_at).toEqual(expect.any(String));
  await page.reload();
  await ti.go("Site RH", "Controle do site");
  await expect(
    page.getByRole("textbox", { name: "Título", exact: true }),
  ).toHaveValue("Ajuste programado local");
  await expect(
    page.getByRole("button", { name: "Desativar manutenção", exact: true }),
  ).toBeVisible();
  await ti.go("Datasul", "Datasul RH");
  await expect(page.locator(".datasul-maintenance-banner")).toContainText(
    "Ajuste programado local",
  );
  await page
    .getByRole("button", { name: "Gerenciar manutenção", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Desativar manutenção", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ativar manutenção", exact: true }),
  ).toBeVisible();
  expect(ti.state.settings.maintenance).toMatchObject({
    enabled: false,
    started_at: null,
    ended_at: expect.any(String),
  });
});

test("cancelling maintenance does not mutate settings or announce an update", async ({
  page,
  ti,
}) => {
  await ti.open();
  await ti.go("Site RH", "Controle do site");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Ativar manutenção", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Atualizar dados" }),
  ).toBeEnabled();
  expect(ti.callsFor("RPC ti_update_setting")).toHaveLength(0);
  expect(ti.state.settings.maintenance.enabled).toBe(false);
  await expect(
    page.getByText("Estado de manutenção atualizado.", { exact: true }),
  ).toHaveCount(0);
});

test("security shows granted permissions and sessions can be revoked without affecting the current one", async ({
  page,
  ti,
}) => {
  await ti.open();
  await ti.go("Segurança");
  await expect(
    page.getByRole("heading", { name: "Camada de segurança", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".permission-cloud")).toContainText(
    "ti.security.view",
  );
  await expect(page.locator(".permission-cloud code")).toHaveCount(
    ti.state.permissions.length,
  );
  await openPersonSessions(page, ti);
  expect(ti.callsFor("RPC my_sessions")[0].body).toEqual({
    target_user: personId,
  });
  const current = page
    .locator(".session-row")
    .filter({ hasText: "Sessão atual" });
  await expect(current.getByRole("button", { name: "Revogar" })).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Revogar", exact: true }).click();
  await expect(
    page.getByText("Sessão revogada.", { exact: true }),
  ).toBeVisible();
  expect(ti.callsFor("RPC revoke_session")[0].body).toEqual({
    session_identifier: remoteSessionId,
  });
  await expect(
    page.locator(".session-row").filter({ hasText: "40000000" }),
  ).toContainText("Revogada");
  await expect(current).toContainText("Ativa");
  await expect(
    page.getByRole("button", { name: "Revogar", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await openPersonSessions(page, ti);
  await expect(
    page.locator(".session-row").filter({ hasText: "40000000" }),
  ).toContainText("Revogada");
});

test("cancelling session revocation keeps it active and does not announce success", async ({
  page,
  ti,
}) => {
  await ti.open();
  await openPersonSessions(page, ti);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Revogar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Atualizar dados" }),
  ).toBeEnabled();
  expect(ti.callsFor("RPC revoke_session")).toHaveLength(0);
  await expect(
    page.locator(".session-row").filter({ hasText: "40000000" }),
  ).toContainText("Ativa");
  await expect(page.getByText("Sessão revogada.", { exact: true })).toHaveCount(
    0,
  );
});

test("support status errors preserve the ticket and successful transitions update summary and history", async ({
  page,
  ti,
}) => {
  await ti.open();
  await ti.go("Chamados T.I.", "Chamados de T.I.");
  const status = page.getByRole("combobox", {
    name: "Status do chamado Falha ao abrir relatório",
  });
  await page.locator(".ticket-card summary").click();
  await expect(
    page.getByRole("region", { name: "Contexto técnico do chamado" }),
  ).toContainText("390x844");
  ti.failNext("REST PATCH ti_support_tickets");
  await status.selectOption("in_progress");
  await expect(page.locator(".notice.error")).toBeVisible();
  await expect(status).toHaveValue("open");
  expect(ti.state.tickets[0].status).toBe("open");
  await status.selectOption("in_progress");
  await expect(
    page.getByText("Chamado atualizado.", { exact: true }),
  ).toBeVisible();
  await expect(status).toHaveValue("in_progress");
  await expect(
    page
      .locator(".support-summary .stat-card")
      .filter({ hasText: "Em andamento" })
      .locator("strong"),
  ).toHaveText("1");
  const request = ti.callsFor("REST PATCH ti_support_tickets").at(-1)!;
  expect(request.body).toEqual({ status: "in_progress" });
  expect(new URL(request.url).searchParams.get("id")).toBe("eq." + ticketId);
  await page.reload();
  await ti.go("Chamados T.I.", "Chamados de T.I.");
  await expect(status).toHaveValue("in_progress");
  await status.selectOption("resolved");
  await expect(status).toHaveValue("resolved");
  await expect(
    page
      .locator(".support-summary .stat-card")
      .filter({ hasText: "Resolvidos" })
      .locator("strong"),
  ).toHaveText("1");
  await ti.go("Histórico de atividades");
  const activity = page
    .getByRole("list", { name: "Atividades do site" })
    .locator("li")
    .first();
  await activity.locator("summary").click();
  await expect(activity).toContainText("Em andamento");
  await expect(activity).toContainText("Resolvido");
});

function expectInternalDatasulOnly(ti: TiHarness) {
  expect(
    ti.calls.filter(
      (call) => new URL(call.url).pathname === "/functions/v1/datasul-bridge",
    ),
  ).toHaveLength(0);
}

test("internal Datasul filters its own people by sector and refreshes native data", async ({
  page,
  ti,
}) => {
  ti.state.employees[0].department_id = departmentId;
  ti.state.employees.push({
    ...ti.state.employees[0],
    id: "30000000-0000-4000-8000-000000000013",
    profile_id: null,
    full_name: "Pessoa sem área",
    registration: "FIX-002",
    department_id: null,
    class_id: null,
    status: "inactive",
  });
  await ti.open();
  await ti.go("Datasul", "Datasul RH");
  await expect(
    page.getByRole("heading", {
      name: "O Datasul do Raízes, organizado por área.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".datasul-command-status")).toContainText(
    "Dados disponíveis",
  );
  await expect(
    page.getByRole("heading", { name: "Console de API", exact: true }),
  ).toHaveCount(0);
  const table = page.getByRole("region", {
    name: "Tabela do Datasul",
    exact: true,
  });
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table).toContainText("Tecnologia");
  await expect(table).toContainText("Turma Local");
  await expect(table).toContainText("Sem setor");
  await expect(table).toContainText("Sem turma");
  await expect(table).toContainText("Inativo");
  const cards = page.locator(".datasul-pulse-card");
  await expect(
    cards.filter({ hasText: "PESSOAS" }).locator("strong"),
  ).toHaveText("2");
  await expect(
    cards.filter({ hasText: "SETORES" }).locator("strong"),
  ).toHaveText("1");
  await expect(
    cards.filter({ hasText: "TURMAS" }).locator("strong"),
  ).toHaveText("1");
  await expect(
    cards.filter({ hasText: "CHAMADAS" }).locator("strong"),
  ).toHaveText("4");
  const area = page.getByRole("combobox", {
    name: "Área do Datasul",
    exact: true,
  });
  await area.selectOption(departmentId);
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).not.toContainText("Pessoa sem área");
  await expect(
    cards.filter({ hasText: "PESSOAS" }).locator("strong"),
  ).toHaveText("1");
  await area.selectOption("");
  await expect(table.getByRole("row")).toHaveCount(3);
  const before = ti.callsFor("REST GET employees").length;
  ti.state.employees[0].full_name = "Pessoa da área atualizada";
  await ti.refresh();
  expect(ti.callsFor("REST GET employees").length).toBeGreaterThan(before);
  await expect(table).toContainText("Pessoa da área atualizada");
  await page.reload();
  await ti.go("Datasul", "Datasul RH");
  await expect(table).toContainText("Pessoa da área atualizada");
  expectInternalDatasulOnly(ti);
});

test("internal Datasul denies catalog consultation without employee.view despite successful own-row queries", async ({
  page,
  ti,
}) => {
  ti.state.permissions = ["ti.view", "ti.datasul.read"];
  const ownEmployee = {
    ...ti.state.employees[0],
    id: "30000000-0000-4000-8000-000000000013",
    profile_id: ownerId,
    full_name: "Operadora TI",
    email: "operator@example.test",
    registration: "FIX-SELF",
  };
  ti.state.employees.push(ownEmployee);
  const employeeResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/rest/v1/employees" &&
      response.status() === 200,
  );
  await ti.open();
  expect(await (await employeeResponse).json()).toEqual([ownEmployee]);
  await ti.go("Datasul", "Datasul RH");
  await expect(page.getByRole("alert")).toHaveText(
    "Esta conta não tem permissão para consultar os cadastros do Datasul.",
  );
  await expect(page.locator(".datasul-command-status")).toContainText(
    "Permissão de consulta necessária",
  );
  await expect(page.locator(".datasul-command-status")).not.toContainText(
    "Dados disponíveis",
  );
  await expect(
    page.getByRole("region", { name: "Tabela do Datasul", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Área do Datasul", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Editar pessoa", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".datasul-pulse-card strong")).toHaveText([
    "Indisponível",
    "Indisponível",
    "Indisponível",
    "Indisponível",
  ]);
  await ti.refresh();
  await expect(page.getByRole("alert")).toHaveText(
    "Esta conta não tem permissão para consultar os cadastros do Datasul.",
  );
  expectInternalDatasulOnly(ti);
});

test("internal Datasul separates read access from the permission to edit a person", async ({
  page,
  ti,
}) => {
  ti.state.permissions = ["ti.view"];
  await ti.open();
  const navigation = page.getByRole("navigation", {
    name: "Navegação principal da Central T.I.",
  });
  await expect(
    navigation.getByRole("button", { name: "Datasul", exact: true }),
  ).toHaveCount(0);
  ti.state.permissions.push("ti.datasul.read", "employee.view");
  await page.reload();
  await ti.go("Datasul", "Datasul RH");
  await expect(
    page.getByRole("region", { name: "Tabela do Datasul", exact: true }),
  ).toContainText("Pessoa de Teste");
  await expect(
    page.getByRole("button", { name: "Editar pessoa", exact: true }),
  ).toHaveCount(0);
  await expect(
    navigation.getByRole("button", { name: "Dados do RH", exact: true }),
  ).toHaveCount(0);
  ti.state.permissions.push("employee.manage");
  await page.reload();
  await ti.go("Datasul", "Datasul RH");
  await page
    .getByRole("button", { name: "Editar pessoa", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dados do RH", level: 1, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Nome", exact: true }),
  ).toHaveValue("Pessoa de Teste");
  await page
    .getByRole("textbox", { name: "Nome", exact: true })
    .fill("Pessoa editada no Datasul");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Cadastro atualizado.", { exact: true }),
  ).toBeVisible();
  expect(ti.callsFor("RPC save_entity")[0].body).toMatchObject({
    entity: "employees",
    expected_version: 7,
    payload: { id: employeeId, full_name: "Pessoa editada no Datasul" },
  });
  await ti.go("Datasul", "Datasul RH");
  await expect(
    page.getByRole("region", { name: "Tabela do Datasul", exact: true }),
  ).toContainText("Pessoa editada no Datasul");
  await page.reload();
  await ti.go("Datasul", "Datasul RH");
  await expect(
    page.getByRole("region", { name: "Tabela do Datasul", exact: true }),
  ).toContainText("Pessoa editada no Datasul");
  expectInternalDatasulOnly(ti);
});

test("internal Datasul reports native query failures and restores each dataset on refresh", async ({
  page,
  ti,
}) => {
  await ti.open();
  await ti.go("Datasul", "Datasul RH");
  for (const key of [
    "REST GET employees",
    "REST GET departments",
    "REST GET classes",
    "RPC ti_snapshot",
  ]) {
    const recover = ti.failUntilCleared(key, 403);
    await ti.refresh();
    await expect(page.locator(".datasul-command-status")).toContainText(
      "Carregamento incompleto",
    );
    await expect(page.getByRole("alert")).toContainText(
      "Não foi possível carregar todos os dados desta área.",
    );
    await expect(
      page.getByRole("region", { name: "Tabela do Datasul", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".datasul-pulse-card strong")).toHaveText([
      "Indisponível",
      "Indisponível",
      "Indisponível",
      "Indisponível",
    ]);
    recover();
    await ti.refresh();
    await expect(page.locator(".datasul-command-status")).toContainText(
      "Dados disponíveis",
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Tabela do Datasul", exact: true }),
    ).toContainText("Pessoa de Teste");
  }
  expectInternalDatasulOnly(ti);
});

test("all twelve authenticated panels fit mobile, tablet and desktop without page overflow", async ({
  page,
  ti,
}) => {
  test.setTimeout(90_000);
  await ti.open();
  const panels = [
    ["Visão geral", "Visão geral"],
    ["Datasul", "Datasul RH"],
    ["Usuários e acessos", "Usuários e acessos"],
    ["Dados do RH", "Dados do RH"],
    ["Arquivos e Storage", "Arquivos e Storage"],
    ["Notificações", "Notificações"],
    ["Banco de dados", "Banco de dados"],
    ["GitHub e Vercel", "GitHub e Vercel"],
    ["Site RH", "Controle do site"],
    ["Segurança", "Segurança"],
    ["Chamados T.I.", "Chamados de T.I."],
    ["Histórico de atividades", "Histórico de atividades"],
  ];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [label, title] of panels) {
      await ti.go(label, title);
      if (label === "Histórico de atividades") {
        const list = page.getByRole("list", { name: "Atividades do site" });
        const summary = list.locator("summary").first();
        if (
          !(await summary.evaluate((element) =>
            element.parentElement?.hasAttribute("open"),
          ))
        )
          await summary.click();
        await expect(list).toContainText("O que mudou");
        await expect(list).not.toContainText(
          /old_values|new_values|VERSION_CONFLICT/,
        );
      }
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        elements: [...document.querySelectorAll("body *")]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              className: element.className,
              right: rect.right,
              width: rect.width,
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            };
          })
          .filter((element) => element.right > window.innerWidth + 1)
          .slice(0, 30),
      }));
      if (dimensions.documentWidth > dimensions.viewport) {
        await test.info().attach(`overflow-${label}-${width}`, {
          body: JSON.stringify(dimensions, null, 2),
          contentType: "application/json",
        });
      }
      await expect
        .configure({ soft: true })
        .poll(
          () =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          { message: `${label} overflows at ${width}px` },
        )
        .toBe(true);
    }
  }
});
