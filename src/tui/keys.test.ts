import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createKeyReader, parseKeys } from './keys';

test('parses printable characters one by one', () => {
  assert.deepEqual(parseKeys('jk?G'), ['j', 'k', '?', 'G']);
  assert.deepEqual(parseKeys(' '), ['space']);
});

test('parses arrows and navigation keys in both cursor modes', () => {
  assert.deepEqual(parseKeys('\x1b[A\x1b[B\x1b[C\x1b[D'), ['up', 'down', 'right', 'left']);
  assert.deepEqual(parseKeys('\x1bOA\x1bOB'), ['up', 'down']);
  assert.deepEqual(parseKeys('\x1b[5~\x1b[6~\x1b[H\x1b[F\x1b[1~\x1b[4~'), [
    'pageup',
    'pagedown',
    'home',
    'end',
    'home',
    'end',
  ]);
  assert.deepEqual(parseKeys('\x1b[Z'), ['S-tab']);
});

test('parses control keys, enter, tab, backspace and a lone escape', () => {
  assert.deepEqual(parseKeys('\r\n\t\x7f'), ['enter', 'enter', 'tab', 'backspace']);
  assert.deepEqual(parseKeys('\x03\x04\x15\x12'), ['C-c', 'C-d', 'C-u', 'C-r']);
  assert.deepEqual(parseKeys('\x1b'), ['escape']);
  assert.deepEqual(parseKeys('\x1bx'), ['escape', 'x']);
});

test('skips escape sequences it does not know', () => {
  assert.deepEqual(parseKeys('\x1b[1;5Aj'), ['j']);
  assert.deepEqual(parseKeys('\x1b[3~j'), ['j']);
});

test('marks bracketed paste start and end', () => {
  assert.deepEqual(parseKeys('\x1b[200~ry\x1b[201~j'), ['paste-start', 'r', 'y', 'paste-end', 'j']);
});

test('the key reader drops pasted text, even across chunks, so a paste can never start a run', () => {
  const read = createKeyReader();
  assert.deepEqual(read('\x1b[200~eve'), []);
  assert.deepEqual(read('ry\x1b[201~j'), ['j']);
  assert.deepEqual(read('k'), ['k']);
});

test('the key reader waits for the rest of an escape sequence split across chunks', () => {
  const read = createKeyReader();
  assert.deepEqual(read('j\x1b['), ['j']);
  assert.deepEqual(read('A'), ['up']);
  assert.deepEqual(read('\x1b[5'), []);
  assert.deepEqual(read('~'), ['pageup']);
  assert.deepEqual(read('\x1b'), ['escape']);
});
