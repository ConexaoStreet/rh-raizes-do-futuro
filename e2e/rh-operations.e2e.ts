import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import JSZip from "jszip";

// Browser contract tests only: every Supabase request is answered by this
// mutable, per-test fixture. SQL constraints and RLS require separate tests.
const apiOrigin = "http://127.0.0.1:54321";
const owner = "31000000-0000-4000-8000-000000000001";
const employee = "31000000-0000-4000-8000-000000000002";
const classA = "31000000-0000-4000-8000-000000000003";
const classB = "31000000-0000-4000-8000-000000000004";
const sessionId = "31000000-0000-4000-8000-000000000005";
const serverTime = "2026-10-13T12:00:00Z";
const day = "2026-10-13";
const permissions = [
  "dashboard.view",
  "employee.view",
  "attendance.view",
  "attendance.manage",
  "attendance.maintenance",
  "calendar.view",
  "calendar.manage",
  "report.view",
  "report.export",
];
type JsonObject = Record<string, unknown>;
type ApiCall = { path: string; method: string; url: URL; body: JsonObject };
type Member = {
  id: string;
  employee_id: string;
  session_id: string;
  full_name_snapshot: string;
  registration_snapshot: string;
  status: string;
  version: number;
  delay_minutes: number;
  actual_arrival: string | null;
  actual_departure: string | null;
  notes: string;
};
type AttendanceRow = {
  id: string;
  class_id: string;
  scheduled_date: string;
  original_member_count: number;
  status: string;
};
type CalendarRow = {
  id: string;
  class_id: string | null;
  scheduled_date: string;
  has_course: boolean;
  kind: string;
  reason: string;
  version: number;
};
type MaintenanceRow = {
  id: string;
  session_id: string;
  reason: string;
  opened_at: string;
  closed_at: string | null;
};
type Upload = { path: string; bytes: Buffer; mime: string; upsert: string };
type ExportRow = {
  id: string;
  path: string;
  format: string;
  created_at: string;
  reports: JsonObject;
};
type Fixture = {
  permissions: string[];
  recentlyVerified: boolean;
  canOpen: boolean;
  hasCourse: boolean;
  calls: ApiCall[];
  failures: Map<string, { message: string; status: number }>;
  unexpected: string[];
  sessions: AttendanceRow[];
  members: Member[];
  maintenance: MaintenanceRow[];
  calendar: CalendarRow[];
  reports: JsonObject[];
  uploads: Upload[];
  exports: ExportRow[];
  securityResponses: { status: number; body: JsonObject }[];
};
const fixtures = new WeakMap<Page, Fixture>();

test.afterEach(async ({ page }) => {
  expect(
    fixtures.get(page)?.unexpected || [],
    "All backend requests are explicitly mocked",
  ).toEqual([]);
});

function fixture(): Fixture {
  return {
    permissions: [...permissions],
    recentlyVerified: true,
    canOpen: true,
    hasCourse: true,
    calls: [],
    failures: new Map(),
    unexpected: [],
    sessions: [],
    members: ["Ana Auditoria", "Bruno Auditoria", "Carla Auditoria"].map(
      (name, index) => ({
        id: `31000000-0000-4000-8000-${String(index + 11).padStart(12, "0")}`,
        employee_id:
          index === 0
            ? employee
            : `31000000-0000-4000-8000-${String(index + 21).padStart(12, "0")}`,
        session_id: sessionId,
        full_name_snapshot: name,
        registration_snapshot: `AUD-${index + 1}`,
        status: "pending",
        version: 1,
        delay_minutes: 0,
        actual_arrival: null,
        actual_departure: null,
        notes: "",
      }),
    ),
    maintenance: [],
    calendar: [
      {
        id: "calendar-general",
        class_id: null,
        scheduled_date: day,
        has_course: false,
        kind: "holiday",
        reason: "Feriado geral da auditoria",
        version: 2,
      },
      {
        id: "calendar-class-a",
        class_id: classA,
        scheduled_date: day,
        has_course: true,
        kind: "replacement",
        reason: "Reposicao da turma A",
        version: 4,
      },
    ],
    reports: [],
    uploads: [],
    exports: [],
    securityResponses: [],
  };
}

function seedSession(state: Fixture, status = "editing") {
  state.sessions = [
    {
      id: sessionId,
      class_id: classA,
      scheduled_date: day,
      original_member_count: state.members.length,
      status,
    },
  ];
}

function rpcCalls(state: Fixture, name: string) {
  return state.calls.filter((call) => call.path === `/rest/v1/rpc/${name}`);
}

function reportSnapshot(args: JsonObject) {
  const records = Array.from({ length: 27 }, (_, i) => ({
    employee_id: i === 0 ? employee : `export-person-${i + 1}`,
    class_id: classA,
    date: day,
    class_name: "Turma Auditoria A",
    name: i === 0 ? "Ana Auditoria" : `Pessoa Exportacao ${i + 1}`,
    registration: `AUD-EXPORT-${String(i + 1).padStart(2, "0")}`,
    status: ["present", "late", "absent", "justified"][i] || "present",
    actual_arrival: i === 1 ? "08:15:00" : null,
    delay_minutes: i === 1 ? 15 : 0,
    maintenance_count: i === 0 ? 2 : 0,
  })).filter(
    (record) =>
      record.date >= String(args.period_start) &&
      record.date <= String(args.period_end) &&
      (!args.employee_identifier ||
        record.employee_id === args.employee_identifier) &&
      (!args.class_identifier || record.class_id === args.class_identifier),
  );
  const absent = records.filter((r) =>
    ["absent", "justified"].includes(r.status),
  );
  const present = records.length - absent.length;
  const late = records.filter((r) => r.delay_minutes > 0).length;
  const justified = records.filter((r) => r.status === "justified").length;
  const metrics = {
    employees: 27,
    active_employees: 27,
    records: records.length,
    pending: 0,
    present,
    absent: absent.length,
    justified,
    unjustified: absent.length - justified,
    late,
    delay_total: late * 15,
    delay_average: late ? 15 : null,
    attendance_rate: records.length ? (present / records.length) * 100 : null,
    punctuality_rate: present ? ((present - late) / present) * 100 : null,
    performance_average: 8.5,
    feedback_count: 2,
  };
  return {
    period_start: args.period_start,
    period_end: args.period_end,
    generated_at: serverTime,
    metrics,
    previous: { ...metrics, present: 10, absent: 3, feedback_count: 1 },
    series: records.length
      ? [{ month: "2026-10", present, absent: absent.length, justified, late }]
      : [],
    records,
    grades: [],
    feedbacks: [],
  };
}

