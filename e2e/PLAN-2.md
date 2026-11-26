# E2E Capture and A/B Compare Implementation Plan (plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Screenshot every Lights Out League surface on staging in read-only mode, then compare two versions of the code against the same live data with one frozen clock, and write a diff gallery plus `report.json` that a person or agent can triage.

**Architecture:** A surface manifest (`e2e/surfaces.ts`) lists 26 surfaces with their role and entry component. `capture.spec.ts` generates one read-only test per surface × theme × side, interleaved so the base and head shots of a surface are taken seconds apart, in two Chromium projects (desktop and mobile). `scripts/compare.ts` resolves base and head (a git ref becomes a detached worktree outside the repo, the default head is this checkout, a URL must be staging), serves each with Vite `--mode staging` on 3101 and 3100, runs the capture once with a shared `E2E_FROZEN_AT`, then diffs with `pixelmatch` and writes `e2e-results/<run>/index.html` and `report.json`. Incremental selection follows each entry component's import graph; shared files and files no surface imports select everything.

**Tech Stack:** `@playwright/test` ~1.63.0 (already installed), `pixelmatch`, `pngjs`, `picomatch`, `diff` (new e2e devDependencies), Node 22 `node:test` with `--experimental-transform-types`, git worktrees.

**Spec:** the [E2E-00] page body in the Notion tracker **🏁 Lights Out League** (sections "Core approach: same-moment A/B capture", "How a comparison runs", "Guards" and "Verification (at [E2E-04])"), plus the done-when lines on [E2E-03] and [E2E-04]. Plan 1 (`e2e/PLAN.md`), `e2e/README.md` and `/Users/jhh/Codebase/jhh-ai/worklog/playwright-adoption.md` record what this builds on. Executors read all of them.

**Plan 3 (written when this one is green):** picks, profile, dues view, admin tour, password reset and release integration ([E2E-05], [E2E-06]).

## Global Constraints

- **Staging only.** Allowed hosts: `127.0.0.1`, `localhost`, `f1.staging.carolinaminted.net`. Forbidden anywhere: `formula-fantasy-1`, `lights-out-league-prod`, `lights-out-league-web`, host `f1.carolinaminted.net`. The plan 1 guards stay as they are. Nothing in this plan loosens them.
- **No app code changes.** Only `e2e/**` and the root `package.json` `e2e:*` scripts change. Task 11 makes temporary probe edits to app files to prove detection. They are never committed, are reverted in the same step, and `git status --short` must show no app file afterwards.
- **No merge to `staging`** before HO-2 has shipped and [ROLL-06] closes (Dec 13). Work stays on `feat/e2e-harness` in `/Users/jhh/Codebase/jhh-ai/.worktrees/lol-e2e-harness`.
- **Capture is read-only** (`readOnly: true`): it writes nothing to staging and never clicks. Approval 5 (routine journey writes on the e2e member and `+run-*` accounts) is not needed for capture. Any step that would write to staging is a stop: ask the user.
- **Frozen clock:** `page.clock.setFixedTime(new Date(E2E_FROZEN_AT))` before the first navigation. One timestamp per run, shared by both sides. Never `clock.install`.
- **Sign-in throttle:** Firebase throttles password sign-ins per account. This plan runs no sign-in or sign-up spec. Capture signs in only through the `setup` project, which reuses a session younger than 30 minutes. If setup ever reports "Invalid email or password", stop. Probe at most every 5 minutes, and never loop. Sign-up runs stay at most 3 in any 10 minutes (this plan runs none).
- **Visual diffs inform and never fail a run.** Hard failures: a console error or uncaught page error, page overflow, a missing STAGING badge, a guard trip, a capture timeout. WebKit (`--full`) failures are warnings.
- **No committed images or run artifacts.** Everything lands under `e2e-results/` (gitignored). Base worktrees live outside the repo at `/Users/jhh/Codebase/jhh-ai/.worktrees/lol-e2e-base-<sha12>`.
- **Isolation:** `e2e/` has its own lockfile. The root `package-lock.json` must stay byte-identical to `staging`'s. `npm run lint`, `npm test` and `npm run build -- --mode staging` must still pass, and `dist/` must contain nothing from `e2e/`.
- **e2e imports no app code.** Values mirrored from the app (`ADMIN_TOOLS`, standings views) are re-declared and pinned by drift tests that read the app source as text.
- **Git in this worktree session:** one git command per Bash call (the worktree guard refuses compound git commands). Commits end with `Refs: [E2E-03]` or `Refs: [E2E-04]` plus the `Co-Authored-By` trailer. Push only after the user confirms. An agent never signs a release gate.

## Spec drift (decided here, recorded on [E2E-00] in Task 12)

- `e2e/compare.mjs` becomes `e2e/scripts/compare.ts`, run with `node --experimental-transform-types` like plan 1's scripts. Each module stays small, so the work is split across `lib/*.ts` files.
- "Source globs" per surface become **entry files plus their computed import closure**. A hand-written glob list goes stale without anyone noticing. The import graph is read from the files themselves, so a new import is picked up with no edit. The spec's rules still hold: shared paths and any changed file no surface reaches select everything, so an unmapped file costs time and never skips a page.
- Files that cannot change what a local staging build renders (`functions/**`, `e2e/**`, docs, deploy scripts, rules) are ignored by selection. They are listed in `IGNORED`.
- The "local build of the commit" side is served by the Vite dev server in `--mode staging`, the same way plan 1's journeys run. This is not a production build.
- `npm run e2e:capture -- --label <name>` writes a one-side gallery with no diffs.

## File Structure

| Path | Responsibility |
| --- | --- |
| `e2e/lib/storage-state.ts` | Move a saved session to another origin (two ports means two origins) |
| `e2e/lib/capture-noise.ts` | The aborted-request log line and the read-only write-noise allowance |
| `e2e/surfaces.ts` | The manifest: 26 surfaces, role, path, entry files, optional `ready` and `mask` |
| `e2e/lib/import-graph.ts` | Relative-import scanner, resolver, closure; fs and git readers |
| `e2e/lib/select.ts` | `SHARED`, `IGNORED`, `selectSurfaces` |
| `e2e/lib/capture-plan.ts` | Sides and surface filter parsing, capture keys and paths, annotation types |
| `e2e/lib/capture.ts` | In-page helpers: deterministic `Math.random`, `settle`, `assertFits`, `stableScreenshot`, aria text |
| `e2e/capture.spec.ts` | Generated capture tests |
| `e2e/lib/diff.ts` | PNG diff with size padding; aria text patch |
| `e2e/lib/run-results.ts` | Read Playwright's JSON report |
| `e2e/lib/report.ts` | Report types, grouping, rows, ordering |
| `e2e/lib/gallery.ts` | `index.html` renderer |
| `e2e/lib/compare-args.ts` | CLI argument parsing for compare and capture |
| `e2e/lib/sides.ts` | Classify and resolve a target (worktree, ref, staging URL) |
| `e2e/lib/changed-files.ts` | Files changed between base and head |
| `e2e/lib/checkouts.ts` | Base worktrees per SHA, `npm ci` once, prune |
| `e2e/lib/servers.ts` | Start and stop Vite on a free port |
| `e2e/lib/orchestrate.ts` | Selection for a run, the Playwright child process, the final report |
| `e2e/scripts/compare.ts`, `e2e/scripts/capture.ts` | CLIs |
| `e2e/spikes/readonly-noise.spec.ts`, `e2e/spikes/capture-helpers.spec.ts` | Spike and helper proofs |
| Modify: `e2e/fixtures.ts`, `e2e/setup/auth.setup.ts`, `e2e/playwright.config.ts`, `e2e/journeys/guards.spec.ts`, `e2e/package.json`, `package.json`, `e2e/README.md` | Wiring and docs |

Unit tests sit next to their module as `*.test.ts`. `npm run e2e:unit` already picks up `lib/**/*.test.ts`.

Commands are run from the worktree root `/Users/jhh/Codebase/jhh-ai/.worktrees/lol-e2e-harness` unless a step says otherwise. Playwright is invoked as `npx --prefix e2e playwright test --config e2e/playwright.config.ts …`.

---

### Task 1: Sessions that move between origins

Compare serves base on `127.0.0.1:3101` and head on `127.0.0.1:3100`. Firebase keeps the session in IndexedDB, which is per origin, so a session saved on 3100 is invisible on 3101. Without a fix, every capture run would sign in again on the second origin and run into the throttle. This task moves the saved origin entry to the page's origin.

**Files:**
- Create: `e2e/lib/storage-state.ts`, `e2e/lib/storage-state.test.ts`
- Modify: `e2e/fixtures.ts` (`openPage`), `e2e/setup/auth.setup.ts` (`tryReuse` and the reuse branch)

**Interfaces:**
- Consumes: `authFile(role)` from `lib/app.ts`.
- Produces: `type StorageState`, `rebaseStorageState(state: StorageState, toOrigin: string): StorageState`, `loadStorageState(file: string, baseURL?: string): StorageState`.

- [ ] **Step 1: Write the failing test** `e2e/lib/storage-state.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebaseStorageState, type StorageState } from './storage-state.ts';

const state = (...origins: string[]): StorageState => ({
  cookies: [],
  origins: origins.map((origin) => ({ origin, localStorage: [{ name: 'k', value: origin }], indexedDB: [] })),
});

test('moves a single-origin state to the target origin', () => {
  const out = rebaseStorageState(state('http://127.0.0.1:3100'), 'http://127.0.0.1:3101');
  assert.equal(out.origins.length, 1);
  assert.equal(out.origins[0].origin, 'http://127.0.0.1:3101');
  assert.deepEqual(out.origins[0].localStorage, [{ name: 'k', value: 'http://127.0.0.1:3100' }]);
});

test('keeps only the matching origin when several are saved', () => {
  const out = rebaseStorageState(state('http://127.0.0.1:3100', 'http://127.0.0.1:3101'), 'http://127.0.0.1:3101');
  assert.deepEqual(out.origins.map((o) => o.origin), ['http://127.0.0.1:3101']);
  assert.equal(out.origins[0].localStorage[0].value, 'http://127.0.0.1:3101');
});

test('refuses several origins when none matches', () => {
  assert.throws(() => rebaseStorageState(state('http://a:1', 'http://b:2'), 'http://c:3'), /2 origins and none is http:\/\/c:3/);
});

test('leaves a state with no origins alone', () => {
  const empty = state();
  assert.equal(rebaseStorageState(empty, 'http://127.0.0.1:3101'), empty);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run e2e:unit`
Expected: FAIL, `Cannot find module` for `./storage-state.ts`.

- [ ] **Step 3: Write `e2e/lib/storage-state.ts`**

```ts
import { readFileSync } from 'node:fs';
import type { BrowserContext } from '@playwright/test';

export type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

// Firebase keeps the session in IndexedDB, which is per origin. Compare serves two checkouts on
// two ports, so a session saved on one port is moved to the other instead of signing in again.
export function rebaseStorageState(state: StorageState, toOrigin: string): StorageState {
  if (state.origins.length === 0) return state;
  const match = state.origins.find((o) => o.origin === toOrigin);
  if (match) return { ...state, origins: [match] };
  if (state.origins.length > 1) throw new Error(`storage state has ${state.origins.length} origins and none is ${toOrigin}`);
  return { ...state, origins: [{ ...state.origins[0], origin: toOrigin }] };
}

export function loadStorageState(file: string, baseURL?: string): StorageState {
  const state = JSON.parse(readFileSync(file, 'utf8')) as StorageState;
  return baseURL ? rebaseStorageState(state, new URL(baseURL).origin) : state;
}
```

- [ ] **Step 4: Run the unit tests and the typecheck**

Run: `npm run e2e:unit` then `npm --prefix e2e run typecheck`
Expected: all unit tests PASS (54 from plan 1 plus 4 new); typecheck clean. If `StorageState`'s `indexedDB: []` does not typecheck in 1.63, type the test helper's origins with `StorageState['origins']` and keep the module unchanged.

- [ ] **Step 5: Use it in `e2e/fixtures.ts`**

Add the import and change the `storageState` line in `openPage`:

```ts
import { loadStorageState } from './lib/storage-state.ts';
```

```ts
    storageState: role ? loadStorageState(authFile(role), env.baseURL) : undefined,
```

- [ ] **Step 6: Use it in `e2e/setup/auth.setup.ts`**

Add `import { loadStorageState } from '../lib/storage-state.ts';`. In `tryReuse`, change the context line to:

```ts
  const context = await browser.newContext({ storageState: loadStorageState(authFile(role), baseURL), baseURL, serviceWorkers: 'block', reducedMotion: 'reduce' });
```

In the setup test, make the reuse branch log where the session was reused. The list reporter prints stdout, which is how Task 2 proves no sign-in happened:

```ts
      if (reused) {
        console.log(`[setup] reused ${role} session on ${new URL(baseURL ?? 'http://127.0.0.1:3100').origin}`);
        testInfo.annotations.push({ type: 'reused session', description: role });
        return;
      }
```

The `context.storageState({ path: authFile(role), indexedDB: true })` save in `tryReuse` stays. It now saves the state under the new origin, and the next run moves it again if needed.

- [ ] **Step 7: Prove nothing regressed on the usual origin**

Run: `npm run e2e:journeys -- spikes/frozen-clock.spec.ts --project desktop`
Expected: 3 passed (2 setup, 1 spike). The output shows `[setup] reused admin session on http://127.0.0.1:3100` and the same for member if the saved sessions are younger than 30 minutes. If they are older, setup signs in once per role. That is allowed once. Do not rerun just to see the reuse line.

- [ ] **Step 8: Commit**

```bash
git add e2e/lib/storage-state.ts e2e/lib/storage-state.test.ts e2e/fixtures.ts e2e/setup/auth.setup.ts
```
```bash
git commit -m "feat(e2e): move saved sessions to the page origin

Compare serves base and head on two ports, and Firebase keeps the session
per origin, so a saved session is rebased instead of signing in again.

Refs: [E2E-03]
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Spike — second origin and read-only noise

Two unknowns gate the design. First, the staging web API key might refuse requests from `127.0.0.1:3101` (an HTTP-referrer restriction). Second, aborting the app's own writes in read-only mode makes noise, and nobody has seen what it looks like. Chromium logs each aborted request as `console.error`, and plan 1's guard proof already allows that line. This task measures both, then adds the narrowest allowance that covers what was seen.

**Files:**
- Create: `e2e/spikes/readonly-noise.spec.ts`, `e2e/lib/capture-noise.ts`, `e2e/lib/capture-noise.test.ts`
- Modify: `e2e/fixtures.ts` (new option `allowBlockedWriteNoise`), `e2e/journeys/guards.spec.ts` (import the shared constant)

**Interfaces:**
- Consumes: `test`, `expect` from `fixtures.ts`; `stagingBadge` from `lib/app.ts`; `rebaseStorageState` (Task 1, via fixtures).
- Produces: `ABORTED_REQUEST_LOG: RegExp`, `BLOCKED_WRITE_NOISE: RegExp[]`, `stripQuery(entry: string): string`, `dropBlockedWriteNoise(errors: string[], blocked: string[]): { remaining: string[]; dropped: number }`; fixture option `allowBlockedWriteNoise: boolean` (default `false`).

- [ ] **Step 1: Prove a session works on a second origin**

Run: `E2E_BASE_URL=http://127.0.0.1:3101 npm run e2e:journeys -- spikes/frozen-clock.spec.ts --project desktop`
(The config starts Vite on 3101 because it takes the port from the base URL.)
Expected: 3 passed, the output shows `[setup] reused admin session on http://127.0.0.1:3101` and `[setup] reused member session on http://127.0.0.1:3101`, and `grep -c '"origin": "http://127.0.0.1:3101"' e2e/.auth/member.json` prints `1`.

**Stop conditions:**
- If setup signed in fresh because the saved sessions had expired, it spent one sign-in per role. Run the command once more, at least 1 minute later. It must reuse. Never run it a third time.
- If the run fails with a `securetoken` or `identitytoolkit` 403 such as `API_KEY_HTTP_REFERRER_BLOCKED`, **stop and report to the user.** The fallback is one port with the sides captured one after the other. That changes Tasks 5, 8 and 9 and loses the per-surface interleaving, so the user decides.
- If setup prints "Invalid email or password", stop: that is the throttle (see Global Constraints).

Afterwards run the spike once on 3100 again (`npm run e2e:journeys -- spikes/frozen-clock.spec.ts --project desktop`). It must reuse and move the session back.

- [ ] **Step 2: Write the observation spike** `e2e/spikes/readonly-noise.spec.ts`

