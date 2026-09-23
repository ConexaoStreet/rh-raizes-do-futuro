import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";

const root = "dist";
const assets = join(root, "assets");

if (!existsSync(assets)) throw new Error("DIST_ASSETS_NOT_FOUND");

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const files = walk(root);
const maps = files.filter((path) => path.endsWith(".map"));
if (maps.length) throw new Error("SOURCE_MAP_FOUND");

const renameMap = new Map();

for (const path of files.filter((item) => item.startsWith(assets))) {
  const ext = extname(path);
  if (ext !== ".js" && ext !== ".css") continue;
  const name = basename(path);
  const match = name.match(/^.+-([A-Za-z0-9_-]{8,})\.(js|css)$/);
  if (!match) continue;
  const nextName = `${match[1]}.${match[2]}`;
  if (nextName === name) continue;
  renameMap.set(name, nextName);
}

const textExtensions = new Set([".html", ".js", ".css", ".json", ".webmanifest", ".txt"]);
for (const path of files) {
  if (!textExtensions.has(extname(path)) && !path.endsWith(".webmanifest")) continue;
  let content = readFileSync(path, "utf8");
  let changed = false;
  for (const [from, to] of renameMap) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  if (/sourceMappingURL\s*=/.test(content)) throw new Error("SOURCE_MAP_REFERENCE_FOUND");
  if (changed) writeFileSync(path, content);
}

for (const [from, to] of renameMap) {
  renameSync(join(assets, from), join(assets, to));
}

const finalFiles = walk(assets).filter((path) => [".js", ".css"].includes(extname(path)));
for (const path of finalFiles) {
  const name = basename(path);
  if (!/^[A-Za-z0-9_-]{8,}\.(js|css)$/.test(name)) {
    throw new Error(`READABLE_ASSET_NAME:${relative(root, path)}`);
  }
}

console.log(`Protected ${renameMap.size} production code assets.`);
