import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getHookLabel } from './utils';

test('a hook is labelled by its phase', () => {
  assert.equal(getHookLabel('before'), 'Before hook');
  assert.equal(getHookLabel('after'), 'After hook');
});
