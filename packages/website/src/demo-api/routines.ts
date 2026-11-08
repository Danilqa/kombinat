import type { AgentName } from 'domains/agent/types';
import type { RunStatus } from 'domains/run/types';
import type { SkipReason } from 'domains/scheduler/types';

import { HOME } from './constants';
import {
  bash,
  fileChange,
  hook,
  init,
  mcp,
  read,
  shell,
  text,
  webFetch,
  write,
  type TranscriptStep,
} from './transcript';

export type FinishedStatus = Exclude<RunStatus, 'running'>;

export interface DemoOutcome {
  id: string;
  // How often a scheduled run ends this way. Outcomes that only pins use have 0.
  weight: number;
  status: FinishedStatus;
  minutes: number;
  costUsd?: number;
  numTurns?: number;
  resultText?: string;
  error?: string;
  exitCode?: number | null;
  steps: TranscriptStep[];
}

export interface DemoPin {
  // 0 is the latest scheduled time before the page loaded.
  slotsAgo: number;
  outcome?: string;
  lateMinutes?: number;
  skip?: SkipReason;
}

export interface DemoManualRun {
  minutesAgo: number;
  outcome: string;
}

export interface DemoRoutine {
  name: string;
  description: string;
  schedule: string | null;
  enabled: boolean;
  agent: AgentName;
  model: string | null;
  effort: string | null;
  permissionMode: string | null;
  command: string | null;
  cwd: string;
  timeoutMinutes: number;
  maxBudgetUsd: number | null;
  prompt: string;
  runModel: string | null;
  disabledDaysAgo?: number;
  outcomes: DemoOutcome[];
  pins?: DemoPin[];
  manualRuns?: DemoManualRun[];
}

const REPO = `${HOME}/Projects/acme-web`;

const morningBriefing: DemoRoutine = {
  name: 'morning-briefing',
  description: 'Calendar, inbox and review requests in one message before work',
  schedule: '30 8 * * 1-5',
  enabled: true,
  agent: 'claude',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  permissionMode: null,
  command: null,
  cwd: HOME,
  timeoutMinutes: 10,
  maxBudgetUsd: 0.5,
  prompt: `Put together my morning briefing and send it to Telegram with \`~/bin/notify\`.

- Today's meetings, with times and who is in them.
- Unread email from people, not newsletters, that needs an answer today.
- Pull requests that wait for my review.

Keep it under 15 lines. Skip a section when it is empty.`,
  runModel: 'claude-sonnet-5-5',
  outcomes: [
    {
      id: 'sent',
      weight: 1,
      status: 'succeeded',
      minutes: 3,
      costUsd: 0.18,
      numTurns: 9,
      resultText:
        'Sent the briefing: 3 meetings (first at 10:00, design review), 2 emails to answer and 1 pull request to review.',
      steps: [
        init({ model: 'claude-sonnet-5-5', cwd: HOME, toolCount: 21, permissionMode: 'default' }),
        text("I'll collect today's calendar, inbox and review requests, then send one message."),
        bash(
          'icalbuddy -nc -iep title,datetime,attendees eventsToday',
          `• Design review
    10:00 - 10:45
    attendees: Mia Chen, Jonas Weber
• 1:1 with Sam
    13:30 - 14:00
• Release planning
    16:00 - 16:30
    attendees: Product team`,
        ),
        mcp(
          'mcp__gmail__search_threads',
          { query: 'is:unread -category:promotions newer_than:1d' },
          `2 threads
- Priya Natarajan: Contract renewal, can you confirm by Friday?
- Leo Martin: Staging deploy fails on the migrations step`,
        ),
        bash(
          'gh search prs --review-requested=@me --state=open --json number,title,repository',
          '[{"number":482,"repository":{"nameWithOwner":"acme/web"},"title":"Add CSV export to reports"}]',
        ),
        write(
          '/tmp/briefing.md',
          `**Meetings**
10:00 Design review (Mia, Jonas)
13:30 1:1 with Sam
16:00 Release planning

**Reply today**
Priya: confirm the contract renewal by Friday
Leo: staging deploy fails on migrations

**Review**
acme/web#482 Add CSV export to reports`,
        ),
        bash('~/bin/notify "$(cat /tmp/briefing.md)"', 'sent'),
      ],
    },
    {
      id: 'overloaded',
      weight: 0,
      status: 'failed',
      minutes: 1,
      costUsd: 0.02,
      numTurns: 2,
      resultText: 'API Error: 529 Overloaded. Try again in a few minutes.',
      error: 'API Error: 529 Overloaded. Try again in a few minutes.',
      steps: [
        init({ model: 'claude-sonnet-5-5', cwd: HOME, toolCount: 21, permissionMode: 'default' }),
        text("I'll collect today's calendar, inbox and review requests, then send one message."),
      ],
    },
  ],
  pins: [
    { slotsAgo: 2, lateMinutes: 47 },
    { slotsAgo: 6, outcome: 'overloaded' },
  ],
};

