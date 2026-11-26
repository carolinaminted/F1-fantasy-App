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

// Decodes each valid %XX on its own so one malformed sequence cannot stop the rest from decoding.
const lenientDecode = (s: string) => s.replace(/%[0-9a-fA-F]{2}/g, (m) => String.fromCharCode(parseInt(m.slice(1), 16)));

const hostOf = (url: string): string | null => {
  try { return new URL(url).hostname.replace(/\.+$/, ''); } catch { return null; }
};
const onHost = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

const FIRESTORE_READ_SUFFIX = /:(runQuery|batchGet|runAggregationQuery|listen|listCollectionIds)(?=[?#/]|$)/;
const IDENTITY_WRITE_PATH = /\/accounts:(signUp|update|delete|sendOobCode)(?=[?#/]|$)/;

export function isForbiddenRequestUrl(url: string): boolean {
  if (findForbidden(url) || findForbidden(lenientDecode(url))) return true;
  const host = hostOf(url);
  return host !== null && [...FORBIDDEN_HOSTS].some((h) => onHost(host, h));
}

export function isWriteRequest(url: string, method: string): boolean {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  if (url.includes('/google.firestore.v1.Firestore/Write/')) return true;
  if (/\/documents\//.test(url) && (method === 'PATCH' || method === 'DELETE')) return true;
  if (/\/documents[/:]/.test(url) && method === 'POST') return !FIRESTORE_READ_SUFFIX.test(url);
  const host = hostOf(url);
  if (host === null) return false;
  if (onHost(host, 'identitytoolkit.googleapis.com') && IDENTITY_WRITE_PATH.test(url)) return true;
  return onHost(host, 'cloudfunctions.net') || onHost(host, 'run.app');
}
