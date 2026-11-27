import { routineNameSchema } from 'domains/routine/ids';
import type { ChangedFile } from 'domains/run/types';

import { REPO, OPUS, opusInit } from '../shared';
import { bash, denied, edit, read, text, type TranscriptStep } from '../steps';
import type { DemoRoutine } from '../types';

const FLAKY_PR_COMMAND =
  'gh pr create --title "Wait for the avatar upload before saving" --body-file /tmp/pr.md';

const flakyFixSteps: TranscriptStep[] = [
  opusInit,
  bash(
    'gh run list --workflow e2e.yml --created ">=$(date -v-1d +%F)" --json databaseId,attempt --jq \'[.[] | select(.attempt > 1)]\'',
    '[{"attempt":2,"databaseId":128812}]',
  ),
  bash(
    'gh run view 128812 --attempt 1 --log-failed | grep -A4 "✘"',
    `  ✘  settings/avatar.e2e.ts:18:1 › uploads an avatar (5.2s)
    Error: expect(locator).toHaveAttribute(expected)
    Expected pattern: /avatars\\/.+\\.png/
    Received string:  "/avatars/default.png"`,
  ),
  read(
    `${REPO}/e2e/settings/avatar.e2e.ts`,
    `20    await page.getByLabel('Avatar').setInputFiles('fixtures/cat.png');
21    await page.getByRole('button', { name: 'Save' }).click();
22    await expect(page.getByRole('img', { name: 'Avatar' })).toHaveAttribute('src', /avatars\\/.+\\.png/);`,
  ),
  text(
    'Save is clicked while the upload request is still running, so the form saves the old avatar.',
  ),
  edit(
    `${REPO}/e2e/settings/avatar.e2e.ts`,
    "await page.getByLabel('Avatar').setInputFiles('fixtures/cat.png');",
    "const upload = page.waitForResponse('**/api/uploads');\n    await page.getByLabel('Avatar').setInputFiles('fixtures/cat.png');\n    await upload;",
  ),
  bash(
    'pnpm playwright test settings/avatar.e2e.ts --repeat-each 50',
    'Running 50 tests using 4 workers\n  50 passed (1.7m)',
  ),
  bash(
    'git commit -am "Wait for the avatar upload before saving" && git push -u origin HEAD',
    ' 1 file changed, 3 insertions(+), 1 deletion(-)',
  ),
  bash(FLAKY_PR_COMMAND, 'https://github.com/acme/web/pull/497'),
];

const flakyFixFiles: ChangedFile[] = [{ path: 'e2e/settings/avatar.e2e.ts', added: 3, removed: 1 }];

export const flakyE2eFixer: DemoRoutine = {
  name: routineNameSchema.parse('flaky-e2e-fixer'),
  description: 'Finds flaky end-to-end tests in CI and fixes them',
  schedule: '0 7 * * 1-5',
  enabled: true,
  agent: 'claude',
  model: OPUS,
  effort: 'high',
  permissionMode: 'auto',
  command: null,
  cwd: REPO,
  timeoutMinutes: 45,
  worktree: true,
  maxBudgetUsd: 3,
  prompt: `Find the end-to-end tests that failed and then passed on a retry in the last 24 hours of CI.

For each flaky test, find the cause in its trace, fix the test or the code, and prove the fix with 50 runs in a row. Open one pull request per test. Never hide a race with retries or longer timeouts.`,
  runModel: OPUS,
  outcomes: [
    {
      id: 'fixed',
      weight: 1,
      status: 'succeeded',
      minutes: 12,
      costUsd: 0.94,
      numTurns: 24,
      resultText:
        "Fixed 'uploads an avatar': it clicked Save before the upload finished. It now waits for the upload response, 50 runs in a row pass, and #497 is open.",
      changedFiles: flakyFixFiles,
      steps: flakyFixSteps,
    },
    {
      id: 'stable',
      weight: 1,
      status: 'succeeded',
      minutes: 2,
      costUsd: 0.09,
      numTurns: 4,
      resultText:
        'No flaky tests in the last 24 hours: 38 CI runs, and none passed only on a retry.',
      steps: [
        opusInit,
        bash(
          'gh run list --workflow e2e.yml --created ">=$(date -v-1d +%F)" --json databaseId,attempt --jq \'[.[] | select(.attempt > 1)]\'',
          '[]',
        ),
      ],
    },
    {
      id: 'blocked',
      weight: 0,
      status: 'succeeded',
      minutes: 11,
      costUsd: 0.88,
      numTurns: 23,
      resultText:
        "Fixed 'uploads an avatar' with a commit on this run's branch, and 50 runs in a row pass. Pushing it and opening the pull request need approval.",
      blockedActions: [
        { tool: 'Bash', preview: 'git push -u origin HEAD', rules: ['Bash(git push *)'] },
        { tool: 'Bash', preview: FLAKY_PR_COMMAND, rules: ['Bash(gh pr create *)'] },
      ],
      changedFiles: flakyFixFiles,
      steps: [
        ...flakyFixSteps.slice(0, -2),
        bash(
          'git commit -am "Wait for the avatar upload before saving"',
          ' 1 file changed, 3 insertions(+), 1 deletion(-)',
        ),
        denied('git push -u origin HEAD'),
        denied(FLAKY_PR_COMMAND),
        text(
          "Pushing the branch and opening the pull request need approval, and nobody can approve them in this session. The fix is committed on this run's branch.",
        ),
      ],
    },
  ],
  pins: [{ slotsAgo: 2, outcome: 'blocked' }],
};
