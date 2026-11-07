import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSshArgs } from './connect';

test('ssh forwards a local loopback port to the daemon port on the remote loopback', () => {
  assert.deepEqual(buildSshArgs('admin@mac-mini', 54_321, 7433), [
    '-N',
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'ControlMaster=no',
    '-o',
    'ControlPath=none',
    '-o',
    'ServerAliveInterval=15',
    '-L',
    '127.0.0.1:54321:127.0.0.1:7433',
    '--',
    'admin@mac-mini',
  ]);
});

test('a destination that starts with a dash is not read as an ssh option', () => {
  assert.deepEqual(buildSshArgs('-oProxyCommand=evil', 1, 2).slice(-2), [
    '--',
    '-oProxyCommand=evil',
  ]);
});
