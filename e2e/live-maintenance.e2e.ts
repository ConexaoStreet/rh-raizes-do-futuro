import { test, expect } from "@playwright/test";

const status = {
  maintenance: {
    enabled: true,
    title: "O site está em manutenção",
    message: "Estamos conferindo as áreas do RH.",
    started_at: "2026-10-09T22:00:00Z",
  },
  updates: [
    {
      sequence: 2,
      pack: 1,
      kind: "release",
      status: "published",
      title: "Acompanhamento disponível",
      body: "Agora você pode ver cada etapa por aqui.",
      release_tag: "1.1.0",
      created_at: "2026-10-09T22:05:00Z",
      updated_at: "2026-10-09T22:05:00Z",
    },
    {
      sequence: 1,
      pack: 1,
      kind: "progress",
      status: "working",
      title: "Começamos a revisão",
      body: "Estamos conferindo o RH por partes.",
      release_tag: null,
      created_at: "2026-10-09T22:00:00Z",
      updated_at: "2026-10-09T22:00:00Z",
    },
  ],
  server_time: "2026-10-09T22:05:00Z",
};

test("maintenance and live history work before authentication on mobile and desktop", async ({
  page,
}) => {
  await page.route("**/rest/v1/rpc/site_status", (route) =>
    route.fulfill({ json: status }),
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/ao-vivo");
    await expect(
      page.getByRole("heading", { name: "Estamos cuidando do Raízes." }),
    ).toBeVisible();
    await expect(
      page.getByText("O site está em manutenção", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Atualização #002 · Pacote 01", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Versões publicadas" }).click();
    await expect(
      page.getByRole("heading", { name: "Começamos a revisão" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Tudo", exact: true }).click();
    await page.getByRole("link", { name: "Voltar ao site" }).click();
    await expect(
      page.getByRole("status", { name: "Manutenção do site" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Tema atual/ }),
    ).toBeVisible();
    const notice = await page
      .getByRole("status", { name: "Manutenção do site" })
      .boundingBox();
    const theme = await page
      .getByRole("button", { name: /Tema atual/ })
      .boundingBox();
    expect(notice).not.toBeNull();
    expect(theme).not.toBeNull();
    expect(theme!.y).toBeGreaterThanOrEqual(notice!.y + notice!.height);
    await page.getByRole("link", { name: "Acompanhar ao vivo" }).click();
  }
  await page.getByRole("link", { name: "Voltar ao site" }).click();
  await expect(
    page.getByRole("link", { name: "Acompanhar ao vivo" }),
  ).toBeVisible();
});
