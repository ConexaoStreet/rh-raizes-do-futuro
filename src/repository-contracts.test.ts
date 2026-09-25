import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("repository contracts", () => {
  it("keeps the Datasul mascot mounted and visibly styled", () => {
    const app = read("apps/ti/src/App.tsx");
    const styles = read("apps/ti/src/styles.css");
    expect(app).toContain('data-testid="datasul-mascot"');
    expect(app).toContain('placement="datasul"');
    expect(app).toContain('scopeSelector=".datasul-view-root"');
    expect(styles).toContain(".datasul-mascot-perch {");
    expect(styles).toContain(".root-mascot-datasul {");
    expect(styles).not.toMatch(/\.datasul-mascot-perch\s*\{[^}]*display\s*:\s*none/s);
  });

  it("keeps the Datasul bridge full-featured and origin-restricted", () => {
    const source = read("supabase/functions/datasul-bridge/index.ts");
    expect(source).toContain('action === "request"');
    expect(source).toContain('"ti.datasul.write"');
    expect(source).toContain('"ti.datasul.delete"');
    expect(source).not.toContain('"Access-Control-Allow-Origin": "*"');
  });

  it("keeps administrative Edge Functions origin-restricted", () => {
    for (const path of [
      "supabase/functions/platform-bridge/index.ts",
      "supabase/functions/ti-admin-bridge/index.ts",
      "supabase/functions/email-2fa/index.ts",
    ]) {
      expect(read(path)).not.toContain('"Access-Control-Allow-Origin": "*"');
    }
  });

  it("pins JWT verification for every deployed Edge Function", () => {
    const config = read("supabase/config.toml");
    for (const name of [
      "email-2fa",
      "datasul-bridge",
      "platform-bridge",
      "manager-activation",
      "push-notify",
      "registration-bootstrap",
      "profile-photo-verify",
      "ti-admin-bridge",
      "ti-code-login",
    ]) {
      expect(config).toContain(`[functions.${name}]`);
    }
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
