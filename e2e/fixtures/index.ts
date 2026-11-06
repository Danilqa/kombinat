import { test as base } from '@playwright/test';

import { claude } from './claude';
import { startDaemon } from './daemon';
import type { Daemon } from './daemon';
import { createKombinat } from './kombinat';
import type { Kombinat } from './kombinat';
import { time } from './time';

interface TestFixtures {
  kombinat: Kombinat;
}

interface WorkerFixtures {
  daemon: Daemon;
  claude: typeof claude;
  time: typeof time;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  daemon: [
    async ({}, use) => {
      const daemon = await startDaemon();
      await use(daemon);
      await daemon.stop();
    },
    { scope: 'worker' },
  ],
  claude: [claude, { scope: 'worker' }],
  time: [time, { scope: 'worker' }],
  kombinat: [
    async ({ daemon }, use) => {
      await use(createKombinat(daemon.root));
    },
    { auto: true },
  ],
  baseURL: async ({ daemon }, use) => {
    await use(daemon.url);
  },
});

export { expect } from '@playwright/test';
