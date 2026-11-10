import type { AgentName } from 'domains/agent/types';
import type { RoutineName } from 'domains/id/types';

import type { AgentSettings } from '../agent/types';

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
  before: string | null;
  prompt: string;
  file: string;
}
