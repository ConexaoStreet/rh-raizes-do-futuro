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
