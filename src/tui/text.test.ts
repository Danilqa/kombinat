import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  fitLine,
  lineWidth,
  plain,
  sanitize,
  sliceLine,
  textWidth,
  toAnsi,
  wrapLine,
  type Line,
} from './text';

test('measures wide and zero-width characters', () => {
  assert.equal(textWidth('abc'), 3);
  assert.equal(textWidth('日本'), 4);
  assert.equal(textWidth('✅ done'), 7);
  assert.equal(textWidth('é'), 1);
});

test('sanitize drops escape codes, control and invisible format characters and expands tabs', () => {
  assert.equal(sanitize('\x1b[31mred\x1b[0m\tx\r\x07'), 'red  x');
  assert.equal(sanitize(String.fromCodePoint(0xfeff, 0x61, 0x202e, 0x62, 0x200b, 0x63)), 'abc');
  assert.equal(sanitize('warn ⚠️'), 'warn ⚠');
});

test('fitLine pads short lines and truncates long ones with an ellipsis', () => {
  const line: Line = [{ text: 'hello', style: '1' }, { text: ' world' }];
  assert.equal(plain(fitLine(line, 14)), 'hello world   ');
  assert.equal(plain(fitLine(line, 8)), 'hello w…');
  assert.equal(lineWidth(fitLine(line, 8)), 8);
  assert.equal(plain(fitLine([{ text: '日本語' }], 4)), '日… ');
});

test('sliceLine cuts by terminal cells and keeps styles', () => {
  const line: Line = [
    { text: 'ab', style: '31' },
    { text: 'cdef', style: '32' },
  ];
  assert.deepEqual(sliceLine(line, 1, 4), [
    { text: 'b', style: '31' },
    { text: 'cd', style: '32' },
  ]);
  assert.equal(plain(sliceLine([{ text: '日本' }], 1, 4)), ' 本');
});

test('wrapLine wraps on spaces, hard-breaks long words and indents continuation lines', () => {
  const wrapped = wrapLine([{ text: 'the quick brown fox jumps' }], 10);
  assert.deepEqual(wrapped.map(plain), ['the quick', 'brown fox', 'jumps']);
  assert.deepEqual(wrapLine([{ text: 'abcdefghijkl' }], 5).map(plain), ['abcde', 'fghij', 'kl']);
  assert.deepEqual(wrapLine([{ text: '- one two three' }], 9, 2).map(plain), [
    '- one two',
    '  three',
  ]);
  assert.deepEqual(wrapLine([], 10).map(plain), ['']);
});

test('wrapLine never breaks inside the hanging prefix and never overflows', () => {
  const url = 'https://example.com/a/very/long/path';
  const wrapped = wrapLine([{ text: '• ' }, { text: url }], 20, 2);
  assert.equal(plain(wrapped[0] ?? []), `• ${url.slice(0, 18)}`);
  for (const line of wrapped) assert.ok(lineWidth(line) <= 20, plain(line));
  assert.deepEqual(wrapLine([{ text: '日本語のテキスト' }], 5).map(plain), [
    '日本',
    '語の',
    'テキ',
    'スト',
  ]);
});

test('wrapLine keeps span styles across the break', () => {
  const [first, second] = wrapLine([{ text: 'aaa ' }, { text: 'bbb ccc', style: '1' }], 7);
  assert.deepEqual(first, [{ text: 'aaa ' }, { text: 'bbb', style: '1' }]);
  assert.deepEqual(second, [{ text: 'ccc', style: '1' }]);
});

test('toAnsi resets before every span and applies the base style', () => {
  assert.equal(toAnsi([{ text: 'a', style: '1' }, { text: 'b' }]), '\x1b[0;1ma\x1b[0mb\x1b[0m');
  assert.equal(toAnsi([{ text: 'a' }], '44'), '\x1b[0;44ma\x1b[0m');
  assert.equal(
    toAnsi([{ text: 'pr', link: 'https://x.y' }]),
    '\x1b[0m\x1b]8;;https://x.y\x07pr\x1b]8;;\x07\x1b[0m',
  );
});
