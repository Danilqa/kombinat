import type { HttpClient } from 'utils/http';

import { settingsSchema } from './schemas';
import type { Settings } from './types';

export async function getSettings(http: HttpClient): Promise<Settings> {
  return http.request('/api/settings', settingsSchema);
}

export async function updateSettings(http: HttpClient, settings: Settings): Promise<Settings> {
  return http.request('/api/settings', settingsSchema, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(settings),
  });
}
