# Lights Out League — Staging Environment Plan (Soup to Nuts)

**Doc status:** v1 · 2026-08-20 · Grounded against fresh `main` pull (verified same day)
**Goal:** A fully isolated staging stack at `f1.staging.carolinaminted.net` that mirrors prod architecture, shares zero data with prod, and is deployable end-to-end from the MacBook.

---

## Target End State (where we want to be)

```
Claude Code (MacBook, feature branch)
        │  local dev + Firebase Emulator Suite
        ▼
Deploy to STAGING  ──►  f1.staging.carolinaminted.net
        │  regression pass on live staging resources
        ▼
Merge to main
        ▼
Deploy to PRODUCTION  ──►  f1.carolinaminted.net
   (frontend + functions, from terminal)
```

Prod is never touched by development traffic. Staging is a true dress rehearsal: same Cloud Run architecture, same Firestore rules, same functions, its own Firebase project, its own data.

---

## Architecture: Prod vs. Staging (parity map)

| Layer | Production (today) | Staging (to build) |
|---|---|---|
| GCP/Firebase project | `formula-fantasy-1` (⚠ confirm Cloud Run project in Phase 0 — may be `formula-fantasy-one`) | `formula-fantasy-staging` (new; one project hosts everything) |
| Frontend | Cloud Run `lights-out-league`, `us-west1`, request-based billing, capped instances | Cloud Run `lights-out-league-staging`, `us-west1`, same billing model, max-instances 2 |
| Frontend deploy path | Google AI Studio → Cloud Run | MacBook: `docker`/`gcloud run deploy` via new Dockerfile |
| Functions | 7 × Gen 2, `us-central1`, Node runtime per `functions/package.json` | Same code, same region, deployed via `firebase deploy --only functions --project staging` |
| Firestore | Prod data, PITR enabled | Empty + seeded synthetic data. **No prod PII ever.** |
| Auth | Email/Password + custom email-code flow (nodemailer) | Same providers; staging authorized domains; test email credentials |
| Domain | `f1.carolinaminted.net` → prod service | `f1.staging.carolinaminted.net` → staging service (Squarespace CNAME) |
| Rules/Indexes | Live in console (indexes not in repo — drift) | Deployed from repo; prod indexes exported into repo first |

---

## Phase 0 — Inventory & Alignment (½ evening, read-only, zero risk)

Resolve every ambiguity about prod **before** creating anything. Outputs of this phase are the parity baseline.

1. **Pin down the GCP project(s).**
   ```bash
   gcloud projects list
   gcloud run services list --project formula-fantasy-1 --region us-west1
   gcloud run services list --project formula-fantasy-one --region us-west1   # if it exists
   ```
   Record which project actually hosts `lights-out-league`. If frontend and Firebase live in different projects, note it — staging will deliberately consolidate into one.

2. **Export the prod Cloud Run config as the parity spec.**
   ```bash
   gcloud run services describe lights-out-league --region us-west1 \
     --project <confirmed-project> --format export > docs/prod-cloudrun-baseline.yaml
   ```
   Captures memory, CPU, concurrency, max-instances, request-based billing flags — staging copies these, don't guess them.

3. **Record the prod Firestore database region.**
   ```bash
   gcloud firestore databases describe --project formula-fantasy-1
   ```
   Staging Firestore must use the same region (region is immutable after creation).

4. **Export prod Firestore indexes into the repo.**
   ```bash
   firebase firestore:indexes --project formula-fantasy-1 > firestore.indexes.json
   ```
   ⚠ `firebase.json` already references this file **but it does not exist in the repo**. This step both unblocks staging deploys and closes an existing repo↔prod drift. Commit it.

5. **Document prod Auth config** (console, read-only): enabled providers, authorized domains, email templates in use. Staging replicates this list.

6. **Confirm functions env mechanism**: verify `functions/.env` exists locally with `EMAIL_USER` / `EMAIL_PASS` (gitignored). Staging gets its own per-project env file in Phase 2.

