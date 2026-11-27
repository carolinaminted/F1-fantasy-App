# E2E-08 Batch 1: Harness Gaps and First Journeys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the harness read-only by default and close its error, guard and precondition gaps, add the admin-access, retired-URL and signed-out journeys, and answer the three open technical questions (lock clock, first-read failure, offline seeding).

**Architecture:** Everything lives in `e2e/`. Playwright projects split into `desktop` and `mobile` (journeys), `harness` (proofs that the harness works) and `spikes` (questions being answered). Guards stay in one place, `lib/app.ts` `guardContext`, and `fixtures.ts` applies them and the error checks to every context, including the built-in one.

**Tech Stack:** Playwright 1.63 (`e2e/package.json`), TypeScript run by Node with `--experimental-transform-types`, `node:test` for `lib/*.test.ts`.

**Spec:** The [E2E-08] tracker page, https://app.notion.com/p/4250c2f763aa8141b387cee9c6fbef62 (covers A1 to A5, J8, J13, J14 and the J9 and J12 spikes). Parent: the [E2E-00] page.

## Global Constraints

- **Staging only.** Allowed hosts: `127.0.0.1`, `localhost`, `f1.staging.carolinaminted.net`. Forbidden anywhere: `formula-fantasy-1`, `lights-out-league-prod`, `lights-out-league-web`, host `f1.carolinaminted.net`. Nothing here loosens those guards.
- **This batch writes nothing to staging.** No step sets `E2E_WRITES=1`, except the two `--list` commands in Tasks 1 and 2, which run no test.
- **No committed app code.** Only `e2e/**` is committed. Probe edits to app files exist to see a test fail; they are never committed and are reverted in the same task. The root `package.json` is not changed.
- **No merge to `staging`** before HO-2 has shipped and [ROLL-06] closes (Dec 13). Work stays on `feat/e2e-harness` in `/Users/jhh/Codebase/jhh-ai/.worktrees/lol-e2e-harness`. Pushing needs the user's confirmation.
- **Sign-in throttle.** Firebase throttles password sign-ins per account. `setup` reuses a session younger than 30 minutes. Never loop a run. If setup reports "Invalid email or password", stop; probe at most every 5 minutes.
- **Secrets.** Never print a write body, a token or `.env.e2e`. Traces under `e2e-results/` hold passwords and tokens.
- **Git in this worktree:** one git command per Bash call. Each commit message ends with `Refs: [E2E-08]` and the `Co-Authored-By` trailer your session specifies. An agent never signs a release gate.
- **Staging reads** use `gcloud` impersonation of the harness service account. If it fails with an expired login, ask the user to log in; do not work around it.
- All commands run from the worktree root unless a step says otherwise.

## Facts established while planning

Checked offline with Playwright 1.63 on 2026-11-26. The proof tests below keep them true.

| Fact | Consequence |
| --- | --- |
| `context.route` does not see `page.request` or `context.request`; both reached a local server through an abort-all route | The A2 gap is real, not just likely |
| `page.request` and `context.request` are one object; replacing its `fetch` and `_innerFetch` closes `get`, `post`, `put`, `patch`, `delete`, `head`, `fetch` and `route.fetch`, and `context.close()` still works | A2 is a few lines. Replacing the whole object breaks `context.close()` |
| A context init script registered before the clock is installed reads the real time | A far-future clock would trip the app's 15 minute idle sign-out; Task 6 adds a session pin |
| `clock.setFixedTime` can move after a page has loaded; reloads keep it and intervals keep firing | Lock tests can cross a lock without `clock.install` |
| `test.fail('title', body)` also passes when an auto fixture throws during setup | Used to prove the write gate |
| `--project name` swallows a file path that follows it; `--project=name` does not | The npm scripts use the `=` form, so `-- journeys/x.spec.ts` works |
| An init script that touches `localStorage` throws on a new page's `about:blank`, and a context-level listener reports it | The session stamp skips non-HTTP documents |
| A `testMatch` regex is tested against the absolute file path, and this worktree lives in `lol-e2e-harness/` | A pattern like `/harness\/.*\.spec\.ts/` matches every spec in the worktree; the `harness` project uses `testDir` instead |

## Differences from the spec

- J9 uses **e2e-member**, not the admin. The seeding code has no role check, and the rules deny a member's `app_state` writes, so a guard mistake cannot overwrite staging config. Accepted by the user on 2026-11-26; the tracker page now says member.
- A default run is read-only everywhere, including the sign-in `setup` project.
- Task 11 lets a handshake-only Write channel message through for tests that set `observeWrites`. Accepted by the user on 2026-11-26.

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `lib/run-mode.ts` | The `E2E_WRITES` and `E2E_SPIKES` flags and the write gate | 1 |
| `playwright.config.ts`, `package.json` | Project split and `journeys`, `harness`, `spikes` scripts | 1 |
| `harness/` | Harness proofs: `guards`, `capture-helpers` (moved), `write-gate`, `errors` | 1–4 |
| `fixtures.ts` | Read-only default, one `watchContext` for every context, `requires`, `observeWrites` | 2, 4, 5, 11 |
| `lib/app.ts` | Closes API requests, session stamp and pin, write handshake option | 3, 6, 11 |
| `lib/no-unguarded-request.test.ts` | No file opens a standalone request context | 3 |
| `lib/preconditions.ts`, `lib/staging-state.ts` | Named staging preconditions (pure) and the read behind them | 5 |
| `journeys/admin-access.spec.ts` | J8 | 7 |
| `lib/redirects.ts`, `journeys/redirects.spec.ts` | J13 and its drift test | 8 |
| `journeys/signed-out.spec.ts` | J14 | 9 |
| `spikes/lock-clock.spec.ts` | A5 | 6 |
| `lib/firestore-outage.ts`, `spikes/first-read-failure.spec.ts` | J12 spike | 10 |
| `lib/write-channel.ts`, `spikes/offline-seed.spec.ts` | J9 spike | 11 |

---

### Task 0: Preflight

**Files:** commit `e2e/PLAN-E2E-08.md`.

- [ ] **Step 1: Enter the worktree**

Use the `EnterWorktree` tool with `path` = `/Users/jhh/Codebase/jhh-ai/.worktrees/lol-e2e-harness`. Without it, the branch guard judges git commands by the main checkout, which is on `staging`.

- [ ] **Step 2: Confirm nobody else is mid-work**

Run: `git status --short`
Expected: only `?? e2e/PLAN-E2E-08.md`. Any other change belongs to another session: stop and ask.

Run: `git log --oneline -1`
Expected: `0a4fac6 fix(e2e): stabilise standings-popular capture`. If it is newer, re-read every file a task modifies before editing it.

Run: `pgrep -fl 'playwright|vite'`
Expected: no output.

- [ ] **Step 3: Confirm the baseline**

Run: `npm run e2e:unit`
Expected: `# pass 110`, `# fail 0`.

Run: `npm --prefix e2e run typecheck`
Expected: no output.

Run: `npm run e2e:check-live`
Expected: staging admin access and the bot inbox both succeed.

- [ ] **Step 4: Mark the item started**

In the tracker, set the [E2E-08] row to `In Progress`.

- [ ] **Step 5: Commit the plan**

```bash
git add e2e/PLAN-E2E-08.md
```
```bash
git commit -m "docs(e2e): E2E-08 batch 1 plan

Refs: [E2E-08]"
```

---

### Task 1: Split journeys, harness proofs and spikes (A3, part 1)

**Files:**
- Create: `e2e/lib/run-mode.ts`, `e2e/lib/run-mode.test.ts`
- Move: `e2e/journeys/guards.spec.ts` → `e2e/harness/guards.spec.ts`; `e2e/spikes/capture-helpers.spec.ts` → `e2e/harness/capture-helpers.spec.ts`
- Modify: `e2e/playwright.config.ts`, `e2e/package.json`, `e2e/journeys/signup.spec.ts`

**Interfaces:**
- Produces: `writesEnabled(env?): boolean`, `spikesEnabled(env?): boolean`, `assertWriteAllowed(readOnly: boolean, env?): void` (throws `GuardError`).

- [ ] **Step 1: Write the failing test** — `e2e/lib/run-mode.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertWriteAllowed, spikesEnabled, writesEnabled } from './run-mode.ts';
import { GuardError } from './guards.ts';

test('writes and spikes are off unless their flag is exactly 1', () => {
  assert.equal(writesEnabled({}), false);
  assert.equal(writesEnabled({ E2E_WRITES: 'true' }), false);
  assert.equal(writesEnabled({ E2E_WRITES: '1' }), true);
  assert.equal(spikesEnabled({}), false);
  assert.equal(spikesEnabled({ E2E_SPIKES: '1' }), true);
});

test('turning read-only off without E2E_WRITES=1 is refused', () => {
  assert.doesNotThrow(() => assertWriteAllowed(true, {}));
  assert.doesNotThrow(() => assertWriteAllowed(false, { E2E_WRITES: '1' }));
  assert.throws(() => assertWriteAllowed(false, {}), GuardError);
  assert.throws(() => assertWriteAllowed(false, {}), /E2E_WRITES=1/);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm run e2e:unit`
Expected: FAIL, `Cannot find module .../lib/run-mode.ts`.

- [ ] **Step 3: Implement** — `e2e/lib/run-mode.ts`

```ts
import { GuardError } from './guards.ts';

type Env = Record<string, string | undefined>;

export const writesEnabled = (env: Env = process.env): boolean => env.E2E_WRITES === '1';
export const spikesEnabled = (env: Env = process.env): boolean => env.E2E_SPIKES === '1';

export function assertWriteAllowed(readOnly: boolean, env: Env = process.env): void {
  if (!readOnly && !writesEnabled(env)) throw new GuardError('this test turns read-only off; staging writes need E2E_WRITES=1');
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `npm run e2e:unit`
Expected: `# pass 112`.

- [ ] **Step 5: Move the harness proofs**

