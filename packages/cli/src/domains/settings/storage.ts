import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_SETTINGS } from 'domains/settings/constants';
import { settingsSchema } from 'domains/settings/schemas';
import type { Settings } from 'domains/settings/types';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';

const settingsFile = () => path.join(config.stateDir, 'settings.json');

export function readSettings(): Settings {
  return readJsonFile(settingsFile(), settingsSchema) ?? DEFAULT_SETTINGS;
}

export function writeSettings(settings: Settings): void {
  fs.mkdirSync(config.stateDir, { recursive: true });
  writeJsonFile(settingsFile(), settings);
}
