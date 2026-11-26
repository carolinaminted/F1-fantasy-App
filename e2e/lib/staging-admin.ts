import { execFileSync } from 'node:child_process';
import { GuardError, STAGING_PROJECT, assertNoProdInEnv, isForbiddenRequestUrl } from './guards.ts';
import { encodeFields, decodeFields, type FsValue } from './firestore-value.ts';

const IMPERSONATOR = 'carolinaminted@gmail.com';
const SERVICE_ACCOUNT = `e2e-harness@${STAGING_PROJECT}.iam.gserviceaccount.com`;
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${STAGING_PROJECT}/databases/(default)/documents`;
const AUTH_BASE = `https://identitytoolkit.googleapis.com/v1/projects/${STAGING_PROJECT}`;

assertNoProdInEnv(process.env);

let cached: { token: string; expires: number } | null = null;
function token(): string {
  if (cached && cached.expires > Date.now()) return cached.token;
  const out = execFileSync('gcloud', ['auth', 'print-access-token', '--account', IMPERSONATOR, '--impersonate-service-account', SERVICE_ACCOUNT], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  cached = { token: out, expires: Date.now() + 45 * 60_000 };
  return out;
}

export function docUrl(path: string): string {
  if (path.split('/').some((seg) => seg === '..' || seg === '.' || seg === '')) throw new GuardError(`bad document path: ${path}`);
  // A literal "+" in a document id (plus-addressed emails) reads as a different id unless encoded.
  return `${FS_BASE}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  if (!url.includes(`/projects/${STAGING_PROJECT}`) || isForbiddenRequestUrl(url)) throw new GuardError(`refusing non-staging URL: ${url}`);
  return fetch(url, { ...init, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
}

async function ok(res: Response, what: string): Promise<any> {
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

export async function getDoc(path: string): Promise<Record<string, unknown> | null> {
  const res = await call(docUrl(path));
  if (res.status === 404) return null;
  const body = await ok(res, `get ${path}`);
  return decodeFields(body.fields);
}

export async function createDoc(path: string, data: Record<string, unknown>): Promise<void> {
  await ok(await call(`${docUrl(path)}?currentDocument.exists=false`, { method: 'PATCH', body: JSON.stringify({ fields: encodeFields(data) }) }), `create ${path}`);
}

const SIMPLE_FIELD = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function fieldPath(key: string): string {
  if (SIMPLE_FIELD.test(key)) return key;
  return `\`${key.replace(/[\\`]/g, (c) => `\\${c}`)}\``;
}

export function patchUrl(path: string, keys: string[]): string {
  const mask = keys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(fieldPath(k))}`).join('&');
  return `${docUrl(path)}?${mask}`;
}

export async function patchDoc(path: string, data: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(data);
  if (keys.length === 0) throw new Error(`patchDoc: no fields given for ${path}`);
  await ok(await call(patchUrl(path, keys), { method: 'PATCH', body: JSON.stringify({ fields: encodeFields(data) }) }), `patch ${path}`);
}

export async function deleteDoc(path: string): Promise<void> {
  const res = await call(docUrl(path), { method: 'DELETE' });
  if (res.status !== 404) await ok(res, `delete ${path}`);
}

export async function queryDocIds(collection: string, field: string, equals: string): Promise<string[]> {
  const body = { structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: fieldPath(field) }, op: 'EQUAL', value: { stringValue: equals } satisfies FsValue } } } };
  const rows = await ok(await call(`${FS_BASE}:runQuery`, { method: 'POST', body: JSON.stringify(body) }), `query ${collection}`);
  return rows.filter((r: any) => r.document).map((r: any) => r.document.name.split('/').pop());
}

export type AuthUser = { localId: string; email?: string; createdAt?: string; customAttributes?: string };

export async function lookupUserByEmail(email: string): Promise<AuthUser | null> {
  const body = await ok(await call(`${AUTH_BASE}/accounts:lookup`, { method: 'POST', body: JSON.stringify({ email: [email] }) }), 'lookup');
  return body.users?.[0] ?? null;
}

export async function createAuthUser(input: { email: string; password: string; displayName: string }): Promise<string> {
  const body = await ok(await call(`${AUTH_BASE}/accounts`, { method: 'POST', body: JSON.stringify({ ...input, emailVerified: true }) }), 'create user');
  return body.localId;
}

export async function updateAuthUser(localId: string, patch: { password?: string; customClaims?: Record<string, unknown> }): Promise<void> {
  const payload: Record<string, unknown> = { localId };
  if (patch.password) payload.password = patch.password;
  if (patch.customClaims) payload.customAttributes = JSON.stringify(patch.customClaims);
  await ok(await call(`${AUTH_BASE}/accounts:update`, { method: 'POST', body: JSON.stringify(payload) }), 'update user');
}

export async function deleteAuthUser(localId: string): Promise<void> {
  await ok(await call(`${AUTH_BASE}/accounts:delete`, { method: 'POST', body: JSON.stringify({ localId }) }), 'delete user');
}

export async function listAuthUsers(): Promise<AuthUser[]> {
  const body = await ok(await call(`${AUTH_BASE}/accounts:query`, { method: 'POST', body: JSON.stringify({ returnUserInfo: true, limit: '500' }) }), 'list users');
  return body.userInfo ?? [];
}
