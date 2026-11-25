import fs from 'node:fs';
import path from 'node:path';

import type { AccountName } from 'domains/agent/ids';
import type { AgentName } from 'domains/agent/types';
import { planUsageSchema } from 'domains/daemon/schemas';
import type { PlanUsage } from 'domains/daemon/types';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';

const planUsageDir = () => path.join(config.stateDir, 'plan-usage');
const planUsageFile = (agent: AgentName, account: AccountName | null) =>
  path.join(planUsageDir(), account === null ? `${agent}.json` : `${agent}.${account}.json`);

export function readPlanUsage(agent: AgentName, account: AccountName | null): PlanUsage | null {
  return readJsonFile(planUsageFile(agent, account), planUsageSchema);
}

export function writePlanUsage(
  agent: AgentName,
  account: AccountName | null,
  usage: PlanUsage,
): void {
  fs.mkdirSync(planUsageDir(), { recursive: true });
  writeJsonFile(planUsageFile(agent, account), usage);
}
