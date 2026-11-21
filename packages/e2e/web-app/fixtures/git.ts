import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';
import type { RunWorktree } from 'domains/run/types';
import { getWorktreeBranch } from 'domains/run/utils';

export interface WorktreeFile {
  routine: RoutineName;
  id: RunId;
  // Left in the worktree without a commit.
  uncommittedFile?: string;
}

export interface WorktreeOnDisk {
  hasFolder: boolean;
  hasBranch: boolean;
}

// Commits as a test user, whatever the git config of the machine says.
const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd, encoding: 'utf8', stdio: 'pipe' },
  ).trim();

function commitFile(cwd: string, file: string, content: string): void {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), content);
  git(cwd, 'add', file);
  git(cwd, 'commit', '--quiet', '-m', `Change ${file}`);
}

// A repository with a worktree whose branch has one commit, as a run leaves it.
export function createWorktree(root: string, { routine, id, uncommittedFile }: WorktreeFile) {
  const checkout = path.join(root, 'repos', `${routine}-${id}`);
  const worktreePath = path.join(root, 'worktrees', routine, id);
  fs.mkdirSync(checkout, { recursive: true });
  git(checkout, 'init', '--quiet', '--initial-branch=main');
  commitFile(checkout, 'e2e/checkout.e2e.ts', 'test("pays");\n');
  const baseCommit = git(checkout, 'rev-parse', 'HEAD');
  const branch = getWorktreeBranch(routine, id);
  git(checkout, 'worktree', 'add', '--quiet', '-b', branch, worktreePath, baseCommit);
  commitFile(worktreePath, 'e2e/checkout.e2e.ts', 'test("pays", retry);\nawait paid;\n');
  if (uncommittedFile !== undefined) fs.writeFileSync(path.join(worktreePath, uncommittedFile), '');
  const worktree: RunWorktree = {
    branch,
    path: worktreePath,
    cwd: worktreePath,
    checkout,
    base: 'main',
    baseCommit,
    changes: {
      files: [{ path: 'e2e/checkout.e2e.ts', added: 2, removed: 1 }],
      fileCount: 1,
      added: 2,
      removed: 1,
      commits: 1,
      uncommitted: uncommittedFile === undefined ? 0 : 1,
    },
    state: 'present',
  };
  return worktree;
}

export function inspectWorktree({
  path: worktreePath,
  checkout,
  branch,
}: RunWorktree): WorktreeOnDisk {
  return {
    hasFolder: fs.existsSync(worktreePath),
    hasBranch: git(checkout, 'branch', '--list', branch) !== '',
  };
}
