#!/usr/bin/env bash

set -Eeuo pipefail

readonly STAGING_FIREBASE_PROJECT="formula-fantasy-staging"
readonly STAGING_FIREBASE_ALIAS="staging"
readonly STAGING_RUN_SERVICE="lights-out-league-staging"
readonly STAGING_RUN_REGION="us-west1"
# The branch staging is expected to deploy from. Advisory only — deploying a feature branch
# to staging before merging it is a legitimate workflow, it just should not happen by accident.
readonly STAGING_BRANCH="staging"
readonly FIREBASE_CLI_VERSION="15.28.1"
readonly STAGING_GCLOUD_ACCOUNT="carolinaminted@gmail.com"
readonly STAGING_REGISTRY_PATH="us-west1-docker.pkg.dev/formula-fantasy-staging/cloud-run-source-deploy/lights-out-league-staging"
readonly STAGING_BUILD_SA="projects/formula-fantasy-staging/serviceAccounts/342911349882-compute@developer.gserviceaccount.com"
readonly STAGING_FUNCTIONS_REGION="us-central1"
# Every function this project deploys. Gen 2 functions are Cloud Run services underneath, and
# that service is named with the function name lowercased — hence `run_service_name` below.
readonly STAGING_FUNCTIONS=(manualLeaderboardSync sendAuthCode sendPasswordResetLink
                            updateLeaderboardOnCancellation updateLeaderboardOnResults
                            validateInvitationCode verifyAuthCode)
# Only these two functions read email credentials. They are re-bound after every
# functions deploy, because `firebase deploy` clears secret bindings it did not set.
readonly STAGING_EMAIL_FUNCTIONS=(sendauthcode sendpasswordresetlink)
readonly STAGING_EMAIL_USER_SECRET="lol-staging-email-user"
readonly STAGING_EMAIL_PASS_SECRET="lol-staging-email-pass"

# Gen 2 function -> its backing Cloud Run service name. `${x,,}` would be shorter but needs
# bash 4; macOS still ships 3.2, so this stays portable.
run_service_name() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

usage() {
  cat <<'EOF'
Usage: ./deploy-staging.sh [--dry-run]

Deploys the Lights Out League frontend and Functions to staging only.

  --dry-run  Run local validation and print the locked deployment targets
             without changing Firebase or Google Cloud resources.
EOF
}

fail() {
  echo "Staging deploy blocked: $*" >&2
  exit 1
}

dry_run=false

case "${1:-}" in
  "") ;;
  --dry-run) dry_run=true ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    fail "unsupported argument '$1'. Deployment targets cannot be overridden."
    ;;
esac

