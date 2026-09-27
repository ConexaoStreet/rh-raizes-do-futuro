import assert from "node:assert/strict";
import fs from "node:fs";

const config = fs.readFileSync("supabase/config.toml", "utf8");

for (const name of [
  "datasul-bridge",
  "platform-bridge",
  "profile-photo-verify",
  "ti-admin-bridge",
  "email-2fa",
]) {
  assert.match(
    config,
    new RegExp("\\[functions\\." + name.replace(/[.*+?^$()|[\\]\\]/g, "\\$&") + "\\]\\s*\\nverify_jwt\\s*=\\s*true"),
    name + " must require platform JWT verification",
  );
}

for (const name of [
  "registration-bootstrap",
  "manager-activation",
  "push-notify",
  "ti-code-login",
]) {
  assert.match(
    config,
    new RegExp("\\[functions\\." + name.replace(/[.*+?^$()|[\\]\\]/g, "\\$&") + "\\]\\s*\\nverify_jwt\\s*=\\s*false"),
    name + " intentionally uses handler-level authentication",
  );
}

for (const path of [
  "supabase/functions/registration-bootstrap/index.ts",
  "supabase/functions/manager-activation/index.ts",
  "supabase/functions/ti-code-login/index.ts",
  "supabase/functions/datasul-bridge/index.ts",
  "supabase/functions/platform-bridge/index.ts",
  "supabase/functions/profile-photo-verify/index.ts",
  "supabase/functions/ti-admin-bridge/index.ts",
  "supabase/functions/email-2fa/index.ts",
]) {
  const source = fs.readFileSync(path, "utf8");
  assert.match(source, /request-security\.ts/);
  assert.match(source, /isBrazilRequest\(/);
}

const registration = fs.readFileSync(
  "supabase/functions/registration-bootstrap/index.ts",
  "utf8",
);
assert.match(registration, /requestFingerprint\(/);
assert.match(registration, /consume_edge_rate_limit/);
assert.match(registration, /max_attempts:\s*maxAttempts/);

const manager = fs.readFileSync(
  "supabase/functions/manager-activation/index.ts",
  "utf8",
);
assert.match(manager, /requestFingerprint\(/);
assert.match(manager, /consume_edge_rate_limit/);

const push = fs.readFileSync(
  "supabase/functions/push-notify/index.ts",
  "utf8",
);
assert.match(push, /timingSafeEqual\(/);
assert.match(push, /body\.action === "sync"/);

const migration = fs.readFileSync(
  "supabase/migrations/20260927153100_security_hardening.sql",
  "utf8",
);
assert.match(migration, /private\.edge_rate_limits/);
assert.match(migration, /public\.consume_edge_rate_limit/);
assert.match(migration, /attendance_session_owned_by_current_user/);
assert.doesNotMatch(
  migration,
  /grant\s+execute\s+on\s+function\s+public\.consume_edge_rate_limit[^;]+to\s+(?:anon|authenticated)/i,
);

console.log("Edge security boundary checks passed.");
