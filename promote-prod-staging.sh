#!/usr/bin/env bash
#
# Shifts prod-staging traffic to a candidate revision built by ./deploy-prod-staging.sh.
#
# ⚠️ Read this before you use it to reason about risk:
#
# Promoting a revision on lights-out-league-web reaches ZERO league members. The live league is
# https://f1.carolinaminted.net, served by the legacy project gen-lang-client-0034225567, and it
# is not deployable from this repo. Going live needs a Cloud Run domain mapping AND a registrar
# CNAME change, neither of which has happened. A traffic shift is not a cutover.
#
# What it DOES affect: prod-staging reads and writes production Firestore (formula-fantasy-1).
#
# The last gate below exists to prove the live league site was untouched.

set -Eeuo pipefail

readonly PROJECT="lights-out-league-prod"
readonly SERVICE="lights-out-league-web"
readonly REGION="us-west1"
readonly ACCOUNT="jhh@carolinaminted.net"
readonly LIVE_LEAGUE_URL="https://f1.carolinaminted.net"
readonly LIVE_LEAGUE_HOST="f1.carolinaminted.net"
readonly REQUIRED_BRANCH="prod"

usage() {
  cat <<'EOF'
Usage: ./promote-prod-staging.sh [--revision <name>] [--dry-run]

Shifts 100% of prod-staging traffic to the candidate for the current `prod` commit.

  --revision <name>  Promote this exact revision instead of auto-detecting the candidate.
  --dry-run          Run every gate and print what would happen. Shifts no traffic.
EOF
}

fail() { echo "Promotion blocked: $*" >&2; exit 1; }

dry_run=false
revision=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) dry_run=true; shift ;;
    --revision) revision="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; fail "unsupported argument '$1'. Targets cannot be overridden." ;;
  esac
done

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

for required_command in git gcloud curl dig python3; do
  command -v "$required_command" >/dev/null 2>&1 || fail "required command is not installed: $required_command"
done

[[ "$PROJECT" == "lights-out-league-prod" ]] || fail "unexpected project target"
[[ "$SERVICE" == "lights-out-league-web" ]] || fail "unexpected service target"

current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
commit="$(git rev-parse HEAD)"
short_sha="$(git rev-parse --short HEAD)"
revision_tag="c${short_sha}"

[[ "$current_branch" == "$REQUIRED_BRANCH" ]] || fail \
  "must promote from '$REQUIRED_BRANCH', not '$current_branch'."

echo "Checking release gates for $short_sha..."
./scripts/release-gates.sh check "$commit" local-verified staging-verified candidate-verified || fail \
  "this commit has not cleared every gate.
  The candidate gate is the one that says a human smoke-tested the candidate URL:
    ./scripts/release-gates.sh sign candidate"
echo "  all gates present"

describe_json() {
  env -u DEBUG gcloud run services describe "$SERVICE" \
    --project "$PROJECT" --region "$REGION" --account "$ACCOUNT" --format=json 2>/dev/null
}

serving_at_100() {
  python3 -c '
import json, sys

data = json.load(sys.stdin)
for entry in data.get("status", {}).get("traffic", []):
    if entry.get("percent") == 100:
        print(entry.get("revisionName", ""))
        break
'
}

before_json="$(describe_json)"
[[ -n "$before_json" ]] || fail "could not read the service (gcloud auth may have expired:
  gcloud auth login --account $ACCOUNT)"

serving_before="$(echo "$before_json" | serving_at_100)"
[[ -n "$serving_before" ]] || fail "no revision is currently receiving 100% of traffic"

if [[ -z "$revision" ]]; then
  revision="$(echo "$before_json" | REVISION_TAG="$revision_tag" python3 -c '
import json, sys, os

tag = os.environ["REVISION_TAG"]
for entry in json.load(sys.stdin).get("status", {}).get("traffic", []):
    if entry.get("tag") == tag:
        print(entry.get("revisionName", ""))
        break
')"
  [[ -n "$revision" ]] || fail "no revision tagged '$revision_tag' on $SERVICE.
  Build a candidate first: ./deploy-prod-staging.sh"
fi

if [[ "$revision" == "$serving_before" ]]; then
  echo
  echo "$revision is already serving 100% of traffic. Nothing to promote."
  exit 0
fi

candidate_url="$(echo "$before_json" | REVISION_TAG="$revision_tag" python3 -c '
import json, sys, os

tag = os.environ["REVISION_TAG"]
for entry in json.load(sys.stdin).get("status", {}).get("traffic", []):
    if entry.get("tag") == tag:
        print(entry.get("url", ""))
        break
')"
default_url="$(echo "$before_json" | python3 -c '
import json, sys
print(json.load(sys.stdin).get("status", {}).get("url", ""))
')"

# Baseline the live league site BEFORE shifting anything, so the final gate is a real comparison
# rather than a spot check that would pass even if the site had already been broken.
echo
echo "Baselining the live league site (must be unaffected)..."
live_status_before="$(curl -sS -o /dev/null -w '%{http_code}' "$LIVE_LEAGUE_URL/" || echo 000)"
live_bundle_before="$(curl -sS "$LIVE_LEAGUE_URL/" 2>/dev/null | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
live_cname_before="$(dig +short "$LIVE_LEAGUE_HOST" CNAME 2>/dev/null | head -1 || true)"
echo "  $LIVE_LEAGUE_URL  HTTP $live_status_before  bundle ${live_bundle_before:-unknown}  CNAME ${live_cname_before:-none}"
[[ "$live_status_before" == "200" ]] || fail "the live league site is not healthy before promotion (HTTP $live_status_before).
  Fix that first — do not change anything else while it is down."

