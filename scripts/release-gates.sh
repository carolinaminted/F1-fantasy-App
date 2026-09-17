#!/usr/bin/env bash
#
# Release gates for the feature -> staging -> prod -> prod-staging pipeline.
#
# Two kinds of gate live here, and the difference matters:
#
#   OBJECTIVE  - machine-checkable against live infrastructure. "Is this exact commit the one
#                Cloud Run is serving right now?" Nobody has to be trusted for this.
#   ATTESTED   - a human says they looked at it in a browser. There are no automated functional
#                tests in this repo, so correctness gates are eyeballs. This file records who
#                said what and when. It cannot know whether you actually looked, and it does
#                not pretend to.
#
# Records live in git notes on refs/notes/release-gates, keyed to the commit SHA, so the record
# survives a fresh clone and shows up in `git log --notes=release-gates`.
#
# Usage:
#   release-gates.sh sign local|staging|candidate [<ref>]
#   release-gates.sh check <ref> <gate>...
#   release-gates.sh show <ref>
#   release-gates.sh serving staging|prod-staging <ref>

set -Eeuo pipefail

readonly NOTES_REF="refs/notes/release-gates"

readonly STAGING_PROJECT="formula-fantasy-staging"
readonly STAGING_SERVICE="lights-out-league-staging"
readonly STAGING_ACCOUNT="carolinaminted@gmail.com"
readonly STAGING_REGISTRY="us-west1-docker.pkg.dev/formula-fantasy-staging/cloud-run-source-deploy/lights-out-league-staging"
readonly STAGING_TAG_PREFIX="staging-"

readonly PRODSTAGING_PROJECT="lights-out-league-prod"
readonly PRODSTAGING_SERVICE="lights-out-league-web"
readonly PRODSTAGING_ACCOUNT="jhh@carolinaminted.net"
readonly PRODSTAGING_REGISTRY="us-west1-docker.pkg.dev/lights-out-league-prod/lol-web/lights-out-league-web"
readonly PRODSTAGING_TAG_PREFIX="prod-"

readonly REGION="us-west1"

# Exit codes carry meaning for callers, especially the pre-push hook:
#   0  gate satisfied
#   1  gate conclusively NOT satisfied  -> safe to block on
#   3  could not determine              -> must NOT block on
readonly EXIT_UNKNOWN=3

gates_die() { echo "release-gates: $*" >&2; exit 1; }

gates_repo_root() { git rev-parse --show-toplevel 2>/dev/null || pwd; }

# ---------------------------------------------------------------------------
# git notes plumbing
# ---------------------------------------------------------------------------

# Notes are not fetched or pushed by default. Both directions are best-effort: an offline
# machine must still be able to read whatever notes it already has.
gates_fetch_notes() {
  git fetch --quiet origin "+${NOTES_REF}:${NOTES_REF}" 2>/dev/null || true
}

gates_push_notes() {
  if ! git push --quiet origin "${NOTES_REF}" 2>/dev/null; then
    echo "  NOTE: could not push $NOTES_REF to origin (offline?). The record is local only."
    echo "        Push it later with: git push origin $NOTES_REF"
  fi
}

gates_notes_body() {
  git notes --ref="$NOTES_REF" show "$1" 2>/dev/null || true
}

gates_has() {
  local sha="$1" gate="$2"
  gates_notes_body "$sha" | grep -q "^${gate}:"
}

gates_append() {
  local sha="$1" line="$2"
  git notes --ref="$NOTES_REF" append -m "$line" "$sha"
}

# A non-fast-forward merge rewrites the commit, orphaning notes attached to the original. The
# tree is usually identical, so say that plainly instead of demanding a re-sign with no reason.
gates_explain_missing() {
  local sha="$1" gate="$2"
  local tree twin
  tree="$(git rev-parse "${sha}^{tree}" 2>/dev/null || true)"
  [[ -n "$tree" ]] || return 0

  while read -r candidate; do
    [[ -n "$candidate" ]] || continue
    [[ "$candidate" != "$sha" ]] || continue
    if [[ "$(git rev-parse "${candidate}^{tree}" 2>/dev/null || true)" == "$tree" ]] \
       && gates_has "$candidate" "$gate"; then
      twin="$candidate"
      break
    fi
  done < <(git rev-list --max-count=200 HEAD 2>/dev/null || true)

  if [[ -n "${twin:-}" ]]; then
    echo "        (commit ${twin:0:7} has the identical tree and IS signed for '$gate' —" >&2
    echo "         this commit was probably rewritten by a non-fast-forward merge, so the" >&2
    echo "         note did not follow. Re-sign it.)" >&2
  fi
}

# ---------------------------------------------------------------------------
# objective checks
# ---------------------------------------------------------------------------

