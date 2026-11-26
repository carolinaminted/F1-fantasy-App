# e2e — Lights Out League browser tests (staging only)

Never runs against production. Guards run at config load, so a production base URL or a
production project in the environment fails before Vite or a browser starts. Allowed hosts are
`127.0.0.1`, `localhost` and `f1.staging.carolinaminted.net`. Any request naming
`formula-fantasy-1` or `lights-out-league-prod` is aborted and fails the test. Read-only mode
(`test.use({ readOnly: true })`) aborts writes.

## One-time setup

```bash
npm --prefix e2e ci && npx --prefix e2e playwright install chromium
npm run e2e:check-live          # staging admin access + bot inbox, read-only
npm run e2e:provision           # dry run; then: npm run e2e:provision -- --apply
```

`.env.e2e` (gitignored, mode 600) holds `E2E_MAIL_USER`, `E2E_MAIL_APP_PASSWORD`, then
`E2E_ADMIN_*` / `E2E_MEMBER_*` written by provisioning. It may sit at the repo root. In a
worktree it is found in the main checkout via git-common-dir. `E2E_ENV_FILE` overrides both.
Google access impersonates `e2e-harness@formula-fantasy-staging` as `carolinaminted@gmail.com`.

## Running

```bash
npm run e2e:unit                                   # pure unit tests, no network
npm run e2e:journeys                               # local Vite (--mode staging) on :3100
E2E_BASE_URL=https://f1.staging.carolinaminted.net npm run e2e:journeys
E2E_REAL_MAIL=1 npm run e2e:journeys -- journeys/signup.spec.ts   # read the code from the bot inbox
npm run e2e:teardown                               # sweep throwaway accounts older than 1 hour
```

Artifacts land in `e2e-results/` (gitignored).

## Auth setup and throttling

The `setup` project signs in the admin and member once and saves sessions to `e2e/.auth/`
(gitignored). It reuses a saved session younger than 30 minutes after checking it is still
signed in. `E2E_FRESH_SIGNIN=1` forces a fresh sign-in.

Firebase throttles sign-ins per account (`TOO_MANY_ATTEMPTS_TRY_LATER`), and the app shows that
as "Invalid email or password". Keep repeated runs of the sign-in specs to a minimum. The
wrong-password test uses `NO_ACCOUNT_EMAIL`, a run-format address with no account. Never point
it at a real account.

## Console and request allowances

A test fails on any uncaught page error, console error or FORBIDDEN request unless it declares
the expectation:

- `expectError(re)` is strict: it fails if the pattern never matched.
- `expectBlocked(re)` does the same for FORBIDDEN requests.

One known app issue is allowed. On a non-admin page, a write to `app_state/race_results`
self-seeds and is denied, which throws "Missing or insufficient permissions."
(`App.tsx:552-559`). The allowance applies per page, only when that page sent the write. The
test is annotated `known-app-issue`. Remove it once the app is fixed (`e2e/lib/known-issues.ts`).

## Sign-up journey

Desktop only. It spends staging rate limit: 3 verification sends per 10 minutes per IP, so the
full suite needs about 200 s between runs. Teardown deletes the run's invite and
`email_verifications` doc even when no Auth user was created.

## Clock

`page.clock.setFixedTime` works with the Firestore listeners (see `spikes/frozen-clock.spec.ts`).

Plan: `e2e/PLAN.md`. Spec: the [E2E-00] tracker page.
