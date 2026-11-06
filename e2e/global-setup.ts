import { execFileSync } from 'node:child_process';

import { isUiStale } from '../src/reload';

// The daemon serves ui/dist. Building it here, once, keeps the daemons of parallel workers from
// building it at the same time.
export default function globalSetup(): void {
  if (isUiStale()) execFileSync('pnpm', ['-s', 'ui:build'], { stdio: 'inherit' });
}
