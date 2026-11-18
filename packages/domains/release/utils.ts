import type { ReleaseVersion } from './ids';
import type { Release, ReleaseUpdate } from './types';

function compareVersions(left: ReleaseVersion, right: ReleaseVersion): number {
  const rightParts = right.split('.').map(Number);
  return left
    .split('.')
    .map(Number)
    .reduce((order, part, index) => order || part - (rightParts[index] ?? 0), 0);
}

export function listNewerReleases(releases: Release[], installed: ReleaseVersion): Release[] {
  return releases
    .filter(release => compareVersions(release.version, installed) > 0)
    .toSorted((left, right) => compareVersions(right.version, left.version));
}

// Skipping a version hides it until a newer one comes out, as Sparkle's Skip This Version does.
export function getOfferedRelease(update: ReleaseUpdate): Release | null {
  const [latest] = update.releases;
  return latest === undefined || latest.version === update.skippedVersion ? null : latest;
}
