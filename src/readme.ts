import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { describeCron } from './cron';
import { loadRoutines } from './routines';

const START = '<!-- routines:start -->';
const END = '<!-- routines:end -->';

export function renderRoutinesTable(): string {
  const rows = loadRoutines()
    .sort(
      (a, b) =>
        Number(Boolean(b.schedule)) - Number(Boolean(a.schedule)) || a.name.localeCompare(b.name),
    )
    .map(
      r =>
        `| [${r.name}](routines/${r.name}.md) | ${r.schedule ? describeCron(r.schedule) : 'Manual'} | ${r.description} |`,
    );
  return ['| Routine | When | What it does |', '| - | - | - |', ...rows].join('\n');
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