const umbrellaCheck: DemoRoutine = {
  name: 'umbrella-check',
  description: 'Says if you need an umbrella today',
  schedule: '0 8 * * 1-5',
  enabled: true,
  agent: 'claude',
  model: 'claude-haiku-4-5',
  effort: 'low',
  permissionMode: null,
  command: null,
  cwd: HOME,
  timeoutMinutes: 5,
  maxBudgetUsd: null,
  prompt: `Check today's weather forecast for where I am. wttr.in works without an API key.

Answer in one short line: do I need an umbrella today, and why.`,
  runModel: 'claude-haiku-4-5',
  outcomes: [
    {
      id: 'dry',
      weight: 3,
      status: 'succeeded',
      minutes: 0.7,
      costUsd: 0.01,
      numTurns: 3,
      resultText: 'No umbrella today: dry and up to 14 °C, rain only after 22:00.',
      steps: [
        init({ model: 'claude-haiku-4-5', cwd: HOME, toolCount: 21, permissionMode: 'default' }),
        webFetch(
          'https://wttr.in/?format=j1',
          'Hourly chance of rain and temperature for today',
          'Today 9–14 °C. Chance of rain: 08:00 5%, 11:00 5%, 14:00 10%, 17:00 15%, 20:00 30%, 23:00 65%.',
        ),
      ],
    },
    {
      id: 'rain',
      weight: 1,
      status: 'succeeded',
      minutes: 0.8,
      costUsd: 0.01,
      numTurns: 3,
      resultText: 'Take an umbrella: showers from 12:00 to 15:00, 80% chance.',
      steps: [
        init({ model: 'claude-haiku-4-5', cwd: HOME, toolCount: 21, permissionMode: 'default' }),
        webFetch(
          'https://wttr.in/?format=j1',
          'Hourly chance of rain and temperature for today',
          'Today 7–11 °C. Chance of rain: 08:00 20%, 11:00 55%, 14:00 80%, 17:00 40%, 20:00 15%, 23:00 10%.',
        ),
      ],
    },
  ],
};

const reviewInit = init({
  model: 'claude-opus-5-5',
  cwd: REPO,
  toolCount: 24,
  permissionMode: 'acceptEdits',
});
const pullLatest = hook('git pull --ff-only', 0, 'Already up to date.');

