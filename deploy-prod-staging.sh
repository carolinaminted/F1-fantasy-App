#!/usr/bin/env bash
#
# Builds `prod` and deploys it to prod-staging as a ZERO-TRAFFIC candidate revision.
#
# This script never promotes. It puts a new revision on the real service with no traffic and its
# own tagged URL, so it can be exercised against production data while the current revision keeps
# serving. Promotion is ./promote-prod-staging.sh and a separate decision.
#
# ⚠️ prod-staging reads and WRITES production Firestore (formula-fantasy-1). The candidate
# receives no traffic, but anything you do while smoke-testing it is a real write to real member
# data. See lol-docs/documentation/release-and-promotion-sop.md.
#
# Deliberately stricter than deploy-staging.sh: that one warns about a wrong branch or a dirty
# tree, this one refuses. Staging is disposable; this is the production data plane.

set -Eeuo pipefail

readonly PROJECT="lights-out-league-prod"
readonly SERVICE="lights-out-league-web"
readonly REGION="us-west1"
readonly ACCOUNT="jhh@carolinaminted.net"
readonly REGISTRY="us-west1-docker.pkg.dev/lights-out-league-prod/lol-web/lights-out-league-web"
readonly BUILD_MODE="prod-staging"
readonly BUILD_SA="projects/lights-out-league-prod/serviceAccounts/lol-build@lights-out-league-prod.iam.gserviceaccount.com"
readonly REQUIRED_BRANCH="prod"

usage() {
  cat <<'EOF'
Usage: ./deploy-prod-staging.sh [--dry-run] [--expect-string <s>]

Builds the current `prod` commit and deploys it to prod-staging with NO traffic.

  --dry-run             Validate gates and print the locked targets. Touches no cloud resources.
  --expect-string <s>   Also assert this string appears in the served bundle. Use a string
                        unique to the release you are shipping.
EOF
}

fail() { echo "Prod-staging deploy blocked: $*" >&2; exit 1; }

dry_run=false
expect_string=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) dry_run=true; shift ;;
    --expect-string) expect_string="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; fail "unsupported argument '$1'. Deployment targets cannot be overridden." ;;
  esac
done

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

for required_file in package.json package-lock.json Dockerfile cloudbuild.web.yaml \
                     .env.prod-staging scripts/release-gates.sh scripts/bundle-audit.sh; do
  [[ -f "$required_file" ]] || fail "required repository file is missing: $required_file"
done

for required_command in git gcloud curl python3; do
  command -v "$required_command" >/dev/null 2>&1 || fail "required command is not installed: $required_command"
done

[[ "$PROJECT" == "lights-out-league-prod" ]] || fail "unexpected project target"
[[ "$SERVICE" == "lights-out-league-web" ]] || fail "unexpected service target"
[[ "$PROJECT" != *"formula-fantasy-1"* ]] || fail "production Firebase target detected"

current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
commit="$(git rev-parse HEAD)"
short_sha="$(git rev-parse --short HEAD)"
image_tag="prod-${short_sha}"
revision_tag="c${short_sha}"

echo "Prod-staging deployment targets locked:"
echo "  GCP project:       $PROJECT"
echo "  Cloud Run service: $SERVICE ($REGION)"
echo "  Data plane:        formula-fantasy-1  ← PRODUCTION member data"
echo "  Build mode:        $BUILD_MODE"
echo "  Commit:            $short_sha ($current_branch)"
echo "  Image tag:         $image_tag"
echo "  Revision tag:      $revision_tag"
echo

# Hard failures, not warnings. A candidate built from the wrong branch or a dirty tree carries an
# image tag that does not describe its contents, which breaks the digest-to-commit trail into
# production — the one record that says what is actually running.
[[ "$current_branch" == "$REQUIRED_BRANCH" ]] || fail \
  "must deploy from '$REQUIRED_BRANCH', not '$current_branch'.
  Release first:  git checkout prod && git merge --ff-only staging && git push origin prod"

