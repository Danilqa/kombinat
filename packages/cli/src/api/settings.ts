import { settingsSchema } from 'domains/settings/schemas';

import { deleteExpiredRuns } from '../domains/run/retention';
import { readSettings, writeSettings } from '../domains/settings/storage';
import { deleteExpiredWebhookCalls } from '../domains/webhook/call-log';
import { parseJson } from '../utils/json';
import { fail, ok } from './response';
import type { ApiResponse } from './response';

export function getSettings(): ApiResponse {
  return ok(readSettings());
}

export function updateSettings(body: Buffer): ApiResponse {
  const settings = settingsSchema.safeParse(parseJson(body.toString('utf8')));
  if (!settings.success) {
    return fail(400, 'runRetentionDays must be a whole number of days or null');
  }
  writeSettings(settings.data);
  deleteExpiredRuns();
  deleteExpiredWebhookCalls();
  return ok(settings.data);
}
