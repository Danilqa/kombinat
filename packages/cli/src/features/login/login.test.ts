import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-login-'));
const fakeClaude = path.join(tmp, 'fake-claude');
fs.writeFileSync(fakeClaude, '#!/bin/sh\n[ "$*" = "auth login" ] && exit 3\nexit 0\n', {
  mode: 0o755,
});
process.env['CLAUDE_BIN'] = fakeClaude;

const { login } = await import('./login');

test("signing in runs the agent's login and ends with its exit code", async () => {
  assert.equal(await login('primary', 'claude'), 3);
});

test('an agent without a login, an unknown agent and a bad account name are refused', async () => {
  await assert.rejects(login('primary', 'command'), { message: 'agent command has no login' });
  await assert.rejects(login('primary', 'gemini'), /^Error: agent must be one of /);
  await assert.rejects(login('../work', 'claude'), /^Error: account must start with /);
});
