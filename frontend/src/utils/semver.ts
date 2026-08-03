/**
 * Semver comparison narrowed to what this repo actually produces: `VERSION` is
 * written by release-it and never carries a prerelease or build suffix.
 */

/** Parses `x.y.z` into three numbers. Anything unparseable reads as 0. */
function parse(version: string): [number, number, number] {
  const parts = version.trim().replace(/^v/i, '').split('.')
  const segment = (index: number): number => {
    const value = Number.parseInt(parts[index] ?? '', 10)
    return Number.isNaN(value) ? 0 : value
  }
  return [segment(0), segment(1), segment(2)]
}

/** Negative when `a` is older than `b`, positive when newer, 0 when equal. */
export function compareSemver(a: string, b: string): number {
  const left = parse(a)
  const right = parse(b)
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i]
  }
  return 0
}

/**
 * True when the running bundle is below the floor the deployment requires.
 *
 * Deliberately total: the result decides whether the app gets held hostage behind
 * an update screen, so a missing or malformed floor has to read as "not required"
 * rather than throw.
 */
export function isVersionBelowMin(current: string, minVersion: string | null): boolean {
  if (!minVersion) return false
  return compareSemver(current, minVersion) < 0
}
