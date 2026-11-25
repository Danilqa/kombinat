import assert from 'node:assert/strict';
import { test } from 'node:test';

import { accountNameSchema } from './ids';
import { listAccounts } from './utils';

test('the accounts routines run on come once each, the primary login first and the rest by name', () => {
  const work = accountNameSchema.parse('work');
  const personal = accountNameSchema.parse('personal');
  assert.deepEqual(
    listAccounts([
      { agent: 'claude', account: work },
      { agent: 'codex', account: personal },
      { agent: 'claude', account: null },
      { agent: 'codex', account: work },
    ]),
    [null, personal, work],
  );
  assert.deepEqual(listAccounts([{ agent: 'command', account: null }]), []);
});
