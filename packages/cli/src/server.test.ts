import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkIsCrossSite } from './server';

test('the dashboard, the TUI and curl can start runs', () => {
  assert.equal(
    checkIsCrossSite({ 'sec-fetch-site': 'same-origin', host: '127.0.0.1:7433' }),
    false,
  );
  assert.equal(checkIsCrossSite({ host: '127.0.0.1:7433' }), false);
  assert.equal(
    checkIsCrossSite({
      origin: 'https://mac-mini.tail1234.ts.net',
      host: 'mac-mini.tail1234.ts.net',
    }),
    false,
  );
});

test('a page from another site cannot start runs', () => {
  assert.equal(checkIsCrossSite({ 'sec-fetch-site': 'cross-site', host: '127.0.0.1:7433' }), true);
  assert.equal(checkIsCrossSite({ 'sec-fetch-site': 'same-site', host: 'mac-mini.ts.net' }), true);
  assert.equal(checkIsCrossSite({ origin: 'https://evil.example', host: '127.0.0.1:7433' }), true);
});
