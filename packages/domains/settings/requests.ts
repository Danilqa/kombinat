import type { Api } from 'utils/api';

import { settingsSchema } from './schemas';
import type { Settings } from './types';

export async function getSettings(api: Api): Promise<Settings> {
  return api.get('/api/settings').json(settingsSchema);
}

export async function updateSettings(api: Api, settings: Settings): Promise<Settings> {
  return api.put('/api/settings', { json: settings }).json(settingsSchema);
}
