import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const owner = "10000000-0000-4000-8000-000000000001";
const deptA = "10000000-0000-4000-8000-000000000011";
const deptB = "10000000-0000-4000-8000-000000000012";
const general = "10000000-0000-4000-8000-000000000021";
const roomA = "10000000-0000-4000-8000-000000000022";
const departments = [
  { id: deptA, name: "Ecológico", members: 7, open_tasks: 1 },
  { id: deptB, name: "Marketing", members: 8, open_tasks: 0 },
];
const message = (id: string, room: string, text: string) => ({
  id,
  sequence: Number(id.split("-").at(-1)) || 1,
  room_id: room,
  author_id: owner,
  author_name: "Pessoa de Teste",
  body: text,
  filtered: false,
  moderated: false,
  attachments: [],
  created_at: "2026-10-09T20:00:00Z",
});
test("failed send preserves text and attachments and retries with the same identifier", async ({
  page,
}) => {
  const state = await setup(page, false);
  let first = true;
  const attempts: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/rpc/send_chat_message", async (route) => {
    attempts.push(route.request().postDataJSON());
    if (first) {
      first = false;
      await route.fulfill({
        status: 503,
        json: { message: "Conexão indisponível" },
      });
    } else await route.fallback();
  });
  await page.goto("/#/conversas");
  await page
    .getByLabel("Mensagem para Conversa geral")
    .fill("Pauta da próxima reunião");
  await page
    .locator('.chat-attach input[type="file"]')
    .setInputFiles({
      name: "pauta.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("dia;atividade\n1;reunião"),
    });
  await expect(page.locator(".chat-pending-files")).toContainText("pauta.csv");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByLabel("Mensagem para Conversa geral")).toBeEnabled();
  await expect(page.getByLabel("Mensagem para Conversa geral")).toHaveValue(
    "Pauta da próxima reunião",
  );
  await expect(page.locator(".chat-pending-files")).toContainText("pauta.csv");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.locator(".chat-message")).toHaveCount(1);
  expect(attempts).toHaveLength(2);
  expect(attempts[0].request_identifier).toBe(attempts[1].request_identifier);
  expect(state.sends).toHaveLength(1);
});
test("moderator reviews a report and removes its message", async ({ page }) => {
  const state = await setup(page);
  const reported = message(
    "message-1",
    general,
    "Mensagem que precisa de revisão",
  );
  state.messages.push(reported);
  let removed = false;
  await page.route("**/rest/v1/rpc/chat_reports_queue", (route) =>
    route.fulfill({
      json: {
        viewer: owner,
        room_id: general,
        reports: removed
          ? []
          : [
              {
                id: "report-1",
                reason: "Conferir conteúdo",
                created_at: "2026-10-09T20:00:00Z",
                message: reported,
              },
            ],
      },
    }),
  );
  await page.route("**/rest/v1/rpc/moderate_chat_message", async (route) => {
    removed = true;
    state.messages[0] = {
      ...reported,
      body: "Mensagem removida pela moderação.",
      moderated: true,
    };
    await route.fulfill({ json: null });
  });
  await page.goto("/#/conversas");
  await page.getByText("Mensagens para revisão (1)", { exact: true }).click();
  await page
    .locator(".chat-moderation-queue")
    .getByRole("button", { name: "Remover mensagem", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Motivo").fill("Conteúdo conferido pela equipe");
  await dialog
    .getByRole("button", { name: "Remover mensagem", exact: true })
    .click();
  await expect(page.locator(".chat-message")).toContainText(
    "Mensagem removida pela moderação.",
  );
  await expect(
    page.getByText("Mensagens para revisão (0)", { exact: true }),
  ).toBeVisible();
});
test("a new release is announced without reloading or losing a chat draft", async ({
  page,
}) => {
  await setup(page, false);
  const installed = JSON.parse(readFileSync(".generated/release.json", "utf8"));
  const manifest = {
    ...installed,
    commit: "c".repeat(40),
    version: "2.0.20261009999999-ccccccc",
    published_at: new Date(
      Date.parse(installed.published_at) + 60000,
    ).toISOString(),
    changes: ["Ajustamos o acompanhamento das equipes."],
  };
  await page.route("**/release.json", (route) =>
    route.fulfill({ json: manifest }),
  );
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/#/conversas");
  await page
    .getByLabel("Mensagem para Conversa geral")
    .fill("Rascunho que deve continuar aqui");
  await expect(
    page.getByRole("status", { name: "Nova versão disponível" }),
  ).toBeVisible();
  await expect(page.getByLabel("Mensagem para Conversa geral")).toHaveValue(
    "Rascunho que deve continuar aqui",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Depois", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Nova versão disponível" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Mensagem para Conversa geral")).toHaveValue(
    "Rascunho que deve continuar aqui",
  );
});
async function setup(page: Page, instructor = true) {
  const tasks: Record<string, unknown>[] = [];
  const messages: Record<string, unknown>[] = [];
  const sends: Record<string, unknown>[] = [];
  let nextAttachment = 1;
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
    },
    { owner },
  );
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().headers()["content-type"]?.includes("json")
      ? route.request().postDataJSON() || {}
      : {};
    let response: unknown = [];
    if (path.endsWith("/rpc/bootstrap"))
      response = {
        profile: {
          id: owner,
          full_name: "Pessoa de Teste",
          status: "active",
          onboarded_at: "2026-10-01",
        },
        roles: [instructor ? "INSTRUCTOR" : "COLLABORATOR"],
        permissions: [
          "workspace.view",
          "chat.use",
          ...(instructor
            ? [
                "workspace.overview",
                "workspace.instructor",
                "dashboard.view",
                "attendance.view",
                "performance.view",
                "employee.view",
                "report.view",
                "feedback.view",
              ]
            : []),
        ],
        ready: true,
        privileged: false,
        mfa_required: false,
        mfa_verified: true,
        employee_id: owner,
        maintenance: { enabled: false },
      };
    if (path.endsWith("/rpc/site_status"))
      response = {
        maintenance: { enabled: false },
        updates: [],
        server_time: "2026-10-09T20:00:00Z",
      };
    if (path.endsWith("/rpc/workspace_snapshot")) {
      const selected =
        departments.find((d) => d.id === body.department_identifier) ||
        departments[0];
      response = {
        viewer: owner,
        overview: instructor,
        department: selected,
        departments: instructor ? departments : [departments[0]],
        members: [
          {
            id: owner,
            full_name: "Pessoa de Teste",
            status: "active",
            profile_id: owner,
            account_active: true,
          },
        ],
        tasks: tasks.filter((t) => t.department_id === selected.id),
        metrics: {
          active_members: selected.members,
          open_tasks: tasks.filter((t) => t.status !== "done").length,
          completed_tasks: 0,
          attendance_records: 12,
          pending_justifications: 0,
        },
        generated_at: "2026-10-09T20:00:00Z",
      };
    }
    if (path.endsWith("/rpc/save_sector_task")) {
      const task = {
        ...body.payload,
        id: body.payload.id || "task-1",
        created_by: owner,
        version: (body.expected_version || 0) + 1,
        updated_at: "2026-10-09T20:00:00Z",
      };
      const index = tasks.findIndex((t) => t.id === task.id);
      if (index < 0) tasks.push(task);
      else tasks[index] = task;
      response = task;
    }
    if (path.endsWith("/rpc/chat_rooms_snapshot"))
      response = {
        viewer: owner,
        moderator: instructor,
        rooms: [
          { id: general, department_id: null, name: "Conversa geral" },
          { id: roomA, department_id: deptA, name: "Ecológico" },
        ],
      };
    if (path.endsWith("/rpc/chat_history"))
      response = {
        viewer: owner,
        room_id: body.room_identifier,
        messages: messages
          .filter((m) => m.room_id === body.room_identifier)
          .reverse(),
        has_more: false,
      };
    if (path.endsWith("/rpc/chat_reports_queue"))
      response = { viewer: owner, room_id: body.room_identifier, reports: [] };
    if (path.endsWith("/rpc/reserve_chat_attachment"))
      response = {
        id: `file-${nextAttachment++}`,
        path: `${body.payload.room_id}/${owner}/arquivo.csv`,
        filename: body.payload.filename,
        mime_type: body.payload.mime_type,
        size_bytes: body.payload.size_bytes,
      };
    if (path.endsWith("/rpc/send_chat_message")) {
      sends.push(body);
      response = {
        ...message(
          `message-${messages.length + 1}`,
          body.room_identifier,
          body.body,
        ),
        filtered: body.body === "p.o.r.r.a",
        body:
          body.body === "p.o.r.r.a"
            ? "[Mensagem filtrada por linguagem inadequada]"
            : body.body,
        attachments: body.attachment_identifiers.map((id: string) => ({
          id,
          filename: "pauta.csv",
          path: `${roomA}/${owner}/arquivo.csv`,
          mime_type: "text/csv",
          size_bytes: 12,
        })),
      };
      messages.push(response as Record<string, unknown>);
    }
    await route.fulfill({
      status: 200,
      json: response,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  return { tasks, messages, sends };
}

test("instructor sees sectors through organized tabs on mobile and desktop", async ({
  page,
}) => {
  await setup(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/instrutor");
    await expect(
      page.getByRole("heading", { name: "Área do instrutor", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
    await page.getByRole("tab", { name: "Turma e acompanhamento" }).click();
    await expect(
      page.getByRole("link", { name: "Notas e desenvolvimento" }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Equipe", exact: true }).click();
    await expect(page.locator(".workspace-member")).toContainText(
      "Pessoa de Teste",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("sector task can be created and its status changed", async ({ page }) => {
  const state = await setup(page, false);
  await page.goto("/#/meu-setor");
  await page.getByRole("tab", { name: "Tarefas", exact: true }).click();
  await page.getByRole("button", { name: "Nova tarefa", exact: true }).click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Preparar campanha ambiental");
  await page.getByLabel("Descrição").fill("Organizar os materiais da equipe.");
  await page.getByRole("button", { name: "Salvar tarefa" }).click();
  await expect(page.locator(".workspace-task")).toContainText(
    "Preparar campanha ambiental",
  );
  await page.getByRole("button", { name: "Editar tarefa" }).click();
  await page
    .getByRole("combobox", { name: "Andamento", exact: true })
    .selectOption("doing");
  await page.getByRole("button", { name: "Salvar tarefa" }).click();
  await expect(page.locator(".workspace-task-actions")).toContainText(
    "Em andamento",
  );
  expect(state.tasks[0].department_id).toBe(deptA);
  expect(state.tasks[0].version).toBe(2);
  await expect(
    page.getByRole("link", { name: "Área de gestores", exact: true }),
  ).toHaveCount(0);
});
test("chat sends filtered text and a spreadsheet without layout overflow", async ({
  page,
}) => {
  const state = await setup(page, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#/conversas?setor=${deptA}`);
  await expect(
    page.getByRole("heading", { name: "Ecológico", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Mensagem para Ecológico").fill("p.o.r.r.a");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.locator(".chat-message")).toContainText(
    "Mensagem filtrada por linguagem inadequada",
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "pauta.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("nome;dia\nEquipe;1"),
  });
  await expect(page.locator(".chat-pending-files")).toContainText("pauta.csv");
  await page.getByLabel("Mensagem para Ecológico").fill("Segue a pauta");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.locator(".chat-file")).toContainText("pauta.csv");
  expect(state.sends[1].attachment_identifiers).toEqual(["file-1"]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: /Conversa geral Todas/ }).click();
  await expect(
    page.getByRole("heading", { name: "Conversa geral", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".chat-message")).toHaveCount(0);
});
test("switching rooms hides previous messages while a request is pending and preserves each text draft", async ({
  page,
}) => {
  const state = await setup(page, false);
  state.messages.push(message("message-1", general, "Combinado da sala geral"));
  let release = () => {};
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/rest/v1/rpc/chat_history", async (route) => {
    const body = route.request().postDataJSON();
    if (body.room_identifier === roomA) await blocked;
    await route.fulfill({
      json: {
        viewer: owner,
        room_id: body.room_identifier,
        messages: body.room_identifier === general ? state.messages : [],
        has_more: false,
      },
    });
  });
  await page.goto("/#/conversas");
  await expect(page.locator(".chat-message")).toContainText(
    "Combinado da sala geral",
  );
  await page.getByLabel("Mensagem para Conversa geral").fill("Meu rascunho");
  await page.getByRole("button", { name: /Ecológico Equipe do setor/ }).click();
  await expect(
    page.getByRole("heading", { name: "Ecológico", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Combinado da sala geral", { exact: true }),
  ).toHaveCount(0);
  release();
  await page.getByRole("button", { name: /Conversa geral Todas/ }).click();
  await expect(page.getByLabel("Mensagem para Conversa geral")).toHaveValue(
    "Meu rascunho",
  );
});
