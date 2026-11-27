import { routineNameSchema } from 'domains/routine/ids';

import { REPO, WORK, FABLE, fableInit } from '../shared';
import { bash, mcp, read, text, webFetch, write } from '../steps';
import type { DemoRoutine } from '../types';

export const onCallEngineer: DemoRoutine = {
  name: routineNameSchema.parse('on-call-engineer'),
  description: 'Checks for production incidents and proposes fixes',
  schedule: '0 9,13,17,21 * * *',
  enabled: true,
  webhook: true,
  webhookGate: 'node scripts/verify-alert.ts',
  agent: 'claude',
  account: WORK,
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
    {
      minutesAgo: 6,
      outcome: 'fixed',
      payload:
        '{"alert":"invoice-worker error rate is 34%","severity":"P1","service":"invoice-worker","startedAt":"4 minutes ago"}',
    },
    {
      minutesAgo: 19 * 60 + 47,
      outcome: 'fixed',
      payload:
        '{"alert":"invoice-worker error rate is 28%","severity":"P1","service":"invoice-worker","startedAt":"3 minutes ago"}',
    },
    {
      minutesAgo: 2 * 24 * 60 + 5 * 60 + 13,
      outcome: 'not-ours',
      payload:
        '{"alert":"payments error rate is 12%","severity":"P2","service":"payments","startedAt":"6 minutes ago"}',
    },
  ],
  webhookCalls: [
    {
      minutesAgo: 41,
      outcome: 'ignored',
      status: 200,
      payload:
        '{"alert":"api-gateway p95 latency is back to 190 ms","severity":"resolved","service":"api-gateway"}',
    },
    {
      minutesAgo: 3 * 60 + 12,
      outcome: 'rejected',
      status: 401,
      reason: 'exited with 1: the signature does not match the alerting secret',
      payload: '{"alert":"disk usage is 97%","severity":"P1","service":"db-primary"}',
    },
    {
      minutesAgo: 26 * 60 + 5,
      outcome: 'ignored',
      status: 200,
      payload:
        '{"alert":"search-indexer queue depth is 1,200","severity":"P4","service":"search-indexer"}',
    },
  ],
  queuedWebhooks: [
    {
      minutesAgo: 4,
      payload:
        '{"alert":"api-gateway p95 latency is 2.4 s","severity":"P2","service":"api-gateway","startedAt":"5 minutes ago"}',
    },
    {
      minutesAgo: 1,
      payload:
        '{"alert":"invoice-worker error rate is 41%","severity":"P1","service":"invoice-worker","startedAt":"2 minutes ago"}',
    },
  ],
};
