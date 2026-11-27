import { routineNameSchema } from 'domains/routine/ids';

import { REPO, WORK, OPUS, SONNET } from '../shared';
import { bash, edit, hook, init, modelFallback, read, text, type TranscriptStep } from '../steps';
import type { DemoRoutine } from '../types';

const AGENT_QUEUE_COMMAND =
  "gh issue list --label agent --state open --json number,title --jq 'sort_by(.number)'";

const OPENED_RESULT =
  'Opened 3 draft pull requests: #491 Remember the last report filter, #492 Show the invoice number in the email subject and #493 Add a loading state to the export button. Left a question on #388: should archived clients count toward the plan limit?';
const STREAM_IDLE_ERROR = 'API Error: Stream idle timeout - partial response received';

const nightAgentSteps: TranscriptStep[] = [
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
];

export const nightAgentTasks: DemoRoutine = {
  name: routineNameSchema.parse('night-agent-tasks'),
  description: 'Works through the issues labelled agent while I sleep',
  schedule: '0 2 * * *',
  enabled: true,
  agent: 'claude',
  account: WORK,
  model: OPUS,
  fallbackModel: SONNET,
  effort: 'xhigh',
  permissionMode: 'bypassPermissions',
  command: null,
  cwd: REPO,
  timeoutMinutes: 240,
  retries: 2,
  maxBudgetUsd: 5,
  maxBudgetTokens: 8_000_000,
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
      resultText: OPENED_RESULT,
      steps: nightAgentSteps,
    },
    {
      id: 'retried',
      weight: 0,
      status: 'succeeded',
      minutes: 46,
      costUsd: 3.31,
      numTurns: 61,
      resultText: OPENED_RESULT,
      retry: { error: STREAM_IDLE_ERROR, afterStep: 9 },
      steps: nightAgentSteps,
    },
    {
      id: 'retrying',
      weight: 0,
      status: 'succeeded',
      minutes: 8,
      costUsd: 3.08,
      numTurns: 57,
      resultText: OPENED_RESULT,
      retry: { error: STREAM_IDLE_ERROR, afterStep: 5 },
      steps: nightAgentSteps,
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
    {
      id: 'fallback',
      weight: 0,
      status: 'succeeded',
      minutes: 38,
      costUsd: 1.94,
      numTurns: 44,
      model: SONNET,
      resultText:
        'Opened 2 draft pull requests: #486 Keep the table headers on every page of the PDF export and #487 Show the client name in the invoice reminder email.',
      steps: [
        hook('git switch main && git pull --ff-only', 0, 'Updating 9f2c1ab..c41e7d2\nFast-forward'),
        init({ model: OPUS, cwd: REPO, toolCount: 32, permissionMode: 'bypassPermissions' }),
        modelFallback(OPUS, SONNET, 'overloaded'),
        bash(
          AGENT_QUEUE_COMMAND,
          '[{"number":474,"title":"PDF export: table headers on every page"},{"number":479,"title":"Client name in the reminder email"}]',
        ),
        bash(
          'gh pr create --draft --title "Keep the table headers on every page of the PDF export" --body-file /tmp/pr-474.md',
          'https://github.com/acme/web/pull/486',
        ),
        bash(
          'gh pr create --draft --title "Show the client name in the invoice reminder email" --body-file /tmp/pr-479.md',
          'https://github.com/acme/web/pull/487',
        ),
        text(
          'Opened 2 draft pull requests: #486 Keep the table headers on every page of the PDF export and #487 Show the client name in the invoice reminder email.',
        ),
      ],
    },
  ],
  pins: [
    { slotsAgo: 0, outcome: 'retried' },
    { slotsAgo: 1, outcome: 'fallback' },
    { slotsAgo: 3, outcome: 'budget' },
  ],
  manualRuns: [{ minutesAgo: 3, outcome: 'retrying' }],
};
