import { execFileSync } from 'node:child_process';

import { isWebAppStale } from '../packages/cli/src/reload';

export default function globalSetup(): void {
  if (isWebAppStale()) execFileSync('pnpm', ['-s', 'ui:build'], { stdio: 'inherit' });
}
