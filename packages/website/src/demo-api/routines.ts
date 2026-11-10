import type { AgentName } from 'domains/agent/types';
import type { RunStatus } from 'domains/run/types';
import type { SkipReason } from 'domains/scheduler/types';

import { HOME } from './constants';
import {
  bash,
  edit,
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

export interface DemoStartedRun {
  minutesAgo: number;
  outcome: string;
}

export interface DemoRoutine {
  name: string;
  description: string;
  schedule: string | null;
  enabled: boolean;
  webhook?: boolean;
  webhookGate?: string;
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
  manualRuns?: DemoStartedRun[];
  webhookRuns?: DemoStartedRun[];
}

const REPO = `${HOME}/Projects/acme-web`;
const OPUS = 'claude-opus-5-5';
const SONNET = 'claude-sonnet-5-5';
const FABLE = 'claude-fable-5-1';

const opusInit = init({ model: OPUS, cwd: REPO, toolCount: 32, permissionMode: 'auto' });
const sonnetInit = init({ model: SONNET, cwd: REPO, toolCount: 32, permissionMode: 'auto' });
const fableInit = init({ model: FABLE, cwd: REPO, toolCount: 32, permissionMode: 'auto' });
const codexInit = init({ model: null, cwd: null, toolCount: null, permissionMode: null });

const AGENT_QUEUE_COMMAND =
  "gh issue list --label agent --state open --json number,title --jq 'sort_by(.number)'";

const nightAgentTasks: DemoRoutine = {
  name: 'night-agent-tasks',
  description: 'Works through the issues labelled agent while I sleep',
  schedule: '0 2 * * *',
  enabled: true,
  agent: 'claude',
  model: OPUS,
  effort: 'xhigh',
  permissionMode: 'bypassPermissions',
  command: null,
  cwd: REPO,
  timeoutMinutes: 240,
  maxBudgetUsd: 5,
  prompt: `Pick up the open issues labelled \`agent\` in this repo, oldest first, until the queue is empty.

For each one, create a branch, implement it, add or update tests, and run \`pnpm typecheck\`, \`pnpm lint\` and \`pnpm test\`. Open a draft pull request that links the issue and explains the change. If the issue is unclear or needs a product decision, leave a question on it and move on.

Never merge, and keep one issue per branch.`,
  runModel: OPUS,
  outcomes: [
    {
      id: 'opened',
      weight: 3,
      status: 'succeeded',
      minutes: 46,
      costUsd: 3.12,
      numTurns: 58,
      resultText:
        'Opened 3 draft pull requests: #491 Remember the last report filter, #492 Show the invoice number in the email subject and #493 Add a loading state to the export button. Left a question on #388: should archived clients count toward the plan limit?',
      steps: [
        hook('git switch main && git pull --ff-only', 0, 'Already up to date.'),
        init({ model: OPUS, cwd: REPO, toolCount: 32, permissionMode: 'bypassPermissions' }),
        bash(
          AGENT_QUEUE_COMMAND,
          `[{"number":388,"title":"Archived clients and the plan limit"},
 {"number":402,"title":"Remember the last report filter"},
 {"number":417,"title":"Invoice number in the email subject"},
 {"number":421,"title":"Loading state on the export button"}]`,
        ),
        bash(
          'gh issue view 388 --json body --jq .body',
          'Archived clients should not count toward the plan limit. Or should they? Check with product.',
        ),
        bash(
          'gh issue comment 388 --body "Should archived clients count toward the plan limit? I will pick this up once it is decided."',
          'https://github.com/acme/web/issues/388#issuecomment-2481190',
        ),
        text('#388 needs a product decision, so I left a question. Moving on to #402.'),
        bash(
          'git switch -c agent/402-remember-report-filter',
          "Switched to a new branch 'agent/402-remember-report-filter'",
        ),
        read(
          `${REPO}/src/reports/use-report-filter.ts`,
          `1  export function useReportFilter() {
2    const [filter, setFilter] = useState<ReportFilter>(DEFAULT_FILTER);
3    return { filter, setFilter };
4  }`,
        ),
        edit(
          `${REPO}/src/reports/use-report-filter.ts`,
          'const [filter, setFilter] = useState<ReportFilter>(DEFAULT_FILTER);',
          "const [filter, setFilter] = useStoredState<ReportFilter>('report-filter', DEFAULT_FILTER);",
        ),
        bash(
          'pnpm typecheck && pnpm lint && pnpm test',
          ` Test Files  39 passed (39)
      Tests  217 passed (217)`,
        ),
        bash(
          'gh pr create --draft --title "Remember the last report filter" --body-file /tmp/pr-402.md',
          'https://github.com/acme/web/pull/491',
        ),
        text('Opened #491. Doing the same for #417 and #421.'),
        bash(
          'gh pr create --draft --title "Show the invoice number in the email subject" --body-file /tmp/pr-417.md',
          'https://github.com/acme/web/pull/492',
        ),
        bash(
          'gh pr create --draft --title "Add a loading state to the export button" --body-file /tmp/pr-421.md',
          'https://github.com/acme/web/pull/493',
        ),
      ],
    },
    {
      id: 'empty',
      weight: 1,
      status: 'succeeded',
      minutes: 1,
      costUsd: 0.05,
      numTurns: 3,
      resultText: 'No open issues are labelled agent.',
      steps: [
        hook('git switch main && git pull --ff-only', 0, 'Already up to date.'),
        init({ model: OPUS, cwd: REPO, toolCount: 32, permissionMode: 'bypassPermissions' }),
        bash(AGENT_QUEUE_COMMAND, '[]'),
      ],
    },
    {
      id: 'budget',
      weight: 0,
      status: 'failed',
      minutes: 71,
      costUsd: 5,
      numTurns: 83,
      resultText:
        'Reached the $5.00 budget after 2 of 5 issues: opened #470 and #471. #474, #476 and #480 are still in the queue.',
      error:
        'Reached the $5.00 budget after 2 of 5 issues: opened #470 and #471. #474, #476 and #480 are still in the queue.',
      steps: [
        hook('git switch main && git pull --ff-only', 0, 'Updating 4e81d07..9f2c1ab\nFast-forward'),
        init({ model: OPUS, cwd: REPO, toolCount: 32, permissionMode: 'bypassPermissions' }),
        bash(
          AGENT_QUEUE_COMMAND,
          '[{"number":466,"title":"Bulk archive clients"},{"number":468,"title":"Sort invoices by due date"},…3 more]',
        ),
        bash(
          'gh pr create --draft --title "Bulk archive clients" --body-file /tmp/pr-466.md',
          'https://github.com/acme/web/pull/470',
        ),
        bash(
          'gh pr create --draft --title "Sort invoices by due date" --body-file /tmp/pr-468.md',
          'https://github.com/acme/web/pull/471',
        ),
        text('Starting #474: the PDF export has to keep table headers on every page.'),
      ],
    },
  ],
  pins: [{ slotsAgo: 3, outcome: 'budget' }],
};

const DESIGN_ISSUES_COMMAND = 'gh issue list --label design --state open --json number,title';
const KNOWN_DESIGN_ISSUES =
  '[{"number":498,"title":"Sidebar icons are misaligned in Safari"},{"number":503,"title":"The invoices empty state has no call to action"}]';

const designUxIssues: DemoRoutine = {
  name: 'design-ux-issues',
  description: 'Clicks through the app at night and files design and UX issues',
  schedule: '30 3 * * *',
  enabled: true,
  agent: 'claude',
  model: SONNET,
  effort: 'high',
  permissionMode: 'auto',
  command: null,
  cwd: REPO,
  timeoutMinutes: 60,
  maxBudgetUsd: 3,
  prompt: `Start the app with \`pnpm dev\` and go through the main flows with the Playwright MCP: sign-in, dashboard, reports, invoices and settings, at desktop (1440×900) and phone (390×844) sizes, in light and dark mode.

Look for broken layouts, text that overflows or is cut off, low contrast, inconsistent spacing or wording, and steps that take more clicks than they should. Check the open issues labelled \`design\` first so you do not file duplicates. File each new problem as an issue labelled \`design\`, with a screenshot and the steps to see it.`,
  runModel: SONNET,
  outcomes: [
    {
      id: 'filed',
      weight: 2,
      status: 'succeeded',
      minutes: 24,
      costUsd: 1.86,
      numTurns: 41,
      resultText:
        'Filed 3 issues: #512 the date picker overflows the screen on phones, #513 the Save button has 2.9:1 contrast in dark mode and #514 the reports page says Export in one place and Download in another.',
      steps: [
        sonnetInit,
        bash('pnpm dev --port 4300 > /tmp/dev.log 2>&1 &', '[1] 51022'),
        bash(DESIGN_ISSUES_COMMAND, KNOWN_DESIGN_ISSUES),
        mcp(
          'mcp__playwright__browser_navigate',
          { url: 'http://localhost:4300/reports' },
          'Navigated to http://localhost:4300/reports\nPage title: Reports · Acme',
        ),
        mcp(
          'mcp__playwright__browser_resize',
          { width: 390, height: 844 },
          'Resized the browser window to 390×844',
        ),
        mcp(
          'mcp__playwright__browser_click',
          { element: 'Date range button', ref: 'e42' },
          'Clicked Date range button',
        ),
        mcp(
          'mcp__playwright__browser_take_screenshot',
          { filename: 'date-picker-phone.png' },
          'Saved the screenshot to date-picker-phone.png',
        ),
        text(
          'On a phone the date picker is 412 px wide, so its right column is cut off. It is not among the open design issues.',
        ),
        bash(
          'gh issue create --label design --title "Date picker overflows the screen on phones" --body-file /tmp/issue-date-picker.md',
          'https://github.com/acme/web/issues/512',
        ),
        mcp(
          'mcp__playwright__browser_navigate',
          { url: 'http://localhost:4300/settings?theme=dark' },
          'Navigated to http://localhost:4300/settings?theme=dark\nPage title: Settings · Acme',
        ),
        text(
          'In dark mode the Save button is #5b6ee1 text on #3a3f58, a 2.9:1 contrast. Buttons need at least 4.5:1.',
        ),
        bash(
          'gh issue create --label design --title "Save button has low contrast in dark mode" --body-file /tmp/issue-contrast.md',
          'https://github.com/acme/web/issues/513',
        ),
        bash(
          'gh issue create --label design --title "Reports page says Export and Download for the same action" --body-file /tmp/issue-wording.md',
          'https://github.com/acme/web/issues/514',
        ),
      ],
    },
    {
      id: 'clean',
      weight: 1,
      status: 'succeeded',
      minutes: 17,
      costUsd: 1.12,
      numTurns: 29,
      resultText:
        'Went through 14 screens at both sizes in light and dark mode. Nothing new; #498 and #503 are still open.',
      steps: [
        sonnetInit,
        bash('pnpm dev --port 4300 > /tmp/dev.log 2>&1 &', '[1] 49310'),
        bash(DESIGN_ISSUES_COMMAND, KNOWN_DESIGN_ISSUES),
        mcp(
          'mcp__playwright__browser_navigate',
          { url: 'http://localhost:4300/dashboard' },
          'Navigated to http://localhost:4300/dashboard\nPage title: Dashboard · Acme',
        ),
        mcp(
          'mcp__playwright__browser_take_screenshot',
          { filename: 'dashboard-desktop.png' },
          'Saved the screenshot to dashboard-desktop.png',
        ),
      ],
    },
  ],
  pins: [{ slotsAgo: 2, lateMinutes: 96 }],
};

const postReleaseMonitoring: DemoRoutine = {
  name: 'post-release-monitoring',
  description: 'Watches what shipped in the last 3 days and fixes regressions',
  schedule: '0 10,16 * * *',
  enabled: true,
  agent: 'claude',
  model: OPUS,
  effort: 'high',
  permissionMode: 'auto',
  command: null,
  cwd: REPO,
  timeoutMinutes: 30,
  maxBudgetUsd: 2,
  prompt: `Look for problems in code shipped over the last 3 days: new Sentry issues, error rates and latency in Grafana, error logs, and Intercom conversations about things that broke.

Match each problem to the release and the pull request that caused it, and post an alert to #eng-alerts with what is affected and how many users. If the cause is clear and the fix is small, open a pull request with the fix and a test. Otherwise put what you found in the alert.`,
  runModel: OPUS,
  outcomes: [
    {
      id: 'quiet',
      weight: 1,
      status: 'succeeded',
      minutes: 6,
      costUsd: 0.38,
      numTurns: 11,
      resultText:
        'Nothing new from v2.8.0 to v2.8.2: no new Sentry issues, a 0.02% 5xx rate, 212 ms p95 latency, and no Intercom complaints about the changed areas.',
      steps: [
        opusInit,
        bash(
          'git log --since="3 days ago" --merges --oneline',
          `9f2c1ab Merge pull request #482 from acme/csv-export
4e81d07 Merge pull request #480 from acme/session-expiry
c03a5f2 Merge pull request #478 from acme/cache-browsers`,
        ),
        mcp(
          'mcp__sentry__search_issues',
          { project: 'acme-web', query: 'is:unresolved firstSeen:-3d' },
          'No issues match.',
        ),
        mcp(
          'mcp__grafana__query_prometheus',
          {
            expr: 'sum(rate(http_requests_total{status=~"5.."}[1h])) / sum(rate(http_requests_total[1h]))',
          },
          '0.0002',
        ),
        mcp(
          'mcp__intercom__search_conversations',
          { query: 'export OR session OR error', createdAfter: '3d' },
          '41 conversations, none about exports, sessions or errors.',
        ),
      ],
    },
    {
      id: 'regression',
      weight: 0,
      status: 'succeeded',
      minutes: 14,
      costUsd: 1.07,
      numTurns: 26,
      resultText:
        'Regression from v2.8.1: CSV export fails for reports with empty cells (Sentry ACME-WEB-4F2, 37 events, 5 users). Alerted #eng-alerts and opened #494 with a fix and a test.',
      steps: [
        opusInit,
        mcp(
          'mcp__sentry__search_issues',
          { project: 'acme-web', query: 'is:unresolved firstSeen:-3d' },
          `ACME-WEB-4F2 TypeError: Cannot read properties of null (reading 'includes')
  at escapeCell (src/reports/export-csv.ts:4)
  37 events, 5 users, first seen in v2.8.1`,
        ),
        mcp(
          'mcp__intercom__search_conversations',
          { query: 'export OR csv', createdAfter: '3d' },
          `2 conversations
- Hannah (Northwind): The export button does nothing
- Omar (Globex): CSV download fails for the March report`,
        ),
        read(
          `${REPO}/src/reports/export-csv.ts`,
          `3  function escapeCell(value: string): string {
4    return value.includes('"') ? \`"\${value.replaceAll('"', '""')}"\` : value;
5  }`,
        ),
        text(
          'Empty cells reach `escapeCell` as `null`, which the type does not allow. Fixing it where the rows are built.',
        ),
        edit(
          `${REPO}/src/reports/export-csv.ts`,
          "const rows = report.rows.map(row => row.map(escapeCell).join(','));",
          "const rows = report.rows.map(row => row.map(cell => escapeCell(cell ?? '')).join(','));",
        ),
        bash(
          'pnpm vitest run src/reports',
          ` ✓ src/reports/export-csv.test.ts (2 tests) 5ms
 ✓ src/reports/build-report.test.ts (5 tests) 36ms

 Test Files  2 passed (2)
      Tests  7 passed (7)`,
        ),
        bash(
          'gh pr create --title "Export empty cells to CSV" --body-file /tmp/pr.md',
          'https://github.com/acme/web/pull/494',
        ),
        bash('~/bin/notify --channel eng-alerts "$(cat /tmp/alert.md)"', 'sent'),
      ],
    },
  ],
  pins: [{ slotsAgo: 1, outcome: 'regression' }],
};

const onCallEngineer: DemoRoutine = {
  name: 'on-call-engineer',
  description: 'Checks for production incidents and proposes fixes',
  schedule: '0 9,13,17,21 * * *',
  enabled: true,
  webhook: true,
  webhookGate: 'node scripts/verify-alert.ts',
  agent: 'claude',
  model: FABLE,
  effort: 'max',
  permissionMode: 'auto',
  command: null,
  cwd: REPO,
  timeoutMinutes: 60,
  maxBudgetUsd: 5,
  prompt: `When a 3rd-party alert starts this run through the webhook, it follows this prompt. Otherwise check #incidents for an open incident, and if there is none, say so and stop.

Then find the cause with Sentry, Grafana and the logs. Post what you know to the incident channel as you go.

If the cause is in our code, open a pull request with the fix and ask the on-call engineer to review it. Never merge, deploy or roll back yourself.`,
  runModel: FABLE,
  outcomes: [
    {
      id: 'quiet',
      weight: 1,
      status: 'succeeded',
      minutes: 1,
      costUsd: 0.07,
      numTurns: 3,
      resultText: 'No open incidents. The 5xx rate is 0.02% and p95 latency is 208 ms.',
      steps: [
        fableInit,
        mcp(
          'mcp__slack__read_channel',
          { channel: '#incidents', limit: 3 },
          'PagerDuty: [P2] payments error rate is 12% (resolved)',
        ),
        mcp(
          'mcp__grafana__query_prometheus',
          {
            expr: 'sum(rate(http_requests_total{status=~"5.."}[1h])) / sum(rate(http_requests_total[1h]))',
          },
          '0.0002',
        ),
      ],
    },
    {
      id: 'fixed',
      weight: 0,
      status: 'succeeded',
      minutes: 16,
      costUsd: 1.42,
      numTurns: 31,
      resultText:
        'Cause: the v2.8.2 migration added a NOT NULL column without a default, so inserts from the old invoice worker fail. Posted the timeline to #incidents and opened #495, which adds the default. It needs a human to merge and deploy.',
      steps: [
        fableInit,
        text(
          'A 3rd-party alert came in, P1: the invoice-worker error rate is 34%. Looking at its logs first.',
        ),
        mcp(
          'mcp__grafana__query_loki',
          { query: '{app="invoice-worker"} |= "error"', since: '30m' },
          `ERROR insert into invoices failed: null value in column "currency_code" violates not-null constraint
  ×412 in the last 30 minutes`,
        ),
        bash(
          'git log -3 --oneline -- db/migrations',
          `c41e9a0 Add currency_code to invoices (#485)
7d02b11 Index invoices by due date (#462)
e9a4c70 Add archived_at to clients (#451)`,
        ),
        read(
          `${REPO}/db/migrations/0042_add_currency_code.sql`,
          '1  ALTER TABLE invoices ADD COLUMN currency_code text NOT NULL;',
        ),
        text(
          'The invoice worker still runs the v2.8.1 image, which does not send `currency_code`, and the new column has no default.',
        ),
        mcp(
          'mcp__slack__send_message',
          {
            channel: '#incidents',
            text: 'Cause found: 0042_add_currency_code made currency_code NOT NULL without a default, and the old worker does not send it. Fix coming as a PR.',
          },
          'Sent',
        ),
        write(
          `${REPO}/db/migrations/0043_default_currency_code.sql`,
          "ALTER TABLE invoices ALTER COLUMN currency_code SET DEFAULT 'EUR';",
        ),
        bash(
          'gh pr create --title "Default currency_code for old invoice workers" --reviewer acme/on-call --body-file /tmp/pr.md',
          'https://github.com/acme/web/pull/495',
        ),
      ],
    },
    {
      id: 'not-ours',
      weight: 0,
      status: 'succeeded',
      minutes: 9,
      costUsd: 0.66,
      numTurns: 17,
      resultText:
        'Cause: Stripe returns 503 for 12% of charge requests, and status.stripe.com confirms an incident. Nothing to fix on our side, and retries are working. Posted to #incidents.',
      steps: [
        fableInit,
        text(
          'A 3rd-party alert came in, P2: the payments error rate is 12%. Looking at its logs first.',
        ),
        mcp(
          'mcp__grafana__query_loki',
          { query: '{app="payments"} |= "error"', since: '30m' },
          'ERROR stripe charge failed: 503 Service Unavailable\n  ×288 in the last 30 minutes',
        ),
        webFetch(
          'https://status.stripe.com',
          'Is there an ongoing incident?',
          'Elevated error rates on the Charges API. Investigating.',
        ),
        mcp(
          'mcp__slack__send_message',
          {
            channel: '#incidents',
            text: 'Stripe has an incident on the Charges API (status.stripe.com). Our retries are working; nothing to fix on our side.',
          },
          'Sent',
        ),
      ],
    },
  ],
  webhookRuns: [
    { minutesAgo: 19 * 60 + 47, outcome: 'fixed' },
    { minutesAgo: 2 * 24 * 60 + 5 * 60 + 13, outcome: 'not-ours' },
  ],
};

const writeReleaseNotes: DemoRoutine = {
  name: 'write-release-notes',
  description: 'Drafts release notes from what was merged since the last tag',
  schedule: null,
  enabled: true,
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

const flakyE2eFixer: DemoRoutine = {
  name: 'flaky-e2e-fixer',
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
      steps: [
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
          'gh pr create --title "Wait for the avatar upload before saving" --body-file /tmp/pr.md',
          'https://github.com/acme/web/pull/497',
        ),
      ],
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
  ],
};

