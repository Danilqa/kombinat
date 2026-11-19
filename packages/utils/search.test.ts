import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  checkMatchesSearch,
  countSearchMatches,
  findSearchMatches,
  getSearchExcerpt,
} from './search';

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

test('findSearchMatches finds every place of the whole phrase, in any case', () => {
  const text = 'Ran pnpm test. PNPM Test passed, then pnpm lint';

  assert.deepEqual(findSearchMatches(text, 'pnpm test'), [
    { start: 4, end: 13 },
    { start: 15, end: 24 },
  ]);
  assert.deepEqual(findSearchMatches(text, 'test pnpm'), []);
  assert.deepEqual(findSearchMatches(text, ''), []);
});

test('findSearchMatches takes the characters of a regular expression literally', () => {
  assert.deepEqual(findSearchMatches('cost $1.50 (estimated)', '$1.50 ('), [{ start: 5, end: 12 }]);
  assert.deepEqual(findSearchMatches('cost 1250', '1.5'), []);
});

test('countSearchMatches counts the places that findSearchMatches finds', () => {
  const text = 'Ran pnpm test. PNPM Test passed, cost $1.50 (estimated)';

  assert.equal(countSearchMatches(text, 'pnpm test'), 2);
  assert.equal(countSearchMatches(text, '$1.50 ('), 1);
  assert.equal(countSearchMatches(text, 'pnpm lint'), 0);
  assert.equal(countSearchMatches(text, ''), 0);
});
