import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { isMatching, P } from 'ts-pattern';

import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';
import type { ChangedFile, RunRecord, RunWorktree, WorktreeChanges } from 'domains/run/types';
import { checkIsRunActive, getWorktreeBranch } from 'domains/run/utils';
import { getErrorMessage } from 'utils/error';

import { config } from '../../config';

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 60_000;
// Like Claude Code's worktrees, a slow or offline remote falls back to the last fetched branch.
const FETCH_TIMEOUT_MS = 10_000;
const LISTED_FILES = 50;
const REMOTE_HEAD = 'origin/HEAD';

interface RemovedWorktree {
  outcome: 'removed';
  worktree: RunWorktree;
}

interface KeptWorktree {
  outcome: 'has_changes';
}

type WorktreeRemoval = RemovedWorktree | KeptWorktree;

async function git(cwd: string, args: string[], timeout = GIT_TIMEOUT_MS): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      timeout,
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8',
      // A daemon has nobody to type a password, so git fails instead of waiting for one.
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return stdout;
  } catch (error) {
    const message = isMatching({ stderr: P.string }, error) ? error.stderr.trim() : '';
    throw new Error(message || getErrorMessage(error), { cause: error });
  }
}

async function tryGit(cwd: string, args: string[], timeout?: number): Promise<string | null> {
  try {
    return (await git(cwd, args, timeout)).trim();
  } catch {
    return null;
  }
}

const splitNul = (output: string): string[] => output.split('\0').filter(Boolean);

function getWorktreePath(routine: RoutineName, id: RunId): string {
  return path.join(config.stateDir, 'worktrees', routine, id);
}

interface Base {
  name: string;
  commit: string;
}

