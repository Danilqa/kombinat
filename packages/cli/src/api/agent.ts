import type { AgentOption } from 'domains/agent/types';

import { listAgentOptions } from '../domains/agent/options';
import { loadRoutines } from '../domains/routine/storage';

// With the models this machine's routines already run, which Claude Code keeps no list of.
export function getAgentOptions(): AgentOption[] {
  const routines = loadRoutines();
  return listAgentOptions().map(option => {
    const used = routines.flatMap(routine =>
      routine.agent === option.name && routine.model !== null ? [routine.model] : [],
    );
    return { ...option, models: [...new Set([...option.models, ...used])] };
  });
}
