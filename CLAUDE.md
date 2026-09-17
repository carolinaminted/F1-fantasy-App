# Lights Out League

Mobile-first fantasy F1 league app, ~40 members. React 19 + TypeScript + Vite 6, Firebase
(Auth + Firestore + Gen 2 Functions on Node 22), frontend on Google Cloud Run.

---

## ⚠️ Cloud projects and the migration boundary

Four Google Cloud projects are in play. Two of them are **live production**.

| Project | Number | Role | Status |
|---|---|---|---|
| `lights-out-league-prod` | 45017321387 | New consolidated Cloud Run web + API (prod-staging) | Deployed, digest-pinned, **pointed at production Firebase since 2026-08-25** |
| `formula-fantasy-1` | 193463400309 | Production Auth + Firestore + 7 Gen 2 Functions | **LIVE — unchanged** |
| `gen-lang-client-0034225567` | 1020839022884 | Legacy production frontend | **LIVE — this is the rollback system** |
| `formula-fantasy-staging` | 342911349882 | Isolated validation data plane | Current target of the new prod compute |

**The migration is intentionally paused at the last safe preparation point.** Do not mutate
`formula-fantasy-1` or `gen-lang-client-0034225567` — no Firestore writes, Functions deploys,
domain or DNS changes, IAM edits, or traffic shifts — without explicit per-action approval from
the user. Production cutover is a separate approval and follows
`../lol-docs/documentation/production-cutover-readiness-runbook.md`.

Current state is documented in `../lol-docs/PROD_MIGRATION_SUMMARY.md`. Read it before
proposing any infrastructure work.

## Environment modes — read before running the app

There is no `.env.development` and no `.env`. `firebaseConfig.ts` calls `requireEnv()` and
**throws** when a `VITE_FIREBASE_*` var is missing, so a bare `npm run dev` (Vite's default
`development` mode) fails to boot with `Missing required Firebase environment variable`.

Always pass a mode:

| Mode | File | Firebase project |
|---|---|---|
| `staging` | `.env.staging` | `formula-fantasy-staging` — safe |
| `prod-staging` | `.env.prod-staging` | **`formula-fantasy-1` — live member data.** Callables in `lights-out-league-prod` |
| `production` | `.env.production` | `formula-fantasy-1` — **live member data; sign-ins, picks and profile edits are real writes** |

Both `staging` and `prod-staging` set `VITE_PORTAL_FUNCTIONS_BASE_URL`, so `getCallable()` takes the
`httpsCallableFromURL` branch in both — staging exercises the same code path production does.
`VITE_API_BASE_URL` is set in **neither**; the REST API is out of both serving paths.

⚠️ `prod-staging` is no longer staging-safe. It was repointed at production Firebase on 2026-08-25
and validated against real data. Only `--mode staging` is safe for casual local work.

No Firebase emulator is wired up. Default to `--mode staging` for local work.

> Note: `../lol-docs/documentation/running-lights-out-league-locally.md` predates this change and
> still says the config is hardcoded to production in `firebaseConfig.ts`. It isn't — that file
> is env-driven now.

## Commands

```bash
npm run dev -- --mode staging     # local dev against staging (see above; bare `npm run dev` throws)
npm run lint                      # tsc --noEmit — this IS the typecheck; there is no ESLint
npm run build -- --mode staging   # vite build for a given mode
./deploy-staging.sh --dry-run     # lint + build, touches no cloud resources
./deploy-staging.sh               # deploys Functions + Firestore rules/indexes + frontend to STAGING

./scripts/release-gates.sh show   # where this commit stands in the pipeline
./scripts/release-gates.sh sign local     # record that you tested it locally
./scripts/release-gates.sh sign staging   # record that you tested it on staging (checks first)
./deploy-prod-staging.sh          # build `prod` → zero-traffic candidate on prod-staging
./scripts/release-gates.sh sign candidate # record that you smoke-tested the candidate URL
./promote-prod-staging.sh         # shift prod-staging traffic to the candidate
```

`deploy-staging.sh` self-guards: it asserts the `.firebaserc` staging alias, hardcodes its
targets (`formula-fantasy-staging`, Cloud Run `lights-out-league-staging`, `us-west1`), refuses
any argument that would redirect it, and explicitly fails if a `formula-fantasy-1` target
appears. Do not add override flags to it. It also *warns* (never blocks) when run from a branch
other than `staging` or with a dirty working tree — see Branches.

