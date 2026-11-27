import { routineNameSchema } from 'domains/routine/ids';

import { HOME } from '../../constants';
import { WORK, SONNET } from '../shared';
import { bash, init, mcp, text, write } from '../steps';
import type { DemoRoutine } from '../types';

export const supportSignals: DemoRoutine = {
  name: routineNameSchema.parse('support-signals'),
  description: "Turns the day's support chats into product signals",
  schedule: '0 18 * * *',
  enabled: true,
  agent: 'claude',
  account: WORK,
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
