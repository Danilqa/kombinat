import type { AgentName } from 'domains/agent/types';
import type { RoutineName } from 'domains/routine/ids';
import type { ChainCondition } from 'domains/run/types';

import type { AgentSettings } from '../agent/types';
import type { ROUTINE_SETTINGS } from './constants';

export interface Routine extends AgentSettings {
  name: RoutineName;
  description: string;
  schedule: string | null;
  cwd: string;
  agent: AgentName;
  enabled: boolean;
  webhook: boolean;
  webhookGate: string | null;
  timeoutMinutes: number;
  retries: number;
  runs: number;
  maxParallel: number;
  memory: boolean;
  worktree: boolean;
  check: string | null;
  before: string | null;
  after: string | null;
  startsAfter: RoutineName | null;
  // null when the routine does not start after another one.
  startsWhen: ChainCondition | null;
  prompt: string;
  file: string;
}

export type RoutineSetting = (typeof ROUTINE_SETTINGS)[number];
