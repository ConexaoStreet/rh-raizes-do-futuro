import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  "supabase/functions/datasul-bridge/index.ts",
  "utf8",
);
const config = fs.readFileSync("supabase/config.toml", "utf8");

assert.match(
  config,
  /\[functions\.datasul-bridge\][\s\S]*?verify_jwt\s*=\s*true/,
  "datasul-bridge must keep gateway JWT verification enabled",
);
assert.match(
  source,
  /withSupabase\(\{ auth: "user" \}/,
  "datasul-bridge must require an authenticated Supabase user",
);
assert.match(
  source,
  /allowedOrigins\(\)\.has\(origin\)/,
  "datasul-bridge must keep the explicit origin allowlist",
);
assert.match(
  source,
  /isBrazilRequest\(req\)/,
  "datasul-bridge must keep the Brazil request restriction",
);
assert.ok(
  source.includes("ti.datasul.read") && source.includes("ti.datasul.sync"),
  "datasul-bridge must enforce Datasul-specific permissions",
);
assert.match(
  source,
  /mode:\s*"internal"/,
  "Datasul must be explicitly modeled as an internal RH module",
);
assert.match(
  source,
  /source:\s*"supabase"/,
  "Datasul must use Supabase as its internal source of truth",
);

for (const table of [
  "employees",
  "departments",
  "job_positions",
  "classes",
  "attendance_sessions",
  "feedbacks",
  "performance_reviews",
]) {
  assert.ok(
    source.includes(`from("${table}")`),
    `Datasul internal health must cover ${table}`,
  );
}

assert.match(
  source,
  /action === "health"/,
  "Datasul must expose an internal health diagnostic",
);
assert.match(
  source,
  /action === "preview"/,
  "Datasul must expose a bounded internal data preview",
);
assert.match(
  source,
  /\.limit\(25\)/,
  "Datasul employee preview must stay bounded",
);
assert.match(
  source,
  /ti_datasul_operations/,
  "Datasul operations must remain audited",
);

for (const forbidden of [
  "DATASUL_BASE_URL",
  "DATASUL_USERNAME",
  "DATASUL_PASSWORD",
  'Authorization: "Basic',
  "companyId",
  "health_path",
  "employees_path",
]) {
  assert.ok(
    !source.includes(forbidden),
    `Datasul internal module must not depend on external ERP setting: ${forbidden}`,
  );
}

assert.doesNotMatch(
  source,
  /fetch\s*\(/,
  "Datasul internal module must not call an external API",
);
assert.doesNotMatch(
  source,
  /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/,
  "Datasul bridge must never allow wildcard CORS",
);

const permissionGate = source.indexOf("if (!canRead)");
const serviceRoleUse = source.indexOf("SUPABASE_SERVICE_ROLE_KEY");
assert.ok(
  permissionGate >= 0 &&
    serviceRoleUse > permissionGate,
  "service-role access must only be created after the user permission gate",
);

console.log("Datasul internal security/readiness guard passed.");
