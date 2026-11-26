# E2E Harness Foundation Implementation Plan (plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A self-contained `e2e/` Playwright package that safely signs in as a staging admin and a staging member, provisions and tears down its own test identities, and runs a real end-to-end sign-up journey on staging.

**Architecture:** All Google access goes through one staging-locked REST client authenticated by impersonating `e2e-harness@formula-fantasy-staging`. Guards run in Playwright `globalSetup`, before any browser starts. A `setup` project signs in once per role and saves `storageState`. Fixtures add production-URL blocking, an optional write blocker, error capture and a primed session guard. Journeys run on one worker.

**Tech Stack:** `@playwright/test` ~1.63.0, `imapflow` ^2.12.2, Node 22 built-in `node:test` (run with `--experimental-transform-types`, as the root `npm test` already does), Firestore and Identity Toolkit REST APIs, `gcloud` for tokens.

**Spec:** the [E2E-00] page body in the Notion tracker **🏁 Lights Out League** (the section "2026-11-26 revision: identities, email and writes", plus Layout, Guards and Work items). Executors read both.

**Plans 2 and 3 (written when this one is green):** plan 2 is capture and A/B compare ([E2E-03], [E2E-04]); plan 3 is the remaining journeys (picks, profile, dues, admin tour, password reset) and release integration ([E2E-05], [E2E-06]).

## Global Constraints

- Never touch production. Allowed base-URL hosts: `127.0.0.1`, `localhost`, `f1.staging.carolinaminted.net`. Forbidden anywhere: `formula-fantasy-1`, `lights-out-league-prod`, host `f1.carolinaminted.net`.
- Staging project ID is `formula-fantasy-staging`; every REST URL is built from that constant.
- Google credentials: `gcloud auth print-access-token --account carolinaminted@gmail.com --impersonate-service-account e2e-harness@formula-fantasy-staging.iam.gserviceaccount.com`. No key files, and the user's application-default credentials are never changed.
- `e2e/` has its own `package.json` and lockfile. The root `package-lock.json` must stay byte-identical.
- No app code changes in this plan (no `data-testid`). Only `tsconfig.json`, `.dockerignore`, `.gitignore` and root `package.json` scripts change at the root.
- No committed images or run artifacts. Everything under `e2e-results/`, `e2e/.auth/` and `e2e/node_modules/` is gitignored.
- Secrets (`.env.e2e` values) are never printed, logged or committed. `.env.e2e` is mode 600.
- Identities: `lol.e2e.bot+admin@gmail.com` (admin: `users.isAdmin = true` plus custom claim `admin: true`), `lol.e2e.bot+member@gmail.com` (Unpaid), throwaway `lol.e2e.bot+run-<id>@gmail.com`.
- Staging rate limits (per caller, 10-minute windows): `send_auth_code` 3, `verify_auth_code` 10, `validate_invitation` 5. The sign-up journey runs once per invocation, desktop project only, with `retries: 0`.
- Never automated: results entry, schedule, scoring, entities, maintenance, Database Manager, Season Control, pay buttons.
- Branch `feat/e2e-harness`, worktree `/Users/jhh/Codebase/jhh-ai/.worktrees/lol-e2e-harness`. Unmerged until HO-2 has shipped and [ROLL-06] closes (Dec 13). Commits end with `Refs: [E2E-0x]`.
- An agent never signs a release gate.

## File Structure

| Path | Responsibility |
| --- | --- |
| `e2e/package.json`, `e2e/package-lock.json`, `e2e/tsconfig.json` | Isolated package |
| `e2e/lib/paths.ts` | Repo root and well-known file paths |
| `e2e/lib/env.ts` | Find, parse, load and upsert `.env.e2e` |
| `e2e/lib/guards.ts` | Host allowlist, forbidden-string checks, staging env assertion, request classifiers |
| `e2e/lib/firestore-value.ts` | Firestore REST value encode and decode (pure) |
| `e2e/lib/staging-admin.ts` | The only Google API client: token, Firestore docs, Auth accounts |
| `e2e/lib/identities.ts` | Identity emails, run IDs, invite code format |
| `e2e/lib/codes.ts` | Mint and revoke invites; read the sign-up code from Firestore |
| `e2e/lib/mail.ts` | IMAP reader and pure extractors for the code and reset link |
| `e2e/lib/provision-plan.ts` | Pure planning for provisioning (unit-tested) |
| `e2e/lib/teardown-plan.ts` | Pure sweep-target selection (unit-tested) |
| `e2e/lib/app.ts` | App constants and UI helpers (`signInViaUi`, `stagingBadge`) |
| `e2e/scripts/provision.ts` | CLI: dry run by default, `--apply` |
| `e2e/scripts/teardown.ts` | CLI: delete one run account or sweep stale ones |
| `e2e/scripts/check-live.ts` | CLI: read-only connectivity check (staging admin + IMAP) |
| `e2e/playwright.config.ts`, `e2e/global-setup.ts`, `e2e/setup/auth.setup.ts`, `e2e/fixtures.ts` | Playwright wiring |
| `e2e/journeys/auth-signin.spec.ts`, `e2e/journeys/guards.spec.ts`, `e2e/journeys/signup.spec.ts` | Journeys |
| `e2e/spikes/frozen-clock.spec.ts` | Frozen-clock spike |
| `e2e/README.md` | How to run it |

Unit tests sit next to their module as `*.test.ts` and run with `npm --prefix e2e run unit`.

---

### Task 1: Package scaffold and root isolation

**Files:**
- Create: `e2e/package.json`, `e2e/tsconfig.json`, `e2e/lib/paths.ts`, `e2e/lib/paths.test.ts`
- Modify: `tsconfig.json`, `.dockerignore`, `.gitignore`, `package.json` (scripts only)

**Interfaces:**
- Produces: `REPO_ROOT: string`, `E2E_ROOT: string`, `AUTH_DIR: string`, `RESULTS_DIR: string` from `e2e/lib/paths.ts`.

- [ ] **Step 1: Create `e2e/package.json`**

```json
{
  "name": "lol-e2e",
  "private": true,
  "type": "module",
  "scripts": {
    "unit": "node --experimental-transform-types --no-warnings --test 'lib/**/*.test.ts'",
    "journeys": "playwright test",
    "provision": "node --experimental-transform-types --no-warnings scripts/provision.ts",
    "teardown": "node --experimental-transform-types --no-warnings scripts/teardown.ts",
    "check-live": "node --experimental-transform-types --no-warnings scripts/check-live.ts",
    "typecheck": "tsc --noEmit -p ."
  },
  "devDependencies": {
    "@playwright/test": "~1.63.0",
    "@types/node": "^22.0.0",
    "imapflow": "^2.12.2",
    "typescript": "~5.8.0"
  }
}
```

- [ ] **Step 2: Create `e2e/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write the failing test `e2e/lib/paths.test.ts`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, E2E_ROOT, AUTH_DIR, RESULTS_DIR } from './paths.ts';

test('REPO_ROOT is the app repo root', () => {
  assert.ok(existsSync(join(REPO_ROOT, 'firebaseConfig.ts')));
  assert.ok(existsSync(join(REPO_ROOT, '.env.staging')));
});

test('derived paths sit where .gitignore expects them', () => {
  assert.equal(E2E_ROOT, join(REPO_ROOT, 'e2e'));
  assert.equal(AUTH_DIR, join(REPO_ROOT, 'e2e', '.auth'));
  assert.equal(RESULTS_DIR, join(REPO_ROOT, 'e2e-results'));
});
```

- [ ] **Step 4: Install and run it to verify it fails**

```bash
cd /Users/jhh/Codebase/jhh-ai/.worktrees/lol-e2e-harness/e2e
npm install
npm run unit
```

Expected: FAIL, `Cannot find module ... paths.ts`. `npm install` creates `e2e/package-lock.json`.

- [ ] **Step 5: Create `e2e/lib/paths.ts`**

```ts
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export const E2E_ROOT = resolve(here, '..');
export const REPO_ROOT = resolve(E2E_ROOT, '..');
export const AUTH_DIR = join(E2E_ROOT, '.auth');
export const RESULTS_DIR = join(REPO_ROOT, 'e2e-results');
```

- [ ] **Step 6: Run the unit tests to verify they pass**

Run: `npm run unit` (in `e2e/`). Expected: 2 passing.

- [ ] **Step 7: Root isolation edits**

In `tsconfig.json`, add after `"compilerOptions": { ... }` (the file has no `include`/`exclude` today; naming `node_modules` keeps the default exclusion that an explicit `exclude` would otherwise drop):

```json
  ,
  "exclude": ["node_modules", "e2e"]
```

Append to `.dockerignore`:

```
e2e
e2e-results
```

Append to `.gitignore`:

```
# e2e harness (plan: e2e/PLAN.md)
e2e/node_modules/
e2e/.auth/
e2e-results/
```

Add to root `package.json` `scripts` (keep the existing five unchanged):