function filterRows<T extends { [key: string]: unknown }>(rows: T[], url: URL) {
  return rows.filter((row) =>
    [...url.searchParams.entries()].every(([key, value]) => {
      if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
      if (value.startsWith("gte.")) return String(row[key]) >= value.slice(4);
      if (value.startsWith("lt.")) return String(row[key]) < value.slice(3);
      return true;
    }),
  );
}

function uploadedFile(body: Buffer, contentType: string) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType);
  if (!boundary) return { bytes: body, mime: contentType };
  const fileHeader = body.indexOf('filename="blob"');
  expect(
    fileHeader,
    "Storage multipart body contains its actual Blob",
  ).toBeGreaterThan(0);
  const start = body.indexOf("\r\n\r\n", fileHeader) + 4;
  const end = body.indexOf(`\r\n--${boundary[1] || boundary[2]}`, start);
  const header = body.subarray(fileHeader, start).toString("utf8");
  expect(end).toBeGreaterThan(start);
  return {
    bytes: body.subarray(start, end),
    mime: /Content-Type: ([^\r\n]+)/i.exec(header)?.[1] || "",
  };
}

async function setup(page: Page, state = fixture()) {
  fixtures.set(page, state);
  await page.clock.setFixedTime(new Date(serverTime));
  await page.addInitScript(
    ({ owner, sessionId }) => {
      sessionStorage.setItem("raizes-inauguracao-2026-09-29", "1");
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const encode = (value: unknown) =>
        btoa(JSON.stringify(value))
          .replaceAll("=", "")
          .replaceAll("+", "-")
          .replaceAll("/", "_");
      const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: owner, aud: "authenticated", role: "authenticated", session_id: sessionId, exp })}.c2lnbmF0dXJl`;
      localStorage.setItem(
        "sb-127-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "rh-operations-test-refresh",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: owner,
            aud: "authenticated",
            role: "authenticated",
            email: "rh-audit@example.test",
            app_metadata: {},
            user_metadata: {},
            created_at: "2026-10-01T00:00:00Z",
          },
        }),
      );
    },
    { owner, sessionId },
  );
  // No request can reach a cloud backend, telemetry service, or email provider.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === apiOrigin) return route.fallback();
    if (url.origin === "http://127.0.0.1:4173") return route.continue();
    return route.abort();
  });
  await page.routeWebSocket("**/*", (socket) => socket.close());
  await page.route(`${apiOrigin}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const body = request.headers()["content-type"]?.includes("application/json")
      ? (request.postDataJSON() as JsonObject)
      : {};
    state.calls.push({ path, method: request.method(), url, body });
    const failure = state.failures.get(path);
    if (failure) {
      await route.fulfill({
        status: failure.status,
        json: { message: failure.message, code: "P0001" },
      });
      return;
    }
    let response: unknown = [];
    let known = true;
    if (path === "/functions/v1/email-2fa") {
      const reply = state.securityResponses.shift();
      if (!reply) {
        state.unexpected.push(`${request.method()} ${path}`);
        await route.fulfill({
          status: 500,
          json: { error: "UNEXPECTED_FIXTURE_REQUEST" },
        });
        return;
      }
      await route.fulfill({ status: reply.status, json: reply.body });
      return;
    } else if (path.endsWith("/rpc/bootstrap")) {
      response = {
        profile: {
          id: owner,
          full_name: "Gestora Auditoria",
          status: "active",
          onboarded_at: "2026-10-01",
          photo_path: null,
        },
        roles: ["MANAGER"],
        permissions: state.permissions,
        privileged: true,
        mfa_required: false,
        mfa_verified: true,
        recently_verified: state.recentlyVerified,
        ready: true,
        server_time: serverTime,
        employee_id: employee,
        maintenance: { enabled: false },
      };
    } else if (path.endsWith("/rpc/site_status")) {
      response = {
        maintenance: { enabled: false },
        updates: [],
        server_time: serverTime,
      };
    } else if (path.endsWith("/rpc/public_status")) {
      response = { maintenance: false };
    } else if (path.endsWith("/rpc/dashboard_snapshot")) {
      response = reportSnapshot({
        period_start: "2026-10-01",
        period_end: day,
      });
    } else if (path.endsWith("/notifications")) {
      response = [];
    } else if (path.endsWith("/classes")) {
      response = [
        { id: classA, name: "Turma Auditoria A", active: true },
        { id: classB, name: "Turma Auditoria B", active: true },
      ];
    } else if (path.endsWith("/employees")) {
      response = [
        { id: employee, full_name: "Ana Auditoria", status: "active" },
      ];
    } else if (path.endsWith("/manager_review_cycles")) {
      response = [];
    } else if (path.endsWith("/attendance_sessions")) {
      const rows = filterRows(state.sessions, url);
      response = request.headers().accept?.includes("vnd.pgrst.object")
        ? rows[0]
        : rows;
    } else if (path.endsWith("/attendance_members")) {
      response = filterRows(state.members, url);
    } else if (path.endsWith("/attendance_maintenance")) {
      response = filterRows(state.maintenance, url);
    } else if (path.endsWith("/rpc/course_status")) {
      response = {
        server_time: serverTime,
        has_course: state.hasCourse,
        can_open: state.canOpen,
      };
    } else if (path.endsWith("/rpc/open_attendance")) {
      seedSession(state);
      state.sessions[0].class_id = String(body.class_identifier);
      response = sessionId;
    } else if (path.endsWith("/rpc/save_attendance")) {
      const changes = body.changes as JsonObject[];
      for (const change of changes) {
        const member = state.members.find((m) => m.id === change.id)!;
        if (member.version !== change.version) {
          await route.fulfill({ status: 409, json: { message: "CONFLICT" } });
          return;
        }
      }
      for (const change of changes) {
        const member = state.members.find((m) => m.id === change.id)!;
        Object.assign(member, change, { version: member.version + 1 });
        member.delay_minutes = member.actual_arrival
          ? Math.max(
              0,
              Number(member.actual_arrival.slice(0, 2)) * 60 +
                Number(member.actual_arrival.slice(3, 5)) -
                480,
            )
          : 0;
      }
      response = { saved: changes.length, server_time: serverTime };
    } else if (path.endsWith("/rpc/finalize_attendance")) {
      state.sessions[0].status = "finalized";
      response = null;
    } else if (path.endsWith("/rpc/start_maintenance")) {
      state.sessions[0].status = "maintenance";
      state.maintenance.unshift({
        id: "maintenance-1",
        session_id: sessionId,
        reason: String(body.reason),
        opened_at: serverTime,
        closed_at: null,
      });
      response = "maintenance-1";
    } else if (path.endsWith("/rpc/end_maintenance")) {
      state.sessions[0].status = "finalized";
      state.maintenance[0].closed_at = serverTime;
      response = null;
    } else if (path.endsWith("/course_calendar")) {
      response = filterRows(state.calendar, url);
    } else if (path.endsWith("/events")) {
      response = filterRows(
        [
          {
            id: "event-general",
            title: "Encontro geral",
            event_date: day,
            class_id: null,
          },
          {
            id: "event-a",
            title: "Encontro da turma A",
            event_date: day,
            class_id: classA,
          },
          {
            id: "event-b",
            title: "Encontro da turma B",
            event_date: day,
            class_id: classB,
          },
        ],
        url,
      );
    } else if (path.endsWith("/rpc/save_entity")) {
      const payload = body.payload as CalendarRow;
      const previous = state.calendar.find((entry) => entry.id === payload.id);
      const entry = {
        ...payload,
        id: previous?.id || `calendar-${state.calendar.length + 1}`,
        version: (previous?.version || 0) + 1,
      };
      if (previous) Object.assign(previous, entry);
      else state.calendar.push(entry);
      response = entry;
    } else if (path.endsWith("/rpc/import_calendar")) {
      const rows = body.rows as CalendarRow[];
      state.calendar.push(
        ...rows.map((row, i) => ({ ...row, id: `import-${i}`, version: 1 })),
      );
      response = rows.length;
    } else if (path.endsWith("/rpc/report_snapshot")) {
      response = reportSnapshot(body);
    } else if (path.endsWith("/rpc/register_report")) {
      const id = `report-${state.reports.length + 1}`;
      state.reports.push({ ...(body.payload as JsonObject), id });
      response = id;
    } else if (path === "/auth/v1/user") {
      response = {
        id: owner,
        aud: "authenticated",
        role: "authenticated",
        email: "rh-audit@example.test",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-10-01T00:00:00Z",
      };
    } else if (path.startsWith("/storage/v1/object/exports/")) {
      const file = uploadedFile(
        request.postDataBuffer()!,
        request.headers()["content-type"],
      );
      const filePath = path.replace("/storage/v1/object/exports/", "");
      state.uploads.push({
        ...file,
        path: filePath,
        upsert: request.headers()["x-upsert"],
      });
      response = {
        Id: `upload-${state.uploads.length}`,
        Key: `exports/${filePath}`,
      };
    } else if (path.endsWith("/rpc/register_export")) {
      state.exports.push({
        id: `export-${state.exports.length + 1}`,
        path: String(body.file_path),
        format: String(body.format_name),
        created_at: serverTime,
        reports: state.reports.find(
          (report) => report.id === body.report_identifier,
        )!,
      });
      response = state.exports[state.exports.length - 1].id;
    } else if (path.endsWith("/report_exports")) {
      response = state.exports;
    } else {
      known = false;
      state.unexpected.push(`${request.method()} ${path}`);
    }
    const count = Array.isArray(response) ? response.length : 1;
    await route.fulfill({
      status: known ? 200 : 501,
      headers: {
        "Content-Range": `0-${Math.max(0, count - 1)}/${count}`,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Content-Range",
      },
      json: response ?? null,
    });
  });
  return state;
}

