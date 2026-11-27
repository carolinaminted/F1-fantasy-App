# E2E Plan 3: Behavior Journeys and Release Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish [E2E-05]: journeys for picks, profile, dues, the admin tour with its reversible actions, sign-out, the session guard and password reset, with every write restored. Then wire the harness into the release process ([E2E-06]) without letting it sign anything.

**Architecture:** Journeys use plan 1's fixtures (`memberPage`, `adminPage`, `anonPage`, `requires`, `expectError`) and role, label and text selectors only. Write journeys opt in three ways (`readOnly: false`, the `@write` tag, `E2E_WRITES=1`), run on desktop only, and take a lossless snapshot of every staging document they touch, restored in `finally`. A new raw-document pair in the REST client makes that restore exact. Release integration adds one warn-only `e2e:` line to `release-gates.sh show`, read from the latest compare report whose head is the commit.

**Tech Stack:** Playwright 1.63, TypeScript run by `node --experimental-transform-types`, `node:test`, the staging Firestore and Identity Toolkit REST APIs through `gcloud` impersonation, IMAP for mail.

**Spec:** [E2E-05] https://app.notion.com/p/4100c2f763aa8188be09c2238771e8a9 and [E2E-06] https://app.notion.com/p/4100c2f763aa81919350e64b4729c7d3, both children of [E2E-00] https://app.notion.com/p/cc1aeab8b6304e5a972f5de137ceb6a4 (read its "Standing limits" and "Guards" sections).

## Global Constraints

- **Staging only.** Allowed hosts: `127.0.0.1`, `localhost`, `f1.staging.carolinaminted.net`. Forbidden anywhere: `formula-fantasy-1`, `lights-out-league-prod`, `lights-out-league-web`, host `f1.carolinaminted.net`. Nothing here loosens those guards.
- **Writes stay inside the standing approval.** Approval 5 and the [E2E-00] standing limits allow journey writes to e2e-member's own documents, e2e-admin's reversible actions (the dues toggle on e2e-member, creating and deleting an invitation code) and throwaway `+run-*` accounts. Nothing else is written. Results, schedule, scoring, entities, maintenance, Database Manager, Season Control and pay buttons are never clicked. "Pay with Venmo" is never clicked.
- **A write test opts in three ways:** `test.use({ readOnly: false })`, `{ tag: '@write' }`, and `E2E_WRITES=1` in the environment. It skips every project but `desktop`. It snapshots the documents it touches before the first write and restores them in `finally`.
- **No committed app code.** Commits touch `e2e/**`, except Task 10, which also edits `scripts/release-gates.sh` and `CLAUDE.md`. Probe edits to app files exist to see a test fail; they are reverted in the same task with `git checkout -- <file>` and are never committed. The root `package.json` and `package-lock.json` do not change.
- **No merge to `staging`** before HO-2 has shipped and [ROLL-06] closes (Dec 13). Work stays on `feat/e2e-harness` in `/Users/jhh/Codebase/jhh-ai/.worktrees/lol-e2e-harness`. Pushing needs the user's confirmation.
- **Sign-in throttle.** Firebase throttles password sign-ins per account. `setup` reuses a session younger than 30 minutes. Never loop a run. If setup reports "Invalid email or password", stop and probe at most every 5 minutes.
- **Rate limits.** `send_auth_code` (sign-up) and `password_reset` each allow 3 calls per 10 minutes. Three full write runs in a row reach that limit exactly; any rerun waits 10 minutes.
- **Secrets.** Never print a write body, a token, a reset link, an `oobCode`, a password or `.env.e2e`. Traces under `e2e-results/` hold passwords and tokens.
- **Git in this worktree:** enter it with `EnterWorktree` (`path`), then one git command per Bash call. Each commit message ends with its `Refs:` line and the `Co-Authored-By` trailer the session specifies. An agent never signs a release gate.
- **Staging reads** use `gcloud` impersonation of the harness service account. If it fails with an expired login, ask the user to log in; do not work around it.
- All commands run from the worktree root unless a step says otherwise.

## Facts established while planning (2026-11-26)

| Fact | Source |
|---|---|
| `getDoc` then `patchDoc` is lossy: timestamps come back as strings, and there is no whole-document replace or field delete | `lib/staging-admin.ts`, `lib/firestore-value.ts:9,23` |
| `readStagingState()` is cached per worker; a test that changes e2e-member's `users` doc must restore it before the test ends | `lib/staging-state.ts:12` |
| Picks: empty slots are buttons named `Team` or `Driver`, Fastest Lap is `Select Driver`; options open in an unnamed `dialog`; disabled options show "Already picked" or "Limit reached"; the review modal is "Review Lineup" and repeats the "Lock In Picks" button | `components/picks/SlotCard.tsx:77-79`, `OptionSheet.tsx:77`, `LineupReview.tsx:75-90` |
| A save shows `h2` "Picks Locked In" and "Your picks for the {event} are locked in. Good luck, {name}!"; "Edit Picks" reopens the form; `Clear {name}` empties a slot | `PicksForm.tsx:407-431`, `SlotCard.tsx:88` |
| The write is `userPicks/{uid}` merged with `{ [eventId]: { aTeams, bTeam, aDrivers, bDrivers, fastestLap, submittedAt } }`; `submittedAt` only when the member saves their own picks | `services/firestoreService.ts:220-229` |
| A member's own picks are not shown on League or Standings. They show on Profile ("Picks & Points History", rows "R{n}: {event}", "Submitted {time}" when expanded) and as Home's "Lineup submitted" chip | `components/profile/HistoryList.tsx`, `Dashboard.tsx:181-184` |
| Standings' "Team Inspection" opener and close button have no accessible name, so they cannot be reached with role selectors | `LeaderboardPage.tsx:217-221,702-707` |
| Profile edit: "Manage Account" → "Edit Details"; labels have no `htmlFor`; "Display Name (Max 20)"; "Save Changes" closes the form with no toast; writes `users/{uid}` and `public_users/{uid}.displayName` | `AccountMenu.tsx:70-81`, `EditProfileForm.tsx`, `firestoreService.ts:159-168` |
| Dues: unpaid badge is a button "Dues Due$amount"; the sheet is "Pay League Dues" with a read-only memo `Dues Payment • YYYY-MM-DD • {email}`; Profile has "Dues: Unpaid" | `DuesStatus.tsx:94-101`, `LeagueHubPage.tsx:104`, `ProfilePage.tsx:401-408` |
| Admin dues: search "Search by name or email…", click the member row, `switch` "Dues paid", the "Save" beside it; toast `Successfully updated dues status to Paid for {name}.`; writes `users/{uid}.duesPaidStatus` only | `ManageUsersPage.tsx:266`, `AdminUserProfileView.tsx:196,293-311` |
| Invitations: "Create" makes one code by default; a row opens "Invitation code" → "Delete this code" → confirm "Delete code"; toast `Code {code} deleted permanently.`; doc `invitation_codes/{code}` with `createdBy: <admin uid>` | `AdminInvitationPage.tsx:88,107,288-303,343-467` |
| App bug: after a successful delete the "Delete this code" confirm stays open, because `executeDelete` never resets `confirmingDelete` | `AdminInvitationPage.tsx:101-116` |
| Admin dashboard tiles: "Enter Race Results", "Race Schedule", "Members", "Invite Codes", "Drivers & Teams", "Scoring Rules", "Season Control", "Announcements & Red Flag". Back button "Admin Home" is desktop only | `AdminPage.tsx:145-214`, `AdminToolShell.tsx:45`, `PageHeader.tsx` |
| Sign-out: desktop account button (name ends in "pts") → "Log Out"; mobile header "Log Out". No confirmation. `ff1_session_activity` is removed | `App.tsx:137-184,972-974`, `useSessionGuard.ts:43-46` |
| Session guard: warning at 10 idle minutes ("Are you still there?", "Continue Session"), sign-out at 15 with toast "Your session has expired. Please log in again." Checked every second against `Date.now()` | `useSessionGuard.ts:8-9,135-155`, `SessionWarningModal.tsx`, `App.tsx:333` |
| Password reset: "Forgot Password?" → `h2` "Reset Password" → "Send Reset Link"; success "If an account exists with this email, a password reset link has been sent…". The callable mails subject "Reset Your Password — Lights Out League" with a Firebase hosted link (`mode=resetPassword&oobCode=…`, no continueUrl). The app has no in-app reset page | `AuthScreen.tsx:334-352,576-678`, `functions/index.js:482-569` |
| The hosted reset page's host is not an allowed host, so the journey completes the reset with Identity Toolkit `accounts:resetPassword` from Node, using the staging web API key (`stagingWebApiKey()`) | `lib/guards.ts:71` |
| A password change revokes refresh tokens, so the reset journey uses a throwaway account, never e2e-member | Firebase Auth behaviour |
| `release-gates.sh` `cd`s to the repo root before dispatch; `cmd_show` holds the resolved commit in `$sha` | `scripts/release-gates.sh:337-376,394` |
| `report.json` has `sides[]` with `name`, `target`, `sha`, `dirty`; a URL side has no `sha` | `lib/report.ts:6-18` |

