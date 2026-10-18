import { expect, test, type Page, type Route } from "@playwright/test";
import type { Row } from "../src/database.types";

const owner = "00000000-0000-4000-8000-000000000001";
const employee = "00000000-0000-4000-8000-000000000002";
const member = "00000000-0000-4000-8000-000000000003";
const feedbackId = "00000000-0000-4000-8000-000000000004";
const justificationId = "00000000-0000-4000-8000-000000000005";
const categoryId = "00000000-0000-4000-8000-000000000006";
const timestamp = "2026-10-09T12:00:00Z";

const emptyReadRequests = new Set([
  "GET /rest/v1/job_positions", // Employee form reference options.
  "GET /rest/v1/managers", // Employee form reference options.
  "HEAD /rest/v1/notifications", // Unread notification count in the header.
  "HEAD /rest/v1/performance_reviews", // Grade count in the employee profile.
]);
const allowedApiRequests = new Set([
  ...emptyReadRequests,
  "POST /rest/v1/rpc/bootstrap",
  "POST /rest/v1/rpc/site_status",
  "POST /rest/v1/rpc/save_entity",
  "POST /rest/v1/rpc/feedback_reply",
  "POST /rest/v1/rpc/submit_justification",
  "POST /rest/v1/rpc/review_justification",
  "POST /rest/v1/rpc/attach_file",
  "POST /rest/v1/ti_support_tickets",
  "GET /rest/v1/employees",
  "GET /rest/v1/classes",
  "GET /rest/v1/departments",
  "GET /rest/v1/feedbacks",
  "HEAD /rest/v1/feedbacks",
  "GET /rest/v1/feedback_followups",
  "GET /rest/v1/attachments",
  "GET /rest/v1/justification_categories",
  "GET /rest/v1/attendance_members",
  "GET /rest/v1/absence_justifications",
]);
const unexpectedRequestsByPage = new WeakMap<Page, string[]>();

function allowsSupabaseRequest(method: string, path: string) {
  if (allowedApiRequests.has(`${method} ${path}`)) return true;
  if (method === "POST")
    return (
      /^\/storage\/v1\/object\/(justifications|ti-support)\/.+$/.test(path) ||
      /^\/storage\/v1\/object\/sign\/ti-support\/.+$/.test(path)
    );
  return (
    method === "DELETE" &&
    /^\/storage\/v1\/object\/(justifications|ti-support)$/.test(path)
  );
}

test.afterEach(async ({ page }) => {
  expect(
    unexpectedRequestsByPage.get(page),
    "Every API or WhatsApp request must have an explicit fixture handler",
  ).toEqual([]);
  unexpectedRequestsByPage.delete(page);
});

function makeEmployee(
  overrides: Partial<Row<"employees">> = {},
): Row<"employees"> {
  return {
    id: employee,
    profile_id: null,
    full_name: "Pessoa de Teste",
    social_name: null,
    email: "employee@example.test",
    phone: null,
    registration: "TEST-001",
    join_date: "2026-09-01",
    class_id: "class-1",
    department_id: "department-1",
    job_position_id: null,
    manager_id: null,
    member_group: "class",
    access_role_code: "COLLABORATOR",
    expected_arrival: "08:00:00",
    expected_departure: "14:00:00",
    status: "active",
    photo_path: null,
    created_at: timestamp,
    updated_at: timestamp,
    version: 1,
    ...overrides,
  };
}

function makeFeedback(
  overrides: Partial<Row<"feedbacks">> = {},
): Row<"feedbacks"> {
  return {
    id: feedbackId,
    employee_id: employee,
    author_id: owner,
    title: "Plano de desenvolvimento",
    kind: "development",
    description:
      "Apresentar as tarefas e avisar a equipe sobre os próximos passos.",
    strengths: "Organização dos materiais.",
    improvements: "Comunicação das entregas.",
    actions: "Compartilhar um resumo toda sexta-feira.",
    due_date: "2026-10-30",
    status: "open",
    released: true,
    allow_response: true,
    read_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    version: 3,
    ...overrides,
  };
}

function makeAttachment(): Row<"attachments"> {
  return {
    id: "00000000-0000-4000-8000-000000000007",
    employee_id: employee,
    justification_id: null,
    feedback_id: null,
    bucket: "documents",
    path: `${employee}/cadastro.pdf`,
    filename: "Documento de cadastro.pdf",
    size_bytes: 512,
    mime_type: "application/pdf",
    created_by: owner,
    created_at: timestamp,
    archived: false,
  };
}

type Justification = Row<"absence_justifications"> & {
  employees: { full_name: string };
};
type RecordedRequest = {
  url: URL;
  method: string;
  body: Record<string, unknown> | undefined;
};

