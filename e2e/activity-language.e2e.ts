import { expect, test, type Page } from "@playwright/test";

const owner = "20000000-0000-4000-8000-000000000001";
const person = "20000000-0000-4000-8000-000000000002";
const manager = "20000000-0000-4000-8000-000000000003";
const entries = [
  {
    id: "activity-1",
    created_at: "2026-10-10T12:00:00Z",
    actor_name: "Maria",
    action: "update",
    module: "attendance_members",
    success: true,
    event_type: "data_change",
    severity: "info",
    old_values: { full_name_snapshot: "João", status: "absent", version: 1 },
    new_values: { full_name_snapshot: "João", status: "present", version: 2 },
    context: {},
  },
  {
    id: "activity-2",
    created_at: "2026-10-10T11:00:00Z",
    actor_name: "Lucas",
    action: "change_access",
    module: "profiles",
    entity_id: person,
    success: true,
    event_type: "permission_change",
    severity: "info",
    old_values: { status: "blocked", roles: [] },
    new_values: { status: "active", roles: [manager] },
    context: { reason: "Cadastro conferido pela equipe" },
  },
  {
    id: "activity-3",
    created_at: "2026-10-10T10:00:00Z",
    actor_name: null,
    action: "future_internal_action",
    module: "internal_service_table",
    success: false,
    event_type: "security",
    severity: "warning",
    context: {},
  },
  {
    id: "activity-4",
    created_at: "2026-10-10T09:00:00Z",
    actor_name: "Maria",
    action: "otp_failed",
    module: "security",
    success: false,
    event_type: "authentication",
    severity: "warning",
    context: {},
  },
];

async function setup(page: Page) {
  await page.addInitScript(
    ({ owner }) => {
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
          refresh_token: "test-refresh",
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
      sessionStorage.setItem("raizes-inauguracao-2026-09-29", "1");
      sessionStorage.setItem("raizes-ti-intro-seen", "1");
    },
    { owner },
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
          terms_accepted_at: "2026-10-01",
        },
        roles: ["SUPER_ADMIN"],
        permissions: [
          "audit.view",
          "audit.security",
          "user.view",
          "role.manage",
          "employee.view",
          "ti.view",
          "ti.manage",
          "ti.database.view",
          "ti.security.view",
        ],
        privileged: true,
        mfa_required: false,
        mfa_verified: true,
        recently_verified: true,
        ready: true,
        employee_id: person,
        server_time: "2026-10-10T12:00:00Z",
        maintenance: { enabled: false },
      };
    if (path.endsWith("/rpc/site_status"))
      response = {
        maintenance: { enabled: false },
        updates: [],
        server_time: "2026-10-10T12:00:00Z",
      };
    if (path.endsWith("/audit_logs")) {
      response = entries.filter(
        (entry) =>
          (!url.searchParams.get("event_type") ||
            url.searchParams.get("event_type") === "eq." + entry.event_type) &&
          (!url.searchParams.get("success") ||
            url.searchParams.get("success") === "eq." + entry.success) &&
          (!url.searchParams.get("actor_name") ||
            (entry.actor_name || "")
              .toLowerCase()
              .includes(
                url.searchParams
                  .get("actor_name")!
                  .replace("ilike.%", "")
                  .replace(/%$/, "")
                  .toLowerCase(),
              )),
      );
    }
    if (path.endsWith("/profiles"))
      response = [
        { id: owner, full_name: "Pessoa de Teste", status: "active" },
        { id: person, full_name: "João", status: "active" },
      ];
    if (path.endsWith("/roles"))
      response = [
        {
          id: manager,
          name: "Gestor",
          code: "MANAGER",
          level: 50,
          active: true,
        },
      ];
    if (path.endsWith("/settings"))
      response = [{ key: "maintenance", value: { enabled: false } }];
    if (path.endsWith("/ti_datasul_operations"))
      response = [
        {
          id: "operation-1",
          actor_name: "Maria",
          method: "GET",
          path: "/api/internal-resource",
          response_status: 403,
          error_message: "INTERNAL_FORBIDDEN_DETAIL",
          duration_ms: 1500,
          success: false,
          created_at: "2026-10-10T12:00:00Z",
        },
      ];
    const headers = path.endsWith("/audit_logs")
      ? {
          "content-range": `0-${Math.max(0, (response as unknown[]).length - 1)}/${(response as unknown[]).length}`,
          "access-control-expose-headers": "content-range",
        }
      : {};
    await route.fulfill({ json: response, headers });
  });
}

test("RH explains activities and changes without database terms", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/#/auditoria");
  await expect(
    page.getByRole("heading", { name: "Histórico de atividades", exact: true }),
  ).toBeVisible();
  const list = page.getByRole("list", { name: "Atividades do site" });
  await expect(list).toContainText("Maria atualizou uma presença.");
  await expect(list).toContainText("João");
  await expect(page.getByText("4 registros", { exact: true })).toBeVisible();
  await expect(list).not.toContainText(
    /attendance_members|future_internal_action|internal_service_table|otp_failed/,
  );
  await page
    .getByRole("button", { name: "Ver detalhes: Atualizou uma presença" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Situação");
  await expect(dialog).toContainText("Ausente");
  await expect(dialog).toContainText("Presente");
  await expect(dialog).not.toContainText(
    /version|old_values|new_values|status|00000000/,
  );
});

test("RH filters result and actor using ordinary labels", async ({ page }) => {
  await setup(page);
  await page.goto("/#/auditoria");
  await page
    .getByRole("combobox", { name: "Resultado", exact: true })
    .selectOption("false");
  await expect(page.locator(".activity-item")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Resultado", exact: true })
    .selectOption("");
  await page.getByLabel("Nome de quem fez").fill("Lucas");
  await expect(page.locator(".activity-item")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Ver detalhes: Alterou o acesso de uma conta",
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Gestor");
  await expect(page.getByRole("dialog")).toContainText(
    "Cadastro conferido pela equipe",
  );
});

test("RH activity list and before/after fit small screens", async ({
  page,
}) => {
  await setup(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/auditoria");
    await expect(
      page.getByRole("list", { name: "Atividades do site" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Ver detalhes: Atualizou uma presença" })
      .click();
    await expect(page.getByRole("dialog")).toContainText("O que mudou");
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page.keyboard.press("Escape");
  }
});

test("TI explains site activity and Datasul responses in ordinary language", async ({
  page,
}) => {
  await setup(page);
  await page.goto("http://127.0.0.1:4174/");
  await page
    .getByRole("button", { name: "Histórico de atividades", exact: true })
    .click();
  const list = page.getByRole("list", { name: "Atividades do site" });
  await expect(list).toContainText("Maria atualizou uma presença.");
  await expect(list).not.toContainText(
    /attendance_members|future_internal_action|internal_service_table|otp_failed/,
  );
  await list.locator("summary").first().click();
  await expect(list).toContainText("Situação");
  const datasul = page.getByRole("list", {
    name: "Atividades da conexão com Datasul",
  });
  await expect(datasul).toContainText("O Datasul não autorizou esse acesso.");
  await expect(datasul).toContainText("1,5 segundos");
  await expect(datasul).not.toContainText(
    /GET|403|internal-resource|INTERNAL_FORBIDDEN_DETAIL/,
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
});
