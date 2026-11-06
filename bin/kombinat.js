#!/usr/bin/env node
// A checkout runs the sources with tsx, the npm package ships dist/cli.js.
import fs from 'node:fs';

const source = new URL('../src/cli.ts', import.meta.url);

if (fs.existsSync(source)) {
  await import('tsx');
  await import(source.href);
} else {
  await import('../dist/cli.js');
}
