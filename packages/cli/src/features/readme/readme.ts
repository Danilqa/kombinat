import fs from 'node:fs';
import path from 'node:path';

import { config } from '../../config';
import { loadRoutines } from '../../domains/routine/storage';
import type { Routine } from '../../domains/routine/types';
import { describeSchedule } from '../../domains/routine/utils';

const START = '<!-- routines:start -->';
const END = '<!-- routines:end -->';

export function renderRoutinesTable(): string {
  const rows = loadRoutines()
    .sort(
      (a, b) =>
        Number(Boolean(b.schedule)) - Number(Boolean(a.schedule)) || a.name.localeCompare(b.name),
    )
    .map(r => `| [${r.name}](routines/${r.name}.md) | ${describeWhen(r)} | ${r.description} |`);
  return ['| Routine | When | What it does |', '| - | - | - |', ...rows].join('\n');
}

function describeWhen(routine: Routine): string {
  if (!routine.webhook) return describeSchedule(routine);
  return routine.schedule === null ? 'On webhook' : `${describeSchedule(routine)} and on webhook`;
}

export function updateReadme(file = path.join(config.projectRoot, 'README.md')): boolean {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf(START);
  const end = source.indexOf(END);
  if (start === -1 || end === -1) throw new Error(`README.md needs ${START} and ${END} markers`);
  const next = `${source.slice(0, start + START.length)}\n${renderRoutinesTable()}\n${source.slice(end)}`;
  if (next === source) return false;
  fs.writeFileSync(file, next);
  return true;
}