```bash
mkdir -p e2e/harness
```
```bash
git mv e2e/journeys/guards.spec.ts e2e/harness/guards.spec.ts
```
```bash
git mv e2e/spikes/capture-helpers.spec.ts e2e/harness/capture-helpers.spec.ts
```

Their `../fixtures.ts` and `../lib/...` imports still resolve.

- [ ] **Step 6: Split the projects** — in `e2e/playwright.config.ts`

Add after the `RESULTS_DIR` import:

```ts
import { spikesEnabled, writesEnabled } from './lib/run-mode.ts';
```

Add above `export default defineConfig({`:

```ts
const DESKTOP: PlaywrightTestConfig['use'] = { browserName: 'chromium', viewport: { width: 1440, height: 1000 } };
const MOBILE: PlaywrightTestConfig['use'] = { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
// Tests tagged @write change staging, so they are left out unless E2E_WRITES=1.
const journeys = (name: string, use: PlaywrightTestConfig['use']) => ({
  name, testMatch: /journeys\/.*\.spec\.ts/, grepInvert: writesEnabled() ? undefined : /@write/, dependencies: ['setup'], use,
});
```

Replace the whole `projects: [ ... ],` array with:

```ts
  projects: [
    { name: 'setup', testMatch: /setup\/.*\.setup\.ts/ },
    journeys('desktop', DESKTOP),
    journeys('mobile', MOBILE),
    // Proofs that the harness itself works. testDir, not a testMatch regex: regexes see the absolute
    // path, and the worktree folder lol-e2e-harness/ would make every spec match.
    { name: 'harness', testDir: './harness', dependencies: ['setup'], use: DESKTOP },
    // Questions being answered; they may be slow or fail. Only defined when asked for.
    ...(spikesEnabled() ? [{ name: 'spikes', testMatch: /spikes\/.*\.spec\.ts/, dependencies: ['setup'], use: DESKTOP }] : []),
    ...captureProjects,
  ],
```

- [ ] **Step 7: Scripts** — in `e2e/package.json`, replace the `"journeys"` line with:

```json
    "journeys": "playwright test --project=desktop --project=mobile",
    "harness": "playwright test --project=harness",
    "spikes": "E2E_SPIKES=1 playwright test --project=spikes",
```

- [ ] **Step 8: Tag the writing journey** — in `e2e/journeys/signup.spec.ts`, replace

```ts
  test(`new member signs up with an invite and a ${realMail ? 'delivered' : 'Firestore'} code`, async ({ anonPage: page }) => {
```

with

```ts
  test(`new member signs up with an invite and a ${realMail ? 'delivered' : 'Firestore'} code`, { tag: '@write' }, async ({ anonPage: page }) => {
```

- [ ] **Step 9: Verify the lists** (`--list` runs nothing)

| Command | Expected total |
| --- | --- |
| `npm run e2e:journeys -- --list` | `8 tests in 2 files`, no `signup` |
| `E2E_WRITES=1 npm run e2e:journeys -- --list` | `10 tests in 3 files` |
| `npm --prefix e2e run harness -- --list` | `12 tests in 3 files`, none from `journeys/`, `spikes/` or `capture.spec.ts` |
| `npm --prefix e2e run spikes -- --list` | `5 tests in 3 files` |

Run: `npm --prefix e2e run typecheck`
Expected: no output.

- [ ] **Step 10: Commit**

```bash
git add e2e/lib/run-mode.ts e2e/lib/run-mode.test.ts e2e/harness e2e/journeys e2e/spikes e2e/playwright.config.ts e2e/package.json
```
```bash
git commit -m "test(e2e): separate journeys, harness proofs and spikes

Refs: [E2E-08]"
```

---

### Task 2: Read-only by default (A3, part 2)

**Files:**
- Create: `e2e/harness/write-gate.spec.ts`
- Modify: `e2e/fixtures.ts`, `e2e/setup/auth.setup.ts`, `e2e/journeys/signup.spec.ts`

**Interfaces:**
- Consumes: `assertWriteAllowed`, `writesEnabled` (Task 1).
- Produces: fixtures default `readOnly: true`, `allowBlockedWriteNoise: true`. A spec that writes needs `test.use({ readOnly: false })`, the `@write` tag and `E2E_WRITES=1`.

- [ ] **Step 1: Make sign-in read-only first**, so no run in this task can write. In `e2e/setup/auth.setup.ts`, change both `guardContext` calls from `{ readOnly: false, blocked }` to `{ readOnly: true, blocked }`:

```ts
    await guardContext(context, { readOnly: true, blocked });
```
```ts
    await guardContext(page.context(), { readOnly: true, blocked });
```

- [ ] **Step 2: Write the failing proof** — `e2e/harness/write-gate.spec.ts`

```ts
import { test, expect } from '../fixtures.ts';
import { writesEnabled } from '../lib/run-mode.ts';

test('a test that declares nothing is read-only', async ({ readOnly }) => {
  expect(readOnly).toBe(true);
});

test.describe('read-only turned off', () => {
  test.use({ readOnly: false });
  test.skip(() => writesEnabled(), 'E2E_WRITES=1 allows this');

  // Opens no page, so it cannot write even while the gate is missing.
  test.fail('is refused without E2E_WRITES=1', async () => {});
});
```

- [ ] **Step 3: Run it and see both fail**

Run: `npm --prefix e2e run harness -- harness/write-gate.spec.ts`
Expected: 2 failed (the 2 sign-in setup tests pass). The first reports `Expected: true, Received: false`; the second reports `Expected to fail, but passed`.

- [ ] **Step 4: Implement the default and the gate** — in `e2e/fixtures.ts`

Add the import:

```ts
import { assertWriteAllowed } from './lib/run-mode.ts';
```

In `type Fixtures`, add after `allowBlockedWriteNoise: boolean;`:

```ts
  writeGate: void;
```

Replace these two lines:

```ts
  readOnly: [false, { option: true }],
  allowBlockedWriteNoise: [false, { option: true }],
```

with:

```ts
  readOnly: [true, { option: true }],
  allowBlockedWriteNoise: [true, { option: true }],
  writeGate: [async ({ readOnly }, use) => { assertWriteAllowed(readOnly); await use(); }, { auto: true }],
```

Replace the whole `pageErrors:` fixture with:

```ts
  pageErrors: async ({ allowances, writeBodies, errorPages, blocked, allowBlockedWriteNoise }, use, testInfo) => {
    const errors: string[] = [];
    await use(errors);
    // Optional, may match zero times (the bug is intermittent); unlike expectError it never fails when unused.
    const known = splitKnownIssues(errors.map((text, i) => ({ text, pageId: errorPages[i] })), writeBodies);
    if (known.knownHit) testInfo.annotations.push({ type: 'known-app-issue', description: RACE_RESULTS_SEED_NOTE.replace('known-app-issue: ', '') });
    // Declared allowances are matched first, so the noise filter cannot swallow a line a test expects.
    let unexpected = known.remaining.map((r) => r.text).filter((e) => {
      const hits = allowances.filter((a) => a.re.test(e));
      hits.forEach((a) => { a.used = true; });
      return hits.length === 0;
    });
    if (allowBlockedWriteNoise) {
      const noise = dropBlockedWriteNoise(unexpected, blocked);
      if (noise.dropped) testInfo.annotations.push({ type: 'blocked-write-noise', description: `${noise.dropped} log line(s) from aborted writes` });
      unexpected = noise.remaining;
    }
    expect(unexpected, 'page errors or console.error during the test').toEqual([]);
    expect(allowances.filter((a) => !a.used).map((a) => String(a.re)), 'expectError patterns that never matched').toEqual([]);
  },
```

- [ ] **Step 5: Let sign-up write** — in `e2e/journeys/signup.spec.ts`, replace

```ts
test.describe('sign-up', () => {
  const runId = newRunId();
```

with

```ts
test.describe('sign-up', () => {
  test.use({ readOnly: false });
  const runId = newRunId();
```

- [ ] **Step 6: Verify, including one fresh sign-in under read-only**

Run: `npm --prefix e2e run harness`
Expected: `14 passed`. `requests naming a production project are aborted` passing shows allowances are matched before the noise filter.

Run once, not in a loop: `E2E_FRESH_SIGNIN=1 npm run e2e:journeys -- journeys/auth-signin.spec.ts`
Expected: `7 passed, 1 skipped`.

Run: `E2E_WRITES=1 npm run e2e:journeys -- --list`
Expected: sign-up is listed. Do not run it.

Run: `npm --prefix e2e run typecheck`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add e2e/fixtures.ts e2e/setup/auth.setup.ts e2e/journeys/signup.spec.ts e2e/harness/write-gate.spec.ts
```
```bash
git commit -m "test(e2e): read-only by default; writes need E2E_WRITES=1

Refs: [E2E-08]"
```

---

### Task 3: Close the unguarded request paths (A2)

**Files:**
- Modify: `e2e/lib/app.ts`, `e2e/harness/guards.spec.ts`
- Create: `e2e/lib/no-unguarded-request.test.ts`

**Interfaces:**
- Produces: `closeApiRequests(context: BrowserContext): void`, called by `guardContext`, so every guarded context has it.

- [ ] **Step 1: Write the failing proof** — append to `e2e/harness/guards.spec.ts`

```ts
// .invalid never resolves, so even with the guard missing this cannot reach a real host.
const PROD_LOOKALIKE = 'https://formula-fantasy-1.invalid/probe';