const prReviewSweep: DemoRoutine = {
  name: 'pr-review-sweep',
  description: 'Reviews pull requests that wait for my review',
  schedule: '15 9-17/2 * * *',
  enabled: true,
  agent: 'claude',
  model: null,
  effort: 'high',
  permissionMode: 'acceptEdits',
  command: null,
  cwd: REPO,
  timeoutMinutes: 20,
  maxBudgetUsd: 2,
  prompt: `Review every open pull request in this repo that requests my review and that I have not reviewed since its last push.

For each one, read the diff and the code around it and run the tests that cover the change. Then leave one review with \`gh pr review\`: inline comments for real problems only, and approve when there are none.

If nothing waits for review, say so and stop.`,
  runModel: 'claude-opus-5-5',
  outcomes: [
    {
      id: 'reviewed',
      weight: 2,
      status: 'succeeded',
      minutes: 7,
      costUsd: 0.62,
      numTurns: 21,
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
      error: 'before hook exited with 128: fatal: Not possible to fast-forward, aborting.',
      steps: [hook('git pull --ff-only', 128, 'fatal: Not possible to fast-forward, aborting.')],
    },
  ],
  pins: [
    { slotsAgo: 4, skip: 'already_running' },
    { slotsAgo: 13, outcome: 'timed-out' },
    { slotsAgo: 27, outcome: 'pull-failed' },
  ],
};

const dependencyUpdates: DemoRoutine = {
  name: 'dependency-updates',
  description: 'Opens a pull request with minor and patch updates',
  schedule: '0 10 * * 1',
  enabled: true,
  agent: 'codex',
  model: null,
  effort: 'medium',
  permissionMode: 'workspace-write',
  command: null,
  cwd: REPO,
  timeoutMinutes: 45,
  maxBudgetUsd: null,
  prompt: `Update the npm dependencies that have a new minor or patch release. Leave major updates alone and list them at the end.

Run \`pnpm install\`, \`pnpm typecheck\` and \`pnpm test\` after the update. If everything passes, commit to a new branch and open a pull request with \`gh pr create\`. If something fails, revert the package that broke it and say why.`,
  runModel: null,
  outcomes: [
    {
      id: 'opened',
      weight: 1,
      status: 'succeeded',
      minutes: 14,
      numTurns: 1,
      resultText:
        'Opened acme/web#486 with 7 minor and patch updates. Left the majors alone: react-router 8 and vitest 5.',
      steps: [
        init({ model: null, cwd: null, toolCount: null, permissionMode: null }),
        shell(
          'pnpm outdated',
          `┌──────────────────┬─────────┬────────┐
│ Package          │ Current │ Latest │
├──────────────────┼─────────┼────────┤
│ @tanstack/query  │ 5.107.1 │ 5.109.0│
│ react-router     │ 7.18.4  │ 8.0.1  │
│ tailwindcss      │ 4.3.3   │ 4.4.0  │
│ vitest           │ 4.2.0   │ 5.0.0  │
│ zod              │ 4.6.7   │ 4.7.2  │
└──────────────────┴─────────┴────────┘
+ 4 more`,
        ),
        text(
          'Seven packages have minor or patch updates. I will update them and keep react-router and vitest on their current majors.',
        ),
        shell(
          'pnpm update',
          'Packages: +22 -19\nProgress: resolved 812, reused 790, downloaded 22, added 22, done',
        ),
        fileChange(['package.json', 'pnpm-lock.yaml']),
        shell(
          'pnpm typecheck && pnpm test',
          ` Test Files  38 passed (38)
      Tests  214 passed (214)
   Duration  18.42s`,
        ),
        shell(
          'git switch -c deps/minor-and-patch && git commit -am "Update minor and patch dependencies" && gh pr create --fill',
          'https://github.com/acme/web/pull/486',
        ),
        text(
          'Opened acme/web#486 with 7 minor and patch updates. Left the majors alone: react-router 8 and vitest 5.',
        ),
      ],
    },
    {
      id: 'reverted',
      weight: 0,
      status: 'succeeded',
      minutes: 19,
      numTurns: 2,
      resultText:
        'Opened acme/web#471 with 5 updates. Kept zod on 4.6 because 3 schema tests fail with 4.7.',
      steps: [
        init({ model: null, cwd: null, toolCount: null, permissionMode: null }),
        shell(
          'pnpm update',
          'Packages: +17 -15\nProgress: resolved 806, reused 789, downloaded 17, added 17, done',
        ),
        fileChange(['package.json', 'pnpm-lock.yaml']),
        shell(
          'pnpm test',
          ` FAIL  src/api/schemas.test.ts > invoice schema > rejects a negative total
 Test Files  1 failed | 37 passed (38)
      Tests  3 failed | 208 passed (211)`,
        ),
        text(
          'Three schema tests fail after zod 4.7. I will pin zod back to 4.6 and run the tests again.',
        ),
        shell(
          'pnpm add zod@4.6.7 && pnpm test',
          ' Test Files  38 passed (38)\n      Tests  211 passed (211)',
        ),
        shell(
          'git switch -c deps/minor-and-patch && git commit -am "Update minor and patch dependencies" && gh pr create --fill',
          'https://github.com/acme/web/pull/471',
        ),
        text(
          'Opened acme/web#471 with 5 updates. Kept zod on 4.6 because 3 schema tests fail with 4.7.',
        ),
      ],
    },
  ],
  pins: [{ slotsAgo: 1, outcome: 'reverted' }],
};