```ts
import { test, expect } from '../fixtures.ts';
import type { Page } from '@playwright/test';
import { stagingBadge } from '../lib/app.ts';

// Read-only capture aborts any write the app makes on load. This spike records what that costs
// in console noise, so the allowance in lib/capture-noise.ts covers only what was observed.
const MEMBER_PATHS = ['/', '/race?view=picks', '/race?view=results', '/standings', '/league', '/profile'];
const ADMIN_PATHS = ['/admin', '/admin?tool=season', '/admin?tool=database'];

test.use({ readOnly: true });

async function visit(page: Page, paths: string[]): Promise<void> {
  for (const path of paths) {
    await page.goto(path);
    await expect(stagingBadge(page)).toBeVisible();
    await page.waitForTimeout(4_000);
  }
}

test('member surfaces in read-only mode', async ({ memberPage, blocked }) => {
  await visit(memberPage, MEMBER_PATHS);
  console.log(`[noise] member blocked: ${JSON.stringify(blocked.map((b) => b.replace(/\?.*$/, '')))}`);
});

test('admin surfaces in read-only mode', async ({ adminPage, blocked }) => {
  await visit(adminPage, ADMIN_PATHS);
  console.log(`[noise] admin blocked: ${JSON.stringify(blocked.map((b) => b.replace(/\?.*$/, '')))}`);
});
```

- [ ] **Step 3: Run it once and record what it shows**

Run: `npm run e2e:journeys -- spikes/readonly-noise.spec.ts --project desktop`
Record in the task report: the `[noise]` lines (which writes were blocked, per role), and the exact text of each entry in the `page errors or console.error during the test` assertion if a test failed. Expected: the member test fails listing `console.error: Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector` after a blocked `WRITE POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel` (the `race_results` self-seed, [PROD-11]); the admin test may pass with nothing blocked.

**Stop condition:** if any observed error is not one of the following, stop and report it with the blocked list, and do not widen the allowance:
- the aborted-request line;
- a Firestore SDK line that names the `Write` stream.

- [ ] **Step 4: Write the failing test** `e2e/lib/capture-noise.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropBlockedWriteNoise, stripQuery } from './capture-noise.ts';

const ABORT = 'console.error: Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector';
const WRITE = 'WRITE POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&gsessionid=x';

test('drops aborted-request lines when a write was blocked', () => {
  assert.deepEqual(dropBlockedWriteNoise([ABORT, ABORT], [WRITE]), { remaining: [], dropped: 2 });
});

test('keeps everything when no write was blocked', () => {
  assert.deepEqual(dropBlockedWriteNoise([ABORT], ['FORBIDDEN https://x/formula-fantasy-1']), { remaining: [ABORT], dropped: 0 });
});

test('never drops an unrelated error', () => {
  const other = 'pageerror: boom';
  assert.deepEqual(dropBlockedWriteNoise([other, ABORT], [WRITE]), { remaining: [other], dropped: 1 });
});

test('stripQuery removes the query string from a blocked entry', () => {
  assert.equal(stripQuery(WRITE), 'WRITE POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel');
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npm run e2e:unit`
Expected: FAIL, module not found.

- [ ] **Step 6: Write `e2e/lib/capture-noise.ts`**

```ts
// Chromium logs each route-aborted request as this console error; it is the observed text, with no URL in it.
export const ABORTED_REQUEST_LOG = /^console\.error: Failed to load resource: net::ERR_BLOCKED_BY_CLIENT\.Inspector$/;

// Only lines the Task 2 spike observed after a blocked write. Add a line here only with the
// request that caused it, recorded in the worklog.
export const BLOCKED_WRITE_NOISE: RegExp[] = [ABORTED_REQUEST_LOG];

// Blocked entries are reported; their query strings carry session ids, so they are dropped.
export const stripQuery = (entry: string): string => entry.replace(/\?.*$/, '');

// In read-only capture an aborted write is expected. Its log lines are dropped only when the
// test really had a write blocked, so the allowance cannot hide an unrelated error.
export function dropBlockedWriteNoise(errors: string[], blocked: string[]): { remaining: string[]; dropped: number } {
  if (!blocked.some((b) => b.startsWith('WRITE '))) return { remaining: errors, dropped: 0 };
  const remaining = errors.filter((e) => !BLOCKED_WRITE_NOISE.some((re) => re.test(e)));
  return { remaining, dropped: errors.length - remaining.length };
}
```

If Step 3 recorded an allowed Firestore `Write`-stream line, add its exact regex to `BLOCKED_WRITE_NOISE`, with a comment naming the blocked request, and add a unit test for it.

- [ ] **Step 7: Run the unit tests**

Run: `npm run e2e:unit`
Expected: PASS.

- [ ] **Step 8: Add the fixture option** in `e2e/fixtures.ts`

Add `allowBlockedWriteNoise: boolean;` to `type Fixtures`, the import `import { dropBlockedWriteNoise } from './lib/capture-noise.ts';`, the option `allowBlockedWriteNoise: [false, { option: true }],`, and change `pageErrors` to depend on `blocked` and `allowBlockedWriteNoise`:

```ts
  pageErrors: async ({ allowances, writeBodies, errorPages, blocked, allowBlockedWriteNoise }, use, testInfo) => {
    const errors: string[] = [];
    await use(errors);
    // Optional, may match zero times (the bug is intermittent); unlike expectError it never fails when unused.
    const known = splitKnownIssues(errors.map((text, i) => ({ text, pageId: errorPages[i] })), writeBodies);
    if (known.knownHit) testInfo.annotations.push({ type: 'known-app-issue', description: RACE_RESULTS_SEED_NOTE.replace('known-app-issue: ', '') });
    let texts = known.remaining.map((r) => r.text);
    if (allowBlockedWriteNoise) {
      const noise = dropBlockedWriteNoise(texts, blocked);
      if (noise.dropped) testInfo.annotations.push({ type: 'blocked-write-noise', description: `${noise.dropped} log line(s) from aborted writes` });
      texts = noise.remaining;
    }
    const unexpected = texts.filter((e) => {
      const hits = allowances.filter((a) => a.re.test(e));
      hits.forEach((a) => { a.used = true; });
      return hits.length === 0;
    });
    expect(unexpected, 'page errors or console.error during the test').toEqual([]);
    expect(allowances.filter((a) => !a.used).map((a) => String(a.re)), 'expectError patterns that never matched').toEqual([]);
  },
```

In `e2e/journeys/guards.spec.ts`, replace the local `ABORTED_REQUEST_LOG` constant and its comment with `import { ABORTED_REQUEST_LOG } from '../lib/capture-noise.ts';`.

- [ ] **Step 9: Turn the spike into a regression check**

In `e2e/spikes/readonly-noise.spec.ts` change `test.use({ readOnly: true });` to `test.use({ readOnly: true, allowBlockedWriteNoise: true });`.

Run: `npm run e2e:journeys -- spikes/readonly-noise.spec.ts journeys/guards.spec.ts --project desktop`
Expected: all passed; the member test carries a `blocked-write-noise` annotation (visible in `e2e-results/report`).

- [ ] **Step 10: Typecheck and commit**

Run: `npm --prefix e2e run typecheck` (clean).

```bash
git add e2e/lib/capture-noise.ts e2e/lib/capture-noise.test.ts e2e/spikes/readonly-noise.spec.ts e2e/fixtures.ts e2e/journeys/guards.spec.ts
```
```bash
git commit -m "feat(e2e): allow aborted-write noise in read-only capture

A second origin reuses the saved session (spike result in the worklog).
Read-only mode aborts the app's own writes; their log lines are dropped
only when a write was really blocked in that test.

Refs: [E2E-03]
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Append the spike results (second-origin outcome, blocked writes per role, exact noise lines) to `/Users/jhh/Codebase/jhh-ai/worklog/playwright-adoption.md` under a new `## Plan 2` heading. The worklog is outside the repo, so it is not committed.

---

### Task 3: Surface manifest and incremental selection

**Files:**
- Create: `e2e/surfaces.ts`, `e2e/lib/import-graph.ts`, `e2e/lib/import-graph.test.ts`, `e2e/lib/select.ts`, `e2e/lib/select.test.ts`, `e2e/lib/surfaces.test.ts`
- Modify: `e2e/package.json`, `e2e/package-lock.json` (add `picomatch`, `@types/picomatch`)

**Interfaces:**
- Consumes: `REPO_ROOT` from `lib/paths.ts`.
- Produces:
  - `surfaces.ts`: `type Role = 'member' | 'admin' | 'anon'`, `type Surface = { id; path; role; entries: string[]; ready?: (page: Page) => Locator; mask?: (page: Page) => Locator[] }`, `SURFACES: Surface[]`, `STANDINGS_VIEWS`, `ADMIN_TOOLS`.
  - `import-graph.ts`: `type Reader = (relPath: string) => string | null`, `fsReader(root)`, `gitReader(sha, cwd?)`, `relativeImports(source): string[]`, `resolveImport(fromFile, spec, read): string | null`, `importClosure(entries, read, stopAt): Set<string>`, `closuresFor(surfaces, readers, stopAt): Map<string, Set<string>>`.
  - `select.ts`: `SHARED: string[]`, `IGNORED: string[]`, `isShared(file): boolean`, `isIgnored(file): boolean`, `type Selection = { all: boolean; ids: string[]; reasons: string[] }`, `selectSurfaces(changed: string[], closures: Map<string, Set<string>>): Selection`.

- [ ] **Step 1: Install picomatch**

Run: `npm --prefix e2e install -D picomatch @types/picomatch`
Then: `git diff --stat -- package-lock.json` must print nothing (root lockfile untouched).

- [ ] **Step 2: Write the failing import-graph test** `e2e/lib/import-graph.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importClosure, relativeImports, resolveImport, type Reader } from './import-graph.ts';

const files: Record<string, string> = {
  'components/Page.tsx': [
    "import React from 'react';",
    "import { Thing,",
    "  Other } from './parts/Thing';",
    "import type { Shape } from './types';",
    "import { type Kind, helper } from '../utils/helper.ts';",
    "import '../styles/page.css';",
    "const Lazy = lazy(() => import('./Lazy.tsx'));",
    "import { App } from '../App';",
  ].join('\n'),
  'components/parts/Thing.tsx': "export { x } from './index';",
  'components/parts/index.ts': 'export const x = 1;',
  'components/types.ts': 'export type Shape = {};',
  'utils/helper.ts': 'export const helper = 1;',
  'styles/page.css': 'body {}',
  'components/Lazy.tsx': 'export default 1;',
  'App.tsx': "import { Everything } from './components/Everything';",
  'components/Everything.tsx': 'export const Everything = 1;',
};
const read: Reader = (p) => files[p] ?? null;

test('relativeImports finds static, multi-line, side-effect and dynamic imports and skips type-only ones', () => {
  assert.deepEqual(relativeImports(files['components/Page.tsx']).sort(), [
    '../App', '../styles/page.css', '../utils/helper.ts', './Lazy.tsx', './parts/Thing',
  ]);
});

test('resolveImport tries .tsx, .ts and index files, and takes an explicit extension as is', () => {
  assert.equal(resolveImport('components/Page.tsx', './parts/Thing', read), 'components/parts/Thing.tsx');
  assert.equal(resolveImport('components/parts/Thing.tsx', './index', read), 'components/parts/index.ts');
  assert.equal(resolveImport('components/Page.tsx', '../utils/helper.ts', read), 'utils/helper.ts');
  assert.equal(resolveImport('components/Page.tsx', './missing', read), null);
});

test('importClosure follows imports but does not descend into a stop file', () => {
  const closure = importClosure(['components/Page.tsx'], read, (f) => f === 'App.tsx');
  assert.deepEqual([...closure].sort(), [
    'App.tsx', 'components/Lazy.tsx', 'components/Page.tsx', 'components/parts/Thing.tsx',
    'components/parts/index.ts', 'styles/page.css', 'utils/helper.ts',
  ]);
});

test('importClosure skips entries that do not exist', () => {
  assert.deepEqual([...importClosure(['components/Gone.tsx'], read, () => false)], []);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run e2e:unit`
Expected: FAIL, module not found.

- [ ] **Step 4: Write `e2e/lib/import-graph.ts`**

```ts
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { REPO_ROOT } from './paths.ts';

export type Reader = (relPath: string) => string | null;

const memo = (read: Reader): Reader => {
  const cache = new Map<string, string | null>();
  return (p) => { if (!cache.has(p)) cache.set(p, read(p)); return cache.get(p)!; };
};

export const fsReader = (root: string): Reader => memo((p) => {
  const abs = join(root, p);
  return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : null;
});

// Reads files as they are at a commit, so --plan needs no checkout of the base.
export const gitReader = (sha: string, cwd = REPO_ROOT): Reader => memo((p) => {
  const opts = { cwd, encoding: 'utf8' as const, stdio: ['ignore', 'pipe', 'ignore'] as ('ignore' | 'pipe')[], maxBuffer: 32 * 1024 * 1024 };
  try {
    if (execFileSync('git', ['cat-file', '-t', `${sha}:${p}`], opts).trim() !== 'blob') return null;
    return execFileSync('git', ['show', `${sha}:${p}`], opts);
  } catch {
    return null;
  }
});

// Type-only imports are skipped: they cannot change what renders.
const STATIC_IMPORT = /^\s*(?:import|export)\s+(type\s+)?[^'";]*?['"](\.{1,2}\/[^'"]+)['"]/gm;
const DYNAMIC_IMPORT = /import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

export function relativeImports(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(STATIC_IMPORT)) if (!m[1]) out.push(m[2]);
  for (const m of source.matchAll(DYNAMIC_IMPORT)) out.push(m[1]);
  return out;
}

const SUFFIXES = ['.tsx', '.ts', '/index.tsx', '/index.ts'];

export function resolveImport(fromFile: string, spec: string, read: Reader): string | null {
  const base = posix.normalize(posix.join(posix.dirname(fromFile), spec));
  const candidates = /\.[a-z]+$/i.test(posix.basename(base)) ? [base] : SUFFIXES.map((s) => base + s);
  return candidates.find((c) => read(c) !== null) ?? null;
}

export function importClosure(entries: string[], read: Reader, stopAt: (file: string) => boolean): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    const source = read(file);
    if (source === null) continue;
    seen.add(file);
    // A shared file already selects every surface, so following it would only blur the graph.
    if (stopAt(file) && !entries.includes(file)) continue;
    for (const spec of relativeImports(source)) {
      const next = resolveImport(file, spec, read);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

export function closuresFor(surfaces: { id: string; entries: string[] }[], readers: Reader[], stopAt: (file: string) => boolean): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const s of surfaces) {
    const files = new Set<string>();
    for (const read of readers) for (const f of importClosure(s.entries, read, stopAt)) files.add(f);
    out.set(s.id, files);
  }
  return out;
}
```

- [ ] **Step 5: Run the unit tests**

Run: `npm run e2e:unit`
Expected: the import-graph tests PASS.

- [ ] **Step 6: Write the failing selection test** `e2e/lib/select.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIgnored, isShared, selectSurfaces } from './select.ts';

const closures = new Map<string, Set<string>>([
  ['standings', new Set(['components/LeaderboardPage.tsx', 'components/standings/HallOfFameView.tsx'])],
  ['standings-hall', new Set(['components/LeaderboardPage.tsx', 'components/standings/HallOfFameView.tsx'])],
  ['league', new Set(['components/LeagueHubPage.tsx', 'components/league/DuesStatus.tsx'])],
]);

test('a file reached by some surfaces selects only those', () => {
  const s = selectSurfaces(['components/standings/HallOfFameView.tsx'], closures);
  assert.deepEqual(s, { all: false, ids: ['standings', 'standings-hall'], reasons: ['components/standings/HallOfFameView.tsx → standings, standings-hall'] });
});

test('a shared file selects everything', () => {
  const s = selectSurfaces(['styles/theme.css'], closures);
  assert.equal(s.all, true);
  assert.deepEqual(s.ids, ['standings', 'standings-hall', 'league']);
  assert.deepEqual(s.reasons, ['shared styles/theme.css → all']);
});

test('a file no surface reaches selects everything', () => {
  const s = selectSurfaces(['zz-unmapped.ts'], closures);
  assert.equal(s.all, true);
  assert.deepEqual(s.reasons, ['unmapped zz-unmapped.ts → all']);
});

test('ignored files select nothing', () => {
  const s = selectSurfaces(['functions/index.js', 'e2e/surfaces.ts', 'DESIGN.md', 'services/scoringService.test.ts'], closures);
  assert.deepEqual(s.ids, []);
  assert.equal(s.all, false);
});

test('no changes select nothing and say so', () => {
  assert.deepEqual(selectSurfaces([], closures), { all: false, ids: [], reasons: ['no changed files'] });
});

test('test files are ignored before services/** counts as shared', () => {
  assert.equal(isIgnored('services/scoringService.test.ts'), true);
  assert.equal(isShared('services/scoringService.ts'), true);
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npm run e2e:unit`
Expected: FAIL, module not found.

- [ ] **Step 8: Write `e2e/lib/select.ts`**