test('page.request and context.request are refused, so nothing skips the request guard', async ({ memberPage, page, context }) => {
  for (const api of [memberPage.request, memberPage.context().request, page.request, context.request]) {
    await expect(api.get(PROD_LOOKALIKE)).rejects.toThrow(/e2e guard/);
    await expect(api.fetch(PROD_LOOKALIKE, { method: 'POST' })).rejects.toThrow(/e2e guard/);
  }
});
```

Never replace the `.invalid` host with a real one.

- [ ] **Step 2: Run it and see it fail**

Run: `npm --prefix e2e run harness -- harness/guards.spec.ts`
Expected: the new test fails; the received error is `getaddrinfo ENOTFOUND formula-fantasy-1.invalid`, not the guard.

- [ ] **Step 3: Implement** — in `e2e/lib/app.ts`

Change the guards import to:

```ts
import { GuardError, isForbiddenRequestUrl, isForeignFirebaseAuthKey, isWriteRequest, redactKey, stagingWebApiKey } from './guards.ts';
```

Add above `guardContext`:

```ts
// page.request, context.request and route.fetch share one object that context.route never sees.
// Only its sending methods are replaced: context.close() still needs the rest of it.
export function closeApiRequests(context: BrowserContext): void {
  const refuse = async (): Promise<never> => {
    throw new GuardError('page.request, context.request and route.fetch bypass the request guard; use lib/staging-admin.ts for API calls');
  };
  for (const method of ['fetch', '_innerFetch']) Object.defineProperty(context.request, method, { value: refuse, configurable: true });
}
```

Make it the first line of `guardContext`'s body, before `const stagingKey = stagingWebApiKey();`:

```ts
  closeApiRequests(context);
```

- [ ] **Step 4: Run it and see it pass**

Run: `npm --prefix e2e run harness -- harness/guards.spec.ts`
Expected: all pass.

- [ ] **Step 5: Add the static check** — `e2e/lib/no-unguarded-request.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { E2E_ROOT } from './paths.ts';

// A request context made this way belongs to no browser context, so no guard can see it.
const UNGUARDED = /\brequest\s*\.\s*newContext\s*\(/;
const SELF = 'lib/no-unguarded-request.test.ts';

const sources = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (e.name === 'node_modules' || e.name.startsWith('.')) return [];
  const path = join(dir, e.name);
  return e.isDirectory() ? sources(path) : e.name.endsWith('.ts') ? [path] : [];
});

test('no harness file opens a standalone API request context', () => {
  const offenders = sources(E2E_ROOT)
    .map((f) => relative(E2E_ROOT, f))
    .filter((f) => f !== SELF && UNGUARDED.test(readFileSync(join(E2E_ROOT, f), 'utf8')));
  assert.deepEqual(offenders, []);
});
```

- [ ] **Step 6: See it catch an offender**

Create `e2e/lib/zz-probe.ts` containing `export const probe = 'request.newContext(';`.
Run: `npm run e2e:unit` — expected: 1 fail, naming `lib/zz-probe.ts`.
Delete it: `rm e2e/lib/zz-probe.ts`.
Run: `npm run e2e:unit` — expected: `# pass 113`.

Run: `npm --prefix e2e run typecheck`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add e2e/lib/app.ts e2e/harness/guards.spec.ts e2e/lib/no-unguarded-request.test.ts
```
```bash
git commit -m "fix(e2e): close page.request and context.request, which skip the guard

Refs: [E2E-08]"
```

---

### Task 4: Check errors on every context (A1)

**Files:**
- Create: `e2e/harness/errors.spec.ts`
- Modify: `e2e/fixtures.ts` (full replacement)

**Interfaces:**
- Produces: `type Watch = { readOnly; blocked; writeBodies; pageErrors; errorPages }`, `watchContext(watch, context, name)`, and a `watch` fixture.

- [ ] **Step 1: Write the failing proof** — `e2e/harness/errors.spec.ts`

```ts
import { test, expect } from '../fixtures.ts';

test('console and page errors on the built-in page are recorded', async ({ page, expectError }) => {
  expectError(/^console\.error: e2e-injected-console$/);
  expectError(/^pageerror: e2e-injected-throw$/);
  await page.setContent('<p>probe</p>');
  await page.evaluate(() => { console.error('e2e-injected-console'); setTimeout(() => { throw new Error('e2e-injected-throw'); }, 0); });
  await page.waitForTimeout(200);
});

