import assert from "node:assert/strict";
import fs from "node:fs";

const helper = fs.readFileSync(
  "supabase/functions/_shared/observability.ts",
  "utf8",
);

assert.match(helper, /service:\s*"raizes-rh"/);
assert.match(helper, /source:\s*"supabase-edge"/);
assert.match(helper, /sensitiveKey/);
assert.match(helper, /email/);
assert.match(helper, /token/);
assert.match(helper, /fingerprint/);
assert.match(helper, /user_id/);
assert.match(helper, /session_id/);
assert.doesNotMatch(helper, /error\.message/);
assert.doesNotMatch(helper, /error\.stack/);

for (const file of [
  "supabase/functions/registration-bootstrap/index.ts",
  "supabase/functions/ti-code-login/index.ts",
  "supabase/functions/push-notify/index.ts",
]) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, /_shared\/observability\.ts/);
  assert.doesNotMatch(source, /console\.error\s*\(/);
}

const registration = fs.readFileSync(
  "supabase/functions/registration-bootstrap/index.ts",
  "utf8",
);
assert.match(registration, /registration_bootstrap\.match/);
assert.match(registration, /registration_bootstrap\.error/);

const tiLogin = fs.readFileSync(
  "supabase/functions/ti-code-login/index.ts",
  "utf8",
);
assert.match(tiLogin, /outcome:\s*"rate_limited"/);
assert.match(tiLogin, /outcome:\s*"invalid_code"/);
assert.match(tiLogin, /ti_code_login\.confirm/);

console.log("Observability privacy checks passed.");
