import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { assertPortFree } from './servers.ts';

test('assertPortFree refuses a port something is listening on', async () => {
  const s = createServer().listen(0, '127.0.0.1');
  await new Promise((r) => s.once('listening', r));
  const port = (s.address() as { port: number }).port;
  try {
    await assert.rejects(assertPortFree(port), new RegExp(`port ${port} is in use`));
  } finally {
    s.close();
  }
});