```ts
import picomatch from 'picomatch';

// Changing one of these can change any page.
export const SHARED = [
  'App.tsx', 'routes.ts', 'index.tsx', 'index.html', 'vite.config.ts', 'package.json', 'package-lock.json',
  '.env.staging', 'styles/**', 'components/ui/**', 'contexts/**', 'services/**', 'public/**',
];

// These cannot change what a local --mode staging build renders: server code and rules run from
// the staging deploy, and the harness is the same on both sides of a comparison.
export const IGNORED = [
  'e2e/**', 'functions/**', 'scripts/**', 'docs/**', 'regression/**', '.githooks/**', '.claude/**', '.github/**',
  '.superpowers/**', '**/*.md', '**/*.test.ts', 'firestore.rules', 'firestore.indexes.json', 'firebase.json',
  '.firebaserc', '*.sh', 'cloudbuild.*.yaml', 'Dockerfile', '.dockerignore', '.gcloudignore', '.gitignore',
  '.env.production', '.env.prod-staging', 'nginx.conf',
];

export const isShared = picomatch(SHARED, { dot: true });
export const isIgnored = picomatch(IGNORED, { dot: true });

export type Selection = { all: boolean; ids: string[]; reasons: string[] };

export function selectSurfaces(changed: string[], closures: Map<string, Set<string>>): Selection {
  const reasons: string[] = [];
  const hits = new Set<string>();
  let all = false;
  for (const file of [...new Set(changed)].sort()) {
    if (isIgnored(file)) continue;
    if (isShared(file)) { all = true; reasons.push(`shared ${file} → all`); continue; }
    const ids = [...closures].filter(([, files]) => files.has(file)).map(([id]) => id);
    if (ids.length) { ids.forEach((id) => hits.add(id)); reasons.push(`${file} → ${ids.join(', ')}`); }
    else { all = true; reasons.push(`unmapped ${file} → all`); }
  }
  if (!changed.length) reasons.push('no changed files');
  const ids = [...closures.keys()].filter((id) => all || hits.has(id));
  return { all, ids, reasons };
}
```

- [ ] **Step 9: Run the unit tests**

Run: `npm run e2e:unit`
Expected: PASS.

- [ ] **Step 10: Write the manifest** `e2e/surfaces.ts`

```ts
import type { Locator, Page } from '@playwright/test';

export type Role = 'member' | 'admin' | 'anon';

export type Surface = {
  id: string;            // kebab-case, unique; used in file names
  path: string;          // URL path and query, starting with '/'
  role: Role;
  entries: string[];     // repo-relative components; selection follows their imports
  ready?: (page: Page) => Locator;   // an element to wait for after the default settle
  mask?: (page: Page) => Locator[];  // regions that differ between two runs of identical code (say why)
};

// Mirrors of app values; lib/surfaces.test.ts fails when either drifts from the app source.
export const STANDINGS_VIEWS = ['standings', 'executive', 'popular', 'entities', 'insights', 'p22', 'hall'] as const;
export const ADMIN_TOOLS = ['results', 'manage-users', 'scoring', 'entities', 'schedule', 'invitations', 'database', 'announcements', 'season'] as const;

const ADMIN_TOOL_ENTRY: Record<(typeof ADMIN_TOOLS)[number], string> = {
  results: 'components/ResultsManagerPage.tsx',
  'manage-users': 'components/ManageUsersPage.tsx',
  scoring: 'components/ScoringSettingsPage.tsx',
  entities: 'components/ManageEntitiesPage.tsx',
  schedule: 'components/ManageSchedulePage.tsx',
  invitations: 'components/AdminInvitationPage.tsx',
  database: 'components/DatabaseManagerPage.tsx',
  announcements: 'components/AdminAnnouncementsPage.tsx',
  season: 'components/admin/SeasonControlPage.tsx',
};

const RACE = 'components/RacePage.tsx';
const STANDINGS = 'components/LeaderboardPage.tsx';
const LEAGUE = 'components/LeagueHubPage.tsx';

export const SURFACES: Surface[] = [
  { id: 'signin', path: '/', role: 'anon', entries: ['components/AuthScreen.tsx'] },
  { id: 'home', path: '/', role: 'member', entries: ['components/Dashboard.tsx'] },
  { id: 'race-picks', path: '/race?view=picks', role: 'member', entries: [RACE] },
  { id: 'race-weekend', path: '/race?view=weekend', role: 'member', entries: [RACE] },
  { id: 'race-results', path: '/race?view=results', role: 'member', entries: [RACE] },
  ...STANDINGS_VIEWS.map((v): Surface => ({
    id: v === 'standings' ? 'standings' : `standings-${v}`,
    path: v === 'standings' ? '/standings' : `/standings?view=${v}`,
    role: 'member',
    entries: [STANDINGS],
  })),
  { id: 'standings-rules', path: '/standings?rules=1', role: 'member', entries: [STANDINGS] },
  { id: 'league', path: '/league', role: 'member', entries: [LEAGUE] },
  { id: 'league-dues', path: '/league?dues=1', role: 'member', entries: [LEAGUE] },
  { id: 'profile', path: '/profile', role: 'member', entries: ['components/ProfilePage.tsx'] },
  { id: 'admin', path: '/admin', role: 'admin', entries: ['components/AdminPage.tsx'] },
  ...ADMIN_TOOLS.map((t): Surface => ({ id: `admin-${t}`, path: `/admin?tool=${t}`, role: 'admin', entries: [ADMIN_TOOL_ENTRY[t]] })),
];
```

- [ ] **Step 11: Write the manifest drift test** `e2e/lib/surfaces.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_TOOLS, STANDINGS_VIEWS, SURFACES } from '../surfaces.ts';
import { fsReader, importClosure } from './import-graph.ts';
import { isShared } from './select.ts';
import { REPO_ROOT } from './paths.ts';

const appSource = (rel: string) => readFileSync(join(REPO_ROOT, rel), 'utf8');
const block = (src: string, start: string, end: string) => { const i = src.indexOf(start); return src.slice(i, src.indexOf(end, i)); };

test('there are 26 surfaces with unique kebab-case ids and app-relative paths', () => {
  assert.equal(SURFACES.length, 26);
  assert.equal(new Set(SURFACES.map((s) => s.id)).size, SURFACES.length);
  for (const s of SURFACES) {
    assert.match(s.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.match(s.path, /^\//);
  }
});

test('every entry file exists', () => {
  for (const s of SURFACES) for (const e of s.entries) assert.ok(existsSync(join(REPO_ROOT, e)), `${s.id}: ${e}`);
});

test('standings views match LeaderboardPage.tsx VIEWS', () => {
  const views = [...block(appSource('components/LeaderboardPage.tsx'), 'const VIEWS', '];').matchAll(/value:\s*'([a-z0-9]+)'/g)].map((m) => m[1]);
  assert.deepEqual(views.sort(), [...STANDINGS_VIEWS].sort());
});

test('admin tools match routes.ts ADMIN_TOOLS', () => {
  const tools = [...block(appSource('routes.ts'), 'export const ADMIN_TOOLS', '] as const').matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  assert.deepEqual(tools.sort(), [...ADMIN_TOOLS].sort());
});

test('closures follow real imports and stop at shared files', () => {
  const read = fsReader(REPO_ROOT);
  const closure = (id: string) => importClosure(SURFACES.find((s) => s.id === id)!.entries, read, isShared);
  assert.ok(closure('standings-hall').has('components/standings/HallOfFameView.tsx'));
  assert.ok(closure('race-results').has('components/SchedulePage.tsx'));
  // Dashboard imports ../App; App.tsx is shared, so its lazy imports must not leak into home.
  assert.ok(!closure('home').has('components/LeaderboardPage.tsx'));
});
```

- [ ] **Step 12: Run the unit tests and the typecheck**

Run: `npm run e2e:unit` then `npm --prefix e2e run typecheck`
Expected: PASS and clean. If a drift test fails, the app source differs from what this plan read on 2026-11-26. Fix the mirror in `surfaces.ts` to match the app, never the other way round.

- [ ] **Step 13: Commit**

```bash
git add e2e/surfaces.ts e2e/lib/import-graph.ts e2e/lib/import-graph.test.ts e2e/lib/select.ts e2e/lib/select.test.ts e2e/lib/surfaces.test.ts e2e/package.json e2e/package-lock.json
```
```bash
git commit -m "feat(e2e): surface manifest and import-graph selection

26 surfaces with their entry components. A changed file selects the
surfaces whose import closure contains it; shared and unmapped files
select everything; server code, docs and the harness are ignored.

Refs: [E2E-03], [E2E-04]
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Capture plan and in-page helpers

**Files:**
- Create: `e2e/lib/capture-plan.ts`, `e2e/lib/capture-plan.test.ts`, `e2e/lib/capture.ts`, `e2e/spikes/capture-helpers.spec.ts`

**Interfaces:**
- Consumes: `GuardError` from `lib/guards.ts`; `stagingBadge` from `lib/app.ts`; `Surface` (type) from `surfaces.ts`.
- Produces:
  - `capture-plan.ts`: `THEMES`, `type Theme`, `type Side = { name: string; baseURL: string }`, `type CaptureTarget = { key; surface; theme; project; side }`, `type CaptureNote = CaptureTarget & { png; aria; unstable: boolean; blockedWrites: string[]; url: string }`, `TARGET_ANNOTATION = 'capture-target'`, `NOTE_ANNOTATION = 'capture'`, `parseSides(raw?: string): Side[]`, `parseSurfaceFilter(raw: string | undefined, known: string[]): string[] | null`, `captureKey(project, surface, theme): string`, `capturePaths(runDir, side, key): { png: string; aria: string }`.
  - `capture.ts`: `DETERMINISM_INIT: string`, `settle(page, surface: Pick<Surface, 'role' | 'ready'>): Promise<void>`, `assertFits(page): Promise<void>`, `stableScreenshot(page, opts: { mask: Locator[]; attempts?: number; intervalMs?: number }): Promise<{ png: Buffer; stable: boolean }>`, `ariaText(page): Promise<string>`.

- [ ] **Step 1: Write the failing test** `e2e/lib/capture-plan.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureKey, capturePaths, parseSides, parseSurfaceFilter } from './capture-plan.ts';

test('parseSides reads one or two named sides', () => {
  assert.deepEqual(parseSides(undefined), []);
  assert.deepEqual(parseSides('[{"name":"base","baseURL":"http://127.0.0.1:3101"},{"name":"head","baseURL":"http://127.0.0.1:3100"}]'), [
    { name: 'base', baseURL: 'http://127.0.0.1:3101' },
    { name: 'head', baseURL: 'http://127.0.0.1:3100' },
  ]);
});

test('parseSides refuses bad input', () => {
  assert.throws(() => parseSides('nope'), /not JSON/);
  assert.throws(() => parseSides('[]'), /one or two/);
  assert.throws(() => parseSides('[{"name":"Bad Name","baseURL":"x"}]'), /bad side/);
  assert.throws(() => parseSides('[{"name":"a","baseURL":"x"},{"name":"a","baseURL":"y"}]'), /unique/);
});

test('parseSurfaceFilter returns null for all and refuses unknown ids', () => {
  assert.equal(parseSurfaceFilter(undefined, ['home']), null);
  assert.equal(parseSurfaceFilter('', ['home']), null);
  assert.deepEqual(parseSurfaceFilter('home, league', ['home', 'league', 'profile']), ['home', 'league']);
  assert.throws(() => parseSurfaceFilter('home,nope', ['home']), /unknown surface.*nope/);
});

test('keys and paths are stable and per side', () => {
  const key = captureKey('capture-mobile', 'standings-hall', 'light');
  assert.equal(key, 'capture-mobile/standings-hall--light');
  assert.deepEqual(capturePaths('/r', 'base', key), {
    png: '/r/base/capture-mobile/standings-hall--light.png',
    aria: '/r/base/capture-mobile/standings-hall--light.aria.yml',
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run e2e:unit`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `e2e/lib/capture-plan.ts`**

```ts
import { join } from 'node:path';
import { GuardError } from './guards.ts';

export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];
export type Side = { name: string; baseURL: string };
export type CaptureTarget = { key: string; surface: string; theme: Theme; project: string; side: string };
export type CaptureNote = CaptureTarget & { png: string; aria: string; unstable: boolean; blockedWrites: string[]; url: string };

// Pushed at the start of every capture test (so a failure can be placed) and on success.
export const TARGET_ANNOTATION = 'capture-target';
export const NOTE_ANNOTATION = 'capture';

const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function parseSides(raw: string | undefined): Side[] {
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new GuardError('E2E_SIDES is not JSON'); }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 2) throw new GuardError('E2E_SIDES must list one or two sides');
  const sides = parsed.map((s: Record<string, unknown>) => {
    if (!s || typeof s.name !== 'string' || typeof s.baseURL !== 'string' || !NAME.test(s.name)) throw new GuardError(`bad side in E2E_SIDES: ${JSON.stringify(s)}`);
    return { name: s.name, baseURL: s.baseURL };
  });
  if (new Set(sides.map((s) => s.name)).size !== sides.length) throw new GuardError('E2E_SIDES names must be unique');
  return sides;
}

export function parseSurfaceFilter(raw: string | undefined, known: string[]): string[] | null {
  const ids = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return null;
  const unknown = ids.filter((id) => !known.includes(id));
  if (unknown.length) throw new Error(`unknown surface(s): ${unknown.join(', ')}; known: ${known.join(', ')}`);
  return ids;
}

export const captureKey = (project: string, surface: string, theme: Theme): string => `${project}/${surface}--${theme}`;

export const capturePaths = (runDir: string, side: string, key: string): { png: string; aria: string } => ({
  png: join(runDir, side, `${key}.png`),
  aria: join(runDir, side, `${key}.aria.yml`),
});
```

- [ ] **Step 4: Run the unit tests**

Run: `npm run e2e:unit`
Expected: PASS.

- [ ] **Step 5: Write `e2e/lib/capture.ts`**

```ts
import { expect, type Locator, type Page } from '@playwright/test';
import { stagingBadge } from './app.ts';
import type { Surface } from '../surfaces.ts';

// The clock is frozen but Math.random is not: the easter egg, the sign-in transition variant and
// the red-flag screen use it. A seeded generator (mulberry32) makes two runs of the same code match.
export const DETERMINISM_INIT = `(() => {
  let s = 0x2f6b1d3;
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

export async function settle(page: Page, surface: Pick<Surface, 'role' | 'ready'>): Promise<void> {
  await expect(stagingBadge(page), 'the STAGING badge must render on every surface').toBeVisible({ timeout: 20_000 });
  if (surface.role === 'anon') await expect(page.locator('#login-email')).toBeVisible({ timeout: 20_000 });
  else await expect(page.locator('#login-email')).toBeHidden({ timeout: 30_000 });
  if (surface.ready) await expect(surface.ready(page)).toBeVisible({ timeout: 20_000 });
  // LoadingSkeleton renders .animate-pulse blocks while Firestore data is on its way.
  await expect(page.locator('.animate-pulse').filter({ visible: true }), 'loading skeletons still visible').toHaveCount(0, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

// Fails only when the document itself scrolls sideways, naming the outermost offending elements.
export async function assertFits(page: Page): Promise<void> {
  const r = await page.evaluate(() => {
    const de = document.documentElement;
    if (de.scrollWidth <= de.clientWidth + 1) return null;
    const describe = (el: Element) => {
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);
      return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`;
    };
    const overflows = (el: Element | null) => !!el && el.getBoundingClientRect().right > de.clientWidth + 1 && el.getBoundingClientRect().width > 0;
    const offenders: string[] = [];
    for (const el of document.querySelectorAll('body *')) {
      if (overflows(el) && !overflows(el.parentElement === document.body ? null : el.parentElement)) {
        offenders.push(`${describe(el)} right=${Math.round(el.getBoundingClientRect().right)}`);
        if (offenders.length >= 5) break;
      }
    }
    return { by: de.scrollWidth - de.clientWidth, offenders };
  });
  if (r) throw new Error(`page overflows horizontally by ${r.by}px: ${r.offenders.join('; ') || 'no element found'}`);
}

// Two identical consecutive shots mean the page has stopped changing.
export async function stableScreenshot(
  page: Page,
  opts: { mask: Locator[]; attempts?: number; intervalMs?: number },
): Promise<{ png: Buffer; stable: boolean }> {
  const shot = () => page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide', mask: opts.mask, maskColor: '#FF00FF', scale: 'css' });
  const attempts = opts.attempts ?? 8;
  let prev = await shot();
  for (let i = 1; i < attempts; i++) {
    await page.waitForTimeout(opts.intervalMs ?? 400);
    const next = await shot();
    if (next.equals(prev)) return { png: next, stable: true };
    prev = next;
  }
  return { png: prev, stable: false };
}

export const ariaText = (page: Page): Promise<string> => page.locator('body').ariaSnapshot();
```

- [ ] **Step 6: Write the helper proofs** `e2e/spikes/capture-helpers.spec.ts`

```ts
import { test, expect } from '../fixtures.ts';
import { assertFits, DETERMINISM_INIT, stableScreenshot } from '../lib/capture.ts';

