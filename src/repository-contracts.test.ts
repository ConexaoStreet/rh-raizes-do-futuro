import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("repository contracts", () => {
  it("keeps the email authentication Edge Function origin-restricted", () => {
    expect(read("supabase/functions/email-2fa/index.ts")).not.toContain('"Access-Control-Allow-Origin": "*"');
  });

  it("keeps JWT verification for RH authenticated Edge Functions", () => {
    const config = read("supabase/config.toml");
    for (const name of ["email-2fa", "manager-activation", "push-notify", "registration-bootstrap", "profile-photo-verify"]) {
      expect(config).toContain(`[functions.${name}]`);
    }
  });

  it("keeps the retired technical center out of the application", () => {
    expect(existsSync("apps/ti")).toBe(false);
    expect(existsSync("supabase/functions/ti-admin-bridge/index.ts")).toBe(false);
    const support = read("src/SupportTickets.tsx");
    expect(support).toContain("https://wa.me/");
    expect(support).not.toContain('from("ti_support_tickets")');
    expect(support).not.toContain('.storage.from("ti-support")');
  });

  it("keeps only the applied complete profile repair migration", () => {
    expect(
      existsSync(
        "supabase/migrations/20260925004745_repair_complete_profile_rpc_exposure.sql",
      ),
    ).toBe(true);
    expect(
      existsSync(
        "supabase/migrations/20260925005000_fix_complete_profile_rpc.sql",
      ),
    ).toBe(false);
  });
});