## Differences from the spec

- "See picks in League and Standings": League never shows them, and Standings shows them only behind an unnamed control. The journey checks Profile history and Home's chip instead. Reaching Team Inspection waits for an accessible name (post-freeze app change).
- "Create and revoke an invitation": the app has no revoke; delete is the only removal.
- Password reset is finished through the Identity Toolkit REST call, not the Firebase hosted page, which the guards forbid. The UI half (request, mail, link) is still exercised end to end.
- "Sign-in/out both roles": sign-in for both roles exists (`auth-signin.spec.ts`); this plan adds sign-out for both.
- [E2E-06] "first real use on [ROLL-19]" happens after Dec 13 and is not a task here; Task 10 leaves the checklist for it.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `e2e/lib/staging-admin.ts` | Add `getRawDoc`, `putRawDoc`, `uidOf` | 1 |
| `e2e/lib/snapshot.ts`, `.test.ts` | Lossless snapshot and restore of named docs; canonical comparison | 1 |
| `e2e/lib/picks-ui.ts` | Fill empty slots, lock in, read the event name | 2 |
| `e2e/journeys/picks.spec.ts` | Make, see and edit picks (write) | 2 |
| `e2e/lib/ui.ts` | Text-labelled field lookup for forms without `htmlFor` | 3 |
| `e2e/journeys/profile.spec.ts` | Edit display name (write) | 3 |
| `e2e/journeys/dues.spec.ts` | Member dues view (read-only); admin toggles e2e-member paid and back (write) | 4 |
| `e2e/journeys/invitations.spec.ts` | Admin creates and deletes a code (write) | 5 |
| `e2e/journeys/admin-tour.spec.ts` | Dashboard tiles open each tool and return (read-only) | 6 |
| `e2e/journeys/session.spec.ts` | Sign-out for both roles; idle warning; idle sign-out (read-only) | 7 |
| `e2e/lib/reset-link.ts`, `.test.ts` | Parse and check a reset link; confirm the reset and test a password over REST | 8 |
| `e2e/journeys/password-reset.spec.ts` | Reset by real mail on a throwaway account (write) | 8 |
| `e2e/scripts/check-clean.ts`, `e2e/package.json` | Save and compare the staging state write journeys must leave unchanged | 9 |
| `e2e/lib/last-run.ts`, `.test.ts`, `e2e/scripts/last-run.ts` | The `e2e:` line for a commit | 10 |
| `scripts/release-gates.sh`, `CLAUDE.md` | Print the line in `show`; list the e2e commands | 10 |
| `e2e/README.md` | Journey groups, write rules, rate limits, the release line | 9, 10 |

---

### Task 0: Preflight

- [ ] **Step 1: Enter the worktree and check it is clean**

Run `EnterWorktree` with `path: /Users/jhh/Codebase/jhh-ai/.worktrees/lol-e2e-harness`. Then, one per call: `git status --short` (expected: only `e2e/PLAN-3.md` untracked), `git log --oneline -1` (expected: `f3a5d37 docs(e2e): how to capture, compare and read a run` or later), `pgrep -fl 'playwright|vite'` (expected: nothing).

- [ ] **Step 2: Baseline**

Run: `npm run e2e:unit` → `# pass 121`, `# fail 0`.
Run: `npm --prefix e2e run typecheck` → exit 0.
Run: `npm run e2e:check-live` → passes (it reads staging through impersonation; an expired login stops here).
Run: `npm run e2e:journeys` → `79 passed`, `1 skipped` or better, about 3 minutes, in the background. This is the read-only suite before any change.

- [ ] **Step 3: Tracker and commit the plan**

Set [E2E-05] Status `In Progress` in the 🏁 Lights Out League tracker (IDs only from `/Users/jhh/Codebase/jhh-ai/CLAUDE.md`).

```bash
git add e2e/PLAN-3.md
```
```bash
git commit -m "docs(e2e): plan 3, behavior journeys and release integration

Refs: [E2E-05], [E2E-06]"
```

---

### Task 1: Lossless snapshot and restore

**Files:**
- Modify: `e2e/lib/staging-admin.ts`
- Create: `e2e/lib/snapshot.ts`, `e2e/lib/snapshot.test.ts`

**Interfaces:**
- Produces: `type RawFields = Record<string, FsValue>`; `getRawDoc(path: string): Promise<RawFields | null>`; `putRawDoc(path: string, fields: RawFields): Promise<void>`; `uidOf(email: string): Promise<string>` (all in `staging-admin.ts`). `type DocSnapshot = { path: string; fields: RawFields | null }`; `restorePlan(s: DocSnapshot[]): RestoreStep[]`; `snapshotDocs(paths: string[]): Promise<DocSnapshot[]>`; `restoreDocs(s: DocSnapshot[]): Promise<void>`; `canonical(value: unknown): string`; `memberDocPaths(uid: string): string[]` (in `snapshot.ts`).

- [ ] **Step 1: Write the failing unit tests**

`e2e/lib/snapshot.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonical, memberDocPaths, restorePlan } from './snapshot.ts';

test('a doc that did not exist is deleted on restore, one that did is put back whole', () => {
  const fields = { displayName: { stringValue: 'E2E Member' }, at: { timestampValue: '2026-11-26T10:00:00Z' } };
  assert.deepEqual(restorePlan([{ path: 'userPicks/u1', fields: null }, { path: 'users/u1', fields }]), [
    { path: 'userPicks/u1', action: 'delete' },
    { path: 'users/u1', action: 'put', fields },
  ]);
});

test('canonical ignores key order at every depth and keeps value types', () => {
  const a = { b: { stringValue: 'x' }, a: { mapValue: { fields: { z: { integerValue: '1' }, y: { nullValue: null } } } } };
  const b = { a: { mapValue: { fields: { y: { nullValue: null }, z: { integerValue: '1' } } } }, b: { stringValue: 'x' } };
  assert.equal(canonical(a), canonical(b));
  assert.notEqual(canonical({ n: { integerValue: '1' } }), canonical({ n: { doubleValue: 1 } }));
});

test('member doc paths cover everything member journeys write', () => {
  assert.deepEqual(memberDocPaths('u1'), ['users/u1', 'public_users/u1', 'userPicks/u1']);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm run e2e:unit`
Expected: FAIL, `Cannot find module` for `./snapshot.ts`.

- [ ] **Step 3: Add the raw document pair and `uidOf` to `e2e/lib/staging-admin.ts`**

After `getDoc` (around line 43), add:

```ts
export type RawFields = Record<string, FsValue>;

// The REST representation, untouched, so a restore puts back exactly what was read (timestamps included).
export async function getRawDoc(path: string): Promise<RawFields | null> {
  const res = await call(docUrl(path));
  if (res.status === 404) return null;
  const body = await ok(res, `get ${path}`);
  return body.fields ?? {};
}

// PATCH without an updateMask replaces the whole document with these fields, creating it if missing.
export async function putRawDoc(path: string, fields: RawFields): Promise<void> {
  await ok(await call(docUrl(path), { method: 'PATCH', body: JSON.stringify({ fields }) }), `put ${path}`);
}
```

After `lookupUserByEmail`, add:

```ts
export async function uidOf(email: string): Promise<string> {
  const user = await lookupUserByEmail(email);
  if (!user) throw new Error(`no staging Auth user for ${email}; run npm run e2e:provision`);
  return user.localId;
}
```

- [ ] **Step 4: Write `e2e/lib/snapshot.ts`**

```ts
import { deleteDoc, getRawDoc, putRawDoc, type RawFields } from './staging-admin.ts';

export type DocSnapshot = { path: string; fields: RawFields | null };
export type RestoreStep = { path: string; action: 'delete' } | { path: string; action: 'put'; fields: RawFields };

export const memberDocPaths = (uid: string): string[] => [`users/${uid}`, `public_users/${uid}`, `userPicks/${uid}`];

export function restorePlan(snapshots: DocSnapshot[]): RestoreStep[] {
  return snapshots.map((s): RestoreStep => (s.fields === null ? { path: s.path, action: 'delete' } : { path: s.path, action: 'put', fields: s.fields }));
}

export async function snapshotDocs(paths: string[]): Promise<DocSnapshot[]> {
  return Promise.all(paths.map(async (path) => ({ path, fields: await getRawDoc(path) })));
}

export async function restoreDocs(snapshots: DocSnapshot[]): Promise<void> {
  for (const step of restorePlan(snapshots)) {
    if (step.action === 'delete') await deleteDoc(step.path);
    else await putRawDoc(step.path, step.fields);
  }
}

// Stable JSON: object keys sorted at every depth, so two reads of one document compare equal.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
```

