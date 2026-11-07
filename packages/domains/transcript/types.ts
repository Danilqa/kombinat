import type { z } from 'zod';

import type {
  hookItemSchema,
  initItemSchema,
  resultItemSchema,
  textItemSchema,
  toolItemSchema,
  toolResultSchema,
  transcriptItemSchema,
  transcriptSchema,
} from './schemas';

export type ToolResult = z.infer<typeof toolResultSchema>;
export type TranscriptItem = z.infer<typeof transcriptItemSchema>;
export type HookItem = z.infer<typeof hookItemSchema>;
export type InitItem = z.infer<typeof initItemSchema>;
export type TextItem = z.infer<typeof textItemSchema>;
export type ToolItem = z.infer<typeof toolItemSchema>;
export type ResultItem = z.infer<typeof resultItemSchema>;
export type Transcript = z.infer<typeof transcriptSchema>;
