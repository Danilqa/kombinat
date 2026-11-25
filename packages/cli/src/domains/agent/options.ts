import os from 'node:os';
import path from 'node:path';

import { z } from 'zod';

import { CLAUDE_MODELS } from 'domains/agent/constants';
import type { AgentOption } from 'domains/agent/types';

import { config } from '../../config';
import { readJsonFile } from '../../utils/json';
import { checkIsBinaryFound } from './binary';

const codexModelsSchema = z.object({
  models: z.array(z.object({ slug: z.string(), visibility: z.string().optional() })),
});

function getCodexHome(): string {
  return process.env['CODEX_HOME'] ?? path.join(os.homedir(), '.codex');
}

// Codex keeps the models of the signed-in account in its home folder, and hides the ones it uses itself.
export function readCodexModels(codexHome = getCodexHome()): string[] {
  const cache = readJsonFile(path.join(codexHome, 'models_cache.json'), codexModelsSchema);
  const models = cache?.models ?? [];
  return models.filter(model => model.visibility !== 'hide').map(model => model.slug);
}

export function listAgentOptions(): AgentOption[] {
  return [
    { name: 'claude', isInstalled: checkIsBinaryFound(config.claudeBin), models: CLAUDE_MODELS },
    { name: 'codex', isInstalled: checkIsBinaryFound(config.codexBin), models: readCodexModels() },
  ];
}
