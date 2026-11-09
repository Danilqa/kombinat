import path from 'node:path';

import { config } from '../../config';

export function buildHookEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    KOMBINAT_REPO: config.projectRoot,
    PATH: `${path.join(config.projectRoot, 'scripts')}:${env['PATH'] ?? ''}`,
  };
}
