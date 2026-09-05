#!/usr/bin/env bash
#
# Shifts traffic to a production candidate built by ./deploy-production.sh.
#
# Sibling of ./promote-prod-staging.sh, and deliberately near-identical to it. Two gates differ,
# because the production build differs in exactly two ways:
#
#   * Gate 3 asserts the noindex header is ABSENT. A production build strips it; if it is still
#     there, a prod-staging image is serving.
#   * Gate 4 adapts to whether f1.carolinaminted.net has been cut over yet. Before the cutover it
#     asserts the live league site was untouched, exactly as the prod-staging script does. After
#     the cutover this service IS the live league, so it asserts the domain now serves the
#     promoted bundle instead. The script detects which case it is in rather than being told.
#
# ⚠️ Unlike promote-prod-staging.sh, this CAN reach league members — once the domain is mapped,
# promoting here changes what 40 people see. It also reads and writes production Firestore.

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
Usage: ./promote-production.sh [--revision <name>] [--dry-run]

Shifts 100% of traffic to the production candidate for the current `prod` commit.

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
revision_tag="p${short_sha}"   # deploy-production.sh tags with p<sha>; prod-staging uses c<sha>

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

bundle_of() {
  curl -sS "$1/" 2>/dev/null | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true
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
  Build a production candidate first: ./deploy-production.sh"
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

echo
echo "Baselining the live league site..."
live_status_before="$(curl -sS -o /dev/null -w '%{http_code}' "$LIVE_LEAGUE_URL/" || echo 000)"
live_bundle_before="$(bundle_of "$LIVE_LEAGUE_URL")"
live_cname_before="$(dig +short "$LIVE_LEAGUE_HOST" CNAME 2>/dev/null | head -1 || true)"
default_bundle_before="$(bundle_of "$default_url")"

# Is the domain already served by THIS service? Both the legacy mapping and a Cloud Run domain
# mapping CNAME to ghs.googlehosted.com, so DNS cannot tell them apart — the bundle can.
if [[ -n "$live_bundle_before" && "$live_bundle_before" == "$default_bundle_before" ]]; then
  domain_is_ours=true
else
  domain_is_ours=false
fi

echo "  $LIVE_LEAGUE_URL  HTTP $live_status_before  bundle ${live_bundle_before:-unknown}  CNAME ${live_cname_before:-none}"
if [[ "$domain_is_ours" == true ]]; then
  echo "  the domain is ALREADY served by $SERVICE — this promotion changes what members see"
else
  echo "  the domain is served elsewhere (legacy) — this promotion reaches zero members"
fi

[[ "$live_status_before" == "200" ]] || fail "the live league site is not healthy before promotion (HTTP $live_status_before).
  Fix that first — do not change anything else while it is down."

cat <<EOF

About to shift 100% of traffic:

  from: $serving_before
  to:   $revision  (commit $short_sha)

  service URL: $default_url
  candidate:   $candidate_url

Rollback (both revisions stay warm; takes seconds):
  gcloud run services update-traffic $SERVICE \\
    --to-revisions $serving_before=100 \\
    --region $REGION --project $PROJECT --account $ACCOUNT
EOF

if [[ "$domain_is_ours" == true ]]; then
  cat <<EOF

  ⚠️ $LIVE_LEAGUE_URL points at this service. League members will see this change.
EOF
fi

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

# Gate 2 — the DEFAULT url serves the new bundle, not just the tagged one.
default_bundle="$(bundle_of "$default_url")"
candidate_bundle="$(bundle_of "$candidate_url")"
if [[ -n "$default_bundle" && "$default_bundle" == "$candidate_bundle" ]]; then
  pass "default URL serves the promoted bundle ($default_bundle)"
else
  flunk "default URL serves ${default_bundle:-nothing}, candidate serves ${candidate_bundle:-nothing}"
fi

# Gate 3 — INVERTED from the prod-staging script. A production build strips the header; if it is
# present, a prod-staging image just went live.
robots="$(curl -sS -o /dev/null -D - "$default_url/" 2>/dev/null | grep -i '^x-robots-tag:' | tr -d '\r' || true)"
if [[ -z "$robots" ]]; then
  pass "no X-Robots-Tag — this is a production build"
else
  flunk "X-Robots-Tag is present ($robots) — a prod-staging image is serving, not a production one"
fi

# Gate 4 — adapts to the cutover state established before the shift.
live_status_after="$(curl -sS -o /dev/null -w '%{http_code}' "$LIVE_LEAGUE_URL/" || echo 000)"
live_bundle_after="$(bundle_of "$LIVE_LEAGUE_URL")"
live_cname_after="$(dig +short "$LIVE_LEAGUE_HOST" CNAME 2>/dev/null | head -1 || true)"

if [[ "$domain_is_ours" == true ]]; then
  # Post-cutover: the domain SHOULD now serve what we just promoted.
  if [[ "$live_status_after" == "200" && "$live_bundle_after" == "$default_bundle" ]]; then
    pass "live league site serves the promoted bundle (HTTP 200, $live_bundle_after)"
  else
    flunk "LIVE LEAGUE SITE DID NOT PICK UP THE PROMOTION:
           status ${live_status_after}
           bundle ${live_bundle_after:-?} (expected ${default_bundle:-?})"
  fi
else
  # Pre-cutover: the domain must be untouched, same assertion as promote-prod-staging.sh.
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
fi

if [[ "$failures" -gt 0 ]]; then
  rollback_banner
  exit 1
fi

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
who="$(git config user.email 2>/dev/null || echo unknown)"
git notes --ref=refs/notes/release-gates append \
  -m "promoted: ${now} by ${who} from=${serving_before} to=${revision} mode=production" "$commit"
git push --quiet origin refs/notes/release-gates 2>/dev/null || \
  echo "  (could not push release-gates notes; push later with: git push origin refs/notes/release-gates)"

cat <<EOF

Promotion complete.

  serving:  $revision  (commit $short_sha)
  previous: $serving_before  ← rollback handle, still warm
  URL:      $default_url

EOF

if [[ "$domain_is_ours" == true ]]; then
  echo "  $LIVE_LEAGUE_URL now serves this revision. Members are on it."
else
  cat <<EOF
  $LIVE_LEAGUE_URL still serves the legacy deployment — this was NOT a cutover.
  To finish: map the domain to $SERVICE, and add $LIVE_LEAGUE_HOST to production
  Firebase Auth's authorized domains first, or every sign-in will fail.
EOF
fi

cat <<EOF

Rollback:
  gcloud run services update-traffic $SERVICE \\
    --to-revisions $serving_before=100 \\
    --region $REGION --project $PROJECT --account $ACCOUNT
EOF
