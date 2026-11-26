import { spawn } from 'node:child_process';
import { openSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';

export type Server = { url: string; stop: () => Promise<void> };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tail = (file: string) => readFileSync(file, 'utf8').split('\n').slice(-20).join('\n');

// A server already on the port could be in any mode, so compare never reuses one.
export function assertPortFree(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', () => reject(new Error(`port ${port} is in use; stop whatever is serving there`)));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve()));
  });
}

export async function startVite(root: string, port: number, logFile: string, timeoutMs = 90_000): Promise<Server> {
  await assertPortFree(port);
  const fd = openSync(logFile, 'a');
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VITE_')));
  const child = spawn('npm', ['run', 'dev', '--', '--mode', 'staging', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root, detached: true, stdio: ['ignore', fd, fd], env,
  });
  let exited = false;
  child.on('exit', () => { exited = true; });
  const stop = async () => {
    if (exited || child.pid === undefined) return;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { return; }
    for (let i = 0; i < 50 && !exited; i++) await sleep(100);
    if (!exited) try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
  };
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited) throw new Error(`Vite in ${root} exited before serving; ${logFile}:\n${tail(logFile)}`);
    try { if ((await fetch(url)).ok) return { url, stop }; } catch { /* not up yet */ }
    await sleep(500);
  }
  await stop();
  throw new Error(`Vite in ${root} did not answer on ${url} within ${timeoutMs / 1000}s; see ${logFile}`);
}
