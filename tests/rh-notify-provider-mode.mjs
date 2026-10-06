import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  "supabase/functions/rh-notify/index.ts",
  "utf8",
);

assert.match(source, /RESEND_DOMAIN_REQUIRED/);
assert.match(source, /delivery_status:\s*"skipped"|complete\("skipped"/);
assert.match(source, /email_domain_required/);
assert.match(source, /response\.status\s*===\s*403/);
assert.match(source, /validation_error/);

console.log("RH notify provider-mode handling checks passed.");
