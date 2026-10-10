import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function createRelease({ commit, date, files, notes }) {
  if (!/^[a-f0-9]{40}$/.test(commit) || !Number.isFinite(Date.parse(date)))
    throw new Error("INVALID_RELEASE");
  const published = new Date(date).toISOString();
  const stamp = published.replace(/[^0-9]/g, "").slice(0, 14);
  const areas = [
    [/chat|Chat/, "Atualizamos as conversas, os anexos e a moderação."],
    [
      /workspace|Workspace|RhNavigation/,
      "Atualizamos os espaços dos setores e a visão das equipes.",
    ],
    [
      /Attendance|attendance|justification/,
      "Revisamos as presenças e as justificativas.",
    ],
    [
      /Performance|performance|grade|feedback/,
      "Revisamos as notas e o acompanhamento de desempenho.",
    ],
    [/Reports|report|export/, "Revisamos os relatórios e as exportações."],
    [
      /auth|Login|security|session/,
      "Revisamos o acesso e a proteção das contas.",
    ],
    [
      /styles|theme|layout|components/,
      "Ajustamos o visual, a navegação e o uso no celular.",
    ],
    [
      /release|Maintenance|site-status|site_live/,
      "Atualizamos o acompanhamento e o histórico do site.",
    ],
  ];
  const curated = files.includes("public/release-notes.json");
  let changes =
    curated && Array.isArray(notes.changes)
      ? notes.changes
      : areas
          .filter(([pattern]) => files.some((file) => pattern.test(file)))
          .map(([, description]) => description);
  changes = [
    ...new Set(
      changes
        .filter(
          (item) =>
            typeof item === "string" &&
            item.trim().length >= 3 &&
            item.length <= 240,
        )
        .map((item) => item.trim()),
    ),
  ].slice(0, 8);
  if (!changes.length)
    changes = ["Atualizamos o Raízes e revisamos a experiência de uso."];
  return {
    release: "raizes-live-workspaces-pack-2",
    version: `2.0.${stamp}-${commit.slice(0, 7)}`,
    commit,
    published_at: published,
    pack: Number.isInteger(notes.pack) && notes.pack > 0 ? notes.pack : 2,
    changes,
  };
}

async function main() {
  if (process.argv[2] === "publish") {
    await fs.copyFile(".generated/release.json", "dist/release.json");
    return;
  }
  const git = (...args) =>
    execFileSync("git", args, { encoding: "utf8" }).trim();
  const commit = git("rev-parse", "HEAD");
  const date = git("show", "-s", "--format=%cI", "HEAD");
  let files;
  try {
    files = git(
      "diff-tree",
      "--no-commit-id",
      "--name-only",
      "-r",
      "HEAD",
    ).split("\n");
  } catch {
    files = git("ls-files").split("\n");
  }
  const notes = JSON.parse(
    await fs.readFile("public/release-notes.json", "utf8"),
  );
  const manifest = createRelease({ commit, date, files, notes });
  await fs.mkdir(".generated", { recursive: true });
  await fs.writeFile(
    ".generated/release.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
  process.stdout.write(`Versão ${manifest.version} preparada.\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
