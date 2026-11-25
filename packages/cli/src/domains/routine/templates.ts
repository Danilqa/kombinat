import fs from 'node:fs';
import path from 'node:path';

import type { AgentName } from 'domains/agent/types';
import { AGENT_KIND_ERROR } from 'domains/routine/constants';
import type { RoutineName } from 'domains/routine/ids';
import type { RoutineTemplate } from 'domains/routine/types';
import { checkCanUseAgent, describeScheduleValue } from 'domains/routine/utils';
import { getErrorMessage } from 'utils/error';

import { config } from '../../config';
import { buildRoutine } from './utils';

export interface TemplateChoices {
  name: RoutineName;
  cwd: string;
  schedule: string;
  agent: AgentName;
  model: string | null;
  prompt: string;
}

interface WrittenRoutine {
  outcome: 'added' | 'exists';
  file: string;
}

interface InvalidChoices {
  outcome: 'invalid';
  error: string;
}

export type AddedFromTemplate = WrittenRoutine | InvalidChoices;

type FrontmatterEntry = [key: string, value: string | number | boolean | null];

// Quoted, since YAML reads a value that starts with * as an alias and a bare ~ as null.
export function buildTemplateSource(template: RoutineTemplate, choices: TemplateChoices): string {
  const isTemplateAgent = choices.agent === template.agent;
  const settings: FrontmatterEntry[] = [
    ['name', choices.name],
    ['description', template.title],
    ['schedule', choices.schedule === 'manual' ? 'manual' : `'${choices.schedule}'`],
    ['cwd', `'${choices.cwd}'`],
    ['agent', choices.agent],
    ['model', choices.model],
    ['effort', isTemplateAgent ? template.effort : null],
    ['permissionMode', isTemplateAgent ? template.permissionMode : null],
    ['timeoutMinutes', template.timeoutMinutes],
    ['retries', template.retries === 0 ? null : template.retries],
    ['worktree', template.worktree || null],
    ['memory', template.memory || null],
    ['check', choices.schedule === 'manual' ? null : template.check],
    ['command', template.command === null ? null : `"${template.command}"`],
  ];
  const lines = settings.flatMap(([key, value]) => (value === null ? [] : [`${key}: ${value}`]));
  const prompt = choices.prompt.replace(/\r\n/g, '\n').trim();
  return `---\n${lines.join('\n')}\n---\n\n${prompt}\n`;
}

function checkIsFolder(folder: string): boolean {
  return fs.existsSync(folder) && fs.statSync(folder).isDirectory();
}

function checkIsExisting(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}

export function addRoutineFromTemplate(
  template: RoutineTemplate,
  choices: TemplateChoices,
  dir = config.routinesDir,
): AddedFromTemplate {
  const schedule = choices.schedule.trim();
  if (describeScheduleValue(schedule) === null) {
    return { outcome: 'invalid', error: `${schedule} is not a cron schedule or manual` };
  }
  if (!checkCanUseAgent(template, choices.agent)) {
    return { outcome: 'invalid', error: AGENT_KIND_ERROR };
  }
  const file = path.join(dir, `${choices.name}.md`);
  const source = buildTemplateSource(template, { ...choices, schedule });
  let cwd: string;
  try {
    cwd = buildRoutine(file, source).cwd;
  } catch (error) {
    return { outcome: 'invalid', error: getErrorMessage(error) };
  }
  if (!checkIsFolder(cwd)) {
    return {
      outcome: 'invalid',
      error: `There is no folder at ${choices.cwd}. Check the path, or create the folder first.`,
    };
  }
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(file, source, { flag: 'wx' });
  } catch (error) {
    if (checkIsExisting(error)) return { outcome: 'exists', file };
    throw error;
  }
  return { outcome: 'added', file };
}