test('assertFits names the element that overflows', async ({ anonPage }) => {
  await anonPage.setContent('<body style="margin:0"><div id="ok">fine</div><div id="e2e-wide" style="width:3000px">wide</div></body>');
  await expect(assertFits(anonPage)).rejects.toThrow(/div#e2e-wide "wide" right=3000/);
});

test('assertFits passes a page that fits', async ({ anonPage }) => {
  await anonPage.setContent('<body style="margin:0"><div style="width:100px">narrow</div></body>');
  await assertFits(anonPage);
});

test('stableScreenshot reports a still page as stable', async ({ anonPage }) => {
  await anonPage.setContent('<p>still</p>');
  expect((await stableScreenshot(anonPage, { mask: [] })).stable).toBe(true);
});

test('stableScreenshot reports a ticking page as unstable', async ({ anonPage }) => {
  await anonPage.setContent('<p id="t">0</p><script>let n=0;setInterval(()=>{document.getElementById("t").textContent=String(n++)},50)</script>');
  expect((await stableScreenshot(anonPage, { mask: [], attempts: 3, intervalMs: 120 })).stable).toBe(false);
});

test('DETERMINISM_INIT gives every page the same Math.random sequence', async ({ anonPage, browser }) => {
  const other = await browser.newPage();
  try {
    const seq = (p: typeof anonPage) => p.evaluate((script) => { (0, eval)(script); return [Math.random(), Math.random(), Math.random()]; }, DETERMINISM_INIT);
    const a = await seq(anonPage);
    expect(await seq(other)).toEqual(a);
    for (const v of a) expect(v >= 0 && v < 1).toBe(true);
  } finally {
    await other.close();
  }
});
```

- [ ] **Step 7: Run the helper proofs**

Run: `npm run e2e:journeys -- spikes/capture-helpers.spec.ts --project desktop --no-deps`
Expected: 5 passed. `--no-deps` skips the `setup` project. These tests use no session, but the config still starts Vite on 3100.

- [ ] **Step 8: Typecheck and commit**

Run: `npm --prefix e2e run typecheck` (clean) and `npm run e2e:unit` (PASS).

```bash
git add e2e/lib/capture-plan.ts e2e/lib/capture-plan.test.ts e2e/lib/capture.ts e2e/spikes/capture-helpers.spec.ts
```
```bash
git commit -m "feat(e2e): capture plan parsing and in-page capture helpers

Seeded Math.random, settle (badge, auth state, skeletons, fonts),
document-overflow check naming the offender, and a screenshot taken
until two consecutive shots match.

Refs: [E2E-03]
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Capture spec, config projects and the first real capture

**Files:**
- Create: `e2e/capture.spec.ts`
- Modify: `e2e/playwright.config.ts`

**Interfaces:**
- Consumes: everything from Task 4; `SURFACES`, `Surface` from `surfaces.ts`; `THEME_STORAGE_KEY` from `lib/app.ts`; `stripQuery` from `lib/capture-noise.ts`; fixtures `memberPage`, `adminPage`, `anonPage`, `blocked`, options `readOnly`, `allowBlockedWriteNoise`.
- Produces: env contract read by the config and the spec. Tasks 8 and 9 set it:
  - `E2E_SIDES`: JSON `[{name, baseURL}]`, one or two entries. Capture projects exist only when it is set.
  - `E2E_RUN_DIR`: absolute folder under `e2e-results/`, required with `E2E_SIDES`.
  - `E2E_FROZEN_AT`: epoch ms, required with `E2E_SIDES`.
  - `E2E_SURFACES`: comma-separated ids. Empty means all.
  - `E2E_SERVERS_MANAGED=1`: the config starts no Vite.
  - `E2E_FULL=1`: adds `capture-webkit-mobile`.
  - `E2E_WORKERS`: capture workers, default 2.
  - Projects: `capture-desktop` (1440×1000), `capture-mobile` (390×844, `isMobile`, `hasTouch`) and optionally `capture-webkit-mobile`. Each depends on `setup`.
  - Each test pushes a `capture-target` annotation at its start and a `capture` annotation (a `CaptureNote` JSON) on success. The JSON reporter writes `<E2E_RUN_DIR>/playwright.json`.

- [ ] **Step 1: Extend `e2e/playwright.config.ts`**

Replace the whole file with:

```ts
import { defineConfig, type PlaywrightTestConfig } from '@playwright/test';
import { join, resolve, sep } from 'node:path';
import { assertAllowedBaseUrl, assertNoProdInEnv, assertStagingEnvFile, GuardError, resolveBaseUrl } from './lib/guards.ts';
import { parseSides } from './lib/capture-plan.ts';
import { RESULTS_DIR } from './lib/paths.ts';

// Web servers start before globalSetup, so the guards must also run at config load.
assertNoProdInEnv(process.env);
assertStagingEnvFile();
const baseURL = resolveBaseUrl(process.env.E2E_BASE_URL);
const local = new URL(baseURL).hostname !== 'f1.staging.carolinaminted.net';
const port = new URL(baseURL).port || '3100';

// Capture projects exist only when compare.ts or capture.ts pass sides; journeys never see them.
const sides = parseSides(process.env.E2E_SIDES);
for (const s of sides) assertAllowedBaseUrl(s.baseURL);
const runDir = process.env.E2E_RUN_DIR;
if (sides.length) {
  if (!runDir || !resolve(runDir).startsWith(RESULTS_DIR + sep)) throw new GuardError('E2E_RUN_DIR must be a folder under e2e-results/ when E2E_SIDES is set');
  if (!Number.isFinite(Number(process.env.E2E_FROZEN_AT))) throw new GuardError('E2E_FROZEN_AT (epoch ms) is required when E2E_SIDES is set');
}
// compare.ts starts its own servers with --mode staging; the request guards and the STAGING badge check still apply.
const managed = process.env.E2E_SERVERS_MANAGED === '1';

const capture = (name: string, use: PlaywrightTestConfig['use']) => ({ name, testMatch: /capture\.spec\.ts/, dependencies: ['setup'], use });
const captureProjects = sides.length ? [
  capture('capture-desktop', { browserName: 'chromium', viewport: { width: 1440, height: 1000 } }),
  capture('capture-mobile', { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }),
  ...(process.env.E2E_FULL === '1'
    ? [capture('capture-webkit-mobile', { browserName: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })]
    : []),
] : [];

export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: sides.length ? Number(process.env.E2E_WORKERS ?? 2) : 1,
  retries: 0,
  outputDir: runDir && sides.length ? join(runDir, 'test-output') : '../e2e-results/test-output',
  reporter: runDir && sides.length
    ? [['list'], ['json', { outputFile: join(runDir, 'playwright.json') }]]
    : [['list'], ['html', { outputFolder: '../e2e-results/report', open: 'never' }]],
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
    ...captureProjects,
  ],
  // reuseExistingServer is false on purpose: a stray Vite on this port in another mode could point at production.
  webServer: local && !managed
    ? { command: `npm --prefix .. run dev -- --mode staging --host 127.0.0.1 --port ${port} --strictPort`, url: baseURL, reuseExistingServer: false, timeout: 90_000 }
    : undefined,
});
```

- [ ] **Step 2: Write `e2e/capture.spec.ts`**

```ts
import { test, expect } from './fixtures.ts';
import type { Page, TestInfo } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SURFACES, type Surface } from './surfaces.ts';
import { THEME_STORAGE_KEY } from './lib/app.ts';
import { stripQuery } from './lib/capture-noise.ts';
import {
  captureKey, capturePaths, NOTE_ANNOTATION, parseSides, parseSurfaceFilter, TARGET_ANNOTATION, THEMES,
  type CaptureNote, type CaptureTarget, type Side, type Theme,
} from './lib/capture-plan.ts';
import { ariaText, assertFits, DETERMINISM_INIT, settle, stableScreenshot } from './lib/capture.ts';

// The config guarantees these whenever capture projects exist.
const sides = parseSides(process.env.E2E_SIDES);
const runDir = process.env.E2E_RUN_DIR ?? '';
const frozenAt = new Date(Number(process.env.E2E_FROZEN_AT));
const filter = parseSurfaceFilter(process.env.E2E_SURFACES, SURFACES.map((s) => s.id));
const surfaces = filter ? SURFACES.filter((s) => filter.includes(s.id)) : SURFACES;

// Capture never writes: the app's own writes are aborted and reported, and their log noise is expected.
test.use({ readOnly: true, allowBlockedWriteNoise: true });

async function capture(page: Page, surface: Surface, theme: Theme, side: Side, blocked: string[], testInfo: TestInfo): Promise<void> {
  const key = captureKey(testInfo.project.name, surface.id, theme);
  const target: CaptureTarget = { key, surface: surface.id, theme, project: testInfo.project.name, side: side.name };
  testInfo.annotations.push({ type: TARGET_ANNOTATION, description: JSON.stringify(target) });

  await page.context().addInitScript(DETERMINISM_INIT);
  await page.context().addInitScript(([k, v]) => localStorage.setItem(k, v), [THEME_STORAGE_KEY, theme] as const);
  await page.clock.setFixedTime(frozenAt);
  await page.goto(surface.path);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await settle(page, surface);
  await assertFits(page);
  const { png, stable } = await stableScreenshot(page, { mask: surface.mask?.(page) ?? [] });
  const aria = await ariaText(page);

  const paths = capturePaths(runDir, side.name, key);
  mkdirSync(dirname(paths.png), { recursive: true });
  writeFileSync(paths.png, png);
  writeFileSync(paths.aria, aria);
  const note: CaptureNote = {
    ...target, ...paths, unstable: !stable, url: page.url(),
    blockedWrites: [...new Set(blocked.filter((b) => b.startsWith('WRITE ')).map(stripQuery))],
  };
  testInfo.annotations.push({ type: NOTE_ANNOTATION, description: JSON.stringify(note) });
}

// Base and head of one surface run back to back, so live staging data has seconds to drift, not minutes.
for (const surface of surfaces) {
  for (const theme of THEMES) {
    for (const side of sides) {
      test.describe(side.name, () => {
        test.use({ baseURL: side.baseURL });
        const title = `${surface.id} ${theme} [${side.name}]`;
        if (surface.role === 'member') test(title, async ({ memberPage, blocked }, testInfo) => capture(memberPage, surface, theme, side, blocked, testInfo));
        else if (surface.role === 'admin') test(title, async ({ adminPage, blocked }, testInfo) => capture(adminPage, surface, theme, side, blocked, testInfo));
        else test(title, async ({ anonPage, blocked }, testInfo) => capture(anonPage, surface, theme, side, blocked, testInfo));
      });
    }
  }
}
```

- [ ] **Step 3: Typecheck and confirm journeys are unchanged**

Run: `npm --prefix e2e run typecheck` (clean).
Run: `npx --prefix e2e playwright test --config e2e/playwright.config.ts --list`
Expected: only `setup`, `desktop` and `mobile` tests are listed. No `capture-*` project appears without `E2E_SIDES`.

- [ ] **Step 4: First capture, two surfaces, one side, desktop**

```bash
E2E_SIDES='[{"name":"head","baseURL":"http://127.0.0.1:3100"}]' E2E_RUN_DIR="$PWD/e2e-results/manual-1" E2E_FROZEN_AT="$(node -e 'console.log(Date.now())')" E2E_SURFACES=home,standings npx --prefix e2e playwright test --config e2e/playwright.config.ts --project capture-desktop
```

Expected: 6 passed (2 setup that reuse sessions, 4 captures). `ls e2e-results/manual-1/head/capture-desktop` shows `home--dark.png`, `home--dark.aria.yml`, `home--light.png`, `home--light.aria.yml` and the same for `standings`. Open two of the PNGs with the Read tool and check two things: the page has loaded (no skeletons), and the theme matches the file name.

- [ ] **Step 5: Full single-side capture, both projects, timed**

```bash
time E2E_SIDES='[{"name":"head","baseURL":"http://127.0.0.1:3100"}]' E2E_RUN_DIR="$PWD/e2e-results/manual-2" E2E_FROZEN_AT="$(node -e 'console.log(Date.now())')" npx --prefix e2e playwright test --config e2e/playwright.config.ts --project capture-desktop --project capture-mobile
```

Expected: 106 passed (2 setup and 104 captures: 26 surfaces × 2 themes × 2 projects). Record the wall time in the worklog.

When a surface fails, read its error and trace (`npx --prefix e2e playwright show-trace <path>`), then fix it the narrowest way:
- **Skeleton never clears or data arrives late:** add a `ready` locator to that surface in `surfaces.ts`, using a role or text the loaded page shows.
- **Overflow:** this is a real app layout bug. Do not mask it, and do not change app code during the freeze. Record it in the worklog and the task report, then stop and ask the user whether to file a tracker bug and exclude that surface and project until it is fixed.
- **Console error:** if it is the [PROD-11] seed, the known-issue allowance already covers it. Otherwise stop and report the exact text.
- **Missing STAGING badge:** stop. Something is not serving staging.

Re-run only the failing surfaces with `E2E_SURFACES=<ids>` until each is green. Then run the full Step 5 command once more. It must be green in one pass.

- [ ] **Step 6: Commit**

```bash
git add e2e/capture.spec.ts e2e/playwright.config.ts e2e/surfaces.ts
```
```bash
git commit -m "feat(e2e): read-only capture of all 26 surfaces

One test per surface x theme x side, desktop and mobile Chromium, PNG
plus aria snapshot, frozen clock from E2E_FROZEN_AT. Capture projects
exist only when E2E_SIDES is set.

Refs: [E2E-03]
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Diff engine

**Files:**
- Create: `e2e/lib/diff.ts`, `e2e/lib/diff.test.ts`
- Modify: `e2e/package.json`, `e2e/package-lock.json` (add `pixelmatch`, `pngjs`, `@types/pngjs`, `diff`)

**Interfaces:**
- Produces: `type PngDiff = { diffPixels: number; diffRatio: number; sizeChanged: boolean; width: number; height: number; diffPng: Buffer }`, `diffPng(a: Buffer, b: Buffer): PngDiff`, `diffAria(a: string, b: string, label?: string): { changed: boolean; patch: string }`.

- [ ] **Step 1: Install**

Run: `npm --prefix e2e install -D pixelmatch pngjs @types/pngjs diff`
Then: `git diff --stat -- package-lock.json` prints nothing. If the installed `diff` major ships no types (`npm --prefix e2e ls diff` and look for `types` in `e2e/node_modules/diff/package.json`), also install `@types/diff`.

- [ ] **Step 2: Write the failing test** `e2e/lib/diff.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { diffAria, diffPng } from './diff.ts';

const solid = (width: number, height: number, rgba: number[], tweak?: (p: PNG) => void): Buffer => {
  const p = new PNG({ width, height });
  for (let i = 0; i < p.data.length; i += 4) p.data.set(rgba, i);
  tweak?.(p);
  return PNG.sync.write(p);
};
const WHITE = [255, 255, 255, 255];

test('identical images have no diff', () => {
  const d = diffPng(solid(10, 10, WHITE), solid(10, 10, WHITE));
  assert.deepEqual({ diffPixels: d.diffPixels, diffRatio: d.diffRatio, sizeChanged: d.sizeChanged }, { diffPixels: 0, diffRatio: 0, sizeChanged: false });
});

test('one changed pixel is counted', () => {
  const d = diffPng(solid(10, 10, WHITE), solid(10, 10, WHITE, (p) => p.data.set([0, 0, 0, 255], 0)));
  assert.equal(d.diffPixels, 1);
  assert.equal(d.diffRatio, 0.01);
});

test('a taller image counts its extra rows as changed', () => {
  const d = diffPng(solid(10, 10, WHITE), solid(10, 12, WHITE));
  assert.equal(d.sizeChanged, true);
  assert.equal(d.height, 12);
  assert.equal(d.diffPixels, 20);
  assert.ok(PNG.sync.read(d.diffPng).height === 12);
});

test('diffAria returns a patch only when the text differs', () => {
  assert.deepEqual(diffAria('- heading "A"\n', '- heading "A"\n'), { changed: false, patch: '' });
  const d = diffAria('- heading "A"\n', '- heading "B"\n', 'home.aria.yml');
  assert.equal(d.changed, true);
  assert.match(d.patch, /^-- heading "A"$/m);
  assert.match(d.patch, /^\+- heading "B"$/m);
  assert.match(d.patch, /base\/home\.aria\.yml/);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run e2e:unit`
Expected: FAIL, module not found.

- [ ] **Step 4: Write `e2e/lib/diff.ts`**

```ts
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { createTwoFilesPatch } from 'diff';

export type PngDiff = { diffPixels: number; diffRatio: number; sizeChanged: boolean; width: number; height: number; diffPng: Buffer };

// Padding is magenta so a page that grew or shrank shows its extra area as changed.
const PAD = [255, 0, 255, 255];

function padTo(img: PNG, width: number, height: number): PNG {
  if (img.width === width && img.height === height) return img;
  const out = new PNG({ width, height });
  for (let i = 0; i < out.data.length; i += 4) out.data.set(PAD, i);
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
  return out;
}

export function diffPng(a: Buffer, b: Buffer): PngDiff {
  const ia = PNG.sync.read(a);
  const ib = PNG.sync.read(b);
  const width = Math.max(ia.width, ib.width);
  const height = Math.max(ia.height, ib.height);
  const pa = padTo(ia, width, height);
  const pb = padTo(ib, width, height);
  const out = new PNG({ width, height });
  const diffPixels = pixelmatch(pa.data, pb.data, out.data, width, height, { threshold: 0.1 });
  return {
    diffPixels,
    diffRatio: diffPixels / (width * height),
    sizeChanged: ia.width !== ib.width || ia.height !== ib.height,
    width,
    height,
    diffPng: PNG.sync.write(out),
  };
}

export function diffAria(a: string, b: string, label = 'aria.yml'): { changed: boolean; patch: string } {
  if (a === b) return { changed: false, patch: '' };
  return { changed: true, patch: createTwoFilesPatch(`base/${label}`, `head/${label}`, a, b, '', '', { context: 2 }) };
}
```

- [ ] **Step 5: Run the unit tests and the typecheck**

Run: `npm run e2e:unit` then `npm --prefix e2e run typecheck`
Expected: PASS and clean.

- [ ] **Step 6: Commit**

```bash
git add e2e/lib/diff.ts e2e/lib/diff.test.ts e2e/package.json e2e/package-lock.json
```
```bash
git commit -m "feat(e2e): pixel and aria diffs for captures

pixelmatch over images padded to a shared size (growth counts as change),
and a unified patch of the aria snapshots.

Refs: [E2E-04]
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Run results, report and gallery

**Files:**
- Create: `e2e/lib/run-results.ts`, `e2e/lib/run-results.test.ts`, `e2e/lib/report.ts`, `e2e/lib/report.test.ts`, `e2e/lib/gallery.ts`, `e2e/lib/gallery.test.ts`

**Interfaces:**
- Consumes: `CaptureNote`, `CaptureTarget`, `TARGET_ANNOTATION`, `NOTE_ANNOTATION` from `capture-plan.ts`; `Selection` from `select.ts`.
- Produces:
  - `run-results.ts`: `type Annotation = { type: string; description?: string }`, `type TestOutcome = { title: string; project: string; status: string; error?: string; annotations: Annotation[] }`, `readPlaywrightResults(json: unknown): TestOutcome[]`, `readPlaywrightErrors(json: unknown): string[]`.
  - `report.ts`: `type SideInfo = { name: string; target: string; sha?: string; dirty?: boolean; url: string }`, `type RowStatus`, `type CaptureRow`, `type Failure = { title; project; error }`, `type Report`, `type Group`, `type DiffResult`, `NON_GATING_PROJECTS`, `groupOutcomes(outcomes): { groups: Map<string, Group>; hardFailures: Failure[]; warnings: Failure[]; blockedWrites: string[] }`, `buildRows(groups, sideNames: string[], diffFor: (base: CaptureNote, head: CaptureNote) => DiffResult, rel: (abs: string) => string): CaptureRow[]`.
  - `gallery.ts`: `renderGallery(report: Report): string`.

- [ ] **Step 1: Write the failing tests**

`e2e/lib/run-results.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPlaywrightErrors, readPlaywrightResults } from './run-results.ts';

const json = {
  errors: [{ message: '\u001b[31mglobal boom\u001b[39m' }],
  suites: [{
    title: 'capture.spec.ts',
    specs: [],
    suites: [{
      title: 'base',
      specs: [{
        title: 'home dark [base]',
        tests: [{
          projectName: 'capture-desktop',
          annotations: [{ type: 'capture-target', description: '{"key":"k"}' }],
          results: [{ status: 'failed', error: { message: '\u001b[2mexpect\u001b[22m failed' }, annotations: [{ type: 'capture-target', description: '{"key":"k"}' }] }],
        }],
      }],
    }],
  }],
};

test('walks nested suites, takes the last result, strips colour codes and dedupes annotations', () => {
  assert.deepEqual(readPlaywrightResults(json), [{
    title: 'home dark [base]', project: 'capture-desktop', status: 'failed', error: 'expect failed',
    annotations: [{ type: 'capture-target', description: '{"key":"k"}' }],
  }]);
});

test('reads top-level errors', () => {
  assert.deepEqual(readPlaywrightErrors(json), ['global boom']);
  assert.deepEqual(readPlaywrightErrors({}), []);
});
```

`e2e/lib/report.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRows, groupOutcomes, type DiffResult } from './report.ts';
import type { TestOutcome } from './run-results.ts';

const target = (surface: string, side: string, project = 'capture-desktop') =>
  ({ key: `${project}/${surface}--dark`, surface, theme: 'dark', project, side });
const ok = (surface: string, side: string, extra: Record<string, unknown> = {}, project = 'capture-desktop'): TestOutcome => ({
  title: `${surface} dark [${side}]`, project, status: 'passed',
  annotations: [
    { type: 'capture-target', description: JSON.stringify(target(surface, side, project)) },
    { type: 'capture', description: JSON.stringify({ ...target(surface, side, project), png: `/r/${side}/${surface}.png`, aria: `/r/${side}/${surface}.aria.yml`, unstable: false, blockedWrites: ['WRITE POST https://x/Write/channel'], url: '/', ...extra }) },
  ],
});
const failed = (surface: string, side: string, project = 'capture-desktop'): TestOutcome => ({
  title: `${surface} dark [${side}]`, project, status: 'failed', error: 'page overflows horizontally by 9px: div#x\nmore',
  annotations: [{ type: 'capture-target', description: JSON.stringify(target(surface, side, project)) }],
});
const same: DiffResult = { diffPixels: 0, diffRatio: 0, sizeChanged: false, ariaChanged: false, ariaPatch: '', diffImage: '/r/diff/x.png' };
const rel = (abs: string) => abs.replace('/r/', '');

test('groups notes by key, gates Chromium failures and only warns for WebKit', () => {
  const g = groupOutcomes([ok('home', 'base'), failed('home', 'head'), failed('home', 'head', 'capture-webkit-mobile'), { title: 'sign in as admin', project: 'setup', status: 'failed', error: 'x', annotations: [] }]);
  assert.equal(g.groups.get('capture-desktop/home--dark')!.notes.size, 1);
  assert.deepEqual(g.groups.get('capture-desktop/home--dark')!.failures, ['[head] page overflows horizontally by 9px: div#x']);
  assert.deepEqual(g.hardFailures.map((f) => f.project), ['capture-desktop', 'setup']);
  assert.deepEqual(g.warnings.map((f) => f.project), ['capture-webkit-mobile']);
  assert.deepEqual(g.blockedWrites, ['WRITE POST https://x/Write/channel']);
});

test('rows: failed first, then changed by ratio, then missing, then unchanged', () => {
  const g = groupOutcomes([
    ok('a', 'base'), ok('a', 'head'),
    ok('b', 'base'), ok('b', 'head'),
    ok('c', 'base'),
    ok('d', 'base'), failed('d', 'head'),
    ok('e', 'base'), ok('e', 'head'),
  ]);
  const diffs: Record<string, DiffResult> = {
    a: same,
    b: { ...same, diffPixels: 50, diffRatio: 0.5 },
    e: { ...same, diffPixels: 10, diffRatio: 0.1, ariaChanged: true, ariaPatch: 'patch' },
  };
  const rows = buildRows(g.groups, ['base', 'head'], (base) => diffs[base.surface], rel);
  assert.deepEqual(rows.map((r) => [r.surface, r.status]), [['d', 'failed'], ['b', 'changed'], ['e', 'changed'], ['c', 'missing'], ['a', 'unchanged']]);
  assert.deepEqual(rows[1].images, { base: 'base/b.png', head: 'head/b.png', diff: 'diff/x.png' });
  assert.equal(rows.find((r) => r.surface === 'a')!.images.diff, undefined);
});

test('a one-side run marks rows captured without diffing', () => {
  const g = groupOutcomes([ok('a', 'after-conclude')]);
  const rows = buildRows(g.groups, ['after-conclude'], () => { throw new Error('no diff for one side'); }, rel);
  assert.deepEqual(rows.map((r) => r.status), ['captured']);
});
```

`e2e/lib/gallery.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderGallery } from './gallery.ts';
import type { CaptureRow, Report } from './report.ts';

const row = (surface: string, status: CaptureRow['status'], extra: Partial<CaptureRow> = {}): CaptureRow => ({
  key: `capture-desktop/${surface}--dark`, surface, theme: 'dark', project: 'capture-desktop', status,
  diffPixels: 0, diffRatio: 0, sizeChanged: false, ariaChanged: false, unstable: false,
  images: { base: `base/${surface}.png`, head: `head/${surface}.png` }, failures: [], ...extra,
});
const report = (rows: CaptureRow[], extra: Partial<Report> = {}): Report => ({
  run: 'r1', startedAt: '2026-11-26T00:00:00.000Z', durationMs: 1000, frozenAt: 0,
  sides: [{ name: 'base', target: 'staging', sha: 'abc', url: 'http://127.0.0.1:3101' }, { name: 'head', target: 'worktree', sha: 'def', dirty: true, url: 'http://127.0.0.1:3100' }],
  selection: { all: false, ids: ['a', 'b'], reasons: ['components/X.tsx → a, b'] },
  rows, hardFailures: [], warnings: [], blockedWrites: [], ...extra,
});

test('escapes text from the page and the run', () => {
  const html = renderGallery(report([row('a', 'changed', { diffPixels: 1, diffRatio: 0.5, ariaChanged: true, ariaPatch: '+ <script>alert(1)</script>' })]));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('changed cards come before the collapsed unchanged ones', () => {
  const html = renderGallery(report([row('b', 'changed', { diffPixels: 5, diffRatio: 0.1 }), row('a', 'unchanged')]));
  const unchanged = html.indexOf('<details class="unchanged"');
  assert.ok(unchanged > 0);
  assert.ok(html.indexOf('capture-desktop/b--dark') < unchanged);
  assert.ok(unchanged < html.indexOf('capture-desktop/a--dark'));
  assert.match(html, /1 changed · 0 failed · 0 missing · 1 unchanged/);
});

test('hard failures and selection reasons are shown', () => {
  const html = renderGallery(report([], { hardFailures: [{ title: 'home dark [head]', project: 'capture-desktop', error: 'page overflows' }] }));
  assert.match(html, /page overflows/);
  assert.match(html, /components\/X\.tsx → a, b/);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run e2e:unit`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `e2e/lib/run-results.ts`**

```ts
export type Annotation = { type: string; description?: string };
export type TestOutcome = { title: string; project: string; status: string; error?: string; annotations: Annotation[] };

type JsonResult = { status?: string; error?: { message?: string }; errors?: { message?: string }[]; annotations?: Annotation[] };
type JsonTest = { projectName: string; annotations?: Annotation[]; results?: JsonResult[] };
type JsonSuite = { specs?: { title: string; tests: JsonTest[] }[]; suites?: JsonSuite[] };

const ANSI = /\u001b\[[0-9;]*m/g;
const clean = (s?: string) => s?.replace(ANSI, '');

// Runtime annotations sit on the test in older reporters and on the result in newer ones; read both.
const dedupe = (list: Annotation[]) => [...new Map(list.map((a) => [`${a.type}\u0000${a.description ?? ''}`, a])).values()];

export function readPlaywrightResults(json: unknown): TestOutcome[] {
  const out: TestOutcome[] = [];
  const walk = (suite: JsonSuite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests) {
        const last = t.results?.at(-1);
        out.push({
          title: spec.title,
          project: t.projectName,
          status: last?.status ?? 'skipped',
          // A test can fail in its body and again at fixture teardown (console errors); keep every message.
          error: clean(last?.errors?.length ? last.errors.map((e) => e.message ?? '').join('\n---\n') : last?.error?.message),
          annotations: dedupe([...(t.annotations ?? []), ...(last?.annotations ?? [])]),
        });
      }
    }
    for (const s of suite.suites ?? []) walk(s);
  };
  for (const s of (json as { suites?: JsonSuite[] }).suites ?? []) walk(s);
  return out;
}

export function readPlaywrightErrors(json: unknown): string[] {
  return ((json as { errors?: { message?: string }[] }).errors ?? []).map((e) => clean(e.message) ?? 'unknown error');
}
```

- [ ] **Step 4: Write `e2e/lib/report.ts`**

```ts
import type { CaptureNote, CaptureTarget } from './capture-plan.ts';
import { NOTE_ANNOTATION, TARGET_ANNOTATION } from './capture-plan.ts';
import type { Selection } from './select.ts';
import type { TestOutcome } from './run-results.ts';

export type SideInfo = { name: string; target: string; sha?: string; dirty?: boolean; url: string };
export type RowStatus = 'failed' | 'changed' | 'missing' | 'captured' | 'unchanged';
export type CaptureRow = {
  key: string; surface: string; theme: string; project: string; status: RowStatus;
  diffPixels: number; diffRatio: number; sizeChanged: boolean; ariaChanged: boolean; unstable: boolean;
  images: Record<string, string>;  // side name, or 'diff', to a path relative to the run folder
  ariaPatch?: string; failures: string[];
};
export type Failure = { title: string; project: string; error: string };
export type Report = {
  run: string; startedAt: string; durationMs: number; frozenAt: number; sides: SideInfo[]; selection: Selection;
  rows: CaptureRow[]; hardFailures: Failure[]; warnings: Failure[]; blockedWrites: string[];
};
export type Group = { target: Omit<CaptureTarget, 'side'>; notes: Map<string, CaptureNote>; failures: string[] };
export type DiffResult = { diffPixels: number; diffRatio: number; sizeChanged: boolean; ariaChanged: boolean; ariaPatch: string; diffImage: string };

// WebKit mobile is non-gating until PROD-09 is understood.
export const NON_GATING_PROJECTS = ['capture-webkit-mobile'];
const FAILED = new Set(['failed', 'timedOut', 'interrupted']);

const parse = <T>(outcome: TestOutcome, type: string): T | undefined => {
  const a = outcome.annotations.find((x) => x.type === type);
  return a?.description ? (JSON.parse(a.description) as T) : undefined;
};

export function groupOutcomes(outcomes: TestOutcome[]): { groups: Map<string, Group>; hardFailures: Failure[]; warnings: Failure[]; blockedWrites: string[] } {
  const groups = new Map<string, Group>();
  const hardFailures: Failure[] = [];
  const warnings: Failure[] = [];
  const blocked = new Set<string>();
  for (const o of outcomes) {
    const target = parse<CaptureTarget>(o, TARGET_ANNOTATION);
    let group: Group | undefined;
    if (target) {
      const { side: _side, ...rest } = target;
      group = groups.get(target.key) ?? { target: rest, notes: new Map(), failures: [] };
      groups.set(target.key, group);
    }
    if (FAILED.has(o.status)) {
      const failure = { title: o.title, project: o.project, error: o.error ?? o.status };
      (NON_GATING_PROJECTS.includes(o.project) ? warnings : hardFailures).push(failure);
      if (group && target) group.failures.push(`[${target.side}] ${failure.error.split('\n')[0]}`);
      continue;
    }
    const note = parse<CaptureNote>(o, NOTE_ANNOTATION);
    if (group && note) {
      group.notes.set(note.side, note);
      note.blockedWrites.forEach((b) => blocked.add(b));
    }
  }
  return { groups, hardFailures, warnings, blockedWrites: [...blocked].sort() };
}

const RANK: Record<RowStatus, number> = { failed: 0, changed: 1, missing: 2, captured: 3, unchanged: 4 };

export function buildRows(
  groups: Map<string, Group>,
  sideNames: string[],
  diffFor: (base: CaptureNote, head: CaptureNote) => DiffResult,
  rel: (abs: string) => string,
): CaptureRow[] {
  const rows: CaptureRow[] = [];
  for (const [key, g] of groups) {
    const images: Record<string, string> = {};
    for (const name of sideNames) { const n = g.notes.get(name); if (n) images[name] = rel(n.png); }
    const row: CaptureRow = {
      key, surface: g.target.surface, theme: g.target.theme, project: g.target.project, status: 'missing',
      diffPixels: 0, diffRatio: 0, sizeChanged: false, ariaChanged: false,
      unstable: [...g.notes.values()].some((n) => n.unstable), images, failures: g.failures,
    };
    const [baseName, headName] = sideNames;
    const base = g.notes.get(baseName);
    const head = headName ? g.notes.get(headName) : undefined;
    if (g.failures.length) row.status = 'failed';
    else if (sideNames.length === 1) row.status = base ? 'captured' : 'missing';
    else if (base && head) {
      const d = diffFor(base, head);
      Object.assign(row, { diffPixels: d.diffPixels, diffRatio: d.diffRatio, sizeChanged: d.sizeChanged, ariaChanged: d.ariaChanged });
      const changed = d.diffPixels > 0 || d.sizeChanged || d.ariaChanged;
      row.status = changed ? 'changed' : 'unchanged';
      if (d.diffPixels > 0 || d.sizeChanged) row.images.diff = rel(d.diffImage);
      if (d.ariaChanged) row.ariaPatch = d.ariaPatch;
    }
    rows.push(row);
  }
  return rows.sort((a, b) => RANK[a.status] - RANK[b.status] || b.diffRatio - a.diffRatio || Number(b.ariaChanged) - Number(a.ariaChanged) || a.key.localeCompare(b.key));
}
```

- [ ] **Step 5: Write `e2e/lib/gallery.ts`**

```ts
import type { CaptureRow, Failure, Report } from './report.ts';

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function badge(row: CaptureRow): string {
  const bits: string[] = [row.status];
  if (row.status === 'changed') {
    if (row.diffPixels) bits.push(`${(row.diffRatio * 100).toFixed(2)}% px`);
    if (row.sizeChanged) bits.push('size');
    if (row.ariaChanged) bits.push('aria');
  }
  if (row.unstable) bits.push('unstable');
  return bits.join(' · ');
}

function card(row: CaptureRow): string {
  const figures = Object.entries(row.images).map(([name, src]) =>
    `<figure><figcaption>${esc(name)}</figcaption><a href="${esc(src)}"><img loading="lazy" src="${esc(src)}" alt="${esc(`${row.key} ${name}`)}"></a></figure>`).join('');
  return `<section class="card ${row.status}"><h2>${esc(row.key)} <span>${esc(badge(row))}</span></h2>`
    + row.failures.map((f) => `<p class="fail">${esc(f)}</p>`).join('')
    + `<div class="imgs">${figures}</div>`
    + (row.ariaPatch ? `<pre>${esc(row.ariaPatch)}</pre>` : '')
    + '</section>';
}

const failureList = (title: string, list: Failure[], cls: string) => list.length
  ? `<h2 class="${cls}">${esc(title)}</h2><ul>${list.map((f) => `<li class="${cls}"><b>${esc(f.project)}</b> ${esc(f.title)}<pre>${esc(f.error)}</pre></li>`).join('')}</ul>`
  : '';

export function renderGallery(r: Report): string {
  const count = (s: CaptureRow['status']) => r.rows.filter((x) => x.status === s).length;
  const open = r.rows.filter((x) => x.status !== 'unchanged');
  const quiet = r.rows.filter((x) => x.status === 'unchanged');
  const sides = r.sides.map((s) => `<li><b>${esc(s.name)}</b> ${esc(s.target)}${s.sha ? ` @ ${esc(s.sha.slice(0, 8))}` : ''}${s.dirty ? ' (uncommitted changes)' : ''} — ${esc(s.url)}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>e2e ${esc(r.run)}</title>
<style>
body{font:14px/1.4 system-ui,sans-serif;margin:24px;background:#111;color:#eee}
a{color:#9cf} pre{white-space:pre-wrap;background:#000;padding:8px;overflow:auto;max-height:24em}
.card{border:1px solid #333;margin:16px 0;padding:12px}.card h2{font-size:15px;margin:0 0 8px}.card h2 span{font-weight:normal;color:#aaa}
.failed{border-color:#e33}.changed{border-color:#e90}.fail{color:#f66}.warn{color:#fc6}
.imgs{display:flex;gap:8px;align-items:flex-start}figure{margin:0;flex:1;min-width:0}img{width:100%;border:1px solid #333}
</style></head><body>
<h1>e2e ${esc(r.run)}</h1>
<ul>${sides}</ul>
<p>Frozen at ${esc(new Date(r.frozenAt).toISOString())} · ${Math.round(r.durationMs / 1000)} s · ${count('changed')} changed · ${count('failed')} failed · ${count('missing')} missing · ${count('unchanged')} unchanged${count('captured') ? ` · ${count('captured')} captured` : ''}</p>
<details><summary>Selection: ${r.selection.ids.length} surfaces${r.selection.all ? ' (all)' : ''}</summary><ul>${r.selection.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>
${failureList('Hard failures', r.hardFailures, 'fail')}
${failureList('Warnings (non-gating)', r.warnings, 'warn')}
${r.blockedWrites.length ? `<details><summary>Writes blocked by read-only mode: ${r.blockedWrites.length}</summary><ul>${r.blockedWrites.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></details>` : ''}
${open.map(card).join('\n')}
${quiet.length ? `<details class="unchanged"><summary>${quiet.length} unchanged</summary>${quiet.map(card).join('\n')}</details>` : ''}
</body></html>
`;
}
```

- [ ] **Step 6: Run the unit tests and the typecheck**

Run: `npm run e2e:unit` then `npm --prefix e2e run typecheck`
Expected: PASS and clean.

- [ ] **Step 7: Check the reader against a real Playwright JSON report**

```bash
E2E_SIDES='[{"name":"head","baseURL":"http://127.0.0.1:3100"}]' E2E_RUN_DIR="$PWD/e2e-results/manual-3" E2E_FROZEN_AT="$(node -e 'console.log(Date.now())')" E2E_SURFACES=home npx --prefix e2e playwright test --config e2e/playwright.config.ts --project capture-desktop
```
```bash
node --experimental-transform-types --no-warnings -e "import('./e2e/lib/run-results.ts').then(({ readPlaywrightResults }) => { const o = readPlaywrightResults(JSON.parse(require('node:fs').readFileSync('e2e-results/manual-3/playwright.json','utf8'))); console.log(o.map((x) => [x.project, x.title, x.status, x.annotations.map((a) => a.type).join(',')].join(' | ')).join('\n')); })"
```
Expected: two setup rows and two `capture-desktop | home … [head] | passed | capture-target,capture` rows. If the annotations come back empty, Playwright 1.63 nests them somewhere this reader does not look. Print one test object from the JSON with `node -e` and add that location to `readPlaywrightResults`, along with a unit test for it.

- [ ] **Step 8: Commit**

```bash
git add e2e/lib/run-results.ts e2e/lib/run-results.test.ts e2e/lib/report.ts e2e/lib/report.test.ts e2e/lib/gallery.ts e2e/lib/gallery.test.ts
```
```bash
git commit -m "feat(e2e): report rows and the diff gallery

Reads Playwright's JSON report, groups captures by key, gates Chromium
failures (WebKit only warns), orders failed and most-changed first and
renders a self-contained index.html.

Refs: [E2E-04]
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Compare plumbing — arguments, sides, changed files, checkouts, servers

**Files:**
- Create: `e2e/lib/compare-args.ts`, `e2e/lib/compare-args.test.ts`, `e2e/lib/sides.ts`, `e2e/lib/sides.test.ts`, `e2e/lib/changed-files.ts`, `e2e/lib/changed-files.test.ts`, `e2e/lib/checkouts.ts`, `e2e/lib/servers.ts`, `e2e/lib/servers.test.ts`

**Interfaces:**
- Consumes: `GuardError`, `assertAllowedBaseUrl`, `assertStagingEnvFile`, `stagingWebApiKey` from `guards.ts`; `REPO_ROOT` from `paths.ts`.
- Produces:
  - `compare-args.ts`: `type CompareArgs = { base: string; head: string; all: boolean; surfaces: string[] | null; full: boolean; plan: boolean; pruneBases: boolean }`, `parseCompareArgs(argv): CompareArgs`, `type CaptureArgs = { label: string; target: string; surfaces: string[] | null; full: boolean }`, `parseCaptureArgs(argv): CaptureArgs`.
  - `sides.ts`: `STAGING_ORIGIN`, `type Target`, `classifyTarget(raw): Target`, `type Resolved = { kind: 'worktree'; root: string; sha: string; dirty: boolean } | { kind: 'ref'; ref: string; sha: string } | { kind: 'url'; url: string }`, `resolveTarget(t, cwd?): Resolved`.
  - `changed-files.ts`: `lines(text): string[]`, `changedFiles(baseSha: string, head: Resolved, cwd?): string[]`.
  - `checkouts.ts`: `BASE_PREFIX`, `baseWorktreesDir(): string`, `baseWorktreePath(sha, dir?): string`, `ensureCheckout(sha, log?): string`, `pruneBaseWorktrees(): string[]`.
  - `servers.ts`: `type Server = { url: string; stop: () => Promise<void> }`, `assertPortFree(port): Promise<void>`, `startVite(root, port, logFile, timeoutMs?): Promise<Server>`.

- [ ] **Step 1: Write the failing tests**

`e2e/lib/compare-args.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCaptureArgs, parseCompareArgs } from './compare-args.ts';

test('compare defaults to staging vs this checkout, affected surfaces only', () => {
  assert.deepEqual(parseCompareArgs([]), { base: 'staging', head: 'worktree', all: false, surfaces: null, full: false, plan: false, pruneBases: false });
});

test('compare reads flags in both spellings', () => {
  assert.deepEqual(parseCompareArgs(['--base', 'origin/prod', '--head=staging', '--all', '--full', '--plan', '--surfaces', 'home,league']), {
    base: 'origin/prod', head: 'staging', all: true, surfaces: ['home', 'league'], full: true, plan: true, pruneBases: false,
  });
  assert.equal(parseCompareArgs(['--prune-bases']).pruneBases, true);
});

test('compare refuses --mode and anything unknown', () => {
  assert.throws(() => parseCompareArgs(['--mode', 'production']), /--mode is not accepted/);
  assert.throws(() => parseCompareArgs(['--mode=production']), /--mode is not accepted/);
  assert.throws(() => parseCompareArgs(['--bsae', 'x']), /unknown argument --bsae/);
  assert.throws(() => parseCompareArgs(['--base']), /--base needs a value/);
});

test('capture needs a safe label', () => {
  assert.deepEqual(parseCaptureArgs(['--label', 'after-conclude']), { label: 'after-conclude', target: 'worktree', surfaces: null, full: false });
  assert.throws(() => parseCaptureArgs([]), /--label is required/);
  assert.throws(() => parseCaptureArgs(['--label', '../x']), /--label must be/);
  assert.throws(() => parseCaptureArgs(['--label', 'x', '--mode', 'staging']), /--mode is not accepted/);
});
```

`e2e/lib/sides.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTarget } from './sides.ts';

test('worktree, refs and the staging URL are recognised', () => {
  assert.deepEqual(classifyTarget('worktree'), { kind: 'worktree' });
  assert.deepEqual(classifyTarget('origin/prod'), { kind: 'ref', ref: 'origin/prod' });
  assert.deepEqual(classifyTarget('HEAD~1'), { kind: 'ref', ref: 'HEAD~1' });
  assert.deepEqual(classifyTarget('https://f1.staging.carolinaminted.net/'), { kind: 'url', url: 'https://f1.staging.carolinaminted.net' });
});

test('production and local URLs are refused', () => {
  assert.throws(() => classifyTarget('https://f1.carolinaminted.net'), (e: Error) => e.name === 'GuardError');
  assert.throws(() => classifyTarget('http://127.0.0.1:3100'), /must be https:\/\/f1\.staging\.carolinaminted\.net/);
});

test('things that are not refs are refused', () => {
  assert.throws(() => classifyTarget('-rf'), /not a git ref/);
  assert.throws(() => classifyTarget('a b'), /not a git ref/);
});
```

Check `GuardError` first. Read `e2e/lib/guards.ts:5-8` and confirm the class sets `this.name = 'GuardError'`. If it does not, assert with `instanceof GuardError` instead.

`e2e/lib/changed-files.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedFiles, lines } from './changed-files.ts';
import { resolveTarget } from './sides.ts';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();

test('lines trims and drops blanks', () => {
  assert.deepEqual(lines(' a \n\nb\n'), ['a', 'b']);
});

test('changedFiles covers commits, uncommitted and untracked work, and both sides of a rename', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lol-e2e-changed-'));
  try {
    git(dir, 'init', '-q');
    mkdirSync(join(dir, 'components'));
    writeFileSync(join(dir, 'components/A.tsx'), 'a');
    writeFileSync(join(dir, 'components/Old.tsx'), 'old');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'one');
    const base = git(dir, 'rev-parse', 'HEAD');
    git(dir, 'mv', 'components/Old.tsx', 'components/New.tsx');
    git(dir, 'commit', '-qm', 'two');
    const head = git(dir, 'rev-parse', 'HEAD');
    assert.deepEqual(changedFiles(base, { kind: 'ref', ref: 'HEAD', sha: head }, dir), ['components/New.tsx', 'components/Old.tsx']);
    writeFileSync(join(dir, 'components/A.tsx'), 'a2');
    writeFileSync(join(dir, 'zz-new.ts'), 'new');
    const wt = resolveTarget({ kind: 'worktree' }, dir);
    assert.equal(wt.kind === 'worktree' && wt.dirty, true);
    assert.deepEqual(changedFiles(base, wt, dir), ['components/A.tsx', 'components/New.tsx', 'components/Old.tsx', 'zz-new.ts']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

`e2e/lib/servers.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run e2e:unit`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `e2e/lib/compare-args.ts`**

```ts
import { GuardError } from './guards.ts';

export type CompareArgs = { base: string; head: string; all: boolean; surfaces: string[] | null; full: boolean; plan: boolean; pruneBases: boolean };
export type CaptureArgs = { label: string; target: string; surfaces: string[] | null; full: boolean };

type Parsed = { values: Map<string, string>; flags: Set<string> };

function parse(argv: string[], valueFlags: string[], boolFlags: string[]): Parsed {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const eq = argv[i].indexOf('=');
    const name = eq > 0 ? argv[i].slice(0, eq) : argv[i];
    if (name === '--mode') throw new GuardError('the harness always serves --mode staging; --mode is not accepted');
    if (valueFlags.includes(name)) {
      const value = eq > 0 ? argv[i].slice(eq + 1) : argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`);
      values.set(name, value);
    } else if (boolFlags.includes(name) && eq < 0) {
      flags.add(name);
    } else {
      throw new Error(`unknown argument ${name}`);
    }
  }
  return { values, flags };
}

const list = (raw?: string) => (raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : null);

export function parseCompareArgs(argv: string[]): CompareArgs {
  const p = parse(argv, ['--base', '--head', '--surfaces'], ['--all', '--full', '--plan', '--prune-bases']);
  return {
    base: p.values.get('--base') ?? 'staging',
    head: p.values.get('--head') ?? 'worktree',
    all: p.flags.has('--all'),
    surfaces: list(p.values.get('--surfaces')),
    full: p.flags.has('--full'),
    plan: p.flags.has('--plan'),
    pruneBases: p.flags.has('--prune-bases'),
  };
}

export function parseCaptureArgs(argv: string[]): CaptureArgs {
  const p = parse(argv, ['--label', '--target', '--surfaces'], ['--full']);
  const label = p.values.get('--label');
  if (!label) throw new Error('--label is required, for example --label after-conclude');
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(label)) throw new Error('--label must be lowercase letters, digits and dashes');
  return { label, target: p.values.get('--target') ?? 'worktree', surfaces: list(p.values.get('--surfaces')), full: p.flags.has('--full') };
}
```

- [ ] **Step 4: Write `e2e/lib/sides.ts`**

```ts
import { execFileSync } from 'node:child_process';
import { assertAllowedBaseUrl, GuardError } from './guards.ts';
import { REPO_ROOT } from './paths.ts';

export const STAGING_ORIGIN = 'https://f1.staging.carolinaminted.net';

export type Target = { kind: 'worktree' } | { kind: 'url'; url: string } | { kind: 'ref'; ref: string };
export type Resolved =
  | { kind: 'worktree'; root: string; sha: string; dirty: boolean }
  | { kind: 'ref'; ref: string; sha: string }
  | { kind: 'url'; url: string };

export function classifyTarget(raw: string): Target {
  if (raw === 'worktree') return { kind: 'worktree' };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    assertAllowedBaseUrl(raw);
    // Local servers are started by compare itself in --mode staging; an existing one could be in any mode.
    if (new URL(raw).origin !== STAGING_ORIGIN) throw new GuardError(`a URL side must be ${STAGING_ORIGIN}`);
    return { kind: 'url', url: STAGING_ORIGIN };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/~^@{}-]*$/.test(raw)) throw new Error(`not a git ref: ${raw}`);
  return { kind: 'ref', ref: raw };
}

const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

export function resolveTarget(t: Target, cwd = REPO_ROOT): Resolved {
  if (t.kind === 'url') return t;
  if (t.kind === 'worktree') return { kind: 'worktree', root: cwd, sha: git(cwd, ['rev-parse', 'HEAD']), dirty: git(cwd, ['status', '--porcelain']).length > 0 };
  return { kind: 'ref', ref: t.ref, sha: git(cwd, ['rev-parse', '--verify', '--end-of-options', `${t.ref}^{commit}`]) };
}
```

If the `GuardError` check in Step 1 found the class sets no `name`, the URL test uses `instanceof`. Make the refusal `throw new GuardError(...)` either way.

- [ ] **Step 5: Write `e2e/lib/changed-files.ts`**

```ts
import { execFileSync } from 'node:child_process';
import { REPO_ROOT } from './paths.ts';
import type { Resolved } from './sides.ts';

export const lines = (text: string): string[] => text.split('\n').map((l) => l.trim()).filter(Boolean);

const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });

// --no-renames lists both the old and the new path, so either side's importers are selected.
export function changedFiles(baseSha: string, head: Resolved, cwd = REPO_ROOT): string[] {
  if (head.kind === 'url') throw new Error('a URL side has no source to diff');
  const files = head.kind === 'worktree'
    ? [...lines(git(cwd, ['diff', '--name-only', '--no-renames', baseSha])), ...lines(git(cwd, ['ls-files', '--others', '--exclude-standard']))]
    : lines(git(cwd, ['diff', '--name-only', '--no-renames', baseSha, head.sha]));
  return [...new Set(files)].sort();
}
```

- [ ] **Step 6: Write `e2e/lib/servers.ts`**

```ts
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
```

- [ ] **Step 7: Write `e2e/lib/checkouts.ts`**

```ts
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { assertStagingEnvFile, GuardError, stagingWebApiKey } from './guards.ts';
import { REPO_ROOT } from './paths.ts';

export const BASE_PREFIX = 'lol-e2e-base-';

const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const mainCheckout = () => dirname(git(REPO_ROOT, ['rev-parse', '--path-format=absolute', '--git-common-dir']));

// Next to the other worktrees, outside every checkout: /Users/jhh/Codebase/jhh-ai/.worktrees.
export const baseWorktreesDir = (): string => process.env.E2E_BASE_WORKTREES_DIR ?? resolve(mainCheckout(), '..', '.worktrees');
export const baseWorktreePath = (sha: string, dir = baseWorktreesDir()): string => join(dir, `${BASE_PREFIX}${sha.slice(0, 12)}`);