[[ $# -le 1 ]] || fail "only --dry-run is supported. Deployment targets cannot be overridden."

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

for required_file in package.json package-lock.json firebase.json .firebaserc Dockerfile \
                     functions/package.json firestore.rules firestore.indexes.json; do
  [[ -f "$required_file" ]] || fail "required repository file is missing: $required_file"
done

for required_command in node npm npx gcloud curl python3; do
  command -v "$required_command" >/dev/null 2>&1 || fail "required command is not installed: $required_command"
done

node -e '
  const fs = require("node:fs");
  const config = JSON.parse(fs.readFileSync(".firebaserc", "utf8"));
  const expected = process.argv[1];
  const actual = config.projects?.staging;
  if (actual !== expected) {
    console.error(`Staging deploy blocked: .firebaserc staging alias is "${actual ?? "missing"}", expected "${expected}".`);
    process.exit(1);
  }
' "$STAGING_FIREBASE_PROJECT"

[[ "$STAGING_FIREBASE_PROJECT" == "formula-fantasy-staging" ]] || fail "unexpected Firebase project target"
[[ "$STAGING_RUN_SERVICE" == "lights-out-league-staging" ]] || fail "unexpected Cloud Run service target"
[[ "$STAGING_FIREBASE_PROJECT" != *"formula-fantasy-1"* ]] || fail "production Firebase target detected"

current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")"
working_tree="$(git status --porcelain 2>/dev/null || true)"

echo "Staging deployment targets locked:"
echo "  Firebase project: $STAGING_FIREBASE_PROJECT (alias: $STAGING_FIREBASE_ALIAS)"
echo "  Cloud Run service: $STAGING_RUN_SERVICE"
echo "  Cloud Run region:  $STAGING_RUN_REGION"
echo "  Git branch:        $current_branch"

# Both checks below are advisory. The hard failures in this script guard *targets* — the wrong
# project, the wrong service, a leaked credential. Branch and tree state are hygiene, and
# blocking on them would break the deploy-a-feature-branch-first workflow.
if [[ "$current_branch" != "$STAGING_BRANCH" ]]; then
  echo
  echo "  NOTE: deploying from '$current_branch', not '$STAGING_BRANCH'."
  echo "        Fine for trying a feature branch in staging; check it was deliberate."
fi

# `gcloud builds submit` uploads the working directory, but the image is tagged from HEAD's
# SHA. Uncommitted changes therefore ship inside an image whose tag does not describe them,
# which silently breaks the digest-to-commit trail the deploy verification depends on.
if [[ -n "$working_tree" ]]; then
  echo
  echo "  WARNING: the working tree has uncommitted changes."
  echo "           They WILL be included in the build, but the image is tagged with HEAD's"
  echo "           SHA, so the tag will not describe what actually shipped. Commit first"
  echo "           unless you are deliberately testing something unversioned."
  echo "$working_tree" | sed 's/^/             /'
fi
echo
echo "Running local validation..."

npm run lint
npm run build -- --mode staging

if [[ "$dry_run" == true ]]; then
  echo
  echo "Dry run passed. No cloud resources were changed."
  exit 0
fi

# Writes the Firestore ruleset that formula-fantasy-staging is currently serving to $1.
#
# The `x-goog-user-project` header is required. Without it the Rules API rejects the call
# against gcloud's shared ADC quota project and returns 403 SERVICE_DISABLED, which reads like
# a permission problem but is not one.
fetch_live_rules() {
  local out_file="$1"
  local token releases ruleset_name

  token="$(env -u DEBUG gcloud auth print-access-token \
    --account "$STAGING_GCLOUD_ACCOUNT" 2>/dev/null || true)"
  [[ -n "$token" ]] || fail "could not obtain an access token for $STAGING_GCLOUD_ACCOUNT"

  releases="$(curl -sS \
    -H "Authorization: Bearer $token" \
    -H "x-goog-user-project: $STAGING_FIREBASE_PROJECT" \
    "https://firebaserules.googleapis.com/v1/projects/${STAGING_FIREBASE_PROJECT}/releases")"

  ruleset_name="$(printf '%s' "$releases" | python3 -c '
import json, sys

try:
    data = json.load(sys.stdin)
except ValueError:
    sys.exit(1)
if "error" in data:
    print(data["error"].get("message", "unknown Firebase Rules API error"), file=sys.stderr)
    sys.exit(1)
for release in data.get("releases", []):
    if release.get("name", "").endswith("/cloud.firestore"):
        print(release.get("rulesetName", ""))
        break
' || true)"
  [[ -n "$ruleset_name" ]] || fail "could not resolve the live Firestore ruleset for $STAGING_FIREBASE_PROJECT"

  curl -sS \
    -H "Authorization: Bearer $token" \
    -H "x-goog-user-project: $STAGING_FIREBASE_PROJECT" \
    "https://firebaserules.googleapis.com/v1/${ruleset_name}" \
    | python3 -c '
import json, sys

data = json.load(sys.stdin)
files = data.get("source", {}).get("files", [])
if not files:
    sys.exit(1)
sys.stdout.write(files[0]["content"])
' > "$out_file" || fail "could not fetch the source of ruleset $ruleset_name"

  [[ -s "$out_file" ]] || fail "the live Firestore ruleset came back empty"
}

rules_workdir="$(mktemp -d)"
trap 'rm -rf "$rules_workdir"' EXIT

echo
echo "Checking the live Firestore ruleset..."
fetch_live_rules "$rules_workdir/live-before.rules"

if diff -u "$rules_workdir/live-before.rules" firestore.rules >/dev/null 2>&1; then
  echo "  live ruleset already matches firestore.rules"
else
  echo
  echo "  WARNING: the live staging ruleset differs from firestore.rules."
  echo "           A rules deploy REPLACES the whole ruleset — there is no additive mode — so"
  echo "           whatever is shown below is about to be reverted to the committed version."
  echo "           ('-' is live in $STAGING_FIREBASE_PROJECT, '+' is what will be deployed.)"
  diff -u "$rules_workdir/live-before.rules" firestore.rules | sed 's/^/             /' || true
fi

echo
echo "Deploying staging Firestore rules and indexes..."
# No --force, deliberately. Under --non-interactive firebase-tools only *warns* about indexes
# present in the project but absent from firestore.indexes.json; --force is precisely what turns
# that warning into a deletion. This step must never be able to drop an index someone else made.
env -u DEBUG npx --yes "firebase-tools@$FIREBASE_CLI_VERSION" deploy \
  --only firestore \
  --project "$STAGING_FIREBASE_PROJECT" \
  --non-interactive

# `firebase deploy` exiting 0 is not proof the project is serving this file — same reasoning as
# the Cloud Run serving check at the bottom of this script. Confirm it directly.
echo
echo "Verifying the live ruleset matches firestore.rules..."
fetch_live_rules "$rules_workdir/live-after.rules"

if ! diff -u "$rules_workdir/live-after.rules" firestore.rules >/dev/null 2>&1; then
  echo >&2
  echo "Staging deploy blocked: the firestore deploy reported success, but" >&2
  echo "$STAGING_FIREBASE_PROJECT is not serving firestore.rules." >&2
  echo "  ('-' is live, '+' is the repo file it should match.)" >&2
  diff -u "$rules_workdir/live-after.rules" firestore.rules >&2 || true
  exit 1
fi
echo "  live ruleset verified"

echo
echo "Deploying staging Functions..."
# Wall-clock start of the deploy, so the check below can scope itself to builds this step
# triggered. RFC3339 UTC is what `gcloud builds list --filter` compares against.
functions_deploy_started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

env -u DEBUG npx --yes "firebase-tools@$FIREBASE_CLI_VERSION" deploy \
  --only functions \
  --project "$STAGING_FIREBASE_PROJECT" \
  --non-interactive

# Same failure mode as the Cloud Run serving check at the bottom of this script, one layer down:
# the deploy reports success while individual functions did not actually update. On 2026-08-26
# five of seven functions updated and sendAuthCode/sendPasswordResetLink both failed their Cloud
# Build with "function.js does not exist" — each kept serving its previous image, and the deploy
# carried on to build the frontend and re-bind secrets as if nothing were wrong.
#
# ACTIVE alone does not catch it: a function whose update fails stays ACTIVE on the old revision.
# The build failure is the signal, so check for one in the window this deploy occupied.
echo
echo "Verifying the functions deploy actually landed..."

for fn in "${STAGING_FUNCTIONS[@]}"; do
  state="$(env -u DEBUG gcloud functions describe "$fn" \
    --project "$STAGING_FIREBASE_PROJECT" --region "$STAGING_FUNCTIONS_REGION" \
    --account "$STAGING_GCLOUD_ACCOUNT" \
    --format='value(state)' 2>/dev/null || true)"
  [[ "$state" == "ACTIVE" ]] || fail "$fn is in state '${state:-unknown}', expected ACTIVE"
done
echo "  all ${#STAGING_FUNCTIONS[@]} functions report ACTIVE"

failed_builds="$(env -u DEBUG gcloud builds list \
  --project "$STAGING_FIREBASE_PROJECT" \
  --account "$STAGING_GCLOUD_ACCOUNT" \
  --region "$STAGING_FUNCTIONS_REGION" \
  --filter="status=FAILURE AND createTime>=\"$functions_deploy_started\"" \
  --format='value(id)' 2>/dev/null || true)"

if [[ -n "$failed_builds" ]]; then
  echo >&2
  echo "Staging deploy blocked: a function build FAILED during this deploy." >&2
  echo "  The Firebase CLI can still exit 0 when this happens, leaving the affected function" >&2
  echo "  serving its PREVIOUS image. Do not treat the functions as deployed." >&2
  echo >&2
  while IFS= read -r build_id; do
    [[ -n "$build_id" ]] || continue
    echo "    build $build_id" >&2
    echo "      https://console.cloud.google.com/cloud-build/builds;region=${STAGING_FUNCTIONS_REGION}/${build_id}?project=${STAGING_FIREBASE_PROJECT}" >&2
  done <<< "$failed_builds"
  exit 1
fi
echo "  no function build failed in this window"

echo
echo "Building staging image (Cloud Build, pinned digest)..."
image_tag="staging-$(git rev-parse --short HEAD 2>/dev/null || date -u +%Y%m%d%H%M%S)"

env -u DEBUG gcloud builds submit \
  --project "$STAGING_FIREBASE_PROJECT" \
  --account "$STAGING_GCLOUD_ACCOUNT" \
  --config cloudbuild.web.yaml \
  --substitutions "_BUILD_MODE=staging,_IMAGE_TAG=${image_tag},_REGISTRY_PATH=${STAGING_REGISTRY_PATH},_BUILD_SA=${STAGING_BUILD_SA}"

digest="$(gcloud artifacts docker images list "$STAGING_REGISTRY_PATH" \
  --account "$STAGING_GCLOUD_ACCOUNT" --include-tags \
  --filter="tags:${image_tag}" --format="value(version)")"
[[ -n "$digest" ]] || fail "could not resolve the built image digest"
echo "  image digest: $digest"

echo
echo "Deploying staging frontend by digest..."
env -u DEBUG gcloud run deploy "$STAGING_RUN_SERVICE" \
  --image "${STAGING_REGISTRY_PATH}@${digest}" \
  --region "$STAGING_RUN_REGION" \
  --project "$STAGING_FIREBASE_PROJECT" \
  --account "$STAGING_GCLOUD_ACCOUNT" \
  --allow-unauthenticated \
  --cpu 1 \
  --memory 512Mi \
  --concurrency 200 \
  --timeout 60 \
  --min-instances 0 \
  --max-instances 2 \
  --cpu-throttling \
  --quiet

echo
echo "Re-binding email secrets (firebase deploy clears them)..."
for fn in "${STAGING_EMAIL_FUNCTIONS[@]}"; do
  env -u DEBUG gcloud run services update "$fn" \
    --project "$STAGING_FIREBASE_PROJECT" \
    --region "$STAGING_FUNCTIONS_REGION" \
    --account "$STAGING_GCLOUD_ACCOUNT" \
    --set-secrets "EMAIL_USER=${STAGING_EMAIL_USER_SECRET}:latest,EMAIL_PASS=${STAGING_EMAIL_PASS_SECRET}:latest" \
    --quiet
done

# Prints the environment of the revision actually serving $1, one `NAME=KIND` line per variable,
# where KIND is `plaintext` or `secret:<secret-name>`.
#
# This deliberately reads Cloud Run, not `gcloud functions describe`. The re-bind above goes
# through `gcloud run services update`, which writes the Cloud Run service directly and bypasses
# the Cloud Functions v2 API, so GCF metadata for these two functions goes stale: as of
# 2026-08-29 it still reported updateTime 2026-08-26T02:27:54Z — the timestamp of a FAILED
# update — and an empty serviceConfig.revision, five Cloud Run revisions behind. The old guard
# read exactly that view, so it was checking a copy that does not serve traffic.
serving_env() {
  local svc="$1" serving_rev

  serving_rev="$(env -u DEBUG gcloud run services describe "$svc" \
    --project "$STAGING_FIREBASE_PROJECT" \
    --region "$STAGING_FUNCTIONS_REGION" \
    --account "$STAGING_GCLOUD_ACCOUNT" \
    --format=json 2>/dev/null | python3 -c '
import json, sys

try:
    data = json.load(sys.stdin)
except ValueError:
    sys.exit(1)
# A tagged revision at 0% sorts first in status.traffic, so select on percent, never index.
for entry in data.get("status", {}).get("traffic", []):
    if entry.get("percent") == 100:
        print(entry.get("revisionName", ""))
        break
')"
  [[ -n "$serving_rev" ]] || return 1

  env -u DEBUG gcloud run revisions describe "$serving_rev" \
    --project "$STAGING_FIREBASE_PROJECT" \
    --region "$STAGING_FUNCTIONS_REGION" \
    --account "$STAGING_GCLOUD_ACCOUNT" \
    --format=json 2>/dev/null | python3 -c '
import json, sys

data = json.load(sys.stdin)
containers = data.get("spec", {}).get("containers", [])
for var in (containers[0].get("env", []) if containers else []):
    ref = (var.get("valueFrom") or {}).get("secretKeyRef") or {}
    kind = "secret:" + ref.get("name", "") if ref else "plaintext"
    print(var.get("name", "") + "=" + kind)
'
}

echo
echo "Verifying email credentials on the revisions actually serving..."
for fn in "${STAGING_FUNCTIONS[@]}"; do
  svc="$(run_service_name "$fn")"
  env_lines="$(serving_env "$svc")" \
    || fail "could not read the serving revision of $svc — cannot verify its credentials"

  if printf '%s\n' "$env_lines" | grep -qE '^(EMAIL_USER|EMAIL_PASS)=plaintext$'; then
    fail "$fn serves plaintext EMAIL_* — the credential is exposed in function config"
  fi

  # The two email functions must not merely lack plaintext, they must actually have the secrets.
  # A re-bind that silently did not take would otherwise read as a pass.
  if [[ " ${STAGING_EMAIL_FUNCTIONS[*]} " == *" $svc "* ]]; then
    for want in "EMAIL_USER=secret:${STAGING_EMAIL_USER_SECRET}" \
                "EMAIL_PASS=secret:${STAGING_EMAIL_PASS_SECRET}"; do
      printf '%s\n' "$env_lines" | grep -qxF "$want" \
        || fail "$fn is missing '$want' on its serving revision — the secret re-bind did not take"
    done
  fi
done
echo "  all ${#STAGING_FUNCTIONS[@]} functions clean; email secrets bound on ${#STAGING_EMAIL_FUNCTIONS[@]}"

# `gcloud run deploy` reports the revision the service is SERVING, not the one it just
# created. When traffic is pinned to an older revision those differ, and a deploy that
# changed nothing user-visible still prints "serving 100 percent of traffic" and exits 0.
# Everything below exists so that can never read as success again.
echo
echo "Verifying what the service actually serves..."

describe_service() {
  env -u DEBUG gcloud run services describe "$STAGING_RUN_SERVICE" \
    --project "$STAGING_FIREBASE_PROJECT" \
    --region "$STAGING_RUN_REGION" \
    --account "$STAGING_GCLOUD_ACCOUNT" \
    --format="$1"
}

deployed_revision="$(describe_service 'value(status.latestCreatedRevisionName)')"
[[ -n "$deployed_revision" ]] || fail "could not resolve the revision this deploy created"

# A tagged revision at 0% sorts first in status.traffic, so select on percent, never index.
serving_revision="$(describe_service json | python3 -c '
import json, sys
for entry in json.load(sys.stdin).get("status", {}).get("traffic", []):
    if entry.get("percent") == 100:
        print(entry.get("revisionName", ""))
        break
')"
[[ -n "$serving_revision" ]] || fail "no revision is receiving 100% of traffic"

expected_image="${STAGING_REGISTRY_PATH}@${digest}"
serving_image="$(env -u DEBUG gcloud run revisions describe "$serving_revision" \
  --project "$STAGING_FIREBASE_PROJECT" \
  --region "$STAGING_RUN_REGION" \
  --account "$STAGING_GCLOUD_ACCOUNT" \
  --format='value(spec.containers[0].image)')"

echo "  built this run:  $deployed_revision"
echo "  serving at 100%: $serving_revision"

if [[ "$serving_revision" != "$deployed_revision" ]]; then
  cat >&2 <<EOF

########################################################################
# DEPLOY DID NOT TAKE EFFECT
#
# Built and deployed: $deployed_revision
# Still serving:      $serving_revision
#
# The service is traffic-pinned, so the new revision was created with 0%
# of traffic. Nothing you just built is reachable at
# https://f1.staging.carolinaminted.net
#
# To serve it, either shift traffic to this one revision:
#   gcloud run services update-traffic $STAGING_RUN_SERVICE \\
#     --to-revisions $deployed_revision=100 \\
#     --region $STAGING_RUN_REGION --project $STAGING_FIREBASE_PROJECT \\
#     --account $STAGING_GCLOUD_ACCOUNT
#
# ...or restore latest-tracking so future deploys serve automatically:
#   gcloud run services update-traffic $STAGING_RUN_SERVICE --to-latest \\
#     --region $STAGING_RUN_REGION --project $STAGING_FIREBASE_PROJECT \\
#     --account $STAGING_GCLOUD_ACCOUNT
########################################################################
EOF
  exit 1
fi

if [[ "$serving_image" != "$expected_image" ]]; then
  echo >&2
  echo "Staging deploy blocked: $serving_revision serves an unexpected image." >&2
  echo "  expected: $expected_image" >&2
  echo "  actual:   $serving_image" >&2
  exit 1
fi

echo "  image digest verified on the serving revision"

echo
echo "Staging deployment complete: https://f1.staging.carolinaminted.net"
echo "  revision: $serving_revision"
echo "  image:    ${STAGING_REGISTRY_PATH}:${image_tag}"
echo "  digest:   $digest"
