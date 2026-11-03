#!/usr/bin/env bash
#
# Deploys firestore.rules and firestore.indexes.json to formula-fantasy-1, the production data
# plane. Built for [ROLL-11]: the season-rollover release reads `season_config/current` and the
# season archives, and production has never served the rules that allow it.
#
# Production. Every run needs explicit approval, on a weekday between race weekends.
#
# A rules deploy REPLACES the whole ruleset — there is no additive mode — so this script treats the
# live ruleset as something it might be about to destroy: it saves a copy to .backups/ before
# deploying, shows the diff, and refuses to deploy rules that staging is not already serving.
# Rollback is `firebase deploy --only firestore:rules` from the saved copy; the script prints
# the exact command.

set -Eeuo pipefail

readonly PROD_FIREBASE_PROJECT="formula-fantasy-1"
readonly PROD_FIREBASE_ALIAS="prod"
readonly PROD_ACCOUNT="carolinaminted@gmail.com"
# The rehearsal environment. Rules reach production only after staging has served them, the same
# way code reaches `prod` only after staging has run it.
readonly STAGING_FIREBASE_PROJECT="formula-fantasy-staging"
readonly RELEASE_BRANCH="prod"
# Pinned to what deploy-staging.sh uses, so the two environments are deployed by the same CLI.
readonly FIREBASE_CLI_VERSION="15.28.1"
readonly BACKUP_DIR=".backups"

usage() {
  cat <<'EOF'
Usage: ./deploy-prod-rules.sh [--dry-run]

Deploys ONLY firestore.rules and firestore.indexes.json to formula-fantasy-1 (production).

Runs from `prod` at origin/prod, with both release gates on the tip, and only when
formula-fantasy-staging is already serving the committed firestore.rules.

  --dry-run  Run every local and read-only check (including the live diff), then stop
             before changing anything.
EOF
}

