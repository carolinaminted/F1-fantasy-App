import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './paths.ts';

export class GuardError extends Error {
  constructor(message: string) { super(`[e2e guard] ${message}`); this.name = 'GuardError'; }
}

export const STAGING_PROJECT = 'formula-fantasy-staging';
export const FORBIDDEN_STRINGS = ['formula-fantasy-1', 'lights-out-league-prod'] as const;
const FORBIDDEN_HOSTS = new Set(['f1.carolinaminted.net']);
const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', 'f1.staging.carolinaminted.net']);
export const DEFAULT_BASE_URL = 'http://127.0.0.1:3100';

const findForbidden = (s: string) => FORBIDDEN_STRINGS.find((f) => s.includes(f)) ?? null;

export function assertAllowedBaseUrl(raw: string): void {
  let url: URL;
  try { url = new URL(raw); } catch { throw new GuardError(`base URL is not a URL: ${raw}`); }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new GuardError(`base URL host "${url.hostname}" is not allowed (allowed: ${[...ALLOWED_HOSTS].join(', ')})`);
  }
}

export function resolveBaseUrl(raw?: string): string {
  const url = raw?.trim() || DEFAULT_BASE_URL;
  assertAllowedBaseUrl(url);
  return url;
}

export function assertNoProdInEnv(env: NodeJS.ProcessEnv): void {
  for (const [key, value] of Object.entries(env)) {
    if (value && findForbidden(value)) throw new GuardError(`environment variable ${key} names a production project; unset it`);
  }
}

export function assertStagingEnvFile(path = join(REPO_ROOT, '.env.staging')): void {
  const match = /^VITE_FIREBASE_PROJECT_ID=(.*)$/m.exec(readFileSync(path, 'utf8'));
  const project = match?.[1].trim();
  if (project !== STAGING_PROJECT) throw new GuardError(`${path} names project "${project}", expected ${STAGING_PROJECT}`);
}

const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

export function isForbiddenRequestUrl(url: string): boolean {
  if (findForbidden(safeDecode(url))) return true;
  try { return FORBIDDEN_HOSTS.has(new URL(url).hostname); } catch { return false; }
}

export function isWriteRequest(url: string, method: string): boolean {
  if (method === 'GET' || method === 'OPTIONS') return false;
  if (url.includes('/google.firestore.v1.Firestore/Write/')) return true;
  if (/\/documents(:commit|:batchWrite)/.test(url)) return true;
  try {
    const host = new URL(url).hostname;
    return host.endsWith('.cloudfunctions.net') || host.endsWith('.run.app');
  } catch { return false; }
}