function person(page: Page, name: string) {
  return page.locator(".attendance-row").filter({ hasText: name });
}

async function openSeededSession(page: Page, state: Fixture) {
  await setup(page, state);
  await page.goto(`/#/chamada?chamada=${sessionId}`);
  await expect(
    page.getByRole("heading", { name: "Chamada · 13/10/2026" }),
  ).toBeVisible();
}

async function downloadedBytes(download: Download) {
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path!);
}

function assertPdfStructure(bytes: Buffer) {
  const pdf = bytes.toString("latin1");
  expect(pdf).toMatch(/^%PDF-1\.[3-7]/);
  const xref = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(pdf);
  expect(xref, "PDF has a terminal cross-reference pointer").not.toBeNull();
  expect(pdf.slice(Number(xref![1]), Number(xref![1]) + 4)).toBe("xref");
  const table = /^xref\s+0 (\d+)\s+([\s\S]*?)trailer/.exec(
    pdf.slice(Number(xref![1])),
  );
  expect(table).not.toBeNull();
  const entries = table![2].trim().split(/\r?\n/);
  expect(entries).toHaveLength(Number(table![1]));
  for (let object = 1; object < entries.length; object++) {
    const offset = Number(entries[object].slice(0, 10));
    expect(pdf.slice(offset, offset + 64)).toMatch(
      new RegExp(`^${object} 0 obj\\b`),
    );
  }
  const root = /\/Root (\d+) 0 R/.exec(pdf);
  expect(root).not.toBeNull();
  const catalog = new RegExp(`${root![1]} 0 obj\\b[\\s\\S]*?endobj`).exec(
    pdf,
  )?.[0];
  expect(catalog).toContain("/Type /Catalog");
  const pages = /\/Type \/Pages\s*[\s\S]*?\/Count (\d+)/.exec(pdf);
  const actualPages = [...pdf.matchAll(/\/Type \/Page\b/g)].length;
  expect(actualPages).toBeGreaterThanOrEqual(3);
  expect(Number(pages?.[1])).toBe(actualPages);
  return pdf;
}

function pdfText(pdf: string) {
  return [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)]
    .map((match) => match[1].replace(/\\([\\()])/g, "$1"))
    .join(" ");
}

