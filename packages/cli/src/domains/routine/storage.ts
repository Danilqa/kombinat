import fs from 'node:fs';
import path from 'node:path';

import type { RoutineName } from 'domains/id/types';

import { config } from '../../config';
import type { Routine } from './types';
import { buildRoutine } from './utils';

export function listRoutineFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(entry => entry.endsWith('.md'))
    .sort()
    .map(entry => path.join(dir, entry));
}

export function loadRoutines(dir = config.routinesDir): Routine[] {
  return listRoutineFiles(dir).map(file => buildRoutine(file, fs.readFileSync(file, 'utf8')));
}

export function getRoutine(name: RoutineName, dir = config.routinesDir): Routine {
  const routine = loadRoutines(dir).find(candidate => candidate.name === name);
  if (!routine) throw new Error(`Unknown routine "${name}" (looked in ${dir})`);
  return routine;
}