fail() {
  echo "Prod rules deploy blocked: $*" >&2
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

for required_command in node npx gcloud git curl python3 diff; do
  command -v "$required_command" >/dev/null 2>&1 || fail "required command is not installed: $required_command"
done

# --- Targets -------------------------------------------------------------------------------------

node -e '
  const config = JSON.parse(require("node:fs").readFileSync(".firebaserc", "utf8"));
  if (config.projects?.[process.argv[2]] !== process.argv[1]) {
    console.error(`Prod rules deploy blocked: .firebaserc ${process.argv[2]} alias is "${config.projects?.[process.argv[2]] ?? "missing"}".`);
    process.exit(1);
  }
' "$PROD_FIREBASE_PROJECT" "$PROD_FIREBASE_ALIAS"

[[ -f firestore.rules ]] || fail "firestore.rules is missing"
[[ -f firestore.indexes.json ]] || fail "firestore.indexes.json is missing"
node -e 'JSON.parse(require("node:fs").readFileSync("firestore.indexes.json", "utf8"))' \
  || fail "firestore.indexes.json is not valid JSON"

# --- Source --------------------------------------------------------------------------------------

git fetch --quiet origin "$RELEASE_BRANCH" || fail "could not fetch origin/$RELEASE_BRANCH"
current_branch="$(git rev-parse --abbrev-ref HEAD)"
head_sha="$(git rev-parse HEAD)"
prod_sha="$(git rev-parse "origin/$RELEASE_BRANCH")"

# firebase-tools deploys the files as they are on disk, so anything uncommitted ships under a
# commit that does not describe it.
[[ -z "$(git status --porcelain -- firestore.rules firestore.indexes.json)" ]] \
  || fail "firestore.rules or firestore.indexes.json has uncommitted changes. Production deploys only committed files."
[[ "$current_branch" == "$RELEASE_BRANCH" ]] \
  || fail "must run from '$RELEASE_BRANCH', not '$current_branch'"
[[ "$head_sha" == "$prod_sha" ]] \
  || fail "local prod ($head_sha) is not origin/prod ($prod_sha). Pull or push first."

./scripts/release-gates.sh check "$head_sha" local-verified staging-verified \
  || fail "${head_sha:0:7} has not cleared the local and staging release gates"

echo "Prod rules deployment targets locked:"
echo "  Firebase project: $PROD_FIREBASE_PROJECT (alias $PROD_FIREBASE_ALIAS, account $PROD_ACCOUNT)"
echo "  Files:            firestore.rules, firestore.indexes.json"
echo "  Source:           $current_branch @ ${head_sha:0:7}"
echo "  Rehearsed in:     $STAGING_FIREBASE_PROJECT"
echo

# --- Live state ----------------------------------------------------------------------------------

# Writes the Firestore ruleset that project $1 is currently serving to $2.
#
# Same approach as deploy-staging.sh. The `x-goog-user-project` header is required: without it
# the Rules API rejects the call against gcloud's shared ADC quota project and returns
# 403 SERVICE_DISABLED, which reads like a permission problem but is not one.
fetch_live_rules() {
  local project="$1" out_file="$2"
  local token releases ruleset_name

  token="$(env -u DEBUG gcloud auth print-access-token --account "$PROD_ACCOUNT" 2>/dev/null || true)"
  [[ -n "$token" ]] || fail "could not obtain an access token for $PROD_ACCOUNT (gcloud auth login --account $PROD_ACCOUNT)"

  releases="$(curl -sS \
    -H "Authorization: Bearer $token" \
    -H "x-goog-user-project: $project" \
    "https://firebaserules.googleapis.com/v1/projects/${project}/releases")"

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
  [[ -n "$ruleset_name" ]] || fail "could not resolve the live Firestore ruleset for $project"

  curl -sS \
    -H "Authorization: Bearer $token" \
    -H "x-goog-user-project: $project" \
    "https://firebaserules.googleapis.com/v1/${ruleset_name}" \
    | python3 -c '
import json, sys

data = json.load(sys.stdin)
files = data.get("source", {}).get("files", [])
if not files:
    sys.exit(1)
sys.stdout.write(files[0]["content"])
' > "$out_file" || fail "could not fetch the source of ruleset $ruleset_name"

  [[ -s "$out_file" ]] || fail "the live Firestore ruleset of $project came back empty"
}

rules_workdir="$(mktemp -d)"
trap 'rm -rf "$rules_workdir"' EXIT

# The rehearsal gate. `staging-verified` proves staging serves this commit's web image; it says
# nothing about rules, which deploy-staging.sh ships in a separate step. Check them directly.
echo "Checking that $STAGING_FIREBASE_PROJECT is serving firestore.rules..."
fetch_live_rules "$STAGING_FIREBASE_PROJECT" "$rules_workdir/staging-live.rules"
if ! diff -u "$rules_workdir/staging-live.rules" firestore.rules >/dev/null 2>&1; then
  echo >&2
  echo "Prod rules deploy blocked: staging is not serving the committed firestore.rules." >&2
  echo "  Deploy and validate them in staging first (./deploy-staging.sh from the same commit)." >&2
  echo "  ('-' is staging live, '+' is the repo file.)" >&2
  diff -u "$rules_workdir/staging-live.rules" firestore.rules >&2 || true
  exit 1
fi
echo "  staging is serving the committed rules"

echo
echo "Checking the live PRODUCTION ruleset..."
fetch_live_rules "$PROD_FIREBASE_PROJECT" "$rules_workdir/prod-live-before.rules"

mkdir -p "$BACKUP_DIR"
backup_file="$BACKUP_DIR/firestore-rules-${PROD_FIREBASE_PROJECT}-$(date -u +%Y-%m-%dT%H-%M-%SZ).rules"
cp "$rules_workdir/prod-live-before.rules" "$backup_file"
echo "  live ruleset saved to $backup_file (rollback handle)"

if diff -u "$rules_workdir/prod-live-before.rules" firestore.rules >/dev/null 2>&1; then
  echo "  production already serves firestore.rules exactly; the deploy would be a no-op"
  rules_changed=false
else
  rules_changed=true
  echo
  echo "  The live production ruleset differs from firestore.rules. The deploy REPLACES it with"
  echo "  the repo file. Review every '-' line: any rule not in the repo is about to be removed."
  echo "  ('-' is production live, '+' is the repo file.)"
  echo
  diff -u "$rules_workdir/prod-live-before.rules" firestore.rules | sed 's/^/    /' || true
fi

if [[ "$dry_run" == true ]]; then
  echo
  echo "Dry run passed. No cloud resources were changed."
  exit 0
fi

echo
echo "This deploys Firestore rules and indexes to PRODUCTION ($PROD_FIREBASE_PROJECT),"
echo "the live member data plane. Type the project ID to continue:"
read -r confirmation </dev/tty
[[ "$confirmation" == "$PROD_FIREBASE_PROJECT" ]] || fail "confirmation did not match; nothing was changed"

# --- Deploy --------------------------------------------------------------------------------------

echo
echo "Deploying production Firestore rules and indexes..."
# No --force, deliberately. Under --non-interactive firebase-tools only *warns* about indexes
# present in the project but absent from firestore.indexes.json; --force is precisely what turns
# that warning into a deletion. This step must never be able to drop an index someone else made.
env -u DEBUG npx --yes "firebase-tools@$FIREBASE_CLI_VERSION" deploy \
  --only firestore \
  --project "$PROD_FIREBASE_PROJECT" \
  --non-interactive

# `firebase deploy` exiting 0 is not proof the project is serving this file. Confirm it directly.
echo
echo "Verifying the live production ruleset matches firestore.rules..."
fetch_live_rules "$PROD_FIREBASE_PROJECT" "$rules_workdir/prod-live-after.rules"

if ! diff -u "$rules_workdir/prod-live-after.rules" firestore.rules >/dev/null 2>&1; then
  echo >&2
  echo "Prod rules deploy FAILED verification: the firestore deploy reported success, but" >&2
  echo "$PROD_FIREBASE_PROJECT is not serving firestore.rules." >&2
  echo "  ('-' is live, '+' is the repo file it should match.)" >&2
  diff -u "$rules_workdir/prod-live-after.rules" firestore.rules >&2 || true
  echo >&2
  echo "The pre-deploy ruleset is in $backup_file." >&2
  exit 1
fi
echo "  live ruleset verified"

./scripts/release-gates.sh record rules-deployed "$head_sha" \
  "project=$PROD_FIREBASE_PROJECT changed=$rules_changed backup=$backup_file" \
  || echo "  (could not record the deploy note; add it with ./scripts/release-gates.sh record)"

cat <<EOF

Done. $PROD_FIREBASE_PROJECT serves firestore.rules from ${head_sha:0:7}.

Rollback (restores the pre-deploy ruleset, rules only, no index changes):
  cp "$backup_file" firestore.rules
  env -u DEBUG npx --yes firebase-tools@$FIREBASE_CLI_VERSION deploy --only firestore:rules \\
    --project $PROD_FIREBASE_PROJECT --non-interactive
  git checkout -- firestore.rules

Close out work items with: node scripts/release-work-items.mjs
EOF
