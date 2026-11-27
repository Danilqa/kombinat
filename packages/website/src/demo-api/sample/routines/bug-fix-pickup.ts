import { routineNameSchema } from 'domains/routine/ids';

import { REPO, OPUS, opusInit } from '../shared';
import { bash, denied, edit, read, text, type TranscriptStep } from '../steps';
import type { DemoRoutine } from '../types';

const BUGS_COMMAND =
  "gh issue list --label bug --search no:assignee --json number,title --jq 'sort_by(.number) | .[0]'";

const roundingFixSteps: TranscriptStep[] = [
  opusInit,
  bash(BUGS_COMMAND, '{"number":331,"title":"Totals are off by one cent"}'),
  bash('gh issue edit 331 --add-assignee @me', 'https://github.com/acme/web/issues/331'),
  read(
    `${REPO}/src/invoices/totals.ts`,
    `1  export function getTotal(lines: InvoiceLine[]): number {
2    return lines.reduce((sum, line) => sum + roundCents(line.amount), 0);
3  }`,
  ),
  text(
    'The total adds up line items that are already rounded, so three lines of 0.335 make 1.02 instead of 1.01. Writing a failing test first.',
  ),
  edit(
    `${REPO}/src/invoices/totals.test.ts`,
    "describe('getTotal', () => {",
    "describe('getTotal', () => {\n  it('rounds the total once', () => {\n    expect(getTotal([line(0.335), line(0.335), line(0.335)])).toBe(1.01);\n  });",
  ),
  bash(
    'pnpm vitest run src/invoices/totals.test.ts',
    ` ✗ getTotal > rounds the total once
   AssertionError: expected 1.02 to be 1.01`,
    true,
  ),
  edit(
    `${REPO}/src/invoices/totals.ts`,
    'return lines.reduce((sum, line) => sum + roundCents(line.amount), 0);',
    'return roundCents(lines.reduce((sum, line) => sum + line.amount, 0));',
  ),
  bash(
    'pnpm typecheck && pnpm test',
    ` Test Files  39 passed (39)
      Tests  218 passed (218)`,
  ),
];

export const bugFixPickup: DemoRoutine = {
  name: routineNameSchema.parse('bug-fix-pickup'),
  description: 'Fixes the oldest unassigned bug and opens a pull request',
  schedule: '30 11,14 * * *',
  enabled: true,
  agent: 'claude',
  model: OPUS,
  effort: 'high',
  permissionMode: 'auto',
  command: null,
  cwd: REPO,
  timeoutMinutes: 40,
  maxBudgetUsd: 2,
  memory: {
    text: `## Skip

- #431 needs a design decision first, it's labelled \`blocked\`
- #447 only happens on the old Android app, which this repo doesn't build

## Good to know

- Run \`pnpm test --filter api\` before the e2e tests, they take 12 minutes
- Branch names: \`fix/<issue>-<short-name>\``,
    added: 1,
    removed: 0,
  },
  prompt: `Take the oldest open issue labelled \`bug\` that nobody is assigned to, and assign it to yourself.

Reproduce it with a failing test first, then fix it. Keep the change small and run \`pnpm typecheck\` and \`pnpm test\`. Open a pull request that closes the issue. If you cannot reproduce it, or it needs a product decision, explain why in a comment, unassign yourself and stop.`,
  runModel: OPUS,
  outcomes: [
    {
      id: 'fixed',
      weight: 2,
      status: 'succeeded',
      minutes: 18,
      costUsd: 1.08,
      numTurns: 27,
      resultText:
        'Fixed #331 Totals are off by one cent: the total added up rounded line items. It now rounds once, after the sum. Opened #490 with a test.',
      steps: [
        ...roundingFixSteps,
        bash(
          'gh pr create --title "Round invoice totals once" --body "Closes #331"',
          'https://github.com/acme/web/pull/490',
        ),
      ],
    },
    {
      id: 'blocked',
      weight: 0,
      status: 'succeeded',
      minutes: 16,
      costUsd: 0.96,
      numTurns: 25,
      resultText:
        'Fixed #331 Totals are off by one cent on the branch fix/331-round-totals, with a test. Pushing it and opening the pull request need approval. The branch is only on this machine.',
      blockedActions: [
        {
          tool: 'Bash',
          preview: 'git push -u origin fix/331-round-totals',
          rules: ['Bash(git push *)'],
        },
        {
          tool: 'Bash',
          preview: 'gh pr create --title "Round invoice totals once" --body "Closes #331"',
          rules: ['Bash(gh pr create *)'],
        },
      ],
      steps: [
        ...roundingFixSteps,
        bash(
          'git switch -c fix/331-round-totals && git commit -am "Round invoice totals once"',
          `[fix/331-round-totals 4f2c9a1] Round invoice totals once
 2 files changed, 5 insertions(+), 1 deletion(-)`,
        ),
        denied('git push -u origin fix/331-round-totals'),
        denied('gh pr create --title "Round invoice totals once" --body "Closes #331"'),
        text(
          'Pushing the branch and opening the pull request need approval, and nobody can approve them in this session. The fix is committed on fix/331-round-totals.',
        ),
      ],
    },
    {
      id: 'needs-decision',
      weight: 1,
      status: 'succeeded',
      minutes: 4,
      costUsd: 0.21,
      numTurns: 7,
      resultText:
        'Skipped #344 Reports are slow for big accounts: it needs a decision about pagination, so I asked in a comment and unassigned myself.',
      steps: [
        opusInit,
        bash(BUGS_COMMAND, '{"number":344,"title":"Reports are slow for big accounts"}'),
        bash('gh issue edit 344 --add-assignee @me', 'https://github.com/acme/web/issues/344'),
        text(
          'Reports load every row at once. Fixing it means paginating or summarising, which changes what users see, so it needs a decision first.',
        ),
        bash(
          'gh issue comment 344 --body-file /tmp/question.md',
          'https://github.com/acme/web/issues/344#issuecomment-2479915',
        ),
        bash('gh issue edit 344 --remove-assignee @me', 'https://github.com/acme/web/issues/344'),
      ],
    },
  ],
  pins: [{ slotsAgo: 0, outcome: 'blocked' }],
};