test("attendance opens, versions saved changes, finalizes, and remains read-only after reload", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/#/chamada");
  await page
    .getByRole("button", { name: "Abrir chamada", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Chamada · 13/10/2026" }),
  ).toBeVisible();
  expect(rpcCalls(state, "open_attendance").map((call) => call.body)).toEqual([
    { class_identifier: classA },
  ]);
  await page
    .getByRole("button", { name: "Presente: Ana Auditoria", exact: true })
    .click();
  await expect(person(page, "Ana Auditoria").locator(".badge")).toHaveText(
    "Presente",
  );
  expect(rpcCalls(state, "save_attendance")[0].body).toEqual({
    session_identifier: sessionId,
    changes: [
      {
        id: state.members[0].id,
        version: 1,
        status: "present",
        actual_arrival: null,
        actual_departure: null,
      },
    ],
  });
  await page
    .getByRole("button", { name: "Detalhes: Bruno Auditoria", exact: true })
    .click();
  const detail = page.getByRole("dialog", { name: "Bruno Auditoria" });
  await detail.getByLabel("Presença", { exact: true }).selectOption("late");
  await detail.getByLabel("Entrada real").fill("08:15");
  await detail.getByLabel("Saída real").fill("12:10");
  await detail
    .getByLabel("Observação")
    .fill("Transporte atrasou durante a auditoria");
  await detail.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(detail).toHaveCount(0);
  await expect(person(page, "Bruno Auditoria")).toContainText(
    "15 min de atraso",
  );
  expect(rpcCalls(state, "save_attendance")[1].body.changes).toEqual([
    {
      id: state.members[1].id,
      version: 1,
      status: "late",
      actual_arrival: "08:15",
      actual_departure: "12:10",
      notes: "Transporte atrasou durante a auditoria",
    },
  ]);
  await page.getByLabel("Buscar na chamada").fill("AUD-2");
  await expect(page.locator(".attendance-row")).toHaveCount(1);
  await page.getByLabel("Buscar na chamada").fill("");
  await page.getByLabel("Filtrar presença").selectOption("late");
  await expect(page.locator(".attendance-row")).toHaveCount(1);
  await page.getByLabel("Filtrar presença").selectOption("");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe(
      "Marcar 1 registros não preenchidos como presentes?",
    );
    await dialog.accept();
  });
  await page
    .getByRole("button", { name: "Marcar pendentes como presentes" })
    .click();
  await expect(page.locator(".attendance-progress")).toContainText(
    "3 de 3 registros preenchidos",
  );
  expect(rpcCalls(state, "save_attendance")[2].body.changes).toEqual([
    { id: state.members[2].id, version: 1, status: "present" },
  ]);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Finalizar chamada", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Finalizar chamada" }),
  ).toHaveCount(0);
  expect(rpcCalls(state, "finalize_attendance")[0].body).toEqual({
    session_identifier: sessionId,
    reason: null,
  });
  await page.goto(`/#/presenca?chamada=${sessionId}`);
  await page.reload();
  await expect(page.locator(".page-heading .badge")).toHaveText("Finalizada");
  await expect(person(page, "Bruno Auditoria")).toContainText("08:15");
  await person(page, "Bruno Auditoria")
    .getByRole("button", { name: "Detalhes", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByLabel("Observação")).toHaveValue(
    "Transporte atrasou durante a auditoria",
  );
  await expect(
    page.getByRole("dialog").getByLabel("Presença", { exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Salvar", exact: true }),
  ).toHaveCount(0);
  expect(state.unexpected).toEqual([]);
});

test("attendance finalization with pending members is cancelled or sends the entered reason", async ({
  page,
}) => {
  const state = fixture();
  seedSession(state);
  await openSeededSession(page, state);
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("prompt");
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Finalizar chamada" }).click();
  expect(rpcCalls(state, "finalize_attendance")).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Finalizar chamada" }),
  ).toBeVisible();
  page.once("dialog", (dialog) =>
    dialog.accept("Registros pendentes revisados pelo RH"),
  );
  await page.getByRole("button", { name: "Finalizar chamada" }).click();
  await expect(
    page.getByRole("button", { name: "Finalizar chamada" }),
  ).toHaveCount(0);
  expect(rpcCalls(state, "finalize_attendance")[0].body).toEqual({
    session_identifier: sessionId,
    reason: "Registros pendentes revisados pelo RH",
  });
});