The Firestore step deploys `firestore.rules` and `firestore.indexes.json` together via
`--only firestore`, and **never passes `--force`**. Under `--non-interactive`, firebase-tools only
*warns* about indexes that exist in the project but not in the file; `--force` is what turns that
warning into a deletion. A rules deploy replaces the whole ruleset, so the script diffs the live
ruleset first and warns if a console edit is about to be reverted, then re-fetches afterward and
fails if the project is not actually serving the committed file.

## Branches

Two durable branches, adopted 2026-08-26. **Do not create another dated branch.**

| Branch | Role |
|---|---|
| `staging` | Integration branch, and what staging deploys from. Feature branches cut from it and merge back into it. |
| `prod` | Release branch, cut from a `staging` commit already deployed and validated in staging. Prod-staging and production images build from here. |
| `main`, `develop`, `live-*`, `prod-migration`, `lol-codex` | Historical. Retained for the migration record, never advanced. `main` is still GitHub's default. |

Work flows `feature` → `staging` → `prod`, never the reverse. A release is a `staging` → `prod`
merge of a commit that has already run in staging — so `prod` never contains code no environment
has served.

### Both durable branches are merge-only — enforced

`prod` and `staging` are never edited or committed on directly. All work starts on a feature
branch cut from `staging`:

```bash
git checkout -b feat/... staging          # make the change here
git checkout staging && git merge feat/... # land it
git checkout prod && git merge --ff-only staging && git push origin prod   # release
```

Three independent layers enforce this:

| Layer | File | Covers |
|---|---|---|
| Claude Code `PreToolUse` hook | `.claude/hooks/guard-protected-branch.sh`, registered in `.claude/settings.json` | Agent sessions in this repo — refuses Edit/Write and mutating git commands on a protected branch |
| Git hooks | `.githooks/pre-commit`, `.githooks/pre-push` | Every commit and push from this clone, including your own terminal |
| GitHub ruleset on `prod` + `staging` | server-side | Force-push and deletion, from any clone |

**One-time per clone:** `git config core.hooksPath .githooks` — git does not install hooks on
clone, and nothing else runs this for you.

Merges are unaffected by all of it: fast-forward merges fire no hook, merge commits fire
`pre-merge-commit` (deliberately not installed), and the commit concluding a conflicted or
`--squash` merge is allowed via `MERGE_HEAD` / `SQUASH_MSG`. `pre-push` additionally rejects a
`prod` push carrying a non-merge commit that is not reachable from `origin/staging` — so push
`staging` before releasing.

### Release gates

A commit reaches `prod` only after clearing gates recorded as git notes on
`refs/notes/release-gates` (`./scripts/release-gates.sh show <ref>`):

| Gate | Kind | Meaning |
|---|---|---|
| `local-verified` | attested | a human ran it locally and looked at it |
| `staging-verified` | attested **+ checked** | recorded only if staging is *actually serving* that commit |
| `candidate-verified` | attested | a human smoke-tested the zero-traffic prod-staging candidate |
| `promoted` | recorded | traffic was shifted, all four post-promotion gates passed |

`staging-verified` is the interesting one: signing it runs an objective check first. The staging
service's 100%-traffic revision → its image digest → that digest's `staging-<sha>` tag → resolved
back through `git rev-parse`. You cannot sign a commit staging is not running.

`pre-push` enforces the gates on the **tip** commit of a `prod` push. Only the tip, because
`deploy-staging.sh` deploys HEAD — no intermediate feature commit was ever served on its own.
The notes check always blocks; the staging-serving check blocks only on a *conclusive* negative
and warns-then-allows when it cannot reach an answer. Failing closed on an inconclusive check
would just train you to use the override.

**Three of the four gates are attestation, not verification.** There are no automated functional
tests in this repo; `npm run lint` is a typecheck. The tooling records who said what and when —
it cannot know whether you actually looked, and it says so.

As of 2026-08-30 no gate has ever been recorded: `refs/notes/release-gates` does not exist, locally
or on `origin`. The notes check in `pre-push` always blocks, so the next `prod` release must
`./scripts/release-gates.sh sign local` and `sign staging` on its tip commit before the push will
go through. The script fetches and pushes that notes ref itself on each `sign`.

`LOL_ALLOW_PROD_EDIT=1` overrides the git hooks for a genuine emergency hotfix. The Claude Code
hook has no override on purpose: the human can bypass, the agent cannot.

Known gap, stated honestly: `staging` has no `pre-push` content check — its sources are many
short-lived feature branches, so there is nothing single to compare against. `pre-commit` is the
real guard there, and a commit made with the override, or in a clone that never set
`core.hooksPath`, will still push.

The dated branches exist because every environment change used to invent a new one. That cost real
time: `live-staging-august-24-2026` and `live-prod-staging-august-25-2026` silently drifted 14
commits apart, and neither name said what either environment was running.

