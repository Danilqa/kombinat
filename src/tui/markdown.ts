import { S, sanitize, textWidth, wrapLine } from './text';
import type { Line, Span } from './text';

const HEADING_STYLES = [S.boldMagenta, S.boldBlue, S.boldCyan, S.bold, S.bold, S.bold];

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|~~[^~]+~~)/g;

export function renderInline(text: string, baseStyle?: string): Line {
  const spans: Line = [];
  const withBase = (style: string) => (baseStyle ? `${baseStyle};${style}` : style);
  const pushPlain = (value: string) =>
    value && spans.push(baseStyle ? { text: value, style: baseStyle } : { text: value });
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    pushPlain(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('`')) spans.push({ text: token.slice(1, -1), style: withBase(S.cyan) });
    else if (token.startsWith('**') || token.startsWith('__'))
      spans.push({ text: token.slice(2, -2), style: withBase(S.bold) });
    else if (token.startsWith('~~')) spans.push({ text: token.slice(2, -2), style: withBase('9') });
    else {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token) ?? [];
      if (label !== undefined && href !== undefined) {
        spans.push({ text: label, style: withBase(`${S.underline};${S.blue}`), link: href });
      }
    }
    last = (match.index ?? 0) + token.length;
  }
  pushPlain(text.slice(last));
  return spans;
}

function prefixed(prefix: Span, body: Line, width: number): Line[] {
  const indent = textWidth(prefix.text);
  return wrapLine([prefix, ...body], width, indent);
}

// Headings, lists, quotes, code blocks, rules and inline bold/code/links. Tables stay as written.
export function renderMarkdown(source: string, width: number): Line[] {
  const lines: Line[] = [];
  let inCode = false;
  let lastWasBlank = true;

  for (const rawLine of sanitize(source.replace(/\r\n/g, '\n')).split('\n')) {
    if (/^\s*(```|~~~)/.test(rawLine)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      lines.push(
        ...wrapLine(
          [
            { text: '│ ', style: S.dim },
            { text: rawLine, style: S.cyan },
          ],
          width,
          2,
        ),
      );
      lastWasBlank = false;
      continue;
    }
    if (!rawLine.trim()) {
      if (!lastWasBlank) lines.push([]);
      lastWasBlank = true;
      continue;
    }
    lastWasBlank = false;

    const [, hashes, heading] = /^(#{1,6})\s+(.*)$/.exec(rawLine) ?? [];
    if (hashes !== undefined && heading !== undefined) {
      lines.push(...wrapLine(renderInline(heading, HEADING_STYLES[hashes.length - 1]), width));
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(rawLine)) {
      lines.push([{ text: '─'.repeat(Math.min(width, 40)), style: S.dim }]);
      continue;
    }
    const [, quote] = /^\s*>\s?(.*)$/.exec(rawLine) ?? [];
    if (quote !== undefined) {
      lines.push(...prefixed({ text: '▎ ', style: S.dim }, renderInline(quote, S.italic), width));
      continue;
    }
    const [, bulletIndent, bullet] = /^(\s*)[-*+]\s+(.*)$/.exec(rawLine) ?? [];
    if (bulletIndent !== undefined && bullet !== undefined) {
      lines.push(
        ...prefixed({ text: `${bulletIndent}• `, style: S.yellow }, renderInline(bullet), width),
      );
      continue;
    }
    const [, numberIndent, number, item] = /^(\s*)(\d+[.)])\s+(.*)$/.exec(rawLine) ?? [];
    if (numberIndent !== undefined && number !== undefined && item !== undefined) {
      lines.push(
        ...prefixed(
          { text: `${numberIndent}${number} `, style: S.yellow },
          renderInline(item),
          width,
        ),
      );
      continue;
    }
    if (/^\s*\|/.test(rawLine)) {
      lines.push(
        ...wrapLine(
          rawLine
            .split(/(\|)/)
            .filter(Boolean)
            .map(part => (part === '|' ? { text: part, style: S.dim } : { text: part })),
          width,
        ),
      );
      continue;
    }
    lines.push(...wrapLine(renderInline(rawLine), width));
  }
  while (lines.at(-1)?.length === 0) lines.pop();
  return lines;
}
