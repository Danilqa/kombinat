import { test as base } from '@playwright/test';

import { startDaemon } from './helpers/daemon';
import type { Daemon } from './helpers/daemon';
import { createKombinat } from './helpers/kombinat';
import type { Kombinat } from './helpers/kombinat';

interface TestFixtures {
  kombinat: Kombinat;
}

interface WorkerFixtures {
  daemon: Daemon;
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
