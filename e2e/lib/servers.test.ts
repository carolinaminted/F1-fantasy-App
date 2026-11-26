import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { assertPortFree, stopAllServers, track } from './servers.ts';

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

test('stopAllServers kills a tracked child that never became ready', async () => {
  const child = spawn('node', ['-e', 'setInterval(()=>{},1000)'], { detached: true, stdio: 'ignore' });
  track(child);
  const pid = child.pid!;
  process.kill(pid, 0);
  await stopAllServers();
  await new Promise((r) => setTimeout(r, 100));
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});
