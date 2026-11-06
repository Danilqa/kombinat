import { execFileSync } from 'node:child_process';

import { isUiStale } from '../src/reload';

export default function globalSetup(): void {
  if (isUiStale()) execFileSync('pnpm', ['-s', 'ui:build'], { stdio: 'inherit' });
}