test.fail('an undeclared console.error on the built-in page fails the test', async ({ page }) => {
  await page.setContent('<script>console.error("e2e-injected-console")</script>');
  await page.waitForTimeout(200);
  await expect(page.locator('body')).toBeAttached();
});
```

- [ ] **Step 2: Run it and see both fail**

Run: `npm --prefix e2e run harness -- harness/errors.spec.ts`
Expected: the first fails with `expectError patterns that never matched`; the second with `Expected to fail, but passed`.

- [ ] **Step 3: Implement** — replace `e2e/fixtures.ts` with:

```ts
import { test as base, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { authFile, guardContext, SESSION_STORAGE_KEY } from './lib/app.ts';
import { loadStorageState } from './lib/storage-state.ts';
import { dropBlockedWriteNoise } from './lib/capture-noise.ts';
import { RACE_RESULTS_SEED_NOTE, splitKnownIssues } from './lib/known-issues.ts';
import { assertWriteAllowed } from './lib/run-mode.ts';

type Allowance = { re: RegExp; used: boolean };

// What a context needs to be guarded and listened to.
type Watch = {
  readOnly: boolean;
  blocked: string[];
  writeBodies: Map<string, string[]>;
  pageErrors: string[];
  errorPages: string[];
};

type Fixtures = {
  readOnly: boolean;
  allowBlockedWriteNoise: boolean;
  writeGate: void;
  watch: Watch;
  blocked: string[];
  writeBodies: Map<string, string[]>;
  pageErrors: string[];
  errorPages: string[];
  allowances: Allowance[];
  blockedAllowances: Allowance[];
  expectError: (re: RegExp) => void;
  expectBlocked: (re: RegExp) => void;
  memberPage: Page;
  adminPage: Page;
  anonPage: Page;
};

// Guards a context and records what its pages report. Errors and write bodies share an id,
// so a known-issue excuse never crosses contexts.
async function watchContext(watch: Watch, context: BrowserContext, name: string): Promise<void> {
  const contextId = `${name}#${watch.writeBodies.size}`;
  const bodies: string[] = [];
  watch.writeBodies.set(contextId, bodies);
  await guardContext(context, { readOnly: watch.readOnly, blocked: watch.blocked, writeBodies: bodies });
  const record = (text: string) => { watch.pageErrors.push(text); watch.errorPages.push(contextId); };
  context.on('weberror', (e) => record(`pageerror: ${e.error().message}`));
  context.on('console', (m) => { if (m.type() === 'error') record(`console.error: ${m.text()}`); });
}

type PageEnv = {
  browser: Browser;
  viewport: { width: number; height: number } | null;
  isMobile: boolean;
  hasTouch: boolean;
  baseURL?: string;
  watch: Watch;
};

async function openPage(env: PageEnv, role?: 'member' | 'admin'): Promise<Page> {
  const context = await env.browser.newContext({
    storageState: role ? loadStorageState(authFile(role), env.baseURL) : undefined,
    viewport: env.viewport,
    isMobile: env.isMobile,
    hasTouch: env.hasTouch,
    baseURL: env.baseURL,
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  });
  await watchContext(env.watch, context, role ?? 'anon');
  // A new page starts on about:blank, which has no storage. The thrown error would now be reported,
  // because the listeners above are attached before the page exists.
  await context.addInitScript((key) => { if (location.protocol.startsWith('http')) localStorage.setItem(key, String(Date.now())); }, SESSION_STORAGE_KEY);
  return context.newPage();
}

export const test = base.extend<Fixtures>({
  // The built-in page and context are guarded and watched like the role pages; the built-in request is closed off.
  context: async ({ context, watch }, use) => {
    await watchContext(watch, context, 'builtin');
    await use(context);
  },
  request: async ({}, use) => {
    await use(new Proxy({}, { get() { throw new Error('the built-in request fixture is unguarded; use lib/staging-admin.ts for API calls'); } }) as never);
  },
  readOnly: [true, { option: true }],
  allowBlockedWriteNoise: [true, { option: true }],
  writeGate: [async ({ readOnly }, use) => { assertWriteAllowed(readOnly); await use(); }, { auto: true }],
  watch: async ({ readOnly, blocked, writeBodies, pageErrors, errorPages }, use) => {
    await use({ readOnly, blocked, writeBodies, pageErrors, errorPages });
  },
  blockedAllowances: async ({}, use) => { await use([]); },
  expectBlocked: async ({ blockedAllowances, blocked: _blocked }, use) => {
    await use((re) => { blockedAllowances.push({ re, used: false }); });
  },
  blocked: async ({ blockedAllowances }, use, testInfo) => {
    const blocked: string[] = [];
    await use(blocked);
    const forbidden = blocked.filter((b) => b.startsWith('FORBIDDEN'));
    if (forbidden.length) testInfo.annotations.push({ type: 'forbidden-requests', description: forbidden.join('\n') });
    const unexpected = forbidden.filter((b) => {
      const hits = blockedAllowances.filter((a) => a.re.test(b));
      hits.forEach((a) => { a.used = true; });
      return hits.length === 0;
    });
    expect(unexpected, 'requests to production were attempted').toEqual([]);
    expect(blockedAllowances.filter((a) => !a.used).map((a) => String(a.re)), 'expectBlocked patterns that never matched').toEqual([]);
  },
  allowances: async ({}, use) => { await use([]); },
  expectError: async ({ allowances, pageErrors: _pageErrors }, use) => {
    await use((re) => { allowances.push({ re, used: false }); });
  },
  writeBodies: async ({}, use) => { await use(new Map()); },
  errorPages: async ({}, use) => { await use([]); },
  pageErrors: async ({ allowances, writeBodies, errorPages, blocked, allowBlockedWriteNoise }, use, testInfo) => {
    const errors: string[] = [];
    await use(errors);
    // Optional, may match zero times (the bug is intermittent); unlike expectError it never fails when unused.
    const known = splitKnownIssues(errors.map((text, i) => ({ text, pageId: errorPages[i] })), writeBodies);
    if (known.knownHit) testInfo.annotations.push({ type: 'known-app-issue', description: RACE_RESULTS_SEED_NOTE.replace('known-app-issue: ', '') });
    // Declared allowances are matched first, so the noise filter cannot swallow a line a test expects.
    let unexpected = known.remaining.map((r) => r.text).filter((e) => {
      const hits = allowances.filter((a) => a.re.test(e));
      hits.forEach((a) => { a.used = true; });
      return hits.length === 0;
    });
    if (allowBlockedWriteNoise) {
      const noise = dropBlockedWriteNoise(unexpected, blocked);
      if (noise.dropped) testInfo.annotations.push({ type: 'blocked-write-noise', description: `${noise.dropped} log line(s) from aborted writes` });
      unexpected = noise.remaining;
    }
    expect(unexpected, 'page errors or console.error during the test').toEqual([]);
    expect(allowances.filter((a) => !a.used).map((a) => String(a.re)), 'expectError patterns that never matched').toEqual([]);
  },
  memberPage: async ({ browser, viewport, isMobile, hasTouch, baseURL, watch }, use) => {
    const page = await openPage({ browser, viewport, isMobile, hasTouch, baseURL, watch }, 'member');
    await use(page);
    await page.context().close();
  },
  adminPage: async ({ browser, viewport, isMobile, hasTouch, baseURL, watch }, use) => {
    const page = await openPage({ browser, viewport, isMobile, hasTouch, baseURL, watch }, 'admin');
    await use(page);
    await page.context().close();
  },
  anonPage: async ({ browser, viewport, isMobile, hasTouch, baseURL, watch }, use) => {
    const page = await openPage({ browser, viewport, isMobile, hasTouch, baseURL, watch });
    await use(page);
    await page.context().close();
  },
});

export { expect };
```

- [ ] **Step 4: Verify**

Run: `npm --prefix e2e run harness`
Expected: `17 passed`.

Run: `npm run e2e:journeys -- journeys/auth-signin.spec.ts`
Expected: `7 passed, 1 skipped`.

Run: `npm --prefix e2e run typecheck`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add e2e/fixtures.ts e2e/harness/errors.spec.ts
```
```bash
git commit -m "fix(e2e): check console and page errors on the built-in page too

Refs: [E2E-08]"
```

---

### Task 5: Named preconditions (A4)

**Files:**
- Create: `e2e/lib/preconditions.ts`, `e2e/lib/preconditions.test.ts`, `e2e/lib/staging-state.ts`
- Modify: `e2e/fixtures.ts`, `e2e/journeys/auth-signin.spec.ts`, `e2e/journeys/signup.spec.ts`

**Interfaces:**
- Consumes: `getDoc`, `lookupUserByEmail` (`lib/staging-admin.ts`), `ADMIN_EMAIL`, `MEMBER_EMAIL` (`lib/identities.ts`).
- Produces: fixture `requires(...names: Precondition[]): Promise<void>`. Names: `maintenance-off`, `calendar-present`, `season-active`, `member-is-not-admin`, `member-dues-unpaid`, `admin-is-admin`.

- [ ] **Step 1: Write the failing test** — `e2e/lib/preconditions.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unmetPreconditions, type Precondition, type StagingState } from './preconditions.ts';

const good: StagingState = {
  season: { status: 'active' },
  calendar: { events: [{ id: 'bhr_27' }] },
  maintenance: { enabled: false },
  member: { duesPaidStatus: 'Unpaid' },
  admin: { isAdmin: true },
};
const all: Precondition[] = ['maintenance-off', 'calendar-present', 'season-active', 'member-is-not-admin', 'member-dues-unpaid', 'admin-is-admin'];
const names = (unmet: string[]) => unmet.map((u) => u.split(':')[0]);

test('a ready staging has nothing unmet, with or without a maintenance doc', () => {
  assert.deepEqual(unmetPreconditions(all, good), []);
  assert.deepEqual(unmetPreconditions(all, { ...good, maintenance: null }), []);
  // The app reads a missing duesPaidStatus as Unpaid (services/firestoreService.ts).
  assert.deepEqual(unmetPreconditions(all, { ...good, member: {} }), []);
});

test('each unmet precondition is named with what is wrong', () => {
  const broken: StagingState = {
    season: { status: 'archived' }, calendar: { events: [] }, maintenance: { enabled: true },
    member: { isAdmin: true, duesPaidStatus: 'Paid' }, admin: {},
  };
  const unmet = unmetPreconditions(all, broken);
  assert.deepEqual(names(unmet), all);
  assert.match(unmet[2], /status is "archived", expected "active"/);
});

test('missing documents are unmet, not crashes', () => {
  const empty: StagingState = { season: null, calendar: null, maintenance: null, member: null, admin: null };
  assert.deepEqual(names(unmetPreconditions(all, empty)), all.filter((n) => n !== 'maintenance-off'));
});

test('only the requested preconditions are checked', () => {
  assert.deepEqual(unmetPreconditions(['calendar-present'], { ...good, season: null }), []);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm run e2e:unit`
Expected: FAIL, `Cannot find module .../lib/preconditions.ts`.

- [ ] **Step 3: Implement** — `e2e/lib/preconditions.ts`

```ts
export type Doc = Record<string, unknown> | null;
export type StagingState = { season: Doc; calendar: Doc; maintenance: Doc; member: Doc; admin: Doc };

const NO_MEMBER = 'the e2e member has no users doc (run: npm run e2e:provision)';

// Each check returns null when met, otherwise what is wrong.
const CHECKS = {
  'maintenance-off': (s) => (s.maintenance?.enabled === true ? 'app_state/maintenance.enabled is true, so members see the red flag screen' : null),
  'calendar-present': (s) => { const events = s.calendar?.events; return Array.isArray(events) && events.length > 0 ? null : 'app_state/season_calendar has no events'; },
  'season-active': (s) => (s.season?.status === 'active' ? null : `season_config/current.status is "${s.season?.status ?? 'missing'}", expected "active"`),
  'member-is-not-admin': (s) => (!s.member ? NO_MEMBER : s.member.isAdmin === true ? 'the e2e member has isAdmin true' : null),
  // A missing field counts as unpaid, as it does in the app.
  'member-dues-unpaid': (s) => (!s.member ? NO_MEMBER : s.member.duesPaidStatus !== 'Paid' ? null : 'the e2e member duesPaidStatus is "Paid", so the dues sheet never opens'),
  'admin-is-admin': (s) => (s.admin?.isAdmin === true ? null : 'the e2e admin does not have isAdmin true (run: npm run e2e:provision)'),
} satisfies Record<string, (s: StagingState) => string | null>;

export type Precondition = keyof typeof CHECKS;

export const unmetPreconditions = (wanted: Precondition[], state: StagingState): string[] =>
  wanted.flatMap((name) => { const why = CHECKS[name](state); return why ? [`${name}: ${why}`] : []; });
```

- [ ] **Step 4: Run it and see it pass**

Run: `npm run e2e:unit`
Expected: `# pass 117`.

- [ ] **Step 5: Add the read** — `e2e/lib/staging-state.ts`

```ts
import { getDoc, lookupUserByEmail } from './staging-admin.ts';
import { ADMIN_EMAIL, MEMBER_EMAIL } from './identities.ts';
import type { StagingState } from './preconditions.ts';

const userDoc = async (email: string) => {
  const user = await lookupUserByEmail(email);
  return user ? getDoc(`users/${user.localId}`) : null;
};

let cached: Promise<StagingState> | null = null;

// Read once per worker: no journey changes these documents.
export function readStagingState(): Promise<StagingState> {
  cached ??= Promise.all([
    getDoc('season_config/current'), getDoc('app_state/season_calendar'), getDoc('app_state/maintenance'),
    userDoc(MEMBER_EMAIL), userDoc(ADMIN_EMAIL),
  ]).then(([season, calendar, maintenance, member, admin]) => ({ season, calendar, maintenance, member, admin }));
  return cached;
}
```

- [ ] **Step 6: Add the fixture** — in `e2e/fixtures.ts`

Add the imports:

```ts
import { unmetPreconditions, type Precondition } from './lib/preconditions.ts';
import { readStagingState } from './lib/staging-state.ts';
```

In `type Fixtures`, add after `anonPage: Page;`:

```ts
  requires: (...names: Precondition[]) => Promise<void>;
```

Add after the `anonPage` fixture:

```ts
  // Fails, never skips: a skip would read as green while the journey proved nothing.
  requires: async ({}, use) => {
    await use(async (...names) => {
      expect(unmetPreconditions(names, await readStagingState()), 'staging preconditions not met').toEqual([]);
    });
  },
```

- [ ] **Step 7: Use it**

In `e2e/journeys/auth-signin.spec.ts`, replace the first two tests with:

```ts
test('member lands signed in, with no Admin entry', async ({ memberPage, requires }) => {
  await requires('maintenance-off', 'calendar-present', 'member-is-not-admin');
  await memberPage.goto('/');
  await expect(stagingBadge(memberPage)).toBeVisible();
  await expect(memberPage.locator('#login-email')).toBeHidden();
  await expect(memberPage.getByText('Standings', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(adminEntry(memberPage)).toHaveCount(0);
});

test('admin lands signed in, with the Admin entry', async ({ adminPage, requires }) => {
  await requires('calendar-present', 'admin-is-admin');
  await adminPage.goto('/');
  await expect(stagingBadge(adminPage)).toBeVisible();
  await expect(adminEntry(adminPage)).toBeVisible();
});
```

In `e2e/journeys/signup.spec.ts`, change the test's parameters to `async ({ anonPage: page, requires }) => {` and add after the `test.setTimeout(...)` line:

```ts
    await requires('maintenance-off', 'calendar-present');
```

- [ ] **Step 8: Verify**

Run: `npm run e2e:journeys -- journeys/auth-signin.spec.ts`
Expected: `7 passed, 1 skipped`.

Run: `npm --prefix e2e run typecheck`
Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add e2e/lib/preconditions.ts e2e/lib/preconditions.test.ts e2e/lib/staging-state.ts e2e/fixtures.ts e2e/journeys/auth-signin.spec.ts e2e/journeys/signup.spec.ts
```
```bash
git commit -m "test(e2e): journeys name the staging precondition that is missing

Refs: [E2E-08]"
```

---

### Task 6: Spike A5 — a clock past a 2027 lock

**Question:** With the browser clock months ahead, do sign-in and Firestore listeners keep working, and does moving it across a lock lock the picks form?

**Files:**
- Modify: `e2e/lib/app.ts`, `e2e/fixtures.ts`
- Create: `e2e/spikes/lock-clock.spec.ts`

**Interfaces:**
- Produces: `SESSION_PIN_KEY` and `stampSession` in `lib/app.ts`. A test pins by writing its latest fake time to `localStorage` under both `SESSION_PIN_KEY` (used on the next load) and `SESSION_STORAGE_KEY` (read by the page already open) before moving the clock.

- [ ] **Step 1: Add the pin** — in `e2e/lib/app.ts`, add after the `THEME_STORAGE_KEY` line:

```ts
export const SESSION_PIN_KEY = 'e2e_session_pin';

// Runs in the page on every load and marks the session active. A test that moves the clock first
// stores its latest time under both keys, so the app's idle guard never sees a gap and signs out.
export const stampSession = ([key, pin]: string[]): void => {
  // about:blank has no storage, and the thrown error would fail the test.
  if (location.protocol.startsWith('http')) localStorage.setItem(key, localStorage.getItem(pin) ?? String(Date.now()));
};
```

In `e2e/fixtures.ts`, change the app import to:

```ts
import { authFile, guardContext, SESSION_PIN_KEY, SESSION_STORAGE_KEY, stampSession } from './lib/app.ts';
```

and replace the `addInitScript` line in `openPage`, with the comment above it, with:

```ts
  await context.addInitScript(stampSession, [SESSION_STORAGE_KEY, SESSION_PIN_KEY]);
```

- [ ] **Step 2: Write the spike** — `e2e/spikes/lock-clock.spec.ts`

```ts
import { test, expect } from '../fixtures.ts';
import { SESSION_PIN_KEY, SESSION_STORAGE_KEY } from '../lib/app.ts';
import { getDoc } from '../lib/staging-admin.ts';

const HALF_DAY = 12 * 60 * 60 * 1000;

type Schedule = { name?: string; hasSprint?: boolean; customLockAt?: string; sprintQualifying?: string; qualifying?: string };

// The first race of the staging season and its lock time, chosen the way App.tsx chooses it.
// Schedule times are league-local (New York). Reading one as UTC puts it 4 or 5 hours early,
// which the 12 hour margin on each side of the lock absorbs.
async function firstLock(): Promise<{ name: string; at: number }> {
  const calendar = await getDoc('app_state/season_calendar');
  const schedules = await getDoc('app_state/event_schedules');
  const events = (calendar?.events ?? []) as { id: string; name: string; round: number; hasSprint: boolean }[];
  const first = [...events].sort((a, b) => a.round - b.round)[0];
  const sched = (schedules?.[first?.id ?? ''] ?? {}) as Schedule;
  const hasSprint = sched.hasSprint ?? first?.hasSprint;
  const local = sched.customLockAt || (hasSprint ? sched.sprintQualifying || sched.qualifying : sched.qualifying);
  expect(local, 'the first race has a lock time in app_state/event_schedules').toBeTruthy();
  return { name: sched.name || first.name, at: Date.parse(local!.endsWith('Z') ? local! : `${local}Z`) };
}

test('spike A5: a clock months ahead keeps sign-in and listeners, and crossing a lock locks the form', async ({ memberPage, requires }) => {
  test.setTimeout(150_000);
  await requires('maintenance-off', 'calendar-present', 'season-active', 'member-is-not-admin');
  const lock = await firstLock();
  const before = lock.at - HALF_DAY;
  const after = lock.at + HALF_DAY;
  expect(before, 'the first lock is still in the future').toBeGreaterThan(Date.now());

  const refreshes: number[] = [];
  memberPage.on('response', (r) => { if (r.url().startsWith('https://securetoken.googleapis.com/')) refreshes.push(r.status()); });

  await memberPage.goto('/');
  await expect(memberPage.locator('#login-email')).toBeHidden({ timeout: 30_000 });
  // Both keys: the page already open checks the session stamp as soon as its clock jumps.
  await memberPage.evaluate(({ keys, at }) => keys.forEach((key) => localStorage.setItem(key, at)),
    { keys: [SESSION_PIN_KEY, SESSION_STORAGE_KEY], at: String(after) });
  await memberPage.clock.setFixedTime(before);
  await memberPage.goto('/race?view=picks');

  await expect(memberPage.getByRole('heading', { name: lock.name, exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(memberPage.getByText('Picks Open', { exact: true })).toBeVisible();
  await memberPage.waitForTimeout(20_000);
  await expect(memberPage.locator('#login-email')).toBeHidden();

  await memberPage.clock.setFixedTime(after);
  await expect(memberPage.getByRole('heading', { name: 'Picks Are Locked', exact: true })).toBeVisible({ timeout: 10_000 });
  // Shown only while editing, which needs a member with no saved picks for this race.
  await expect.soft(memberPage.getByText("Time's up! Picks for this event are now locked.")).toBeVisible();

  await memberPage.reload();
  await expect(memberPage.locator('#login-email')).toBeHidden({ timeout: 30_000 });
  // After the first lock the page selects the next race, which is still open.
  await expect(memberPage.getByText('Picks Open', { exact: true })).toBeVisible({ timeout: 30_000 });
  console.log(`[spike A5] before=${new Date(before).toISOString()} after=${new Date(after).toISOString()} token refresh responses: ${refreshes.join(',') || 'none'}`);
});
```

- [ ] **Step 3: Run it**

Run: `npm --prefix e2e run spikes -- spikes/lock-clock.spec.ts`
Expected: `3 passed` and one `[spike A5]` line. A failure is a finding, not something to force green.

- [ ] **Step 4: Run the other clock spike, which shares `openPage`**

Run: `npm --prefix e2e run spikes -- spikes/frozen-clock.spec.ts`
Expected: `3 passed`.

- [ ] **Step 5: Record the answer**

Append to `/Users/jhh/Codebase/jhh-ai/worklog/playwright-adoption.md` under a new heading `## E2E-08 batch 1`: pass or fail, the `[spike A5]` line, whether the soft toast check passed, and, if it failed, the failing step and the first error.

If it failed at sign-in or listeners, stop and report: J1 to J3 need another method (seeding a schedule is open decision 2).

Note for J1: after the lock, reach the locked race through the race selector, because a fresh load selects the next open race.

- [ ] **Step 6: Typecheck and commit**

Run: `npm --prefix e2e run typecheck`
Expected: no output.

```bash
git add e2e/lib/app.ts e2e/fixtures.ts e2e/spikes/lock-clock.spec.ts
```
```bash
git commit -m "test(e2e): spike a clock past the first 2027 lock

Refs: [E2E-08]"
```

---

### Task 7: J8 — a member cannot open admin screens

**Files:** Create `e2e/journeys/admin-access.spec.ts`.

**Interfaces:** Consumes `requires` (Task 5), `ADMIN_TOOLS` (`surfaces.ts`).

- [ ] **Step 1: Write the journey**

```ts
import { test, expect } from '../fixtures.ts';
import type { Page } from '@playwright/test';
import { adminEntry, stagingBadge } from '../lib/app.ts';
import { ADMIN_TOOLS } from '../surfaces.ts';

// Each admin screen's PageHeader title is its level-1 heading.
const HEADINGS: Record<(typeof ADMIN_TOOLS)[number], string> = {
  results: 'RACE RESULTS',
  'manage-users': 'MEMBERS',
  scoring: 'SCORING RULES',
  entities: 'DRIVERS & TEAMS',
  schedule: 'RACE SCHEDULE',
  invitations: 'INVITE CODES',
  database: 'DATABASE EDITOR',
  announcements: 'ANNOUNCEMENTS',
  season: 'SEASON CONTROL',
};
const SCREENS = [{ path: '/admin', heading: 'ADMIN' }, ...ADMIN_TOOLS.map((tool) => ({ path: `/admin?tool=${tool}`, heading: HEADINGS[tool] }))];

const screenHeading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true });
const homeSection = (page: Page) => page.getByRole('heading', { level: 2, name: 'Your Season', exact: true });

for (const screen of SCREENS) {
  test(`${screen.path} shows the admin screen to the admin and Home to a member`, async ({ adminPage, memberPage, requires }) => {
    test.setTimeout(60_000);
    await requires('maintenance-off', 'calendar-present', 'member-is-not-admin', 'admin-is-admin');

    // Control first: proves the heading can be found when the screen really renders.
    await adminPage.goto(screen.path);
    await expect(stagingBadge(adminPage)).toBeVisible();
    await expect(screenHeading(adminPage, screen.heading)).toBeVisible({ timeout: 20_000 });

    await memberPage.goto(screen.path);
    await expect(stagingBadge(memberPage)).toBeVisible();
    await expect(homeSection(memberPage)).toBeVisible({ timeout: 20_000 });
    await expect(screenHeading(memberPage, screen.heading)).toHaveCount(0);
    await expect(adminEntry(memberPage)).toHaveCount(0);
  });
}
```

- [ ] **Step 2: Run it**

Run: `npm run e2e:journeys -- journeys/admin-access.spec.ts`
Expected: `22 passed`.

- [ ] **Step 3: See it fail with the gate broken**

In the worktree's `App.tsx`, under `case 'admin':`, change `if (!isUserAdmin(user)) {` to `if (false) {`.
Run: `npm run e2e:journeys -- journeys/admin-access.spec.ts`
Expected: the member half fails (Home heading not found) on both projects. The run is read-only and a member's admin writes are denied by the rules.

- [ ] **Step 4: Revert and confirm**

```bash
git checkout -- App.tsx
```
```bash
git status --short
```
Expected: only `?? e2e/journeys/admin-access.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add e2e/journeys/admin-access.spec.ts
```
```bash
git commit -m "test(e2e): a member who opens an admin URL gets Home

Refs: [E2E-08]"
```

---

### Task 8: J13 — retired URLs

**Files:** Create `e2e/lib/redirects.ts`, `e2e/lib/redirects.test.ts`, `e2e/journeys/redirects.spec.ts`.

**Interfaces:** Produces `REDIRECTS: Record<string, string>` (e2e mirror of `routes.ts`).

- [ ] **Step 1: Write the failing drift test** — `e2e/lib/redirects.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REDIRECTS } from './redirects.ts';
import { REPO_ROOT } from './paths.ts';

test('the mirrored redirects match routes.ts', () => {
  const source = readFileSync(join(REPO_ROOT, 'routes.ts'), 'utf8');
  const block = /export const REDIRECTS: Record<string, string> = \{([\s\S]*?)\n\};/.exec(source)?.[1];
  assert.ok(block, 'REDIRECTS block not found in routes.ts');
  const actual = Object.fromEntries([...block.matchAll(/'([^']+)':\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(REDIRECTS, actual);
});
```

Run: `npm run e2e:unit` — expected: FAIL, `Cannot find module .../lib/redirects.ts`.

- [ ] **Step 2: Add the mirror** — `e2e/lib/redirects.ts`

```ts
// Mirrors REDIRECTS in routes.ts; lib/redirects.test.ts fails when the two drift.
export const REDIRECTS: Record<string, string> = {
  '/picks': '/race?view=picks',
  '/schedule': '/race?view=weekend',
  '/gp-results': '/race?view=results',
  '/leaderboard': '/standings',
  '/points': '/standings?rules=1',
  '/drivers-teams': '/league',
  '/donate': '/league',
  '/support': '/league',
  '/dues': '/league?dues=1',
};
```

Run: `npm run e2e:unit` — expected: `# pass 118`.

- [ ] **Step 3: Write the journey** — `e2e/journeys/redirects.spec.ts`

```ts
import { test, expect } from '../fixtures.ts';
import type { Locator, Page } from '@playwright/test';
import { stagingBadge } from '../lib/app.ts';
import { REDIRECTS } from '../lib/redirects.ts';

type Marker = (page: Page) => Locator;
const tab = (name: string): Marker => (page) => page.getByRole('tab', { name, exact: true, selected: true });
const title = (name: string): Marker => (page) => page.getByRole('heading', { level: 1, name, exact: true });

// Something only the target surface shows, so a matching URL over the wrong page still fails.
const SHOWS: Record<string, Marker> = {
  '/race?view=picks': tab('Picks'),
  '/race?view=weekend': tab('Weekend'),
  '/race?view=results': tab('Results'),
  '/standings': title('LEAGUE STANDINGS'),
  '/standings?rules=1': (page) => page.getByRole('dialog', { name: 'Scoring Rules' }),
  '/league': title('LEAGUE'),
  '/league?dues=1': (page) => page.getByRole('dialog').getByRole('heading', { name: 'Pay League Dues', exact: true }),
};

for (const [from, to] of Object.entries(REDIRECTS)) {
  test(`${from} lands on ${to}`, async ({ memberPage, requires }) => {
    // Only the dues sheet depends on dues status; the other redirects must not fail on it.
    await requires('maintenance-off', 'calendar-present', 'member-is-not-admin', ...(to === '/league?dues=1' ? ['member-dues-unpaid' as const] : []));
    await memberPage.goto(from);
    await expect(stagingBadge(memberPage)).toBeVisible();
    await expect.poll(() => { const u = new URL(memberPage.url()); return u.pathname + u.search; }).toBe(to);
    await expect(SHOWS[to](memberPage)).toBeVisible({ timeout: 20_000 });
  });
}
```

- [ ] **Step 4: Run it**

Run: `npm run e2e:journeys -- journeys/redirects.spec.ts`
Expected: `20 passed`. The dues test opens the sheet and clicks nothing.

- [ ] **Step 5: See it fail**

In the worktree's `routes.ts`, delete the line `'/dues': '/league?dues=1',`.
Run: `npm run e2e:journeys -- journeys/redirects.spec.ts`
Expected: `/dues lands on /league?dues=1` fails on both projects.
Run: `npm run e2e:unit` — expected: the drift test fails.

- [ ] **Step 6: Revert and confirm**

```bash
git checkout -- routes.ts
```
```bash
git status --short
```
Expected: only the three new `e2e/` files.

Run: `npm --prefix e2e run typecheck`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add e2e/lib/redirects.ts e2e/lib/redirects.test.ts e2e/journeys/redirects.spec.ts
```
```bash
git commit -m "test(e2e): retired URLs land on their replacements

Refs: [E2E-08]"
```

---

### Task 9: J14 — signed out shows only sign-in

**Files:** Create `e2e/journeys/signed-out.spec.ts`.

- [ ] **Step 1: Write the journey**

```ts
import { test, expect } from '../fixtures.ts';
import { adminEntry, stagingBadge } from '../lib/app.ts';
import { ADMIN_TOOLS } from '../surfaces.ts';

const PATHS = ['/', '/race?view=picks', '/standings', '/league', '/league?dues=1', '/profile', '/admin',
  ...ADMIN_TOOLS.map((tool) => `/admin?tool=${tool}`)];
// Display names of the two provisioned accounts: member data that must never render signed out.
const MEMBER_NAMES = /E2E (Member|Admin)/;
const APP_HEADINGS = /^(ADMIN|MEMBERS|DATABASE EDITOR|LEAGUE STANDINGS|LEAGUE|PROFILE|Your Season)$/;

test('control: a signed-in member does see member names', async ({ memberPage, requires }) => {
  await requires('maintenance-off', 'calendar-present');
  await memberPage.goto('/standings');
  await expect(memberPage.getByText(MEMBER_NAMES).filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
});

for (const path of PATHS) {
  test(`signed out, ${path} shows only sign-in`, async ({ anonPage }) => {
    await anonPage.goto(path);
    await expect(stagingBadge(anonPage)).toBeVisible();
    await expect(anonPage.locator('#login-email')).toBeVisible();
    // Absence only means something once a late data render has had its chance to appear.
    await anonPage.waitForTimeout(1_500);
    await expect(anonPage.getByText(MEMBER_NAMES)).toHaveCount(0);
    await expect(anonPage.getByRole('heading', { name: APP_HEADINGS })).toHaveCount(0);
    await expect(adminEntry(anonPage)).toHaveCount(0);
    await expect(anonPage.getByRole('button', { name: 'Log In', exact: true })).toBeVisible();
  });
}
```

- [ ] **Step 2: Run it**

Run: `npm run e2e:journeys -- journeys/signed-out.spec.ts`
Expected: `36 passed`. No test here signs in, so the throttle is not touched.

- [ ] **Step 3: See it fail**

In the worktree's `App.tsx`, inside `const authFlow = (`, add `<p>E2E Member</p>` on the line before `<AuthScreen />`.
Run: `npm run e2e:journeys -- journeys/signed-out.spec.ts`
Expected: all 16 signed-out paths fail on both projects with a count of 1; the control passes.

- [ ] **Step 4: Revert and confirm**

```bash
git checkout -- App.tsx
```
```bash
git status --short
```
Expected: only `?? e2e/journeys/signed-out.spec.ts`.

Run: `npm --prefix e2e run typecheck`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add e2e/journeys/signed-out.spec.ts
```
```bash
git commit -m "test(e2e): signed-out visitors see only sign-in

Refs: [E2E-08]"
```

---

### Task 10: Spike J12 — recovery from failed first reads

**Question:** Does aborting Firestore reproduce the rejected first read, and do Home and Standings recover without a reload?

**Files:**
- Create: `e2e/lib/firestore-outage.ts`, `e2e/spikes/first-read-failure.spec.ts`
- Modify: `e2e/harness/guards.spec.ts`

**Interfaces:** Produces `firestoreOutage(page: Page): Promise<{ restore(): void; aborted(): number }>`.

- [ ] **Step 1: Write the failing guard proof**

In `e2e/harness/guards.spec.ts`, add the import `import { firestoreOutage } from '../lib/firestore-outage.ts';` and append:

```ts
test('after a Firestore outage ends, requests still go through the guard', async ({ memberPage, blocked, expectError }) => {
  expectError(/^console\.error: /);
  // No rule matches this collection and the fetch carries no token, so it cannot write even unguarded.
  const probe = 'https://firestore.googleapis.com/v1/projects/formula-fantasy-staging/databases/(default)/documents/e2e_probe/x';
  const outage = await firestoreOutage(memberPage);
  await memberPage.goto('/');
  outage.restore();
  const result = await memberPage.evaluate((url) => fetch(url, { method: 'PATCH', body: '{}' }).then(() => 'sent', () => 'aborted'), probe);
  expect(result).toBe('aborted');
  expect(blocked.some((b) => b.startsWith('WRITE PATCH') && b.includes('e2e_probe'))).toBe(true);
});
```

Run: `npm --prefix e2e run harness -- harness/guards.spec.ts` — expected: FAIL, module not found.

- [ ] **Step 2: Implement** — `e2e/lib/firestore-outage.ts`

```ts
import type { Page } from '@playwright/test';

export type Outage = { restore: () => void; aborted: () => number };

// Fails every Firestore request from this page until restore(). Afterwards it falls back, never
// continues, so the context's request guard still sees everything.
export async function firestoreOutage(page: Page): Promise<Outage> {
  let down = true;
  let aborted = 0;
  await page.route('https://firestore.googleapis.com/**', (route) => {
    if (!down) return route.fallback();
    aborted++;
    return route.abort('internetdisconnected');
  });
  return { restore: () => { down = false; }, aborted: () => aborted };
}
```

Run: `npm --prefix e2e run harness -- harness/guards.spec.ts` — expected: all pass.

- [ ] **Step 3: Write the spike** — `e2e/spikes/first-read-failure.spec.ts`

```ts
import { test, expect } from '../fixtures.ts';
import { LOADING_PLACEHOLDER } from '../lib/capture.ts';
import { firestoreOutage } from '../lib/firestore-outage.ts';
import { redactKey } from '../lib/guards.ts';

// App.tsx logs this when the one-shot league read rejects.
const LEAGUE_READ_FAILED = 'Failed to fetch leaderboard data';

for (const path of ['/', '/standings']) {
  test(`spike J12: ${path} recovers without reload after the first Firestore reads fail`, async ({ memberPage, expectError, requires }) => {
    test.setTimeout(150_000);
    await requires('maintenance-off', 'calendar-present', 'member-is-not-admin');
    // An outage logs errors by design; they are printed below instead of failing the spike.
    expectError(/^(console\.error|pageerror): /);
    const seen: string[] = [];
    memberPage.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') seen.push(`${m.type()}: ${redactKey(m.text()).slice(0, 160)}`); });
    let loads = 0;
    memberPage.on('load', () => { loads++; });

    const outage = await firestoreOutage(memberPage);
    await memberPage.goto(path);
    await expect.poll(() => seen.some((t) => t.includes(LEAGUE_READ_FAILED)), { message: 'the league read failed during the outage', timeout: 45_000 }).toBe(true);
    outage.restore();
    const restoredAt = Date.now();
    await expect(memberPage.getByText('E2E Member').filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    await expect(memberPage.locator(LOADING_PLACEHOLDER).filter({ visible: true })).toHaveCount(0, { timeout: 20_000 });
    expect(loads, 'recovered without a reload').toBe(1);
    console.log(`[spike J12] ${path}: recovered ${Date.now() - restoredAt} ms after restore; ${outage.aborted()} requests aborted`);
    console.log([...new Set(seen)].join('\n'));
  });
}
```

- [ ] **Step 4: Run it**

Run: `npm --prefix e2e run spikes -- spikes/first-read-failure.spec.ts`
Expected: `4 passed`. If "the league read failed during the outage" times out, aborting does not reproduce the rejection: that is the finding. Record it and skip step 5.

- [ ] **Step 5: See it fail with the retry removed**

In the worktree's `App.tsx`, change `if (await loadLeaderboard() || cancelled) return;` to `if (await loadLeaderboard() || cancelled || true) return;`.
Run: `npm --prefix e2e run spikes -- spikes/first-read-failure.spec.ts`
Expected: both J12 tests fail waiting for `E2E Member`.

```bash
git checkout -- App.tsx
```
```bash
git status --short
```
Expected: only `e2e/` files.

- [ ] **Step 6: Record, typecheck, commit**

Under `## E2E-08 batch 1` in the worklog, record: whether the failure reproduced, recovery times, whether the retry removal turned it red, and the distinct log lines. State whether J12 can become a journey and which error lines it must allow.

Run: `npm --prefix e2e run typecheck`
Expected: no output.

```bash
git add e2e/lib/firestore-outage.ts e2e/spikes/first-read-failure.spec.ts e2e/harness/guards.spec.ts
```
```bash
git commit -m "test(e2e): spike recovery from failed first Firestore reads

Refs: [E2E-08]"
```

---

### Task 11: Spike J9 — offline start queues no default writes

**Question:** Can the harness tell which documents the app tries to write while still blocking every write, and does a member who starts offline queue any `app_state` default?

**Why this needs code:** A blocked Write channel never gets past its handshake, so the document path is never sent. Letting only the handshake through (it names the database and nothing else) makes the next message, which names the documents, observable. That message is still aborted. All tests here use `memberPage`: the rules deny a member's `app_state` writes.

**Files:**
- Create: `e2e/spikes/offline-seed.spec.ts`, `e2e/lib/write-channel.ts`, `e2e/lib/write-channel.test.ts`
- Modify: `e2e/lib/app.ts`, `e2e/fixtures.ts`, `e2e/harness/guards.spec.ts`

**Interfaces:** Produces `writeChannelMessages(body): Record<string, unknown>[] | null`, `isWriteHandshakeOnly(body): boolean`, `appStateDocsIn(bodies): string[]`, and the fixture option `observeWrites` (default `false`).

- [ ] **Step 1: Observe the blocked message shape** — `e2e/spikes/offline-seed.spec.ts`

```ts
import { test, expect } from '../fixtures.ts';

test('spike J9 step 1: what a blocked Write channel sends', async ({ memberPage, writeBodies }) => {
  await memberPage.goto('/');
  await expect.poll(() => [...writeBodies.values()].flat().length, { timeout: 30_000 }).toBeGreaterThan(0);
  // Field names only: these bodies can carry the member's token. An unknown key is not printed,
  // because a body that is not form-encoded would turn up whole as one key.
  const shapes = [...writeBodies.values()].flat().map((body) => [...new URLSearchParams(body)].map(([key, value]) => {
    if (/^(count|ofs|headers)$/.test(key)) return key;
    if (!/^req\d+___data__$/.test(key)) return '(unexpected key)';
    try { return `${key}{${Object.keys(JSON.parse(value)).join(',')}}`; } catch { return `${key}{unparsed}`; }
  }).join(' '));
  console.log([...new Set(shapes)].join('\n'));
});
```

Run: `npm --prefix e2e run spikes -- spikes/offline-seed.spec.ts`
Expected: lines like `count ofs req0___data__{database}`, possibly with `headers` first.

**Gate:** if `(unexpected key)` appears, or the handshake message has any field besides `database`, stop and report. Do not widen the rule below without the user's review. If the poll times out instead, the app attempted no write (staging may now have race results): stop and report.

- [ ] **Step 2: Write the failing unit test** — `e2e/lib/write-channel.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appStateDocsIn, isWriteHandshakeOnly } from './write-channel.ts';

const DB = 'projects/formula-fantasy-staging/databases/(default)';
const body = (messages: unknown[], extra: Record<string, string> = {}) => new URLSearchParams({
  ...extra, count: String(messages.length), ofs: '0',
  ...Object.fromEntries(messages.map((m, i) => [`req${i}___data__`, JSON.stringify(m)])),
}).toString();
const write = (doc: string) => ({ streamToken: 'abc', writes: [{ update: { name: `${DB}/documents/${doc}`, fields: {} } }] });

test('a handshake that only names the staging database is recognised', () => {
  assert.equal(isWriteHandshakeOnly(body([{ database: DB }])), true);
  assert.equal(isWriteHandshakeOnly(body([{ database: DB }], { headers: 'Authorization: x' })), true);
});

test('anything that could carry a write is not a handshake', () => {
  assert.equal(isWriteHandshakeOnly(body([write('app_state/scoring_config')])), false);
  assert.equal(isWriteHandshakeOnly(body([{ database: DB }, write('app_state/form_locks')])), false);
  assert.equal(isWriteHandshakeOnly(body([{ database: DB, writes: [] }])), false);
  assert.equal(isWriteHandshakeOnly(body([{ database: 'projects/other/databases/(default)' }])), false);
  assert.equal(isWriteHandshakeOnly(body([{ database: DB }], { surprise: '1' })), false);
  assert.equal(isWriteHandshakeOnly(`count=2&ofs=0&req0___data__=${encodeURIComponent(JSON.stringify({ database: DB }))}`), false);
  assert.equal(isWriteHandshakeOnly(`${body([write('userPicks/u1')])}&req0___data__=${encodeURIComponent(JSON.stringify({ database: DB }))}`), false);
  assert.equal(isWriteHandshakeOnly('count=1&ofs=0&req0___data__=not-json'), false);
  assert.equal(isWriteHandshakeOnly(''), false);
});

test('app_state documents named by writes are listed once each', () => {
  const bodies = [
    body([write('app_state/scoring_config'), write('app_state/race_results')]),
    body([{ writes: [{ delete: `${DB}/documents/app_state/form_locks` }] }]),
    body([write('userPicks/u1')]),
    body([write('app_state/race_results')]),
  ];
  assert.deepEqual(appStateDocsIn(bodies), ['form_locks', 'race_results', 'scoring_config']);
});
```

Run: `npm run e2e:unit` — expected: FAIL, module not found.

- [ ] **Step 3: Implement** — `e2e/lib/write-channel.ts`

```ts
import { STAGING_PROJECT } from './guards.ts';

const MESSAGE = /^req\d+___data__$/;
const ENVELOPE = new Set(['count', 'ofs', 'headers']);

// A Firestore Write channel POST is form-encoded: count, ofs and one reqN___data__ JSON per
// message. Returns null for anything else, so callers fail closed.
export function writeChannelMessages(body: string): Record<string, unknown>[] | null {
  const params = new URLSearchParams(body);
  const messages: Record<string, unknown>[] = [];
  for (const [key, value] of params) {
    if (ENVELOPE.has(key)) continue;
    if (!MESSAGE.test(key)) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
      messages.push(parsed as Record<string, unknown>);
    } catch { return null; }
  }
  return messages.length > 0 && Number(params.get('count')) === messages.length ? messages : null;
}

// A handshake names the database and nothing else, so it cannot change data.
export function isWriteHandshakeOnly(body: string): boolean {
  const prefix = `projects/${STAGING_PROJECT}/`;
  return writeChannelMessages(body)?.every((m) => Object.keys(m).length === 1 && typeof m.database === 'string' && m.database.startsWith(prefix)) ?? false;
}

const APP_STATE = /\/documents\/app_state\/([A-Za-z0-9_-]+)/g;

export function appStateDocsIn(bodies: string[]): string[] {
  const names = bodies.flatMap((body) => [...JSON.stringify(writeChannelMessages(body) ?? []).matchAll(APP_STATE)].map((m) => m[1]));
  return [...new Set(names)].sort();
}
```

Run: `npm run e2e:unit` — expected: `# pass 121`.

- [ ] **Step 4: Write the failing guard proof** — append to `e2e/harness/guards.spec.ts`

```ts
test.describe('observing writes', () => {
  test.use({ observeWrites: true });

  test('a Write channel message that carries a write is still aborted', async ({ memberPage, blocked, expectError }) => {
    expectError(ABORTED_REQUEST_LOG);
    await memberPage.goto('/');
    const result = await memberPage.evaluate(() => {
      const message = { writes: [{ delete: 'projects/formula-fantasy-staging/databases/(default)/documents/e2e_probe/x' }] };
      const body = new URLSearchParams({ count: '1', ofs: '1', req0___data__: JSON.stringify(message) });
      return fetch('https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?e2e=probe', { method: 'POST', body })
        .then(() => 'sent', () => 'aborted');
    });
    expect(result).toBe('aborted');
    expect(blocked.some((b) => b.includes('e2e=probe'))).toBe(true);
  });
});
```

Run: `npm --prefix e2e run typecheck` — expected: an error that `observeWrites` is not a known option.

- [ ] **Step 5: Wire the option**

In `e2e/lib/app.ts`, add the import:

```ts
import { isWriteHandshakeOnly } from './write-channel.ts';
```

Change the `opts` type of `guardContext` to:

```ts
  opts: { readOnly: boolean; blocked: string[]; writeBodies?: string[]; allowWriteHandshake?: boolean },
```

Replace the `if (opts.readOnly && ...)` line with:

```ts
    if (opts.readOnly && isWriteRequest(req.url(), req.method())) {
      // The handshake is let through only for tests that need to see which documents a write names.
      if (opts.allowWriteHandshake && req.url().includes('/google.firestore.v1.Firestore/Write/') && isWriteHandshakeOnly(req.postData() ?? '')) return route.continue();
      opts.blocked.push(`WRITE ${req.method()} ${req.url()}`); return route.abort('blockedbyclient');
    }
```

In `e2e/fixtures.ts`:
- add `observeWrites: boolean;` to both `type Watch` and `type Fixtures`;
- add `observeWrites: [false, { option: true }],` after the `allowBlockedWriteNoise` option;
- replace the `watch` fixture with:

```ts
  watch: async ({ readOnly, observeWrites, blocked, writeBodies, pageErrors, errorPages }, use) => {
    await use({ readOnly, observeWrites, blocked, writeBodies, pageErrors, errorPages });
  },
```

- in `watchContext`, replace the `guardContext` call with:

```ts
  await guardContext(context, { readOnly: watch.readOnly, blocked: watch.blocked, writeBodies: bodies, allowWriteHandshake: watch.observeWrites });
```

Run: `npm --prefix e2e run typecheck` — expected: no output.
Run: `npm --prefix e2e run harness` — expected: `19 passed`. With the handshake allowed, the Firestore SDK may log an error line that no earlier run showed. If the new proof fails on one, add an `expectError` for that exact line and record it in the worklog; do not use a catch-all here.

- [ ] **Step 6: Add the offline-start spike** — in `e2e/spikes/offline-seed.spec.ts`, add the imports

```ts
import { firestoreOutage } from '../lib/firestore-outage.ts';
import { appStateDocsIn, writeChannelMessages } from '../lib/write-channel.ts';
```

and append:

```ts
test.describe('writes observed', () => {
  test.use({ observeWrites: true });

  test('spike J9: a member who starts offline queues no app_state default', async ({ memberPage, writeBodies, expectError, requires }) => {
    test.setTimeout(150_000);
    await requires('maintenance-off', 'calendar-present', 'member-is-not-admin');
    expectError(/^(console\.error|pageerror): /);
    const outage = await firestoreOutage(memberPage);
    await memberPage.goto('/');
    await memberPage.waitForTimeout(15_000);
    outage.restore();
    await expect(memberPage.getByText('E2E Member').filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    await memberPage.waitForTimeout(15_000);
    const bodies = [...writeBodies.values()].flat();
    const docs = appStateDocsIn(bodies);
    console.log(`[spike J9] app_state docs named by writes: ${docs.join(', ') || 'none'}; unreadable bodies: ${bodies.filter((b) => writeChannelMessages(b) === null).length}`);
    expect(docs.filter((d) => d !== 'race_results'), 'an offline start must not write app_state defaults').toEqual([]);
    // Proof that writes are observable: [PROD-11] seeds race_results while staging has no results.
    expect(docs).toContain('race_results');
  });
});
```

Run: `npm --prefix e2e run spikes -- spikes/offline-seed.spec.ts`
Expected: `4 passed` and `app_state docs named by writes: race_results`. If nothing is observable, record that and skip step 7.

- [ ] **Step 7: See it fail with one offline guard removed**

In the worktree's `App.tsx`, in the `scoring_config` listener, change

```ts
            } else if (!fromCache) {
                saveScoringSettings(defaultSettings);
```

to

```ts
            } else {
                saveScoringSettings(defaultSettings);
```

Staging has a `scoring_config`, so only the offline snapshot reaches this branch.
Run: `npm --prefix e2e run spikes -- spikes/offline-seed.spec.ts`
Expected: the J9 test fails listing `scoring_config`. The write is aborted, and the rules would deny it to a member.

```bash
git checkout -- App.tsx
```
```bash
git status --short
```
Expected: only `e2e/` files.

- [ ] **Step 8: Record and commit**

Under `## E2E-08 batch 1` in the worklog, record: the message shape from step 1, the `[spike J9]` line, and whether removing the guard turned it red. State whether J9 and J10 can become journeys. If writes were not observable, record the fallback: after [PROD-11] is fixed, assert that no Write channel request happens at all.

```bash
git add e2e/lib/write-channel.ts e2e/lib/write-channel.test.ts e2e/lib/app.ts e2e/fixtures.ts e2e/harness/guards.spec.ts e2e/spikes/offline-seed.spec.ts
```
```bash
git commit -m "test(e2e): spike which documents an offline start tries to write

Refs: [E2E-08]"
```

---

### Task 12: Document, prove and report

**Files:** Modify `e2e/README.md`.

- [ ] **Step 1: README, first paragraph** — replace the sentence that starts `Read-only mode` with:

```markdown
Runs are read-only by default: Firestore writes and callables are aborted. A spec that writes
needs `test.use({ readOnly: false })`, the `@write` tag and `E2E_WRITES=1`. `page.request`,
`context.request` and `route.fetch` are closed because request routing cannot see them.
```

- [ ] **Step 2: README, `## Running`** — replace the code block with:

````markdown
```bash
npm run e2e:unit                                   # pure unit tests, no network
npm run e2e:journeys                               # read-only journeys, local Vite (--mode staging) on :3100
E2E_BASE_URL=https://f1.staging.carolinaminted.net npm run e2e:journeys
npm --prefix e2e run harness                       # proofs that guards, error checks and gates work
npm --prefix e2e run spikes -- spikes/<file>       # open questions; may be slow or fail
E2E_WRITES=1 npm run e2e:journeys -- journeys/signup.spec.ts   # writes to staging, sends mail
E2E_WRITES=1 E2E_REAL_MAIL=1 npm run e2e:journeys -- journeys/signup.spec.ts
npm run e2e:teardown                               # sweep throwaway accounts older than 1 hour
npm run e2e:teardown -- --email=<run address>      # delete one run's account, invite and docs now
```

| Group | Covers |
| --- | --- |
| `journeys/auth-signin` | member and admin land signed in; unknown account is refused |
| `journeys/admin-access` | every admin URL: the screen for the admin, Home for a member |
| `journeys/redirects` | each retired URL lands on its replacement |
| `journeys/signed-out` | signed out, every URL shows only sign-in |
| `journeys/signup` (`@write`) | invite, email code, registration |

A journey calls `requires(...)` first and fails naming any staging precondition that is not met
(`lib/preconditions.ts`). Those checks read staging through `gcloud` impersonation of the harness
service account, so an expired `gcloud` login fails every journey: log in again, then rerun.
````

- [ ] **Step 3: README, remaining sections**

In `## Console and request allowances`, after the first sentence add: `This covers every context, including the built-in page.`

In `## Sign-up journey`, replace `Desktop only.` with `Desktop only, and only with E2E_WRITES=1.`

Replace the `## Clock` section body with:

```markdown
`page.clock.setFixedTime` works with the Firestore listeners (see `spikes/frozen-clock.spec.ts`).
Before moving the clock far ahead, store the latest fake time in `localStorage` under both
`SESSION_PIN_KEY` and `SESSION_STORAGE_KEY`, or the app's idle guard signs the session out (see
`spikes/lock-clock.spec.ts`).
```

Replace the `Plan:` line with: `Plans: e2e/PLAN.md, e2e/PLAN-2.md, e2e/PLAN-E2E-08.md. Specs: the [E2E-00] and [E2E-08] tracker pages.`

- [ ] **Step 4: Full verification**

| Command | Expected |
| --- | --- |
| `npm run e2e:unit` | `# pass 121`, `# fail 0` |
| `npm --prefix e2e run typecheck` | no output |
| `npm --prefix e2e run harness` | `19 passed` |
| `npm run lint` | no errors |

- [ ] **Step 5: Three journey runs in a row**

Run `npm run e2e:journeys` three times, one after another, with no code change between them. A run may take longer than the 10 minute foreground limit, so run it in the background.
Expected each time: `79 passed, 1 skipped`. Any failure resets the count: fix the cause, then start at run 1.

- [ ] **Step 6: Capture still works**

Run: `npm run e2e:compare -- --surfaces home,admin`
Expected: `0 failed, 0 missing`. App code is the same on both sides, so `changed` should be 0; open the gallery if not.

- [ ] **Step 7: Nothing outside `e2e/` changed**

Run: `git diff --stat staging -- . ':(exclude)e2e'`
Expected: only `.dockerignore`, `.gitignore`, `package.json`, `tsconfig.json`, as before this plan.

- [ ] **Step 8: Commit**

```bash
git add e2e/README.md
```
```bash
git commit -m "docs(e2e): read-only default, test groups and preconditions

Refs: [E2E-08]"
```

- [ ] **Step 9: Records**

Add to the worklog section: the three run results and the commit range. On the [E2E-08] row, add the commit range to `Commits` and the verification results and spike answers to `Evidence`. Status stays `In Progress`: J1 to J7, J9 to J12, J15, J16 and A6 to A8 remain.

- [ ] **Step 10: Ask before pushing**

Show the user the commit list and the three spike answers. Push `feat/e2e-harness` only after they confirm.
