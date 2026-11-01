import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lineWidth, plain, S } from './text';
import { box, overlayOnto } from './views';

test('box draws a padded panel with the title on top and the footer at the bottom', () => {
  const lines = box({
    title: '[1] Routines',
    width: 24,
    height: 4,
    body: [[{ text: 'one' }], [{ text: 'two' }]],
    isFocused: false,
    footer: '1 of 2',
  });
  assert.deepEqual(lines.map(plain), [
    '╭─ [1] Routines ───────╮',
    '│ one                  │',
    '│ two                  │',
    '╰───────────── 1 of 2 ─╯',
  ]);
  for (const line of lines) assert.equal(lineWidth(line), 24);
});

test('the cursor row is a blue bar without dim text when focused and bold otherwise', () => {
  const body = [[{ text: 'row', style: S.dim }]];
  const focused = box({ title: 't', width: 12, height: 3, body, isFocused: true, highlightRow: 0 });
  assert.ok(
    (focused[1] ?? [])
      .slice(1, -1)
      .every(
        span =>
          span.style?.split(';').includes(S.selected) && !span.style.split(';').includes(S.dim),
      ),
  );
  const unfocused = box({
    title: 't',
    width: 12,
    height: 3,
    body,
    isFocused: false,
    highlightRow: 0,
  });
  assert.ok(
    (unfocused[1] ?? []).slice(1, -1).every(span => span.style?.split(';').includes(S.bold)),
  );
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
