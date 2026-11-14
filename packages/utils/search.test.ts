import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkMatchesSearch, getSearchExcerpt } from './search';

test('checkMatchesSearch needs every word somewhere in the texts, in any case', () => {
  const texts = ['daily-digest', null, 'Posted the summary to Slack'];

  assert.equal(checkMatchesSearch('digest slack', texts), true);
  assert.equal(checkMatchesSearch('  DIGEST  ', texts), true);
  assert.equal(checkMatchesSearch('digest email', texts), false);
  assert.equal(checkMatchesSearch('', texts), true);
});

test('getSearchExcerpt shows the text around the first word found, on one line', () => {
  const text = `${'a'.repeat(50)} Opened\nPR #42 for the flaky test`;

  assert.equal(getSearchExcerpt(text, 'pr'), `…${'a'.repeat(16)} Opened PR #42 for the flaky test`);
  assert.equal(getSearchExcerpt('Opened PR #42', 'opened'), 'Opened PR #42');
  assert.equal(getSearchExcerpt('Opened PR #42', 'merged'), null);
});
