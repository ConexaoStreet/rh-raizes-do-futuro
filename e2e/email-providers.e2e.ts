import { expect, test, type Page } from "@playwright/test";

const person = "Pessoa de Auditoria Email";
const department = "60000000-0000-4000-8000-000000000001";
const fixturePassword = "TesteLocal123!";

async function openCredentials(page: Page) {
  const unexpected: string[] = [];
  const signup: Record<string, unknown>[] = [];
  await page.addInitScript(() => sessionStorage.setItem("raizes-inauguracao-2026-09-29", "1"));
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON() ?? {};
    let response: unknown;
    if (path === "/rest/v1/rpc/site_status") {
      response = { maintenance: { enabled: false }, updates: [] };
    } else if (path === "/functions/v1/registration-bootstrap" && body.action === "options") {
      response = { class: { id: department, name: "Turma de teste", code: "EMAIL" }, departments: [{ id: department, name: "Setor de teste" }], registrations: [person], roles: [] };
    } else if (path === "/functions/v1/registration-bootstrap" && body.action === "match") {
      response = { matched: body.full_name === person, canonical_name: person };
    } else if (path === "/auth/v1/signup") {
      signup.push(body);
      response = { user: { id: department, email: body.email, identities: [] }, session: null };
    } else {
      unexpected.push(`${route.request().method()} ${path}`);
      return route.fulfill({ status: 500, json: { error: "UNEXPECTED_FIXTURE_REQUEST" } });
    }
    await route.fulfill({ status: 200, json: response });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Ativar cadastro" }).click();
  await page.getByLabel("Quem é você?").fill(person);
  await page.getByRole("option", { name: person, exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  return { unexpected, signup };
}

for (const email of ["pessoa@outlook.com", "pessoa+rh@empresa.com.br", "auditoria@maxxspace.com"]) {
  test(`RH first access accepts ${email} and requests email confirmation`, async ({ page }) => {
    const fixture = await openCredentials(page);
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Telefone").fill("00000000000");
    await page.getByLabel("Senha", { exact: true }).fill(fixturePassword);
    await page.getByLabel("Confirmar senha").fill(fixturePassword);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.getByLabel("Departamento")).toBeVisible();
    await page.getByLabel("Departamento").selectOption(department);
    await page.getByRole("button", { name: "Verificar e-mail e ativar" }).click();
    await expect(page.getByText("Confira seu e-mail e abra o link de verificação.", { exact: false })).toBeVisible();
    expect(fixture.signup).toHaveLength(1);
    expect(fixture.signup[0].email).toBe(email);
    expect(fixture.signup[0].data).toEqual({ full_name: person, phone: "00000000000", requested_department_id: department });
    expect(fixture.unexpected).toEqual([]);
  });
}

test("RH first access still rejects invalid emails and mismatched passwords", async ({ page }) => {
  const fixture = await openCredentials(page);
  await page.getByLabel("E-mail", { exact: true }).fill("pessoa@@empresa.com");
  await page.getByLabel("Telefone").fill("00000000000");
  await page.getByLabel("Senha", { exact: true }).fill(fixturePassword);
  await page.getByLabel("Confirmar senha").fill(fixturePassword);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByText("Informe um endereço de e-mail válido.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Departamento")).toHaveCount(0);
  await page.getByLabel("E-mail", { exact: true }).fill("pessoa@empresa.com.br");
  await page.getByLabel("Confirmar senha").fill("OutraSenha123!");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByText("As senhas precisam ser iguais.", { exact: true })).toBeVisible();
  expect(fixture.signup).toEqual([]);
  expect(fixture.unexpected).toEqual([]);
});
