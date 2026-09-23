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
