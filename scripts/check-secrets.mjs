import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const tokenPatterns = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["supabase-secret", /sb_secret_[A-Za-z0-9_-]{20,}/],
  ["github-token", /gh[pousr]_[A-Za-z0-9]{20,}/],
  ["openai-key", /sk-(?:proj-)?[A-Za-z0-9_-]{24,}/],
  ["resend-key", /re_[A-Za-z0-9]{24,}/],
];

const sensitiveNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_URL",
  "DATABASE_URL",
  "OTP_HMAC_SECRET",
  "RESEND_API_KEY",
  "VERCEL_TOKEN",
  "GITHUB_TOKEN",
  "TI_ACCESS_CODE_PEPPER",
];

const assignmentPattern = new RegExp(
  `(?:^|\\n)\\s*(?:export\\s+)?(?:${sensitiveNames.join("|")})\\s*[:=]\\s*([^\\n#]+)`,
  "gi",
);

function placeholder(value) {
  const clean = value.trim().replace(/^["']|["']$/g, "");
  return (
    clean === "" ||
    clean === "changeme" ||
    clean === "example" ||
    clean === "placeholder" ||
    clean.startsWith("$") ||
    clean.includes("${{ secrets.") ||
    clean.includes("process.env.") ||
    clean.includes("Deno.env.get(")
  );
}

const findings = [];

for (const file of files) {
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

  for (const [name, pattern] of tokenPatterns) {
    const match = pattern.exec(content);
    pattern.lastIndex = 0;
    if (!match) continue;
    const line = content.slice(0, match.index).split("\n").length;
    findings.push({ file, line, rule: name });
  }

  assignmentPattern.lastIndex = 0;
  for (const match of content.matchAll(assignmentPattern)) {
    if (placeholder(match[1] || "")) continue;
    const line = content.slice(0, match.index).split("\n").length;
    findings.push({ file, line, rule: "sensitive-assignment" });
  }
}

if (findings.length) {
  process.stderr.write("Secret guard blocked potentially sensitive tracked content:\n");
  for (const finding of findings) {
    process.stderr.write(
      `- ${finding.file}:${finding.line} [${finding.rule}]\n`,
    );
  }
  process.exit(1);
}

process.stdout.write(
  `Secret guard passed: ${files.length} tracked paths inspected without exposing values.\n`,
);
