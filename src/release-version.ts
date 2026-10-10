export type ReleaseVersion = {
  version: string;
  commit: string;
  pack: number;
  published_at: string;
  changes: string[];
};
declare const __RAIZES_RELEASE__: unknown;
export function parseRelease(value: unknown): ReleaseVersion | null {
  if (!value || typeof value !== "object") return null;
  const release = value as Partial<ReleaseVersion>;
  if (
    typeof release.version !== "string" ||
    !/^[a-zA-Z0-9.+-]{1,80}$/.test(release.version) ||
    typeof release.commit !== "string" ||
    !/^[a-f0-9]{40}$/.test(release.commit) ||
    !Number.isInteger(release.pack) ||
    Number(release.pack) < 1 ||
    typeof release.published_at !== "string" ||
    !Number.isFinite(Date.parse(release.published_at)) ||
    !Array.isArray(release.changes) ||
    !release.changes.length ||
    release.changes.length > 8 ||
    !release.changes.every(
      (item) =>
        typeof item === "string" &&
        item.trim().length >= 3 &&
        item.length <= 240,
    )
  )
    return null;
  return release as ReleaseVersion;
}
export const installedRelease = parseRelease(
  typeof __RAIZES_RELEASE__ === "undefined" ? null : __RAIZES_RELEASE__,
);
export function hasNewRelease(
  installed: ReleaseVersion | null,
  available: ReleaseVersion | null,
) {
  return Boolean(
    installed &&
      available &&
      installed.commit !== available.commit &&
      installed.version !== available.version &&
      Date.parse(available.published_at) >= Date.parse(installed.published_at),
  );
}
