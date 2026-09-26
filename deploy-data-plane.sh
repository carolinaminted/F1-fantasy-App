#!/usr/bin/env bash
#
# Deploys the two Firestore scoring triggers to formula-fantasy-1 — the production data plane —
# and nothing else. Plan 3, Phase C: https://app.notion.com/p/3e30c2f763aa81a2938dc294cdf7d205
#
# Production. Every run needs explicit approval, on a weekday between race weekends, with no
# results being entered.

set -Eeuo pipefail

readonly PROD_FIREBASE_PROJECT="formula-fantasy-1"
readonly PROD_ACCOUNT="carolinaminted@gmail.com"
readonly FUNCTIONS_REGION="us-central1"
readonly FIREBASE_CLI_VERSION="15.28.1"
readonly RELEASE_BRANCH="prod"
readonly ROLLBACK_BRANCH="rollback/data-plane-node20"
# The triggers keep the default Compute identity. Moving them to a dedicated account is a
# separate, later change ([NODE-04]) so that this deploy changes the runtime and nothing else.
readonly EXPECTED_SERVICE_ACCOUNT="193463400309-compute@developer.gserviceaccount.com"
readonly TRIGGER_EVENT_TYPE="google.cloud.firestore.document.v1.written"
# firebase-tools loads functions/.env, .env.<project-id> and .env.<alias> (.firebaserc maps both
# `default` and `prod` here) into EVERY deployed function as plaintext. .env.formula-fantasy-1
# holds the mail credential; the triggers never send mail and must not carry it.
readonly FORBIDDEN_ENV_FILES=(functions/.env functions/.env.formula-fantasy-1
                              functions/.env.prod functions/.env.default)
readonly VERIFY_SCRIPT="../lol-docs/regression/verify.sh"

# The Firestore document each trigger must still watch after the deploy.
expected_document() {
  case "$1" in
    updateLeaderboardOnResults) echo "app_state/race_results" ;;
    updateLeaderboardOnCancellation) echo "app_state/cancelled_events" ;;
    *) return 1 ;;
  esac
}

usage() {
  cat <<'EOF'
Usage: ./deploy-data-plane.sh [--dry-run]

Deploys ONLY the two Firestore triggers to formula-fantasy-1 (production).

Runs from `prod` (Node 22, both release gates on the tip) or from
`rollback/data-plane-node20` (Node 20, exactly one commit on top of origin/prod
that changes only functions/package.json).

  --dry-run  Run every local and read-only check, then stop before changing anything.
EOF
}

