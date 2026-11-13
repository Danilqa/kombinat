import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getDaemonService } from './service';

test('macOS runs the daemon under launchd', () => {
  assert.equal(getDaemonService('darwin').manager, 'launchd');
});

test('Linux runs the daemon under systemd', () => {
  assert.equal(getDaemonService('linux').manager, 'systemd');
});

test('other platforms cannot install the daemon', () => {
  const service = getDaemonService('win32');
  assert.throws(() => service.install(), /work on macOS and Linux, not on win32/);
  assert.throws(() => service.uninstall(), /work on macOS and Linux, not on win32/);
  assert.throws(() => service.start(), /work on macOS and Linux, not on win32/);
  assert.equal(service.checkIsLoaded(), false);
  assert.equal(service.getStatus(), 'not loaded');
  assert.equal(service.getDaemonFolder(), null);
});