function makeJustification(
  overrides: Partial<Justification> = {},
): Justification {
  return {
    id: justificationId,
    member_id: member,
    employee_id: employee,
    category_id: categoryId,
    reason: "Consulta médica agendada.",
    status: "pending",
    review_comment: null,
    reviewed_by: null,
    reviewed_at: null,
    created_by: owner,
    created_at: timestamp,
    updated_at: timestamp,
    version: 7,
    employees: { full_name: "Pessoa de Teste" },
    ...overrides,
  };
}

function classRoster() {
  return Array.from({ length: 26 }, (_, index) =>
    makeEmployee({
      id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
      full_name: `Colaborador ${String(index + 1).padStart(2, "0")}`,
      registration: `TEST-${index + 1}`,
    }),
  );
}

// Every request is served from per-test memory; neither reads nor writes reach a database.
async function setup(
  page: Page,
  options: {
    employees?: Row<"employees">[];
    feedbacks?: Row<"feedbacks">[];
    attachments?: Row<"attachments">[];
    justifications?: Justification[];
    permissions?: string[];
  } = {},
) {
  const state = {
    employees: options.employees || [makeEmployee()],
    feedbacks: options.feedbacks || [],
    justifications: options.justifications || [],
    followups: [] as Row<"feedback_followups">[],
    attachments: options.attachments || [],
    tickets: [] as Record<string, unknown>[],
    requests: [] as RecordedRequest[],
    unexpectedRequests: [] as string[],
    whatsapp: [] as URL[],
    uploaded: new Set<string>(),
    failures: {} as Record<string, number>,
  };
  unexpectedRequestsByPage.set(page, state.unexpectedRequests);
  const permissions = options.permissions || [
    "employee.view",
    "employee.manage",
    "attendance.manage",
    "feedback.view",
    "feedback.manage",
    "justification.manage",
  ];
  await page.addInitScript(
    ({ owner, timestamp }) => {
      sessionStorage.setItem("raizes-inauguracao-2026-09-29", "1");
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const encode = (value: unknown) =>
        btoa(JSON.stringify(value))
          .replaceAll("=", "")
          .replaceAll("+", "-")
          .replaceAll("/", "_");
      const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: owner, aud: "authenticated", role: "authenticated", exp })}.c2lnbmF0dXJl`;
      localStorage.setItem(
        "sb-127-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "isolated-people-test-refresh-token",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: owner,
            aud: "authenticated",
            role: "authenticated",
            email: "viewer@example.test",
            app_metadata: {},
            user_metadata: {},
            created_at: timestamp,
          },
        }),
      );
    },
    { owner, timestamp },
  );

  const reply = async (
    route: Route,
    data: unknown,
    total?: number,
    status = 200,
  ) => {
    const offset = Number(
      new URL(route.request().url()).searchParams.get("offset") || 0,
    );
    const count = total ?? (Array.isArray(data) ? data.length : 1);
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: {
        "Content-Range": `${offset}-${offset + Math.max(0, Array.isArray(data) ? data.length - 1 : 0)}/${count}`,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Content-Range",
      },
      body: route.request().method() === "HEAD" ? "" : JSON.stringify(data),
    });
  };
  const fail = async (route: Route, key: string) => {
    if (!state.failures[key]) return false;
    state.failures[key]--;
    await reply(
      route,
      { message: "Fixture network failure", error: "Fixture network failure" },
      0,
      route.request().method() === "GET" ? 500 : 503,
    );
    return true;
  };
  const rejectUnexpected = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    state.unexpectedRequests.push(
      `${request.method()} ${url.pathname}${url.search}`,
    );
    return reply(
      route,
      {
        code: "UNEXPECTED_FIXTURE_REQUEST",
        message: "Unexpected fixture request",
      },
      0,
      501,
    );
  };
  function paginated<T>(rows: T[], url: URL) {
    const offset = Number(url.searchParams.get("offset") || 0);
    const limit = Number(url.searchParams.get("limit") || rows.length);
    return rows.slice(offset, offset + limit);
  }
  function eq(url: URL, key: string, value: string | null | undefined) {
    const filter = url.searchParams.get(key);
    return !filter || filter === `eq.${value}`;
  }

  await page.route("https://wa.me/**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET" || url.pathname !== "/5511919730067")
      return rejectUnexpected(route);
    state.whatsapp.push(url);
    // A 204 response keeps the confirmation visible and prevents external navigation.
    await route.fulfill({ status: 204 });
  });
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!allowsSupabaseRequest(request.method(), path))
      return rejectUnexpected(route);
    const body = request.headers()["content-type"]?.includes("application/json")
      ? (request.postDataJSON() as Record<string, unknown>)
      : undefined;
    state.requests.push({ url, method: request.method(), body });

    if (path.endsWith("/rpc/bootstrap"))
      return reply(route, {
        profile: {
          id: owner,
          full_name: "Pessoa de Teste",
          status: "active",
          onboarded_at: timestamp,
          photo_path: null,
        },
        roles: [
          permissions.includes("employee.manage") ? "MANAGER" : "COLLABORATOR",
        ],
        permissions,
        privileged: permissions.includes("employee.manage"),
        mfa_required: false,
        mfa_verified: true,
        recently_verified: true,
        ready: true,
        server_time: timestamp,
        employee_id: employee,
        maintenance: { enabled: false },
      });
    if (path.endsWith("/rpc/site_status"))
      return reply(route, {
        maintenance: { enabled: false },
        updates: [],
        server_time: timestamp,
      });

    if (path.endsWith("/rpc/save_entity")) {
      if (await fail(route, "save_entity")) return;
      const payload = body!.payload as Partial<Row<"feedbacks">>;
      const saved = makeFeedback({
        ...payload,
        id: payload.id || feedbackId,
        version: 1,
      });
      state.feedbacks = [saved];
      return reply(route, saved.id);
    }
    if (path.endsWith("/rpc/feedback_reply")) {
      if (
        await fail(route, body!.mark_read ? "feedback_read" : "feedback_reply")
      )
        return;
      if (body!.mark_read) {
        const record = state.feedbacks.find(
          (row) => row.id === body!.identifier,
        );
        if (record) record.read_at = timestamp;
      } else {
        state.followups.push({
          id: `followup-${state.followups.length + 1}`,
          feedback_id: String(body!.identifier),
          author_id: owner,
          body: String(body!.body),
          created_at: timestamp,
        });
      }
      return reply(route, null);
    }
    if (path.endsWith("/rpc/submit_justification")) {
      if (await fail(route, "submit_justification")) return;
      state.justifications.push(
        makeJustification({
          member_id: String(body!.member_identifier),
          category_id: String(body!.category_identifier),
          reason: String(body!.reason),
          version: 1,
        }),
      );
      return reply(route, justificationId);
    }
    if (path.endsWith("/rpc/review_justification")) {
      if (await fail(route, "review_justification")) return;
      const record = state.justifications.find(
        (row) => row.id === body!.identifier,
      )!;
      record.status = String(body!.decision);
      record.review_comment = String(body!.note);
      record.version++;
      return reply(route, null);
    }
    if (path.endsWith("/rpc/attach_file")) {
      if (await fail(route, "attach_file")) return;
      const payload = body!.payload as Row<"attachments">;
      state.attachments.push({
        ...payload,
        id: `attachment-${state.attachments.length + 1}`,
        created_by: owner,
        created_at: timestamp,
        archived: false,
      });
      return reply(route, state.attachments.at(-1)!.id);
    }

    if (path.startsWith("/storage/v1/object/sign/")) {
      return reply(route, {
        signedURL: `${path.replace("/storage/v1", "")}?token=fixture-signed-token`,
      });
    }
    if (path.startsWith("/storage/v1/object/")) {
      const storedPath = decodeURIComponent(
        path.replace("/storage/v1/object/", ""),
      );
      if (request.method() === "DELETE") {
        for (const prefix of body!.prefixes as string[])
          state.uploaded.delete(`${storedPath}/${prefix}`);
        return reply(route, []);
      }
      if (await fail(route, `storage-upload:${storedPath.split("/")[0]}`))
        return;
      state.uploaded.add(storedPath);
      return reply(route, { Key: storedPath });
    }

    if (path.endsWith("/employees")) {
      if (
        url.searchParams.get("select") === "*" &&
        (await fail(route, "employees-list"))
      )
        return;
      let rows = state.employees.filter(
        (row) =>
          eq(url, "member_group", row.member_group) &&
          eq(url, "class_id", row.class_id) &&
          (url.searchParams.get("access_role_code") !== "neq.INSTRUCTOR" ||
            row.access_role_code !== "INSTRUCTOR") &&
          eq(url, "id", row.id),
      );
      const search = url.searchParams.get("full_name");
      if (search?.startsWith("ilike.")) {
        const needle = search.slice(6).replaceAll("%", "").toLowerCase();
        rows = rows.filter((row) =>
          row.full_name.toLowerCase().includes(needle),
        );
      }
      rows = [...rows].sort((a, b) => a.full_name.localeCompare(b.full_name));
      return reply(
        route,
        request.headers().accept?.includes("vnd.pgrst.object")
          ? rows[0]
          : paginated(rows, url),
        rows.length,
      );
    }
    if (path.endsWith("/classes"))
      return reply(route, [{ id: "class-1", code: "16807", name: "Turma 16807" }]);
    if (path.endsWith("/departments"))
      return reply(route, [{ id: "department-1", name: "Recursos Humanos" }]);
    if (emptyReadRequests.has(`${request.method()} ${path}`))
      return reply(route, []);
    if (path.endsWith("/feedbacks")) {
      if (
        request.method() === "GET" &&
        url.searchParams.get("select") === "*" &&
        url.searchParams.has("employee_id") &&
        (await fail(route, "profile-feedbacks"))
      )
        return;
      const rows = state.feedbacks.filter((row) =>
        eq(url, "employee_id", row.employee_id),
      );
      return reply(route, paginated(rows, url), rows.length);
    }
    if (path.endsWith("/feedback_followups"))
      return reply(
        route,
        state.followups.filter((row) =>
          eq(url, "feedback_id", row.feedback_id),
        ),
      );
    if (path.endsWith("/attachments")) {
      if (await fail(route, "attachments-list")) return;
      return reply(
        route,
        state.attachments.filter(
          (row) =>
            eq(url, "employee_id", row.employee_id) &&
            eq(url, "justification_id", row.justification_id) &&
            eq(url, "feedback_id", row.feedback_id),
        ),
      );
    }
    if (path.endsWith("/justification_categories"))
      return reply(route, [
        { id: categoryId, name: "Consulta médica", active: true },
      ]);
    if (path.endsWith("/attendance_members"))
      return reply(route, [
        {
          id: member,
          session_id: "session-1",
          employee_id: employee,
          full_name_snapshot: "Pessoa de Teste",
          registration_snapshot: "TEST-001",
          status: "absent",
          actual_arrival: null,
          delay_minutes: 0,
          created_at: timestamp,
          attendance_sessions: {
            scheduled_date: "2026-10-08",
            class_id: "class-1",
          },
        },
      ]);
    if (path.endsWith("/absence_justifications")) {
      const rows = state.justifications.filter((row) =>
        eq(url, "status", row.status),
      );
      return reply(route, paginated(rows, url), rows.length);
    }
    if (path.endsWith("/ti_support_tickets") && request.method() === "POST") {
      if (await fail(route, "ticket-insert")) return;
      state.tickets.push({ ...body, created_at: timestamp });
      return reply(route, { created_at: timestamp });
    }
    return rejectUnexpected(route);
  });

  return state;
}

function calls(state: Awaited<ReturnType<typeof setup>>, endpoint: string) {
  return state.requests.filter((request) =>
    request.url.pathname.endsWith(endpoint),
  );
}

test("employees paginate, search by name, show an empty result and open the selected profile", async ({
  page,
}) => {
  const roster = classRoster();
  const state = await setup(page, { employees: roster });
  await page.goto("/#/colaboradores");
  await expect(
    page.getByRole("heading", { name: "Colaboradores", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(25);
  await expect(page.locator(".pagination")).toContainText("1 de 2");
  await page.getByRole("button", { name: "Próxima página" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: /Colaborador 26/ }),
  ).toBeVisible();
  expect(
    calls(state, "/employees").at(-1)?.url.searchParams.get("offset"),
  ).toBe("25");

  await page
    .getByRole("textbox", { name: "Buscar colaboradores" })
    .fill("%Colaborador_ 01");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: /Colaborador 01/ }),
  ).toBeVisible();
  await expect(page.locator(".pagination")).toContainText("1 de 1");
  const searched = calls(state, "/employees").at(-1)!.url;
  expect(searched.searchParams.get("full_name")).toBe("ilike.%Colaborador 01%");
  expect(searched.searchParams.get("offset")).toBe("0");
  expect(searched.searchParams.get("class_id")).toBe("eq.class-1");
  expect(searched.searchParams.get("access_role_code")).toBe("neq.INSTRUCTOR");

  await page
    .getByRole("textbox", { name: "Buscar colaboradores" })
    .fill("Nome inexistente");
  await expect(
    page.getByText("Nenhum registro encontrado.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Próxima página" }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Buscar colaboradores" })
    .fill("Colaborador 01");
  await page.getByRole("link", { name: /Colaborador 01/ }).click();
  await expect(page).toHaveURL(new RegExp(`/colaboradores/${roster[0].id}$`));
  await expect(
    page.getByRole("heading", { name: "Colaborador 01", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Código interno", { exact: true }).locator(".."),
  ).toContainText("TEST-1");
});

test("class roster includes RH students but excludes instructors and other classes", async ({
  page,
}) => {
  const studentRh = makeEmployee({
    id: "00000000-0000-4000-8000-000000000201",
    full_name: "Aluna do RH",
    member_group: "rh",
  });
  const instructor = makeEmployee({
    id: "00000000-0000-4000-8000-000000000202",
    full_name: "Instrutor da turma",
    access_role_code: "INSTRUCTOR",
  });
  const otherClass = makeEmployee({
    id: "00000000-0000-4000-8000-000000000203",
    full_name: "Aluna de outra turma",
    class_id: "class-2",
  });
  const state = await setup(page, {
    employees: [studentRh, instructor, otherClass],
  });
  await page.goto("/#/colaboradores");
  await expect(page.getByRole("link", { name: "Aluna do RH" })).toBeVisible();
  await expect(page.getByText("Instrutor da turma")).toHaveCount(0);
  await expect(page.getByText("Aluna de outra turma")).toHaveCount(0);
  const request = calls(state, "/employees").at(-1)!.url;
  expect(request.searchParams.get("class_id")).toBe("eq.class-1");
  expect(request.searchParams.get("access_role_code")).toBe("neq.INSTRUCTOR");
});

test("switching the employee group from page two starts RH on its first page", async ({
  page,
}) => {
  const rh = makeEmployee({
    id: "00000000-0000-4000-8000-000000000200",
    full_name: "Gestora de RH",
    member_group: "rh",
    access_role_code: "MANAGER",
  });
  const state = await setup(page, { employees: [...classRoster(), rh] });
  await page.goto("/#/colaboradores");
  await page.getByRole("button", { name: "Próxima página" }).click();
  await expect(page.locator(".pagination")).toContainText("2 de 2");
  await page.getByRole("tab", { name: "Equipe de RH", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Equipe de RH", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: /Gestora de RH/ })).toBeVisible();
  await expect(page.locator(".pagination")).toContainText("1 de 1");
  expect(
    calls(state, "/employees").at(-1)?.url.searchParams.get("offset"),
  ).toBe("0");
});

test("an employee-list connection error remains distinct from empty data and retries", async ({
  page,
}) => {
  const state = await setup(page);
  state.failures["employees-list"] = 100;
  await page.goto("/#/colaboradores");
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar os registros.",
  );
  await expect(
    page.getByText("Nenhum registro encontrado.", { exact: true }),
  ).toHaveCount(0);
  state.failures["employees-list"] = 0;
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: /Pessoa de Teste/ }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("profile documents distinguish a failed read from empty data and reload through retry", async ({
  page,
}) => {
  const attachment = makeAttachment();
  const state = await setup(page, { attachments: [attachment] });
  state.failures["attachments-list"] = 100;
  await page.goto(`/#/colaboradores/${employee}`);
  await expect(
    page.getByRole("heading", { name: "Pessoa de Teste", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Documentos", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar os registros.",
  );
  await expect(
    page.getByText("Nenhum documento anexado.", { exact: true }),
  ).toHaveCount(0);
  state.failures["attachments-list"] = 0;
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(page.locator(".file-row")).toContainText(attachment.filename);
  await expect(page.getByRole("alert")).toHaveCount(0);
  const query = calls(state, "/attachments").at(-1)!.url;
  expect(query.searchParams.get("employee_id")).toBe(`eq.${employee}`);
  expect(query.searchParams.get("archived")).toBe("eq.false");
  await page.reload();
  await page.getByRole("tab", { name: "Documentos", exact: true }).click();
  await expect(page.locator(".file-row")).toContainText(attachment.filename);
});