```json
"e2e:unit": "npm --prefix e2e run unit",
"e2e:journeys": "npm --prefix e2e run journeys --",
"e2e:provision": "npm --prefix e2e run provision --",
"e2e:teardown": "npm --prefix e2e run teardown --",
"e2e:check-live": "npm --prefix e2e run check-live"
```

- [ ] **Step 8: Prove release isolation**

```bash
cd /Users/jhh/Codebase/jhh-ai/.worktrees/lol-e2e-harness
npm ci && npm run lint && npm test && npm run build -- --mode staging
git diff --quiet -- package-lock.json && echo "root lockfile unchanged"
grep -rl "lol-e2e\|e2e/lib" dist/ || echo "bundle clean"
npx --prefix e2e playwright install chromium
```

Expected: lint, test and build pass; both echo lines print.

- [ ] **Step 9: Commit**

```bash
git add e2e/package.json e2e/package-lock.json e2e/tsconfig.json e2e/lib/paths.ts e2e/lib/paths.test.ts e2e/PLAN.md tsconfig.json .dockerignore .gitignore package.json
git commit -m "chore(e2e): scaffold isolated Playwright package

Refs: [E2E-02]"
```

---

### Task 2: Env loading and guards

**Files:**
- Create: `e2e/lib/env.ts`, `e2e/lib/env.test.ts`, `e2e/lib/guards.ts`, `e2e/lib/guards.test.ts`

**Interfaces:**
- Consumes: `REPO_ROOT` from `paths.ts`.
- Produces:
  - `findEnvFile(): string`, `parseEnv(text: string): Record<string, string>`, `loadE2EEnv(required: string[]): Record<string, string>`, `upsertEnvFile(path: string, entries: Record<string, string>): void`
  - `class GuardError extends Error`, `STAGING_PROJECT = 'formula-fantasy-staging'`, `FORBIDDEN_STRINGS: readonly string[]`, `DEFAULT_BASE_URL = 'http://127.0.0.1:3100'`, `resolveBaseUrl(raw?: string): string`, `assertAllowedBaseUrl(raw: string): void`, `assertNoProdInEnv(env: NodeJS.ProcessEnv): void`, `assertStagingEnvFile(path?: string): void`, `isForbiddenRequestUrl(url: string): boolean`, `isWriteRequest(url: string, method: string): boolean`

- [ ] **Step 1: Write the failing tests `e2e/lib/guards.test.ts`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  GuardError, resolveBaseUrl, assertAllowedBaseUrl, assertNoProdInEnv,
  assertStagingEnvFile, isForbiddenRequestUrl, isWriteRequest, DEFAULT_BASE_URL,
} from './guards.ts';

test('base URL defaults to local Vite and allows only staging hosts', () => {
  assert.equal(resolveBaseUrl(undefined), DEFAULT_BASE_URL);
  assert.equal(resolveBaseUrl('https://f1.staging.carolinaminted.net'), 'https://f1.staging.carolinaminted.net');
  assert.doesNotThrow(() => assertAllowedBaseUrl('http://localhost:3101'));
  assert.throws(() => assertAllowedBaseUrl('https://f1.carolinaminted.net'), GuardError);
  assert.throws(() => assertAllowedBaseUrl('https://lights-out-league-web-abc.a.run.app'), GuardError);
  assert.throws(() => assertAllowedBaseUrl('not a url'), GuardError);
});

test('environment naming a production project is refused, naming the variable not the value', () => {
  assert.doesNotThrow(() => assertNoProdInEnv({ HOME: '/Users/x', GOOGLE_CLOUD_PROJECT: 'formula-fantasy-staging' }));
  assert.throws(() => assertNoProdInEnv({ CLOUDSDK_CORE_PROJECT: 'lights-out-league-prod' }), /CLOUDSDK_CORE_PROJECT/);
  assert.throws(() => assertNoProdInEnv({ X: 'gs://formula-fantasy-1-season-backups' }), GuardError);
});

test('.env.staging must name the staging project', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-guard-'));
  const good = join(dir, 'good'); writeFileSync(good, 'A=1\nVITE_FIREBASE_PROJECT_ID=formula-fantasy-staging\n');
  const bad = join(dir, 'bad'); writeFileSync(bad, 'VITE_FIREBASE_PROJECT_ID=formula-fantasy-1\n');
  assert.doesNotThrow(() => assertStagingEnvFile(good));
  assert.throws(() => assertStagingEnvFile(bad), GuardError);
});

test('request classifiers', () => {
  assert.equal(isForbiddenRequestUrl('https://firestore.googleapis.com/v1/projects/formula-fantasy-1/databases'), true);
  assert.equal(isForbiddenRequestUrl('https://f1.carolinaminted.net/'), true);
  assert.equal(isForbiddenRequestUrl('https://f1.staging.carolinaminted.net/'), false);
  assert.equal(isForbiddenRequestUrl('https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?database=projects%2Fformula-fantasy-staging'), false);

  assert.equal(isWriteRequest('https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8', 'POST'), true);
  assert.equal(isWriteRequest('https://firestore.googleapis.com/v1/projects/formula-fantasy-staging/databases/(default)/documents:commit', 'POST'), true);
  assert.equal(isWriteRequest('https://us-central1-formula-fantasy-staging.cloudfunctions.net/sendAuthCode', 'POST'), true);
  assert.equal(isWriteRequest('https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?VER=8', 'POST'), false);
  assert.equal(isWriteRequest('https://securetoken.googleapis.com/v1/token?key=x', 'POST'), false);
});
```

- [ ] **Step 2: Write the failing tests `e2e/lib/env.test.ts`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv, upsertEnvFile, loadE2EEnv } from './env.ts';

test('parseEnv ignores comments and blank lines, keeps = inside values', () => {
  assert.deepEqual(parseEnv('# c\n\nA=1\nB = two \nC=x=y\n'), { A: '1', B: 'two', C: 'x=y' });
});

test('upsertEnvFile replaces existing keys, appends new ones, and sets mode 600', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-env-'));
  const file = join(dir, '.env.e2e');
  writeFileSync(file, 'E2E_MAIL_USER=a@b.c\nKEEP=1\n');
  upsertEnvFile(file, { E2E_MAIL_USER: 'x@y.z', E2E_NEW: 'n' });
  assert.equal(readFileSync(file, 'utf8'), 'E2E_MAIL_USER=x@y.z\nKEEP=1\nE2E_NEW=n\n');
  assert.equal(statSync(file).mode & 0o777, 0o600);
});

test('loadE2EEnv names missing keys without printing values', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-env-'));
  const file = join(dir, '.env.e2e');
  writeFileSync(file, 'PRESENT=secret-value\n');
  process.env.E2E_ENV_FILE = file;
  try {
    assert.equal(loadE2EEnv(['PRESENT']).PRESENT, 'secret-value');
    assert.throws(() => loadE2EEnv(['PRESENT', 'MISSING_ONE']), (e: Error) => /MISSING_ONE/.test(e.message) && !/secret-value/.test(e.message));
  } finally {
    delete process.env.E2E_ENV_FILE;
  }
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npm run unit` (in `e2e/`). Expected: FAIL, modules not found.

- [ ] **Step 4: Implement `e2e/lib/guards.ts`**

```ts
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
```

- [ ] **Step 5: Implement `e2e/lib/env.ts`**

```ts
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
```

- [ ] **Step 6: Run to verify they pass**

Run: `npm run unit` (in `e2e/`). Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add e2e/lib/env.ts e2e/lib/env.test.ts e2e/lib/guards.ts e2e/lib/guards.test.ts
git commit -m "feat(e2e): fail-closed guards and .env.e2e handling

