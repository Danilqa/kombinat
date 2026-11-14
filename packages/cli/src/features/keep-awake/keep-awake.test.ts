import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';

import { buildCaffeinateArgs, checkIsKeepAwakeOn, startCaffeinate } from './keep-awake';

test('a managed daemon keeps the Mac awake when the variable is not set, a serve by hand does not', () => {
  assert.equal(
    checkIsKeepAwakeOn({ platform: 'darwin', managed: true, keepAwake: undefined }),
    true,
  );
  assert.equal(
    checkIsKeepAwakeOn({ platform: 'darwin', managed: false, keepAwake: undefined }),
    false,
  );
});

test('1 turns it on and 0 turns it off, managed or not', () => {
  for (const managed of [true, false]) {
    assert.equal(checkIsKeepAwakeOn({ platform: 'darwin', managed, keepAwake: '1' }), true);
    assert.equal(checkIsKeepAwakeOn({ platform: 'darwin', managed, keepAwake: '0' }), false);
  }
});

test('any other value counts as not set', () => {
  for (const keepAwake of ['', 'yes', 'true', 'off']) {
    assert.equal(checkIsKeepAwakeOn({ platform: 'darwin', managed: true, keepAwake }), true);
    assert.equal(checkIsKeepAwakeOn({ platform: 'darwin', managed: false, keepAwake }), false);
  }
});

test('it is off on every platform other than macOS', () => {
  for (const platform of ['linux', 'win32', 'freebsd'] as const) {
    for (const keepAwake of ['1', undefined]) {
      assert.equal(checkIsKeepAwakeOn({ platform, managed: true, keepAwake }), false);
    }
  }
});

test('caffeinate holds the system awake on AC power until the daemon exits', () => {
  assert.deepEqual(buildCaffeinateArgs(4321), ['-s', '-w', '4321']);
});

test('a caffeinate that cannot start is logged in one line and throws nothing', async () => {
  const lines: string[] = [];
  const caffeinate = startCaffeinate(line => lines.push(line), '/nonexistent/caffeinate');
  await once(caffeinate, 'error');
  assert.equal(lines.length, 1);
  assert.match(lines[0] ?? '', /^could not start caffeinate, the Mac may sleep: .*ENOENT/);
});

test('a caffeinate that exits early is logged after the start line', async () => {
  const lines: string[] = [];
  const caffeinate = startCaffeinate(line => lines.push(line), '/usr/bin/false');
  await once(caffeinate, 'exit');
  assert.equal(lines.length, 2);
  assert.match(lines[0] ?? '', /^keeping the Mac awake while on power, caffeinate pid \d+$/);
  assert.equal(lines[1], 'caffeinate exited with code 1, the Mac may sleep');
});
