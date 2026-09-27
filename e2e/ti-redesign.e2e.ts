import { expect, test } from "@playwright/test";

test("TI login remains stable across breakpoint matrix", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("raizes-ti-intro-seen", "1"));
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1100, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("http://127.0.0.1:4174/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".login-page, .access-page").first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      )
      .toBe(true);
  }
});


test("TI login keeps keyboard focus and mobile touch targets accessible", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("raizes-ti-intro-seen", "1"));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("http://127.0.0.1:4174/", { waitUntil: "domcontentloaded" });

  const passwordTab = page.getByRole("tab", { name: "E-mail e senha" });
  const codeTab = page.getByRole("tab", { name: "Código semanal" });
  const themeToggle = page.getByRole("button", { name: /Tema atual:/ });

  await passwordTab.focus();
  await expect(passwordTab).toBeFocused();

  const focusVisible = await passwordTab.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== "none" || style.boxShadow !== "none";
  });
  expect(focusVisible).toBe(true);

  await page.keyboard.press("Tab");
  await expect(codeTab).toBeFocused();

  const targets = await Promise.all(
    [passwordTab, codeTab, themeToggle].map(async (locator) => {
      const box = await locator.boundingBox();
      if (!box) throw new Error("TOUCH_TARGET_MISSING");
      return { width: box.width, height: box.height };
    }),
  );

  expect(targets.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
});
