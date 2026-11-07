const PREVIEW_LENGTH = 160;

export function toPreview(value: string): string {
  const firstLine = value.split('\n')[0] ?? '';
  return firstLine.length > PREVIEW_LENGTH
    ? `${firstLine.slice(0, PREVIEW_LENGTH - 1)}…`
    : firstLine;
}
