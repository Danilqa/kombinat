import type { AgentName } from 'domains/agent/types';
import type { RoutineId } from 'domains/id/types';

import type { AgentSettings } from '../agent/types';

export interface Routine extends AgentSettings {
  name: RoutineId;
  description: string;
  schedule: string | null;
  cwd: string;
  agent: AgentName;
  enabled: boolean;
  webhook: boolean;
  webhookGate: string | null;
  timeoutMinutes: number;
  before: string | null;
  prompt: string;
  file: string;
}
