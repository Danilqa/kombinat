import assert from 'node:assert/strict';
import { test } from 'node:test';

import { routineNameSchema } from 'domains/routine/ids';
import { runIdSchema } from 'domains/run/ids';
import { makeRunRecord } from 'domains/run/mocks';

import { appendChainedRun, appendPayload } from './payload';

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

test('a run started after another one gets its result after the prompt', () => {
  const run = makeRunRecord({
    id: runIdSchema.parse('20261006T020000Z-k3x9'),
    routine: routineNameSchema.parse('night-tasks'),
    status: 'succeeded',
    resultText: 'Opened #491 and #492.',
  });
  assert.equal(
    appendChainedRun('Review the new pull requests.', run),
    'Review the new pull requests.\n\nThis run started after run 20261006T020000Z-k3x9 of night-tasks ended as succeeded. Its result:\n\n```\nOpened #491 and #492.\n```\n',
  );
  assert.ok(
    appendChainedRun('Fix it.', {
      ...run,
      status: 'failed',
      resultText: null,
      error: 'Exit 1',
    }).endsWith('ended as failed. Its result:\n\n```\nExit 1\n```\n'),
  );
  assert.ok(
    appendChainedRun('Fix it.', { ...run, status: 'aborted', resultText: null }).endsWith(
      'ended as aborted. That run left no result.\n',
    ),
  );
});
