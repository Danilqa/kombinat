import { execFileSync } from 'node:child_process';

import { isWebAppStale } from '../packages/cli/src/reload';

export default function globalSetup(): void {
  if (isWebAppStale())
    execFileSync('pnpm', ['-s', '--filter', 'web-app', 'run', 'build'], { stdio: 'inherit' });
}