**Exit criteria:** one-page inventory: project IDs, Cloud Run spec YAML, Firestore region, auth provider list, env var list.

---

## Phase 1 — Create the Staging Project (1 evening)

1. Firebase Console → **Add project** → `formula-fantasy-staging`. Same Google account (`jhh@`), so ownership/verification carries.
2. **Upgrade to Blaze** (required for Gen 2 functions + Cloud Run). Immediately set cost guardrails:
   - Budget alert on the staging billing scope (e.g., $10/mo threshold email).
   - These caps plus max-instances=2 (Phase 4) keep an idle staging stack near $0.
3. **Enable Firestore** — Native mode, **same region as prod** (from Phase 0.3).
4. **Enable Authentication** — Email/Password provider (matching Phase 0.5 inventory).
5. **Register a Web App** in project settings → capture the staging `firebaseConfig` values (apiKey, authDomain, projectId, appId, etc.). These feed Phase 2.
6. Confirm `gcloud`/`firebase` CLIs can see the project:
   ```bash
   firebase projects:list
   gcloud config configurations list
   ```

**Exit criteria:** `formula-fantasy-staging` exists on Blaze with Firestore + Auth enabled and a registered web app config in hand.

---

## Phase 2 — Repo Changes (the only code work; ~1–2 evenings)

Each item is its own commit. None changes prod behavior — prod builds continue to resolve identical values.

