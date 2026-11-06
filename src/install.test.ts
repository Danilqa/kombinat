import assert from 'node:assert/strict';
import { test } from 'node:test';

import { config } from './config';
import { buildDaemonPath, renderPlist } from './install';

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

test('plist starts the kombinat bin in the project folder', () => {
  const plist = renderPlist();
  assert.equal(plist.includes(`<string>${config.packageRoot}/bin/kombinat.js</string>`), true);
  assert.equal(
    plist.includes(`<key>WorkingDirectory</key>\n    <string>${config.projectRoot}</string>`),
    true,
  );
});