- [ ] **Step 5: Run the unit tests and the typecheck**

Run: `npm run e2e:unit` → `# pass 124`, `# fail 0`.
Run: `npm --prefix e2e run typecheck` → exit 0.

- [ ] **Step 6: Prove the round trip is lossless against staging (read-only)**

Run:
```bash
node --experimental-transform-types --no-warnings --input-type=module -e "
const { getRawDoc, uidOf } = await import('./e2e/lib/staging-admin.ts');
const { canonical } = await import('./e2e/lib/snapshot.ts');
const uid = await uidOf('lol.e2e.bot+member@gmail.com');
const a = await getRawDoc('users/' + uid), b = await getRawDoc('users/' + uid);
console.log('fields', Object.keys(a ?? {}).length, 'stable', canonical(a) === canonical(b), 'hasTimestamp', JSON.stringify(a).includes('timestampValue'));
"
```
Expected: `fields <n> stable true hasTimestamp <true|false>`. Print nothing else from the document.

- [ ] **Step 7: Commit**

```bash
git add e2e/lib/staging-admin.ts e2e/lib/snapshot.ts e2e/lib/snapshot.test.ts
```
```bash
git commit -m "feat(e2e): lossless snapshot and restore of staging documents

getDoc then patchDoc turned timestamps into strings and could not
remove a field, so a write journey could not put a document back as it
found it. getRawDoc keeps the REST representation and putRawDoc
replaces the whole document with it.

Refs: [E2E-05]"
```

---

### Task 2: Picks — make, see and edit

**Files:**
- Create: `e2e/lib/picks-ui.ts`, `e2e/journeys/picks.spec.ts`

**Interfaces:**
- Consumes: `snapshotDocs`, `restoreDocs` (Task 1); `uidOf`, `getDoc` (`staging-admin.ts`); `MEMBER_EMAIL` (`identities.ts`); fixtures `memberPage`, `requires`.
- Produces: `emptySlots(page)`, `fillEmptySlots(page, avoid?: string[])`, `lockIn(page): Promise<string>` (the event name).

- [ ] **Step 1: Write `e2e/lib/picks-ui.ts`**

```ts
import { expect, type Page } from '@playwright/test';

// Empty pick slots are buttons named only by their kind; Fastest Lap's placeholder is "Select Driver".
export const emptySlots = (page: Page) => page.getByRole('button', { name: /^(Team|Driver|Select Driver)$/ });

// Fills every empty slot with the first selectable option, skipping any option whose text names one in `avoid`.
export async function fillEmptySlots(page: Page, avoid: string[] = []): Promise<void> {
  for (let i = 0; i < 9 && (await emptySlots(page).count()) > 0; i++) {
    await emptySlots(page).first().click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    // Options carry text; the sheet's Close button is icon-only. Disabled options read "Already picked" or "Limit reached".
    let options = sheet.getByRole('button', { disabled: false }).filter({ hasText: /\w/ });
    for (const name of avoid) options = options.filter({ hasNotText: name });
    await options.first().click();
    await expect(sheet).toBeHidden();
  }
  await expect(emptySlots(page)).toHaveCount(0);
}

// Opens the review, confirms inside it (the form's own button stays behind the modal), and returns the event name.
export async function lockIn(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Lock In Picks', exact: true }).click();
  const review = page.getByRole('dialog').filter({ hasText: 'Review Lineup' });
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: 'Lock In Picks', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Picks Locked In' })).toBeVisible({ timeout: 30_000 });
  const line = await page.getByText(/Your picks for the .+ are locked in\./).first().textContent();
  const name = /Your picks for the (.+?) are locked in\./.exec(line ?? '')?.[1];
  if (!name) throw new Error(`could not read the event name from: ${line}`);
  return name;
}
```

- [ ] **Step 2: Write `e2e/journeys/picks.spec.ts`**

```ts
import { test, expect } from '../fixtures.ts';
import { MEMBER_EMAIL } from '../lib/identities.ts';
import { getDoc, uidOf } from '../lib/staging-admin.ts';
import { restoreDocs, snapshotDocs } from '../lib/snapshot.ts';
import { fillEmptySlots, lockIn } from '../lib/picks-ui.ts';

type Lineup = Record<string, unknown>;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Events in userPicks/{uid} that carry a submittedAt, keyed by event id.
async function submitted(uid: string): Promise<Record<string, Lineup>> {
  const doc = (await getDoc(`userPicks/${uid}`)) ?? {};
  return Object.fromEntries(Object.entries(doc).filter(([, v]) => !!v && typeof v === 'object' && 'submittedAt' in (v as object))) as Record<string, Lineup>;
}
const withoutTime = ({ submittedAt: _t, ...rest }: Lineup) => JSON.stringify(rest);

test.describe('picks', () => {
  test.use({ readOnly: false });

  test('member makes picks, sees them on Profile and Home, then edits them', { tag: '@write' }, async ({ memberPage: page, requires }) => {
    test.skip(test.info().project.name !== 'desktop', 'one write per run: desktop only');
    test.setTimeout(180_000);
    await requires('maintenance-off', 'calendar-present', 'season-active', 'member-is-not-admin');

    const uid = await uidOf(MEMBER_EMAIL);
    const snapshot = await snapshotDocs([`userPicks/${uid}`]);
    try {
      const before = await submitted(uid);

      await page.goto('/race?view=picks');
      const form = page.getByRole('heading', { level: 3, name: 'Class A Teams' });
      const edit = page.getByRole('button', { name: 'Edit Picks', exact: true });
      // A leftover submission opens on its confirmation screen; edit it so the test always starts from the form.
      await expect(form.or(edit)).toBeVisible({ timeout: 20_000 });
      if (await edit.isVisible()) await edit.click();
      await expect(form).toBeVisible();
      await fillEmptySlots(page);
      const eventName = await lockIn(page);

      let eventId = '';
      await expect.poll(async () => {
        const now = await submitted(uid);
        eventId = Object.keys(now).find((id) => !before[id] || JSON.stringify(before[id]) !== JSON.stringify(now[id])) ?? '';
        return eventId;
      }, { timeout: 20_000, message: 'a submitted lineup with submittedAt reaches userPicks' }).not.toBe('');
      const first = (await submitted(uid))[eventId];
      expect((first.aDrivers as unknown[]).filter(Boolean)).toHaveLength(3);

      // Seen afterwards: Profile history and Home's chip (League and Standings do not show a member's own picks).
      await page.goto('/profile');
      const row = page.getByRole('button', { name: new RegExp(`R\\d+: ${escape(eventName)}`) });
      await row.click();
      await expect(page.getByText(/^Submitted /).first()).toBeVisible();
      await page.goto('/');
      await expect(page.getByText('Lineup submitted', { exact: true })).toBeVisible({ timeout: 20_000 });

      // Edit: clear one pick, choose a different one, lock in again.
      await page.goto('/race?view=picks');
      await page.getByRole('button', { name: 'Edit Picks', exact: true }).click();
      const clear = page.getByRole('button', { name: /^Clear / }).first();
      const cleared = (await clear.getAttribute('aria-label'))!.slice('Clear '.length);
      await clear.click();
      await fillEmptySlots(page, [cleared]);
      await lockIn(page);
      await expect.poll(async () => withoutTime((await submitted(uid))[eventId] ?? {}), { timeout: 20_000, message: 'the edited lineup is stored' })
        .not.toBe(withoutTime(first));
    } finally {
      await restoreDocs(snapshot);
    }
    expect((await snapshotDocs([`userPicks/${uid}`]))[0]).toEqual(snapshot[0]);
  });
});
```

- [ ] **Step 3: Run it**

Run: `E2E_WRITES=1 npm run e2e:journeys -- journeys/picks.spec.ts --project=desktop`
Expected: `1 passed` (plus the 2 setup tests). If a selector misses, read the trace with `npx playwright show-trace` from `e2e/` and fix the selector, never the assertion.

- [ ] **Step 4: See it fail**

