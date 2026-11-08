import os from 'node:os';
import path from 'node:path';

import type { AgentName } from 'domains/agent/types';
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
  if (!found?.groups) throw new Error('Routine file must start with a YAML frontmatter block');
  const data: Frontmatter = {};
  for (const line of (found.groups['head'] ?? '').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator === -1) throw new Error(`Invalid frontmatter line: "${line}"`);
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
    effort: readString(data, 'effort'),
    permissionMode: readString(data, 'permissionMode'),
    command: readString(data, 'command'),
    maxBudgetUsd: readNumber(data, 'maxBudgetUsd'),
  });
}

export function buildRoutine(file: string, source: string): Routine {
  const { data, body } = parseFrontmatter(source);
  const fileName = path.basename(file, '.md');
  const name = readString(data, 'name') ?? fileName;
  if (name !== fileName) {
    throw new Error(`${file}: frontmatter name "${name}" must match the file name "${fileName}"`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new Error(`${file}: name must be lowercase kebab-case`);
  }
  const schedule = readSchedule(data);
  if (schedule !== null) parseCron(schedule);
  const cwd = readString(data, 'cwd');
  if (cwd === null) throw new Error(`${file}: cwd is required`);
  if (!body) throw new Error(`${file}: prompt body is empty`);
  const agent = withFile(file, () => parseAgentName(readString(data, 'agent') ?? 'claude'));
  return {
    name,
    description: readString(data, 'description') ?? '',
    schedule,
    cwd: cwd.replace(/^~(?=\/|$)/, os.homedir()),
    agent,
    ...withFile(file, () => readAgentSettings(data, agent)),
    enabled: data['enabled'] === undefined ? true : Boolean(data['enabled']),
    timeoutMinutes:
      withFile(file, () => readNumber(data, 'timeoutMinutes')) ?? DEFAULT_TIMEOUT_MINUTES,
    before: readString(data, 'before'),
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
