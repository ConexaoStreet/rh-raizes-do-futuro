import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const config = read("supabase/config.toml");
assert.doesNotMatch(config, /graphql_public/);
assert.match(config, /jwt_expiry\s*=\s*900/);
assert.match(config, /minimum_password_length\s*=\s*12/);

const auth = read("src/auth.tsx");
assert.match(auth, /user\.privileged\s*&&\s*!user\.mfa_verified/);
assert.doesNotMatch(
  auth,
  /roles\.includes\("SUPER_ADMIN"\).*roles\.includes\("TI_ADMIN"\)[\s\S]{0,80}!user\.mfa_verified/,
);

for (const path of ["src/api.ts", "apps/ti/src/api.ts"]) {
  const api = read(path);
  assert.match(api, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(api, /VITE_SUPABASE_ANON_KEY/);
}

const email2fa = read("supabase/functions/email-2fa/index.ts");
assert.match(email2fa, /isBrazilRequest/);
assert.match(email2fa, /REGION_NOT_ALLOWED/);
assert.match(email2fa, /OTP_HMAC_SECRET/);

const push = read("supabase/functions/push-notify/index.ts");
assert.match(push, /service_push_config/);
assert.match(push, /timingSafeEqual/);
assert.match(push, /isBrazilRequest/);
assert.match(push, /consume_edge_rate_limit/);
assert.doesNotMatch(push, /\.from\(["']push_config["']\)/);

for (const path of ["index.html", "apps/ti/index.html"]) {
  const html = read(path);
  assert.match(html, /<script src="\/theme-init\.js"><\/script>/);
  assert.doesNotMatch(html, /<script>\s*\(\(\)/);
}

for (const path of ["vercel.json", "apps/ti/vercel.json"]) {
  const config = JSON.parse(read(path));
  const global = config.headers.find((entry) => entry.source === "/(.*)");
  assert.ok(global, `${path} must define global headers`);
  const headers = Object.fromEntries(
    global.headers.map((header) => [header.key, header.value]),
  );
  assert.match(headers["Content-Security-Policy"], /default-src 'self'/);
  assert.match(headers["Content-Security-Policy"], /script-src 'self'/);
  assert.doesNotMatch(headers["Content-Security-Policy"], /script-src[^;]*unsafe-inline/);
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Cross-Origin-Opener-Policy"], "same-origin");
  assert.equal(headers["Cross-Origin-Resource-Policy"], "same-origin");
  assert.match(headers["Strict-Transport-Security"], /max-age=31536000/);
}

const ci = read(".github/workflows/ci.yml");
for (const sha of [
  "3d3c42e5aac5ba805825da76410c181273ba90b1",
  "820762786026740c76f36085b0efc47a31fe5020",
  "22d081ff2d3a40755e97629de92e3bcbfa7cf2ed",
]) {
  assert.ok(ci.includes(sha), `CI action is not pinned to ${sha}`);
}
assert.match(ci, /persist-credentials:\s*false/);
assert.match(ci, /npm run check:secrets/);
assert.match(ci, /tests\/security-hardening\.mjs/);

const hardening = read(
  "supabase/migrations/20260928042130_maximum_security_hardening_phase_one.sql",
);
assert.match(hardening, /not private\.is_privileged\(\)/);
assert.match(hardening, /vault\.create_secret/);
assert.match(hardening, /revoke all on schema graphql_public/);
assert.match(hardening, /service_push_config/);
assert.match(hardening, /auth\.jwt\(\)->>'role'/);

const repair = read(
  "supabase/migrations/20260928042157_repair_edge_rate_limit_ambiguity.sql",
);
assert.match(repair, /on conflict on constraint edge_rate_limits_pkey/);
assert.match(repair, /auth\.jwt\(\)->>'role'/);

console.log("Maximum-security source contracts passed.");
