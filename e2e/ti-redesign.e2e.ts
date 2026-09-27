import { expect, test } from "@playwright/test";

test("TI login remains stable across breakpoint matrix", async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("http://127.0.0.1:4174/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Entrar na Central de T.I" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      )
      .toBe(true);
  }
});
