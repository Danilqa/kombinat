import assert from 'node:assert/strict';
import { test } from 'node:test';

import { makeRunRecord } from 'domains/run/mocks';
import type { RunWorktree } from 'domains/run/types';

import { plain } from '../../terminal/text';
import { runHeaderLines } from './run-header';

const worktree: RunWorktree = {
  branch: 'kombinat/fixer-20261117T090000Z-wtre',
  path: '/state/worktrees/fixer/20261117T090000Z-wtre',
  cwd: '/state/worktrees/fixer/20261117T090000Z-wtre/app',
  checkout: '/code/shop',
  base: 'origin/main',
  baseCommit: '3f2a1bc',
  changes: null,
  state: 'present',
};

function readResumeLine(state: RunWorktree['state']): string {
  const run = makeRunRecord({
    resumeCommand: 'claude --resume s1',
    worktree: { ...worktree, state },
  });
  const screen = runHeaderLines(run, '/code/shop/app', 400, Date.now())
    .map(({ line }) => plain(line))
    .join('\n');
  return /resume\s+(?<command>.+)/.exec(screen)?.groups?.['command']?.trim() ?? '';
}

test('the resume line brings a worktree that is gone back before it resumes the session there', () => {
  assert.equal(
    readResumeLine('present'),
    'cd /state/worktrees/fixer/20261117T090000Z-wtre/app && claude --resume s1',
  );
  assert.equal(
    readResumeLine('removed'),
    'cd /code/shop && git worktree prune && git worktree add /state/worktrees/fixer/20261117T090000Z-wtre kombinat/fixer-20261117T090000Z-wtre && cd /state/worktrees/fixer/20261117T090000Z-wtre/app && claude --resume s1',
  );
  assert.equal(
    readResumeLine('discarded'),
    'cd /code/shop && git worktree prune && git worktree add -b kombinat/fixer-20261117T090000Z-wtre /state/worktrees/fixer/20261117T090000Z-wtre 3f2a1bc && cd /state/worktrees/fixer/20261117T090000Z-wtre/app && claude --resume s1',
  );
});

test('the blocked hint of a worktree run says to push the rules to its base, wrapped to the width', () => {
  const run = makeRunRecord({
    blockedActions: [{ tool: 'Bash', preview: 'git push', rules: ['Bash(git push *)'] }],
    worktree,
  });
  const lines = runHeaderLines(run, '/code/shop/app', 60, Date.now()).map(({ line }) =>
    plain(line),
  );
  const start = lines.findIndex(line => line.startsWith('BLOCKED'));
  assert.ok(lines.every(line => line.length <= 60));
  assert.equal(
    lines
      .slice(start, start + 2)
      .map(line => line.trim())
      .join(' '),
    'BLOCKED  add the rules to permissions.allow in .claude/settings.json and push the change to origin/main',
  );
});
