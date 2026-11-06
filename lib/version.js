/** Parses "v4.2.0" or "4.2.0-beta.1"; null when it isn't a recognizable version. */
export function parseVersion(version) {
  const match = String(version ?? "")
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/);

  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: match[3] ? Number(match[3]) : 0,
    prerelease: match[4],
  };
}

/**
 * True when `version` is >= `minimum`. Null when either can't be parsed, so the
 * caller decides the fallback instead of silently classifying an unknown version.
 */
export function isVersionAtLeast(version, minimum) {
  const v = parseVersion(version);
  const m = parseVersion(minimum);

  if (!v || !m) return null;

  if (v.major !== m.major) return v.major > m.major;
  if (v.minor !== m.minor) return v.minor > m.minor;
  if (v.patch !== m.patch) return v.patch > m.patch;

  // Same numbers: a pre-release of the minimum (4.2.0-beta.1) is below it.
  if (v.prerelease && !m.prerelease) return false;

  return true;
}
