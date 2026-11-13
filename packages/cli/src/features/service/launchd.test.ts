import assert from 'node:assert/strict';
import { test } from 'node:test';

import { config } from '../../config';
import { renderPlist } from './launchd';

test('plist starts the kombinat bin in the project folder', () => {
  const plist = renderPlist();
  assert.equal(plist.includes(`<string>${config.packageRoot}/bin/kombinat.js</string>`), true);
  assert.equal(
    plist.includes(`<key>WorkingDirectory</key>\n    <string>${config.projectRoot}</string>`),
    true,
  );
});