fail() {
  echo "Data-plane deploy blocked: $*" >&2
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

for required_command in node npm npx gcloud git python3; do
  command -v "$required_command" >/dev/null 2>&1 || fail "required command is not installed: $required_command"
done

# --- Targets -------------------------------------------------------------------------------------

node -e '
  const config = JSON.parse(require("node:fs").readFileSync(".firebaserc", "utf8"));
  if (config.projects?.prod !== process.argv[1]) {
    console.error(`Data-plane deploy blocked: .firebaserc prod alias is "${config.projects?.prod ?? "missing"}".`);
    process.exit(1);
  }
' "$PROD_FIREBASE_PROJECT"

trigger_list="$(node functions/deploy-targets.js "$PROD_FIREBASE_PROJECT" --list)" \
  || fail "functions/deploy-targets.js has no target for $PROD_FIREBASE_PROJECT"
only_flag="$(node functions/deploy-targets.js "$PROD_FIREBASE_PROJECT" --only)"
TRIGGERS=()
while IFS= read -r fn; do [[ -n "$fn" ]] && TRIGGERS+=("$fn"); done <<<"$trigger_list"

# deploy-targets.js is tested, but this is the one place a wrong list reaches production, so the
# script refuses anything that is not exactly the two triggers it knows how to verify.
[[ ${#TRIGGERS[@]} -eq 2 ]] || fail "expected exactly 2 functions for $PROD_FIREBASE_PROJECT, got: ${TRIGGERS[*]}"
for fn in "${TRIGGERS[@]}"; do
  expected_document "$fn" >/dev/null || fail "'$fn' is not a known Firestore trigger"
done

# --- Source --------------------------------------------------------------------------------------

git fetch --quiet origin "$RELEASE_BRANCH" || fail "could not fetch origin/$RELEASE_BRANCH"
current_branch="$(git rev-parse --abbrev-ref HEAD)"
head_sha="$(git rev-parse HEAD)"
prod_sha="$(git rev-parse "origin/$RELEASE_BRANCH")"
engines_node="$(node -p 'require("./functions/package.json").engines?.node ?? ""')"

# firebase-tools uploads the functions/ directory as it is on disk, so anything uncommitted
# ships under a commit that does not describe it.
[[ -z "$(git status --porcelain)" ]] || fail "the working tree has uncommitted changes. Production deploys only committed code."

case "$current_branch" in
  "$RELEASE_BRANCH")
    [[ "$head_sha" == "$prod_sha" ]] || fail "local prod ($head_sha) is not origin/prod ($prod_sha). Pull or push first."
    [[ "$engines_node" == "22" ]] || fail "prod declares engines.node '$engines_node', expected 22"
    gated_sha="$head_sha"
    ;;
  "$ROLLBACK_BRANCH")
    # The rollback must be the code production runs, with only the runtime changed.
    [[ "$(git rev-parse HEAD^)" == "$prod_sha" ]] \
      || fail "$ROLLBACK_BRANCH must be exactly one commit on top of origin/prod. Rebase it onto origin/prod first."
    [[ "$(git diff --name-only HEAD^ HEAD)" == "functions/package.json" ]] \
      || fail "$ROLLBACK_BRANCH may change only functions/package.json relative to origin/prod"
    [[ "$engines_node" == "20" ]] || fail "$ROLLBACK_BRANCH declares engines.node '$engines_node', expected 20"
    gated_sha="$prod_sha"
    ;;
  *)
    fail "must run from '$RELEASE_BRANCH' or '$ROLLBACK_BRANCH', not '$current_branch'"
    ;;
esac
readonly expected_runtime="nodejs${engines_node}"

./scripts/release-gates.sh check "$gated_sha" local-verified staging-verified \
  || fail "${gated_sha:0:7} has not cleared the local and staging release gates"

for env_file in "${FORBIDDEN_ENV_FILES[@]}"; do
  [[ ! -e "$env_file" ]] || fail "$env_file exists. firebase-tools would inject it into the triggers as plaintext — move it outside the repo first."
done

# The triggers must keep the platform identity and bind no secrets. Both modules resolve from
# the deploy project exactly as firebase-tools discovery will.
runtime_sa="$(env -u DEBUG GCLOUD_PROJECT="$PROD_FIREBASE_PROJECT" node -p \
  'require("./functions/runtime-service-account").resolveRuntimeServiceAccount() ?? ""')"
[[ -z "$runtime_sa" ]] || fail "runtime-service-account.js now assigns $runtime_sa to $PROD_FIREBASE_PROJECT; that is a separate change ([NODE-04])"
email_secrets="$(env -u DEBUG GCLOUD_PROJECT="$PROD_FIREBASE_PROJECT" node -p \
  'JSON.stringify(require("./functions/email-secrets").resolveEmailSecretNames())')"
[[ "$email_secrets" == "null" ]] || fail "email-secrets.js now declares secrets for $PROD_FIREBASE_PROJECT"

[[ -x "$VERIFY_SCRIPT" ]] || fail "$VERIFY_SCRIPT is missing; the standings regression check is required"

echo "Data-plane deployment targets locked:"
echo "  Firebase project: $PROD_FIREBASE_PROJECT (account $PROD_ACCOUNT)"
echo "  Functions:        ${TRIGGERS[*]}"
echo "  Runtime:          $expected_runtime"
echo "  Source:           $current_branch @ ${head_sha:0:7}"
echo

echo "Running functions tests..."
(cd functions && npm test --silent >/dev/null) || fail "functions tests failed (cd functions && npm test)"
echo "  passed"

# --- Live state before -----------------------------------------------------------------------------

# Prints one line per function: name state runtime serviceAccount revision updateTime.
describe_triggers() {
  local fn
  for fn in "${TRIGGERS[@]}"; do
    env -u DEBUG gcloud functions describe "$fn" \
      --project "$PROD_FIREBASE_PROJECT" --region "$FUNCTIONS_REGION" --account "$PROD_ACCOUNT" \
      --format='value[separator=" "](name.basename(),state,buildConfig.runtime,serviceConfig.serviceAccountEmail,serviceConfig.revision,updateTime)' \
      || fail "could not describe $fn"
  done
}

echo
echo "Live triggers before the deploy:"
describe_triggers | sed 's/^/  /'

if [[ "$dry_run" == true ]]; then
  echo
  echo "Dry run passed. No cloud resources were changed."
  exit 0
fi

echo
echo "This deploys to PRODUCTION ($PROD_FIREBASE_PROJECT). Type the project ID to continue:"
read -r confirmation </dev/tty
[[ "$confirmation" == "$PROD_FIREBASE_PROJECT" ]] || fail "confirmation did not match; nothing was changed"

echo
echo "Capturing the standings baseline (read-only)..."
LOL_ENV=prod "$VERIFY_SCRIPT" baseline

# --- Deploy ----------------------------------------------------------------------------------------

echo
echo "Deploying $only_flag ..."
deploy_started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# --only names the two triggers, so firebase-tools leaves the five dormant callables alone.
# Deleting them is Phase D, a separate approved step.
env -u DEBUG npx --yes "firebase-tools@$FIREBASE_CLI_VERSION" deploy \
  --only "$only_flag" \
  --project "$PROD_FIREBASE_PROJECT" \
  --account "$PROD_ACCOUNT" \
  --non-interactive

# --- Verify ----------------------------------------------------------------------------------------

# firebase-tools can exit 0 while a function keeps serving its previous build (see CLAUDE.md), so
# every property this deploy was meant to change — or not change — is read back.
echo
echo "Verifying the triggers..."
for fn in "${TRIGGERS[@]}"; do
  env -u DEBUG gcloud functions describe "$fn" \
    --project "$PROD_FIREBASE_PROJECT" --region "$FUNCTIONS_REGION" --account "$PROD_ACCOUNT" \
    --format=json \
  | python3 -c '
import json, sys

fn, runtime, sa, event_type, document, started = sys.argv[1:7]
f = json.load(sys.stdin)
sc = f.get("serviceConfig", {})
state = f.get("state")
actual_runtime = f.get("buildConfig", {}).get("runtime")
updated = f.get("updateTime", "")
actual_sa = sc.get("serviceAccountEmail")
trigger = f.get("eventTrigger") or {}
actual_event = trigger.get("eventType")
filters = trigger.get("eventFilters", [])
watched = {x.get("attribute"): x.get("value") for x in filters}.get("document")
pattern = any(x.get("operator") for x in filters)
leaked = sorted(k for k in (sc.get("environmentVariables") or {}) if k.startswith("EMAIL_"))
secrets = sc.get("secretEnvironmentVariables") or []

problems = []
if state != "ACTIVE":
    problems.append("state is %s, expected ACTIVE" % state)
if actual_runtime != runtime:
    problems.append("runtime is %s, expected %s" % (actual_runtime, runtime))
if not sc.get("revision"):
    problems.append("no serviceConfig.revision: its GCF record is broken and the next deploy would skip it")
if updated < started:
    problems.append("last updated %s, before this deploy started: it did not update" % updated)
if actual_sa != sa:
    problems.append("runs as %s, expected %s" % (actual_sa, sa))
if actual_event != event_type:
    problems.append("event type is %s, expected %s" % (actual_event, event_type))
if watched != document or pattern:
    problems.append("watches %r, expected the literal path %r" % (watched, document))
if leaked or secrets:
    problems.append("carries mail credentials: %s" % (leaked or secrets))

if problems:
    for p in problems:
        print("  %s: %s" % (fn, p), file=sys.stderr)
    sys.exit(1)
print("  %s: ACTIVE %s, watches %s, runs as the default identity, no mail credentials" % (fn, runtime, document))
' "$fn" "$expected_runtime" "$EXPECTED_SERVICE_ACCOUNT" "$TRIGGER_EVENT_TYPE" \
    "$(expected_document "$fn")" "$deploy_started" \
  || fail "$fn failed verification (see above). Recovery: run Manual Sync from the admin portal, then consider the rollback."
done

failed_builds="$(env -u DEBUG gcloud builds list \
  --project "$PROD_FIREBASE_PROJECT" --account "$PROD_ACCOUNT" --region "$FUNCTIONS_REGION" \
  --filter="status=FAILURE AND createTime>=\"$deploy_started\"" \
  --format='value(id)' 2>/dev/null || true)"