const weeklyReport: DemoRoutine = {
  name: 'weekly-report',
  description: 'Sums up the week for the team channel',
  schedule: '0 17 * * 5',
  enabled: true,
  agent: 'claude',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  permissionMode: 'acceptEdits',
  command: null,
  cwd: REPO,
  timeoutMinutes: 15,
  maxBudgetUsd: 1,
  prompt: `Write this week's engineering summary for the team channel: merged pull requests grouped by area, closed issues, and anything that slipped.

Use \`gh\` for the data. Save the summary to \`~/Reports/week.md\` and post it with \`~/bin/notify --channel team\`.`,
  runModel: 'claude-sonnet-5-5',
  outcomes: [
    {
      id: 'posted',
      weight: 1,
      status: 'succeeded',
      minutes: 5,
      costUsd: 0.34,
      numTurns: 12,
      resultText:
        'Posted the weekly summary: 14 merged pull requests across reports, auth and CI, 9 closed issues, and SSO login slipped to next week.',
      steps: [
        init({
          model: 'claude-sonnet-5-5',
          cwd: REPO,
          toolCount: 21,
          permissionMode: 'acceptEdits',
        }),
        bash(
          'gh pr list --state merged --search "merged:>=$(date -v-7d +%F)" --json number,title,labels --limit 100',
          `[{"labels":[{"name":"reports"}],"number":482,"title":"Add CSV export to reports"},
 {"labels":[{"name":"auth"}],"number":480,"title":"Expire sessions after 30 days"},
 {"labels":[{"name":"ci"}],"number":478,"title":"Cache Playwright browsers"},
 …11 more]`,
        ),
        bash(
          'gh issue list --state closed --search "closed:>=$(date -v-7d +%F)" --json number,title',
          '[{"number":331,"title":"Totals are off by one cent"},{"number":329,"title":"Dark mode chart colors"},…7 more]',
        ),
        write(
          `${HOME}/Reports/week.md`,
          `## This week

**Reports**: CSV export (#482), faster totals (#474)
**Auth**: sessions expire after 30 days (#480)
**CI**: Playwright browsers are cached, builds take 4 min less (#478)

Closed 9 issues, including the off-by-one-cent totals (#331).

**Slipped**: SSO login (#477) moves to next week.`,
        ),
        bash('~/bin/notify --channel team "$(cat ~/Reports/week.md)"', 'sent'),
      ],
    },
  ],
};

