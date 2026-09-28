import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(
  new URL("../scripts/apply-supabase-auth-hardening.mjs", import.meta.url),
);

const cleanEnv = { ...process.env };
delete cleanEnv.SUPABASE_ACCESS_TOKEN;
delete cleanEnv.SUPABASE_PROJECT_REF;

const run = (args, env) =>
  spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });

const missingToken = run([scriptPath], cleanEnv);
assert.notEqual(
  missingToken.status,
  0,
  "Missing SUPABASE_ACCESS_TOKEN must fail closed.",
);
assert.match(missingToken.stderr, /SUPABASE_ACCESS_TOKEN is required/);

const missingProject = run(
  [scriptPath],
  { ...cleanEnv, SUPABASE_ACCESS_TOKEN: "test-token" },
);
assert.notEqual(missingProject.status, 0);
assert.match(missingProject.stderr, /SUPABASE_PROJECT_REF is required/);

const scriptUrl = pathToFileURL(scriptPath).href;

function probeSource(hibpStatus) {
  return `
const calls = [];
let coreBody = null;
globalThis.fetch = async (url, options = {}) => {
  const expected = "https://api.supabase.com/v1/projects/test-project/config/auth";
  if (String(url) !== expected) throw new Error("Unexpected URL");
  calls.push({ method: options.method, body: options.body ? JSON.parse(options.body) : null });

  if (options.method === "PATCH" && calls.length === 1) {
    const body = JSON.parse(options.body);
    coreBody = body;
    if (body.password_min_length !== 12) throw new Error("Weak minimum length");
    if (body.security_update_password_require_reauthentication !== true) throw new Error("Reauthentication missing");
    if (body.mailer_secure_email_change_enabled !== true) throw new Error("Secure email change missing");
    if (body.refresh_token_rotation_enabled !== true) throw new Error("Refresh rotation missing");
    if (!String(body.password_required_characters).includes("ABCDEFGHIJKLMNOPQRSTUVWXYZ")) throw new Error("Character policy missing");
    return { ok: true, status: 200, text: async () => "{}" };
  }

  if (options.method === "PATCH" && calls.length === 2) {
    const body = JSON.parse(options.body);
    if (body.password_hibp_enabled !== true) throw new Error("HIBP flag missing");
    return {
      ok: ${hibpStatus} === 200,
      status: ${hibpStatus},
      text: async () => "{}",
    };
  }

  if (options.method === "GET") {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        password_min_length: 12,
        password_required_characters: coreBody.password_required_characters,
        security_update_password_require_reauthentication: true,
        mailer_secure_email_change_enabled: true,
        refresh_token_rotation_enabled: true,
        password_hibp_enabled: ${hibpStatus} === 200,
      }),
    };
  }

  throw new Error("Unexpected request");
};
await import(${JSON.stringify(scriptUrl)});
`;
}

const enabled = run(
  ["--input-type=module", "-e", probeSource(200)],
  {
    ...cleanEnv,
    SUPABASE_ACCESS_TOKEN: "test-token",
    SUPABASE_PROJECT_REF: "test-project",
  },
);
assert.equal(enabled.status, 0, enabled.stderr);
assert.match(enabled.stdout, /"auth_hardening":"verified"/);
assert.match(enabled.stdout, /"leaked_password_protection":true/);

const planLimited = run(
  ["--input-type=module", "-e", probeSource(422)],
  {
    ...cleanEnv,
    SUPABASE_ACCESS_TOKEN: "test-token",
    SUPABASE_PROJECT_REF: "test-project",
  },
);
assert.equal(planLimited.status, 0, planLimited.stderr);
assert.match(planLimited.stdout, /could not be enabled/);
assert.match(planLimited.stdout, /"leaked_password_protection":false/);

const supabaseConfig = fs.readFileSync(
  fileURLToPath(new URL("../supabase/config.toml", import.meta.url)),
  "utf8",
);
for (const functionName of [
  "datasul-bridge",
  "platform-bridge",
  "profile-photo-verify",
  "ti-admin-bridge",
]) {
  assert.match(
    supabaseConfig,
    new RegExp(
      `\\[functions\\.${functionName.replaceAll("-", "\\-")}\\]\\s+verify_jwt\\s*=\\s*true`,
    ),
    `${functionName} must remain protected by Supabase JWT verification.`,
  );
}

for (const relativePath of ["../vercel.json", "../apps/ti/vercel.json"]) {
  const config = JSON.parse(
    fs.readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8"),
  );
  const catchAll = config.headers.find((entry) => entry.source === "/(.*)");
  assert.ok(catchAll, `${relativePath} must define catch-all security headers.`);
  const securityHeaders = new Map(
    catchAll.headers.map((entry) => [entry.key, entry.value]),
  );
  assert.equal(
    securityHeaders.get("Strict-Transport-Security"),
    "max-age=31536000; includeSubDomains",
  );
  assert.equal(securityHeaders.get("X-Frame-Options"), "DENY");
  const csp = securityHeaders.get("Content-Security-Policy") || "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /form-action 'self'/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
}

console.log("Auth hardening configuration checks passed.");