// One detached worktree per commit, reused across runs; npm ci runs once per lockfile.
export function ensureCheckout(sha: string, log: (m: string) => void = console.log): string {
  const root = baseWorktreePath(sha);
  if (existsSync(root)) {
    const at = git(root, ['rev-parse', 'HEAD']);
    if (at !== sha) throw new Error(`${root} is at ${at}, expected ${sha}; remove it with: npm run e2e:compare -- --prune-bases`);
  } else {
    log(`creating base worktree ${root}`);
    git(REPO_ROOT, ['worktree', 'add', '--detach', root, sha]);
  }
  const lockHash = createHash('sha256').update(readFileSync(join(root, 'package-lock.json'))).digest('hex');
  const marker = join(root, 'node_modules', '.e2e-lock-hash');
  if (!existsSync(marker) || readFileSync(marker, 'utf8') !== lockHash) {
    log(`npm ci in ${root} (first use of this commit)`);
    execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
    writeFileSync(marker, lockHash);
  }
  assertStagingEnvFile(root);
  if (stagingWebApiKey(root) !== stagingWebApiKey(REPO_ROOT)) {
    throw new GuardError(`${root}/.env.staging has a different web API key from this checkout, so the request guard would block it`);
  }
  return root;
}

// Removes only harness-owned base worktrees. --force because their node_modules is untracked.
export function pruneBaseWorktrees(): string[] {
  const paths = git(REPO_ROOT, ['worktree', 'list', '--porcelain'])
    .split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice('worktree '.length))
    .filter((p) => basename(p).startsWith(BASE_PREFIX));
  for (const p of paths) git(REPO_ROOT, ['worktree', 'remove', '--force', p]);
  return paths;
}
```

- [ ] **Step 8: Run the unit tests and the typecheck**

Run: `npm run e2e:unit` then `npm --prefix e2e run typecheck`
Expected: PASS and clean.

- [ ] **Step 9: Commit**

```bash
git add e2e/lib/compare-args.ts e2e/lib/compare-args.test.ts e2e/lib/sides.ts e2e/lib/sides.test.ts e2e/lib/changed-files.ts e2e/lib/changed-files.test.ts e2e/lib/checkouts.ts e2e/lib/servers.ts e2e/lib/servers.test.ts
```
```bash
git commit -m "feat(e2e): compare plumbing for sides, checkouts and servers

