import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lineWidth, plain, S } from './text';
import { box, overlayOnto } from './views';

test('box draws a filled panel with the title and footer on top and a gap below', () => {
  const lines = box({
    title: '[1] Routines',
    width: 24,
    height: 4,
    body: [[{ text: 'one' }], [{ text: 'two' }]],
    isFocused: false,
    footer: '1 of 2',
  });
  assert.deepEqual(lines.map(plain), [
    '  1  Routines   1 of 2  ',
    '  one                   ',
    '  two                   ',
    '                        ',
  ]);
  for (const line of lines) assert.equal(lineWidth(line), 24);
  assert.ok((lines[1] ?? []).slice(0, -1).every(span => span.style?.includes(S.surface)));
});

test('the cursor row is filled brighter when the panel is focused than when it is not', () => {
  const body = [[{ text: 'row', style: S.dim }]];
  const rowStyles = (isFocused: boolean) =>
    (box({ title: 't', width: 12, height: 3, body, isFocused, highlightRow: 0 })[1] ?? [])
      .slice(1, -1)
      .map(span => span.style ?? '');
  assert.ok(rowStyles(true).every(style => style.includes(S.selected)));
  assert.ok(rowStyles(false).every(style => style.includes(S.hover)));
});

test('overlayOnto centres a popup over the frame', () => {
  const frame = Array.from({ length: 5 }, () => [{ text: '..........' }]);
  const popup = [[{ text: 'ab' }], [{ text: 'cd' }]];
  assert.deepEqual(overlayOnto(frame, popup, 10).map(plain), [
    '..........',
    '....ab....',
    '....cd....',
    '..........',
    '..........',
  ]);
});
