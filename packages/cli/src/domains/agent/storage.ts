import fs from 'node:fs';
import path from 'node:path';

import type { AgentName } from 'domains/agent/types';
import { planUsageSchema } from 'domains/daemon/schemas';
import type { PlanUsage } from 'domains/daemon/types';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';

const planUsageDir = () => path.join(config.stateDir, 'plan-usage');
const planUsageFile = (agent: AgentName) => path.join(planUsageDir(), `${agent}.json`);

export function readPlanUsage(agent: AgentName): PlanUsage | null {
  return readJsonFile(planUsageFile(agent), planUsageSchema);
}

export function writePlanUsage(agent: AgentName, usage: PlanUsage): void {
  fs.mkdirSync(planUsageDir(), { recursive: true });
  writeJsonFile(planUsageFile(agent), usage);
}
