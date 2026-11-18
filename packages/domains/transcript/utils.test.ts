import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getHookLabel, getMessageSourceLabel } from './utils';

test('a hook is labelled by its phase', () => {
  assert.equal(getHookLabel('before'), 'Before hook');
  assert.equal(getHookLabel('after'), 'After hook');
});

test('only a message from another sender than the dashboard is labelled', () => {
  assert.equal(getMessageSourceLabel('dashboard'), null);
  assert.equal(getMessageSourceLabel('webhook'), 'From a webhook');
});