test("attendance save conflicts reload the server version and can be retried without false persistence", async ({
  page,
}) => {
  const state = fixture();
  seedSession(state);
  await openSeededSession(page, state);
  state.members[0].version = 2;
  state.members[0].status = "absent";
  await page
    .getByRole("button", { name: "Presente: Ana Auditoria", exact: true })
    .click();
  await expect(
    page.getByText("Este registro mudou. Atualize a página antes de salvar.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(person(page, "Ana Auditoria").locator(".badge")).toHaveText(
    "Falta",
  );
  expect(state.members[0].status).toBe("absent");
  expect(rpcCalls(state, "save_attendance")[0].body.changes).toEqual([
    {
      id: state.members[0].id,
      version: 1,
      status: "present",
      actual_arrival: null,
      actual_departure: null,
    },
  ]);
  await page
    .getByRole("button", { name: "Presente: Ana Auditoria", exact: true })
    .click();
  await expect(person(page, "Ana Auditoria").locator(".badge")).toHaveText(
    "Presente",
  );
  expect(
    (rpcCalls(state, "save_attendance")[1].body.changes as JsonObject[])[0]
      .version,
  ).toBe(2);
  await page.reload();
  await expect(person(page, "Ana Auditoria").locator(".badge")).toHaveText(
    "Presente",
  );
});

test("attendance respects course availability and explains a rejected open operation", async ({
  page,
}) => {
  const state = fixture();
  state.canOpen = false;
  state.hasCourse = false;
  await setup(page, state);
  await page.goto("/#/chamada");
  await expect(
    page.getByRole("button", { name: "Abrir chamada", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Não há curso nesta data.", { exact: true }),
  ).toBeVisible();
  expect(rpcCalls(state, "open_attendance")).toHaveLength(0);
  state.canOpen = true;
  state.hasCourse = true;
  state.failures.set("/rest/v1/rpc/open_attendance", {
    status: 400,
    message: "OUTSIDE_WINDOW",
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Abrir chamada", exact: true })
    .click();
  await expect(
    page.getByText("Fora do horário da chamada.", { exact: true }),
  ).toBeVisible();
  expect(state.sessions).toHaveLength(0);
  await expect(
    page.getByRole("heading", { name: "Chamada do dia", exact: true }),
  ).toBeVisible();
});

test("maintenance validates its reason, preserves rejected submissions, and persists corrections and history", async ({
  page,
}) => {
  const state = fixture();
  seedSession(state, "finalized");
  state.members.forEach((member) => {
    member.status = "present";
  });
  await openSeededSession(page, state);
  await page.getByRole("button", { name: "Manutenção", exact: true }).click();
  const reasonDialog = page.getByRole("dialog", {
    name: "Motivo da manutenção",
  });
  await reasonDialog
    .getByRole("button", { name: "Abrir manutenção", exact: true })
    .click();
  expect(rpcCalls(state, "start_maintenance")).toHaveLength(0);
  state.failures.set("/rest/v1/rpc/start_maintenance", {
    status: 400,
    message: "REASON_REQUIRED",
  });
  await reasonDialog
    .getByLabel("Motivo", { exact: true })
    .fill("Correcao conferida pela auditoria");
  await reasonDialog
    .getByRole("button", { name: "Abrir manutenção", exact: true })
    .click();
  await expect(
    page.getByText("Motivo obrigatório.", { exact: true }),
  ).toBeVisible();
  await expect(reasonDialog).toBeVisible();
  expect(state.sessions[0].status).toBe("finalized");
  state.failures.delete("/rest/v1/rpc/start_maintenance");
  await reasonDialog
    .getByRole("button", { name: "Abrir manutenção", exact: true })
    .click();
  await expect(reasonDialog).toHaveCount(0);
  await expect(page.locator(".notice")).toContainText(
    "Correcao conferida pela auditoria",
  );
  expect(rpcCalls(state, "start_maintenance").at(-1)?.body).toEqual({
    session_identifier: sessionId,
    reason: "Correcao conferida pela auditoria",
  });
  await page
    .getByRole("button", { name: "Falta: Ana Auditoria", exact: true })
    .click();
  await expect(person(page, "Ana Auditoria").locator(".badge")).toHaveText(
    "Falta",
  );
  await page
    .getByRole("button", { name: "Encerrar manutenção", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Encerrar manutenção", exact: true }),
  ).toHaveCount(0);
  expect(rpcCalls(state, "end_maintenance")[0].body).toEqual({
    session_identifier: sessionId,
  });
  await page.reload();
  await expect(person(page, "Ana Auditoria").locator(".badge")).toHaveText(
    "Falta",
  );
  await page
    .getByRole("button", {
      name: "Esta chamada possui histórico de manutenção.",
    })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Histórico de manutenção" }),
  ).toContainText("Correcao conferida pela auditoria");
  expect(state.maintenance[0].closed_at).toBe(serverTime);
});

test("maintenance requires recent identity verification before a correction or close", async ({
  page,
}) => {
  const state = fixture();
  seedSession(state, "maintenance");
  state.recentlyVerified = false;
  state.maintenance = [
    {
      id: "maintenance-1",
      session_id: sessionId,
      reason: "Conferencia de registro",
      opened_at: serverTime,
      closed_at: null,
    },
  ];
  await openSeededSession(page, state);
  await page
    .getByRole("button", { name: "Presente: Ana Auditoria", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Verificação de segurança",
      exact: true,
    }),
  ).toBeVisible();
  expect(rpcCalls(state, "save_attendance")).toHaveLength(0);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Encerrar manutenção", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Verificação de segurança",
      exact: true,
    }),
  ).toBeVisible();
  expect(rpcCalls(state, "end_maintenance")).toHaveLength(0);
  expect(
    state.calls.filter((call) => call.path.startsWith("/functions/")),
  ).toHaveLength(0);
});

test("RH attendance keeps confirmation open when the final account check is not ready or recent", async ({
  page,
}) => {
  const state = fixture();
  seedSession(state, "maintenance");
  state.recentlyVerified = false;
  await openSeededSession(page, state);
  await page
    .getByRole("button", { name: "Presente: Ana Auditoria", exact: true })
    .click();
  state.securityResponses.push(
    { status: 200, body: { ok: true, masked_email: "fixture@example.test" } },
    { status: 200, body: { ok: true } },
  );
  await page
    .getByRole("button", { name: "Enviar código", exact: true })
    .click();
  await page.getByLabel("Código", { exact: true }).fill("123456");
  await page.route("**/rest/v1/rpc/bootstrap", (route) =>
    route.fulfill({
      status: 200,
      json: { ready: false, recently_verified: false },
    }),
  );
  await page.getByRole("button", { name: "Verificar", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Verificação de segurança",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Não foi possível confirmar seu acesso. Tente novamente.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(rpcCalls(state, "save_attendance")).toHaveLength(0);
});

test("route guards block attendance management and reports before operational requests", async ({
  page,
}) => {
  const state = fixture();
  state.permissions = ["attendance.view", "calendar.view"];
  await setup(page, state);
  for (const path of ["chamada", "relatorios", "apresentacoes"]) {
    await page.goto(`/#/${path}`);
    await expect(
      page.getByRole("heading", {
        name: "Você não tem permissão.",
        exact: true,
      }),
    ).toBeVisible();
  }
  expect(rpcCalls(state, "course_status")).toHaveLength(0);
  expect(rpcCalls(state, "report_snapshot")).toHaveLength(0);
  expect(
    state.calls.filter((call) =>
      /attendance_sessions|register_report|register_export/.test(call.path),
    ),
  ).toHaveLength(0);
});

test("security explains delivery configuration and keeps the code form closed", async ({
  page,
}) => {
  const state = fixture();
  seedSession(state, "maintenance");
  state.recentlyVerified = false;
  state.securityResponses = [
    { status: 503, body: { error: "EMAIL_CONFIGURATION_REQUIRED" } },
  ];
  await openSeededSession(page, state);
  await page
    .getByRole("button", { name: "Presente: Ana Auditoria", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Enviar código", exact: true })
    .click();
  await expect(
    page.getByText(
      "O envio de e-mails precisa ser configurado pelo responsável pelo site.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Código", { exact: true })).toHaveCount(0);
  expect(rpcCalls(state, "save_attendance")).toHaveLength(0);
});

test("security rejects a failed send returned with HTTP success", async ({
  page,
}) => {
  const state = fixture();
  seedSession(state, "maintenance");
  state.recentlyVerified = false;
  state.securityResponses = [
    { status: 200, body: { ok: false, error: "EMAIL_DELIVERY_FAILED" } },
  ];
  await openSeededSession(page, state);
  await page
    .getByRole("button", { name: "Presente: Ana Auditoria", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Enviar código", exact: true })
    .click();
  await expect(
    page.getByText(
      "Não foi possível enviar o código. Tente novamente mais tarde.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Código", { exact: true })).toHaveCount(0);
});

test("security keeps verification open when a successful HTTP response rejects the code", async ({
  page,
}) => {
  const state = fixture();
  seedSession(state, "maintenance");
  state.recentlyVerified = false;
  state.securityResponses = [
    { status: 200, body: { ok: true, masked_email: "a***@example.test" } },
    { status: 200, body: { ok: false, error: "INVALID_CODE" } },
  ];
  await openSeededSession(page, state);
  await page
    .getByRole("button", { name: "Presente: Ana Auditoria", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Enviar código", exact: true })
    .click();
  await page.getByLabel("Código", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Verificar", exact: true }).click();
  await expect(
    page.getByText("Código inválido ou expirado.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Verificação de segurança",
      exact: true,
    }),
  ).toBeVisible();
  expect(rpcCalls(state, "save_attendance")).toHaveLength(0);
});

test("attendance viewers can inspect history without editing or opening maintenance", async ({
  page,
}) => {
  const state = fixture();
  state.permissions = ["attendance.view"];
  seedSession(state, "maintenance");
  await setup(page, state);
  await page.goto(`/#/presenca?chamada=${sessionId}`);
  await expect(page.locator(".attendance-row")).toHaveCount(3);
  await expect(page.locator(".attendance-controls")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Manutenção|Encerrar manutenção/i }),
  ).toHaveCount(0);
  await person(page, "Ana Auditoria")
    .getByRole("button", { name: "Detalhes", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Entrada real"),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Salvar", exact: true }),
  ).toHaveCount(0);
  expect(rpcCalls(state, "save_attendance")).toHaveLength(0);
});

test("calendar filters apply class overrides, event visibility, month boundaries, and saved versions", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/#/calendario");
  const dateButton = page
    .locator(".calendar-day")
    .filter({ has: page.locator("strong", { hasText: /^13$/ }) });
  await expect(dateButton).toContainText("Feriado");
  await expect(dateButton).toContainText("Encontro da turma B");
  await page.getByLabel("Turma do calendário").selectOption(classA);
  await expect(dateButton).toContainText("Reposição");
  await expect(dateButton).toContainText("Encontro geral");
  await expect(dateButton).toContainText("Encontro da turma A");
  await expect(dateButton).not.toContainText("Encontro da turma B");
  await dateButton.click();
  const dialog = page.getByRole("dialog", { name: "13/10/2026" });
  await expect(dialog.getByLabel("Motivo", { exact: true })).toHaveValue(
    "Reposicao da turma A",
  );
  await dialog.getByLabel("Tem curso nesta data?").selectOption("no");
  await dialog.getByLabel("Tipo", { exact: true }).selectOption("cancelled");
  await dialog
    .getByLabel("Motivo", { exact: true })
    .fill("Cancelamento conferido pelo RH");
  await dialog
    .getByRole("button", { name: "Salvar data", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(dateButton).toContainText("Sem curso");
  expect(rpcCalls(state, "save_entity")[0].body).toEqual({
    entity: "course_calendar",
    payload: {
      id: "calendar-class-a",
      class_id: classA,
      scheduled_date: day,
      has_course: false,
      kind: "cancelled",
      reason: "Cancelamento conferido pelo RH",
    },
    expected_version: 4,
  });
  await page.reload();
  await page.getByLabel("Turma do calendário").selectOption(classA);
  await dateButton.click();
  await expect(dialog.getByLabel("Motivo", { exact: true })).toHaveValue(
    "Cancelamento conferido pelo RH",
  );
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Próximo mês", exact: true }).click();
  await expect(page.locator(".calendar-panel h2")).toHaveText(
    "novembro de 2026",
  );
  await expect
    .poll(() =>
      state.calls
        .filter((call) => call.path.endsWith("/course_calendar"))
        .at(-1)
        ?.url.searchParams.get("scheduled_date"),
    )
    .toBe("gte.2026-11-01");
  const nextMonth = state.calls
    .filter((call) => call.path.endsWith("/course_calendar"))
    .at(-1)!.url;
  expect(nextMonth.searchParams.getAll("scheduled_date")).toEqual([
    "gte.2026-11-01",
    "lt.2026-12-01",
  ]);
  await expect(page.locator(".calendar-event")).toHaveCount(0);
  await page.getByRole("button", { name: "Mês anterior", exact: true }).click();
  await expect(dateButton).toContainText("Sem curso");
  expect(state.unexpected).toEqual([]);
});

test("calendar read-only users inspect inherited rules without save or import controls", async ({
  page,
}) => {
  const state = fixture();
  state.permissions = ["calendar.view"];
  await setup(page, state);
  await page.goto("/#/calendario");
  await page.getByLabel("Turma do calendário").selectOption(classB);
  await page
    .locator(".calendar-day")
    .filter({ has: page.locator("strong", { hasText: /^13$/ }) })
    .click();
  await expect(page.getByRole("dialog", { name: "13/10/2026" })).toContainText(
    "Feriado geral da auditoria",
  );
  await expect(
    page.getByRole("button", { name: "Salvar data", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Importar feriados", exact: true }),
  ).toHaveCount(0);
  expect(rpcCalls(state, "save_entity")).toHaveLength(0);
});

test("calendar loading errors show recovery instead of an invented default calendar", async ({
  page,
}) => {
  const state = fixture();
  state.failures.set("/rest/v1/course_calendar", {
    status: 500,
    message: "Calendar unavailable",
  });
  await setup(page, state);
  await page.goto("/#/calendario");
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar os registros.",
  );
  await expect(page.locator(".calendar-day")).toHaveCount(0);
  state.failures.delete("/rest/v1/course_calendar");
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(page.locator(".calendar-day")).toHaveCount(31);
  await expect(
    page
      .locator(".calendar-day")
      .filter({ has: page.locator("strong", { hasText: /^13$/ }) }),
  ).toContainText("Feriado");
});

test("calendar CSV import sends the selected class and persists imported days", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/#/calendario");
  await page.getByLabel("Turma do calendário").selectOption(classB);
  await page
    .getByRole("button", { name: "Importar feriados", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Importar feriados" });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "feriados-auditoria.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Data,Motivo\n2026-10-14,Feriado da auditoria\n2026-10-15,Segundo feriado da auditoria",
    ),
  });
  await expect(dialog.locator(".import-preview .list-item")).toHaveCount(2);
  page.once("dialog", (confirmation) => confirmation.accept());
  await dialog
    .getByRole("button", { name: "Confirmar importação", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(rpcCalls(state, "import_calendar")[0].body).toEqual({
    rows: [
      {
        scheduled_date: "2026-10-14",
        reason: "Feriado da auditoria",
        class_id: classB,
        kind: "holiday",
        has_course: false,
      },
      {
        scheduled_date: "2026-10-15",
        reason: "Segundo feriado da auditoria",
        class_id: classB,
        kind: "holiday",
        has_course: false,
      },
    ],
  });
  await page.reload();
  await page.getByLabel("Turma do calendário").selectOption(classB);
  await expect(
    page
      .locator(".calendar-day")
      .filter({ has: page.locator("strong", { hasText: /^14$/ }) }),
  ).toContainText("Feriado");
  await page.getByLabel("Turma do calendário").selectOption(classA);
  await expect(
    page
      .locator(".calendar-day")
      .filter({ has: page.locator("strong", { hasText: /^14$/ }) }),
  ).not.toContainText("Feriado");
});

test("calendar rejects an invalid replacement CSV and clears the old import preview", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/#/calendario");
  await page
    .getByRole("button", { name: "Importar feriados", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Importar feriados" });
  const file = dialog.locator('input[type="file"]');
  await file.setInputFiles({
    name: "valid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Data,Motivo\n2026-10-14,Feriado validado"),
  });
  await expect(
    dialog.getByRole("button", { name: "Confirmar importação", exact: true }),
  ).toBeEnabled();
  await file.setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Dia,Descricao\ninvalid,wrong"),
  });
  await expect(dialog).toContainText("Revise as colunas Data e Motivo.");
  await expect(dialog.locator(".import-preview .list-item")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Confirmar importação", exact: true }),
  ).toBeDisabled();
  expect(rpcCalls(state, "import_calendar")).toHaveLength(0);
});

for (const [name, row] of [
  ["a nonexistent day", "2026-02-30,Feriado da auditoria"],
  ["an invalid month", "2026-13-99,Feriado da auditoria"],
  ["a missing reason", "2026-10-14"],
  ["a whitespace-only reason", "2026-10-14,   "],
]) {
  test(`calendar rejects ${name} in CSV before preview or submission`, async ({
    page,
  }) => {
    const state = await setup(page);
    await page.goto("/#/calendario");
    await page
      .getByRole("button", { name: "Importar feriados", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Importar feriados" });
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "invalid-row.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`Data,Motivo\n${row}`),
    });
    await expect(dialog).toContainText("Revise as colunas Data e Motivo.");
    await expect(dialog.locator(".import-preview .list-item")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Confirmar importação", exact: true }),
    ).toBeDisabled();
    expect(rpcCalls(state, "import_calendar")).toHaveLength(0);
  });
}

test("reports apply period, class, employee and kind filters and recover from snapshot errors", async ({
  page,
}) => {
  const state = fixture();
  state.failures.set("/rest/v1/rpc/report_snapshot", {
    status: 500,
    message: "Snapshot unavailable",
  });
  await setup(page, state);
  await page.goto(`/#/relatorios?data=${day}&turma=${classA}`);
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar os registros.",
  );
  await expect(page.locator(".export-actions")).toHaveCount(0);
  state.failures.delete("/rest/v1/rpc/report_snapshot");
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(page.locator(".report-preview tbody tr")).toHaveCount(20);
  await expect(page.getByLabel("De", { exact: true })).toHaveValue(day);
  await expect(page.getByLabel("Até", { exact: true })).toHaveValue(day);
  await page
    .getByRole("combobox", { name: "Colaborador", exact: true })
    .selectOption(employee);
  await expect(page.locator(".report-preview tbody tr")).toHaveCount(1);
  expect(rpcCalls(state, "report_snapshot").at(-1)?.body).toEqual({
    period_start: day,
    period_end: day,
    employee_identifier: employee,
    class_identifier: classA,
  });
  await page
    .getByRole("combobox", { name: "Relatório", exact: true })
    .selectOption("absences");
  await expect(
    page.getByText("Nenhum registro para os filtros selecionados.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Colaborador", exact: true })
    .selectOption("");
  await expect(page.locator(".report-preview tbody tr")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Relatório", exact: true })
    .selectOption("lateness");
  await expect(page.locator(".report-preview tbody tr")).toHaveCount(1);
  await expect(page.locator(".report-preview tbody")).toContainText("08:15");
  await page.getByRole("button", { name: "Mês anterior", exact: true }).click();
  await expect(page.getByLabel("De", { exact: true })).toHaveValue(
    "2026-09-01",
  );
  await expect(page.getByLabel("Até", { exact: true })).toHaveValue(
    "2026-09-30",
  );
  await expect(
    page.getByText("Nenhum registro para os filtros selecionados.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(rpcCalls(state, "report_snapshot").at(-1)?.body.period_end).toBe(
    "2026-09-30",
  );
});

for (const format of ["pdf", "xlsx", "pptx"] as const) {
  test(`reports download a real ${format.toUpperCase()} with complete filtered data and audited storage metadata`, async ({
    page,
  }) => {
    const state = await setup(page);
    await page.goto(`/#/relatorios?data=${day}&turma=${classA}`);
    await expect(page.locator(".report-preview tbody tr")).toHaveCount(20);
    await page
      .getByLabel("Pontos positivos", { exact: true })
      .fill("AUDIT-POSITIVE-27");
    await page
      .getByLabel("Ações recomendadas", { exact: true })
      .fill("AUDIT-NEXT-ACTION");
    const button = {
      pdf: "Gerar PDF",
      xlsx: "Excel",
      pptx: "Gerar PowerPoint",
    }[format];
    const waitForDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: button, exact: true }).click();
    const download = await waitForDownload;
    expect(download.suggestedFilename()).toBe(`RH_${day}_${day}.${format}`);
    const bytes = await downloadedBytes(download);
    expect(bytes.length).toBeGreaterThan(1000);
    if (format === "pdf") {
      const text = pdfText(assertPdfStructure(bytes));
      expect(text).toContain("Ana Auditoria");
      expect(text).toContain("Pessoa Exportacao 27");
      expect(text).toContain("AUDIT-POSITIVE-27");
      expect(text).toContain("AUDIT-NEXT-ACTION");
      expect(text).toContain("13/10/2026");
    } else if (format === "xlsx") {
      expect(bytes.subarray(0, 4)).toEqual(
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      );
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
      const sheet = workbook.getWorksheet("Registros")!;
      expect(sheet.rowCount).toBe(28);
      expect(sheet.getCell("C2").value).toBe("Ana Auditoria");
      expect(sheet.getCell("C28").value).toBe("Pessoa Exportacao 27");
      expect(sheet.getCell("E3").value).toBe("Atraso");
      expect(sheet.getCell("F3").value).toBe("08:15");
      expect(sheet.getCell("G3").value).toBe(15);
      expect(sheet.getCell("H2").value).toBe(2);
      expect(sheet.getCell("A2").value).toBe("13/10/2026");
      expect(workbook.getWorksheet("Indicadores")!.getCell("B2").value).toBe(
        25,
      );
      expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    } else {
      expect(bytes.subarray(0, 4)).toEqual(
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      );
      const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
      expect(zip.file("[Content_Types].xml")).not.toBeNull();
      const slidePaths = Object.keys(zip.files).filter((path) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(path),
      );
      expect(slidePaths).toHaveLength(15);
      const slides = await Promise.all(
        slidePaths.map((path) => zip.file(path)!.async("string")),
      );
      expect(slides.join("\n")).toContain("27 registros de presença");
      expect(slides.join("\n")).toContain("AUDIT-POSITIVE-27");
      expect(slides.join("\n")).toContain("AUDIT-NEXT-ACTION");
      expect(slides.join("\n")).toContain("13/10/2026");
      const chartPaths = Object.keys(zip.files).filter((path) =>
        /^ppt\/charts\/chart\d+\.xml$/.test(path),
      );
      expect(chartPaths).toHaveLength(3);
      const chart = await zip.file("ppt/charts/chart1.xml")!.async("string");
      expect(chart).toContain("2026-10");
      expect(chart).toContain("<c:v>25</c:v>");
      expect(await zip.file("docProps/core.xml")!.async("string")).toContain(
        "Relatório de RH",
      );
    }
    expect(rpcCalls(state, "register_report")[0].body).toEqual({
      payload: {
        title: "Relatório de RH",
        kind: "consolidated",
        period_start: day,
        period_end: day,
        employee_id: null,
        class_id: classA,
      },
    });
    expect(state.uploads).toHaveLength(1);
    expect(state.uploads[0].bytes.equals(bytes)).toBe(true);
    expect(state.uploads[0].upsert).toBe("false");
    expect(state.uploads[0].mime).toBe(
      {
        pdf: "application/pdf",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }[format],
    );
    expect(rpcCalls(state, "register_export")[0].body).toEqual({
      report_identifier: "report-1",
      format_name: format,
      file_path: `${owner}/report-1/RH_${day}_${day}.${format}`,
    });
    await page.reload();
    await page
      .getByRole("button", { name: "Histórico de arquivos", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog", { name: "Histórico de arquivos" })
        .locator(".file-row"),
    ).toContainText(format.toUpperCase());
    expect(state.unexpected).toEqual([]);
  });
}

test("an upload rejection produces no download or completed export and can be retried", async ({
  page,
}) => {
  const state = await setup(page);
  const failedPath = `/storage/v1/object/exports/${owner}/report-1/RH_${day}_${day}.xlsx`;
  state.failures.set(failedPath, {
    status: 500,
    message: "Storage unavailable",
  });
  const downloads: Download[] = [];
  page.on("download", (download) => downloads.push(download));
  await page.goto(`/#/relatorios?data=${day}&turma=${classA}`);
  await page.getByRole("button", { name: "Excel", exact: true }).click();
  await expect(
    page.getByText("Não foi possível concluir. Tente novamente.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Excel", exact: true }),
  ).toBeEnabled();
  expect(downloads).toHaveLength(0);
  expect(rpcCalls(state, "register_export")).toHaveLength(0);
  expect(state.exports).toHaveLength(0);
  await page
    .getByRole("button", { name: "Histórico de arquivos", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Histórico de arquivos" }),
  ).toContainText("Nenhum arquivo gerado.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  state.failures.delete(failedPath);
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel", exact: true }).click();
  const bytes = await downloadedBytes(await waiting);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  expect(workbook.getWorksheet("Registros")!.rowCount).toBe(28);
  expect(rpcCalls(state, "register_export")[0].body.report_identifier).toBe(
    "report-2",
  );
});

test("an export registration rejection leaves no downloadable successful export", async ({
  page,
}) => {
  const state = await setup(page);
  state.failures.set("/rest/v1/rpc/register_export", {
    status: 403,
    message: "FORBIDDEN",
  });
  const downloads: Download[] = [];
  page.on("download", (download) => downloads.push(download));
  await page.goto(`/#/relatorios?data=${day}&turma=${classA}`);
  await page.getByRole("button", { name: "Gerar PDF", exact: true }).click();
  await expect(
    page.getByText("Você não tem permissão.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Gerar PDF", exact: true }),
  ).toBeEnabled();
  expect(state.uploads).toHaveLength(1);
  expect(downloads).toHaveLength(0);
  expect(state.exports).toHaveLength(0);
  assertPdfStructure(state.uploads[0].bytes);
});

test("report viewers see the snapshot and history without export permissions", async ({
  page,
}) => {
  const state = fixture();
  state.permissions = ["report.view"];
  await setup(page, state);
  await page.goto(`/#/relatorios?data=${day}`);
  await expect(page.locator(".report-preview tbody tr")).toHaveCount(20);
  await expect(page.locator(".export-actions")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Histórico de arquivos", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Histórico de arquivos" }),
  ).toContainText("Nenhum arquivo gerado.");
  expect(rpcCalls(state, "register_report")).toHaveLength(0);
  expect(state.uploads).toHaveLength(0);
});

test("presentations navigate all slides and export a valid landscape PDF with one page per slide", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto(`/#/apresentacoes?data=${day}&turma=${classA}`);
  await expect(
    page.getByRole("heading", { name: "Apresentações", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".slide-navigation")).toContainText("1 / 15");
  await expect(
    page.getByRole("button", { name: "Slide anterior", exact: true }),
  ).toBeDisabled();
  for (let index = 1; index < 15; index++) {
    await page
      .getByRole("button", { name: "Próximo slide", exact: true })
      .click();
    await expect(page.locator(".slide-navigation")).toContainText(
      `${index + 1} / 15`,
    );
  }
  await expect(page.locator(".preview-slide h2")).toHaveText(
    "Continuidade do trabalho",
  );
  await expect(
    page.getByRole("button", { name: "Próximo slide", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Conclusão", { exact: true })
    .fill("AUDIT-PRESENTATION-CONCLUSION");
  await expect(page.locator(".preview-slide p")).toHaveText(
    "AUDIT-PRESENTATION-CONCLUSION",
  );
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Gerar PDF", exact: true }).click();
  const bytes = await downloadedBytes(await waiting);
  const pdf = assertPdfStructure(bytes);
  expect([...pdf.matchAll(/\/Type \/Page\b/g)]).toHaveLength(15);
  const dimensions = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdf);
  expect(dimensions).not.toBeNull();
  expect(Number(dimensions![1])).toBeGreaterThan(Number(dimensions![2]));
  expect(pdfText(pdf)).toContain("AUDIT-PRESENTATION-CONCLUSION");
  expect(state.reports[0].title).toBe("Gestão de RH");
  expect(state.uploads[0].bytes.equals(bytes)).toBe(true);
});
