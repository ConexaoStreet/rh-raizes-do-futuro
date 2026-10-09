import { expect, test, type Page } from "@playwright/test";

const owner = "00000000-0000-4000-8000-000000000001";
const employee = "00000000-0000-4000-8000-000000000002";
const cycles = [
  {
    id: "cycle-1",
    title: "1º período",
    start_date: "2026-09-01",
    end_date: "2026-09-30",
    status: "closed",
  },
  {
    id: "cycle-2",
    title: "2º período",
    start_date: "2026-10-01",
    end_date: "2026-10-31",
    status: "open",
  },
];
const criteria = [
  {
    id: "communication",
    name: "Comunicação e colaboração com toda a equipe",
    weight: 2,
    active: true,
  },
  { id: "organization", name: "Organização", weight: 1, active: true },
];
const metrics = {
  employees: 77,
  active_employees: 75,
  records: 40,
  pending: 0,
  present: 30,
  absent: 10,
  justified: 4,
  unjustified: 6,
  late: 3,
  delay_total: 15,
  delay_average: 5,
  attendance_rate: 75,
  punctuality_rate: 90,
  performance_average: 8,
  feedback_count: 2,
};

async function setup(page: Page, authenticated = false) {
  await page.addInitScript(
    ({ authenticated, owner }) => {
      sessionStorage.setItem("raizes-inauguracao-2026-09-29", "1");
      if (!authenticated) return;
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
          refresh_token: "test-refresh-token",
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
            created_at: "2026-10-01T00:00:00Z",
          },
        }),
      );
    },
    { authenticated, owner },
  );
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let response: unknown = [];
    if (path.endsWith("/rpc/bootstrap"))
      response = {
        profile: {
          id: owner,
          full_name: "Pessoa de Teste",
          status: "active",
          onboarded_at: "2026-10-01",
          photo_path: null,
        },
        roles: ["MANAGER"],
        permissions: [
          "dashboard.view",
          "employee.view",
          "attendance.manage",
          "performance.view",
          "performance.grade",
          "feedback.view",
          "report.view",
          "report.export",
          "calendar.manage",
          "settings.manage",
        ],
        privileged: true,
        mfa_required: false,
        mfa_verified: true,
        recently_verified: true,
        ready: true,
        server_time: "2026-10-09T12:00:00Z",
        employee_id: employee,
        maintenance: { enabled: false },
      };
    if (path.endsWith("/rpc/dashboard_snapshot"))
      response = {
        metrics,
        previous: metrics,
        series: [{ month: "2026-09", present: 30, absent: 10, justified: 4 }],
        records: [],
        grades: [],
        feedbacks: [],
      };
    if (path.endsWith("/employees"))
      response = [
        {
          id: employee,
          full_name: "Pessoa de Teste",
          registration: "TEST-001",
          status: "active",
        },
      ];
    if (path.endsWith("/performance_cycles")) response = cycles;
    if (path.endsWith("/performance_criteria")) response = criteria;
    if (path.endsWith("/performance_reviews"))
      response = [
        {
          id: "review-1",
          employee_id: employee,
          cycle_id: "cycle-1",
          released: true,
          created_at: "2026-09-30T12:00:00Z",
          updated_at: "2026-09-30T12:00:00Z",
          employees: { full_name: "Pessoa de Teste", registration: "TEST-001" },
          performance_cycles: cycles[0],
          performance_scores: [
            {
              criterion_id: "communication",
              criterion_name: criteria[0].name,
              score: 0,
              weight: 2,
            },
            {
              criterion_id: "organization",
              criterion_name: "Organização",
              score: 9,
              weight: 1,
            },
          ],
        },
      ];
    if (path.endsWith("/notifications"))
      response = [
        {
          id: "notification-1",
          user_id: owner,
          title: "Seu boletim foi atualizado",
          body: "Confira as notas do período.",
          path: "/notas",
          scope: "rh",
          event_type: "performance",
          read_at: null,
          created_at: "2026-10-09T12:00:00Z",
        },
      ];
    if (path.endsWith("/registration-bootstrap"))
      response = {
        registrations: ["Pessoa de Teste"],
        classes: [],
        departments: [],
        positions: [],
        managers: [],
      };
    if (path.endsWith("/rpc/public_status")) response = { maintenance: false };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Content-Range": "0-0/1", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(response),
    });
  });
}

