import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { readCodexModels } from './options';

function makeCodexHome(cache: string | null): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-codex-'));
  if (cache !== null) fs.writeFileSync(path.join(home, 'models_cache.json'), cache);
  return home;
}

test('reads the models Codex lists for the account and leaves out the hidden ones', () => {
  const home = makeCodexHome(
    JSON.stringify({
      models: [
        { slug: 'gpt-reserve', visibility: 'hide' },
        { slug: 'gpt-5.5', visibility: 'list' },
        { slug: 'gpt-5.4' },
      ],
    }),
  );
  assert.deepEqual(readCodexModels(home), ['gpt-5.5', 'gpt-5.4']);
});

test('has no models when Codex has no list, or one it cannot read', () => {
  assert.deepEqual(readCodexModels(makeCodexHome(null)), []);
  assert.deepEqual(readCodexModels(makeCodexHome('not json')), []);
  assert.deepEqual(readCodexModels(makeCodexHome('{"models":"none"}')), []);
});
