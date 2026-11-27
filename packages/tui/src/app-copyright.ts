export function formatCopyright(version: string | undefined, now: number): string {
  const copyright = `© ${new Date(now).getFullYear()}`;
  return version === undefined ? copyright : `v${version} · ${copyright}`;
}
