import assert from 'node:assert/strict';
import { test } from 'node:test';

import { renderMarkdown } from './markdown';
import { plain } from './text';

const render = (source: string, width = 40) => renderMarkdown(source, width).map(plain);

test('renders headings without hashes and in bold', () => {
  const [line = []] = renderMarkdown('## Steps', 40);
  assert.equal(plain(line), 'Steps');
  assert.match(line[0]?.style ?? '', /^1;/);
});

test('renders bullets with a hanging indent and keeps numbers', () => {
  assert.deepEqual(render('- one two three', 9), ['• one two', '  three']);
  assert.deepEqual(render('  1. first'), ['  1. first']);
});

test('styles inline code, bold and links', () => {
  const [line = []] = renderMarkdown('run `pnpm test` then **merge** [PR](https://x.y/1)', 80);
  assert.equal(plain(line), 'run pnpm test then merge PR');
  assert.deepEqual(
    line.filter(span => span.style).map(span => span.text),
    ['pnpm test', 'merge', 'PR'],
  );
  assert.equal(line.find(span => span.text === 'PR')?.link, 'https://x.y/1');
});

test('keeps code blocks verbatim with a gutter and collapses blank runs', () => {
  assert.deepEqual(render('intro\n\n\n```bash\nls -la\n```\nend'), [
    'intro',
    '',
    '│ ls -la',
    'end',
  ]);
});

test('renders quotes and rules', () => {
  assert.deepEqual(render('> careful\n---', 10), ['▎ careful', '──────────']);
});
