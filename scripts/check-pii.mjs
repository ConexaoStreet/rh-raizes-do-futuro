import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const roots = ["supabase/migrations", "docs"];
const allowedExtensions = new Set([".sql", ".json", ".md", ".txt", ".csv"]);

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const rules = [
  { name: "internal_registration", pattern: /\bRF\d{3,}-\d+\b/g },
  { name: "cpf", pattern: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g },
  { name: "literal_email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
];

const findings = [];
for (const root of roots) {
  for (const file of walk(root).filter((path) => allowedExtensions.has(extname(path)))) {
    const content = readFileSync(file, "utf8");
    for (const rule of rules) {
      const matches = [...content.matchAll(rule.pattern)].map((match) => match[0]);
      if (matches.length) {
        findings.push({
          file: relative(".", file),
          rule: rule.name,
          count: matches.length,
        });
      }
    }
  }
}

if (findings.length) {
  console.error(JSON.stringify(findings, null, 2));
  process.exit(1);
}

console.log("PII guard passed.");
