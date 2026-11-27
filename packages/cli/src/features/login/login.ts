import { spawn } from 'node:child_process';
import fs from 'node:fs';

import { getAgent, parseAccountName, parseAgentName } from '../../domains/agent/registry';
import { getAccountFolder } from '../../domains/agent/settings';

export async function login(accountName: string, agentName: string): Promise<number> {
  const account = parseAccountName(accountName);
  const agent = getAgent(parseAgentName(agentName));
  const invocation = agent.buildLoginInvocation(account);
  if (invocation === null) throw new Error(`agent ${agent.name} has no login`);
  const folder = getAccountFolder(agent.accountHome, account);
  // Codex refuses a CODEX_HOME that does not exist yet.
  if (folder !== null) fs.mkdirSync(folder, { recursive: true });
  const child = spawn(invocation.command, invocation.args, {
    env: invocation.env,
    stdio: 'inherit',
  });
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => resolve(code ?? 1));
  });
  if (exitCode === 0 && account !== null) {
    console.log(`\nSigned in. Add "account: ${account}" to a routine to run it on this account.`);
  }
  return exitCode;
}