Refs: [E2E-02]"
```

---

### Task 3: Staging-locked admin REST client

**Files:**
- Create: `e2e/lib/firestore-value.ts`, `e2e/lib/firestore-value.test.ts`, `e2e/lib/staging-admin.ts`, `e2e/lib/staging-admin.test.ts`, `e2e/scripts/check-live.ts` (admin half)

**Interfaces:**
- Consumes: `STAGING_PROJECT`, `GuardError`, `assertNoProdInEnv`, `isForbiddenRequestUrl` from `guards.ts`.
- Produces from `firestore-value.ts`: `encodeFields(obj: Record<string, unknown>): Record<string, FsValue>`, `decodeFields(fields: Record<string, FsValue> | undefined): Record<string, unknown>`.
- Produces from `staging-admin.ts`:
  - `docUrl(path: string): string`
  - `getDoc(path: string): Promise<Record<string, unknown> | null>`
  - `createDoc(path: string, data: Record<string, unknown>): Promise<void>` (fails if it exists)
  - `patchDoc(path: string, data: Record<string, unknown>): Promise<void>` (merges only the given fields)
  - `deleteDoc(path: string): Promise<void>` (no error if absent)
  - `queryDocIds(collection: string, field: string, equals: string): Promise<string[]>`
  - `type AuthUser = { localId: string; email?: string; createdAt?: string; customAttributes?: string }`
  - `lookupUserByEmail(email: string): Promise<AuthUser | null>`, `createAuthUser(input: { email: string; password: string; displayName: string }): Promise<string>`, `updateAuthUser(localId: string, patch: { password?: string; customClaims?: Record<string, unknown> }): Promise<void>`, `deleteAuthUser(localId: string): Promise<void>`, `listAuthUsers(): Promise<AuthUser[]>`

- [ ] **Step 1: Write the failing test `e2e/lib/firestore-value.test.ts`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeFields, decodeFields } from './firestore-value.ts';

test('round-trips the shapes the app stores', () => {
  const when = new Date('2026-11-26T18:00:00.000Z');
  const input = { s: 'x', i: 3, d: 1.5, b: true, n: null, t: when, a: ['p', 2], m: { gp: 0, nested: { ok: false } } };
  const encoded = encodeFields(input);
  assert.deepEqual(encoded.i, { integerValue: '3' });
  assert.deepEqual(encoded.d, { doubleValue: 1.5 });
  assert.deepEqual(encoded.t, { timestampValue: '2026-11-26T18:00:00.000Z' });
  assert.deepEqual(decodeFields(encoded), { ...input, t: '2026-11-26T18:00:00.000Z' });
});

test('decodeFields tolerates undefined', () => {
  assert.deepEqual(decodeFields(undefined), {});
});
```

- [ ] **Step 2: Write the failing test `e2e/lib/staging-admin.test.ts`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docUrl } from './staging-admin.ts';

test('every document URL is pinned to the staging project', () => {
  assert.equal(
    docUrl('users/abc'),
    'https://firestore.googleapis.com/v1/projects/formula-fantasy-staging/databases/(default)/documents/users/abc',
  );
});

test('paths cannot smuggle another project', () => {
  assert.throws(() => docUrl('../../../projects/formula-fantasy-1/databases/(default)/documents/users/x'));
  assert.throws(() => docUrl('users/../x'));
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npm run unit`. Expected: FAIL, modules not found.

- [ ] **Step 4: Implement `e2e/lib/firestore-value.ts`**

```ts
export type FsValue =
  | { nullValue: null } | { booleanValue: boolean } | { integerValue: string } | { doubleValue: number }
  | { stringValue: string } | { timestampValue: string }
  | { arrayValue: { values?: FsValue[] } } | { mapValue: { fields?: Record<string, FsValue> } };

function encode(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v as Record<string, unknown>) } };
  throw new Error(`cannot encode ${typeof v}`);
}

function decode(v: FsValue): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decode);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields);
  return undefined;
}

export const encodeFields = (obj: Record<string, unknown>): Record<string, FsValue> =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, encode(v)]));

export const decodeFields = (fields: Record<string, FsValue> | undefined): Record<string, unknown> =>
  Object.fromEntries(Object.entries(fields ?? {}).map(([k, v]) => [k, decode(v)]));
```

- [ ] **Step 5: Implement `e2e/lib/staging-admin.ts`**

```ts
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
  return `${FS_BASE}/${path}`;
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

export async function patchDoc(path: string, data: Record<string, unknown>): Promise<void> {
  const mask = Object.keys(data).map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  await ok(await call(`${docUrl(path)}?${mask}`, { method: 'PATCH', body: JSON.stringify({ fields: encodeFields(data) }) }), `patch ${path}`);
}

export async function deleteDoc(path: string): Promise<void> {
  const res = await call(docUrl(path), { method: 'DELETE' });
  if (res.status !== 404) await ok(res, `delete ${path}`);
}

export async function queryDocIds(collection: string, field: string, equals: string): Promise<string[]> {
  const body = { structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: equals } satisfies FsValue } } } };
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
```

- [ ] **Step 6: Run the unit tests to verify they pass**

Run: `npm run unit`. Expected: all passing. (`staging-admin.test.ts` imports the module but makes no network call; `token()` is lazy.)

- [ ] **Step 7: Create `e2e/scripts/check-live.ts` (read-only)**

```ts
import { getDoc, listAuthUsers } from '../lib/staging-admin.ts';

const season = await getDoc('season_config/current');
console.log('staging season:', season?.activeSeasonId, season?.status);
const users = await listAuthUsers();
console.log('staging auth users:', users.length, 'e2e:', users.filter((u) => u.email?.startsWith('lol.e2e.bot+')).map((u) => u.email));
```

- [ ] **Step 8: Run the live check**

Run: `npm run check-live` (in `e2e/`). Expected: `staging season: 2027 active`, `staging auth users: 2 e2e: []`.

- [ ] **Step 9: Commit**

```bash
git add e2e/lib/firestore-value.ts e2e/lib/firestore-value.test.ts e2e/lib/staging-admin.ts e2e/lib/staging-admin.test.ts e2e/scripts/check-live.ts
git commit -m "feat(e2e): staging-locked Firestore and Auth REST client

Refs: [E2E-02]"
```

---

### Task 4: Identities, invites and sign-up code reader

**Files:**
- Create: `e2e/lib/identities.ts`, `e2e/lib/identities.test.ts`, `e2e/lib/codes.ts`, `e2e/lib/codes.test.ts`

**Interfaces:**
- Consumes: `getDoc`, `createDoc`, `deleteDoc` from `staging-admin.ts`.
- Produces:
  - `ADMIN_EMAIL = 'lol.e2e.bot+admin@gmail.com'`, `MEMBER_EMAIL = 'lol.e2e.bot+member@gmail.com'`, `RUN_EMAIL_RE: RegExp`, `newRunId(): string`, `runEmail(runId: string): string`, `inviteCodeFor(runId: string): string`, `assertThrowaway(email: string): void`
  - `mintInvite(runId: string): Promise<string>`, `revokeInvite(code: string): Promise<void>`, `isFreshVerification(doc: Record<string, unknown> | null, startedAt: number): boolean`, `readSignupCode(email: string, startedAt: number, timeoutMs?: number): Promise<string>`

- [ ] **Step 1: Write the failing tests `e2e/lib/identities.test.ts`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRunId, runEmail, inviteCodeFor, assertThrowaway, ADMIN_EMAIL, MEMBER_EMAIL, RUN_EMAIL_RE } from './identities.ts';

test('run IDs are short, lowercase and unique', () => {
  const a = newRunId(); const b = newRunId();
  assert.match(a, /^[a-z0-9]{8}$/);
  assert.notEqual(a, b);
});

test('run emails and invite codes derive from the run ID', () => {
  assert.equal(runEmail('ab12cd34'), 'lol.e2e.bot+run-ab12cd34@gmail.com');
  assert.equal(inviteCodeFor('ab12cd34'), 'LOL-E2E-AB12CD34');
  assert.match(runEmail('ab12cd34'), RUN_EMAIL_RE);
});

test('persistent identities are never treated as throwaway', () => {
  assert.throws(() => assertThrowaway(ADMIN_EMAIL));
  assert.throws(() => assertThrowaway(MEMBER_EMAIL));
  assert.throws(() => assertThrowaway('someone@example.com'));
  assert.doesNotThrow(() => assertThrowaway(runEmail('ab12cd34')));
});
```

- [ ] **Step 2: Write the failing tests `e2e/lib/codes.test.ts`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFreshVerification } from './codes.ts';

