import type { z } from 'zod';

import type { settingsSchema } from './schemas';

export type Settings = z.infer<typeof settingsSchema>;