// The default branch of the remote, as Claude Code's --worktree does, so a checkout left on a
// feature branch does not decide what a routine works on.
async function findBase(checkout: string): Promise<Base> {
  const remoteBranch = await tryGit(checkout, ['rev-parse', '--abbrev-ref', REMOTE_HEAD]);
  if (remoteBranch !== null && remoteBranch !== REMOTE_HEAD) {
    const [remote = 'origin', ...branch] = remoteBranch.split('/');
    await tryGit(checkout, ['fetch', '--quiet', remote, branch.join('/')], FETCH_TIMEOUT_MS);
    const commit = await tryGit(checkout, ['rev-parse', '--verify', `${remoteBranch}^{commit}`]);
    if (commit !== null) return { name: remoteBranch, commit };
  }
  const commit = (await git(checkout, ['rev-parse', '--verify', 'HEAD^{commit}'])).trim();
  const name = await tryGit(checkout, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return { name: name === null || name === 'HEAD' ? commit.slice(0, 7) : name, commit };
}

export async function createWorktree(
  routine: RoutineName,
  id: RunId,
  cwd: string,
): Promise<RunWorktree> {
  const checkout = await tryGit(cwd, ['rev-parse', '--show-toplevel']);
  if (checkout === null) {
    throw new Error(
      `worktree: true needs a git repository, and ${cwd} is not in one (run git init there or remove worktree from the routine)`,
    );
  }
  const prefix = (await git(cwd, ['rev-parse', '--show-prefix'])).trim();
  const base = await findBase(checkout);
  const branch = getWorktreeBranch(routine, id);
  const worktreePath = getWorktreePath(routine, id);
  fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
  try {
    await git(checkout, ['worktree', 'add', '--quiet', '-b', branch, worktreePath, base.commit]);
  } catch (error) {
    throw new Error(`Could not add a worktree: ${getErrorMessage(error)}`, { cause: error });
  }
  return {
    branch,
    path: worktreePath,
    cwd: path.resolve(worktreePath, prefix),
    checkout,
    base: base.name,
    baseCommit: base.commit,
    changes: null,
    state: 'present',
  };
}

function parseNumstat(output: string): ChangedFile[] {
  return splitNul(output).map(entry => {
    const [added = '-', removed = '-', ...file] = entry.split('\t');
    const toCount = (count: string) => (count === '-' ? null : Number(count));
    return { path: file.join('\t'), added: toCount(added), removed: toCount(removed) };
  });
}

async function readChanges({
  path: worktreePath,
  baseCommit,
}: RunWorktree): Promise<WorktreeChanges> {
  const [numstat, untracked, status, commits] = await Promise.all([
    git(worktreePath, ['diff', '--numstat', '--no-renames', '-z', baseCommit]),
    git(worktreePath, ['ls-files', '--others', '--exclude-standard', '-z']),
    git(worktreePath, ['status', '--porcelain', '--no-renames', '--untracked-files=all', '-z']),
    git(worktreePath, ['rev-list', '--count', `${baseCommit}..HEAD`]),
  ]);
  const files = [
    ...parseNumstat(numstat),
    ...splitNul(untracked).map((file): ChangedFile => ({ path: file, added: null, removed: null })),
  ].sort((a, b) => a.path.localeCompare(b.path));
  return {
    files: files.slice(0, LISTED_FILES),
    fileCount: files.length,
    added: files.reduce((sum, file) => sum + (file.added ?? 0), 0),
    removed: files.reduce((sum, file) => sum + (file.removed ?? 0), 0),
    commits: Number(commits.trim()),
    uncommitted: splitNul(status).length,
  };
}

function checkIsPresent(worktree: RunWorktree): boolean {
  return isMatching({ state: 'present' }, worktree) && fs.existsSync(worktree.path);
}

// Never throws: what git cannot read keeps the worktree as it was, and the run goes on.
export async function refreshWorktree(worktree: RunWorktree): Promise<RunWorktree> {
  if (!isMatching({ state: 'present' }, worktree)) return worktree;
  if (!checkIsPresent(worktree)) return { ...worktree, state: 'removed' };
  try {
    return { ...worktree, changes: await readChanges(worktree) };
  } catch {
    return worktree;
  }
}

// A run that left nothing behind takes its worktree and branch with it, as Claude Code does.
export async function settleWorktree(worktree: RunWorktree): Promise<RunWorktree> {
  const refreshed = await refreshWorktree(worktree);
  const { changes } = refreshed;
  if (!isMatching({ state: 'present' }, refreshed) || changes === null) return refreshed;
  if (changes.commits > 0 || changes.uncommitted > 0) return refreshed;
  try {
    const tip = await git(refreshed.checkout, ['rev-parse', '--verify', refreshed.branch]);
    if (tip.trim() !== refreshed.baseCommit) return refreshed;
    await git(refreshed.checkout, ['worktree', 'remove', refreshed.path]);
    await git(refreshed.checkout, ['branch', '--quiet', '-D', refreshed.branch]);
    return { ...refreshed, state: 'discarded' };
  } catch {
    return refreshed;
  }
}

// Removes the folder only when nothing in it would be lost. Its branch stays.
export async function removeWorktree(worktree: RunWorktree): Promise<WorktreeRemoval> {
  if (!fs.existsSync(worktree.path)) {
    await tryGit(worktree.checkout, ['worktree', 'prune']);
    return { outcome: 'removed', worktree: { ...worktree, state: 'removed' } };
  }
  const status = await git(worktree.path, ['status', '--porcelain', '-z']);
  if (status !== '') return { outcome: 'has_changes' };
  await git(worktree.checkout, ['worktree', 'remove', worktree.path]);
  return { outcome: 'removed', worktree: { ...worktree, state: 'removed' } };
}

// A reply resumes the session where it ran, so a removed worktree comes back on its branch.
export async function restoreWorktree(worktree: RunWorktree): Promise<RunWorktree> {
  if (checkIsPresent(worktree)) return worktree;
  await tryGit(worktree.checkout, ['worktree', 'prune']);
  const hasBranch =
    (await tryGit(worktree.checkout, [
      'rev-parse',
      '--verify',
      '--quiet',
      `refs/heads/${worktree.branch}`,
    ])) !== null;
  const args = hasBranch
    ? [worktree.path, worktree.branch]
    : ['-b', worktree.branch, worktree.path, worktree.baseCommit];
  fs.mkdirSync(path.dirname(worktree.path), { recursive: true });
  await git(worktree.checkout, ['worktree', 'add', '--quiet', ...args]);
  return { ...worktree, state: 'present' };
}

// A worktree removed outside Kombinat shows as removed.
export function reconcileWorktree(record: RunRecord): RunRecord {
  const { worktree } = record;
  if (worktree === null || checkIsRunActive(record) || checkIsPresent(worktree)) return record;
  return isMatching({ state: 'present' }, worktree)
    ? { ...record, worktree: { ...worktree, state: 'removed' } }
    : record;
}
