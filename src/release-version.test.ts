import { describe, expect, it } from "vitest";
import { hasNewRelease, parseRelease } from "./release-version";

const release = {
  version: "2.0.20261009223058-aaaaaaa",
  commit: "a".repeat(40),
  pack: 2,
  published_at: "2026-10-09T22:30:58Z",
  changes: ["Novos espaços para as equipes."],
};
describe("Identificação de versões", () => {
  it("aceita uma publicação válida", () =>
    expect(parseRelease(release)).toEqual(release));
  it("ignora payload inválido", () => {
    for (const value of [
      null,
      {},
      { ...release, commit: "bad" },
      { ...release, changes: [] },
      { ...release, pack: 0 },
      { ...release, version: "<script>" },
    ])
      expect(parseRelease(value)).toBeNull();
  });
  it("sinaliza commit e versão novos", () =>
    expect(
      hasNewRelease(release, {
        ...release,
        commit: "b".repeat(40),
        version: "2.0.20261009223158-bbbbbbb",
      }),
    ).toBe(true));
  it("não avisa para a mesma publicação", () =>
    expect(hasNewRelease(release, release)).toBe(false));
  it("não sugere voltar a uma publicação anterior", () =>
    expect(
      hasNewRelease(release, {
        ...release,
        commit: "b".repeat(40),
        version: "1.0.0",
        published_at: "2026-10-08T00:00:00Z",
      }),
    ).toBe(false));
  it("tolera desenvolvimento sem versão", () =>
    expect(hasNewRelease(null, release)).toBe(false));
});
