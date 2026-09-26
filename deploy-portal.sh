#!/usr/bin/env bash
#
# Deploys the five member-facing callables to lights-out-league-prod, the production portal that
# serves formula-fantasy-1's data. Plan 3, Phase B: https://app.notion.com/p/3e30c2f763aa81a2938dc294cdf7d205
#
# Production. Every run needs explicit approval, on a weekday between race weekends.
#
# Why gcloud and not `firebase deploy`: Firebase is not enabled on lights-out-league-prod, and the
# portal functions were created with `gcloud functions deploy` (label deployment-tool=cli-gcloud).
# The known trap with that command is that it uploads the CURRENT DIRECTORY as the source
# (CLAUDE.md, 2026-08-26). This script never lets it: the source is a `git archive` of functions/
# at the deployed commit, extracted to a temp directory, so untracked env files cannot ship.

set -Eeuo pipefail

readonly PORTAL_PROJECT="lights-out-league-prod"
readonly PORTAL_ACCOUNT="jhh@carolinaminted.net"
readonly FUNCTIONS_REGION="us-central1"
readonly RUNTIME="nodejs22"
readonly RELEASE_BRANCH="prod"
readonly RUNTIME_SERVICE_ACCOUNT="lol-functions-runtime@lights-out-league-prod.iam.gserviceaccount.com"
readonly BUILD_SERVICE_ACCOUNT="projects/lights-out-league-prod/serviceAccounts/lol-build@lights-out-league-prod.iam.gserviceaccount.com"
readonly CALLABLE_BASE="https://us-central1-lights-out-league-prod.cloudfunctions.net"
# The portal holds no league data. These two values are what point it at formula-fantasy-1; they
# are set on every deploy, never inherited, so a redeploy cannot fall back to the portal's own
# empty Firestore (Plan 3 hazard 2).
readonly DATA_APP_ENV="production"
readonly DATA_PROJECT="formula-fantasy-1"
# Bound under the names the code's fallback reads (functions/index.js reads EMAIL_USER/EMAIL_PASS
# when email-secrets.js resolves nothing, which is the case here: gcloud sets no GCLOUD_PROJECT).
# `latest` means a rotation takes effect on the next run of this script.
readonly EMAIL_USER_SECRET="lol-prod-email-user"
readonly EMAIL_PASS_SECRET="lol-prod-email-pass"
readonly VERIFY_SCRIPT="../lol-docs/regression/verify.sh"
# Lowest member impact first: Manual Sync is admin-only, so if a deploy breaks public access it
# breaks there and the script stops before any sign-in path is touched.
readonly DEPLOY_ORDER=(manualLeaderboardSync validateInvitationCode verifyAuthCode
                       sendPasswordResetLink sendAuthCode)

is_email_function() {
  [[ "$1" == "sendAuthCode" || "$1" == "sendPasswordResetLink" ]]
}

memory_for() {
  if is_email_function "$1"; then echo "512Mi"; else echo "256Mi"; fi
}

# What an anonymous POST of {"data":{}} must return. Each is a guard rejecting the call inside the
# function, so a match proves the request reached the code. A 403 means Cloud Run refused it
# before the code ran: public access is gone.
expected_probe_code() {
  case "$1" in
    manualLeaderboardSync) echo 401 ;;
    verifyAuthCode) echo 200 ;;
    *) echo 400 ;;
  esac
}

# Cloud Run service name backing a Gen 2 function. macOS bash 3.2 has no ${x,,}.
run_service_name() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

usage() {
  cat <<'EOF'
Usage: ./deploy-portal.sh [--dry-run]

Deploys the five callables to lights-out-league-prod (production), one at a time,
verifying each before starting the next.

Runs from `prod` at origin/prod with the local and staging release gates signed.
To roll back, check out an earlier gated commit on origin/prod (detached HEAD) and
run it from there.

  --dry-run  Run every local and read-only check, including a check that the live
             portal already matches this script's configuration, then stop.
EOF
}

fail() {
  echo "Portal deploy blocked: $*" >&2
  exit 1
}

dry_run=false
case "${1:-}" in
  "") ;;
  --dry-run) dry_run=true ;;
  -h|--help) usage; exit 0 ;;
  *) usage >&2; fail "unsupported argument '$1'. Deployment targets cannot be overridden." ;;
