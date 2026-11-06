#!/usr/bin/env node
// The npm package ships the bundled dist/cli.js. A checkout of the repository runs the sources with tsx.
import fs from 'node:fs';

const source = new URL('../src/cli.ts', import.meta.url);

if (fs.existsSync(source)) {
  await import('tsx');
  await import(source.href);
} else {
  await import('../dist/cli.js');
}
