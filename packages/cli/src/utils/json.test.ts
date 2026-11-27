import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { z } from 'zod';

import { readJsonFile, writeJsonFile } from './json';

test('a JSON file is written into a folder that does not exist yet, without its temporary file', () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-json-')), 'state', 'runs');
  const file = path.join(dir, 'record.json');
  writeJsonFile(file, { status: 'running' });
  assert.deepEqual(readJsonFile(file, z.object({ status: z.string() })), { status: 'running' });
  assert.deepEqual(fs.readdirSync(dir), ['record.json']);
});
