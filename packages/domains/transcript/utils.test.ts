import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ToolItem } from './types';
import { checkHasToolSearchMatch, getHookLabel, getMessageSourceLabel } from './utils';

test('a hook is labelled by its phase', () => {
  assert.equal(getHookLabel('before'), 'Before hook');
  assert.equal(getHookLabel('after'), 'After hook');
});

test('only a message from another sender than the dashboard is labelled', () => {
  assert.equal(getMessageSourceLabel('dashboard'), null);
  assert.equal(getMessageSourceLabel('webhook'), 'From a webhook');
});

test('a tool call matches a search in its input or result, which only opening it shows', () => {
  const tool: ToolItem = {
    kind: 'tool',
    key: 'tool-1',
    id: 'toolu_1',
    name: 'Bash',
    input: { command: 'pnpm test' },
    preview: 'pnpm test',
    result: { content: '12 tests passed', isError: false },
    isSubagent: false,
  };

  assert.equal(checkHasToolSearchMatch(tool, '"command": "pnpm'), true);
  assert.equal(checkHasToolSearchMatch(tool, 'TESTS PASSED'), true);
  assert.equal(checkHasToolSearchMatch(tool, 'Bash'), false);
  assert.equal(checkHasToolSearchMatch({ ...tool, input: undefined, result: null }, 'pnpm'), false);
});