# The revision receiving 100% of traffic. NEVER read status.traffic[0]: a tagged 0%-traffic
# revision sorts first, so indexing gives you the wrong answer on exactly the services where
# it matters. Same selector deploy-staging.sh uses.
gates_serving_revision() {
  local project="$1" service="$2" account="$3"
  env -u DEBUG gcloud run services describe "$service" \
    --project "$project" --region "$REGION" --account "$account" \
    --format=json 2>/dev/null | python3 -c '
import json, sys

try:
    data = json.load(sys.stdin)
except ValueError:
    sys.exit(1)
for entry in data.get("status", {}).get("traffic", []):
    if entry.get("percent") == 100:
        print(entry.get("revisionName", ""))
        break
'
}

gates_revision_image() {
  local project="$1" account="$2" revision="$3"
  env -u DEBUG gcloud run revisions describe "$revision" \
    --project "$project" --region "$REGION" --account "$account" \
    --format='value(spec.containers[0].image)' 2>/dev/null
}

gates_tags_for_digest() {
  local registry="$1" account="$2" digest="$3"
  env -u DEBUG gcloud artifacts docker images list "$registry" \
    --account "$account" --include-tags \
    --filter="version=${digest}" --format="value(tags)" 2>/dev/null
}

# Resolve tag -> commit, never commit -> tag. `git rev-parse --short` is variable width (git
# lengthens it as the repo grows), so building the expected tag string and matching on it breaks
# silently the day the abbreviation changes. Reading the tag and resolving it back through git
# compares full SHAs and cannot drift.
gates_serving_commit() {
  local env_name="$1"
  local project service account registry prefix

  case "$env_name" in
    staging)
      project="$STAGING_PROJECT"; service="$STAGING_SERVICE"; account="$STAGING_ACCOUNT"
      registry="$STAGING_REGISTRY"; prefix="$STAGING_TAG_PREFIX" ;;
    prod-staging)
      project="$PRODSTAGING_PROJECT"; service="$PRODSTAGING_SERVICE"; account="$PRODSTAGING_ACCOUNT"
      registry="$PRODSTAGING_REGISTRY"; prefix="$PRODSTAGING_TAG_PREFIX" ;;
    *) gates_die "unknown environment '$env_name' (expected staging or prod-staging)" ;;
  esac

  command -v gcloud >/dev/null 2>&1 || return "$EXIT_UNKNOWN"

  local revision image digest tags tag candidate
  revision="$(gates_serving_revision "$project" "$service" "$account" || true)"
  [[ -n "$revision" ]] || return "$EXIT_UNKNOWN"

  image="$(gates_revision_image "$project" "$account" "$revision" || true)"
  digest="${image##*@}"
  [[ "$digest" == sha256:* ]] || return "$EXIT_UNKNOWN"

  tags="$(gates_tags_for_digest "$registry" "$account" "$digest" || true)"
  [[ -n "$tags" ]] || return "$EXIT_UNKNOWN"

  for tag in ${tags//,/ }; do
    case "$tag" in
      "${prefix}"*) ;;
      *) continue ;;
    esac
    candidate="$(git rev-parse --verify --quiet "${tag#"$prefix"}^{commit}" 2>/dev/null || true)"
    if [[ -n "$candidate" ]]; then
      printf '%s %s %s\n' "$candidate" "$revision" "$digest"
      return 0
    fi
  done

  return "$EXIT_UNKNOWN"
}

# 0 = this commit is serving, 1 = something else is serving, 3 = could not determine.
gates_is_serving() {
  local env_name="$1" ref="$2"
  local want result rc
  want="$(git rev-parse --verify "${ref}^{commit}")"

  set +e
  result="$(gates_serving_commit "$env_name")"
  rc=$?
  set -e
  [[ $rc -eq 0 ]] || return "$EXIT_UNKNOWN"

  read -r got revision digest <<<"$result"
  if [[ "$got" == "$want" ]]; then
    printf '%s %s\n' "$revision" "$digest"
    return 0
  fi
  printf '%s %s %s\n' "$revision" "$digest" "$got"
  return 1
}

# ---------------------------------------------------------------------------
# subcommands
# ---------------------------------------------------------------------------

gates_confirm() {
  local prompt="$1"
  if [[ ! -t 0 ]]; then
    gates_die "refusing to record an attestation non-interactively — a human has to answer this"
  fi
  local reply
  read -r -p "$prompt [y/N] " reply
  [[ "$reply" == "y" || "$reply" == "Y" ]] || gates_die "not confirmed; nothing recorded"
}

