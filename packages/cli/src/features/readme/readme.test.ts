import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { updateReadme } from './readme';

function makeReadme(folder: string): string {
  const readme = path.join(folder, 'README.md');
  fs.writeFileSync(readme, '# Routines\n\n<!-- routines:start -->\n<!-- routines:end -->\n');
  return readme;
}

function writeRoutine(routinesDir: string): void {
  fs.mkdirSync(routinesDir, { recursive: true });
  fs.writeFileSync(
    path.join(routinesDir, 'my-routine.md'),
    '---\nname: my-routine\ndescription: Mine\nschedule: manual\ncwd: ~/\n---\nDo it\n',
  );
}

test('links each routine from the README next to routines/', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-readme-'));
  writeRoutine(path.join(folder, 'routines'));
  const readme = makeReadme(folder);
  assert.equal(updateReadme(readme, path.join(folder, 'routines')), true);
  assert.match(fs.readFileSync(readme, 'utf8'), /\| \[my-routine\]\(routines\/my-routine\.md\) \|/);
});

test('links each routine relative to the README when routines/ is in a subfolder', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-readme-'));
  writeRoutine(path.join(folder, 'example', 'routines'));
  const readme = makeReadme(folder);
  updateReadme(readme, path.join(folder, 'example', 'routines'));
  assert.match(
    fs.readFileSync(readme, 'utf8'),
    /\| \[my-routine\]\(example\/routines\/my-routine\.md\) \|/,
  );
});