[[ -z "$failed_builds" ]] || fail "a function build FAILED during this deploy: $failed_builds"
echo "  no function build failed in this window"

# The five dormant callables must be exactly as they were: Phase D deletes them after a fresh
# log check, and a deploy that touched them would have re-uploaded the mail credential.
touched="$(env -u DEBUG gcloud functions list \
  --project "$PROD_FIREBASE_PROJECT" --account "$PROD_ACCOUNT" \
  --filter="updateTime>=\"$deploy_started\"" --format='value(name.basename())' 2>/dev/null || true)"
unexpected="$(printf '%s\n' "$touched" | grep -vxF -e "${TRIGGERS[0]}" -e "${TRIGGERS[1]}" | grep . || true)"
[[ -z "$unexpected" ]] || fail "functions outside the trigger list changed during this deploy: $unexpected"
echo "  no other function in $PROD_FIREBASE_PROJECT changed"

cat <<EOF

Data-plane deploy complete: ${TRIGGERS[*]} on $expected_runtime from ${head_sha:0:7}.

Not done yet. Finish the runbook by hand:
  1. Fire the results trigger on purpose: as admin, edit and then revert one harmless field
     on an empty placeholder entry (such as abu_26) in race_results. Do NOT touch cancellations.
  2. Check the standings did not move (expect zero drift across all rows):
       LOL_ENV=prod $VERIFY_SCRIPT check
  3. Watch the trigger logs for 15 minutes:
       LOL_ENV=prod $VERIFY_SCRIPT triggers $deploy_started

If the standings drift or a trigger errors: run Manual Sync from the admin portal first, then
roll the runtime back from $ROLLBACK_BRANCH with this same script.
EOF
