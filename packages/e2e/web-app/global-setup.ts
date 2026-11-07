import { execFileSync } from 'node:child_process';

import { checkIsWebAppStale } from '../../cli/src/features/self-update/reload';

export default function globalSetup(): void {
  if (checkIsWebAppStale())
    execFileSync('pnpm', ['-s', '--filter', 'web-app', 'run', 'build'], { stdio: 'inherit' });
}