Arguments refuse --mode and unknown flags; a URL side must be staging;
refs become reusable detached worktrees outside the repo; Vite starts
only on a free port and always in --mode staging.

Refs: [E2E-04]
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Orchestration and the two CLIs

**Files:**
- Create: `e2e/lib/orchestrate.ts`, `e2e/lib/orchestrate.test.ts`, `e2e/scripts/compare.ts`, `e2e/scripts/capture.ts`
- Modify: `e2e/package.json` (scripts), `package.json` (root `e2e:*` scripts)

**Interfaces:**
- Consumes: Tasks 3, 5, 6, 7 and 8.
- Produces: `runName(startedAt: Date, base: string, head: string): string`, `selectionFor(o: { surfaces: string[] | null; all: boolean; base: Resolved; head: Resolved }): Selection`, `runPlaywrightCapture(o: { runDir; sides: Side[]; surfaceIds: string[]; frozenAt: number; full: boolean; setupBaseURL: string }): number`, `finalizeRun(o: { runDir; run; startedAt: Date; frozenAt: number; sides: SideInfo[]; selection: Selection }): Report`; CLIs `npm run e2e:compare` and `npm run e2e:capture`.

- [ ] **Step 1: Write the failing test** `e2e/lib/orchestrate.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runName, selectionFor } from './orchestrate.ts';
import { SURFACES } from '../surfaces.ts';

const ref = { kind: 'ref' as const, ref: 'x', sha: 'a'.repeat(40) };

test('runName is sortable and filesystem-safe', () => {
  assert.equal(runName(new Date('2026-11-26T22:15:03.123Z'), 'origin/prod', 'worktree'), '20261126T221503Z-origin-prod-vs-worktree');
});

test('explicit surfaces win and unknown ones are refused', () => {
  assert.deepEqual(selectionFor({ surfaces: ['league', 'home'], all: false, base: ref, head: ref }), { all: false, ids: ['home', 'league'], reasons: ['--surfaces'] });
  assert.throws(() => selectionFor({ surfaces: ['nope'], all: false, base: ref, head: ref }), /unknown surface/);
});

test('--all and URL sides select everything without reading git', () => {
  assert.equal(selectionFor({ surfaces: null, all: true, base: ref, head: ref }).ids.length, SURFACES.length);
  const url = { kind: 'url' as const, url: 'https://f1.staging.carolinaminted.net' };
  assert.deepEqual(selectionFor({ surfaces: null, all: false, base: ref, head: url }).reasons, ['a URL side has no source to diff → all']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run e2e:unit`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `e2e/lib/orchestrate.ts`**

```ts
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { SURFACES } from '../surfaces.ts';
import { closuresFor, fsReader, gitReader, type Reader } from './import-graph.ts';
import { isShared, selectSurfaces, type Selection } from './select.ts';
import { changedFiles } from './changed-files.ts';
import type { Resolved } from './sides.ts';
import type { CaptureNote, Side } from './capture-plan.ts';
import { readPlaywrightErrors, readPlaywrightResults } from './run-results.ts';
import { buildRows, groupOutcomes, type DiffResult, type Report, type SideInfo } from './report.ts';
import { diffAria, diffPng } from './diff.ts';
import { renderGallery } from './gallery.ts';
import { E2E_ROOT } from './paths.ts';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

export const runName = (startedAt: Date, base: string, head: string): string =>
  `${startedAt.toISOString().replace(/\.\d+Z$/, 'Z').replace(/[-:]/g, '')}-${slug(base)}-vs-${slug(head)}`;

const readerFor = (r: Exclude<Resolved, { kind: 'url' }>): Reader => (r.kind === 'worktree' ? fsReader(r.root) : gitReader(r.sha));

export function selectionFor(o: { surfaces: string[] | null; all: boolean; base: Resolved; head: Resolved }): Selection {
  const ids = SURFACES.map((s) => s.id);
  if (o.surfaces) {
    const unknown = o.surfaces.filter((s) => !ids.includes(s));
    if (unknown.length) throw new Error(`unknown surface(s): ${unknown.join(', ')}; known: ${ids.join(', ')}`);
    return { all: false, ids: ids.filter((id) => o.surfaces!.includes(id)), reasons: ['--surfaces'] };
  }
  if (o.all) return { all: true, ids, reasons: ['--all'] };
  if (o.base.kind === 'url' || o.head.kind === 'url') return { all: true, ids, reasons: ['a URL side has no source to diff → all'] };
  // Both trees, so a file deleted in head still selects the surfaces that imported it in base.
  const closures = closuresFor(SURFACES, [readerFor(o.base), readerFor(o.head)], isShared);
  return selectSurfaces(changedFiles(o.base.sha, o.head), closures);
}

export function runPlaywrightCapture(o: { runDir: string; sides: Side[]; surfaceIds: string[]; frozenAt: number; full: boolean; setupBaseURL: string }): number {
  const projects = ['capture-desktop', 'capture-mobile', ...(o.full ? ['capture-webkit-mobile'] : [])];
  const r = spawnSync('npx', ['playwright', 'test', ...projects.flatMap((p) => ['--project', p])], {
    cwd: E2E_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      E2E_SIDES: JSON.stringify(o.sides),
      E2E_SURFACES: o.surfaceIds.join(','),
      E2E_FROZEN_AT: String(o.frozenAt),
      E2E_RUN_DIR: o.runDir,
      E2E_BASE_URL: o.setupBaseURL,
      E2E_SERVERS_MANAGED: '1',
      E2E_FULL: o.full ? '1' : '0',
    },
  });
  return r.status ?? 1;
}

export function finalizeRun(o: { runDir: string; run: string; startedAt: Date; frozenAt: number; sides: SideInfo[]; selection: Selection }): Report {
  const jsonPath = join(o.runDir, 'playwright.json');
  const json: unknown = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : { errors: [{ message: `${jsonPath} was not written` }] };
  const { groups, hardFailures, warnings, blockedWrites } = groupOutcomes(readPlaywrightResults(json));
  hardFailures.push(...readPlaywrightErrors(json).map((error) => ({ title: 'run', project: 'global', error })));
  const rel = (abs: string) => relative(o.runDir, abs).split(sep).join('/');
  const diffFor = (a: CaptureNote, b: CaptureNote): DiffResult => {
    const png = diffPng(readFileSync(a.png), readFileSync(b.png));
    const diffImage = join(o.runDir, 'diff', `${a.key}.png`);
    if (png.diffPixels > 0 || png.sizeChanged) {
      mkdirSync(dirname(diffImage), { recursive: true });
      writeFileSync(diffImage, png.diffPng);
    }
    const aria = diffAria(readFileSync(a.aria, 'utf8'), readFileSync(b.aria, 'utf8'), `${a.key}.aria.yml`);
    return { diffPixels: png.diffPixels, diffRatio: png.diffRatio, sizeChanged: png.sizeChanged, ariaChanged: aria.changed, ariaPatch: aria.patch, diffImage };
  };
  const rows = buildRows(groups, o.sides.map((s) => s.name), diffFor, rel);
  const report: Report = {
    run: o.run, startedAt: o.startedAt.toISOString(), durationMs: Date.now() - o.startedAt.getTime(), frozenAt: o.frozenAt,
    sides: o.sides, selection: o.selection, rows, hardFailures, warnings, blockedWrites,
  };
  writeFileSync(join(o.runDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(o.runDir, 'index.html'), renderGallery(report));
  return report;
}

export function printSummary(report: Report, runDir: string): void {
  const count = (s: string) => report.rows.filter((r) => r.status === s).length;
  console.log(`\n${count('changed')} changed, ${count('failed')} failed, ${count('missing')} missing, ${count('unchanged')} unchanged${count('captured') ? `, ${count('captured')} captured` : ''} in ${Math.round(report.durationMs / 1000)} s`);
  for (const f of report.hardFailures) console.log(`HARD FAILURE ${f.project} ${f.title}: ${f.error.split('\n')[0]}`);
  for (const w of report.warnings) console.log(`warning ${w.project} ${w.title}: ${w.error.split('\n')[0]}`);
  console.log(`gallery: ${join(runDir, 'index.html')}\nreport:  ${join(runDir, 'report.json')}`);
}
```

- [ ] **Step 4: Run the unit tests**

Run: `npm run e2e:unit`
Expected: PASS.

- [ ] **Step 5: Write `e2e/scripts/compare.ts`**

```ts
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseCompareArgs } from '../lib/compare-args.ts';
import { assertAllowedBaseUrl, assertNoProdInEnv, assertStagingEnvFile } from '../lib/guards.ts';
import { classifyTarget, resolveTarget, type Resolved } from '../lib/sides.ts';
import { ensureCheckout, pruneBaseWorktrees } from '../lib/checkouts.ts';
import { startVite, type Server } from '../lib/servers.ts';
import { finalizeRun, printSummary, runName, runPlaywrightCapture, selectionFor } from '../lib/orchestrate.ts';
import { RESULTS_DIR } from '../lib/paths.ts';
import type { SideInfo } from '../lib/report.ts';

// Every guard runs before anything is created, started or launched.
const args = parseCompareArgs(process.argv.slice(2));
assertNoProdInEnv(process.env);
if (process.env.E2E_BASE_URL) assertAllowedBaseUrl(process.env.E2E_BASE_URL);
assertStagingEnvFile();

if (args.pruneBases) {
  const removed = pruneBaseWorktrees();
  console.log(removed.length ? `removed:\n${removed.join('\n')}` : 'no base worktrees to remove');
  process.exit(0);
}

const baseTarget = classifyTarget(args.base);
const headTarget = classifyTarget(args.head);
if (baseTarget.kind === 'worktree') throw new Error('--base must be a git ref or the staging URL');
const base = resolveTarget(baseTarget);
const head = resolveTarget(headTarget);
if (base.kind === 'url' && head.kind === 'url') throw new Error('base and head are both the staging URL; there is nothing to compare');

const describe = (r: Resolved) => (r.kind === 'url' ? r.url : `${r.kind === 'ref' ? r.ref : 'worktree'} @ ${r.sha.slice(0, 8)}${r.kind === 'worktree' && r.dirty ? ' + uncommitted changes' : ''}`);
const selection = selectionFor({ surfaces: args.surfaces, all: args.all, base, head });
console.log(`base: ${describe(base)}\nhead: ${describe(head)}`);
console.log(`selection: ${selection.ids.length} surfaces${selection.all ? ' (all)' : ''}\n  ${selection.reasons.join('\n  ')}`);
console.log(`surfaces: ${selection.ids.join(', ') || 'none'}`);
if (args.plan) process.exit(0);
if (!selection.ids.length) { console.log('nothing to capture'); process.exit(0); }

const startedAt = new Date();
const run = runName(startedAt, args.base, args.head);
const runDir = join(RESULTS_DIR, run);
mkdirSync(join(runDir, 'servers'), { recursive: true });

const servers: Server[] = [];
const stopAll = () => Promise.all(servers.map((s) => s.stop()));
process.on('SIGINT', () => { void stopAll().then(() => process.exit(130)); });

const urlByRoot = new Map<string, string>();
async function serve(r: Resolved, port: number, name: string): Promise<string> {
  if (r.kind === 'url') return r.url;
  const root = r.kind === 'worktree' ? r.root : ensureCheckout(r.sha);
  // Same commit on both sides: one server serves both, which is a pure A/A of the pipeline.
  const existing = urlByRoot.get(root);
  if (existing) return existing;
  const server = await startVite(root, port, join(runDir, 'servers', `${name}.log`));
  servers.push(server);
  urlByRoot.set(root, server.url);
  return server.url;
}

const frozenAt = Date.now();
let headURL = '';
let baseURL = '';
try {
  headURL = await serve(head, 3100, 'head');
  baseURL = await serve(base, 3101, 'base');
  runPlaywrightCapture({
    runDir, frozenAt, full: args.full, surfaceIds: selection.ids, setupBaseURL: head.kind === 'url' ? baseURL : headURL,
    sides: [{ name: 'base', baseURL }, { name: 'head', baseURL: headURL }],
  });
} finally {
  await stopAll();
}

const info = (name: string, target: string, r: Resolved, url: string): SideInfo =>
  r.kind === 'url' ? { name, target, url } : { name, target, sha: r.sha, dirty: r.kind === 'worktree' ? r.dirty : undefined, url };
const report = finalizeRun({ runDir, run, startedAt, frozenAt, selection, sides: [info('base', args.base, base, baseURL), info('head', args.head, head, headURL)] });
printSummary(report, runDir);
// Visual diffs never fail a run; only hard failures do.
process.exit(report.hardFailures.length ? 1 : 0);
```

`setupBaseURL` is the local side whenever one exists. The setup project then signs in, or reuses a session, on a local origin, and the fixture moves that session to the other side.

- [ ] **Step 6: Write `e2e/scripts/capture.ts`**

