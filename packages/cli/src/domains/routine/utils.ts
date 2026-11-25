import os from 'node:os';
import path from 'node:path';

import { PRIMARY_ACCOUNT } from 'domains/agent/ids';
import type { AgentName } from 'domains/agent/types';
import { checkCanKeepMemory } from 'domains/agent/utils';
import { ROUTINE_NAME_PATTERN } from 'domains/routine/constants';
import { routineNameSchema } from 'domains/routine/ids';
import { MAX_RETRIES, MAX_RUNS } from 'domains/run/constants';
import { parseTokenCount } from 'domains/run/utils';
import { describeCron, nextCronRun, parseCron } from 'utils/cron';
import { getErrorMessage } from 'utils/error';

import { getAgent, parseAccountName, parseAgentName } from '../agent/registry';
import type { AgentSettings } from '../agent/types';
import { ROUTINE_SETTINGS } from './constants';
import type { Routine, RoutineSetting } from './types';

type FrontmatterValue = string | number | boolean;
type Frontmatter = Record<string, FrontmatterValue>;

interface ParsedFrontmatter {
  data: Frontmatter;
  body: string;
  repeatedKeys: string[];
}

const DEFAULT_TIMEOUT_MINUTES = 55;

const MAX_TYPO_DISTANCE = 2;

function parseScalar(raw: string): FrontmatterValue {
  const value = raw.trim();
  if (/^".*"$/.test(value) || /^'.*'$/.test(value)) return value.slice(1, -1);
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return '';
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

export function parseFrontmatter(source: string): ParsedFrontmatter {
  const found = /^---\r?\n(?<head>[\s\S]*?)\r?\n---\r?\n?(?<body>[\s\S]*)$/.exec(source);
  if (!found?.groups) throw new Error('must start with a frontmatter block between --- lines');
  const data: Frontmatter = {};
  const repeatedKeys: string[] = [];
  for (const line of (found.groups['head'] ?? '').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator === -1) throw new Error(`frontmatter line "${line}" must look like key: value`);
    const key = line.slice(0, separator).trim();
    if (Object.hasOwn(data, key) && !repeatedKeys.includes(key)) repeatedKeys.push(key);
    data[key] = parseScalar(line.slice(separator + 1));
  }
  return { data, body: (found.groups['body'] ?? '').trim(), repeatedKeys };
}

function readValue(data: Frontmatter, key: RoutineSetting): FrontmatterValue | undefined {
  return data[key];
}

function readString(data: Frontmatter, key: RoutineSetting): string | null {
  const value = readValue(data, key);
  return value === undefined || value === '' ? null : String(value);
}

function readNumber(data: Frontmatter, key: RoutineSetting): number | null {
  const value = readString(data, key);
  if (value === null) return null;
  const number = Number(value);
  if (Number.isNaN(number)) throw new Error(`${key} must be a number`);
  return number;
}

function readTokenCount(data: Frontmatter, key: RoutineSetting): number | null {
  const value = readString(data, key);
  if (value === null) return null;
  const count = parseTokenCount(value);
  if (count === null) {
    throw new Error(`${key} must be a number of tokens, such as 500k, 2M or 3000000`);
  }
  return count;
}

function readBoolean(data: Frontmatter, key: RoutineSetting): boolean | null {
  const value = readValue(data, key);
  if (value === undefined || value === '') return null;
  if (typeof value !== 'boolean') throw new Error(`${key} must be true or false`);
  return value;
}

function readRetries(data: Frontmatter): number {
  const retries = Number(readString(data, 'retries') ?? 0);
  if (!Number.isInteger(retries) || retries < 0 || retries > MAX_RETRIES) {
    throw new Error(`retries must be a whole number from 0 to ${MAX_RETRIES}`);
  }
  return retries;
}

function readRunCount(data: Frontmatter, key: RoutineSetting): number {
  const count = Number(readString(data, key) ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > MAX_RUNS) {
    throw new Error(`${key} must be a whole number from 1 to ${MAX_RUNS}`);
  }
  return count;
}

function readSchedule(data: Frontmatter): string | null {
  const schedule = readString(data, 'schedule');
  return schedule === 'manual' ? null : schedule;
}

function withFile<T>(file: string, read: () => T): T {
  try {
    return read();
  } catch (error) {
    throw new Error(`${file}: ${getErrorMessage(error)}`, { cause: error });
  }
}

function readAgentSettings(data: Frontmatter, agent: AgentName): AgentSettings {
  return getAgent(agent).resolveSettings({
    model: readString(data, 'model'),
    fallbackModel: readString(data, 'fallbackModel'),
    effort: readString(data, 'effort'),
    permissionMode: readString(data, 'permissionMode'),
    command: readString(data, 'command'),
    maxBudgetUsd: readNumber(data, 'maxBudgetUsd'),
    maxBudgetTokens: readTokenCount(data, 'maxBudgetTokens'),
    onUsageLimit: readString(data, 'onUsageLimit'),
    account: parseAccountName(readString(data, 'account') ?? PRIMARY_ACCOUNT),
  });
}