[[ -z "$(git status --porcelain)" ]] || fail \
  "the working tree is dirty. Cloud Build uploads the working directory but tags the image with
  HEAD's SHA, so the tag would not describe what shipped. Commit or stash first."

echo "Checking release gates for $short_sha..."
./scripts/release-gates.sh check "$commit" local-verified staging-verified || fail \
  "this commit has not cleared the earlier gates.
  Sign them with:  ./scripts/release-gates.sh sign local
                   ./scripts/release-gates.sh sign staging"
echo "  local-verified and staging-verified present"

set +e
serving_out="$(./scripts/release-gates.sh serving staging "$commit")"
serving_rc=$?
set -e
case $serving_rc in
  0) echo "  staging is serving this commit ($(echo "$serving_out" | awk '{print $2}'))" ;;
  1) fail "staging is not serving $short_sha — it serves $(echo "$serving_out" | awk '{print $4}' | cut -c1-7).
  Deploy this commit to staging and validate it there first: ./deploy-staging.sh" ;;
  *) fail "could not determine what staging is serving. Refusing to build a production candidate
  on an unverified claim. Check gcloud auth, then retry." ;;
esac

# Record the rollback point BEFORE anything changes. If the rest of this script goes wrong, this
# is the revision to return to.
echo
echo "Recording the current rollback point..."
describe_json() {
  env -u DEBUG gcloud run services describe "$SERVICE" \
    --project "$PROJECT" --region "$REGION" --account "$ACCOUNT" --format=json 2>/dev/null
}

serving_before="$(describe_json | python3 -c '
import json, sys

data = json.load(sys.stdin)
for entry in data.get("status", {}).get("traffic", []):
    if entry.get("percent") == 100:
        print(entry.get("revisionName", ""))
        break
')"
[[ -n "$serving_before" ]] || fail "could not read the currently serving revision (gcloud auth may have expired:
  gcloud auth login --account $ACCOUNT)"

image_before="$(env -u DEBUG gcloud run revisions describe "$serving_before" \
  --project "$PROJECT" --region "$REGION" --account "$ACCOUNT" \
  --format='value(spec.containers[0].image)' 2>/dev/null)"

echo "  ROLLBACK POINT: $serving_before"
echo "                  $image_before"

# Snapshot every existing tag. cloudbuild.web.yaml defaults _IMAGE_TAG to `auth-functions-v1`,
# which is a live tag on a real image; a build that forgets an explicit tag moves it off the
# artifact it names and silently destroys a rollback reference. We always pass a tag, and verify
# afterwards that nothing else moved.
tag_snapshot() {
  env -u DEBUG gcloud artifacts docker images list "$REGISTRY" \
    --account "$ACCOUNT" --include-tags --format="csv[no-heading](version,tags)" 2>/dev/null | sort
}
tags_before="$(tag_snapshot)"

if [[ "$dry_run" == true ]]; then
  echo
  echo "Dry run passed. No cloud resources were changed."
  echo "  would build:  ${REGISTRY}:${image_tag}"
  echo "  would deploy: $SERVICE revision tagged '$revision_tag' at 0% traffic"
  exit 0
fi

echo
echo "Building prod-staging image (Cloud Build, explicit tag)..."
env -u DEBUG gcloud builds submit \
  --project "$PROJECT" \
  --account "$ACCOUNT" \
  --config cloudbuild.web.yaml \
  --substitutions "_BUILD_MODE=${BUILD_MODE},_IMAGE_TAG=${image_tag},_REGISTRY_PATH=${REGISTRY},_BUILD_SA=${BUILD_SA}"

digest="$(env -u DEBUG gcloud artifacts docker images list "$REGISTRY" \
  --account "$ACCOUNT" --include-tags \
  --filter="tags:${image_tag}" --format="value(version)" 2>/dev/null)"
[[ -n "$digest" ]] || fail "could not resolve the built image digest"
echo "  image digest: $digest"

echo
echo "Verifying no pre-existing image tag moved..."
tags_after="$(tag_snapshot)"
moved="$(TAGS_BEFORE="$tags_before" TAGS_AFTER="$tags_after" python3 - "$image_tag" <<'PY'
import sys, os

