import { expect, test } from "@playwright/test";

test("theme follows system and persists user choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "system");

  const toggle = page.getByRole("button", { name: /Tema atual:/ });
  await expect(toggle).toHaveAttribute("aria-label", /Automático/);

  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "light");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f5f7f5");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("raizes-theme"))).toBe("light");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: /Tema atual:/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#09120f");
});

test("login surface renders without uncaught browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Tema atual:/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("TI theme cycles and persists", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("http://127.0.0.1:4174/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "system");
  const toggle = page.getByRole("button", { name: /Tema atual:/ });
  await expect(toggle).toBeVisible();

  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("login surfaces do not overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);

  await page.goto("http://127.0.0.1:4174/");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("RH desktop login keeps brand and form in the same row", async ({ page }) => {
  await page.setViewportSize({ width: 1664, height: 936 });
  await page.goto("/");

  const layout = await page.evaluate(() => {
    const brand = document.querySelector<HTMLElement>(".login-brand");
    const panel = document.querySelector<HTMLElement>(".login-panel");
    const theme = document.querySelector<HTMLElement>(".login-theme-control");
    if (!brand || !panel || !theme) throw new Error("LOGIN_LAYOUT_MISSING");

    const brandRect = brand.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return {
      brandTop: brandRect.top,
      panelTop: panelRect.top,
      brandRight: brandRect.right,
      panelLeft: panelRect.left,
      brandBottom: brandRect.bottom,
      panelBottom: panelRect.bottom,
      viewportHeight: window.innerHeight,
      themePosition: getComputedStyle(theme).position,
    };
  });

  expect(Math.abs(layout.brandTop - layout.panelTop)).toBeLessThan(2);
  expect(Math.abs(layout.brandRight - layout.panelLeft)).toBeLessThan(2);
  expect(layout.brandBottom).toBeGreaterThanOrEqual(layout.viewportHeight - 2);
  expect(layout.panelBottom).toBeGreaterThanOrEqual(layout.viewportHeight - 2);
  expect(layout.themePosition).toBe("fixed");

  await expect(page.getByText("Acesso protegido")).toHaveCount(0);
  await expect(page.getByText("Ações auditadas")).toHaveCount(0);
  await expect(page.getByText("Dados por permissão")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
});

test("RH login stays readable at extreme zoom-equivalent desktop width", async ({ page }) => {
  await page.setViewportSize({ width: 6500, height: 3600 });
  await page.goto("/");

  const metrics = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(".login-card");
    const brandCopy = document.querySelector<HTMLElement>(".login-brand-copy");
    const mascot = document.querySelector<HTMLElement>(".root-mascot-login");
    if (!card || !brandCopy || !mascot) throw new Error("LOGIN_LAYOUT_MISSING");
    return {
      viewport: window.innerWidth,
      card: card.getBoundingClientRect().width,
      brandCopy: brandCopy.getBoundingClientRect().width,
      mascot: mascot.getBoundingClientRect().width,
      cardFont: Number.parseFloat(getComputedStyle(card).fontSize),
    };
  });

  expect(metrics.card / metrics.viewport).toBeGreaterThan(0.25);
  expect(metrics.brandCopy / metrics.viewport).toBeGreaterThan(0.25);
  expect(metrics.cardFont).toBeGreaterThan(40);
  expect(metrics.mascot).toBeGreaterThan(400);
});


test("internal apps stay non-indexable", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow,noarchive",
  );
  const rhRobots = await request.get("/robots.txt");
  expect(await rhRobots.text()).toContain("Disallow: /");

  await page.goto("http://127.0.0.1:4174/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow,noarchive",
  );
  const tiRobots = await request.get("http://127.0.0.1:4174/robots.txt");
  expect(await tiRobots.text()).toContain("Disallow: /");
});


test("PWA assets stay available", async ({ request }) => {
  const rhManifest = await request.get("/manifest.webmanifest");
  expect(rhManifest.ok()).toBe(true);
  expect((await rhManifest.json()).theme_color).toBe("#152522");
  expect((await request.get("/sw.js")).ok()).toBe(true);

  const tiManifest = await request.get(
    "http://127.0.0.1:4174/manifest.webmanifest",
  );
  expect(tiManifest.ok()).toBe(true);
  expect((await tiManifest.json()).theme_color).toBe("#08110e");
  expect((await request.get("http://127.0.0.1:4174/sw.js")).ok()).toBe(true);
});


test("first access uses the pre-registered onboarding flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ativar cadastro" }).click();

  await expect(
    page.getByRole("heading", { name: "Ativar meu cadastro" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toBeVisible();
  await expect(page.getByLabel("Gmail")).toBeVisible();
  await expect(page.getByLabel("Telefone")).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Confirmar senha")).toBeVisible();
  await expect(page.getByLabel("Turma")).toBeVisible();
  await expect(page.getByLabel("Departamento")).toBeVisible();
  await expect(page.getByLabel("Cargo")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ativar acesso de gestor" }),
  ).toHaveCount(0);
});

test("valid Gmail passes native browser validation in first access", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ativar cadastro" }).click();

  const email = page.locator('input[name="email"]');
  await email.fill("test.user.e2e@gmail.com");

  const valid = await email.evaluate(
    (element) => (element as HTMLInputElement).checkValidity(),
  );
  expect(valid).toBe(true);
});
