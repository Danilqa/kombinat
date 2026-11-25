import type { z } from 'zod';

import type { AgentName } from '../agent/types';
import type { RoutineTemplateId } from './ids';
import type {
  addRoutineRequestSchema,
  addedRoutineSchema,
  memoryAuthorSchema,
  memoryChangeSchema,
  memoryRequestSchema,
  oneTimeRunRequestSchema,
  routineDetailSchema,
  routineMemorySchema,
  routineSummarySchema,
  startRunRequestSchema,
} from './schemas';

export type RoutineSummary = z.infer<typeof routineSummarySchema>;
export type RoutineDetail = z.infer<typeof routineDetailSchema>;
export type StartRunRequest = z.infer<typeof startRunRequestSchema>;
export type OneTimeRunRequest = z.infer<typeof oneTimeRunRequestSchema>;
export type MemoryAuthor = z.infer<typeof memoryAuthorSchema>;
export type MemoryChange = z.infer<typeof memoryChangeSchema>;
export type RoutineMemory = z.infer<typeof routineMemorySchema>;
export type MemoryRequest = z.infer<typeof memoryRequestSchema>;
export type AddRoutineRequest = z.infer<typeof addRoutineRequestSchema>;
export type AddedRoutine = z.infer<typeof addedRoutineSchema>;

export type RoutineTemplateCategory = 'code' | 'watch' | 'reports' | 'home';

export type RoutineTemplateNeed = 'git-repository' | 'github-cli';

// The settings a routine file gets from its template. The name, folder and schedule come from the user.
export interface RoutineTemplate {
  id: RoutineTemplateId;
  category: RoutineTemplateCategory;
  title: string;
  description: string;
  needs: RoutineTemplateNeed[];
  schedule: string | null;
  cwd: string;
  folderHint: string;
  agent: AgentName;
  model: string;
  effort: string;
  permissionMode: string;
  timeoutMinutes: number;
  retries: number;
  worktree: boolean;
  memory: boolean;
  check: string | null;
  prompt: string;
}
