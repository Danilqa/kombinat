import { test as base } from '@playwright/test';

import { startDaemon } from './support/daemon';
import type { Daemon } from './support/daemon';
import { createKombinat } from './support/kombinat';
import type { Kombinat } from './support/kombinat';

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
  // Auto, so every test starts with no routines and no runs, even if it seeds nothing.
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
