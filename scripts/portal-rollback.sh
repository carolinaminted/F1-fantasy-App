#!/usr/bin/env bash
# Sourced by deploy-portal.sh. Records which Cloud Run revision each portal callable is serving
# before a deploy, and prints the traffic-shift commands that put them back.
#
# Why this exists: deploy-portal.sh's built-in rollback is "rerun from an earlier gated prod
# commit". The script depends on functions/deploy-targets.js, which first reaches `prod` with the
# October 2026 release, so for that release no earlier prod commit can run the script. Cloud
# Functions gen2 are Cloud Run services underneath and keep their old revisions, so shifting
# traffic back is the rollback that always works. It takes seconds and rebuilds nothing.
#
# Caveat, deliberate: after a traffic-shift rollback the GCF record still names the new revision,
# so `gcloud functions describe` and deploy-portal.sh's own verify step will report a mismatch
# until the next real deploy. That is the expected state of a rolled-back function, not a fault.
#
# Tests: scripts/test-portal-rollback.sh (fake gcloud, no cloud).

# portal_capture_revisions <project> <region> <account> <outfile> <function>...
# Writes one line per function: "<function> <cloud-run-service> <revision serving 100%>".
# Fails if any function has no single revision at 100%: a split or missing service is not a
# state this file can restore, and must be looked at before deploying over it.
portal_capture_revisions() {
  local project="$1" region="$2" account="$3" outfile="$4"; shift 4
  local fn svc rev failed=false
  : > "$outfile"
  for fn in "$@"; do
    svc="$(printf '%s' "$fn" | tr '[:upper:]' '[:lower:]')"
    rev="$(env -u DEBUG gcloud run services describe "$svc" \
      --project "$project" --region "$region" --account "$account" --format=json 2>/dev/null \
      | python3 -c '
import json, sys
try:
    traffic = json.load(sys.stdin).get("status", {}).get("traffic", [])
except ValueError:
    sys.exit(1)
# Never traffic[0]: tagged 0% revisions sort first. Select on percent.
serving = [t.get("revisionName", "") for t in traffic if t.get("percent") == 100]
if len(serving) != 1 or not serving[0]:
    sys.exit(1)
print(serving[0])
')" || rev=""
    if [[ -z "$rev" ]]; then
      echo "  $fn: no single revision serving 100% of $svc (missing service, or split traffic); cannot record a rollback point" >&2
      failed=true
      continue
    fi
    printf '%s %s %s\n' "$fn" "$svc" "$rev" >> "$outfile"
    echo "  $fn: serving $rev"
  done
  [[ "$failed" == false ]]
}

# portal_rollback_commands <project> <region> <account> <file> [<function>...]
# Prints one `gcloud run services update-traffic` per recorded function, or only for the
# functions named, so a partial deploy can print the commands for exactly what it changed.
portal_rollback_commands() {
  local project="$1" region="$2" account="$3" file="$4"; shift 4
  local only=("$@") fn svc rev want
  while read -r fn svc rev; do
    [[ -n "$fn" ]] || continue
    if [[ ${#only[@]} -gt 0 ]]; then
      want=false
      for f in "${only[@]}"; do [[ "$f" == "$fn" ]] && want=true; done
      [[ "$want" == true ]] || continue
    fi
    printf 'gcloud run services update-traffic %s --to-revisions %s=100 --project %s --region %s --account %s\n' \
      "$svc" "$rev" "$project" "$region" "$account"
  done < "$file"
}