test('a verification doc is fresh only if issued after the journey started', () => {
  const startedAt = 1_000_000;
  // sendAuthCode writes expiresAt = issue time + 600000
  assert.equal(isFreshVerification({ code: '123456', expiresAt: startedAt + 600_000 + 50 }, startedAt), true);
  assert.equal(isFreshVerification({ code: '123456', expiresAt: startedAt + 600_000 - 60_000 }, startedAt), false);
  assert.equal(isFreshVerification(null, startedAt), false);
  assert.equal(isFreshVerification({ expiresAt: startedAt + 700_000 }, startedAt), false);
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npm run unit`. Expected: FAIL, modules not found.

- [ ] **Step 4: Implement `e2e/lib/identities.ts`**

```ts
import { randomBytes } from 'node:crypto';

export const ADMIN_EMAIL = 'lol.e2e.bot+admin@gmail.com';
export const MEMBER_EMAIL = 'lol.e2e.bot+member@gmail.com';
export const RUN_EMAIL_RE = /^lol\.e2e\.bot\+run-[a-z0-9]{8}@gmail\.com$/;

export const newRunId = (): string => randomBytes(6).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '0').slice(0, 8);
export const runEmail = (runId: string): string => `lol.e2e.bot+run-${runId}@gmail.com`;
export const inviteCodeFor = (runId: string): string => `LOL-E2E-${runId.toUpperCase()}`;

export function assertThrowaway(email: string): void {
  if (!RUN_EMAIL_RE.test(email)) throw new Error(`refusing to treat ${email} as a throwaway account`);
}
```

- [ ] **Step 5: Implement `e2e/lib/codes.ts`**

```ts
import { createDoc, deleteDoc, getDoc } from './staging-admin.ts';
import { inviteCodeFor } from './identities.ts';

const CODE_TTL_MS = 600_000; // functions/index.js sendAuthCode: expiresAt = Date.now() + 600000

export async function mintInvite(runId: string): Promise<string> {
  const code = inviteCodeFor(runId);
  await createDoc(`invitation_codes/${code}`, { code, status: 'active', createdAt: new Date(), createdBy: 'e2e-harness' });
  return code;
}

export const revokeInvite = (code: string): Promise<void> => deleteDoc(`invitation_codes/${code}`);

export function isFreshVerification(doc: Record<string, unknown> | null, startedAt: number): boolean {
  if (!doc || typeof doc.code !== 'string') return false;
  return Number(doc.expiresAt) >= startedAt + CODE_TTL_MS - 5_000;
}

export async function readSignupCode(email: string, startedAt: number, timeoutMs = 30_000): Promise<string> {
  const path = `email_verifications/${email.trim().toLowerCase()}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const doc = await getDoc(path);
    if (isFreshVerification(doc, startedAt)) return doc!.code as string;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`no fresh verification code for ${email} within ${timeoutMs}ms`);
}
```

- [ ] **Step 6: Run to verify they pass**

Run: `npm run unit`. Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add e2e/lib/identities.ts e2e/lib/identities.test.ts e2e/lib/codes.ts e2e/lib/codes.test.ts
git commit -m "feat(e2e): identities, invite minting and Firestore code reader

Refs: [E2E-02]"
```

---

### Task 5: IMAP reader for real delivery

**Files:**
- Create: `e2e/lib/mail.ts`, `e2e/lib/mail.test.ts`
- Modify: `e2e/scripts/check-live.ts` (append the IMAP half)

**Interfaces:**
- Consumes: `loadE2EEnv` from `env.ts`.
- Produces: `extractSixDigitCode(text: string): string | null`, `extractResetLink(html: string): string | null`, `waitForMessage(opts: { to: string; subjectIncludes: string; since: Date; timeoutMs?: number }): Promise<{ subject: string; text: string; html: string }>`, `inboxCount(): Promise<number>`

- [ ] **Step 1: Write the failing tests `e2e/lib/mail.test.ts`**

The fixtures mirror the templates in `functions/index.js` (subject `Your Verification Code` around line 440; reset subject `Reset Your Password — Lights Out League` with `<a href="${resetLink}"` around line 530).

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSixDigitCode, extractResetLink } from './mail.ts';

test('pulls the 6-digit code out of the verification email', () => {
  const text = 'Lights Out League\n        Your verification code is:\n        482913\n        This code expires in 10 minutes.';
  assert.equal(extractSixDigitCode(text), '482913');
  assert.equal(extractSixDigitCode('no code here 12345'), null);
});

test('pulls the Firebase reset link out of the reset email', () => {
  const html = '<p>Reset</p><a href="https://formula-fantasy-staging.firebaseapp.com/__/auth/action?mode=resetPassword&amp;oobCode=abc123&amp;apiKey=k&amp;lang=en" style="x">Reset</a>';
  assert.equal(extractResetLink(html), 'https://formula-fantasy-staging.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=abc123&apiKey=k&lang=en');
  assert.equal(extractResetLink('<a href="https://example.com">x</a>'), null);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run unit`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `e2e/lib/mail.ts`**

```ts
import { ImapFlow } from 'imapflow';
import { loadE2EEnv } from './env.ts';

export function extractSixDigitCode(text: string): string | null {
  return /(?:^|\D)(\d{6})(?:\D|$)/.exec(text)?.[1] ?? null;
}

export function extractResetLink(html: string): string | null {
  const href = /href="([^"]*mode=resetPassword[^"]*)"/.exec(html)?.[1];
  return href ? href.replace(/&amp;/g, '&') : null;
}

function client(): ImapFlow {
  const env = loadE2EEnv(['E2E_MAIL_USER', 'E2E_MAIL_APP_PASSWORD']);
  return new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, logger: false, auth: { user: env.E2E_MAIL_USER, pass: env.E2E_MAIL_APP_PASSWORD } });
}

export async function inboxCount(): Promise<number> {
  const c = client();
  await c.connect();
  try { const box = await c.mailboxOpen('INBOX', { readOnly: true }); return box.exists; } finally { await c.logout(); }
}

export async function waitForMessage(opts: { to: string; subjectIncludes: string; since: Date; timeoutMs?: number }) {
  const deadline = Date.now() + (opts.timeoutMs ?? 90_000);
  while (Date.now() < deadline) {
    const c = client();
    await c.connect();
    try {
      const lock = await c.getMailboxLock('INBOX');
      try {
        const uids = (await c.search({ to: opts.to, since: opts.since }, { uid: true })) || [];
        for (const uid of [...uids].reverse()) {
          const msg = await c.fetchOne(String(uid), { envelope: true, source: true, internalDate: true }, { uid: true });
          if (!msg || !msg.envelope?.subject?.includes(opts.subjectIncludes)) continue;
          if (msg.internalDate && new Date(msg.internalDate) < opts.since) continue;
          const raw = msg.source?.toString('utf8') ?? '';
          const decoded = raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
          return { subject: msg.envelope.subject, text: decoded, html: decoded };
        }
      } finally { lock.release(); }
    } finally { await c.logout(); }
    await new Promise((r) => setTimeout(r, 5_000));
  }
  throw new Error(`no "${opts.subjectIncludes}" mail to ${opts.to} within timeout`);
}
```

The quoted-printable decode is deliberately minimal. If the live check in Step 6 shows the body is base64-encoded instead, add `simpleParser` from `mailparser` as a dependency and use its `text` and `html` fields. Record which one was needed in the worklog.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run unit && npm run typecheck`. Expected: all passing. If `typecheck` reports that `imapflow` has no types, create `e2e/types.d.ts` containing `declare module 'imapflow';` and rerun.

- [ ] **Step 5: Append the IMAP half to `e2e/scripts/check-live.ts`**

```ts
import { inboxCount } from '../lib/mail.ts';
console.log('bot inbox messages:', await inboxCount());
```

- [ ] **Step 6: Run the live check**

Run: `npm run check-live`. Expected: the two staging lines from Task 3, plus `bot inbox messages: <n>`. No secret appears in the output.

- [ ] **Step 7: Commit**

```bash
git add e2e/lib/mail.ts e2e/lib/mail.test.ts e2e/scripts/check-live.ts
git commit -m "feat(e2e): IMAP reader for verification and reset mail

Refs: [E2E-02]"
```

---

### Task 6: Provisioning (dry run, then apply with user approval)

**Files:**
- Create: `e2e/lib/provision-plan.ts`, `e2e/lib/provision-plan.test.ts`, `e2e/scripts/provision.ts`

**Interfaces:**
- Consumes: `ADMIN_EMAIL`, `MEMBER_EMAIL` from `identities.ts`; `lookupUserByEmail`, `createAuthUser`, `updateAuthUser`, `getDoc`, `createDoc`, `patchDoc` from `staging-admin.ts`; `findEnvFile`, `parseEnv`, `upsertEnvFile` from `env.ts`.
- Produces: `type Role = 'admin' | 'member'`, `type Observed = { role: Role; email: string; authUser: { localId: string; customAttributes?: string } | null; userDoc: Record<string, unknown> | null; publicDoc: Record<string, unknown> | null; hasPassword: boolean }`, `type Action = { kind: 'createAuth' | 'setPassword' | 'setAdminClaim' | 'createUserDoc' | 'createPublicDoc' | 'setIsAdmin'; role: Role }`, `planProvision(observed: Observed[]): Action[]`, and env keys `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_MEMBER_EMAIL`, `E2E_MEMBER_PASSWORD`.

- [ ] **Step 1: Write the failing tests `e2e/lib/provision-plan.test.ts`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planProvision, type Observed } from './provision-plan.ts';

const blank = (role: 'admin' | 'member'): Observed => ({ role, email: `${role}@x`, authUser: null, userDoc: null, publicDoc: null, hasPassword: false });

test('fresh staging: create everything, admin gets flag and claim', () => {
  const kinds = planProvision([blank('admin'), blank('member')]).map((a) => `${a.role}:${a.kind}`);
  assert.deepEqual(kinds, [
    'admin:createAuth', 'admin:createUserDoc', 'admin:createPublicDoc', 'admin:setIsAdmin', 'admin:setAdminClaim',
    'member:createAuth', 'member:createUserDoc', 'member:createPublicDoc',
  ]);
});

test('fully provisioned: nothing to do', () => {
  const done = (role: 'admin' | 'member'): Observed => ({
    role, email: `${role}@x`, hasPassword: true, publicDoc: { displayName: 'x' },
    authUser: { localId: role, customAttributes: role === 'admin' ? '{"admin":true}' : undefined },
    userDoc: role === 'admin' ? { isAdmin: true } : { duesPaidStatus: 'Unpaid' },
  });
  assert.deepEqual(planProvision([done('admin'), done('member')]), []);
});

test('account exists but .env.e2e lost its password: rotate it', () => {
  const o: Observed = { ...blank('member'), authUser: { localId: 'm' }, userDoc: {}, publicDoc: {}, hasPassword: false };
  assert.deepEqual(planProvision([o]).map((a) => a.kind), ['setPassword']);
});

test('admin missing only the claim: set the claim', () => {
  const o: Observed = { ...blank('admin'), authUser: { localId: 'a', customAttributes: '{}' }, userDoc: { isAdmin: true }, publicDoc: {}, hasPassword: true };
  assert.deepEqual(planProvision([o]).map((a) => a.kind), ['setAdminClaim']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run unit`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `e2e/lib/provision-plan.ts`**

```ts
export type Role = 'admin' | 'member';
export type Observed = {
  role: Role; email: string;
  authUser: { localId: string; customAttributes?: string } | null;
  userDoc: Record<string, unknown> | null;
  publicDoc: Record<string, unknown> | null;
  hasPassword: boolean;
};
export type Action = { kind: 'createAuth' | 'setPassword' | 'setAdminClaim' | 'createUserDoc' | 'createPublicDoc' | 'setIsAdmin'; role: Role };

const claims = (attrs?: string): Record<string, unknown> => { try { return attrs ? JSON.parse(attrs) : {}; } catch { return {}; } };

export function planProvision(observed: Observed[]): Action[] {
  const actions: Action[] = [];
  for (const o of observed) {
    const add = (kind: Action['kind']) => actions.push({ kind, role: o.role });
    if (!o.authUser) add('createAuth');
    else if (!o.hasPassword) add('setPassword');
    if (!o.userDoc) add('createUserDoc');
    if (!o.publicDoc) add('createPublicDoc');
    if (o.role === 'admin') {
      if (o.userDoc?.isAdmin !== true) add('setIsAdmin');
      if (claims(o.authUser?.customAttributes).admin !== true) add('setAdminClaim');
    }
  }
  return actions;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run unit`. Expected: all passing.

- [ ] **Step 5: Implement `e2e/scripts/provision.ts`**

The two documents mirror `createUserProfileDocument` in `services/firestoreService.ts` (around line 111). Display names stay within the 20-character limit.

```ts
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { ADMIN_EMAIL, MEMBER_EMAIL } from '../lib/identities.ts';
import { findEnvFile, parseEnv, upsertEnvFile } from '../lib/env.ts';
import { planProvision, type Observed, type Role } from '../lib/provision-plan.ts';
import { createAuthUser, createDoc, getDoc, lookupUserByEmail, patchDoc, updateAuthUser } from '../lib/staging-admin.ts';

const apply = process.argv.includes('--apply');
const ROLES: Record<Role, { email: string; displayName: string; first: string; envEmail: string; envPassword: string }> = {
  admin: { email: ADMIN_EMAIL, displayName: 'E2E Admin', first: 'E2E', envEmail: 'E2E_ADMIN_EMAIL', envPassword: 'E2E_ADMIN_PASSWORD' },
  member: { email: MEMBER_EMAIL, displayName: 'E2E Member', first: 'E2E', envEmail: 'E2E_MEMBER_EMAIL', envPassword: 'E2E_MEMBER_PASSWORD' },
};

const envFile = findEnvFile();
const env = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};

const observed: Observed[] = [];
for (const role of ['admin', 'member'] as Role[]) {
  const r = ROLES[role];
  const authUser = await lookupUserByEmail(r.email);
  observed.push({
    role, email: r.email, authUser,
    userDoc: authUser ? await getDoc(`users/${authUser.localId}`) : null,
    publicDoc: authUser ? await getDoc(`public_users/${authUser.localId}`) : null,
    hasPassword: Boolean(env[r.envPassword]),
  });
}

const actions = planProvision(observed);
console.log(`env file: ${envFile}`);
console.log(actions.length ? actions.map((a) => `  ${a.role}: ${a.kind}`).join('\n') : '  nothing to do');
if (!apply) { console.log('dry run; pass --apply to write to formula-fantasy-staging'); process.exit(0); }

const uids: Partial<Record<Role, string>> = Object.fromEntries(observed.filter((o) => o.authUser).map((o) => [o.role, o.authUser!.localId]));
for (const a of actions) {
  const r = ROLES[a.role];
  if (a.kind === 'createAuth' || a.kind === 'setPassword') {
    const password = randomBytes(18).toString('base64url');
    if (a.kind === 'createAuth') uids[a.role] = await createAuthUser({ email: r.email, password, displayName: r.displayName });
    else await updateAuthUser(uids[a.role]!, { password });
    upsertEnvFile(envFile, { [r.envEmail]: r.email, [r.envPassword]: password });
  }
  const uid = uids[a.role]!;
  if (a.kind === 'createUserDoc') await createDoc(`users/${uid}`, { displayName: r.displayName, email: r.email, firstName: r.first, lastName: a.role === 'admin' ? 'Admin' : 'Member', duesPaidStatus: 'Unpaid', createdAt: new Date() });
  if (a.kind === 'createPublicDoc') await createDoc(`public_users/${uid}`, { displayName: r.displayName, totalPoints: 0, rank: 999, breakdown: { gp: 0, sprint: 0, quali: 0, fl: 0, p22: 0 } });
  if (a.kind === 'setIsAdmin') await patchDoc(`users/${uid}`, { isAdmin: true });
  if (a.kind === 'setAdminClaim') await updateAuthUser(uid, { customClaims: { admin: true } });
  console.log(`  done ${a.role}: ${a.kind}`);
}
```

- [ ] **Step 6: Dry run (read-only) and show the user**

Run: `npm run provision` (in `e2e/`). Expected: the eight actions from the "fresh staging" test and `dry run; pass --apply ...`. **Stop and show the user the output. This is approval 4.**

- [ ] **Step 7: Apply, only after the user approves**

Run: `npm run provision -- --apply`. Then confirm the result:

```bash
npm run provision          # expect: nothing to do
npm run check-live         # expect: e2e: [ 'lol.e2e.bot+admin@gmail.com', 'lol.e2e.bot+member@gmail.com' ]
grep -c '^E2E_\(ADMIN\|MEMBER\)_PASSWORD=' "$(git rev-parse --path-format=absolute --git-common-dir)/../.env.e2e"   # expect 2
```

- [ ] **Step 8: The user re-baselines `verify.sh` (the staging member list changed)**

Tell the user to run:

```bash
cd ~/Codebase/jhh-ai/lol-docs/regression && LOL_ENV=staging ./verify.sh baseline
```

- [ ] **Step 9: Commit**

```bash
git add e2e/lib/provision-plan.ts e2e/lib/provision-plan.test.ts e2e/scripts/provision.ts
git commit -m "feat(e2e): idempotent staging identity provisioning

Refs: [E2E-01]"
```

---

### Task 7: Teardown and sweep

**Files:**
- Create: `e2e/lib/teardown-plan.ts`, `e2e/lib/teardown-plan.test.ts`, `e2e/lib/teardown.ts`, `e2e/scripts/teardown.ts`

**Interfaces:**
- Consumes: `RUN_EMAIL_RE`, `assertThrowaway` from `identities.ts`; `AuthUser`, `listAuthUsers`, `lookupUserByEmail`, `deleteAuthUser`, `deleteDoc`, `queryDocIds` from `staging-admin.ts`.
- Produces: `selectSweepTargets(users: AuthUser[], now: number, maxAgeMs?: number): AuthUser[]` from `e2e/lib/teardown-plan.ts`; `deleteRunAccount(email: string): Promise<void>` from `e2e/lib/teardown.ts`.

- [ ] **Step 1: Write the failing tests `e2e/lib/teardown-plan.test.ts`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectSweepTargets } from './teardown-plan.ts';

const now = Date.parse('2026-11-26T20:00:00Z');
const at = (iso: string) => String(Date.parse(iso));

test('sweeps only throwaway accounts older than an hour', () => {
  const users = [
    { localId: '1', email: 'lol.e2e.bot+run-aaaaaaaa@gmail.com', createdAt: at('2026-11-26T18:00:00Z') },
    { localId: '2', email: 'lol.e2e.bot+run-bbbbbbbb@gmail.com', createdAt: at('2026-11-26T19:30:00Z') },
    { localId: '3', email: 'lol.e2e.bot+member@gmail.com', createdAt: at('2026-01-01T00:00:00Z') },
    { localId: '4', email: 'lol.e2e.bot+admin@gmail.com', createdAt: at('2026-01-01T00:00:00Z') },
    { localId: '5', email: 'real.member@gmail.com', createdAt: at('2026-01-01T00:00:00Z') },
    { localId: '6', createdAt: at('2026-01-01T00:00:00Z') },
  ];
  assert.deepEqual(selectSweepTargets(users, now).map((u) => u.localId), ['1']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run unit`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `e2e/lib/teardown-plan.ts` and `e2e/lib/teardown.ts`**

`e2e/lib/teardown-plan.ts`:

```ts
import { RUN_EMAIL_RE } from './identities.ts';
import type { AuthUser } from './staging-admin.ts';

export function selectSweepTargets(users: AuthUser[], now: number, maxAgeMs = 60 * 60_000): AuthUser[] {
  return users.filter((u) => u.email && RUN_EMAIL_RE.test(u.email) && now - Number(u.createdAt ?? now) > maxAgeMs);
}
```

`e2e/lib/teardown.ts`:

```ts
import { assertThrowaway } from './identities.ts';
import { deleteAuthUser, deleteDoc, lookupUserByEmail, queryDocIds } from './staging-admin.ts';

export async function deleteRunAccount(email: string): Promise<void> {
  assertThrowaway(email);
  const user = await lookupUserByEmail(email);
  if (!user) return;
  const uid = user.localId;
  for (const code of await queryDocIds('invitation_codes', 'usedBy', uid)) await deleteDoc(`invitation_codes/${code}`);
  await deleteDoc(`userPicks/${uid}`);
  await deleteDoc(`public_users/${uid}`);
  await deleteDoc(`users/${uid}`);
  await deleteDoc(`email_verifications/${email.toLowerCase()}`);
  await deleteAuthUser(uid);
}
```

- [ ] **Step 4: Implement `e2e/scripts/teardown.ts`**

```ts
import { listAuthUsers } from '../lib/staging-admin.ts';
import { selectSweepTargets } from '../lib/teardown-plan.ts';
import { deleteRunAccount } from '../lib/teardown.ts';

const emailArg = process.argv.find((a) => a.startsWith('--email='))?.slice(8);
const targets = emailArg ? [emailArg] : selectSweepTargets(await listAuthUsers(), Date.now()).map((u) => u.email!);
console.log(targets.length ? `deleting: ${targets.join(', ')}` : 'nothing to sweep');
for (const email of targets) await deleteRunAccount(email);
```

- [ ] **Step 5: Run to verify unit tests pass, then the live sweep (no-op on clean staging)**

Run: `npm run unit && npm run teardown`. Expected: all passing, then `nothing to sweep`.

- [ ] **Step 6: Commit**

```bash
git add e2e/lib/teardown-plan.ts e2e/lib/teardown-plan.test.ts e2e/lib/teardown.ts e2e/scripts/teardown.ts
git commit -m "feat(e2e): throwaway account teardown and stale sweep

Refs: [E2E-02]"
```

---

### Task 8: Playwright wiring: config, global guards, auth setup, fixtures, sign-in spec

**Files:**
- Create: `e2e/playwright.config.ts`, `e2e/global-setup.ts`, `e2e/lib/app.ts`, `e2e/setup/auth.setup.ts`, `e2e/fixtures.ts`, `e2e/journeys/auth-signin.spec.ts`

**Interfaces:**
- Consumes: `resolveBaseUrl`, `assertAllowedBaseUrl`, `assertStagingEnvFile`, `assertNoProdInEnv`, `isForbiddenRequestUrl`, `isWriteRequest` from `guards.ts`; `loadE2EEnv` from `env.ts`; `AUTH_DIR` from `paths.ts`.
- Produces:
  - `e2e/lib/app.ts`: `SESSION_STORAGE_KEY = 'ff1_session_activity'`, `THEME_STORAGE_KEY = 'lol_theme'`, `authFile(role: 'admin' | 'member'): string`, `stagingBadge(page: Page): Locator`, `signInViaUi(page: Page, email: string, password: string): Promise<void>`
  - `e2e/fixtures.ts`: `test` with fixtures `readOnly: boolean` (option, default `false`), `blocked: string[]`, `pageErrors: string[]`, `memberPage: Page`, `adminPage: Page`, `anonPage: Page`; re-exports `expect`.

- [ ] **Step 1: Create `e2e/lib/app.ts`**

Selectors come from `components/AuthScreen.tsx` (`#login-email`, `#login-password`, button text `Log In`) and `components/EnvironmentBadge.tsx` (`role="status"`, `aria-label="Environment: STAGING"`). The keys come from `constants.ts` and `contexts/ThemeContext.tsx`.

```ts
import { expect, type Locator, type Page } from '@playwright/test';
import { join } from 'node:path';
import { AUTH_DIR } from './paths.ts';

export const SESSION_STORAGE_KEY = 'ff1_session_activity';
export const THEME_STORAGE_KEY = 'lol_theme';

export const authFile = (role: 'admin' | 'member'): string => join(AUTH_DIR, `${role}.json`);
export const stagingBadge = (page: Page): Locator => page.getByRole('status', { name: 'Environment: STAGING' });

export async function signInViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(page.locator('#login-email')).toBeHidden({ timeout: 30_000 });
  await expect(stagingBadge(page)).toBeVisible();
}
```

- [ ] **Step 2: Create `e2e/global-setup.ts`**

This runs before any browser launches, so a bad base URL fails before Chromium starts.

```ts
import type { FullConfig } from '@playwright/test';
import { assertAllowedBaseUrl, assertNoProdInEnv, assertStagingEnvFile } from './lib/guards.ts';
import { loadE2EEnv } from './lib/env.ts';

export default async function globalSetup(config: FullConfig): Promise<void> {
  for (const p of config.projects) if (p.use.baseURL) assertAllowedBaseUrl(p.use.baseURL);
  assertStagingEnvFile();
  assertNoProdInEnv(process.env);
  loadE2EEnv(['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD', 'E2E_MEMBER_EMAIL', 'E2E_MEMBER_PASSWORD']);
}
```

- [ ] **Step 3: Create `e2e/playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';
import { resolveBaseUrl } from './lib/guards.ts';

const baseURL = resolveBaseUrl(process.env.E2E_BASE_URL);
const local = new URL(baseURL).hostname !== 'f1.staging.carolinaminted.net';
const port = new URL(baseURL).port || '3100';

export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: '../e2e-results/test-output',
  reporter: [['list'], ['html', { outputFolder: '../e2e-results/report', open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'setup', testMatch: /setup\/.*\.setup\.ts/ },
    { name: 'desktop', testMatch: /(journeys|spikes)\/.*\.spec\.ts/, dependencies: ['setup'], use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', testMatch: /(journeys|spikes)\/.*\.spec\.ts/, dependencies: ['setup'], use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: local
    ? { command: `npm --prefix .. run dev -- --mode staging --host 127.0.0.1 --port ${port} --strictPort`, url: baseURL, reuseExistingServer: true, timeout: 90_000 }
    : undefined,
});
```

- [ ] **Step 4: Create `e2e/setup/auth.setup.ts`**

```ts
import { test as setup } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { AUTH_DIR } from '../lib/paths.ts';
import { authFile, signInViaUi } from '../lib/app.ts';
import { loadE2EEnv } from '../lib/env.ts';

const env = loadE2EEnv(['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD', 'E2E_MEMBER_EMAIL', 'E2E_MEMBER_PASSWORD']);
mkdirSync(AUTH_DIR, { recursive: true });

for (const role of ['admin', 'member'] as const) {
  setup(`sign in as ${role}`, async ({ page }) => {
    const prefix = role === 'admin' ? 'E2E_ADMIN' : 'E2E_MEMBER';
    await signInViaUi(page, env[`${prefix}_EMAIL`], env[`${prefix}_PASSWORD`]);
    await page.context().storageState({ path: authFile(role), indexedDB: true });
  });
}
```

- [ ] **Step 5: Create `e2e/fixtures.ts`**

```ts
import { test as base, expect, type Browser, type Page } from '@playwright/test';
import { isForbiddenRequestUrl, isWriteRequest } from './lib/guards.ts';
import { authFile, SESSION_STORAGE_KEY } from './lib/app.ts';

type Fixtures = { readOnly: boolean; blocked: string[]; pageErrors: string[]; memberPage: Page; adminPage: Page; anonPage: Page };

async function openPage(
  browser: Browser,
  opts: { storageState?: string; viewport: any; isMobile: boolean; hasTouch: boolean; baseURL?: string },
  readOnly: boolean, blocked: string[], pageErrors: string[],
): Promise<Page> {
  const context = await browser.newContext({ ...opts, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.route('**/*', (route) => {
    const req = route.request();
    if (isForbiddenRequestUrl(req.url())) { blocked.push(`FORBIDDEN ${req.url()}`); return route.abort('blockedbyclient'); }
    if (readOnly && isWriteRequest(req.url(), req.method())) { blocked.push(`WRITE ${req.method()} ${req.url()}`); return route.abort('blockedbyclient'); }
    return route.continue();
  });
  await context.addInitScript((key) => localStorage.setItem(key, String(Date.now())), SESSION_STORAGE_KEY);
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(`console.error: ${m.text()}`); });
  return page;
}

export const test = base.extend<Fixtures>({
  readOnly: [false, { option: true }],
  blocked: async ({}, use, testInfo) => {
    const blocked: string[] = [];
    await use(blocked);
    const forbidden = blocked.filter((b) => b.startsWith('FORBIDDEN'));
    if (forbidden.length) testInfo.annotations.push({ type: 'forbidden-requests', description: forbidden.join('\n') });
    expect(forbidden, 'requests to production were attempted').toEqual([]);
  },
  pageErrors: async ({}, use) => {
    const errors: string[] = [];
    await use(errors);
    expect(errors, 'page errors or console.error during the test').toEqual([]);
  },
  memberPage: async ({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, pageErrors }, use) => {
    const page = await openPage(browser, { storageState: authFile('member'), viewport, isMobile, hasTouch, baseURL }, readOnly, blocked, pageErrors);
    await use(page); await page.context().close();
  },
  adminPage: async ({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, pageErrors }, use) => {
    const page = await openPage(browser, { storageState: authFile('admin'), viewport, isMobile, hasTouch, baseURL }, readOnly, blocked, pageErrors);
    await use(page); await page.context().close();
  },
  anonPage: async ({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, pageErrors }, use) => {
    const page = await openPage(browser, { viewport, isMobile, hasTouch, baseURL }, readOnly, blocked, pageErrors);
    await use(page); await page.context().close();
  },
});

export { expect };
```

- [ ] **Step 6: Write `e2e/journeys/auth-signin.spec.ts`**

The wrong-password text comes from `AuthScreen.tsx` (`'Invalid email or password. Please try again.'`).

```ts
import { test, expect } from '../fixtures.ts';
import { stagingBadge } from '../lib/app.ts';

test('member lands signed in, with no Admin entry', async ({ memberPage }) => {
  await memberPage.goto('/');
  await expect(stagingBadge(memberPage)).toBeVisible();
  await expect(memberPage.locator('#login-email')).toBeHidden();
  await expect(memberPage.getByText('Standings', { exact: true }).first()).toBeVisible();
  await expect(memberPage.getByText('Admin', { exact: true })).toHaveCount(0);
});

test('admin lands signed in, with the Admin entry', async ({ adminPage }) => {
  await adminPage.goto('/');
  await expect(stagingBadge(adminPage)).toBeVisible();
  await expect(adminPage.getByText('Admin', { exact: true }).first()).toBeVisible();
});

test('wrong password shows the error and stays on sign-in', async ({ anonPage, pageErrors }) => {
  await anonPage.goto('/');
  await anonPage.locator('#login-email').fill(process.env.E2E_MEMBER_EMAIL!);
  await anonPage.locator('#login-password').fill('definitely-wrong-password');
  await anonPage.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(anonPage.getByText('Invalid email or password. Please try again.')).toBeVisible();
  await expect(anonPage.locator('#login-email')).toBeVisible();
  // Firebase logs the 400 from signInWithPassword as a console error; it is expected here.
  pageErrors.splice(0, pageErrors.length, ...pageErrors.filter((e) => !/400|auth\/invalid-credential|identitytoolkit/i.test(e)));
});
```

- [ ] **Step 7: Run it**

```bash
cd /Users/jhh/Codebase/jhh-ai/.worktrees/lol-e2e-harness/e2e
npx playwright test --project=setup --project=desktop journeys/auth-signin.spec.ts
npx playwright test --project=setup --project=mobile journeys/auth-signin.spec.ts
```

Expected: the setup tests and 3 specs pass on each project. If the member or admin test finds `page errors or console.error`, read the messages. Fix real app errors in plan 3; add only clearly benign, specific patterns to a filter in the test, never a blanket filter. Record what you saw in the worklog.

If Playwright cannot resolve the `.ts`-suffixed imports, remove the suffixes in Playwright-only files (`playwright.config.ts`, `global-setup.ts`, `setup/`, `fixtures.ts`, `journeys/`, `spikes/`). Keep them in `lib/` and `scripts/`, which Node runs directly. Record which way it went.

- [ ] **Step 8: Commit**

```bash
git add e2e/playwright.config.ts e2e/global-setup.ts e2e/lib/app.ts e2e/setup/auth.setup.ts e2e/fixtures.ts e2e/journeys/auth-signin.spec.ts
git commit -m "feat(e2e): Playwright wiring with per-role sign-in and fixtures

Refs: [E2E-02]"
```

---

### Task 9: Prove the guards

**Files:**
- Create: `e2e/journeys/guards.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect` from `fixtures.ts`; `stagingBadge` from `app.ts`.

- [ ] **Step 1: Write `e2e/journeys/guards.spec.ts`**

```ts
import { test, expect } from '../fixtures.ts';

test.describe('read-only mode', () => {
  test.use({ readOnly: true });

  test('Firestore writes and callables are aborted and recorded', async ({ memberPage, blocked, pageErrors }) => {
    await memberPage.goto('/');
    const results = await memberPage.evaluate(async () => {
      const attempt = (url: string) => fetch(url, { method: 'POST', body: '{}' }).then(() => 'sent', () => 'aborted');
      return Promise.all([
        attempt('https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fformula-fantasy-staging%2Fdatabases%2F(default)'),
        attempt('https://us-central1-formula-fantasy-staging.cloudfunctions.net/submitPicks'),
      ]);
    });
    expect(results).toEqual(['aborted', 'aborted']);
    expect(blocked.some((b) => b.startsWith('WRITE') && b.includes('/Write/channel'))).toBe(true);
    expect(blocked.some((b) => b.startsWith('WRITE') && b.includes('submitPicks'))).toBe(true);
    // Chrome logs each aborted request as a console error; those are the point of this test.
    pageErrors.splice(0, pageErrors.length, ...pageErrors.filter((e) => !/ERR_BLOCKED_BY_CLIENT|Failed to fetch/.test(e)));
  });
});

test('requests naming a production project are aborted', async ({ memberPage, blocked, pageErrors }) => {
  await memberPage.goto('/');
  const result = await memberPage.evaluate(() =>
    fetch('https://firestore.googleapis.com/v1/projects/formula-fantasy-1/databases/(default)/documents/users').then(() => 'sent', () => 'aborted'));
  expect(result).toBe('aborted');
  expect(blocked.some((b) => b.includes('formula-fantasy-1'))).toBe(true);
  blocked.length = 0; // expected here; the fixture would otherwise fail the test
  pageErrors.splice(0, pageErrors.length, ...pageErrors.filter((e) => !/ERR_BLOCKED_BY_CLIENT|Failed to fetch/.test(e)));
});
```

- [ ] **Step 2: Run the spec**

Run: `npx playwright test --project=setup --project=desktop journeys/guards.spec.ts`. Expected: 2 passing.

- [ ] **Step 3: Prove a production base URL is refused before a browser starts**

```bash
E2E_BASE_URL=https://f1.carolinaminted.net npx playwright test --project=desktop 2>&1 | grep -m1 "e2e guard"
CLOUDSDK_CORE_PROJECT=lights-out-league-prod npx playwright test --project=desktop 2>&1 | grep -m1 "e2e guard"
```

Expected: each prints a `[e2e guard] ...` line and no browser launches. The first fails while the config loads (`resolveBaseUrl`); the second fails in `globalSetup`.

- [ ] **Step 4: Commit**

```bash
git add e2e/journeys/guards.spec.ts
git commit -m "test(e2e): prove production and write guards

Refs: [E2E-02]"
```

---

### Task 10: Frozen-clock spike

**Files:**
- Create: `e2e/spikes/frozen-clock.spec.ts`
- Create: `/Users/jhh/Codebase/jhh-ai/worklog/playwright-adoption.md` (the workspace is not a git repo; nothing to commit there)

**Interfaces:**
- Consumes: `test`, `expect` from `fixtures.ts`; `stagingBadge` from `app.ts`.
- Produces: a recorded decision, "setFixedTime works" or "use clock.install", which plan 2 consumes.

- [ ] **Step 1: Write `e2e/spikes/frozen-clock.spec.ts`**

```ts
import { test, expect } from '../fixtures.ts';
import { stagingBadge } from '../lib/app.ts';

const FROZEN = new Date(Number(process.env.E2E_FROZEN_AT ?? Date.now()));

test('a fixed clock keeps auth, listeners and rendering working', async ({ memberPage }) => {
  await memberPage.clock.setFixedTime(FROZEN);
  await memberPage.goto('/');
  await expect(stagingBadge(memberPage)).toBeVisible();
  await expect(memberPage.locator('#login-email')).toBeHidden();
  await expect(memberPage.getByText(/2027/).first()).toBeVisible({ timeout: 20_000 }); // season label arrives via a Firestore listener
  const a = await memberPage.evaluate(() => Date.now());
  await memberPage.waitForTimeout(1_500);
  const b = await memberPage.evaluate(() => Date.now());
  expect(b).toBe(a);
  await memberPage.reload();
  await expect(memberPage.locator('#login-email')).toBeHidden();
});
```

- [ ] **Step 2: Run it three times**

Run: `for i in 1 2 3; do npx playwright test --project=setup --project=desktop spikes/frozen-clock.spec.ts || break; done`. Expected: 3 green runs.

If it fails on auth or listeners, replace `setFixedTime(FROZEN)` with `await memberPage.clock.install({ time: FROZEN })` followed by `await memberPage.clock.resume()` after `goto`, and rerun. Record which variant works.

- [ ] **Step 3: Start the worklog**

Create `/Users/jhh/Codebase/jhh-ai/worklog/playwright-adoption.md` with: the date, the branch and worktree, the outcome of Tasks 1–10 (which clock variant works, whether `.ts` import suffixes worked in Playwright files, any benign console errors filtered and why, the base64 vs quoted-printable mail finding), and the provisioning approval record.

- [ ] **Step 4: Commit**

```bash
git add e2e/spikes/frozen-clock.spec.ts
git commit -m "test(e2e): frozen-clock spike against live staging

Refs: [E2E-02]"
```

---

### Task 11: Sign-up journey (Firestore code by default, real mail on demand)

**Files:**
- Create: `e2e/journeys/signup.spec.ts`

**Interfaces:**
- Consumes: `newRunId`, `runEmail` from `identities.ts`; `mintInvite`, `readSignupCode` from `codes.ts`; `waitForMessage`, `extractSixDigitCode` from `mail.ts`; `deleteRunAccount` from `teardown.ts`; `getDoc`, `lookupUserByEmail` from `staging-admin.ts`; `test`, `expect` from `fixtures.ts`; `stagingBadge` from `app.ts`.

Selectors come from `components/AuthScreen.tsx`. Toggle text: `Don't have an account? Sign Up`. Invite field placeholder: `LOL-XXXX-XXXX`, button `Validate Code`. Email field `#signup-email`, button `Send Verification Code`. Code field `#code`, button `Verify Code`. Details by placeholder: `John`, `Doe`, `Team Name`, two password fields with placeholder `••••••••`. Final button: `Complete Registration`.

- [ ] **Step 1: Write `e2e/journeys/signup.spec.ts`**

```ts
import { test, expect } from '../fixtures.ts';
import { stagingBadge } from '../lib/app.ts';
import { newRunId, runEmail } from '../lib/identities.ts';
import { mintInvite, readSignupCode } from '../lib/codes.ts';
import { waitForMessage, extractSixDigitCode } from '../lib/mail.ts';
import { deleteRunAccount } from '../lib/teardown.ts';
import { getDoc, lookupUserByEmail } from '../lib/staging-admin.ts';

const realMail = process.env.E2E_REAL_MAIL === '1';

test.describe('sign-up', () => {
  const runId = newRunId();
  const email = runEmail(runId);
  test.afterAll(async () => { await deleteRunAccount(email); });

  test(`new member signs up with an invite and a ${realMail ? 'delivered' : 'Firestore'} code`, async ({ anonPage: page }) => {
    test.skip(test.info().project.name !== 'desktop', 'writes to staging and spends rate limit; desktop only');
    const invite = await mintInvite(runId);

    await page.goto('/');
    await page.getByRole('button', { name: "Don't have an account? Sign Up" }).click();
    await page.getByPlaceholder('LOL-XXXX-XXXX').fill(invite);
    await page.getByRole('button', { name: 'Validate Code' }).click();

    await page.locator('#signup-email').fill(email);
    const startedAt = Date.now();
    await page.getByRole('button', { name: 'Send Verification Code' }).click();
    await expect(page.locator('#code')).toBeVisible({ timeout: 30_000 });

    const code = realMail
      ? extractSixDigitCode((await waitForMessage({ to: email, subjectIncludes: 'Your Verification Code', since: new Date(startedAt - 60_000) })).text)
      : await readSignupCode(email, startedAt);
    expect(code, 'verification code').toMatch(/^\d{6}$/);
    await page.locator('#code').fill(code!);
    await page.getByRole('button', { name: 'Verify Code' }).click();

    await page.getByPlaceholder('John').fill('E2E');
    await page.getByPlaceholder('Doe').fill(`Run ${runId}`);
    await page.getByPlaceholder('Team Name').fill(`E2E ${runId}`);
    const passwords = page.getByPlaceholder('••••••••');
    await passwords.nth(0).fill(`E2e-${runId}-pw!`);
    await passwords.nth(1).fill(`E2e-${runId}-pw!`);
    await page.getByRole('button', { name: 'Complete Registration' }).click();

    await expect(page.locator('#login-email')).toBeHidden({ timeout: 30_000 });
    await expect(stagingBadge(page)).toBeVisible();

    const user = await lookupUserByEmail(email);
    expect(user, 'auth user created').not.toBeNull();
    expect((await getDoc(`users/${user!.localId}`))?.duesPaidStatus).toBe('Unpaid');
    expect((await getDoc(`invitation_codes/${invite}`))?.status).toBe('used');
  });
});
```

- [ ] **Step 2: Run it (Firestore code)**

Run: `npx playwright test --project=setup --project=desktop journeys/signup.spec.ts`. Expected: 1 passing. Then run `npm run check-live` and expect only the admin and member e2e accounts, which proves teardown ran.

- [ ] **Step 3: Run it once with real mail**

Run: `E2E_REAL_MAIL=1 npx playwright test --project=setup --project=desktop journeys/signup.spec.ts`. Expected: 1 passing. Wait at least 10 minutes before a fourth sign-up attempt within a window (the `send_auth_code` limit is 3 per 10 minutes).

- [ ] **Step 4: Run the whole suite three times**

Run: `for i in 1 2 3; do npx playwright test || break; sleep 200; done`. Expected: 3 green runs (setup, sign-in, guards, spike, sign-up). The 200-second gap keeps sign-ups under the rate limit. Then `npm run teardown` prints `nothing to sweep`.

- [ ] **Step 5: Commit**

```bash
git add e2e/journeys/signup.spec.ts
git commit -m "test(e2e): end-to-end sign-up journey with Firestore or delivered code

Refs: [E2E-05]"
```

---

### Task 12: README, tracker and push

**Files:**
- Create: `e2e/README.md`

- [ ] **Step 1: Write `e2e/README.md`**

````markdown
# e2e — Lights Out League browser tests (staging only)

Never runs against production. Guards refuse any base URL outside `127.0.0.1`, `localhost`
and `f1.staging.carolinaminted.net`, and abort any request naming `formula-fantasy-1` or
`lights-out-league-prod`.

## One-time setup

```bash
npm --prefix e2e ci && npx --prefix e2e playwright install chromium
npm run e2e:check-live          # staging admin access + bot inbox, read-only
npm run e2e:provision           # dry run; then: npm run e2e:provision -- --apply
```

Needs `.env.e2e` at the repo root (gitignored, mode 600): `E2E_MAIL_USER`,
`E2E_MAIL_APP_PASSWORD`, then `E2E_ADMIN_*` / `E2E_MEMBER_*` written by provisioning.
Google access impersonates `e2e-harness@formula-fantasy-staging` as `carolinaminted@gmail.com`.

## Running

```bash
npm run e2e:unit                                   # pure unit tests, no network
npm run e2e:journeys                               # local Vite (--mode staging) on :3100
E2E_BASE_URL=https://f1.staging.carolinaminted.net npm run e2e:journeys
E2E_REAL_MAIL=1 npm run e2e:journeys -- journeys/signup.spec.ts   # read the code from the bot inbox
npm run e2e:teardown                               # sweep throwaway accounts older than 1 hour
```

Sign-up spends staging rate limit (3 verification emails per 10 minutes) and runs on desktop only.
Artifacts land in `e2e-results/` (gitignored). Plan: `e2e/PLAN.md`; spec: the [E2E-00] tracker page.
````

- [ ] **Step 2: Run everything once more**

```bash
cd /Users/jhh/Codebase/jhh-ai/.worktrees/lol-e2e-harness
npm run lint && npm test && npm run e2e:unit && npm --prefix e2e run typecheck
git diff --quiet origin/staging -- package-lock.json && echo "root lockfile unchanged"
```

Expected: all pass, and the echo line prints.

- [ ] **Step 3: Commit and push the branch (not merged)**

```bash
git add e2e/README.md
git commit -m "docs(e2e): how to run the harness

Refs: [E2E-02]"
git push -u origin feat/e2e-harness
```

- [ ] **Step 4: Update the tracker**

Through the Notion connector: set [E2E-01] and [E2E-02] Status `Completed`, Released In `Unreleased`, and add the commit SHAs to Commits. In [E2E-05], note that the sign-up journey is done. In the [E2E-00] Layout table, change `provision.mjs` / `teardown.mjs` to `.ts`. Note on [SEC-13] that the security probe should read `E2E_MEMBER_EMAIL` / `E2E_MEMBER_PASSWORD` from `.env.e2e` instead of a separate `.env.probe.local` account (HO-8's open ask). Don't merge anything to `staging`; that waits for HO-2 and Dec 13.
