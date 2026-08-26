# Lights Out League

Mobile-first fantasy F1 league app, ~40 members. React 19 + TypeScript + Vite 6, Firebase
(Auth + Firestore + Gen 2 Functions on Node 22), frontend on Google Cloud Run.

---

## ⚠️ Cloud projects and the migration boundary

Four Google Cloud projects are in play. Two of them are **live production**.

| Project | Number | Role | Status |
|---|---|---|---|
| `lights-out-league-prod` | 45017321387 | New consolidated Cloud Run web + API | Deployed, frozen at image digests, **still pointed at staging Firebase** |
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
./deploy-staging.sh               # deploys Functions + frontend to STAGING only
```

`deploy-staging.sh` self-guards: it asserts the `.firebaserc` staging alias, hardcodes its
targets (`formula-fantasy-staging`, Cloud Run `lights-out-league-staging`, `us-west1`), refuses
any argument that would redirect it, and explicitly fails if a `formula-fantasy-1` target
appears. Do not add override flags to it. It also *warns* (never blocks) when run from a branch
other than `staging` or with a dirty working tree — see Branches.

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

The dated branches exist because every environment change used to invent a new one. That cost real
time: `live-staging-august-24-2026` and `live-prod-staging-august-25-2026` silently drifted 14
commits apart, and neither name said what either environment was running.

`cloudbuild.web.yaml` defaults to `lights-out-league-prod` Artifact Registry (`us-west1`) via the
`lol-build` service account. It takes `_REGISTRY_PATH` / `_BUILD_SA` substitutions so staging builds
reuse the same config against `formula-fantasy-staging`. `cloudbuild.api.yaml` builds the retired
REST API and is not in either serving path.

**Never put a credential in `functions/.env.<project>`.** `firebase deploy --only functions` injects
those files as *plaintext* function config, readable by any project viewer. Email credentials belong
in Secret Manager, bound to `sendAuthCode` and `sendPasswordResetLink` only. `deploy-staging.sh`
re-binds them after every deploy and fails if plaintext is detected.

## Layout

- `App.tsx` (986 lines) — page state machine and most app wiring.
- `routes.ts` — URL ↔ Page mapping. Six canonical surfaces plus aliases that resolve to the
  surface which absorbed them, and a separate redirect table for retired URLs.
- `components/` — 33 top-level `.tsx` files plus 83 more across `admin/`, `league/`, `picks/`,
  `profile/`, `showcase/`, `standings/`, `ui/`, and `icons/`. The largest top-level files are
  `SchedulePage`, `DatabaseManagerPage`, `LeaderboardPage`, `AuthScreen`, and `PicksForm`.
- `services/` — `firestoreService` (direct Firestore), `callableService` (Functions callables),
  `apiService` (new containerized API), `scoringService`, `validation`.
- `functions/` — Gen 2 Functions package, Node 22. Seven exports: `updateLeaderboardOnResults`,
  `updateLeaderboardOnCancellation`, `manualLeaderboardSync`, `sendAuthCode`, `verifyAuthCode`,
  `validateInvitationCode`, `sendPasswordResetLink`.
- `backend/api/` — the new containerized API (Express + Docker) that admin and auth operations
  are migrating to.
- `hooks/`, `contexts/` (ToastContext), `utils/`, `styles/`.

**The scoring engine is implemented twice** — `services/scoringService.ts` (client) and
`functions/index.js` (server) implement the same math independently. A scoring rule change must
land in both or the two will disagree. See `SCORING_AUDIT_LOGIC.md`.

## Conventions

- **Commits:** conventional and scoped, matching the existing log — `feat(api):`,
  `chore(functions):`, `docs(design):`, `fix(ui):`.
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

- `PROD_MIGRATION_SUMMARY.md` — migration state, project inventory, the boundary. Start here.
- `PROD_MIGRATION_SESSION_HANDOFF_2026-08-24.md` — detailed handoff.
- `STAGING_ENVIRONMENT_SUMMARY.md` — staging inventory.
- `documentation/production-cutover-readiness-runbook.md` — the cutover procedure.
- `documentation/carolinaminted-net-domain-sop.md` — domain/DNS.

In-repo docs (`ADMIN_GUIDE.md`, `PLAYER_GUIDE.md`, `FUNCTION_GUIDE.md`, `SCORING_AUDIT_LOGIC.md`,
`DEPLOYMENT_GUIDE.md`) date to 2026-08-17 and predate both the staging build-out and the
migration — useful for domain logic, unreliable for infrastructure. `FIREBASE_SETUP.md` is an
empty stub. `lol-staging-environment-plan.md` and `docs/prod-cloudrun-baseline.yaml` cover the
staging design and the captured production baseline.

## Known open work

**Season rollover is unstarted and time-critical.** `constants.ts` still carries 24 hardcoded
`*_26` event IDs and the Firestore model has no season dimension anywhere — season data lives in
`app_state/*` singleton docs, `userPicks/{uid}`, and `public_users/{uid}`. Rolling into a new
season currently means manual database surgery. Plan: `../fable-plans/stage-1-season-rollover.md`.
