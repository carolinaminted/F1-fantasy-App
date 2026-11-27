# e2e — Lights Out League browser tests (staging only)

Never runs against production. Guards run at config load, so a production base URL or a
production project in the environment fails before Vite or a browser starts. Allowed hosts are
`127.0.0.1`, `localhost` and `f1.staging.carolinaminted.net`. Any request naming
`formula-fantasy-1`, `lights-out-league-prod`, `lights-out-league-web` or a production project
number, or the host `f1.carolinaminted.net`, is aborted and fails the test. Browser calls to
`identitytoolkit.googleapis.com` and `securetoken.googleapis.com` carry no project string, so they
are aborted unless their `key` is the staging web API key from `.env.staging` (keys are redacted in
reports). Config load also refuses a `.env.staging.local`, `.env.local` or `.env` that sets any
`VITE_` key, and any `VITE_*` variable in the shell, because either would override `.env.staging`
while the STAGING badge still rendered. Runs are read-only by default: Firestore writes and callables are aborted. A spec that writes
needs `test.use({ readOnly: false })`, the `@write` tag and `E2E_WRITES=1`. `page.request`,
`context.request` and `route.fetch` are closed because request routing cannot see them.

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

Artifacts land in `e2e-results/` (gitignored). Traces and reports there contain test passwords and
session tokens: do not share them.

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
the expectation. This covers every context, including the built-in page.

- `expectError(re)` is strict: it fails if the pattern never matched.
- `expectBlocked(re)` does the same for FORBIDDEN requests.

One known app issue is allowed. On a non-admin page, a write to `app_state/race_results`
self-seeds and is denied, which throws "Missing or insufficient permissions."
(`App.tsx:552-559`). The allowance applies per page, only when that page sent the write. The
test is annotated `known-app-issue`. The allowance is optional: it never fails a test, it only
annotates when it fires. Remove it once the app is fixed (`e2e/lib/known-issues.ts`).

## Sign-up journey

Desktop only, and only with E2E_WRITES=1. It spends staging rate limit: 3 verification sends per 10 minutes per IP, so run
at most 3 sign-up runs in any 10 minutes. Teardown deletes the run's invite and
`email_verifications` doc even when no Auth user was created.

## Clock

`page.clock.setFixedTime` works with the Firestore listeners (see `spikes/frozen-clock.spec.ts`).
Before moving the clock far ahead, store the latest fake time in `localStorage` under both
`SESSION_PIN_KEY` and `SESSION_STORAGE_KEY`, or the app's idle guard signs the session out (see
`spikes/lock-clock.spec.ts`).

Plans: e2e/PLAN.md, e2e/PLAN-2.md, e2e/PLAN-E2E-08.md. Specs: the [E2E-00] and [E2E-08] tracker pages.
