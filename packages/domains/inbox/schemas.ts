import { z } from 'zod';

import { routineNameSchema } from '../routine/ids';
import { runIdSchema } from '../run/ids';
import { runRecordSchema } from '../run/schemas';

export const inboxRunKeySchema = z.object({ routine: routineNameSchema, id: runIdSchema });

export const inboxStateSchema = z.object({
  since: z.string(),
  readRuns: z.array(inboxRunKeySchema),
});

export const inboxSchema = z.object({ runs: z.array(runRecordSchema) });

export const markReadRequestSchema = z.object({ runs: z.array(inboxRunKeySchema).min(1) });

export const markedReadSchema = z.object({ ok: z.literal(true) });