Probe: in `services/firestoreService.ts` `saveUserPicks` (around line 226), change `isOwnSubmission ? { ...lineup, submittedAt: serverTimestamp() } : lineup` to `false ? { ...lineup, submittedAt: serverTimestamp() } : lineup`.
Run the Step 3 command. Expected: FAIL at "a submitted lineup with submittedAt reaches userPicks", and the `finally` still restores (`userPicks` equals the snapshot; check with Step 6 of Task 1's pattern on `userPicks/<uid>` if unsure).

- [ ] **Step 5: Revert the probe**

Run: `git checkout -- services/firestoreService.ts`, then `git status --short` (expected: only the two new e2e files).

- [ ] **Step 6: Commit**

```bash
git add e2e/lib/picks-ui.ts e2e/journeys/picks.spec.ts
```
```bash
git commit -m "test(e2e): member makes, sees and edits picks

Fills each empty slot with the first selectable option, confirms in the
review modal, and checks userPicks gains a lineup with submittedAt.
The lineup is then found in Profile history and on Home's chip, edited
by clearing one pick, and checked again. userPicks is restored exactly.

Refs: [E2E-05]"
```

---

### Task 3: Profile — edit the display name

**Files:**
- Create: `e2e/lib/ui.ts`, `e2e/journeys/profile.spec.ts`

**Interfaces:**
- Consumes: Task 1; `newRunId` (`identities.ts`).
- Produces: `fieldByText(page: Page, label: string): Locator`.

- [ ] **Step 1: Write `e2e/lib/ui.ts`**

```ts
import type { Locator, Page } from '@playwright/test';

// For forms whose <label>s lack htmlFor: the textbox inside the innermost element that holds the label text.
// Ancestors come first in document order, so the last match is the innermost.
export const fieldByText = (page: Page, label: string): Locator =>
  page.locator('div').filter({ has: page.getByText(label, { exact: true }) }).last().getByRole('textbox');
```

- [ ] **Step 2: Write `e2e/journeys/profile.spec.ts`**

```ts
import { test, expect } from '../fixtures.ts';
import { MEMBER_EMAIL, newRunId } from '../lib/identities.ts';
import { getDoc, uidOf } from '../lib/staging-admin.ts';
import { restoreDocs, snapshotDocs } from '../lib/snapshot.ts';
import { fieldByText } from '../lib/ui.ts';

test.describe('profile', () => {
  test.use({ readOnly: false });

  test('member edits their display name and sees it saved', { tag: '@write' }, async ({ memberPage: page, requires }) => {
    test.skip(test.info().project.name !== 'desktop', 'one write per run: desktop only');
    test.setTimeout(120_000);
    await requires('maintenance-off', 'calendar-present', 'member-is-not-admin');

    const uid = await uidOf(MEMBER_EMAIL);
    const snapshot = await snapshotDocs([`users/${uid}`, `public_users/${uid}`]);
    const newName = `E2E M ${newRunId().slice(0, 6)}`; // display names are at most 20 characters
    try {
      await page.goto('/profile');
      await page.getByRole('button', { name: 'Manage Account', exact: true }).click();
      await page.getByRole('button', { name: 'Edit Details', exact: true }).click();
      const display = fieldByText(page, 'Display Name (Max 20)');
      await expect(display).toHaveCount(1);
      await display.fill(newName);
      await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
      await expect(page.getByRole('heading', { level: 2, name: newName, exact: true })).toBeVisible({ timeout: 20_000 });
      await expect.poll(async () => (await getDoc(`users/${uid}`))?.displayName).toBe(newName);
      await expect.poll(async () => (await getDoc(`public_users/${uid}`))?.displayName, { message: 'the public name follows' }).toBe(newName);
    } finally {
      await restoreDocs(snapshot);
    }
    expect(await snapshotDocs([`users/${uid}`, `public_users/${uid}`])).toEqual(snapshot);
  });
});
```

- [ ] **Step 3: Run it**

Run: `E2E_WRITES=1 npm run e2e:journeys -- journeys/profile.spec.ts --project=desktop`
Expected: `1 passed`. If `fieldByText` matches 0 or 2 textboxes, read the form's DOM in the trace and narrow the container (for example `.locator('label')` → its parent), keeping it role- or text-based.

- [ ] **Step 4: See it fail**

Probe: in `services/firestoreService.ts` `updateUserProfile` (around lines 159-168), comment out the `updateDoc` call on `public_users/{uid}`.
Run the Step 3 command. Expected: FAIL at "the public name follows"; the docs are still restored.

- [ ] **Step 5: Revert the probe**

Run: `git checkout -- services/firestoreService.ts`, then `git status --short`.

- [ ] **Step 6: Commit**

```bash
git add e2e/lib/ui.ts e2e/journeys/profile.spec.ts
```
```bash
git commit -m "test(e2e): member edits their display name

Refs: [E2E-05]"
```

---

### Task 4: Dues — member view and the admin toggle

**Files:**
- Create: `e2e/journeys/dues.spec.ts`

**Interfaces:**
- Consumes: Task 1; fixtures `memberPage`, `adminPage`, `requires`.

- [ ] **Step 1: Write `e2e/journeys/dues.spec.ts`**

```ts
import { test, expect } from '../fixtures.ts';
import { MEMBER_EMAIL } from '../lib/identities.ts';
import { getDoc, uidOf } from '../lib/staging-admin.ts';
import { restoreDocs, snapshotDocs } from '../lib/snapshot.ts';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('unpaid member sees what they owe and the payment memo, from League and from Profile', async ({ memberPage: page, requires }) => {
  test.setTimeout(60_000);
  await requires('maintenance-off', 'calendar-present', 'member-dues-unpaid');

  await page.goto('/league');
  await page.getByRole('button', { name: /^Dues Due/ }).click();
  const sheet = page.getByRole('dialog').filter({ hasText: 'Pay League Dues' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(/^Entry fee for the .+ season\.$/)).toBeVisible();
  await expect(sheet.getByRole('textbox')).toHaveValue(new RegExp(`^Dues Payment • \\d{4}-\\d{2}-\\d{2} • ${escape(MEMBER_EMAIL)}`));
  await expect(sheet.getByRole('button', { name: 'Pay with Venmo' })).toBeVisible(); // seen, never clicked
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(page).not.toHaveURL(/dues=1/);

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Dues: Unpaid', exact: true }).click();
  await expect(page).toHaveURL(/\/league\?dues=1/);
  await expect(page.getByRole('dialog').filter({ hasText: 'Pay League Dues' })).toBeVisible();
});

test.describe('admin dues toggle', () => {
  test.use({ readOnly: false });

  test('admin marks e2e-member paid, the member sees it, and the admin sets it back', { tag: '@write' }, async ({ adminPage, memberPage, requires }) => {
    test.skip(test.info().project.name !== 'desktop', 'one write per run: desktop only');
    test.setTimeout(150_000);
    await requires('maintenance-off', 'calendar-present', 'member-dues-unpaid', 'admin-is-admin');

    const uid = await uidOf(MEMBER_EMAIL);
    const snapshot = await snapshotDocs([`users/${uid}`]);
    const name = String((await getDoc(`users/${uid}`))!.displayName);
    try {
      await adminPage.goto('/admin?tool=manage-users');
      await adminPage.getByPlaceholder(/Search by name or email/).fill(MEMBER_EMAIL);
      await adminPage.getByRole('row').filter({ hasText: name }).click();
      await expect(adminPage.getByRole('heading', { level: 1, name: name.toUpperCase(), exact: true })).toBeVisible({ timeout: 20_000 });

      const paid = adminPage.getByRole('switch', { name: 'Dues paid' });
      // The dues "Save" sits beside the switch; another "Save" on the page belongs to the admin flag.
      const save = adminPage.locator('div').filter({ has: paid }).filter({ has: adminPage.getByRole('button', { name: 'Save', exact: true }) }).last()
        .getByRole('button', { name: 'Save', exact: true });

      await expect(paid).toHaveAttribute('aria-checked', 'false');
      await paid.click();
      await save.click();
      await expect(adminPage.getByRole('alert').filter({ hasText: `Successfully updated dues status to Paid for ${name}.` })).toBeVisible();
      await expect.poll(async () => (await getDoc(`users/${uid}`))?.duesPaidStatus).toBe('Paid');

      await memberPage.goto('/league');
      await expect(memberPage.getByText('Dues Paid', { exact: true })).toBeVisible({ timeout: 20_000 });

      await paid.click();
      await expect(paid).toHaveAttribute('aria-checked', 'false');
      await save.click();
      await expect(adminPage.getByRole('alert').filter({ hasText: `Successfully updated dues status to Unpaid for ${name}.` })).toBeVisible();
      await expect.poll(async () => (await getDoc(`users/${uid}`))?.duesPaidStatus, { message: 'the admin can set it back' }).toBe('Unpaid');
    } finally {
      await restoreDocs(snapshot);
    }
    expect(await snapshotDocs([`users/${uid}`])).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Run the read-only test on both projects, then the write test**

Run: `npm run e2e:journeys -- journeys/dues.spec.ts`
Expected: `2 passed` (desktop and mobile), the write test not listed.
Run: `E2E_WRITES=1 npm run e2e:journeys -- journeys/dues.spec.ts --project=desktop`
Expected: `2 passed`.

- [ ] **Step 3: See it fail**

Probe: in `services/firestoreService.ts`, in the dues update around lines 356-359, replace the written value with the literal `'Paid'` (`duesPaidStatus: 'Paid'`).
Run: `E2E_WRITES=1 npm run e2e:journeys -- journeys/dues.spec.ts --project=desktop -g "admin marks"`
Expected: FAIL at "the admin can set it back"; the `users` doc is still restored (the final `toEqual` runs only on success, so confirm with Task 1 Step 6's pattern that `duesPaidStatus` is back to `Unpaid`).

- [ ] **Step 4: Revert the probe**

Run: `git checkout -- services/firestoreService.ts`, then `git status --short`.

- [ ] **Step 5: Commit**

```bash
git add e2e/journeys/dues.spec.ts
```
```bash
git commit -m "test(e2e): dues view for the member, dues toggle for the admin

The member test is read-only and never presses Pay with Venmo. The
admin test marks e2e-member paid, checks the member's League badge
live, sets it back, and restores users/{uid} exactly.

Refs: [E2E-05]"
```

---

### Task 5: Invitations — create and delete a code

**Files:**
- Create: `e2e/journeys/invitations.spec.ts`

**Interfaces:**
- Consumes: `uidOf`, `queryDocIds`, `getDoc`, `deleteDoc` (`staging-admin.ts`); `ADMIN_EMAIL` (`identities.ts`).

- [ ] **Step 1: Write `e2e/journeys/invitations.spec.ts`**

```ts
import { test, expect } from '../fixtures.ts';
import { ADMIN_EMAIL } from '../lib/identities.ts';
import { deleteDoc, getDoc, queryDocIds, uidOf } from '../lib/staging-admin.ts';

// Only codes the e2e-admin account created; it is a test identity and creates codes nowhere else.
const codesByE2eAdmin = async () => queryDocIds('invitation_codes', 'createdBy', await uidOf(ADMIN_EMAIL));

test.describe('invitations', () => {
  test.use({ readOnly: false });

  test('admin creates an invite code and deletes it', { tag: '@write' }, async ({ adminPage: page, requires }) => {
    test.skip(test.info().project.name !== 'desktop', 'one write per run: desktop only');
    test.setTimeout(120_000);
    await requires('maintenance-off', 'admin-is-admin');

    const before = new Set(await codesByE2eAdmin());
    let code = '';
    try {
      await page.goto('/admin?tool=invitations');
      await expect(page.getByRole('heading', { level: 1, name: 'INVITE CODES', exact: true })).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: /created successfully\./ })).toBeVisible();
      await expect.poll(async () => {
        const fresh = (await codesByE2eAdmin()).filter((id) => !before.has(id));
        code = fresh.length === 1 ? fresh[0] : '';
        return fresh.length;
      }, { message: 'exactly one new code' }).toBe(1);
      expect((await getDoc(`invitation_codes/${code}`))?.status).toBe('active');

      await page.getByRole('row').filter({ hasText: code }).click();
      await page.getByRole('dialog').filter({ hasText: 'Invitation code' }).getByRole('button', { name: 'Delete this code', exact: true }).click();
      await page.getByRole('dialog').filter({ hasText: 'is removed for good' }).getByRole('button', { name: 'Delete code', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: `Code ${code} deleted permanently.` })).toBeVisible();
      await expect.poll(async () => getDoc(`invitation_codes/${code}`), { message: 'the code is gone' }).toBeNull();
      // Known app bug: the delete confirm stays open afterwards (AdminInvitationPage executeDelete). Not asserted.
    } finally {
      for (const id of await codesByE2eAdmin()) if (!before.has(id)) await deleteDoc(`invitation_codes/${id}`);
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `E2E_WRITES=1 npm run e2e:journeys -- journeys/invitations.spec.ts --project=desktop`
Expected: `1 passed`.

- [ ] **Step 3: See it fail**

Probe: in `services/firestoreService.ts` (around lines 418-421), comment out the `deleteDoc` line in the invitation delete function.
Run the Step 2 command. Expected: FAIL at "the code is gone" (or at the toast, if the app reports an error). Then run `node --experimental-transform-types --no-warnings --input-type=module -e "const {queryDocIds,uidOf}=await import('./e2e/lib/staging-admin.ts'); console.log((await queryDocIds('invitation_codes','createdBy',await uidOf('lol.e2e.bot+admin@gmail.com'))).length)"` and confirm the count is what it was before the run (the `finally` removed the code).

- [ ] **Step 4: Revert the probe**

Run: `git checkout -- services/firestoreService.ts`, then `git status --short`.

- [ ] **Step 5: Commit**

```bash
git add e2e/journeys/invitations.spec.ts
```
```bash
git commit -m "test(e2e): admin creates an invite code and deletes it

Refs: [E2E-05]"
```

---

### Task 6: Admin tour through the dashboard tiles

**Files:**
- Create: `e2e/journeys/admin-tour.spec.ts`

[E2E-08]'s J8 already loads every tool by URL. This adds the navigation an admin actually uses: tile in, back out.

- [ ] **Step 1: Write `e2e/journeys/admin-tour.spec.ts`**

```ts
import { test, expect } from '../fixtures.ts';
import type { Page } from '@playwright/test';

// Dashboard tile title → the tool's level-1 heading. Database Manager has no tile.
const TILES: [string, string][] = [
  ['Enter Race Results', 'RACE RESULTS'],
  ['Race Schedule', 'RACE SCHEDULE'],
  ['Members', 'MEMBERS'],
  ['Invite Codes', 'INVITE CODES'],
  ['Drivers & Teams', 'DRIVERS & TEAMS'],
  ['Scoring Rules', 'SCORING RULES'],
  ['Season Control', 'SEASON CONTROL'],
  ['Announcements & Red Flag', 'ANNOUNCEMENTS'],
];
const h1 = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true });

test('admin opens each tool from its dashboard tile and returns', async ({ adminPage: page, requires }) => {
  test.setTimeout(120_000);
  await requires('maintenance-off', 'calendar-present', 'admin-is-admin');
  const desktop = test.info().project.name === 'desktop';

  await page.goto('/admin');
  for (const [tile, heading] of TILES) {
    await expect(h1(page, 'ADMIN')).toBeVisible({ timeout: 20_000 });
    await page.getByText(tile, { exact: true }).first().click(); // a tile title can also appear in a stat label
    await expect(h1(page, heading), `${tile} opens ${heading}`).toBeVisible({ timeout: 20_000 });
    // "Admin Home" is in PageHeader's leftAction, shown from md up; mobile uses the browser back.
    if (desktop) await page.getByRole('button', { name: 'Admin Home' }).click();
    else await page.goBack();
  }
  await expect(h1(page, 'ADMIN')).toBeVisible();
});
```

- [ ] **Step 2: Run it**

Run: `npm run e2e:journeys -- journeys/admin-tour.spec.ts`
Expected: `2 passed` (desktop and mobile). Read-only: nothing is clicked inside a tool.

- [ ] **Step 3: See it fail**

Probe: in `components/AdminPage.tsx` (tiles around lines 145-214), point the "Members" tile at the `invitations` tool instead of `manage-users`.
Run the Step 2 command with `--project=desktop`. Expected: FAIL with "Members opens MEMBERS".

- [ ] **Step 4: Revert the probe**

Run: `git checkout -- components/AdminPage.tsx`, then `git status --short`.

- [ ] **Step 5: Commit**

```bash
git add e2e/journeys/admin-tour.spec.ts
```
```bash
git commit -m "test(e2e): admin tour through the dashboard tiles

Refs: [E2E-05]"
```

---

### Task 7: Sign-out and the session guard

**Files:**
- Create: `e2e/journeys/session.spec.ts`

**Interfaces:**
- Consumes: `SESSION_STORAGE_KEY` (`lib/app.ts`); fixtures `memberPage`, `adminPage`.

Signing out only clears this test's browser context; it does not revoke the saved session in `.auth/`, so later tests still reuse it.

- [ ] **Step 1: Write `e2e/journeys/session.spec.ts`**

```ts
import { test, expect } from '../fixtures.ts';
import type { Page } from '@playwright/test';
import { SESSION_STORAGE_KEY, stagingBadge } from '../lib/app.ts';

const signedIn = (page: Page) => expect(page.locator('#login-email')).toBeHidden({ timeout: 30_000 });
const signedOut = (page: Page) => expect(page.locator('#login-email')).toBeVisible({ timeout: 20_000 });

async function logOut(page: Page): Promise<void> {
  if (test.info().project.name === 'desktop') {
    await page.getByRole('button', { name: /pts$/ }).click(); // the sidebar account button: name, rank and points
  }
  await page.getByRole('button', { name: 'Log Out', exact: true }).click();
}

for (const role of ['member', 'admin'] as const) {
  test(`${role} signs out and stays signed out after a reload`, async ({ memberPage, adminPage, requires }) => {
    await requires('maintenance-off', 'calendar-present');
    const page = role === 'member' ? memberPage : adminPage;
    await page.goto('/');
    await expect(stagingBadge(page)).toBeVisible();
    await signedIn(page);
    await logOut(page);
    await signedOut(page);
    expect(await page.evaluate((k) => localStorage.getItem(k), SESSION_STORAGE_KEY)).toBeNull();
    await page.reload();
    await signedOut(page);
  });
}

test.describe('idle session', () => {
  test('after 10 idle minutes the member is asked, and Continue Session keeps them in', async ({ memberPage: page, requires }) => {
    await requires('maintenance-off', 'calendar-present');
    await page.goto('/');
    await signedIn(page);
    // Timers keep running under setFixedTime; the guard compares Date.now() with the last activity every second.
    await page.clock.setFixedTime(Date.now() + 11 * 60_000);
    await expect(page.getByRole('heading', { level: 2, name: 'Are you still there?' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Continue Session', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Are you still there?' })).toBeHidden();
    await signedIn(page);
  });

  test('after 15 idle minutes the member is signed out with a notice', async ({ memberPage: page, requires }) => {
    await requires('maintenance-off', 'calendar-present');
    await page.goto('/');
    await signedIn(page);
    await page.clock.setFixedTime(Date.now() + 16 * 60_000);
    await expect(page.getByRole('alert').filter({ hasText: 'Your session has expired. Please log in again.' })).toBeVisible({ timeout: 10_000 });
    await signedOut(page);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm run e2e:journeys -- journeys/session.spec.ts`
Expected: `8 passed` (4 tests × desktop and mobile).

- [ ] **Step 3: See the idle sign-out fail**

Probe: in `hooks/useSessionGuard.ts:8`, change `IDLE_TIMEOUT` from 15 to 60 minutes.
Run: `npm run e2e:journeys -- journeys/session.spec.ts --project=desktop -g "15 idle"`. Expected: FAIL (no expiry notice).
Revert: `git checkout -- hooks/useSessionGuard.ts`.

- [ ] **Step 4: See sign-out fail**

Probe: in `hooks/useSessionGuard.ts` (around lines 43-46), comment out the `signOut(auth)` call in the logout function.
Run: `npm run e2e:journeys -- journeys/session.spec.ts --project=desktop -g "signs out"`. Expected: both FAIL.
Revert: `git checkout -- hooks/useSessionGuard.ts`, then `git status --short`.

- [ ] **Step 5: Commit**

```bash
git add e2e/journeys/session.spec.ts
```
```bash
git commit -m "test(e2e): sign-out for both roles and the idle session guard

Refs: [E2E-05]"
```

---

### Task 8: Password reset by real mail

**Files:**
- Create: `e2e/lib/reset-link.ts`, `e2e/lib/reset-link.test.ts`, `e2e/journeys/password-reset.spec.ts`

**Interfaces:**
- Consumes: `createAuthUser`, `STAGING_PROJECT`, `stagingWebApiKey` (`guards.ts`); `waitForMessage`, `extractResetLink` (`mail.ts`); `newRunId`, `runEmail` (`identities.ts`); `deleteRunAccount` (`teardown.ts`).
- Produces: `oobCodeFromResetLink(link: string, project?: string): string`; `confirmPasswordReset(oobCode: string, newPassword: string): Promise<void>`; `passwordWorks(email: string, password: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing unit tests**

`e2e/lib/reset-link.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oobCodeFromResetLink } from './reset-link.ts';

const link = (host: string, mode = 'resetPassword') => `https://${host}/__/auth/action?mode=${mode}&oobCode=ABC123&apiKey=k&lang=en`;

test('takes the oobCode from a staging reset link', () => {
  assert.equal(oobCodeFromResetLink(link('formula-fantasy-staging.firebaseapp.com')), 'ABC123');
});

test('refuses a link for another project, another mode or no code', () => {
  assert.throws(() => oobCodeFromResetLink(link('formula-fantasy-1.firebaseapp.com')), /not a staging reset link/);
  assert.throws(() => oobCodeFromResetLink(link('formula-fantasy-staging.firebaseapp.com', 'verifyEmail')), /not a staging reset link/);
  assert.throws(() => oobCodeFromResetLink('https://formula-fantasy-staging.firebaseapp.com/__/auth/action?mode=resetPassword'), /no oobCode/);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm run e2e:unit` → FAIL, `Cannot find module` for `./reset-link.ts`.

- [ ] **Step 3: Write `e2e/lib/reset-link.ts`**

```ts
import { GuardError, STAGING_PROJECT, stagingWebApiKey } from './guards.ts';

const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/accounts';

// The mail links to Firebase's hosted page, which the guards do not allow a browser to open.
// The journey reads the code from the link and finishes the reset over REST instead.
export function oobCodeFromResetLink(link: string, project = STAGING_PROJECT): string {
  const url = new URL(link);
  const stagingHost = url.hostname === `${project}.firebaseapp.com` || url.hostname === `${project}.web.app`;
  if (!stagingHost || url.searchParams.get('mode') !== 'resetPassword') throw new GuardError(`not a staging reset link: ${url.hostname}`);
  const code = url.searchParams.get('oobCode');
  if (!code) throw new Error('reset link has no oobCode');
  return code;
}

async function identity(op: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${IDENTITY}:${op}?key=${stagingWebApiKey()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export async function confirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
  const res = await identity('resetPassword', { oobCode, newPassword });
  if (!res.ok) throw new Error(`resetPassword: HTTP ${res.status}`);
}

export async function passwordWorks(email: string, password: string): Promise<boolean> {
  const res = await identity('signInWithPassword', { email, password, returnSecureToken: false });
  return res.ok;
}
```

- [ ] **Step 4: Run the unit tests**

Run: `npm run e2e:unit` → `# pass 126`, `# fail 0`. Then `npm --prefix e2e run typecheck` → exit 0.

- [ ] **Step 5: Write `e2e/journeys/password-reset.spec.ts`**

```ts
import { randomBytes } from 'node:crypto';
import { test, expect } from '../fixtures.ts';
import { newRunId, runEmail } from '../lib/identities.ts';
import { extractResetLink, waitForMessage } from '../lib/mail.ts';
import { createAuthUser } from '../lib/staging-admin.ts';
import { deleteRunAccount } from '../lib/teardown.ts';
import { confirmPasswordReset, oobCodeFromResetLink, passwordWorks } from '../lib/reset-link.ts';

// A password change revokes refresh tokens, so this never touches e2e-member: it resets a throwaway account.
test.describe('password reset', () => {
  test.use({ readOnly: false });
  const email = runEmail(newRunId());
  test.afterAll(async () => { await deleteRunAccount(email); });

  test('a member asks for a reset link, gets it by mail, and the new password works', { tag: '@write' }, async ({ anonPage: page, requires }) => {
    test.skip(test.info().project.name !== 'desktop', 'one write per run: desktop only');
    test.skip(process.env.E2E_REAL_MAIL !== '1', 'needs E2E_REAL_MAIL=1: the reset link only arrives by mail');
    test.setTimeout(180_000);
    await requires('maintenance-off');

    const oldPassword = `Old-${randomBytes(9).toString('base64url')}`;
    const newPassword = `New-${randomBytes(9).toString('base64url')}`;
    await createAuthUser({ email, password: oldPassword, displayName: 'E2E Reset' });

    await page.goto('/');
    await page.getByRole('button', { name: 'Forgot Password?', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Reset Password' })).toBeVisible();
    const since = new Date();
    await page.getByRole('textbox').fill(email); // the reset view's only textbox; its label has no htmlFor
    await page.getByRole('button', { name: 'Send Reset Link', exact: true }).click();
    await expect(page.getByText(/^If an account exists with this email, a password reset link has been sent\./)).toBeVisible({ timeout: 20_000 });

    const mail = await waitForMessage({ to: email, subjectIncludes: 'Reset Your Password', since, timeoutMs: 120_000 });
    const link = extractResetLink(mail.html);
    expect(link, 'the mail carries a reset link').not.toBeNull();
    await confirmPasswordReset(oobCodeFromResetLink(link!), newPassword);

    expect(await passwordWorks(email, newPassword), 'new password signs in').toBe(true);
    expect(await passwordWorks(email, oldPassword), 'old password no longer does').toBe(false);
  });
});
```

- [ ] **Step 6: Run it**

Run: `E2E_WRITES=1 E2E_REAL_MAIL=1 npm run e2e:journeys -- journeys/password-reset.spec.ts --project=desktop`
Expected: `1 passed` within about 2 minutes. Without `E2E_REAL_MAIL=1` it is skipped. Afterwards `npm run e2e:teardown` (no arguments) finds no `+run-*` account older than an hour, and `listAuthUsers` shows no account for this run's address.

- [ ] **Step 7: See it fail**

Probe: in `components/AuthScreen.tsx` (around line 334), change `getCallable('sendPasswordResetLink')` to `getCallable('sendPasswordResetLinkProbe')`.
Run the Step 6 command. Expected: FAIL, either at the success text or at `waitForMessage` timing out. This uses one of the 3 reset calls per 10 minutes.

- [ ] **Step 8: Revert the probe**

Run: `git checkout -- components/AuthScreen.tsx`, then `git status --short`.

- [ ] **Step 9: Commit**

```bash
git add e2e/lib/reset-link.ts e2e/lib/reset-link.test.ts e2e/journeys/password-reset.spec.ts
```
```bash
git commit -m "test(e2e): password reset by real mail on a throwaway account

The UI asks for the link, the bot inbox receives it, and the reset is
confirmed through Identity Toolkit because the hosted page is not an
allowed host. The link must be a staging resetPassword link before its
code is used. Runs only with E2E_WRITES=1 and E2E_REAL_MAIL=1.

Refs: [E2E-05]"
```

---

### Task 9: [E2E-05] done — three green runs, nothing left behind

**Files:**
- Create: `e2e/scripts/check-clean.ts`
- Modify: `e2e/package.json` (scripts), `e2e/README.md`

**Interfaces:**
- Consumes: `snapshotDocs`, `canonical`, `memberDocPaths` (Task 1); `listAuthUsers`, `queryDocIds`, `uidOf` (`staging-admin.ts`); `ADMIN_EMAIL`, `MEMBER_EMAIL`, `RUN_EMAIL_RE` (`identities.ts`).

- [ ] **Step 1: Write `e2e/scripts/check-clean.ts`**

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_EMAIL, MEMBER_EMAIL, RUN_EMAIL_RE } from '../lib/identities.ts';
import { listAuthUsers, queryDocIds, uidOf } from '../lib/staging-admin.ts';
import { canonical, memberDocPaths, snapshotDocs } from '../lib/snapshot.ts';

// Holds member data, so it lives under the gitignored e2e-results/ and is never printed.
const FILE = fileURLToPath(new URL('../../e2e-results/clean-baseline.json', import.meta.url));
const mode = process.argv[2];
if (mode !== '--save' && mode !== '--compare') {
  console.error('usage: check-clean.ts --save | --compare');
  process.exit(2);
}

const memberDocs = await snapshotDocs(memberDocPaths(await uidOf(MEMBER_EMAIL)));
const adminCodes = (await queryDocIds('invitation_codes', 'createdBy', await uidOf(ADMIN_EMAIL))).sort();
const runAccounts = (await listAuthUsers()).filter((u) => RUN_EMAIL_RE.test(u.email ?? '')).length;

if (mode === '--save') {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify({ memberDocs, adminCodes }));
  console.log(`saved: ${memberDocs.length} member docs, ${adminCodes.length} admin-created codes, ${runAccounts} +run-* accounts now`);
} else {
  if (!existsSync(FILE)) { console.error('no baseline: run with --save first'); process.exit(2); }
  const base = JSON.parse(readFileSync(FILE, 'utf8'));
  const problems: string[] = [];
  for (const doc of memberDocs) {
    const was = base.memberDocs.find((d: { path: string }) => d.path === doc.path);
    if (canonical(was?.fields ?? null) !== canonical(doc.fields)) problems.push(`${doc.path.split('/')[0]} differs from the baseline`);
  }
  if (canonical(base.adminCodes) !== canonical(adminCodes)) problems.push('invite codes created by e2e-admin differ from the baseline');
  if (runAccounts > 0) problems.push(`${runAccounts} +run-* accounts remain`);
  console.log(problems.length ? `NOT CLEAN:\n- ${problems.join('\n- ')}` : 'clean: member docs, admin codes and +run-* accounts match the baseline');
  process.exit(problems.length ? 1 : 0);
}
```

Add to `e2e/package.json` `scripts`: `"check-clean": "node --experimental-transform-types --no-warnings scripts/check-clean.ts"`.

- [ ] **Step 2: Typecheck and save the baseline**

Run: `npm --prefix e2e run typecheck` → exit 0.
Run: `npm --prefix e2e run check-clean -- --save` → `saved: 3 member docs, <n> admin-created codes, 0 +run-* accounts now`. If `+run-*` accounts already exist, run `npm run e2e:teardown` first (it removes those older than an hour) and save again.

- [ ] **Step 3: Three full runs, back to back**

Run, in the background, three times in sequence with nothing else in between:
`E2E_WRITES=1 E2E_REAL_MAIL=1 npm run e2e:journeys`
Expected each time: no failures; the write tests pass on desktop and are skipped on mobile. Record each run's pass/skip counts and duration. A failure restarts the count at run 1 after its fix. If a run fails with a rate-limit message from sign-up or reset, wait 10 minutes; that is not a test failure.

- [ ] **Step 4: Nothing left behind**

Run: `npm --prefix e2e run check-clean -- --compare`
Expected: `clean: member docs, admin codes and +run-* accounts match the baseline`, exit 0.

- [ ] **Step 5: README**

In `e2e/README.md`, under the section that lists test groups, add:

```markdown
### Journeys that write

| Spec | What it writes | Restored by |
|---|---|---|
| `journeys/picks.spec.ts` | e2e-member's `userPicks` | lossless snapshot (`lib/snapshot.ts`) |
| `journeys/profile.spec.ts` | e2e-member's `users` and `public_users` display name | lossless snapshot |
| `journeys/dues.spec.ts` (admin test) | e2e-member's `users.duesPaidStatus`, through the admin UI | the UI sets it back, then the snapshot |
| `journeys/invitations.spec.ts` | one `invitation_codes` doc created by e2e-admin | deleted through the UI, then any leftover in `finally` |
| `journeys/signup.spec.ts` | a throwaway `+run-*` account | `deleteRunAccount` |
| `journeys/password-reset.spec.ts` | a throwaway `+run-*` account's password (needs `E2E_REAL_MAIL=1`) | `deleteRunAccount` |

Every write test is desktop only and needs `E2E_WRITES=1`. Before a series of runs, save a baseline with
`npm --prefix e2e run check-clean -- --save`; afterwards `npm --prefix e2e run check-clean -- --compare`
must report `clean`. Sign-up and password reset each allow 3 calls per 10 minutes, so three full write
runs in a row reach the limit exactly.
```

- [ ] **Step 6: Commit**

```bash
git add e2e/scripts/check-clean.ts e2e/package.json e2e/README.md
```
```bash
git commit -m "test(e2e): check that write journeys leave staging as they found it

Refs: [E2E-05]"
```

- [ ] **Step 7: Records**

Append a "Plan 3" section to `/Users/jhh/Codebase/jhh-ai/worklog/playwright-adoption.md` with a task-outcomes table (commits per task), the three runs' counts and durations, the `check-clean` result, every probe and how it failed, and selector fixes made against the trace. Set `updated:` to the day.
Tracker: [E2E-05] Status `Completed` only if Steps 3 and 4 passed; Commits gets the SHAs and subjects from `git log --oneline --grep='E2E-05' staging..HEAD`; Evidence gets the run counts and the clean check. Ask the user whether to file the invitation confirm bug (Facts table) and the unnamed Team Inspection controls as tracker items; file only on yes.

---

### Task 10: [E2E-06] the `e2e:` line, commands and SOP

**Files:**
- Create: `e2e/lib/last-run.ts`, `e2e/lib/last-run.test.ts`, `e2e/scripts/last-run.ts`
- Modify: `scripts/release-gates.sh` (`cmd_show`), `CLAUDE.md` (Commands block), `e2e/README.md`
- Separate repo, after asking: `/Users/jhh/Codebase/jhh-ai/lol-docs/documentation/release-and-promotion-sop.md`

**Interfaces:**
- Consumes: `type Report` (`lib/report.ts`).
- Produces: `headRunsFor(reports: Report[], sha: string): Report[]`; `runLine(reports: Report[], sha: string): string`.

- [ ] **Step 1: Write the failing unit tests**

`e2e/lib/last-run.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Report } from './report.ts';
import { runLine } from './last-run.ts';

const SHA = 'a'.repeat(40);
const report = (over: Partial<Report> & { headSha?: string; dirty?: boolean }): Report => ({
  run: over.run ?? 'r1', startedAt: over.startedAt ?? '2026-11-26T10:00:00Z', durationMs: 1, frozenAt: 0,
  sides: [{ name: 'base', target: 'origin/prod', sha: 'b'.repeat(40), url: 'u' }, { name: 'head', target: 'staging', sha: over.headSha ?? SHA, dirty: over.dirty, url: 'u' }],
  selection: { all: true, ids: [] } as unknown as Report['selection'],
  rows: over.rows ?? [], hardFailures: over.hardFailures ?? [], warnings: [], blockedWrites: [],
});
const row = (status: Report['rows'][number]['status']) => ({ key: 'k', surface: 's', theme: 'dark', project: 'p', status, diffPixels: 0, diffRatio: 0, sizeChanged: false, ariaChanged: false, unstable: false, images: {}, failures: [] });

test('summarises the latest clean-head compare run for the commit', () => {
  const older = report({ run: 'old', startedAt: '2026-11-25T10:00:00Z' });
  const newer = report({ run: 'new', rows: [row('changed'), row('unchanged'), row('unchanged')] });
  assert.equal(runLine([older, newer], SHA), '  [~] e2e: new vs origin/prod: 1 changed, 0 hard failures, 3 rows (warn only)');
});

test('ignores runs whose head had uncommitted changes or another commit', () => {
  const line = runLine([report({ dirty: true }), report({ headSha: 'c'.repeat(40) })], SHA);
  assert.match(line, /^  \[~\] e2e: no compare run has this commit as its head/);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm run e2e:unit` → FAIL, `Cannot find module` for `./last-run.ts`.

- [ ] **Step 3: Write `e2e/lib/last-run.ts` and `e2e/scripts/last-run.ts`**

`e2e/lib/last-run.ts`:

```ts
import type { Report } from './report.ts';

export function headRunsFor(reports: Report[], sha: string): Report[] {
  return reports
    .filter((r) => r.sides.some((s) => s.name === 'head' && s.sha === sha && !s.dirty))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

// One line for release-gates.sh show. It informs and never gates: visual diffs need a person to read them.
export function runLine(reports: Report[], sha: string): string {
  const [latest] = headRunsFor(reports, sha);
  if (!latest) return '  [~] e2e: no compare run has this commit as its head (warn only; npm run e2e:compare -- --base origin/prod --head <ref>)';
  const changed = latest.rows.filter((r) => r.status === 'changed').length;
  const base = latest.sides.find((s) => s.name === 'base')?.target ?? '?';
  return `  [~] e2e: ${latest.run} vs ${base}: ${changed} changed, ${latest.hardFailures.length} hard failures, ${latest.rows.length} rows (warn only)`;
}
```

`e2e/scripts/last-run.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Report } from '../lib/report.ts';
import { runLine } from '../lib/last-run.ts';

// Run from the repo root (release-gates.sh cds there). Results are per checkout: a worktree's runs live in its own e2e-results/.
const sha = process.argv[2];
if (!/^[0-9a-f]{40}$/.test(sha ?? '')) {
  console.error('usage: last-run.ts <full commit sha>');
  process.exit(2);
}
const dir = 'e2e-results';
const reports: Report[] = existsSync(dir)
  ? readdirSync(dir).map((d) => join(dir, d, 'report.json')).filter((f) => existsSync(f)).map((f) => JSON.parse(readFileSync(f, 'utf8')))
  : [];
console.log(runLine(reports, sha));
```

- [ ] **Step 4: Run the unit tests and try the script**

Run: `npm run e2e:unit` → `# pass 128`, `# fail 0`. Then `npm --prefix e2e run typecheck` → exit 0.
Run: `node --experimental-transform-types --no-warnings e2e/scripts/last-run.ts "$(git rev-parse staging)"`
Expected: a line naming `20261127T040836Z-origin-prod-vs-staging` (staging was its clean head), unless that folder was removed.

- [ ] **Step 5: Print it from `release-gates.sh show`**

In `scripts/release-gates.sh` `cmd_show`, after the deploy-records line (`gates_notes_body "$sha" | grep -E '^(data-plane|portal)-deployed:' …`), add:

```bash
  # Screenshot compare, warn only: it never blocks and signing stays human.
  if [[ -f e2e/scripts/last-run.ts ]]; then
    node --experimental-transform-types --no-warnings e2e/scripts/last-run.ts "$sha" 2>/dev/null \
      || echo "  [~] e2e: could not read e2e-results (warn only)"
  fi
```

Run: `bash -n scripts/release-gates.sh` → exit 0.
Run: `./scripts/release-gates.sh show staging` → the usual output plus one `[~] e2e:` line after the gate lines; exit code unchanged.

- [ ] **Step 6: Commands in `CLAUDE.md`**

In the `## Commands` code block of `CLAUDE.md`, after the `./deploy-staging.sh` line, add:

```bash
npm run e2e:journeys              # Playwright journeys against STAGING; read-only unless E2E_WRITES=1 (see e2e/README.md)
npm run e2e:compare               # same-moment screenshot A/B: staging vs this checkout, affected surfaces only
```

- [ ] **Step 7: README**

In `e2e/README.md`, after "Capture and compare", add:

```markdown
## In the release process

`./scripts/release-gates.sh show` prints one `[~] e2e:` line: the latest compare run in this checkout's
`e2e-results/` whose head was the commit with no uncommitted changes. It is information only. It never
blocks, and an agent never signs a gate on its strength.
```

- [ ] **Step 8: Commit**

```bash
git add e2e/lib/last-run.ts e2e/lib/last-run.test.ts e2e/scripts/last-run.ts scripts/release-gates.sh CLAUDE.md e2e/README.md
```
```bash
git commit -m "feat(e2e): warn-only e2e line in release-gates show

Refs: [E2E-06]"
```

- [ ] **Step 9: SOP (separate repo, ask first)**

Draft these additions to `/Users/jhh/Codebase/jhh-ai/lol-docs/documentation/release-and-promotion-sop.md` and show the diff to the user before committing or pushing in `lol-docs`:
- **Stage 2:** after `npm run build -- --mode staging`, run `npm run e2e:compare` (affected surfaces against `staging`) and `npm run e2e:journeys`; read the gallery. "This informs the human check; it does not replace it."
- **Stage 4:** after `./deploy-staging.sh`, run `npm run e2e:compare -- --base staging --head https://f1.staging.carolinaminted.net` to confirm the deploy, and before a release `npm run e2e:compare -- --base origin/prod --head staging` to see what members will see change. `release-gates.sh show` prints the result as a warn-only `e2e:` line. Signing stays human.

In `lol-docs`, switch branches in a call of its own before editing (the branch guard reads the app repo otherwise).

- [ ] **Step 10: Leave the first real use for after Dec 13**

[E2E-06]'s done-when is one real change through the full loop, planned on [ROLL-19]. Add to the [E2E-06] tracker page: "Build done on feat/e2e-harness (<SHA>). First real use waits for the merge after Dec 13: take [ROLL-19] through Stage 2 compare and journeys, Stage 4 confirm-deploy and prod-vs-staging compare, and read the `e2e:` line before signing." Leave Status `In Progress`.

---

### Task 11: Close out

- [ ] **Step 1: Final check**

- `npm run e2e:unit` → all pass (`# pass 128`).
- `npm --prefix e2e run typecheck` → exit 0.
- `npm run lint` and `npm test` → exit 0.
- `git status --short` → empty.
- `git diff --stat staging -- . ':(exclude)e2e'` → `.dockerignore`, `.gitignore`, `package.json`, `tsconfig.json`, plus `scripts/release-gates.sh` and `CLAUDE.md`.
- `git diff --quiet staging -- package-lock.json` → exit 0.

- [ ] **Step 2: Records**

Worklog: finish the "Plan 3" section with Task 10's outcome. Tracker: [E2E-06] Commits and Evidence. [E2E-00]: append "Build notes (plan 3, <date>)" with the "Differences from the spec" list above.

- [ ] **Step 3: Ask before pushing**

Ask the user to confirm `git push origin feat/e2e-harness`. Do not merge into `staging` before HO-2 has shipped and [ROLL-06] closes. Offer `/handoff`.
