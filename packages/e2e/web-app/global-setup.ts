import { execFileSync } from 'node:child_process';

import { isWebAppStale } from '../../cli/src/reload';

export default function globalSetup(): void {
  if (isWebAppStale())
    execFileSync('pnpm', ['-s', '--filter', 'web-app', 'run', 'build'], { stdio: 'inherit' });
}
