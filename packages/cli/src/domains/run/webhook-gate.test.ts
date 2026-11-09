import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildRoutine } from '../routine/utils';
import { decideWebhook } from './webhook-gate';

const buildGatedRoutine = (gate: string | null) =>
  buildRoutine(
    '/tmp/demo.md',
    `---\ncwd: /tmp\nwebhook: true\n${gate === null ? '' : `webhookGate: ${gate}\n`}---\nTriage.`,
  );

const buildRequest = (body: string, headers = {}) => ({ body: Buffer.from(body), headers });

test('without a gate every request runs with its body', async () => {
  assert.deepEqual(await decideWebhook(buildGatedRoutine(null), buildRequest('{"id":1}')), {
    outcome: 'run',
    payload: '{"id":1}',
  });
});

test('the gate reads the body and the headers and can replace the payload', async () => {
  const gate = buildGatedRoutine(
    `test "$(cat)" = hello && test "$KOMBINAT_REPO" = "$(pwd)" && printf '%s' "$KOMBINAT_WEBHOOK_HEADERS"`,
  );
  assert.deepEqual(await decideWebhook(gate, buildRequest('hello', { 'linear-event': 'Issue' })), {
    outcome: 'run',
    payload: '{"linear-event":"Issue"}',
  });
});

test('a gate that prints nothing keeps the body as the payload', async () => {
  assert.deepEqual(
    await decideWebhook(buildGatedRoutine('cat > /dev/null'), buildRequest('{"id":1}')),
    {
      outcome: 'run',
      payload: '{"id":1}',
    },
  );
});

test('exit code 78 ignores the request and its JSON output becomes the answer', async () => {
  assert.deepEqual(
    await decideWebhook(
      buildGatedRoutine(`echo '{"challenge":"abc"}'; exit 78`),
      buildRequest('{}'),
    ),
    { outcome: 'ignore', response: { challenge: 'abc' } },
  );
  assert.deepEqual(await decideWebhook(buildGatedRoutine('exit 78'), buildRequest('{}')), {
    outcome: 'ignore',
    response: null,
  });
});

test('any other exit code rejects the request', async () => {
  assert.deepEqual(
    await decideWebhook(buildGatedRoutine('echo bad signature >&2; exit 1'), buildRequest('{}')),
    {
      outcome: 'reject',
      reason: 'exited with 1: bad signature',
    },
  );
});

test('a gate that ignores the body or runs too long still gets an answer', async () => {
  const large = 'x'.repeat(300_000);
  assert.deepEqual(await decideWebhook(buildGatedRoutine('true'), buildRequest(large)), {
    outcome: 'run',
    payload: large,
  });
  assert.deepEqual(await decideWebhook(buildGatedRoutine('sleep 5'), buildRequest('{}'), 100), {
    outcome: 'timeout',
  });
});
