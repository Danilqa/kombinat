import assert from 'node:assert/strict';
import { test } from 'node:test';

import { suggestAllowRules } from './claude-rules';

const bash = (command: string, reason: string | null = null) =>
  suggestAllowRules('Bash', { command }, reason);

test('a shell command is allowed by its name and subcommand', () => {
  assert.deepEqual(bash('git push -u origin fix/totals'), ['Bash(git push *)']);
  assert.deepEqual(bash('touch /tmp/notes.md'), ['Bash(touch *)']);
  assert.deepEqual(bash('rm -rf dist'), ['Bash(rm *)']);
  assert.deepEqual(bash('make'), ['Bash(make *)']);
});

test('a command whose second word is a noun keeps the verb after it', () => {
  assert.deepEqual(bash('gh pr create --title "Round totals" --body-file /tmp/pr.md'), [
    'Bash(gh pr create *)',
  ]);
});

test('quoted text and redirections never become part of a rule', () => {
  assert.deepEqual(bash('git commit -m "a | b; c && d" 2>&1'), ['Bash(git commit *)']);
  assert.deepEqual(bash("echo 'deploy' > /etc/motd && sudo tee /etc/hosts"), ['Bash(sudo tee *)']);
});

test('each command of a chain that needs approval gets a rule, once', () => {
  assert.deepEqual(
    bash('cd /repo && NODE_ENV=production pnpm build && git push | tee push.log; git push --tags'),
    ['Bash(pnpm build *)', 'Bash(git push *)', 'Bash(tee *)'],
  );
});

test('a chain of commands that run without asking keeps a rule for its first one', () => {
  assert.deepEqual(bash('cat /etc/hosts | head -3'), ['Bash(cat *)']);
});

test('a command that reaches outside the working folders also gets a rule for that folder', () => {
  assert.deepEqual(
    bash(
      'touch /tmp/pe/proof.txt',
      "What required approval: touch in '/tmp/pe/proof.txt' needs approval. The path is outside the working directories for this session ('/repo').",
    ),
    ['Bash(touch *)', 'Edit(//tmp/pe/**)'],
  );
  assert.deepEqual(
    bash(
      'head -2 /etc/hosts',
      "What required approval: head in '/private/etc/hosts' was blocked. For security, Claude Code may only read the beginning of files from the allowed working directories for this session: '/repo'.",
    ),
    ['Bash(head *)', 'Read(//private/etc/**)'],
  );
  assert.deepEqual(
    bash(
      'ls /private/var/log | head -2',
      'What required approval: This Bash command contains multiple operations. The following part requires approval: ls /private/var/log',
    ),
    ['Bash(ls *)', 'Read(//private/var/**)'],
  );
  assert.deepEqual(bash('git push', 'What required approval: This command requires approval'), [
    'Bash(git push *)',
  ]);
});

test('a file tool is allowed in the folder of its file, from the root', () => {
  assert.deepEqual(suggestAllowRules('Write', { file_path: '/Users/me/My Notes/today.md' }, null), [
    'Edit(//Users/me/My Notes/**)',
  ]);
  assert.deepEqual(suggestAllowRules('Read', { file_path: '/etc/hosts' }, null), [
    'Read(//etc/**)',
  ]);
  assert.deepEqual(suggestAllowRules('Grep', { pattern: 'TODO', path: '/srv/app' }, null), [
    'Read(//srv/app/**)',
  ]);
  assert.deepEqual(suggestAllowRules('Edit', { file_path: 'relative.ts' }, null), ['Edit']);
});

test('a fetch is allowed by its domain, and any other tool by its name', () => {
  assert.deepEqual(suggestAllowRules('WebFetch', { url: 'https://docs.acme.dev/api?x=1' }, null), [
    'WebFetch(domain:docs.acme.dev)',
  ]);
  assert.deepEqual(suggestAllowRules('WebFetch', { url: 'not a url' }, null), ['WebFetch']);
  assert.deepEqual(suggestAllowRules('mcp__github__create_issue', { title: 'Bug' }, null), [
    'mcp__github__create_issue',
  ]);
});
