import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const roots = ["src", "scripts", "tests", "supabase"];
const pendingWords = new RegExp(
  "\\b(" + ["TO" + "DO", "FIX" + "ME"].join("|") + ")\\b",
);
const failures = [];

function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".")) scan(filename);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|css|sql)$/.test(filename)) continue;
    const source = fs.readFileSync(filename, "utf8");
    if (/\.(ts|tsx|js|mjs)$/.test(filename)) {
      const tree = ts.createSourceFile(
        filename,
        source,
        ts.ScriptTarget.Latest,
        true,
      );
      const comments = new Set();
      function visit(node) {
        for (const range of [
          ...(ts.getLeadingCommentRanges(source, node.pos) || []),
          ...(ts.getTrailingCommentRanges(source, node.end) || []),
        ])
          comments.add(range.pos);
        ts.forEachChild(node, visit);
      }
      visit(tree);
      if (comments.size) failures.push(filename + ": comentário encontrado");
    } else if (/\.(css|sql)$/.test(filename)) {
      const literalsRemoved = source
        .replace(/'(?:''|[^'])*'/g, "''")
        .replace(/"(?:""|[^"])*"/g, '""');
      if (
        /\/\*/.test(literalsRemoved) ||
        (filename.endsWith(".sql") && /(^|\s)--/.test(literalsRemoved))
      )
        failures.push(filename + ": comentário encontrado");
    }
    if (source.includes("\u2014"))
      failures.push(filename + ": caractere tipográfico proibido");
    if (pendingWords.test(source))
      failures.push(filename + ": pendência no código");
  }
}

roots.forEach(scan);

const typographyRoots = ["."];

function scanTypography(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist", ".vercel"].includes(entry.name))
      continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scanTypography(filename);
      continue;
    }
    if (
      !/\.(ts|tsx|js|mjs|css|sql|md|json|jsonc|toml|yml|yaml|html|txt)$/.test(
        filename,
      )
    )
      continue;
    const source = fs.readFileSync(filename, "utf8");
    if (source.includes("\u2014"))
      failures.push(filename + ": caractere tipográfico proibido");
  }
}

typographyRoots.forEach(scanTypography);

if (failures.length) {
  process.stderr.write(failures.join("\n") + "\n");
  process.exit(1);
}
