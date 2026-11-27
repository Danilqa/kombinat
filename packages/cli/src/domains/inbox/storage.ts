import path from 'node:path';

import { inboxStateSchema, notificationsStateSchema } from 'domains/inbox/schemas';
import type { InboxState, NotifyLevels } from 'domains/inbox/types';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';

export const NOTIFICATIONS_FILE = 'notifications.json';

const inboxFile = () => path.join(config.stateDir, 'inbox.json');
const notificationsFile = () => path.join(config.stateDir, NOTIFICATIONS_FILE);

export function writeInboxState(state: InboxState): void {
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

export function readNotifyLevels(): NotifyLevels {
  return readJsonFile(notificationsFile(), notificationsStateSchema)?.routines ?? {};
}

export function writeNotifyLevels(routines: NotifyLevels): void {
  writeJsonFile(notificationsFile(), { routines });
}