esac
[[ $# -le 1 ]] || fail "only --dry-run is supported. Deployment targets cannot be overridden."

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

for required_command in node npm gcloud git python3 curl tar; do
  command -v "$required_command" >/dev/null 2>&1 || fail "required command is not installed: $required_command"
done

# --- Targets -------------------------------------------------------------------------------------

declared="$(node functions/deploy-targets.js "$PORTAL_PROJECT" --list | sort)" \
  || fail "functions/deploy-targets.js has no target for $PORTAL_PROJECT"
ordered="$(printf '%s\n' "${DEPLOY_ORDER[@]}" | sort)"
[[ "$declared" == "$ordered" ]] \
  || fail "deploy-targets.js lists [$(echo $declared)] for $PORTAL_PROJECT, but this script deploys [$(echo $ordered)]"

# --- Source --------------------------------------------------------------------------------------

git fetch --quiet origin "$RELEASE_BRANCH" || fail "could not fetch origin/$RELEASE_BRANCH"
current_branch="$(git rev-parse --abbrev-ref HEAD)"
head_sha="$(git rev-parse HEAD)"
prod_sha="$(git rev-parse "origin/$RELEASE_BRANCH")"
rollback=false

[[ -z "$(git status --porcelain)" ]] || fail "the working tree has uncommitted changes. Production deploys only committed code."

if [[ "$current_branch" == "$RELEASE_BRANCH" ]]; then
  [[ "$head_sha" == "$prod_sha" ]] || fail "local prod ($head_sha) is not origin/prod ($prod_sha). Pull or push first."
elif [[ "$current_branch" == "HEAD" ]] && [[ "$head_sha" != "$prod_sha" ]] \
     && git merge-base --is-ancestor "$head_sha" "$prod_sha"; then
  rollback=true
else
  fail "must run from '$RELEASE_BRANCH', or from a detached earlier commit of origin/prod to roll back (on '$current_branch')"
fi

./scripts/release-gates.sh check "$head_sha" local-verified staging-verified \
  || fail "${head_sha:0:7} has not cleared the local and staging release gates"

[[ "$(node -p 'require("./functions/package.json").engines?.node ?? ""')" == "22" ]] \
  || fail "functions/package.json must declare engines.node 22 for $RUNTIME"

# The functions will run with exactly these variables and no GCLOUD_PROJECT (gcloud does not set
# one). Resolve both modules in that environment now, so a code change that would point the portal
# elsewhere or switch it to secret names this script does not bind fails here, not in production.
env -i PATH="$PATH" APP_ENV="$DATA_APP_ENV" FIREBASE_PROJECT_ID="$DATA_PROJECT" node -e '
  const target = require("./functions/runtime-target").resolveRuntimeTarget();
  if (target?.firebaseProjectId !== process.argv[1]) {
    console.error(`Portal deploy blocked: the portal environment resolves to ${JSON.stringify(target)}, not ${process.argv[1]}.`);
    process.exit(1);
  }
  if (require("./functions/email-secrets").resolveEmailSecretNames() !== null) {
    console.error("Portal deploy blocked: email-secrets.js resolves secret names in the portal environment; this script binds EMAIL_USER/EMAIL_PASS.");
    process.exit(1);
  }
' "$DATA_PROJECT"

[[ -x "$VERIFY_SCRIPT" ]] || fail "$VERIFY_SCRIPT is missing; the post-deploy standings check is required"

source_dir="$(mktemp -d)"
trap 'rm -rf "$source_dir"' EXIT
git archive --format=tar "$head_sha" functions | tar -x -C "$source_dir"
readonly source_path="$source_dir/functions"
[[ -f "$source_path/index.js" && -f "$source_path/package-lock.json" ]] \
  || fail "the archived functions/ source is incomplete"
leaked_env="$(find "$source_path" -name '.env*' -print)"
[[ -z "$leaked_env" ]] || fail "the archived source contains env files: $leaked_env"
source_kb="$(du -sk "$source_path" | cut -f1)"
# The repo-root upload of 2026-08-26 was 414 KB; the functions source is ~60 KB.
(( source_kb < 400 )) || fail "the archived source is ${source_kb} KB, which looks like more than functions/"

echo "Portal deployment targets locked:"
echo "  Project:   $PORTAL_PROJECT (account $PORTAL_ACCOUNT, region $FUNCTIONS_REGION)"
echo "  Functions: ${DEPLOY_ORDER[*]} (in this order)"
echo "  Data:      APP_ENV=$DATA_APP_ENV FIREBASE_PROJECT_ID=$DATA_PROJECT"
echo "  Source:    git archive of functions/ at ${head_sha:0:7} (${source_kb} KB)"
if [[ "$rollback" == true ]]; then
  echo
  echo "  ROLLBACK: deploying ${head_sha:0:7}, an earlier commit than origin/prod (${prod_sha:0:7})."
fi
echo

echo "Running functions tests..."
(cd functions && npm test --silent >/dev/null) || fail "functions tests failed (cd functions && npm test)"
echo "  passed"

env -u DEBUG gcloud iam service-accounts describe "$RUNTIME_SERVICE_ACCOUNT" \
  --project "$PORTAL_PROJECT" --account "$PORTAL_ACCOUNT" --format='value(email)' >/dev/null 2>&1 \
  || fail "runtime service account not found: $RUNTIME_SERVICE_ACCOUNT"
for secret in "$EMAIL_USER_SECRET" "$EMAIL_PASS_SECRET"; do
  env -u DEBUG gcloud secrets versions describe latest --secret "$secret" \
    --project "$PORTAL_PROJECT" --account "$PORTAL_ACCOUNT" --format='value(state)' 2>/dev/null \
    | grep -qx ENABLED || fail "secret $secret has no ENABLED latest version in $PORTAL_PROJECT"
done
echo "  runtime service account and both email secrets exist"

# --- Verification ----------------------------------------------------------------------------------

# Checks one live function against everything this script sets. With a start time, also requires
# the function to have been updated since then. Prints problems and returns non-zero on any.
verify_function() {
  local fn="$1" started="${2:-}" svc
  svc="$(run_service_name "$fn")"
  {
    env -u DEBUG gcloud functions describe "$fn" \
      --project "$PORTAL_PROJECT" --region "$FUNCTIONS_REGION" --account "$PORTAL_ACCOUNT" --format=json
    echo "@@RUN@@"
    env -u DEBUG gcloud run services describe "$svc" \
      --project "$PORTAL_PROJECT" --region "$FUNCTIONS_REGION" --account "$PORTAL_ACCOUNT" --format=json
  } | python3 -c '
import json, sys

(fn, started, runtime, sa, app_env, data_project, memory, email_fn,
 user_secret, pass_secret) = sys.argv[1:11]
gcf_raw, run_raw = sys.stdin.read().split("@@RUN@@")
f, run = json.loads(gcf_raw), json.loads(run_raw)
sc = f.get("serviceConfig", {})
problems = []

def expect(label, actual, wanted):
    if actual != wanted:
        problems.append("%s is %r, expected %r" % (label, actual, wanted))

expect("state", f.get("state"), "ACTIVE")
expect("runtime", f.get("buildConfig", {}).get("runtime"), runtime)
expect("entry point", f.get("buildConfig", {}).get("entryPoint"), fn)
expect("service account", sc.get("serviceAccountEmail"), sa)
expect("memory", sc.get("availableMemory"), memory)
expect("timeout", sc.get("timeoutSeconds"), 60)
expect("max instances", sc.get("maxInstanceCount"), 2)
expect("concurrency", sc.get("maxInstanceRequestConcurrency"), 80)
expect("ingress", sc.get("ingressSettings"), "ALLOW_ALL")
if not sc.get("revision"):
    problems.append("no serviceConfig.revision: its GCF record is broken")
if started and f.get("updateTime", "") < started:
    problems.append("last updated %s, before this deploy started: it did not update" % f.get("updateTime"))

env = {k: v for k, v in (sc.get("environmentVariables") or {}).items() if k != "LOG_EXECUTION_ID"}
expect("environment", env, {"APP_ENV": app_env, "FIREBASE_PROJECT_ID": data_project})

secrets = {s.get("key"): s.get("secret") for s in sc.get("secretEnvironmentVariables") or []}
wanted = {"EMAIL_USER": user_secret, "EMAIL_PASS": pass_secret} if email_fn == "yes" else {}
expect("secret bindings", secrets, wanted)

# Domain Restricted Sharing forbids allUsers, so public access rests on this one setting.
annotations = run.get("metadata", {}).get("annotations", {})
expect("invoker-iam-disabled", annotations.get("run.googleapis.com/invoker-iam-disabled"), "true")

if problems:
    for p in problems:
        print("  %s: %s" % (fn, p), file=sys.stderr)
    sys.exit(1)
print("  %s: config matches" % fn)
' "$fn" "$started" "$RUNTIME" "$RUNTIME_SERVICE_ACCOUNT" "$DATA_APP_ENV" "$DATA_PROJECT" \
    "$(memory_for "$fn")" "$(is_email_function "$fn" && echo yes || echo no)" \
    "$EMAIL_USER_SECRET" "$EMAIL_PASS_SECRET"
}

# Anonymous call with empty input. Every callable rejects it before doing any work (no email is
# sent, nothing is written), so this is safe against production.
probe_function() {
  local fn="$1" code wanted
  wanted="$(expected_probe_code "$fn")"
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 30 -X POST "$CALLABLE_BASE/$fn" \
    -H 'Content-Type: application/json' -d '{"data":{}}' || true)"
  if [[ "$code" != "$wanted" ]]; then
    echo "  $fn: anonymous probe returned HTTP $code, expected $wanted" >&2
    [[ "$code" == "403" ]] && echo "  $fn: 403 means Cloud Run refused the call: public access (invoker-iam-disabled) is gone" >&2
    return 1
  fi
  echo "  $fn: anonymous probe HTTP $code, as expected"
}

echo
echo "Checking the live portal against this script's configuration..."
live_ok=true
for fn in "${DEPLOY_ORDER[@]}"; do
  verify_function "$fn" || live_ok=false
  probe_function "$fn" || live_ok=false
done
if [[ "$live_ok" != true ]]; then
  echo >&2
  echo "The live portal differs from what this script would deploy (see above). A deploy would change" >&2
  echo "those settings. Resolve that before a real run; it is not safe to discover it mid-deploy." >&2
  [[ "$dry_run" == true ]] && exit 1
  fail "live configuration drift"
fi

if [[ "$dry_run" == true ]]; then
  echo
  echo "Dry run passed. No cloud resources were changed."
  exit 0
fi

echo
echo "This deploys to PRODUCTION ($PORTAL_PROJECT). Type the project ID to continue:"
read -r confirmation </dev/tty
[[ "$confirmation" == "$PORTAL_PROJECT" ]] || fail "confirmation did not match; nothing was changed"

echo
echo "Capturing the standings baseline (read-only)..."
LOL_ENV=prod "$VERIFY_SCRIPT" baseline

# --- Deploy, one function at a time ----------------------------------------------------------------

deployed=()
stop_after() {
  echo >&2
  echo "Portal deploy stopped at $1." >&2
  if [[ ${#deployed[@]} -gt 0 ]]; then
    echo "  Already updated to ${head_sha:0:7}: ${deployed[*]}" >&2
  fi
  echo "  Not touched: the functions after $1 in: ${DEPLOY_ORDER[*]}" >&2
  echo "  Recovery: check out the previous gated prod commit (detached) and rerun this script." >&2
  exit 1
}

for fn in "${DEPLOY_ORDER[@]}"; do
  echo
  echo "Deploying $fn..."
  started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  secret_flags=(--clear-secrets)
  if is_email_function "$fn"; then
    secret_flags=(--set-secrets "EMAIL_USER=${EMAIL_USER_SECRET}:latest,EMAIL_PASS=${EMAIL_PASS_SECRET}:latest")
  fi

  # Neither --allow-unauthenticated nor --no-allow-unauthenticated: both write the invoker IAM
  # policy, which Domain Restricted Sharing forbids opening. Public access comes from the Cloud Run
  # invoker-iam-disabled setting, verified after every function below.
  env -u DEBUG gcloud functions deploy "$fn" \
    --gen2 \
    --project "$PORTAL_PROJECT" \
    --account "$PORTAL_ACCOUNT" \
    --region "$FUNCTIONS_REGION" \
    --runtime "$RUNTIME" \
    --source "$source_path" \
    --entry-point "$fn" \
    --trigger-http \
    --service-account "$RUNTIME_SERVICE_ACCOUNT" \
    --build-service-account "$BUILD_SERVICE_ACCOUNT" \
    --memory "$(memory_for "$fn")" \
    --cpu 1 \
    --timeout 60s \
    --min-instances 0 \
    --max-instances 2 \
    --concurrency 80 \
    --ingress-settings all \
    --set-env-vars "APP_ENV=${DATA_APP_ENV},FIREBASE_PROJECT_ID=${DATA_PROJECT}" \
    "${secret_flags[@]}" \
    --quiet \
    || stop_after "$fn (gcloud reported a failure)"

  verify_function "$fn" "$started" || stop_after "$fn (configuration check failed)"
  probe_function "$fn" || stop_after "$fn (anonymous probe failed)"
  deployed+=("$fn")
done

cat <<EOF

Portal deploy complete: ${DEPLOY_ORDER[*]} on $RUNTIME from ${head_sha:0:7}.

Not done yet. Finish by hand:
  1. As admin, run Manual Sync from the live app.
  2. Check the standings did not move:
       LOL_ENV=prod $VERIFY_SCRIPT check
  3. Sign in on a second device to exercise sendAuthCode and verifyAuthCode end to end.
EOF
