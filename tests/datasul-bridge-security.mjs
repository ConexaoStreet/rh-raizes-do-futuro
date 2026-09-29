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

for (const permission of [
  "ti.datasul.read",
  "ti.datasul.sync",
  "ti.datasul.write",
  "ti.datasul.delete",
]) {
  assert.ok(
    source.includes(permission),
    `datasul-bridge is missing permission guard ${permission}`,
  );
}

assert.match(
  source,
  /RECENT_VERIFICATION_REQUIRED/,
  "Datasul writes and deletes must keep recent verification",
);
assert.match(
  source,
  /DATASUL_REQUEST_TIMEOUT_MS\s*=\s*30_000/,
  "Datasul calls must have a bounded request timeout",
);
assert.match(
  source,
  /new AbortController\(\)/,
  "Datasul calls must be cancellable on timeout",
);
assert.match(
  source,
  /DATASUL_TIMEOUT_UNKNOWN_RESULT/,
  "Timed out writes must explicitly report an unknown remote result",
);
assert.match(
  source,
  /INVALID_JSON_OBJECT/,
  "Datasul bridge must reject non-object JSON bodies",
);
assert.match(
  source,
  /INVALID_JSON/,
  "Datasul bridge must reject malformed JSON with a client error",
);
assert.doesNotMatch(
  source,
  /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/,
  "Datasul bridge must never allow wildcard CORS",
);

console.log("Datasul bridge security/readiness guard passed.");