cmd_sign() {
  local kind="${1:-}" ref="${2:-HEAD}"
  [[ -n "$kind" ]] || gates_die "usage: release-gates.sh sign local|staging|candidate [<ref>]"

  local sha short who now
  sha="$(git rev-parse --verify "${ref}^{commit}")"
  short="$(git rev-parse --short "$sha")"
  who="$(git config user.email 2>/dev/null || echo unknown)"
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  gates_fetch_notes

  case "$kind" in
    local)
      echo "Signing LOCAL verification of ${short} — $(git log -1 --format=%s "$sha")"
      echo
      echo "  This is an attestation, not a check. Nothing here can tell whether you ran the"
      echo "  app. Confirm only if you ran it locally and looked at the change in a browser:"
      echo "    npm run dev -- --mode staging"
      echo
      gates_confirm "Did you verify ${short} locally in a browser?"
      gates_append "$sha" "local-verified: ${now} by ${who}"
      ;;

    staging)
      echo "Checking whether staging is actually serving ${short}..."
      local out rc
      set +e
      out="$(gates_is_serving staging "$sha")"
      rc=$?
      set -e

      case $rc in
        0)
          read -r revision digest <<<"$out"
          echo "  staging serves ${short} — revision ${revision}"
          echo
          gates_confirm "Did you verify ${short} on https://f1.staging.carolinaminted.net ?"
          gates_append "$sha" "staging-verified: ${now} by ${who} revision=${revision} digest=${digest}"
          ;;
        1)
          read -r revision digest other <<<"$out"
          gates_die "staging is NOT serving ${short}.
  serving revision: ${revision}
  which is commit:  ${other:0:7}
  Deploy this commit to staging first: ./deploy-staging.sh"
          ;;
        *)
          gates_die "could not determine what staging is serving (gcloud missing, offline, or
  credentials expired). Refusing to record a staging sign-off that was not verified."
          ;;
      esac
      ;;

    candidate)
      echo "Signing CANDIDATE verification of ${short} on prod-staging."
      echo
      echo "  The candidate revision receives no traffic, but prod-staging reads and writes"
      echo "  PRODUCTION Firestore (formula-fantasy-1). Picks, profile edits and admin saves"
      echo "  made while smoke-testing are real writes to real member data."
      echo
      gates_confirm "Did you smoke-test ${short} on the candidate URL?"
      gates_append "$sha" "candidate-verified: ${now} by ${who}"
      ;;

    *) gates_die "unknown gate '$kind' (expected local, staging or candidate)" ;;
  esac

  gates_push_notes
  echo "  recorded."
}

cmd_check() {
  local ref="${1:-}"; shift || true
  [[ -n "$ref" && $# -gt 0 ]] || gates_die "usage: release-gates.sh check <ref> <gate>..."
  local sha; sha="$(git rev-parse --verify "${ref}^{commit}")"
  gates_fetch_notes
  local gate status=0
  for gate in "$@"; do
    if ! gates_has "$sha" "$gate"; then
      echo "  missing gate '$gate' for ${sha:0:7}" >&2
      gates_explain_missing "$sha" "$gate"
      status=1
    fi
  done
  return $status
}

cmd_show() {
  local ref="${1:-HEAD}" sha short
  sha="$(git rev-parse --verify "${ref}^{commit}")"
  short="$(git rev-parse --short "$sha")"
  gates_fetch_notes

  echo "Release gates for ${short} — $(git log -1 --format=%s "$sha")"
  echo
  local gate label
  for gate in local-verified staging-verified candidate-verified promoted; do
    if gates_has "$sha" "$gate"; then
      label="$(gates_notes_body "$sha" | grep "^${gate}:" | head -1)"
      echo "  [x] ${label}"
    else
      echo "  [ ] ${gate}"
    fi
  done

  echo
  local out rc
  set +e
  out="$(gates_is_serving staging "$sha")"; rc=$?
  set -e
  case $rc in
    0) read -r revision _ <<<"$out"; echo "  staging:      SERVING this commit (${revision})" ;;
    1) read -r revision _ other <<<"$out"; echo "  staging:      serving ${other:0:7} (${revision}) — NOT this commit" ;;
    *) echo "  staging:      could not determine" ;;
  esac

  set +e
  out="$(gates_is_serving prod-staging "$sha")"; rc=$?
  set -e
  case $rc in
    0) read -r revision _ <<<"$out"; echo "  prod-staging: SERVING this commit (${revision})" ;;
    1) read -r revision _ other <<<"$out"; echo "  prod-staging: serving ${other:0:7} (${revision}) — NOT this commit" ;;
    *) echo "  prod-staging: could not determine" ;;
  esac
}

cmd_serving() {
  local env_name="${1:-}" ref="${2:-HEAD}"
  [[ -n "$env_name" ]] || gates_die "usage: release-gates.sh serving staging|prod-staging <ref>"
  local out rc
  set +e
  out="$(gates_is_serving "$env_name" "$ref")"; rc=$?
  set -e
  case $rc in
    0) read -r revision digest <<<"$out"; echo "serving ${revision} ${digest}" ;;
    1) read -r revision digest other <<<"$out"; echo "not-serving ${revision} ${digest} ${other}" ;;
    *) echo "unknown" ;;
  esac
  return $rc
}

main() {
  cd "$(gates_repo_root)"
  local cmd="${1:-}"; shift || true
  case "$cmd" in
    sign)    cmd_sign "$@" ;;
    check)   cmd_check "$@" ;;
    show)    cmd_show "$@" ;;
    serving) cmd_serving "$@" ;;
    ""|-h|--help)
      sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
      ;;
    *) gates_die "unknown command '$cmd'" ;;
  esac
}

# Only run when executed, so the deploy scripts can source this for its functions.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