const releaseNotes: DemoRoutine = {
  name: 'release-notes',
  description: 'Drafts release notes from what was merged since the last tag',
  schedule: null,
  enabled: true,
  agent: 'claude',
  model: null,
  effort: null,
  permissionMode: 'acceptEdits',
  command: null,
  cwd: REPO,
  timeoutMinutes: 15,
  maxBudgetUsd: 1,
  prompt: `Draft release notes for everything merged since the last tag.

Group the changes into Added, Changed and Fixed, one line each with the pull request number, written for users rather than developers. Save the draft as \`RELEASE_NOTES.md\` and do not commit it.`,
  runModel: 'claude-opus-5-5',
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
        init({ model: 'claude-opus-5-5', cwd: REPO, toolCount: 24, permissionMode: 'acceptEdits' }),
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

const notesBackup: DemoRoutine = {
  name: 'notes-backup',
  description: 'Copies my notes to the backup drive',
  schedule: '30 23 * * *',
  enabled: true,
  agent: 'command',
  model: null,
  effort: null,
  permissionMode: null,
  command: 'rsync -a --delete --stats ~/Notes/ /Volumes/Backup/Notes/ | tail -n 4',
  cwd: HOME,
  timeoutMinutes: 10,
  maxBudgetUsd: null,
  prompt: 'Back up ~/Notes to the external drive.',
  runModel: null,
  outcomes: [
    {
      id: 'synced',
      weight: 1,
      status: 'succeeded',
      minutes: 0.3,
      resultText: `Number of regular files transferred: 12
Total transferred file size: 184,330 bytes
sent 201,887 bytes  received 1,106 bytes  135,328.67 bytes/sec
total size is 48,213,904  speedup is 237.52`,
      steps: [
        text(`Number of regular files transferred: 12
Total transferred file size: 184,330 bytes
sent 201,887 bytes  received 1,106 bytes  135,328.67 bytes/sec
total size is 48,213,904  speedup is 237.52`),
      ],
    },
    {
      id: 'drive-missing',
      weight: 0,
      status: 'failed',
      minutes: 0.1,
      exitCode: 23,
      error: `rsync: change_dir#3 "/Volumes/Backup/Notes" failed: No such file or directory (2)
rsync error: some files/attrs were not transferred (see previous errors) (code 23)`,
      steps: [],
    },
  ],
  pins: [{ slotsAgo: 3, outcome: 'drive-missing' }],
};

const standupNotes: DemoRoutine = {
  name: 'standup-notes',
  description: "Turns yesterday's commits into stand-up notes",
  schedule: '45 9 * * 1-5',
  enabled: false,
  agent: 'claude',
  model: 'claude-haiku-4-5',
  effort: 'low',
  permissionMode: null,
  command: null,
  cwd: REPO,
  timeoutMinutes: 5,
  maxBudgetUsd: 0.2,
  prompt: `List what I committed yesterday in this repo as three to five stand-up bullets, plain words, no commit hashes. Post them with \`~/bin/notify --channel standup\`.`,
  runModel: 'claude-haiku-4-5',
  disabledDaysAgo: 6,
  outcomes: [
    {
      id: 'posted',
      weight: 1,
      status: 'succeeded',
      minutes: 1,
      costUsd: 0.02,
      numTurns: 4,
      resultText:
        'Posted 4 stand-up bullets: CSV export, session expiry, a flaky test fix and a review.',
      steps: [
        init({ model: 'claude-haiku-4-5', cwd: REPO, toolCount: 21, permissionMode: 'default' }),
        bash(
          'git log --author="$(git config user.email)" --since=yesterday.midnight --until=today.midnight --oneline',
          `a91f3e2 Quote CSV cells that contain commas
77c0b1d Expire sessions after 30 days
5be2d90 Retry the flaky upload test once`,
        ),
        bash('~/bin/notify --channel standup "$(cat /tmp/standup.md)"', 'sent'),
      ],
    },
  ],
};

export const demoRoutines: DemoRoutine[] = [
  morningBriefing,
  umbrellaCheck,
  prReviewSweep,
  dependencyUpdates,
  weeklyReport,
  releaseNotes,
  notesBackup,
  standupNotes,
];
