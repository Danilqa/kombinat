import fs from 'node:fs';
import path from 'node:path';

import { inboxStateSchema } from 'domains/inbox/schemas';
import type { InboxState } from 'domains/inbox/types';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';

const inboxFile = () => path.join(config.stateDir, 'inbox.json');

export function writeInboxState(state: InboxState): void {
  fs.mkdirSync(config.stateDir, { recursive: true });
  writeJsonFile(inboxFile(), state);
}

// Runs that ended before the first look count as read, so an update does not fill the inbox.
export function readInboxState(now = new Date()): InboxState {
  const stored = readJsonFile(inboxFile(), inboxStateSchema);
  if (stored !== null) return stored;
  const state: InboxState = { since: now.toISOString(), readRuns: [] };
  writeInboxState(state);
  return state;
}