test("login and activation stay readable across mobile widths and themes", async ({
  page,
}) => {
  await setup(page);
  for (const width of [320, 390, 430, 560, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Bom ter você aqui." }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    if (width === 1440)
      await page.screenshot({
        path: test.info().outputPath("login-desktop.png"),
        fullPage: true,
      });
    await page
      .getByRole("button", { name: "Ativar cadastro", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Ative seu acesso" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
});

test("dashboard gives page context and a keyboard search shortcut", async ({
  page,
}) => {
  await setup(page, true);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Bom dia, Pessoa." }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Visão geral | Raízes do Futuro");
  await page.screenshot({
    path: test.info().outputPath("dashboard-light.png"),
    fullPage: true,
  });
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", { name: "Busca global" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Pesquisar" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("mobile gradebook changes periods and preserves zero scores", async ({
  page,
}) => {
  await setup(page, true);
  for (const width of [320, 390, 430, 560]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#/notas");
    await expect(page.locator(".mobile-grade-card").first()).toBeVisible();
    await page.getByLabel("Período do boletim").selectOption("cycle-1");
    await expect(page.locator(".mobile-grade-card").first()).toContainText(
      "0,0",
    );
    await expect(page.locator(".mobile-grade-card").first()).toContainText(
      "Peso 2,0",
    );
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    if (width === 390)
      await page.screenshot({
        path: test.info().outputPath("gradebook-mobile.png"),
        fullPage: true,
      });
    await page.getByLabel("Período do boletim").selectOption("cycle-2");
    await expect(page.locator(".mobile-grade-list")).toContainText(
      "Nota ainda não lançada",
    );
    await expect(page.locator(".mobile-grade-list")).not.toContainText("0,0");
    await page.getByRole("button", { name: /Tema atual:/ }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
});

test("notification queries are scoped to this user and filter unread messages", async ({
  page,
}) => {
  const requests: URL[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/rest/v1/notifications"))
      requests.push(new URL(request.url()));
  });
  await setup(page, true);
  await page.goto("/#/notificacoes");
  await expect(
    page.getByRole("link", { name: "Seu boletim foi atualizado" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Não lidas", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Não lidas", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      requests.some((url) => url.searchParams.get("read_at") === "is.null"),
    )
    .toBe(true);
  expect(
    requests.every(
      (url) =>
        url.searchParams.get("scope") === "eq.rh" &&
        url.searchParams.get("user_id") === `eq.${owner}`,
    ),
  ).toBe(true);
});

test("global search distinguishes a connection error and can retry", async ({
  page,
}) => {
  await setup(page, true);
  let failed = true;
  await page.route(
    "http://127.0.0.1:54321/rest/v1/employees**",
    async (route) => {
      if (
        new URL(route.request().url()).searchParams.has("ilike") ||
        route.request().url().includes("ilike.")
      ) {
        await route.fulfill({
          status: failed ? 500 : 200,
          contentType: "application/json",
          body: JSON.stringify(
            failed
              ? { message: "Unavailable" }
              : [{ id: employee, full_name: "Pessoa de Teste" }],
          ),
        });
      } else await route.fallback();
    },
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Bom dia, Pessoa." }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByRole("textbox", { name: "Pesquisar" }).fill("Pessoa");
  await expect(page.getByRole("dialog")).toContainText(
    "Não foi possível carregar os registros.",
  );
  await expect(page.getByRole("dialog")).not.toContainText(
    "Nenhum registro encontrado.",
  );
  failed = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Pessoa de Teste Colaborador" }),
  ).toBeVisible();
});