`cloudbuild.web.yaml` defaults to `lights-out-league-prod` Artifact Registry (`us-west1`) via the
`lol-build` service account. It takes `_REGISTRY_PATH` / `_BUILD_SA` substitutions so staging builds
reuse the same config against `formula-fantasy-staging`. `cloudbuild.api.yaml` builds the retired
REST API and is not in either serving path.

**Never put a credential in `functions/.env.<project>`.** `firebase deploy --only functions` injects
those files as *plaintext* function config, readable by any project viewer. Email credentials belong
in Secret Manager, bound to `sendAuthCode` and `sendPasswordResetLink` only. `deploy-staging.sh` no
longer binds them out of band — it once did, via `gcloud run services update --set-secrets`, which
turned out to be a trap (see below). It now reads each function's serving revision *after* the deploy
and fails if a credential is served as plaintext or a declared secret did not attach.

**Email secrets are declared in code, and must not be bound out of band.** `functions/email-secrets.js`
maps each project to its Secret Manager names and `functions/index.js` passes them as `secrets:` on
`sendAuthCode` / `sendPasswordResetLink`, so `firebase deploy` binds them itself. `formula-fantasy-1`
is deliberately unlisted — it still holds the credential as plaintext config, and falls back to
reading `EMAIL_USER` / `EMAIL_PASS` from the environment so an emergency deploy there is not blocked.

**The Functions runtime identity is declared in code too.** `functions/runtime-service-account.js`
maps each project to a dedicated least-privilege service account and `functions/index.js` applies it
via `setGlobalOptions({ serviceAccount })`, so every function runs as that identity instead of the
default Compute Engine SA. `deploy-staging.sh` resolves the expected account for the target project
and fails *before* the deploy if it is unset or the account does not exist in the project.

Two commands are traps, both learned the hard way:

- **`gcloud run services update --set-secrets`** writes the Cloud Run service behind the Cloud
  Functions v2 API's back and blanks the function's GCF record. After that, `firebase deploy --only
  functions` silently stops rebuilding that function. From 2026-08-26 to 2026-08-30 both email
  functions were in that state — five of seven functions rebuilt on every deploy and these two never
  did, while the deploy reported success.
- **`gcloud functions deploy`** re-uploads the *current directory* as the function's source. Run from
  the repo root on 2026-08-26 it shipped the whole repo (414 KB rather than ~45 KB); the root
  `package.json` has no `main`, so the Node buildpack looked for `function.js`, found nothing, and
  both email builds failed while the Firebase CLI still exited 0.

`deploy-staging.sh` fails on both fingerprints: a build failure inside the deploy's window, and any
function reporting `ACTIVE` with no `serviceConfig.revision`.

Because `defineSecret` pins the secret *version* current at deploy time, rotating a credential
requires a redeploy — adding a version alone changes nothing. `scripts/rotate-staging-email-secret.sh`
does that redeploy.

## Layout

- `App.tsx` (~1000 lines) — page state machine and most app wiring.
- `routes.ts` — URL ↔ Page mapping. Six canonical surfaces plus aliases that resolve to the
  surface which absorbed them, and a separate redirect table for retired URLs.
- `components/` — 33 top-level `.tsx` files plus 83 more across `admin/`, `league/`, `picks/`,
  `profile/`, `showcase/`, `standings/`, `ui/`, and `icons/`. The largest top-level files are
  `SchedulePage`, `DatabaseManagerPage`, `LeaderboardPage`, `AuthScreen`, and `PicksForm`.
- `services/` — `firebase` (SDK init: `auth`, `db`, `functions`, from root `firebaseConfig.ts`),
  `firestoreService` (direct Firestore), `callableService` (Functions callables), `apiService`
  (new containerized API), `scoringService`, `validation`.
- `functions/` — Gen 2 Functions package, Node 22. Seven exports: `updateLeaderboardOnResults`,
  `updateLeaderboardOnCancellation`, `manualLeaderboardSync`, `sendAuthCode`, `verifyAuthCode`,
  `validateInvitationCode`, `sendPasswordResetLink`.
- `backend/api/` — the new containerized API (Express + Docker) that admin and auth operations
  are migrating to.
- `hooks/`, `contexts/` (ToastContext), `utils/`, `styles/`.
- Scripts: `deploy-staging.sh`, `deploy-prod-staging.sh`, `promote-prod-staging.sh` at the root;
  `scripts/` holds `release-gates.sh`, `rotate-staging-email-secret.sh`, and `bundle-audit.sh`.

