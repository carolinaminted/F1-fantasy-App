#!/usr/bin/env bash

set -Eeuo pipefail

readonly STAGING_FIREBASE_PROJECT="formula-fantasy-staging"
readonly STAGING_FIREBASE_ALIAS="staging"
readonly STAGING_RUN_SERVICE="lights-out-league-staging"
readonly STAGING_RUN_REGION="us-west1"
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

echo "Staging deployment targets locked:"
echo "  Firebase project: $STAGING_FIREBASE_PROJECT (alias: $STAGING_FIREBASE_ALIAS)"
echo "  Cloud Run service: $STAGING_RUN_SERVICE"
echo "  Cloud Run region:  $STAGING_RUN_REGION"
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

echo "Staging deployment complete: https://f1.staging.carolinaminted.net"
