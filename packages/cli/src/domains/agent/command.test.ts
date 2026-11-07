import assert from 'node:assert/strict';
import { test } from 'node:test';

import { makeRunRecord } from 'domains/run/mocks';

import { commandAgent } from './command';
import { makeAgentTask } from './testing';

test('pipes the prompt into a shell command', () => {
  const { command, args, input, env } = commandAgent.buildInvocation({
    routine: makeAgentTask({ command: 'gemini --yolo' }),
    runId: 'r1',
    trigger: 'manual',
  });
  assert.equal(command, '/bin/sh');
  assert.deepEqual(args, ['-c', 'gemini --yolo']);
  assert.equal(input, 'Hello\n');
  assert.equal(env['KOMBINAT_RUN_ID'], 'r1');
});

test('collects the output lines as the result and the transcript', () => {
  const first = { type: 'output', text: '# Report' };
  const second = { type: 'output', text: 'All good' };
  const afterFirst = commandAgent.readEvent(first, makeRunRecord());
  assert.deepEqual(afterFirst, { resultText: '# Report' });
  assert.deepEqual(commandAgent.readEvent(second, makeRunRecord({ resultText: '# Report' })), {
    resultText: '# Report\nAll good',
  });
  assert.deepEqual(commandAgent.buildTranscript([first, second]), [
    { kind: 'text', key: 'output', text: '# Report\nAll good', isSubagent: false },
  ]);
  assert.equal(commandAgent.getResumeCommand('x'), null);
});
