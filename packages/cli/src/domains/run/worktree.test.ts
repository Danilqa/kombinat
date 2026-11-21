import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { routineNameSchema } from 'domains/routine/ids';
import { runIdSchema } from 'domains/run/ids';

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-worktree-')));
process.env['KOMBINAT_STATE_DIR'] = path.join(tmp, 'state');
// The user's git config, such as commit signing, stays out of the tests.
fs.writeFileSync(
  path.join(tmp, 'gitconfig'),
  '[user]\n\tname = Test\n\temail = test@example.com\n',
);
process.env['GIT_CONFIG_GLOBAL'] = path.join(tmp, 'gitconfig');
process.env['GIT_CONFIG_NOSYSTEM'] = '1';

const { makeRunRecord } = await import('domains/run/mocks');
const {
  createWorktree,
  reconcileWorktree,
  refreshWorktree,
  removeWorktree,
  restoreWorktree,
  settleWorktree,
} = await import('./worktree');

const routine = routineNameSchema.parse('fix-tests');
let runCount = 0;
const nextRunId = () => runIdSchema.parse(`20261121T090000Z-r${(runCount += 1)}`);

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();

function makeRepo(name: string): string {
  const repo = path.join(tmp, name);
  fs.mkdirSync(path.join(repo, 'app'), { recursive: true });
  git(repo, 'init', '--quiet', '--initial-branch=main');
  fs.writeFileSync(path.join(repo, 'app', 'index.ts'), 'export const a = 1;\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '--quiet', '-m', 'Start');
  return repo;
}

function commitFile(cwd: string, file: string, content: string): void {
  fs.writeFileSync(path.join(cwd, file), content);
  git(cwd, 'add', file);
  git(cwd, 'commit', '--quiet', '-m', `Change ${file}`);
}

test('a worktree starts in the folder of the cwd, on its own branch, and leaves the checkout alone', async () => {
  const repo = makeRepo('plain');
  fs.writeFileSync(path.join(repo, 'app', 'index.ts'), 'unfinished work\n');
  const id = nextRunId();

  const worktree = await createWorktree(routine, id, path.join(repo, 'app'));

  assert.equal(worktree.branch, `kombinat/fix-tests-${id}`);
  assert.equal(worktree.path, path.join(tmp, 'state', 'worktrees', 'fix-tests', id));
  assert.equal(worktree.cwd, path.join(worktree.path, 'app'));
  assert.equal(worktree.checkout, repo);
  assert.equal(worktree.base, 'main');
  assert.equal(git(worktree.path, 'branch', '--show-current'), worktree.branch);
  assert.equal(
    fs.readFileSync(path.join(worktree.cwd, 'index.ts'), 'utf8'),
    'export const a = 1;\n',
  );
  assert.equal(git(repo, 'branch', '--show-current'), 'main');
  assert.equal(fs.readFileSync(path.join(repo, 'app', 'index.ts'), 'utf8'), 'unfinished work\n');
});

test("a worktree starts from the remote's default branch, fetched, not from the checkout's branch", async () => {
  const origin = makeRepo('origin');
  const repo = path.join(tmp, 'clone');
  git(tmp, 'clone', '--quiet', origin, repo);
  git(repo, 'switch', '--quiet', '-c', 'my-feature');
  commitFile(repo, 'feature.ts', 'mine\n');
  commitFile(origin, 'merged.ts', 'from main\n');

  const worktree = await createWorktree(routine, nextRunId(), repo);

  assert.equal(worktree.base, 'origin/main');
  assert.equal(worktree.baseCommit, git(origin, 'rev-parse', 'HEAD'));
  assert.ok(fs.existsSync(path.join(worktree.path, 'merged.ts')));
  assert.ok(!fs.existsSync(path.join(worktree.path, 'feature.ts')));
  assert.equal(git(repo, 'branch', '--show-current'), 'my-feature');
});

test('a cwd outside a git repository gets no worktree and says why', async () => {
  const folder = path.join(tmp, 'not-a-repo');
  fs.mkdirSync(folder);
  await assert.rejects(
    createWorktree(routine, nextRunId(), folder),
    /worktree: true needs a git repository/,
  );
});

test('the changes count committed and uncommitted files against the base', async () => {
  const worktree = await createWorktree(routine, nextRunId(), makeRepo('changes'));
  commitFile(worktree.path, 'app/index.ts', 'export const a = 2;\nexport const b = 3;\n');
  fs.writeFileSync(path.join(worktree.path, 'notes.md'), 'not committed\n');

  const { changes } = await refreshWorktree(worktree);

  assert.deepEqual(changes, {
    files: [
      { path: 'app/index.ts', added: 2, removed: 1 },
      { path: 'notes.md', added: null, removed: null },
    ],
    fileCount: 2,
    added: 2,
    removed: 1,
    commits: 1,
    uncommitted: 1,
  });
});

test('a worktree with nothing in it is removed with its branch, one with work stays', async () => {
  const repo = makeRepo('settle');
  const empty = await createWorktree(routine, nextRunId(), repo);
  const worked = await createWorktree(routine, nextRunId(), repo);
  commitFile(worked.path, 'fix.ts', 'fixed\n');

  const settledEmpty = await settleWorktree(empty);
  const settledWorked = await settleWorktree(worked);

  assert.equal(settledEmpty.state, 'discarded');
  assert.ok(!fs.existsSync(empty.path));
  assert.equal(git(repo, 'branch', '--list', empty.branch), '');
  assert.equal(settledWorked.state, 'present');
  assert.equal(settledWorked.changes?.commits, 1);
});

test('removing keeps a worktree with uncommitted changes, and keeps the branch of a clean one', async () => {
  const repo = makeRepo('remove');
  const worktree = await createWorktree(routine, nextRunId(), repo);
  fs.writeFileSync(path.join(worktree.path, 'draft.ts'), 'draft\n');

  assert.deepEqual(await removeWorktree(worktree), { outcome: 'has_changes' });
  assert.ok(fs.existsSync(path.join(worktree.path, 'draft.ts')));

  git(worktree.path, 'add', 'draft.ts');
  git(worktree.path, 'commit', '--quiet', '-m', 'Draft');
  const removal = await removeWorktree(worktree);

  assert.deepEqual(removal, { outcome: 'removed', worktree: { ...worktree, state: 'removed' } });
  assert.ok(!fs.existsSync(worktree.path));
  assert.equal(git(repo, 'log', '-1', '--format=%s', worktree.branch), 'Draft');
});

test('a removed worktree comes back on its branch, and a discarded one from its base', async () => {
  const repo = makeRepo('restore');
  const removed = await createWorktree(routine, nextRunId(), repo);
  commitFile(removed.path, 'fix.ts', 'fixed\n');
  const removal = await removeWorktree(removed);
  assert.equal(removal.outcome, 'removed');
  const discarded = await settleWorktree(await createWorktree(routine, nextRunId(), repo));

  const restored = await restoreWorktree({ ...removed, state: 'removed' });
  const recreated = await restoreWorktree(discarded);

  assert.equal(restored.state, 'present');
  assert.equal(fs.readFileSync(path.join(removed.path, 'fix.ts'), 'utf8'), 'fixed\n');
  assert.equal(recreated.state, 'present');
  assert.equal(git(discarded.path, 'branch', '--show-current'), discarded.branch);
  assert.equal(git(discarded.path, 'rev-parse', 'HEAD'), discarded.baseCommit);
});

test('a worktree deleted outside Kombinat shows as removed once its run is done', async () => {
  const worktree = await createWorktree(routine, nextRunId(), makeRepo('reconcile'));
  fs.rmSync(worktree.path, { recursive: true });

  const finished = makeRunRecord({ status: 'succeeded', worktree });
  const running = makeRunRecord({ status: 'running', worktree });

  assert.equal(reconcileWorktree(finished).worktree?.state, 'removed');
  assert.equal(reconcileWorktree(running).worktree?.state, 'present');
});
