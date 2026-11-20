import { GITHUB_PULL_URL } from './constants';
import { releaseVersionSchema, type ReleaseVersion } from './ids';
import { githubReleasesSchema } from './schemas';
import type {
  ChangelogRelease,
  GithubRelease,
  Release,
  ReleaseImage,
  ReleaseUpdate,
} from './types';

const FULL_CHANGELOG_LINE = /^\*\*Full Changelog\*\*.*$/m;

// Release notes render as markdown without HTML, so a screenshot's <img> would show as text.
// Only whole lines go, since inline text such as `kombinat run <name>` looks like a tag too.
const HTML_LINE = /^[ \t]*(?:<[^>\n]+>[ \t]*)+$/gm;

const IMG_TAG = /<img\b[^>]*>/g;
const CODE_SPAN = /(`[^`\n]*`)/;
const PULL_REFERENCE = /(?<![\w[/&])#(\d+)\b/g;

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

function toRelease(release: GithubRelease): Release | null {
  const version = releaseVersionSchema.safeParse(release.tag_name.replace(/^v/, ''));
  const { draft, prerelease, published_at: publishedAt } = release;
  if (draft || prerelease || publishedAt === null || !version.success) return null;
  return {
    version: version.data,
    notes: (release.body ?? '').replace(FULL_CHANGELOG_LINE, '').replace(HTML_LINE, '').trim(),
    url: release.html_url,
    publishedAt,
  };
}

export function parseGithubReleases(body: unknown): Release[] {
  return githubReleasesSchema.parse(body).flatMap(release => toRelease(release) ?? []);
}

function readAttribute(tag: string, name: string): string | null {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

export function listReleaseImages(notes: string | null): ReleaseImage[] {
  return [...(notes ?? '').matchAll(IMG_TAG)].flatMap(([tag]) => {
    const src = readAttribute(tag, 'src');
    if (src === null || !src.startsWith('https://')) return [];
    const width = Number(readAttribute(tag, 'width'));
    return { src, alt: readAttribute(tag, 'alt') ?? '', width: width > 0 ? width : null };
  });
}

// Code spans keep their text, so `#1` in an example stays as it is.
export function linkPullRequests(notes: string): string {
  return notes
    .split(CODE_SPAN)
    .map((part, index) =>
      index % 2 === 1 ? part : part.replace(PULL_REFERENCE, `[#$1](${GITHUB_PULL_URL}/$1)`),
    )
    .join('');
}

export function parseChangelog(releases: GithubRelease[]): ChangelogRelease[] {
  return releases
    .flatMap(github => {
      const release = toRelease(github);
      if (release === null) return [];
      return {
        ...release,
        notes: linkPullRequests(release.notes),
        images: listReleaseImages(github.body),
      };
    })
    .toSorted((left, right) => compareVersions(right.version, left.version));
}
