import { routineNameSchema } from 'domains/routine/ids';

import { HOME } from '../../constants';
import { PERSONAL } from '../shared';
import { init, webFetch } from '../steps';
import type { DemoRoutine } from '../types';

export const umbrellaCheck: DemoRoutine = {
  name: routineNameSchema.parse('umbrella-check'),
  description: 'Says if you need an umbrella today',
  schedule: '0 8 * * 1-5',
  enabled: false,
  agent: 'claude',
  account: PERSONAL,
  model: 'claude-haiku-4-5',
  effort: 'low',
  permissionMode: 'auto',
  command: null,
  cwd: HOME,
  timeoutMinutes: 5,
  maxBudgetUsd: null,
  maxBudgetTokens: 200_000,
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