### 2.1 Parameterize `firebaseConfig.ts` (mandatory — currently hardcoded to prod)
Convert to Vite env vars with prod values as the environment source for production builds:
- `firebaseConfig.ts` reads `import.meta.env.VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, etc.
- `.env.production` → current prod values (safe: these are public client config, not secrets).
- `.env.staging` → staging web app values from Phase 1.5.
- Build selection: `vite build --mode staging` vs default production mode.
`vite.config.ts` already uses `loadEnv` — this extends an existing pattern, not a new one.

### 2.2 Populate `.firebaserc` (currently a 0-byte file)
```json
{
  "projects": {
    "default": "formula-fantasy-1",
    "prod": "formula-fantasy-1",
    "staging": "formula-fantasy-staging"
  }
}
```
Every deploy command from here on uses an explicit `--project staging` or `--project prod`. No ambient state.

### 2.3 Add `Dockerfile` + `nginx.conf` (new frontend deploy path)
Multi-stage: `node:22` build (`npm ci && npm run build -- --mode $BUILD_MODE`) → `nginx:alpine` serving `dist/` with SPA fallback (`try_files $uri /index.html`). This is how the MacBook deploys staging — and it becomes the prod deploy path later when AI Studio retires. Prod is untouched for now.

### 2.4 Commit `firestore.indexes.json` (from Phase 0.4)

### 2.5 Staging functions env file
Create `functions/.env.formula-fantasy-staging` (gitignored, local only) — Firebase CLI automatically loads per-project dotenv files on deploy. Holds staging `EMAIL_USER` / `EMAIL_PASS` (see Open Decisions: dedicated test Gmail recommended).

### 2.6 (Recommended) Staging visual marker
Env-driven `STAGING` ribbon/banner (e.g., `VITE_ENV_LABEL`) rendered in the app shell. Cheap insurance against "which environment am I in" mistakes — especially once both sites look identical on your phone.

**Exit criteria:** `npm run build` (prod mode) produces a byte-equivalent-behavior bundle pointing at prod; `npm run build -- --mode staging` points at staging. `git status` clean, pushed to `main` (these are inert infrastructure additions, safe on main).

---

## Phase 3 — Deploy Staging Backend (1 evening)

Order of operations mirrors the deployment law: functions → rules (no frontend dependency yet).

1. **Functions:**
   ```bash
   firebase deploy --only functions --project staging
   ```
   First deploy to a fresh project also provisions the underlying Cloud Run/Eventarc plumbing — expect it to be slower than prod deploys and possibly prompt to enable APIs (accept).
2. **Rules + indexes:**
   ```bash
   firebase deploy --only firestore --project staging
   ```
3. **Seed data** (synthetic only — no prod PII, ever):
   - `app_state/*` documents: form_locks, scoring config, and a copy of prod `race_results` (results are non-PII and give the leaderboard something real to compute).
   - 3–5 test invitation codes in `invitation_codes`.
   - One admin test user (create via the app in Phase 6, then flip `isAdmin: true` in console).
   - Optional: a small seed script (`scripts/seed-staging.mjs` using Admin SDK) so staging can be wiped and re-seeded in one command — pays for itself by the third reset.
4. **Verify:** `gcloud functions list --project formula-fantasy-staging` shows all 7; `firebase functions:log --project staging` clean.

**Exit criteria:** staging backend fully deployed, seeded, and log-clean, with zero writes to prod during the process.

---

## Phase 4 — Deploy Staging Frontend to Cloud Run (1 evening)

1. Build the staging image and deploy from the repo root:
   ```bash
   gcloud run deploy lights-out-league-staging \
     --source . --region us-west1 --project formula-fantasy-staging \
     --allow-unauthenticated
   ```
2. **Apply the parity spec** from `docs/prod-cloudrun-baseline.yaml`: same memory, request-based billing (CPU only during request processing), `--max-instances 2`, `--min-instances 0`.
3. Smoke the raw `*.run.app` URL: app loads, and — before any domain work — **confirm it talks to staging Firebase** (open the network tab: Firestore requests hit `formula-fantasy-staging`). This is the checkpoint that catches a mis-built config before anything else compounds on it.

**Exit criteria:** staging app live on its run.app URL, provably wired to staging Firebase only.

---

## Phase 5 — Domain: `f1.staging.carolinaminted.net` (1 evening + DNS/cert wait)

1. **Domain verification** in the staging project: Cloud Run domain mapping requires ownership verification of `carolinaminted.net` via Search Console under the same `jhh@` account — since that account already owns the domain, this is an add-verified-owner step, not a re-verification.
2. **Create the mapping:**
   ```bash
   gcloud beta run domain-mappings create \
     --service lights-out-league-staging \
     --domain f1.staging.carolinaminted.net \
     --region us-west1 --project formula-fantasy-staging
   ```
3. **DNS at Squarespace:** add CNAME `f1.staging` → `ghs.googlehosted.com` (same record shape as the existing `f1` mapping). Cert provisioning: typically 15 min, allow up to 24 h.
4. **Firebase Auth authorized domains** (staging project): add `f1.staging.carolinaminted.net` (and the run.app URL for pre-domain testing).
5. ⚠ **Reminder while in DNS/Workspace territory:** the September domain renewal risk item (recovery phone / non-domain secondary admin on `jhh@carolinaminted.net`) is still open. Same consoles, same evening — knock it out.

**Exit criteria:** `https://f1.staging.carolinaminted.net` serves the staging app with a valid cert.

---

## Phase 6 — Validation & Regression (the "live and functional" proof)

Run on `f1.staging.carolinaminted.net`, mobile-first (real phone, not just devtools):

**Auth & identity**
- [x] Invitation code (seeded) → signup → auth code email arrives → verify → account created
- [x] `users` + `public_users` docs created atomically in **staging** Firestore
- [x] Password reset email flow works
- [x] Bogus invitation code → clean error + toast, rate limit engages after repeated attempts

**Picks & locks**
- [x] Submit picks for a test event; quotas enforced (Class A 10/8, Class B 5/5)
- [x] `app_state/form_locks` manual override locks the form; schedule-derived lock behavior sane
- [x] Edit picks pre-lock; blocked post-lock

**Scoring & admin**
- [x] Admin enters race results → `updateLeaderboardOnResults` fires → leaderboard recalcs
- [x] Manual Sync completes; ranks match expected (compare a hand-calculated user against prod scoring for the same results)
- [x] Cancellation flow triggers `updateLeaderboardOnCancellation`
- [x] `scoringSnapshot` (points system + driver-team affiliations) embedded in saved results

**Isolation proof (non-negotiable)**
- [x] During all of the above, prod Firestore shows **zero** unexpected writes (spot-check via console usage graphs / recent doc timestamps)
- [x] Staging email uses its separately rotated staging app password; sender identity is intentionally shared with production by user decision

**Platform**
- [x] Mobile safe areas, PWA manifest, ErrorBoundary/"Safety Car" fallback, loading/empty/error states
- [x] Full-window staging Function log audit clean across all seven Functions

**Exit criteria:** every box checked = staging is declared functional. This checklist is also the template for future pre-prod regression passes.

---

## Phase 7 — Guardrails & the Working Loop

**Deploy safety**
- [x] `./deploy-staging.sh` → validates and builds with `--mode staging`, then deploys Functions and the frontend to immutable staging targets without a prompt. `--dry-run` performs the complete local gate without cloud writes, and all other arguments are rejected.
- [ ] `./deploy-prod.sh` → requires typing `PROD` to proceed, deploys with `--project prod`. **Explicitly deferred until staging is pristine.**
- 48-hour race-window freeze applies to **prod only**. Staging deploys are always allowed — that's the point of staging.

**Data policy**
- Synthetic users only in staging. Race results and app config may be copied from prod; anything under `users/` may not.

**The loop (post-setup):**
1. Claude Code on MacBook, feature branch, Firebase Emulator Suite for local test.
2. `./deploy-staging.sh` → regression pass (Phase 6 checklist, scoped to the change).
3. PR/merge to `main`.
4. Prod deploy: functions via terminal; frontend via current AI Studio path *for now*.

**Drift warning (carries over from the Node 22 discussion):** once Claude Code becomes the primary edit path, the AI Studio workspace becomes a second stale copy of the codebase. Any future AI Studio → GitHub push can silently revert repo changes. End state: retire AI Studio edits entirely and move prod frontend deploys to the same Dockerfile path staging uses. That migration is its own future plan — but every week both edit paths stay live, the revert risk compounds.

---

## Open Decisions (resolve during Phase 0/1)

| # | Decision | Recommendation |
|---|---|---|
| 1 | Staging Cloud Run in the staging Firebase project, or alongside prod's? | **Staging project.** One project = clean IAM, billing, and teardown. Also fixes the split-project awkwardness prod may have. |
| 2 | Email creds for staging functions | **Dedicated test Gmail app password.** Keeps prod sender reputation and rate limits out of test traffic. |
| 3 | Seed strategy | **Synthetic users + copied non-PII config/results.** Seed script preferred over manual console entry. |
| 4 | Sequencing vs. Node 22 migration (summer-break window closes ~Aug 18) | If staging backend (Phase 3) is live before the migration, **deploy Node 22 to staging functions first** — free canary. If staging slips, run the migration standalone as already planned; don't couple them. |
| 5 | Staging robots/discoverability | Add `X-Robots-Tag: noindex` via nginx config — staging shouldn't be indexed. Low effort, do it in 2.3. |

---

## Effort & Sequence Summary

| Phase | Effort | Dependency |
|---|---|---|
| 0 — Inventory | ½ evening | none (read-only, safe anytime — even race week) |
| 1 — Staging project | 1 evening | Phase 0 |
| 2 — Repo changes | 1–2 evenings | Phase 1 (needs staging config values) |
| 3 — Backend deploy + seed | 1 evening | Phases 1–2 |
| 4 — Frontend Cloud Run | 1 evening | Phases 2–3 |
| 5 — Domain | 1 evening + DNS wait | Phase 4 |
| 6 — Validation | 1–2 evenings | Phase 5 (partial on run.app URL after Phase 4) |
| 7 — Guardrails | folded into above | — |

**Total: roughly 6–8 focused evenings.** Phases 0–3 have zero prod exposure and no freeze constraints. Only rule: don't do Phase 2's repo commits *and* an unrelated prod deploy in the same sitting — one change class at a time, per house discipline.
