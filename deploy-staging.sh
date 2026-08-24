#!/usr/bin/env bash

set -Eeuo pipefail

readonly STAGING_FIREBASE_PROJECT="formula-fantasy-staging"
readonly STAGING_FIREBASE_ALIAS="staging"
readonly STAGING_RUN_SERVICE="lights-out-league-staging"
readonly STAGING_RUN_REGION="us-west1"
readonly FIREBASE_CLI_VERSION="15.28.1"

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
echo "Deploying staging frontend..."
env -u DEBUG gcloud run deploy "$STAGING_RUN_SERVICE" \
  --source . \
  --region "$STAGING_RUN_REGION" \
  --project "$STAGING_FIREBASE_PROJECT" \
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
echo "Staging deployment complete: https://f1.staging.carolinaminted.net"