**The scoring engine is implemented twice** — `services/scoringService.ts` (client) and
`functions/index.js` (server) implement the same math independently. A scoring rule change must
land in both or the two will disagree. See `SCORING_AUDIT_LOGIC.md`.

## Conventions

- **Commits:** conventional and scoped, matching the existing log — `feat(api):`,
  `chore(functions):`, `docs(design):`, `fix(ui):`.
- **Work-item trailer:** when a commit closes or advances a tracked item, end the message with
  `Refs: [M-8]` (several are fine: `Refs: [C-1], [C-2]`). IDs come from the Notion **F1 Work
  Items** database. `.githooks/commit-msg` hints when it is missing but **never blocks** — a
  commit with no work item is normal. Silence it with `LOL_SKIP_REFS_HINT=1`.

  This is worth the keystrokes: as of 2026-08-30 not one commit in the history carried an ID, so
  reconciling the tracker meant recovering each fixing commit by pickaxe —
  `git log -S'<code signature>' -- <path>`. That works but is slow and misses fixes that arrived
  incidentally. `[M-2]` was fixed inside an unrelated `getFormLocks` refactor and sat open in the
  tracker for three months as a result. When closing an item, record the SHA and subject on it,
  and derive its environment with `git branch --contains <sha>`.
- **Design:** `DESIGN.md` is the authority, and it is detailed — read it before any UI work.
  Near-black canvas `#0A0A0A`, Rosso Corsa `#DA291C` used sparingly, translucent tiles on dark
  (`bg-accent-gray/40` + hairline border + blur, never opaque cards), Exo 2, headings
  `font-black uppercase italic`, tabular numerals for any figure compared vertically. The four
  scoring category colors — GP red, Qualifying blue, Sprint yellow, Fastest Lap purple — are the
  system's most load-bearing convention. Never improvise them.
- **Env files:** `.env.production`, `.env.staging`, and `.env.prod-staging` are *intentionally
  versioned* and hold public Firebase web config only. Every other `.env*` is gitignored. Never
  put a secret in the versioned three.

## Where the docs are

Authoritative and current, in `../lol-docs/`:

- `PROD_MIGRATION_SUMMARY.md` — migration state, project inventory, the boundary. Start here, but
  note it is a 2026-08-24 snapshot: it predates the 2026-08-25 prod-Firebase repoint of
  prod-staging and the 2026-08-29 Functions runtime-SA work, both already reflected in this file.
- `PROD_MIGRATION_SESSION_HANDOFF_2026-08-24.md` — detailed handoff.
- `STAGING_ENVIRONMENT_SUMMARY.md` — staging inventory.
- `F1_STAGING_PROGRESS.md` — staging build-out progress log.
- `documentation/production-cutover-readiness-runbook.md` — the cutover procedure.
- `documentation/release-and-promotion-sop.md` — the `feature` → `staging` → `prod` → prod-staging
  release and promotion procedure.
- `documentation/running-lights-out-league-locally.md` — local dev (with the caveat noted under
  Environment modes above).
- `documentation/deploying-lights-out-league-from-macbook.md` — operator deploy walkthrough.
- `documentation/prod-staging-write-tests.md` — the prod-staging write-path validation.
- `documentation/carolinaminted-net-domain-sop.md` — domain/DNS.
- `regression/` — standings-diff regression harness (`verify.sh` against a captured baseline).

In-repo docs (`ADMIN_GUIDE.md`, `PLAYER_GUIDE.md`, `FUNCTION_GUIDE.md`, `SCORING_AUDIT_LOGIC.md`,
`DEPLOYMENT_GUIDE.md`) date to 2026-08-17 and predate both the staging build-out and the
migration — useful for domain logic, unreliable for infrastructure. `FIREBASE_SETUP.md` is an
empty stub. `lol-staging-environment-plan.md` and `docs/prod-cloudrun-baseline.yaml` cover the
staging design and the captured production baseline.

## Known open work

**Season rollover is unstarted and time-critical.** `constants.ts` still carries 24 hardcoded
`*_26` event IDs and the Firestore model has no season dimension anywhere — season data lives in
`app_state/*` singleton docs, `userPicks/{uid}`, and `public_users/{uid}`. Rolling into a new
season currently means manual database surgery. The old `../fable-plans/stage-1-season-rollover.md`
plan was lost (only the branch-drift table in the workspace `../CLAUDE.md` survives) and needs to
be rewritten; tracked items live in the Notion **F1 Work Items** database. A hard dependency to
carry into that plan: the server scoring engine has no season filter — the client drops
non-current events, the server scores any event key with a result — so last season's picks and
results must be partitioned or the two engines diverge the moment new events land.
