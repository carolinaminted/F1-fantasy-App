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
# Only these two functions read email credentials. They are re-bound after every
# functions deploy, because `firebase deploy` clears secret bindings it did not set.
readonly STAGING_EMAIL_FUNCTIONS=(sendauthcode sendpasswordresetlink)

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

for required_file in package.json package-lock.json firebase.json .firebaserc Dockerfile functions/package.json; do
  [[ -f "$required_file" ]] || fail "required repository file is missing: $required_file"
done

for required_command in node npm npx gcloud; do
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

echo
echo "Deploying staging Functions..."
env -u DEBUG npx --yes "firebase-tools@$FIREBASE_CLI_VERSION" deploy \
  --only functions \
  --project "$STAGING_FIREBASE_PROJECT" \
  --non-interactive

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
    --set-secrets EMAIL_USER=lol-staging-email-user:latest,EMAIL_PASS=lol-staging-email-pass:latest \
    --quiet
done

echo
echo "Verifying no plaintext credentials landed in function config..."
for fn in manualLeaderboardSync sendAuthCode sendPasswordResetLink \
          updateLeaderboardOnCancellation updateLeaderboardOnResults \
          validateInvitationCode verifyAuthCode; do
  plaintext="$(gcloud functions describe "$fn" \
    --project "$STAGING_FIREBASE_PROJECT" --region "$STAGING_FUNCTIONS_REGION" \
    --account "$STAGING_GCLOUD_ACCOUNT" \
    --format="value(serviceConfig.environmentVariables)" 2>/dev/null \
    | tr ';' '\n' | grep -cE '^(EMAIL_USER|EMAIL_PASS)=' || true)"
  [[ "$plaintext" == "0" ]] || fail "$fn has plaintext EMAIL_* in its config"
done
echo "  all 7 functions clean"

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
