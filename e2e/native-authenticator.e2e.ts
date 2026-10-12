import { expect, test, type Page } from "@playwright/test";

const api = "http://127.0.0.1:54321";
const owner = "73000000-0000-4000-8000-000000000001";
async function rhVerification(page: Page, existing: boolean) {
  const state = {
    factors: existing
      ? [{ id: "fixture-factor", factor_type: "totp", status: "verified" }]
      : ([] as { id: string; factor_type: string; status: string }[]),
    enrolls: 0,
    proofs: 0,
    bootstraps: 0,
    unexpected: [] as string[],
  };
  await page.addInitScript(
    ({ owner }) => {
      const encode = (value: unknown) =>
        btoa(JSON.stringify(value))
          .replace(/=/g, "")
          .replace(/\+/g, "-")
          .replace(/\//g, "_");
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token =
        encode({ alg: "HS256", typ: "JWT" }) +
        "." +
        encode({
          sub: owner,
          aud: "authenticated",
          role: "authenticated",
          exp,
        }) +
        ".c2lnbmF0dXJl";
      localStorage.setItem(
        "sb-127-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture-refresh",
          token_type: "bearer",
          expires_at: exp,
          expires_in: 3600,
          user: {
            id: owner,
            aud: "authenticated",
            email: "native@example.test",
            role: "authenticated",
            created_at: "2026-10-12T12:00:00Z",
          },
        }),
      );
      sessionStorage.setItem("raizes-inauguracao-2026-09-29", "1");
    },
    { owner },
  );
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:4173") {
      await route.continue();
      return;
    }
    if (url.hostname === "fonts.googleapis.com") {
      await route.fulfill({ contentType: "text/css", body: "" });
      return;
    }
    if (url.origin !== api) {
      state.unexpected.push(url.pathname);
      await route.abort();
      return;
    }
    const path = url.pathname;
    let json: unknown;
    if (path === "/rest/v1/rpc/site_status")
      json = { maintenance: { enabled: false }, updates: [] };
    else if (path === "/rest/v1/rpc/bootstrap") {
      state.bootstraps++;
      json = {
        profile: {
          id: owner,
          full_name: "Auditoria local",
          status: "active",
          onboarded_at: "2026-10-12T12:00:00Z",
          terms_accepted_at: "2026-10-12T12:00:00Z",
        },
        roles: ["MANAGER"],
        permissions: [],
        privileged: true,
        mfa_required: true,
        mfa_verified: false,
        recently_verified: false,
        ready: false,
        maintenance: { enabled: false },
        employee_id: null,
      };
    } else if (path === "/auth/v1/user")
      json = {
        id: owner,
        aud: "authenticated",
        role: "authenticated",
        email: "native@example.test",
        factors: state.factors,
      };
    else if (
      path === "/auth/v1/factors" &&
      route.request().method() === "POST"
    ) {
      state.enrolls++;
      state.factors.push({
        id: "fixture-pending",
        factor_type: "totp",
        status: "unverified",
      });
      json = {
        id: "fixture-pending",
        type: "totp",
        totp: {
          qr_code:
            '<svg xmlns="http://www.w3.org/2000/svg" width="232" height="232"><rect width="20" height="20" /></svg>',
          secret: "FIXTUREKEY",
        },
      };
    } else if (
      path === "/auth/v1/factors/fixture-pending" &&
      route.request().method() === "DELETE"
    ) {
      state.factors = state.factors.filter((f) => f.id !== "fixture-pending");
      json = {};
    } else if (path.endsWith("/challenge"))
      json = {
        id: "fixture-challenge",
        type: "totp",
        expires_at: Math.floor(Date.now() / 1000) + 300,
      };
    else if (path.endsWith("/verify")) {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token =
        Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
          "base64url",
        ) +
        "." +
        Buffer.from(
          JSON.stringify({
            sub: owner,
            role: "authenticated",
            aud: "authenticated",
            exp,
            aal: "aal2",
          }),
        ).toString("base64url") +
        ".c2lnbmF0dXJl";
      json = {
        access_token: token,
        refresh_token: "fixture-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: owner,
          aud: "authenticated",
          role: "authenticated",
          email: "native@example.test",
          factors: state.factors,
        },
      };
    } else if (path === "/rest/v1/rpc/confirm_authenticator_session") {
      state.proofs++;
      json = { ok: false };
    } else {
      state.unexpected.push(path);
      json = { error: "UNEXPECTED_FIXTURE_REQUEST" };
    }
    await route.fulfill({ status: 200, json });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Verificação de segurança",
      exact: true,
    }),
  ).toBeVisible();
  return state;
}

test("RH native verification stays open when application proof is refused", async ({
  page,
}) => {
  const state = await rhVerification(page, true);
  await page
    .getByRole("button", { name: "Usar aplicativo de códigos", exact: true })
    .click();
  await page.getByLabel("Código do aplicativo").fill("123456");
  const boots = state.bootstraps;
  await page
    .getByRole("button", { name: "Confirmar acesso", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    "Não foi possível confirmar o acesso. Tente novamente.",
  );
  await expect(
    page.getByRole("heading", {
      name: "Verificação de segurança",
      exact: true,
    }),
  ).toBeVisible();
  expect(state.bootstraps).toBe(boots);
  expect(state.proofs).toBe(1);
  expect(state.enrolls).toBe(0);
  expect(state.unexpected).toEqual([]);
});

test("RH explicitly sets up a native QR at 320px and discards the cancelled pending factor", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const state = await rhVerification(page, false);
  await page
    .getByRole("button", { name: "Usar aplicativo de códigos", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Configurar aplicativo", exact: true }),
  ).toBeVisible();
  expect(state.enrolls).toBe(0);
  await page
    .getByRole("button", { name: "Configurar aplicativo", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Código QR para configurar seu aplicativo" }),
  ).toBeVisible();
  await expect(page.getByText("FIXTUREKEY", { exact: true })).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Usar e-mail", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enviar código", exact: true }),
  ).toBeVisible();
  expect(state.factors).toEqual([]);
  expect(state.proofs).toBe(0);
  expect(state.unexpected).toEqual([]);
});
