import assert from 'node:assert/strict';
import os from 'node:os';
import { test } from 'node:test';

import { buildDaemonEnv, buildDaemonPath } from './daemon';

test('daemon PATH drops plugin dirs and duplicates but keeps user entries', () => {
  const result = buildDaemonPath(
    '/opt/homebrew/bin:/x/.claude/plugins/cache/a/bin:/custom/bin:/custom/bin',
  );
  const entries = result.split(':');
  assert.equal(entries.filter(e => e === '/custom/bin').length, 1);
  assert.equal(
    entries.some(e => e.includes('.claude/plugins')),
    false,
  );
  assert.equal(entries.includes('/opt/homebrew/bin'), true);
  assert.equal(entries[0]?.endsWith('/bin'), true);
});

test('daemon env passes kombinat and agent binary variables and marks the daemon as managed', () => {
  const env = buildDaemonEnv({
    PATH: '/custom/bin',
    KOMBINAT_PORT: '7444',
    KOMBINAT_MANAGED: '0',
    CLAUDE_BIN: '/opt/claude',
    CODEX_BIN: '/opt/codex',
    SECRET_TOKEN: 'not passed',
  });
  assert.deepEqual(Object.keys(env), [
    'PATH',
    'HOME',
    'LANG',
    'KOMBINAT_PORT',
    'KOMBINAT_MANAGED',
    'CLAUDE_BIN',
    'CODEX_BIN',
  ]);
  assert.equal(env['PATH'], buildDaemonPath('/custom/bin'));
  assert.equal(env['HOME'], os.homedir());
  assert.equal(env['LANG'], 'en_US.UTF-8');
  assert.equal(env['KOMBINAT_PORT'], '7444');
  assert.equal(env['KOMBINAT_MANAGED'], '1');
  assert.equal(env['CLAUDE_BIN'], '/opt/claude');
});

test('daemon env keeps the LANG of the installing shell', () => {
  assert.equal(buildDaemonEnv({ LANG: 'de_DE.UTF-8' })['LANG'], 'de_DE.UTF-8');
});
