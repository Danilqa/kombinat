import fs from 'node:fs';
import path from 'node:path';

import { match } from 'ts-pattern';

import { MEMORY_MAX_LENGTH } from 'domains/routine/constants';
import type { RoutineName } from 'domains/routine/ids';
import { memoryChangeSchema } from 'domains/routine/schemas';
import type { MemoryChange, RoutineMemory } from 'domains/routine/types';
import { countChangedLines } from 'domains/routine/utils';
import type { RunId } from 'domains/run/ids';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';

const OPEN_TAG = '<routine-memory>';
const CLOSE_TAG = '</routine-memory>';
// Editors and copies change the time a little after kombinat wrote the file.
const HAND_EDIT_SLACK_MS = 2000;

interface RunWriter {
  by: 'run';
  runId: RunId;
}

interface UserWriter {
  by: 'user';
}

export type MemoryWriter = RunWriter | UserWriter;

interface MemoryBlock {
  text: string;
  memory: string | null;
}

function getMemoryDir(): string {
  return path.join(config.stateDir, 'memory');
}

export function getMemoryFile(routine: RoutineName): string {
  return path.join(getMemoryDir(), `${routine}.md`);
}

function getChangeFile(routine: RoutineName): string {
  return path.join(getMemoryDir(), `${routine}.json`);
}

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

export function readMemory(routine: RoutineName): string {
  const file = getMemoryFile(routine);
  return fs.existsSync(file) ? normalize(fs.readFileSync(file, 'utf8')) : '';
}

function readChange(routine: RoutineName): MemoryChange | null {
  const change = readJsonFile(getChangeFile(routine), memoryChangeSchema);
  const file = getMemoryFile(routine);
  if (!fs.existsSync(file)) return change;
  const editedAt = fs.statSync(file).mtime;
  const isEditedByHand =
    change === null || editedAt.getTime() > new Date(change.at).getTime() + HAND_EDIT_SLACK_MS;
  if (!isEditedByHand) return change;
  return { at: editedAt.toISOString(), by: 'user', runId: null, added: null, removed: null };
}

export function readRoutineMemory(routine: RoutineName): RoutineMemory {
  return { text: readMemory(routine), file: getMemoryFile(routine), change: readChange(routine) };
}

// Notes over the limit lose their last lines, which are the newest in most notes.
function limitLength(text: string): string {
  if (text.length <= MEMORY_MAX_LENGTH) return text;
  const cut = text.slice(0, MEMORY_MAX_LENGTH);
  const lastLine = cut.lastIndexOf('\n');
  return lastLine === -1 ? cut : cut.slice(0, lastLine).trimEnd();
}

export function writeMemory(
  routine: RoutineName,
  text: string,
  writer: MemoryWriter,
  now = new Date(),
): void {
  const before = readMemory(routine);
  const after = limitLength(normalize(text));
  if (after === before) return;
  const file = getMemoryFile(routine);
  fs.mkdirSync(getMemoryDir(), { recursive: true });
  if (after === '') fs.rmSync(file, { force: true });
  else {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${after}\n`);
    fs.renameSync(tmp, file);
  }
  const change: MemoryChange = {
    at: now.toISOString(),
    by: writer.by,
    runId: match(writer)
      .with({ by: 'run' }, ({ runId }) => runId)
      .with({ by: 'user' }, () => null)
      .exhaustive(),
    ...countChangedLines(before, after),
  };
  writeJsonFile(getChangeFile(routine), change);
}

export function appendMemory(prompt: string, memory: string): string {
  const notes =
    memory === ''
      ? 'There are no notes yet.'
      : `Your notes so far:\n\n${OPEN_TAG}\n${memory}\n${CLOSE_TAG}`;
  return `${prompt}

## Memory

You keep notes for the next runs of this routine. Kombinat keeps them on this machine, and the user can read and change them in the dashboard. ${notes}

Read the notes before you start and follow them. If they need to change, end your final message with the new notes in full, between a ${OPEN_TAG} line and a ${CLOSE_TAG} line: what is done and must not be done again, what you learned about getting around, and where to start next time. Keep what is still true, drop what is not, and stay under 200 lines. Kombinat saves the notes and takes them out of your message. When the notes stay the same, leave them out.
`;
}

function unwrapFence(text: string): string {
  return /^```[\w-]*\n(?<body>[\s\S]*)\n```$/.exec(text)?.groups?.['body']?.trim() ?? text;
}

// The notes are the last block of the agent's message. An empty block changes nothing.
export function splitMemoryBlock(text: string): MemoryBlock {
  const start = text.lastIndexOf(OPEN_TAG);
  const end = start === -1 ? -1 : text.indexOf(CLOSE_TAG, start);
  if (end === -1) return { text, memory: null };
  const memory = unwrapFence(text.slice(start + OPEN_TAG.length, end).trim());
  return {
    text: `${text.slice(0, start).trimEnd()}${text.slice(end + CLOSE_TAG.length)}`.trim(),
    memory: memory === '' ? null : memory,
  };
}

// Notes the user saved while the run worked win over the run's, which started from older ones.
export function keepMemoryUpdate(
  routine: RoutineName,
  runId: RunId,
  resultText: string | null,
  memoryAtStart: string,
): string | null {
  if (resultText === null) return null;
  const { text, memory } = splitMemoryBlock(resultText);
  if (memory !== null && readMemory(routine) === memoryAtStart) {
    writeMemory(routine, memory, { by: 'run', runId });
  }
  return text;
}
