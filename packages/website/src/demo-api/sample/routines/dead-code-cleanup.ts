import { routineNameSchema } from 'domains/routine/ids';

import { REPO, WORK, codexInit } from '../shared';
import { fileChange, mcp, shell, text } from '../steps';
import type { DemoRoutine } from '../types';

export const deadCodeCleanup: DemoRoutine = {
  name: routineNameSchema.parse('dead-code-cleanup'),
  description: 'Removes dead code and feature flags that are on for everyone',
  schedule: '0 10 * * 1',
  enabled: true,
  agent: 'codex',
  account: WORK,
  model: null,
  effort: 'medium',
  permissionMode: 'workspace-write',
  command: null,
  cwd: REPO,
  timeoutMinutes: 45,
  maxBudgetUsd: null,
  prompt: `Find the feature flags in LaunchDarkly that have been on for every user for at least 30 days, and the code that nothing imports.

Remove those flags from the code, keeping the enabled branch, and delete the unused files and exports. Run \`pnpm typecheck\` and \`pnpm test\`, then open one pull request with the clean-up. Do not change the flags in LaunchDarkly itself.`,
  runModel: null,
  outcomes: [
    {
      id: 'opened',
      weight: 1,
      status: 'succeeded',
      minutes: 16,
      numTurns: 1,
      resultText:
        'Opened acme/web#489: removed the new-invoice-editor and reports-v2 flags, on for everyone for 6 weeks, and 14 unused exports. 612 lines deleted, and typecheck and tests pass.',
      steps: [
        codexInit,
        mcp(
          'launchdarkly.list_flags',
          { project: 'acme-web', rollout: '100%', minDays: 30 },
          'new-invoice-editor: on for 100% for 44 days\nreports-v2: on for 100% for 41 days',
        ),
        shell(
          'rg -l "new-invoice-editor|reports-v2" src',
          `src/invoices/invoice-page.tsx
src/invoices/legacy-editor.tsx
src/reports/reports-page.tsx
src/reports/v1/table.tsx
src/flags.ts`,
        ),
        shell(
          'npx knip --include exports,files --reporter compact',
          `Unused files (2)
src/invoices/legacy-editor.tsx
src/reports/v1/table.tsx
Unused exports (14)
src/utils/format.ts: formatLegacyDate, padCents
…12 more`,
        ),
        fileChange([
          'src/flags.ts',
          'src/invoices/invoice-page.tsx',
          'src/invoices/legacy-editor.tsx',
          'src/reports/reports-page.tsx',
          'src/reports/v1/table.tsx',
          'src/utils/format.ts',
        ]),
        shell(
          'pnpm typecheck && pnpm test',
          ` Test Files  37 passed (37)
      Tests  203 passed (203)`,
        ),
        shell(
          'git switch -c cleanup/flags-and-dead-code && git commit -am "Remove finished flags and dead code" && gh pr create --fill',
          'https://github.com/acme/web/pull/489',
        ),
        text(
          'Opened acme/web#489: removed the new-invoice-editor and reports-v2 flags, on for everyone for 6 weeks, and 14 unused exports. 612 lines deleted, and typecheck and tests pass.',
        ),
      ],
    },
    {
      id: 'one-flag',
      weight: 0,
      status: 'succeeded',
      minutes: 9,
      numTurns: 1,
      resultText:
        'Opened acme/web#476: removed the csv-beta flag, on for everyone for 5 weeks. knip found no unused code.',
      steps: [
        codexInit,
        mcp(
          'launchdarkly.list_flags',
          { project: 'acme-web', rollout: '100%', minDays: 30 },
          'csv-beta: on for 100% for 36 days',
        ),
        shell(
          'npx knip --include exports,files --reporter compact',
          '✂️  Excellent, Knip found no issues.',
        ),
        fileChange(['src/flags.ts', 'src/reports/reports-page.tsx']),
        shell(
          'pnpm typecheck && pnpm test',
          ' Test Files  37 passed (37)\n      Tests  205 passed (205)',
        ),
        shell(
          'git switch -c cleanup/csv-beta && git commit -am "Remove the csv-beta flag" && gh pr create --fill',
          'https://github.com/acme/web/pull/476',
        ),
        text(
          'Opened acme/web#476: removed the csv-beta flag, on for everyone for 5 weeks. knip found no unused code.',
        ),
      ],
    },
  ],
  pins: [{ slotsAgo: 1, outcome: 'one-flag' }],
  oneTimeRuns: [{ minutesAhead: 3 * 60 }],
};
