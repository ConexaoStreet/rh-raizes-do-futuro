import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const patterns = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ["supabase-secret", /sb_secret_[A-Za-z0-9_-]{20,}/g],
  ["github-token", /gh[pousr]_[A-Za-z0-9]{20,}/g],
  ["openai-key", /sk-(?:proj-)?[A-Za-z0-9_-]{24,}/g],
  ["resend-key", /re_[A-Za-z0-9]{24,}/g],
  ["stripe-live", /(?:sk|rk)_live_[A-Za-z0-9]{16,}/g],
  ["aws-access-key", /AKIA[0-9A-Z]{16}/g],
  ["google-api-key", /AIza[0-9A-Za-z_-]{30,}/g],
  ["slack-token", /xox[baprs]-[0-9A-Za-z-]{20,}/g],
  ["credential-url", /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:[^\s@/]+@/gi],
];

const sensitiveNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_URL",
  "DATABASE_URL",
  "JWT_SECRET",
  "OTP_HMAC_SECRET",
  "RESEND_API_KEY",
  "VERCEL_TOKEN",
  "GITHUB_TOKEN",
  "TI_ACCESS_CODE_PEPPER",
  "DATASUL_PASSWORD",
  "VAPID_PRIVATE_KEY",
  "PUSH_WEBHOOK_SECRET",
];

const assignment = new RegExp(
  String.raw`(?:^|\n)\s*(?:export\s+)?(?:${sensitiveNames.join("|")})\s*[:=]\s*([^\n#]+)`,
  "g",
);

function placeholder(value) {
  const clean = value.trim().replace(/^["']|["']$/g, "");
  return (
    clean === "" ||
    /^(?:change-?me|example|placeholder|test|mock|fake|dummy|invalid)(?:[-_:]|$)/i.test(clean) ||
    clean.startsWith("$") ||
    clean.includes("${{ secrets.") ||
    clean.includes("process.env.") ||
    clean.includes("Deno.env.get(")
  );
}

function serviceRoleJwt(content, file) {
  const jwtPattern = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
  const findings = [];
  for (const match of content.matchAll(jwtPattern)) {
    try {
      const payloadPart = match[0].split(".")[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const padded = payloadPart.padEnd(
        payloadPart.length + ((4 - (payloadPart.length % 4)) % 4),
        "=",
      );
      const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
      if (payload?.role === "service_role") {
        findings.push({
          file,
          line: content.slice(0, match.index).split("\n").length,
          rule: "service-role-jwt",
        });
      }
    } catch {}
  }
  return findings;
}

const findings = [];
for (const file of tracked) {
  if (file === "scripts/check-secrets.mjs") continue;
  let stat;
  try {
    stat = statSync(file);
  } catch {
    continue;
  }
  if (!stat.isFile() || stat.size > 2_000_000) continue;

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (content.includes("\0")) continue;

  for (const [rule, pattern] of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      findings.push({
        file,
        line: content.slice(0, match.index).split("\n").length,
        rule,
      });
    }
  }

  assignment.lastIndex = 0;
  for (const match of content.matchAll(assignment)) {
    if (placeholder(match[1] || "")) continue;
    findings.push({
      file,
      line: content.slice(0, match.index).split("\n").length,
      rule: "sensitive-assignment",
    });
  }

  findings.push(...serviceRoleJwt(content, file));
}

if (findings.length) {
  process.stderr.write("Secret guard blocked potentially sensitive tracked content:\n");
  for (const finding of findings) {
    process.stderr.write(`- ${finding.file}:${finding.line} [${finding.rule}]\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `Secret guard passed: ${tracked.length} tracked paths inspected without exposing secret values.\n`,
);
