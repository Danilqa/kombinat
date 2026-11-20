import fs from 'node:fs';
import path from 'node:path';

import { notificationsStateSchema } from 'domains/inbox/schemas';
import type { NotifyLevels } from 'domains/inbox/types';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';

export const NOTIFICATIONS_FILE = 'notifications.json';

const notificationsFile = () => path.join(config.stateDir, NOTIFICATIONS_FILE);

export function readNotifyLevels(): NotifyLevels {
  return readJsonFile(notificationsFile(), notificationsStateSchema)?.routines ?? {};
}

export function writeNotifyLevels(routines: NotifyLevels): void {
  fs.mkdirSync(config.stateDir, { recursive: true });
  writeJsonFile(notificationsFile(), { routines });
}
