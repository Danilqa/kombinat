import assert from 'node:assert/strict';
import { test } from 'node:test';

import { appendPayload } from './payload';

test('the payload follows the prompt in a code fence', () => {
  assert.equal(
    appendPayload('Review the pull request.', '{"number":42}'),
    'Review the pull request.\n\nThis run was started by a webhook. Its request body:\n\n```\n{"number":42}\n```\n',
  );
});

test('backticks in the payload cannot close its fence', () => {
  const prompt = appendPayload('Triage.', 'Run ```pnpm test``` and ````pnpm lint````\n');
  assert.ok(prompt.endsWith('\n`````\nRun ```pnpm test``` and ````pnpm lint````\n`````\n'));
});