new_tag = sys.argv[1]

def load(text):
    out = {}
    for line in text.strip().splitlines():
        if not line.strip():
            continue
        version, _, tags = line.partition(",")
        for tag in tags.split(";") if tags else []:
            tag = tag.strip().strip('"')
            if tag:
                out[tag] = version
    return out

before = load(os.environ["TAGS_BEFORE"])
after = load(os.environ["TAGS_AFTER"])
for tag, version in before.items():
    if tag == new_tag:
        continue
    if tag in after and after[tag] != version:
        print(f"{tag}: {version} -> {after[tag]}")
PY
)" || true
if [[ -n "$moved" ]]; then
  echo "$moved" | sed 's/^/    /' >&2
  fail "an existing image tag moved — a rollback reference may have been destroyed"
fi
echo "  no existing tags moved"

echo
echo "Deploying candidate revision with NO traffic..."
# Image-only deploy: `gcloud run deploy` preserves service settings it is not given (CPU, memory,
# concurrency, runtime service account), so this cannot silently reconfigure the service.
env -u DEBUG gcloud run deploy "$SERVICE" \
  --image "${REGISTRY}@${digest}" \
  --region "$REGION" \
  --project "$PROJECT" \
  --account "$ACCOUNT" \
  --no-traffic \
  --tag "$revision_tag" \
  --quiet

echo
echo "Verifying the deploy changed nothing that is serving..."
after_json="$(describe_json)"
serving_after="$(echo "$after_json" | python3 -c '
import json, sys

data = json.load(sys.stdin)
for entry in data.get("status", {}).get("traffic", []):
    if entry.get("percent") == 100:
        print(entry.get("revisionName", ""))
        break
')"

# The whole point of --no-traffic. If this assertion ever fires, a "shadow" deploy just became a
# live one against production data.
if [[ "$serving_after" != "$serving_before" ]]; then
  cat >&2 <<EOF

########################################################################
# THE SERVING REVISION CHANGED — THIS WAS SUPPOSED TO BE A SHADOW DEPLOY
#
# before: $serving_before
# after:  $serving_after
#
# Roll back immediately:
#   gcloud run services update-traffic $SERVICE \\
#     --to-revisions $serving_before=100 \\
#     --region $REGION --project $PROJECT --account $ACCOUNT
########################################################################
EOF
  exit 1
fi
echo "  still serving $serving_before — unchanged"

candidate_revision="$(echo "$after_json" | python3 -c '
import json, sys
print(json.load(sys.stdin).get("status", {}).get("latestCreatedRevisionName", ""))
')"
candidate_url="$(echo "$after_json" | REVISION_TAG="$revision_tag" python3 -c '
import json, sys, os

tag = os.environ["REVISION_TAG"]
for entry in json.load(sys.stdin).get("status", {}).get("traffic", []):
    if entry.get("tag") == tag:
        print(entry.get("url", ""))
        break
')"
[[ -n "$candidate_url" ]] || fail "the candidate revision has no tagged URL"

echo
echo "Auditing the bundle the candidate actually serves..."
audit_args=("$candidate_url")
[[ -n "$expect_string" ]] && audit_args+=(--expect-string "$expect_string")
./scripts/bundle-audit.sh "${audit_args[@]}" || fail \
  "the candidate bundle failed its audit. It has no traffic, so nothing is broken — but do not
  promote it. Inspect, fix, rebuild."

cat <<EOF

Candidate deployed and audited. It is serving NO traffic.

  commit:    $short_sha
  revision:  $candidate_revision
  digest:    $digest
  URL:       $candidate_url

  still serving to users of this service: $serving_before

Next:
  1. Smoke-test the candidate URL above. Remember it writes to PRODUCTION Firestore.
  2. Record that you did:   ./scripts/release-gates.sh sign candidate
  3. Promote:               ./promote-prod-staging.sh

Rollback point if anything later goes wrong:
  gcloud run services update-traffic $SERVICE \\
    --to-revisions $serving_before=100 \\
    --region $REGION --project $PROJECT --account $ACCOUNT
EOF
