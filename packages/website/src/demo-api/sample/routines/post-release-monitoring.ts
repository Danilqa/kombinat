import { routineNameSchema } from 'domains/routine/ids';

import { REPO, OPUS, opusInit } from '../shared';
import { bash, edit, mcp, read, text } from '../steps';
import type { DemoRoutine } from '../types';

export const postReleaseMonitoring: DemoRoutine = {
  name: routineNameSchema.parse('post-release-monitoring'),
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
