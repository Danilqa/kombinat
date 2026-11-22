import os from 'node:os';
import path from 'node:path';

import type { AgentName } from 'domains/agent/types';
import { checkCanKeepMemory } from 'domains/agent/utils';
import { routineNameSchema } from 'domains/routine/ids';
import { MAX_RETRIES } from 'domains/run/constants';
import { describeCron, nextCronRun, parseCron } from 'utils/cron';
import { getErrorMessage } from 'utils/error';

import { getAgent, parseAgentName } from '../agent/registry';
import type { AgentSettings } from '../agent/types';
import type { Routine } from './types';

type FrontmatterValue = string | number | boolean;
type Frontmatter = Record<string, FrontmatterValue>;

interface ParsedFrontmatter {
  data: Frontmatter;
  body: string;
}

const DEFAULT_TIMEOUT_MINUTES = 55;

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
  for (const line of (found.groups['head'] ?? '').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator === -1) throw new Error(`frontmatter line "${line}" must look like key: value`);
    data[line.slice(0, separator).trim()] = parseScalar(line.slice(separator + 1));
  }
  return { data, body: (found.groups['body'] ?? '').trim() };
}

function readString(data: Frontmatter, key: string): string | null {
  const value = data[key];
  return value === undefined || value === '' ? null : String(value);
}

function readNumber(data: Frontmatter, key: string): number | null {
  const value = readString(data, key);
  if (value === null) return null;
  const number = Number(value);
  if (Number.isNaN(number)) throw new Error(`${key} must be a number`);
  return number;
}

function readBoolean(data: Frontmatter, key: string): boolean | null {
  const value = data[key];
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
    onUsageLimit: readString(data, 'onUsageLimit'),
  });
}

export function buildRoutine(file: string, source: string): Routine {
  const { data, body } = withFile(file, () => parseFrontmatter(source));
  const fileName = path.basename(file, '.md');
  const name = readString(data, 'name') ?? fileName;
  if (name !== fileName) {
    throw new Error(`${file}: frontmatter name "${name}" must match the file name "${fileName}"`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
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
    throw new Error(`${file}: check needs a schedule, since it runs only at scheduled times`);
  }
  const memory = withFile(file, () => readBoolean(data, 'memory'));
  if (memory === true && !checkCanKeepMemory(agent)) {
    throw new Error(`${file}: agent command has no memory, use claude or codex`);
  }
  return {
    name: routineNameSchema.parse(name),
    description: readString(data, 'description') ?? '',
    schedule,
    cwd: cwd.replace(/^~(?=\/|$)/, os.homedir()),
    agent,
    ...withFile(file, () => readAgentSettings(data, agent)),
    enabled: data['enabled'] === undefined ? true : Boolean(data['enabled']),
    webhook,
    webhookGate,
    timeoutMinutes:
      withFile(file, () => readNumber(data, 'timeoutMinutes')) ?? DEFAULT_TIMEOUT_MINUTES,
    retries: withFile(file, () => readRetries(data)),
    memory: memory ?? false,
    worktree: withFile(file, () => readBoolean(data, 'worktree')) ?? false,
    check,
    before: readString(data, 'before'),
    after: readString(data, 'after'),
    prompt: body,
    file,
  };
}

export function describeSchedule(routine: Routine): string {
  return routine.schedule === null ? 'Manual' : describeCron(routine.schedule);
}

export function getNextRun(routine: Routine, now = new Date()): string | null {
  if (!routine.schedule || !routine.enabled) return null;
  return nextCronRun(routine.schedule, now)?.toISOString() ?? null;
}