const BUGS_COMMAND =
  "gh issue list --label bug --search no:assignee --json number,title --jq 'sort_by(.number) | .[0]'";

const bugFixPickup: DemoRoutine = {
  name: 'bug-fix-pickup',
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
        bash(
          'gh pr create --title "Round invoice totals once" --body "Closes #331"',
          'https://github.com/acme/web/pull/490',
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
};

const deadCodeCleanup: DemoRoutine = {
  name: 'dead-code-cleanup',
  description: 'Removes dead code and feature flags that are on for everyone',
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
};

const supportSignals: DemoRoutine = {
  name: 'support-signals',
  description: "Turns the day's support chats into product signals",
  schedule: '0 18 * * *',
  enabled: true,
  agent: 'claude',
  model: SONNET,
  effort: 'medium',
  permissionMode: 'auto',
  command: null,
  cwd: HOME,
  timeoutMinutes: 20,
  maxBudgetUsd: 1,
  prompt: `Read today's Intercom conversations. Leave out billing questions and how-to questions that the help centre already answers.

Group the rest into product signals: feature requests, things people could not find, and bugs. Count the customers behind each one and quote one of them. Post the top signals to #product with \`~/bin/notify --channel product\`.`,
  runModel: SONNET,
  outcomes: [
    {
      id: 'posted',
      weight: 1,
      status: 'succeeded',
      minutes: 7,
      costUsd: 0.42,
      numTurns: 13,
      resultText:
        'Posted 3 signals to #product from 46 conversations: 6 customers asked for Xero sync, 4 could not find CSV export, and 2 were signed out after 30 days.',
      steps: [
        init({ model: SONNET, cwd: HOME, toolCount: 32, permissionMode: 'auto' }),
        mcp(
          'mcp__intercom__search_conversations',
          { createdAfter: 'today', state: 'all' },
          '46 conversations: 12 about billing, 9 how-to questions answered with an article, 25 others',
        ),
        text(
          '25 conversations left after billing and answered how-to questions. Grouping them by what people asked for.',
        ),
        write(
          '/tmp/signals.md',
          `**Today's product signals** (25 conversations)

1. **Xero sync**, 6 customers: "We copy every invoice into Xero by hand."
2. **Can't find CSV export**, 4 customers: "Where do I download the report?"
3. **Signed out after 30 days**, 2 customers: "Why do I have to log in again?"`,
        ),
        bash('~/bin/notify --channel product "$(cat /tmp/signals.md)"', 'sent'),
      ],
    },
  ],
};

const reviewInit = init({
  model: OPUS,
  cwd: REPO,
  toolCount: 32,
  permissionMode: 'acceptEdits',
});
const pullLatest = hook('git pull --ff-only', 0, 'Already up to date.');

const prReviewSweep: DemoRoutine = {
  name: 'pr-review-sweep',
  description: 'Reviews pull requests that wait for my review',
  schedule: '15 9-17/2 * * *',
  enabled: true,
  agent: 'claude',
  model: OPUS,
  effort: 'high',
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

const umbrellaCheck: DemoRoutine = {
  name: 'umbrella-check',
  description: 'Says if you need an umbrella today',
  schedule: '0 8 * * 1-5',
  enabled: false,
  agent: 'claude',
  model: 'claude-haiku-4-5',
  effort: 'low',
  permissionMode: 'auto',
  command: null,
  cwd: HOME,
  timeoutMinutes: 5,
  maxBudgetUsd: null,
  prompt: `Check today's weather forecast for where I am. wttr.in works without an API key.

Answer in one short line: do I need an umbrella today, and why.`,
  runModel: 'claude-haiku-4-5',
  disabledDaysAgo: 6,
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
        init({ model: 'claude-haiku-4-5', cwd: HOME, toolCount: 32, permissionMode: 'auto' }),
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
        init({ model: 'claude-haiku-4-5', cwd: HOME, toolCount: 32, permissionMode: 'auto' }),
        webFetch(
          'https://wttr.in/?format=j1',
          'Hourly chance of rain and temperature for today',
          'Today 7–11 °C. Chance of rain: 08:00 20%, 11:00 55%, 14:00 80%, 17:00 40%, 20:00 15%, 23:00 10%.',
        ),
      ],
    },
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

export const demoRoutines: DemoRoutine[] = [
  nightAgentTasks,
  designUxIssues,
  postReleaseMonitoring,
  onCallEngineer,
  writeReleaseNotes,
  flakyE2eFixer,
  bugFixPickup,
  prReviewSweep,
  deadCodeCleanup,
  supportSignals,
  notesBackup,
  umbrellaCheck,
];
