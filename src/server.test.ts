import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isCrossSite } from './server';

test('the dashboard, the TUI and curl can start runs', () => {
  assert.equal(isCrossSite({ 'sec-fetch-site': 'same-origin', host: '127.0.0.1:7433' }), false);
  assert.equal(isCrossSite({ host: '127.0.0.1:7433' }), false);
  assert.equal(
    isCrossSite({ origin: 'https://mac-mini.tail1234.ts.net', host: 'mac-mini.tail1234.ts.net' }),
    false,
  );
});

test('a page from another site cannot start runs', () => {
  assert.equal(isCrossSite({ 'sec-fetch-site': 'cross-site', host: '127.0.0.1:7433' }), true);
  assert.equal(isCrossSite({ 'sec-fetch-site': 'same-site', host: 'mac-mini.ts.net' }), true);
  assert.equal(isCrossSite({ origin: 'https://evil.example', host: '127.0.0.1:7433' }), true);
});
