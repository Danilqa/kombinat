import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatCopyright } from './status-panel';

test('formatCopyright leaves the version out when the daemon does not report it', () => {
  const now = Date.parse('2026-10-06T12:00:00Z');
  assert.equal(formatCopyright('1.2.3', now), 'v1.2.3 · © 2026');
  assert.equal(formatCopyright(undefined, now), '© 2026');
});
