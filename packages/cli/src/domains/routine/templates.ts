import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { RoutineName } from 'domains/routine/ids';
import type { RoutineTemplate } from 'domains/routine/types';
import { describeScheduleValue } from 'domains/routine/utils';
import { getErrorMessage } from 'utils/error';

import { config } from '../../config';
import { buildRoutine } from './utils';

export interface TemplateChoices {
  name: RoutineName;
  cwd: string;
  schedule: string;
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

// The schedule is quoted, since YAML reads a value that starts with * as an alias.
export function buildTemplateSource(template: RoutineTemplate, choices: TemplateChoices): string {
  const settings: FrontmatterEntry[] = [
    ['name', choices.name],
    ['description', template.title],
    ['schedule', choices.schedule === 'manual' ? 'manual' : `'${choices.schedule}'`],
    ['cwd', choices.cwd],
    ['agent', template.agent],
    ['model', template.model],
    ['effort', template.effort],
    ['permissionMode', template.permissionMode],
    ['timeoutMinutes', template.timeoutMinutes],
    ['retries', template.retries === 0 ? null : template.retries],
    ['worktree', template.worktree || null],
    ['memory', template.memory || null],
    ['check', choices.schedule === 'manual' ? null : template.check],
  ];
  const lines = settings.flatMap(([key, value]) => (value === null ? [] : [`${key}: ${value}`]));
  return `---\n${lines.join('\n')}\n---\n\n${template.prompt}\n`;
}

function checkIsFolder(cwd: string): boolean {
  const folder = cwd.replace(/^~(?=\/|$)/, os.homedir());
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
  if (!checkIsFolder(choices.cwd)) {
    return { outcome: 'invalid', error: `There is no folder at ${choices.cwd}` };
  }
  const file = path.join(dir, `${choices.name}.md`);
  const source = buildTemplateSource(template, { ...choices, schedule });
  try {
    buildRoutine(file, source);
  } catch (error) {
    return { outcome: 'invalid', error: getErrorMessage(error) };
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