export function buildRoutine(file: string, source: string): Routine {
  const { data, body } = withFile(file, () => parseFrontmatter(source));
  const fileName = path.basename(file, '.md');
  const name = readString(data, 'name') ?? fileName;
  if (name !== fileName) {
    throw new Error(`${file}: frontmatter name "${name}" must match the file name "${fileName}"`);
  }
  if (!ROUTINE_NAME_PATTERN.test(name)) {
    throw new Error(`${file}: name must be lowercase kebab-case`);
  }
  const schedule = readSchedule(data);
  if (schedule !== null) withFile(file, () => parseCron(schedule));
  const cwd = readString(data, 'cwd');
  if (cwd === null) {
    throw new Error(`${file}: cwd is required, set it to the folder the agent works in`);
  }
  if (!body) {
    throw new Error(`${file}: prompt body is empty, write the prompt below the frontmatter`);
  }
  const agent = withFile(file, () => parseAgentName(readString(data, 'agent') ?? 'claude'));
  const webhook = withFile(file, () => readBoolean(data, 'webhook')) ?? false;
  const webhookGate = readString(data, 'webhookGate');
  if (webhookGate !== null && !webhook) throw new Error(`${file}: webhookGate needs webhook: true`);
  const check = readString(data, 'check');
  if (check !== null && schedule === null) {
    throw new Error(`${file}: check runs only at scheduled times, add a schedule or remove check`);
  }
  const runs = withFile(file, () => readRunCount(data, 'runs'));
  const maxParallel = withFile(file, () => readRunCount(data, 'maxParallel'));
  if (maxParallel > runs) {
    throw new Error(`${file}: maxParallel must be at most runs, which is ${runs}`);
  }
  const memory = withFile(file, () => readBoolean(data, 'memory'));
  if (memory === true && !checkCanKeepMemory(agent)) {
    throw new Error(`${file}: agent command has no memory, use claude or codex`);
  }
  const enabled = readValue(data, 'enabled');
  return {
    name: routineNameSchema.parse(name),
    description: readString(data, 'description') ?? '',
    schedule,
    cwd: cwd.replace(/^~(?=\/|$)/, os.homedir()),
    agent,
    ...withFile(file, () => readAgentSettings(data, agent)),
    enabled: enabled === undefined ? true : Boolean(enabled),
    webhook,
    webhookGate,
    timeoutMinutes:
      withFile(file, () => readNumber(data, 'timeoutMinutes')) ?? DEFAULT_TIMEOUT_MINUTES,
    retries: withFile(file, () => readRetries(data)),
    runs,
    maxParallel,
    memory: memory ?? false,
    worktree: withFile(file, () => readBoolean(data, 'worktree')) ?? false,
    check,
    before: readString(data, 'before'),
    after: readString(data, 'after'),
    prompt: body,
    file,
  };
}

function getEditDistance(from: string, to: string): number {
  let previous = Array.from({ length: to.length + 1 }, (_, index) => index);
  for (let i = 1; i <= from.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= to.length; j += 1) {
      const substitution = (previous[j - 1] ?? 0) + (from[i - 1] === to[j - 1] ? 0 : 1);
      current.push(Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, substitution));
    }
    previous = current;
  }
  return previous[to.length] ?? 0;
}

function checkIsRoutineSetting(key: string): key is RoutineSetting {
  return ROUTINE_SETTINGS.some(setting => setting === key);
}

function findSimilarSetting(key: string): RoutineSetting | null {
  let similar: RoutineSetting | null = null;
  let similarDistance = MAX_TYPO_DISTANCE + 1;
  for (const setting of ROUTINE_SETTINGS) {
    const distance = getEditDistance(key.toLowerCase(), setting.toLowerCase());
    if (distance < similarDistance) {
      similar = setting;
      similarDistance = distance;
    }
  }
  return similar;
}

function describeUnknownSetting(file: string, key: string): string {
  const similar = findSimilarSetting(key);
  const hint = similar === null ? '' : `, did you mean ${similar}?`;
  return `${file}: unknown setting ${key}${hint}`;
}

// The daemon ignores unknown and repeated settings, so only validate reports them.
export function listRoutineProblems(file: string, source: string): string[] {
  const problems: string[] = [];
  try {
    const { data, repeatedKeys } = withFile(file, () => parseFrontmatter(source));
    problems.push(
      ...Object.keys(data)
        .filter(key => !checkIsRoutineSetting(key))
        .map(key => describeUnknownSetting(file, key)),
      ...repeatedKeys.map(key => `${file}: ${key} is set more than once, the last one wins`),
    );
    buildRoutine(file, source);
  } catch (error) {
    problems.push(getErrorMessage(error));
  }
  return problems;
}

export function describeSchedule(routine: Routine): string {
  return routine.schedule === null ? 'Manual' : describeCron(routine.schedule);
}

export function getNextRun(routine: Routine, now = new Date()): string | null {
  if (!routine.schedule || !routine.enabled) return null;
  return nextCronRun(routine.schedule, now)?.toISOString() ?? null;
}
