import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { REPO_ROOT } from './paths.ts';

export function findEnvFile(): string {
  if (process.env.E2E_ENV_FILE) return process.env.E2E_ENV_FILE;
  const local = join(REPO_ROOT, '.env.e2e');
  if (existsSync(local)) return local;
  // In a worktree, .env.e2e lives in the main checkout (gitignored files are not shared).
  const commonDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  return join(dirname(commonDir), '.env.e2e');
}

export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

export function loadE2EEnv(required: string[]): Record<string, string> {
  const file = findEnvFile();
  const values = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  const missing = required.filter((k) => !values[k]);
  if (missing.length) throw new Error(`${file} is missing: ${missing.join(', ')} (run: npm run e2e:provision)`);
  for (const [k, v] of Object.entries(values)) process.env[k] ??= v;
  return values;
}

export function upsertEnvFile(path: string, entries: Record<string, string>): void {
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter((l, i, a) => !(i === a.length - 1 && l === '')) : [];
  const pending = new Map(Object.entries(entries));
  const updated = lines.map((line) => {
    const key = line.split('=')[0]?.trim();
    if (key && pending.has(key)) { const v = pending.get(key)!; pending.delete(key); return `${key}=${v}`; }
    return line;
  });
  for (const [k, v] of pending) updated.push(`${k}=${v}`);
  writeFileSync(path, `${updated.join('\n')}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}
