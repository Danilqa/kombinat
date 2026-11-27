import { routineNameSchema } from 'domains/routine/ids';

import { REPO, OPUS } from '../shared';
import { bash, init, text, write } from '../steps';
import type { DemoRoutine } from '../types';

export const writeReleaseNotes: DemoRoutine = {
  name: routineNameSchema.parse('write-release-notes'),
  description: 'Drafts release notes from what was merged since the last tag',
  schedule: null,
  enabled: true,
  startsAfter: routineNameSchema.parse('pr-review-sweep'),
  startsWhen: 'has-findings',
  agent: 'claude',
  model: OPUS,
  effort: 'high',
  permissionMode: 'acceptEdits',
  command: null,
  cwd: REPO,
  timeoutMinutes: 15,
  maxBudgetUsd: 1,
  prompt: `Draft release notes for everything merged since the last tag.

Group the changes into Added, Changed and Fixed, one line each with the pull request number, written for users rather than developers. Save the draft as \`RELEASE_NOTES.md\` and do not commit it.`,
  runModel: OPUS,
  outcomes: [
    {
      id: 'drafted',
      weight: 1,
      status: 'succeeded',
      minutes: 6,
      costUsd: 0.48,
      numTurns: 14,
      resultText:
        'Drafted RELEASE_NOTES.md for v2.8.0: 4 added, 6 changed and 5 fixed since v2.7.3.',
      steps: [
        init({ model: OPUS, cwd: REPO, toolCount: 32, permissionMode: 'acceptEdits' }),
        bash('git describe --tags --abbrev=0', 'v2.7.3'),
        bash(
          'git log v2.7.3..HEAD --merges --oneline',
          `9f2c1ab Merge pull request #482 from acme/csv-export
4e81d07 Merge pull request #480 from acme/session-expiry
c03a5f2 Merge pull request #478 from acme/cache-browsers
…12 more`,
        ),
        text(
          '15 pull requests since v2.7.3. Reading their descriptions to write the notes for users.',
        ),
        bash(
          'gh pr view 482 --json title,body',
          '{"body":"Adds a CSV button to every report…","title":"Add CSV export to reports"}',
        ),
        write(
          `${REPO}/RELEASE_NOTES.md`,
          `# v2.8.0

## Added
- Export any report as CSV (#482)

## Changed
- You stay signed in for up to 30 days (#480)

## Fixed
- Report totals no longer drift by a cent (#474)`,
        ),
      ],
    },
  ],
  manualRuns: [
    { minutesAgo: 2, outcome: 'drafted' },
    { minutesAgo: 3 * 24 * 60 + 125, outcome: 'drafted' },
  ],
};