cat <<EOF

About to shift 100% of prod-staging traffic:

  from: $serving_before
  to:   $revision  (commit $short_sha)

  service URL: $default_url
  candidate:   $candidate_url

  This reaches zero league members. $LIVE_LEAGUE_URL is served by a different project.

Rollback (both revisions stay warm; takes seconds):
  gcloud run services update-traffic $SERVICE \\
    --to-revisions $serving_before=100 \\
    --region $REGION --project $PROJECT --account $ACCOUNT
EOF

if [[ "$dry_run" == true ]]; then
  echo
  echo "Dry run passed. No traffic was shifted."
  exit 0
fi

if [[ ! -t 0 ]]; then
  fail "refusing to shift traffic non-interactively"
fi
echo
read -r -p "Promote $revision to 100%? [y/N] " reply
[[ "$reply" == "y" || "$reply" == "Y" ]] || fail "not confirmed; no traffic was shifted"

echo
echo "Shifting traffic..."
env -u DEBUG gcloud run services update-traffic "$SERVICE" \
  --to-revisions "${revision}=100" \
  --region "$REGION" --project "$PROJECT" --account "$ACCOUNT" --quiet

rollback_banner() {
  cat >&2 <<EOF

########################################################################
# PROMOTION GATE FAILED — ROLL BACK
#
#   gcloud run services update-traffic $SERVICE \\
#     --to-revisions $serving_before=100 \\
#     --region $REGION --project $PROJECT --account $ACCOUNT
########################################################################
EOF
}

echo
echo "Verifying the promotion..."
failures=0
pass() { printf '  [ok]   %s\n' "$1"; }
flunk() { printf '  [FAIL] %s\n' "$1" >&2; failures=$((failures + 1)); }

# Gate 1 — traffic actually moved.
serving_after="$(describe_json | serving_at_100)"
if [[ "$serving_after" == "$revision" ]]; then
  pass "traffic: $revision at 100%"
else
  flunk "traffic: expected $revision at 100%, found ${serving_after:-none}"
fi

# Gate 2 — the DEFAULT url serves the new bundle, not just the tagged one. A tagged URL can serve
# the new revision while the default still serves the old one; that is the failure this catches.
default_bundle="$(curl -sS "$default_url/" 2>/dev/null | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
candidate_bundle="$(curl -sS "$candidate_url/" 2>/dev/null | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
if [[ -n "$default_bundle" && "$default_bundle" == "$candidate_bundle" ]]; then
  pass "default URL serves the promoted bundle ($default_bundle)"
else
  flunk "default URL serves ${default_bundle:-nothing}, candidate serves ${candidate_bundle:-nothing}"
fi

# Gate 3 — prod-staging must stay un-indexable.
if curl -sS -o /dev/null -D - "$default_url/" 2>/dev/null | grep -qi '^x-robots-tag:[[:space:]]*noindex, nofollow, noarchive'; then
  pass "X-Robots-Tag still present on the default URL"
else
  flunk "X-Robots-Tag missing on the default URL — prod-staging could be indexed"
fi

# Gate 4 — the one that proves no league member was affected.
live_status_after="$(curl -sS -o /dev/null -w '%{http_code}' "$LIVE_LEAGUE_URL/" || echo 000)"
live_bundle_after="$(curl -sS "$LIVE_LEAGUE_URL/" 2>/dev/null | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
live_cname_after="$(dig +short "$LIVE_LEAGUE_HOST" CNAME 2>/dev/null | head -1 || true)"
if [[ "$live_status_after" == "$live_status_before" \
   && "$live_bundle_after" == "$live_bundle_before" \
   && "$live_cname_after" == "$live_cname_before" ]]; then
  pass "live league site unchanged (HTTP $live_status_after, ${live_bundle_after:-?}, CNAME ${live_cname_after:-none})"
else
  flunk "LIVE LEAGUE SITE CHANGED:
           status ${live_status_before} -> ${live_status_after}
           bundle ${live_bundle_before:-?} -> ${live_bundle_after:-?}
           CNAME  ${live_cname_before:-none} -> ${live_cname_after:-none}"
fi

if [[ "$failures" -gt 0 ]]; then
  rollback_banner
  exit 1
fi

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
who="$(git config user.email 2>/dev/null || echo unknown)"
git notes --ref=refs/notes/release-gates append \
  -m "promoted: ${now} by ${who} from=${serving_before} to=${revision}" "$commit"
git push --quiet origin refs/notes/release-gates 2>/dev/null || \
  echo "  (could not push release-gates notes; push later with: git push origin refs/notes/release-gates)"

cat <<EOF

Promotion complete.

  serving:  $revision  (commit $short_sha)
  previous: $serving_before  ← rollback handle, still warm
  URL:      $default_url

  $LIVE_LEAGUE_URL is unchanged and still serves the legacy deployment.
  This was NOT a production cutover — see production-cutover-readiness-runbook.md.

Rollback:
  gcloud run services update-traffic $SERVICE \\
    --to-revisions $serving_before=100 \\
    --region $REGION --project $PROJECT --account $ACCOUNT
EOF