test("profile feedbacks distinguish a failed read from empty data and retry the employee query", async ({
  page,
}) => {
  const feedback = makeFeedback();
  const state = await setup(page, {
    feedbacks: [feedback],
    permissions: ["employee.view", "feedback.view"],
  });
  state.failures["profile-feedbacks"] = 100;
  await page.goto(`/#/colaboradores/${employee}`);
  await expect(
    page.getByRole("heading", { name: "Pessoa de Teste", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Feedbacks", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar os registros.",
  );
  await expect(
    page.getByText("Nenhum registro encontrado.", { exact: true }),
  ).toHaveCount(0);
  state.failures["profile-feedbacks"] = 0;
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  const card = page.getByRole("button", { name: /Plano de desenvolvimento/ });
  await expect(card).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  const query = calls(state, "/feedbacks").at(-1)!.url;
  expect(query.searchParams.get("employee_id")).toBe(`eq.${employee}`);
  expect(query.searchParams.get("select")).toBe("*");
  await card.click();
  await expect(
    page.getByRole("dialog", { name: feedback.title, exact: true }),
  ).toContainText(feedback.description);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  await page.reload();
  await page.getByRole("tab", { name: "Feedbacks", exact: true }).click();
  await expect(card).toBeVisible();
});

test("a manager creates and reloads a released feedback with its complete saved payload", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/#/feedbacks");
  await page
    .getByRole("button", { name: "Novo feedback", exact: true })
    .click();
  const form = page.getByRole("dialog", { name: "Novo feedback", exact: true });
  await form.getByLabel("Colaborador", { exact: true }).selectOption(employee);
  await form.getByLabel("Título", { exact: true }).fill("Entregas da semana");
  await form.getByLabel("Tipo", { exact: true }).selectOption("recognition");
  await form.getByLabel("Prazo", { exact: true }).fill("2026-10-30");
  await form
    .getByLabel("Descrição", { exact: true })
    .fill("As tarefas foram entregues com qualidade.");
  await form
    .getByLabel("Pontos positivos", { exact: true })
    .fill("Colaboração com a equipe.");
  await form
    .getByLabel("Pontos a desenvolver", { exact: true })
    .fill("Compartilhar os próximos passos.");
  await form
    .getByLabel("Ações combinadas", { exact: true })
    .fill("Atualização na reunião semanal.");
  await form.getByLabel("Situação", { exact: true }).selectOption("following");
  await form.getByLabel("Liberar para o colaborador", { exact: true }).check();
  await form.getByLabel("Permitir resposta", { exact: true }).check();
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Entregas da semana", exact: true }),
  ).toBeVisible();
  expect(calls(state, "/rpc/save_entity").at(-1)?.body).toEqual({
    entity: "feedbacks",
    expected_version: null,
    payload: {
      employee_id: employee,
      title: "Entregas da semana",
      kind: "recognition",
      due_date: "2026-10-30",
      description: "As tarefas foram entregues com qualidade.",
      strengths: "Colaboração com a equipe.",
      improvements: "Compartilhar os próximos passos.",
      actions: "Atualização na reunião semanal.",
      status: "following",
      released: true,
      allow_response: true,
    },
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Entregas da semana", exact: true })
    .click();
  const detail = page.getByRole("dialog", {
    name: "Entregas da semana",
    exact: true,
  });
  await expect(detail).toContainText(
    "As tarefas foram entregues com qualidade.",
  );
  await expect(detail).toContainText("Colaboração com a equipe.");
  await expect(detail).toContainText("Em acompanhamento");
  await expect(
    detail.getByRole("button", { name: "Li este feedback", exact: true }),
  ).toBeVisible();
  await expect(detail.getByLabel("Resposta", { exact: true })).toBeVisible();
});

test("an employee confirms reading, retries a failed response without losing text and reloads the followup", async ({
  page,
}) => {
  const state = await setup(page, {
    feedbacks: [makeFeedback()],
    permissions: ["employee.view", "feedback.view"],
  });
  state.failures.feedback_reply = 1;
  await page.goto("/#/feedbacks");
  await expect(
    page.getByRole("button", { name: "Novo feedback", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Plano de desenvolvimento", exact: true })
    .click();
  const detail = page.getByRole("dialog", {
    name: "Plano de desenvolvimento",
    exact: true,
  });
  await detail
    .getByRole("button", { name: "Li este feedback", exact: true })
    .click();
  await expect(
    detail.getByRole("button", { name: "Leitura confirmada", exact: true }),
  ).toBeDisabled();
  expect(calls(state, "/rpc/feedback_reply").at(-1)?.body).toEqual({
    identifier: feedbackId,
    body: null,
    mark_read: true,
  });

  const response = "Vou compartilhar o resumo das entregas toda sexta-feira.";
  await detail.getByLabel("Resposta", { exact: true }).fill(response);
  await detail
    .getByRole("button", { name: "Enviar resposta", exact: true })
    .click();
  await expect(
    page.getByText("Sem conexão. Tente novamente.", { exact: true }),
  ).toBeVisible();
  await expect(detail.getByLabel("Resposta", { exact: true })).toHaveValue(
    response,
  );
  await expect(detail.locator(".comment")).toHaveCount(0);
  await detail
    .getByRole("button", { name: "Enviar resposta", exact: true })
    .click();
  await expect(detail.locator(".comment")).toContainText(response);
  await expect(detail.locator(".comment")).toContainText("Você");
  await expect(detail.getByLabel("Resposta", { exact: true })).toHaveValue("");
  expect(
    calls(state, "/rpc/feedback_reply")
      .slice(1)
      .map((call) => call.body),
  ).toEqual([
    { identifier: feedbackId, body: response, mark_read: false },
    { identifier: feedbackId, body: response, mark_read: false },
  ]);
  await page.reload();
  await page
    .getByRole("button", { name: "Plano de desenvolvimento", exact: true })
    .click();
  await expect(
    detail.getByRole("button", { name: "Leitura confirmada", exact: true }),
  ).toBeDisabled();
  await expect(detail.locator(".comment")).toContainText(response);
});

test("an absence justification retries submission and file upload then reloads the saved attachment", async ({
  page,
}) => {
  const state = await setup(page);
  state.failures.submit_justification = 1;
  state.failures["storage-upload:justifications"] = 1;
  await page.goto("/#/faltas");
  await page.getByRole("button", { name: "Justificar", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Nova justificativa",
    exact: true,
  });
  await dialog.getByLabel("Tipo", { exact: true }).selectOption(categoryId);
  await dialog
    .getByLabel("Motivo", { exact: true })
    .fill("Consulta médica agendada.");
  await dialog
    .getByRole("button", { name: "Enviar justificativa", exact: true })
    .click();
  await expect(
    page.getByText("Sem conexão. Tente novamente.", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Motivo", { exact: true })).toHaveValue(
    "Consulta médica agendada.",
  );
  await dialog
    .getByRole("button", { name: "Enviar justificativa", exact: true })
    .click();
  await expect(
    dialog.getByText("Justificativa enviada.", { exact: true }),
  ).toBeVisible();
  expect(
    calls(state, "/rpc/submit_justification").map((call) => call.body),
  ).toEqual([
    {
      member_identifier: member,
      category_identifier: categoryId,
      reason: "Consulta médica agendada.",
    },
    {
      member_identifier: member,
      category_identifier: categoryId,
      reason: "Consulta médica agendada.",
    },
  ]);

  const fileInput = dialog.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "atestado.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from("invalid for justifications"),
  });
  await expect(
    page.getByText(
      "Escolha um arquivo permitido, com até 10 MB e nome válido.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    state.requests.filter((request) =>
      request.url.pathname.startsWith("/storage/v1/object/"),
    ),
  ).toHaveLength(0);

  const proof = {
    name: "atestado.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nLocal fixture proof"),
  };
  await fileInput.setInputFiles(proof);
  await expect(fileInput).toBeEnabled();
  expect(calls(state, "/rpc/attach_file")).toHaveLength(0);
  await expect(
    dialog.getByText("Nenhum documento anexado.", { exact: true }),
  ).toBeVisible();
  await fileInput.setInputFiles(proof);
  await expect(dialog.locator(".file-row")).toContainText("atestado.pdf");
  const attached = calls(state, "/rpc/attach_file").at(-1)!.body!
    .payload as Record<string, unknown>;
  expect(attached).toEqual({
    employee_id: employee,
    justification_id: justificationId,
    feedback_id: null,
    bucket: "justifications",
    path: expect.stringMatching(new RegExp(`^${employee}/[0-9a-f-]+\\.pdf$`)),
    filename: "atestado.pdf",
    size_bytes: proof.buffer.length,
    mime_type: "application/pdf",
  });
  expect(state.uploaded.has(`justifications/${attached.path}`)).toBe(true);
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.goto("/#/justificativas");
  await page.reload();
  await page
    .getByRole("button", { name: /Pessoa de Teste Consulta médica agendada/ })
    .click();
  const saved = page.getByRole("dialog", {
    name: "Justificativa",
    exact: true,
  });
  await expect(saved).toContainText("Consulta médica agendada.");
  await expect(saved.locator(".file-row")).toContainText("atestado.pdf");
  const attachmentQuery = calls(state, "/attachments").at(-1)!.url;
  expect(attachmentQuery.searchParams.get("employee_id")).toBe(
    `eq.${employee}`,
  );
  expect(attachmentQuery.searchParams.get("justification_id")).toBe(
    `eq.${justificationId}`,
  );
  expect(attachmentQuery.searchParams.get("archived")).toBe("eq.false");
});

test("a justification review carries the expected version and persists its decision and analysis", async ({
  page,
}) => {
  const state = await setup(page, { justifications: [makeJustification()] });
  await page.goto("/#/justificativas");
  await page
    .getByRole("button", { name: /Pessoa de Teste Consulta médica agendada/ })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Justificativa",
    exact: true,
  });
  await dialog.getByLabel("Decisão", { exact: true }).selectOption("accepted");
  await dialog
    .getByLabel("Comentário da análise", { exact: true })
    .fill("Documento confere com a data da falta.");
  page.once("dialog", (confirmation) => confirmation.accept());
  await dialog
    .getByRole("button", { name: "Confirmar análise", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(calls(state, "/rpc/review_justification").at(-1)?.body).toEqual({
    identifier: justificationId,
    decision: "accepted",
    note: "Documento confere com a data da falta.",
    expected_version: 7,
  });
  await expect(
    page.getByText("Nenhum registro encontrado.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Situação da justificativa", { exact: true })
    .selectOption("accepted");
  await page
    .getByRole("button", { name: /Pessoa de Teste Consulta médica agendada/ })
    .click();
  await expect(dialog).toContainText("Aceita");
  await expect(dialog).toContainText(
    "Análise: Documento confere com a data da falta.",
  );
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.reload();
  await page
    .getByLabel("Situação da justificativa", { exact: true })
    .selectOption("accepted");
  await expect(
    page.getByRole("button", {
      name: /Pessoa de Teste Consulta médica agendada/,
    }),
  ).toContainText("Aceita");
});

test("an attachment registration failure removes its uploaded object before retry", async ({
  page,
}) => {
  const state = await setup(page, { justifications: [makeJustification()] });
  state.failures.attach_file = 1;
  await page.goto("/#/justificativas");
  await page
    .getByRole("button", { name: /Pessoa de Teste Consulta médica agendada/ })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Justificativa",
    exact: true,
  });
  const fileInput = dialog.locator('input[type="file"]');
  const proof = {
    name: "atestado.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nLocal fixture proof"),
  };
  await fileInput.setInputFiles(proof);
  await expect(
    page.getByText("Sem conexão. Tente novamente.", { exact: true }),
  ).toBeVisible();
  await expect(fileInput).toBeEnabled();
  await expect(dialog.locator(".file-row")).toHaveCount(0);
  expect(state.uploaded.size).toBe(0);
  const removal = state.requests.find(
    (request) =>
      request.method === "DELETE" &&
      request.url.pathname.endsWith("/object/justifications"),
  );
  expect(removal?.body).toEqual({
    prefixes: [
      expect.stringMatching(new RegExp(`^${employee}/[0-9a-f-]+\\.pdf$`)),
    ],
  });
  await fileInput.setInputFiles(proof);
  await expect(dialog.locator(".file-row")).toContainText("atestado.pdf");
  expect(state.uploaded.size).toBe(1);
});

test("RH support retries a failed ticket, cleans the attachment, saves open status and prepares WhatsApp context", async ({
  page,
}) => {
  const state = await setup(page);
  state.failures["ticket-insert"] = 1;
  await page.goto("/#/suporte-ti");
  await page
    .getByRole("button", { name: /Acesso ou login Problema para entrar/ })
    .click();
  await page
    .getByLabel("Resumo do problema", { exact: true })
    .fill("  Não consigo abrir o perfil  ");
  await page
    .getByRole("textbox", { name: /^Descrição/ })
    .fill("  Ao selecionar a pessoa, o perfil continua carregando.  ");
  await page
    .getByRole("combobox", { name: "Página relacionada", exact: true })
    .selectOption("/colaboradores");
  await page.locator('input[type="file"]').setInputFiles({
    name: "Evidência de acesso.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nIsolated support proof"),
  });
  await page
    .getByRole("button", { name: "Registrar e abrir WhatsApp", exact: true })
    .click();
  await expect(
    page.getByText("Não foi possível registrar o chamado. Tente novamente.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Resumo do problema", { exact: true }),
  ).toHaveValue("  Não consigo abrir o perfil  ");
  await expect(
    page.getByRole("button", {
      name: "Registrar e abrir WhatsApp",
      exact: true,
    }),
  ).toBeEnabled();
  expect(state.tickets).toHaveLength(0);
  expect(state.whatsapp).toHaveLength(0);
  expect(state.uploaded.size).toBe(0);
  const cleanup = state.requests.find(
    (request) =>
      request.method === "DELETE" &&
      request.url.pathname.endsWith("/object/ti-support"),
  );
  expect(cleanup?.body).toEqual({
    prefixes: [
      expect.stringMatching(
        new RegExp(`^${owner}/[0-9a-f-]+/Evidencia-de-acesso\\.pdf$`),
      ),
    ],
  });

  await page
    .getByRole("button", { name: "Registrar e abrir WhatsApp", exact: true })
    .click();
  await expect(page.locator(".support-success")).toContainText(
    /Chamado TI-20261009-[0-9A-F]{6} registrado\./,
  );
  await expect.poll(() => state.whatsapp.length).toBe(1);
  expect(state.tickets).toHaveLength(1);
  const ticket = state.tickets[0];
  expect(ticket).toMatchObject({
    id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    user_id: owner,
    category: "access",
    subject: "Não consigo abrir o perfil",
    description: "Ao selecionar a pessoa, o perfil continua carregando.",
    page_path: "/colaboradores",
    page_url: "http://127.0.0.1:4173/colaboradores",
    page_title: "Colaboradores",
    attachment_path: expect.stringMatching(
      new RegExp(`^${owner}/[0-9a-f-]+/Evidencia-de-acesso\\.pdf$`),
    ),
    status: "open",
    technical_context: {
      browser: "Google Chrome",
      userAgent: expect.stringContaining("Chrome/"),
      viewport: "1280x720",
      screen: "1280x720",
      language: "en-US",
      online: true,
      platform: expect.any(String),
    },
  });
  const message = state.whatsapp[0].searchParams.get("text")!;
  expect(message).toContain("*Solicitante:* Pessoa de Teste");
  expect(message).toContain("*Motivo:* Acesso ou login");
  expect(message).toContain("*Resumo:* Não consigo abrir o perfil");
  expect(message).toContain("*Página relacionada:* Colaboradores");
  expect(message).toContain(
    "*Link da página:* http://127.0.0.1:4173/colaboradores",
  );
  expect(message).toContain(
    `/storage/v1/object/sign/ti-support/${ticket.attachment_path}`,
  );
  expect(message).toContain("token=fixture-signed-token");
  const protocol = `TI-20261009-${String(ticket.id).slice(0, 6).toUpperCase()}`;
  expect(message).toContain(`*Protocolo:* ${protocol}`);
  await expect(
    page.getByRole("link", { name: "Abrir WhatsApp", exact: true }),
  ).toHaveAttribute("href", state.whatsapp[0].href);
});
