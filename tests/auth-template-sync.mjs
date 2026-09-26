import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(
  new URL("../scripts/apply-supabase-auth-templates.mjs", import.meta.url),
);
const source = fs.readFileSync(scriptPath, "utf8");

assert.doesNotMatch(
  source,
  /SUPABASE_PROJECT_REF\s*\|\|\s*["'][^"']+["']/,
  "SUPABASE_PROJECT_REF must not have a literal fallback.",
);
assert.match(
  source,
  /if\s*\(!projectRef\)/,
  "The sync script must reject a missing project ref when a token is configured.",
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
assert.equal(
  missingToken.status,
  0,
  "Missing SUPABASE_ACCESS_TOKEN must skip safely.",
);
assert.match(
  missingToken.stdout,
  /Hosted Auth template sync was skipped/,
);

const missingProject = run(
  [scriptPath],
  { ...cleanEnv, SUPABASE_ACCESS_TOKEN: "test-token" },
);
assert.notEqual(
  missingProject.status,
  0,
  "A configured token without a project ref must fail closed.",
);
assert.match(
  missingProject.stderr,
  /SUPABASE_PROJECT_REF is required when SUPABASE_ACCESS_TOKEN is configured/,
);

const scriptUrl = pathToFileURL(scriptPath).href;
const probe = `
globalThis.fetch = async (url, options) => {
  const expected = "https://api.supabase.com/v1/projects/test-project-ref/config/auth";
  if (String(url) !== expected) {
    throw new Error("Unexpected Management API URL: " + String(url));
  }
  if (options?.method !== "PATCH") {
    throw new Error("Unexpected method: " + String(options?.method));
  }
  return { ok: true, text: async () => "" };
};
await import(${JSON.stringify(scriptUrl)});
`;

const configured = run(
  ["--input-type=module", "-e", probe],
  {
    ...cleanEnv,
    SUPABASE_ACCESS_TOKEN: "test-token",
    SUPABASE_PROJECT_REF: " test-project-ref ",
  },
);
assert.equal(configured.status, 0, configured.stderr);
assert.match(configured.stdout, /templates synchronized/);

console.log("Auth template sync configuration checks passed.");
