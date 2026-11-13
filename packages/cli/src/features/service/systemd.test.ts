import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { config } from '../../config';
import {
  checkIsLingerEnabled,
  escapeUnitPath,
  formatSystemdStatus,
  getUnitPath,
  quoteEnvAssignment,
  quoteExecArg,
  readWorkingDirectory,
  renderUnit,
} from './systemd';

const TRICKY = String.raw`a b"c\d%e$f'g`;

test('unit file lives in the systemd user folder of XDG_CONFIG_HOME', () => {
  assert.equal(
    getUnitPath({}),
    path.join(os.homedir(), '.config', 'systemd', 'user', 'kombinat.service'),
  );
  assert.equal(
    getUnitPath({ XDG_CONFIG_HOME: '/srv/config' }),
    '/srv/config/systemd/user/kombinat.service',
  );
  assert.equal(
    getUnitPath({ XDG_CONFIG_HOME: 'relative' }),
    path.join(os.homedir(), '.config', 'systemd', 'user', 'kombinat.service'),
  );
});

test('exec arguments are quoted, with specifiers and variables escaped', () => {
  assert.equal(quoteExecArg(TRICKY), String.raw`"a b\"c\\d%%e$$f'g"`);
  assert.equal(quoteExecArg('two\nlines'), String.raw`"two\nlines"`);
});

test('environment assignments are quoted, with specifiers escaped and $ kept', () => {
  assert.equal(quoteEnvAssignment('NAME', TRICKY), String.raw`"NAME=a b\"c\\d%%e$f'g"`);
  assert.equal(quoteEnvAssignment('NAME', 'two\nlines'), String.raw`"NAME=two\nlines"`);
});

test('paths escape specifiers and refuse line breaks', () => {
  assert.equal(escapeUnitPath('/home/a b/100%'), '/home/a b/100%%');
  assert.throws(() => escapeUnitPath('/home/a\nb'), /line break/);
});

test('unit starts the kombinat bin with serve in the project folder', () => {
  const unit = renderUnit({ PATH: '/usr/bin' });
  const exec = [process.execPath, `${config.packageRoot}/bin/kombinat.js`, 'serve']
    .map(quoteExecArg)
    .join(' ');
  assert.equal(unit.includes(`\nExecStart=${exec}\n`), true);
  assert.equal(unit.includes(`\nWorkingDirectory=${escapeUnitPath(config.projectRoot)}\n`), true);
});

test('unit keeps the daemon running and leaves running routines alone', () => {
  const unit = renderUnit({ PATH: '/usr/bin' });
  for (const line of [
    'Restart=always',
    'RestartSec=10',
    'KillMode=process',
    `StandardOutput=append:${escapeUnitPath(path.join(config.stateDir, 'daemon.log'))}`,
    `StandardError=append:${escapeUnitPath(path.join(config.stateDir, 'daemon.err'))}`,
    'WantedBy=default.target',
  ]) {
    assert.equal(unit.includes(`\n${line}\n`), true, line);
  }
});

test('unit sets one escaped Environment line per variable', () => {
  const unit = renderUnit({ PATH: '/usr/bin', KOMBINAT_PORT: '7444', CLAUDE_BIN: TRICKY });
  const lines = unit.split('\n').filter(line => line.startsWith('Environment='));
  assert.deepEqual(lines, [
    'Environment="PATH=/usr/bin"',
    'Environment="KOMBINAT_PORT=7444"',
    String.raw`Environment="CLAUDE_BIN=a b\"c\\d%%e$f'g"`,
  ]);
});

test('daemon folder is read back from the unit', () => {
  assert.equal(readWorkingDirectory(renderUnit({ PATH: '/usr/bin' })), config.projectRoot);
  assert.equal(
    readWorkingDirectory('[Service]\nWorkingDirectory=/home/a b/100%%\n'),
    '/home/a b/100%',
  );
  assert.equal(readWorkingDirectory('[Service]\nExecStart=/bin/true\n'), null);
});

test('status shows the state, pid and restarts of a loaded unit', () => {
  const show = [
    'MainPID=4242',
    'NRestarts=2',
    'LoadState=loaded',
    'ActiveState=active',
    'SubState=running',
    '',
  ].join('\n');
  assert.equal(
    formatSystemdStatus(show),
    'active state = active\nsub state = running\nmain pid = 4242\nrestarts = 2',
  );
});

test('status leaves out the pid of a stopped unit', () => {
  const show = 'MainPID=0\nNRestarts=0\nLoadState=loaded\nActiveState=inactive\nSubState=dead\n';
  assert.equal(
    formatSystemdStatus(show),
    'active state = inactive\nsub state = dead\nrestarts = 0',
  );
});

test('status of a missing unit is not loaded', () => {
  const show = 'MainPID=0\nNRestarts=0\nLoadState=not-found\nActiveState=inactive\nSubState=dead\n';
  assert.equal(formatSystemdStatus(show), 'not loaded');
  assert.equal(formatSystemdStatus(''), 'not loaded');
});

test('lingering is read from loginctl show-user', () => {
  assert.equal(checkIsLingerEnabled('Linger=yes\n'), true);
  assert.equal(checkIsLingerEnabled('Linger=no\n'), false);
  assert.equal(checkIsLingerEnabled(''), false);
});
