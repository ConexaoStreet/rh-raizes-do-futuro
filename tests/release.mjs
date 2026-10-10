import assert from "node:assert/strict";
import { createRelease } from "../scripts/generate-release.mjs";

const input = {
  commit: "a".repeat(40),
  date: "2026-10-09T22:30:58Z",
  files: ["src/Chat.tsx"],
  notes: { pack: 2, changes: ["Novos espaços para cada equipe."] },
};
const chat = createRelease(input);
assert.deepEqual(chat.changes, [
  "Atualizamos as conversas, os anexos e a moderação.",
]);
assert.deepEqual(
  createRelease({ ...input, files: ["public/release-notes.json"] }).changes,
  input.notes.changes,
);
assert.equal(createRelease(input).version, chat.version);
assert.notEqual(
  createRelease({ ...input, commit: "b".repeat(40) }).version,
  chat.version,
);
assert.throws(
  () => createRelease({ ...input, commit: "bad" }),
  /INVALID_RELEASE/,
);
assert.throws(
  () => createRelease({ ...input, date: "bad" }),
  /INVALID_RELEASE/,
);
assert.deepEqual(createRelease({ ...input, files: ["README.md"] }).changes, [
  "Atualizamos o Raízes e revisamos a experiência de uso.",
]);
process.stdout.write(
  "7 verificações de geração automática de versões aprovadas.\n",
);