```ts
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseCaptureArgs } from '../lib/compare-args.ts';
import { assertAllowedBaseUrl, assertNoProdInEnv, assertStagingEnvFile } from '../lib/guards.ts';
import { classifyTarget, resolveTarget } from '../lib/sides.ts';
import { ensureCheckout } from '../lib/checkouts.ts';
import { startVite, type Server } from '../lib/servers.ts';
import { finalizeRun, printSummary, runName, runPlaywrightCapture, selectionFor } from '../lib/orchestrate.ts';
import { RESULTS_DIR } from '../lib/paths.ts';

// One side, labeled, for a rollover step; the gallery shows the shots without diffs.
const args = parseCaptureArgs(process.argv.slice(2));
assertNoProdInEnv(process.env);
if (process.env.E2E_BASE_URL) assertAllowedBaseUrl(process.env.E2E_BASE_URL);
assertStagingEnvFile();

const target = resolveTarget(classifyTarget(args.target));
const selection = selectionFor({ surfaces: args.surfaces, all: !args.surfaces, base: target, head: target });
const startedAt = new Date();
const run = runName(startedAt, `capture-${args.label}`, args.target);
const runDir = join(RESULTS_DIR, run);
mkdirSync(join(runDir, 'servers'), { recursive: true });

let server: Server | undefined;
let url = '';
const frozenAt = Date.now();
process.on('SIGINT', () => { void (server?.stop() ?? Promise.resolve()).then(() => process.exit(130)); });
try {
  if (target.kind === 'url') url = target.url;
  else {
    server = await startVite(target.kind === 'worktree' ? target.root : ensureCheckout(target.sha), 3100, join(runDir, 'servers', `${args.label}.log`));
    url = server.url;
  }
  runPlaywrightCapture({ runDir, frozenAt, full: args.full, surfaceIds: selection.ids, setupBaseURL: url, sides: [{ name: args.label, baseURL: url }] });
} finally {
  await server?.stop();
}

const report = finalizeRun({
  runDir, run, startedAt, frozenAt, selection,
  sides: [target.kind === 'url' ? { name: args.label, target: args.target, url } : { name: args.label, target: args.target, sha: target.sha, url }],
});
printSummary(report, runDir);
process.exit(report.hardFailures.length ? 1 : 0);
```

- [ ] **Step 7: Wire the scripts**

In `e2e/package.json` `scripts`, add:

```json
    "compare": "node --experimental-transform-types --no-warnings scripts/compare.ts",
    "capture": "node --experimental-transform-types --no-warnings scripts/capture.ts",
```

In the root `package.json`, after the `"e2e:check-live"` line (add a comma to it), add:

```json
    "e2e:compare": "npm --prefix e2e run compare --",
    "e2e:capture": "npm --prefix e2e run capture --"
```

Run: `git diff --stat -- package-lock.json` (prints nothing).

- [ ] **Step 8: Dry checks, no browser**

Run each command and compare with the expected result:
- `npm run e2e:compare -- --plan` → prints base `staging @ 212454d…` (or wherever `staging` is), head `worktree @ …`, and `selection: 26 surfaces (all)`. The reasons include `shared package.json → all` and `unmapped tsconfig.json → all`. No `ignored` lines are printed. Nothing is created under `.worktrees`, and `ls /Users/jhh/Codebase/jhh-ai/.worktrees` is unchanged.
- `npm run e2e:compare -- --base https://f1.carolinaminted.net --plan` → exits non-zero with a `GuardError`. Nothing is created.
- `npm run e2e:compare -- --mode production` → exits non-zero, `--mode is not accepted`.
- `E2E_BASE_URL=https://f1.carolinaminted.net npm run e2e:compare -- --plan` → exits non-zero (refused by `assertAllowedBaseUrl`).

- [ ] **Step 9: First real compare, two surfaces**

Run: `npm run e2e:compare -- --surfaces home,league`
Expected:
- `/Users/jhh/Codebase/jhh-ai/.worktrees/lol-e2e-base-<sha12>` is created and `npm ci` runs once.
- Two Vite servers start, on 3100 and 3101.
- The capture runs 2 setup tests and 16 captures (2 surfaces × 2 themes × 2 sides × 2 projects). Setup prints `reused … on http://127.0.0.1:3100`.
- The summary reads `0 changed, 0 failed, 0 missing, 8 unchanged`. Exit code 0.
- `lsof -iTCP:3100 -iTCP:3101 -sTCP:LISTEN` prints nothing afterwards (the servers stopped).

Read `index.html` and one base and one head PNG with the Read tool. Check that the base shots came from 3101: the `url` fields in the `capture` annotations in `playwright.json` show it. If the summary shows changed rows, go straight to Task 10's stabilising loop for those surfaces; do not commit a pipeline that is not A/A-clean on two surfaces.

- [ ] **Step 10: Typecheck and commit**

Run: `npm --prefix e2e run typecheck` (clean).

```bash
git add e2e/lib/orchestrate.ts e2e/lib/orchestrate.test.ts e2e/scripts/compare.ts e2e/scripts/capture.ts e2e/package.json package.json
```
```bash
git commit -m "feat(e2e): e2e:compare and e2e:capture

compare resolves base and head, serves each with Vite --mode staging on
3101 and 3100, captures with one frozen timestamp, then writes the
gallery and report.json; only hard failures fail the run. capture is
the one-side, labeled variant.

Refs: [E2E-04]
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: [E2E-03] done — full capture green and A/A clean three times

The head checkout (`feat/e2e-harness`) and `staging` differ only in `e2e/**`, root `package.json` scripts, `tsconfig.json` `exclude`, `.gitignore` and `.dockerignore`. None of those changes what the app renders, so comparing them is an A/A test across two checkouts and two origins.

**Files:** only `e2e/surfaces.ts` (`ready` and `mask`) if stabilising needs it.

- [ ] **Step 1: Confirm the app code is identical**

Run: `git diff --stat staging -- . ':(exclude)e2e'`
Expected: only `.dockerignore`, `.gitignore`, `package.json`, `tsconfig.json`. If anything else appears, stop and report.

- [ ] **Step 2: A/A run 1 (all surfaces)**

Run: `npm run e2e:compare -- --all`
Expected: exit 0, `0 changed, 0 failed, 0 missing, 104 unchanged`. Record the duration.

When a row changes, open its base, head and diff PNGs and the aria patch with the Read tool, and decide which case it is:
- **Live data changed between the two shots** (seconds apart, for example a new member or an announcement): rerun. Do not mask it.
- **Something legitimately differs between two runs of identical code** (for example a relative "x seconds ago" that does not use `Date`): add a `mask` to that surface with a comment naming the element and why, or a `ready` locator if it was a load race.
- **An unstable flag with no visible cause:** raise that surface's settle with a `ready` locator for the late element.

After any manifest change, the A/A count restarts at run 1. Commit each stabilising change on its own:

```bash
git add e2e/surfaces.ts
```
```bash
git commit -m "fix(e2e): stabilise <surface> capture

<what differed between identical runs and why the mask or ready is right>

Refs: [E2E-03]
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: A/A runs 2 and 3**

Run `npm run e2e:compare -- --all` twice more, with no manifest change in between.
Expected: both exit 0 with `0 changed`. Three consecutive clean runs meet the [E2E-03] done-when ("full capture green on both viewports and themes, and an A/A run shows zero diffs three times").

- [ ] **Step 4: Same-commit A/A through one server**

Run: `npm run e2e:compare -- --base staging --head staging --all`
Expected: one base worktree and one server (only `servers/head.log` exists in the run folder), `0 changed`, exit 0.

- [ ] **Step 5: Record**

Append to the worklog's `## Plan 2` section:
- the three A/A durations and the per-test average;
- every mask or ready added, with its reason;
- whether workers should rise (the spec says to raise them for read-only capture if a full pass is too slow). If a full A/A run takes over 15 minutes, try `E2E_WORKERS=4 npm run e2e:compare -- --all` once and record the time and whether it stayed clean.

---

### Task 11: [E2E-04] verification list

Every probe edit in this task is temporary. Make it, run the check, then revert it in the same step with `git checkout -- <file>` (tracked) or `rm <file>` (untracked). After each probe, confirm that `git status --short` lists no app file. Never commit a probe.

- [ ] **Step 1: No false positives.** Task 10 covered it (three clean A/A runs). Copy those three report paths into the task report.

- [ ] **Step 2: Real positive — one-line CSS change flags the expected surfaces and no others**

Probe: in `components/league/LeagueLinks.tsx`, add the class `outline outline-4 outline-red-500` to the outermost element's `className`. Then:
- Run: `npm run e2e:compare -- --base HEAD --plan`
  Expected: `components/league/LeagueLinks.tsx → league, league-dues` (or the exact set of surfaces whose closure contains the file; read the reasons) and no `all`.
- Run: `npm run e2e:compare -- --base HEAD --all`
  Expected: exit 0, and only the `league` and `league-dues` rows (both themes, both projects, 8 rows) are `changed`; every other row is `unchanged`. Read one diff PNG and confirm the outline is the change.
- Revert: `git checkout -- components/league/LeagueLinks.tsx`, then `git status --short`.

- [ ] **Step 3: Incremental selection**

Each probe is followed by `npm run e2e:compare -- --base HEAD --plan` and a revert:
- Add a comment line to `components/standings/HallOfFameView.tsx`. Expected: only `standings*` surfaces (`standings`, `standings-executive`, … `standings-rules`), no `all`.
- Add a comment line to a file in `styles/` (pick one with `ls styles`). Expected: `shared styles/<file> → all`.
- Create `zz-unmapped.ts` at the repo root containing `export {};`. Expected: `unmapped zz-unmapped.ts → all`. Remove it afterwards.

- [ ] **Step 4: Failure detection — console error and overflow both fail, with the element named**

Probe: in `components/LeagueHubPage.tsx`, add `console.error('e2e probe');` as the first statement of the component body, and as the first child of its top-level returned element add `<div id="e2e-overflow-probe" style={{ width: 3000 }}>probe</div>`. Then:
- Run: `npm run e2e:compare -- --base HEAD --surfaces league`
  Expected: exit 1. The head rows are `failed`, and the base rows captured fine (HEAD has no probe). The overflow check fails inside the test body and the console error fails at fixture teardown, so one test reports both. The summary prints only each failure's first line. Run `node -e "for (const f of require('./e2e-results/<run>/report.json').hardFailures) console.log(f.error)"`: the output must contain both `page overflows horizontally` with `div#e2e-overflow-probe "probe"` and `console.error: e2e probe`.
- Revert: `git checkout -- components/LeagueHubPage.tsx`, then `git status --short`.

- [ ] **Step 5: Guards**

- Production base URL refused before a browser starts: Task 9 Step 8 covered `--base https://f1.carolinaminted.net` and `E2E_BASE_URL=…`. Also run `E2E_BASE_URL=https://f1.carolinaminted.net npm run e2e:journeys -- --list`, which must fail at config load (plan 1 behaviour).
- `--mode production` refused: Task 9 Step 8.
- A write attempted in capture mode is aborted and reported: the A/A `report.json` `blockedWrites` lists the member's `Write/channel` (the [PROD-11] self-seed), if the app attempted it. Show it with `node -e "console.log(require('./e2e-results/<run>/report.json').blockedWrites)"`. If it is empty, the app made no write. In that case run `npm run e2e:journeys -- journeys/guards.spec.ts --project desktop`, plan 1's read-only abort proof, which reuses the session.

- [ ] **Step 6: Release isolation**

Run, in order:
- `npm run lint` → exit 0.
- `npm test` → exit 0.
- `npm run build -- --mode staging` → exit 0.
- `git diff --quiet staging -- package-lock.json` → exit 0 (the root lockfile is byte-identical to `staging`'s).
- `grep -rlE 'imapflow|@playwright/test|lol-e2e|pixelmatch|pngjs|picomatch|e2e/lib' dist/ || echo "bundle clean"` → `bundle clean`.

- [ ] **Step 7: Real runs**

- Run: `git fetch origin` (read-only).
- Regression run: `npm run e2e:compare -- --base origin/prod --head staging`. Record the base and head SHAs. If they are the same commit (both were `212454d` on 2026-11-26), the run is a same-commit A/A and must show 0 changed. Say so in the report rather than calling it a regression check.
- Confirm-deploy run: `npm run e2e:compare -- --base staging --head https://f1.staging.carolinaminted.net`. This compares the local dev server against the deployed staging service. Expected: exit 0. Any `changed` rows are dev-server-versus-build differences, or `staging` being ahead of what is deployed. Triage each in the report and do not mask them.
- For both runs, record the duration, the gallery path, and the time to read the gallery. The spec's bar is "readable in a few minutes".

- [ ] **Step 8: Clean base worktrees**

Run: `npm run e2e:compare -- --prune-bases`
Expected: lists and removes only `lol-e2e-base-*` worktrees; `git worktree list` afterwards shows the main checkout, `lol-e2e-harness` and `lol-agent-roster` (or whatever was there before Task 9), nothing else.

- [ ] **Step 9: Record**

Append the outcome of every check above to the worklog's `## Plan 2` section, with run folder names. Steps 1 to 8 meet the [E2E-04] done-when ("passes the Verification list on [E2E-00], including release isolation and a real origin/prod vs staging run").

---

### Task 12: README, tracker, worklog and push

**Files:**
- Modify: `e2e/README.md`

- [ ] **Step 1: Add to `e2e/README.md`** (after the "Clock" section, before the final "Plan" line; change that line to name both plans)

````markdown
## Capture and compare

Capture is read-only: it aborts every write the app makes, never clicks, and fails on a console
error, a page that scrolls sideways, a missing STAGING badge or a guard trip. Visual differences
never fail a run.

```bash
git fetch origin                                              # compare uses refs as they are locally
npm run e2e:compare                                           # staging vs this checkout, affected surfaces only
npm run e2e:compare -- --plan                                 # print the selection and stop
npm run e2e:compare -- --base origin/prod --head staging      # what members will see change
npm run e2e:compare -- --base staging --head https://f1.staging.carolinaminted.net   # confirm a deploy
npm run e2e:compare -- --surfaces home,league --all --full    # explicit surfaces; --full adds WebKit (warn-only)
npm run e2e:capture -- --label after-conclude                 # one side, labeled, no diffs
npm run e2e:compare -- --prune-bases                          # remove the base worktrees
```

- **Sides.** `worktree` (the default head) is this checkout, uncommitted changes included. A git
  ref becomes a detached worktree at `/Users/jhh/Codebase/jhh-ai/.worktrees/lol-e2e-base-<sha12>`,
  reused per commit (`npm ci` runs once). A URL side must be `https://f1.staging.carolinaminted.net`.
  Head is served on 3100 and base on 3101, always with `--mode staging`, and only on a free port.
- **Same moment.** One frozen timestamp (`page.clock.setFixedTime`) is shared by both sides, and
  the base and head shots of each surface are taken back to back. `Math.random` is seeded.
- **Matrix.** 26 surfaces (`surfaces.ts`) × dark and light × Chromium desktop (1440×1000) and
  mobile (390×844). `--full` adds WebKit mobile, whose failures are warnings.
- **Selection.** A changed file selects the surfaces whose entry component imports it, directly or
  through other files. `App.tsx`, `routes.ts`, `styles/**`, `components/ui/**`, `contexts/**`,
  `services/**` and root build files select everything, and so does any changed file no surface
  reaches. Server code, rules, docs, tests and `e2e/**` are ignored (`lib/select.ts`).
- **Reading a run.** `e2e-results/<run>/index.html` lists hard failures first, then changed
  surfaces most-changed first (base, head, diff, and the aria-snapshot patch), with unchanged ones
  collapsed. `report.json` holds the same data for an agent. Runs exit 1 only on hard failures.
- **Sessions.** The setup project reuses saved sessions and moves them between the two origins, so
  a compare normally signs in zero times.
````

Change the last line of the README to: `Plans: e2e/PLAN.md (foundation), e2e/PLAN-2.md (capture and compare). Spec: the [E2E-00] tracker page.`

- [ ] **Step 2: Commit the README**

```bash
git add e2e/README.md
```
```bash
git commit -m "docs(e2e): how to capture, compare and read a run

Refs: [E2E-03], [E2E-04]
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Tracker** (Notion connector; IDs only from `/Users/jhh/Codebase/jhh-ai/CLAUDE.md`)

- [E2E-03] and [E2E-04]: set Status `Completed` only if their done-when checks passed (Tasks 10 and 11). Released In stays `Unreleased`. In Commits, put the SHAs and subjects from `git log --oneline staging..HEAD` that carry each ID.
- [E2E-00]: append to "Build notes" a `(plan 2, <date>)` block that copies the "Spec drift" list above. Add the measured full-run time and any surface excluded for an app bug.
- Any app bug found (overflow, console error) is filed as a new tracker item, after the user agrees, and named in the worklog.

- [ ] **Step 4: Worklog**

In `/Users/jhh/Codebase/jhh-ai/worklog/playwright-adoption.md`, add a Plan 2 task-outcomes table under `## Plan 2`, in the same shape as plan 1's, with commit ranges. Set `updated:` to today.

- [ ] **Step 5: Push, after asking**

Ask the user to confirm the push of `feat/e2e-harness`. On yes: `git push origin feat/e2e-harness`. Do not merge into `staging`: that waits for HO-2 to ship and [ROLL-06] to close (Dec 13).

- [ ] **Step 6: Final check**

- `npm run e2e:unit`: all pass.
- `npm --prefix e2e run typecheck`: clean.
- `git status --short`: empty.
- `git diff --stat staging -- . ':(exclude)e2e'`: lists only `.dockerignore`, `.gitignore`, `package.json` and `tsconfig.json`.

Offer `/handoff` for plan 3.
