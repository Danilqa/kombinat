import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ToolItem } from './types';
import {
  countToolSearchMatches,
  getHookLabel,
  getMessageSourceLabel,
  getTurnsLabel,
} from './utils';

test('a hook is labelled by its phase', () => {
  assert.equal(getHookLabel('before'), 'Before hook');
  assert.equal(getHookLabel('after'), 'After hook');
});

test('only a message from another sender than the dashboard is labelled', () => {
  assert.equal(getMessageSourceLabel('dashboard'), null);
  assert.equal(getMessageSourceLabel('webhook'), 'From a webhook');
});

test('a tool call counts the matches in its input and result, which only opening it shows', () => {
  const tool: ToolItem = {
    kind: 'tool',
    key: 'tool-1',
    id: 'toolu_1',
    name: 'Bash',
    input: { command: 'pnpm test' },
    preview: 'pnpm test',
    result: { content: '12 tests passed, pnpm test done', isError: false },
    isSubagent: false,
  };

  assert.equal(countToolSearchMatches(tool, 'pnpm test'), 2);
  assert.equal(countToolSearchMatches(tool, '"command": "pnpm'), 1);
  assert.equal(countToolSearchMatches(tool, 'TESTS PASSED'), 1);
  assert.equal(countToolSearchMatches(tool, 'Bash'), 0);
  assert.equal(
    countToolSearchMatches({ ...tool, input: undefined, result: null }, 'result yet'),
    1,
  );
});

test('one turn is singular, any other count or an unknown one is plural', () => {
  assert.equal(getTurnsLabel(1), 'turn');
  assert.equal(getTurnsLabel(49), 'turns');
  assert.equal(getTurnsLabel(0), 'turns');
  assert.equal(getTurnsLabel(null), 'turns');
});
