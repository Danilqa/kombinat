import { routineNameSchema } from 'domains/routine/ids';

import { REPO, SONNET, sonnetInit } from '../shared';
import { bash, mcp, text, type TranscriptStep } from '../steps';
import type { DemoRoutine } from '../types';

const DESIGN_ISSUES_COMMAND = 'gh issue list --label design --state open --json number,title';
const KNOWN_DESIGN_ISSUES =
  '[{"number":498,"title":"Sidebar icons are misaligned in Safari"},{"number":503,"title":"The invoices empty state has no call to action"}]';

const designIssueSteps: TranscriptStep[] = [
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
];

export const designUxIssues: DemoRoutine = {
  name: routineNameSchema.parse('design-ux-issues'),
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
  memory: {
    text: `## Filed, don't file again

- #512 the date picker overflows the screen on phones
- #513 the Save button has 2.9:1 contrast in dark mode
- #514 the reports page says Export in one place and Download in another
- #509 chart colours in dark mode: closed as won't fix on Nov 14, the brand team keeps them

## How to get around

- Reports is empty until you run \`pnpm seed:reports\`
- Sign in as qa@acme.dev, the password is in \`.env.local\`
- The invoices page takes about 8 s to load at phone size, wait for the table

## Next time

- Settings → Billing was not reached: the run ran out of time after Invoices. Start there.`,
    added: 4,
    removed: 1,
  },
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
      steps: designIssueSteps,
    },
    {
      id: 'paused',
      weight: 0,
      status: 'succeeded',
      minutes: 24,
      costUsd: 1.89,
      numTurns: 42,
      resultText:
        'Filed 3 issues: #512 the date picker overflows the screen on phones, #513 the Save button has 2.9:1 contrast in dark mode and #514 the reports page says Export in one place and Download in another.',
      usageLimit: { limit: 'session', afterStep: 5, waitMinutes: 70 },
      steps: designIssueSteps,
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
  manualRuns: [{ minutesAgo: 23, outcome: 'paused' }],
};
