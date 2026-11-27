import { routineNameSchema } from 'domains/routine/ids';

import { REPO, WORK, OPUS } from '../shared';
import { bash, hook, init, read, text } from '../steps';
import type { DemoRoutine } from '../types';

const reviewInit = init({
  model: OPUS,
  cwd: REPO,
  toolCount: 32,
  permissionMode: 'acceptEdits',
});
const pullLatest = hook('git pull --ff-only', 0, 'Already up to date.');

export const prReviewSweep: DemoRoutine = {
  name: routineNameSchema.parse('pr-review-sweep'),
  description: 'Reviews pull requests that wait for my review',
  schedule: '15 9-17/2 * * *',
  enabled: true,
  agent: 'claude',
  account: WORK,
  model: OPUS,
  effort: 'high',
  check: {
    command:
      'n=$(gh pr list --search review-requested:@me --json number --jq length); echo "Waiting for review: $n"; [ "$n" -gt 0 ] || exit 78',
    skipsOutcome: 'nothing',
    skipOutput: 'Waiting for review: 0',
  },
  permissionMode: 'acceptEdits',
  command: null,
  cwd: REPO,
  timeoutMinutes: 20,
  maxBudgetUsd: 2,
  prompt: `Review every open pull request in this repo that requests my review and that I have not reviewed since its last push.

For each one, read the diff and the code around it and run the tests that cover the change. Then leave one review with \`gh pr review\`: inline comments for real problems only, and approve when there are none.

If nothing waits for review, say so and stop.`,
  runModel: OPUS,
  outcomes: [
    {
      id: 'reviewed',
      weight: 2,
      status: 'succeeded',
      minutes: 7,
      costUsd: 0.62,
      numTurns: 21,
      checkOutput: 'Waiting for review: 1',
      resultText:
        'Reviewed #482 Add CSV export to reports: approved with 2 comments, a comma inside quoted cells breaks the row and the empty report has no test.',
      steps: [
        pullLatest,
        reviewInit,
        text('Checking which pull requests wait for my review.'),
        bash(
          'gh pr list --search "review-requested:@me" --json number,title,headRefName',
          '[{"headRefName":"csv-export","number":482,"title":"Add CSV export to reports"}]',
        ),
        bash(
          'gh pr diff 482',
          `diff --git a/src/reports/export-csv.ts b/src/reports/export-csv.ts
new file mode 100644
--- /dev/null
+++ b/src/reports/export-csv.ts
@@ -0,0 +1,14 @@
+import type { Report } from './types';
+
+function escapeCell(value: string): string {
+  return value.includes('"') ? \`"\${value.replaceAll('"', '""')}"\` : value;
+}
+
+export function exportCsv(report: Report): string {
+  const header = report.columns.map(escapeCell).join(',');
+  const rows = report.rows.map(row => row.map(escapeCell).join(','));
+  return [header, ...rows].join('\\n');
+}`,
        ),
        read(
          `${REPO}/src/reports/export-csv.test.ts`,
          `1  import { describe, expect, it } from 'vitest';
2  import { exportCsv } from './export-csv';
3
4  describe('exportCsv', () => {
5    it('writes the header and the rows', () => {
6      expect(exportCsv(sample)).toBe('Name,Total\\nAcme,120');
7    });
8  });`,
        ),
        text(
          '`escapeCell` quotes values with double quotes but not values with commas, so "Berlin, DE" splits into two cells. There is also no test for a report without rows.',
        ),
        bash(
          'pnpm vitest run src/reports',
          ` ✓ src/reports/export-csv.test.ts (1 test) 4ms
 ✓ src/reports/build-report.test.ts (5 tests) 37ms

 Test Files  2 passed (2)
      Tests  6 passed (6)`,
        ),
        bash(
          'gh pr review 482 --approve --body-file /tmp/review-482.md',
          '✓ Approved pull request acme/web#482',
        ),
      ],
    },
    {
      id: 'nothing',
      weight: 3,
      status: 'succeeded',
      minutes: 1,
      costUsd: 0.04,
      numTurns: 3,
      resultText: 'No pull requests wait for my review.',
      steps: [
        pullLatest,
        reviewInit,
        bash('gh pr list --search "review-requested:@me" --json number,title,headRefName', '[]'),
      ],
    },
    {
      id: 'timed-out',
      weight: 0,
      status: 'timed_out',
      minutes: 20,
      checkOutput: 'Waiting for review: 2',
      error: 'Killed after 20 minutes',
      steps: [
        pullLatest,
        reviewInit,
        bash(
          'gh pr list --search "review-requested:@me" --json number,title,headRefName',
          '[{"headRefName":"sso-login","number":477,"title":"Sign in with SSO"},{"headRefName":"billing-v2","number":479,"title":"Move billing to the new API"}]',
        ),
        text(
          'Two pull requests wait for review. #477 touches the login flow, so I will run the end-to-end tests too.',
        ),
        bash('pnpm test:e2e --project chromium', null),
      ],
    },
    {
      id: 'pull-failed',
      weight: 0,
      status: 'failed',
      minutes: 0.1,
      exitCode: null,
      checkOutput: 'Waiting for review: 1',
      error: 'before hook exited with 128: fatal: Not possible to fast-forward, aborting.',
      steps: [hook('git pull --ff-only', 128, 'fatal: Not possible to fast-forward, aborting.')],
    },
  ],
  pins: [
    { slotsAgo: 4, skip: 'already_running' },
    { slotsAgo: 2, outcome: 'timed-out' },
    { slotsAgo: 27, outcome: 'pull-failed' },
  ],
};
