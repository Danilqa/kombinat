import type { RoutineName } from 'domains/routine/ids';
import type { RoutineTemplate } from 'domains/routine/types';

import { HOME } from './constants';
import type { DemoRoutine } from './routines';
import { init, text } from './transcript';

export interface DemoTemplateChoices {
  name: RoutineName;
  cwd: string;
  schedule: string;
}

const DEMO_RESULT =
  "This demo doesn't run agents. On your machine, the agent's answer shows up here.";

export function toTemplateRoutine(
  template: RoutineTemplate,
  { name, cwd, schedule }: DemoTemplateChoices,
): DemoRoutine {
  const folder = cwd.replace(/^~(?=\/|$)/, HOME);
  const isManual = schedule === 'manual';
  return {
    name,
    description: template.title,
    schedule: isManual ? null : schedule,
    enabled: true,
    ...(template.check === null || isManual
      ? {}
      : { check: { command: template.check, skipsOutcome: '', skipOutput: '' } }),
    agent: template.agent,
    model: template.model,
    effort: template.effort,
    permissionMode: template.permissionMode,
    command: null,
    cwd: folder,
    timeoutMinutes: template.timeoutMinutes,
    retries: template.retries,
    worktree: template.worktree,
    maxBudgetUsd: null,
    prompt: template.prompt,
    runModel: template.model,
    ...(template.memory ? { memory: { text: '', added: 0, removed: 0 } } : {}),
    outcomes: [
      {
        id: 'demo',
        weight: 1,
        status: 'succeeded',
        minutes: 2,
        resultText: DEMO_RESULT,
        steps: [
          init({
            model: template.model,
            cwd: folder,
            toolCount: 32,
            permissionMode: template.permissionMode,
          }),
          text(DEMO_RESULT),
        ],
      },
    ],
  };
}
