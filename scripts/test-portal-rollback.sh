#!/usr/bin/env bash
# Tests scripts/portal-rollback.sh against a fake gcloud. No network, no cloud.
# Run: ./scripts/test-portal-rollback.sh
set -uo pipefail
here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
pass=0; fail=0
ok()   { pass=$((pass+1)); }
bad()  { fail=$((fail+1)); echo "FAIL: $*"; }

# Fake gcloud: `run services describe <svc>` prints a fixture from $FIXTURES/<svc>.json.
mkdir -p "$tmp/bin" "$tmp/fx"
cat > "$tmp/bin/gcloud" <<'EOF'
#!/usr/bin/env bash
svc=""
[[ "$1 $2 $3" == "run services describe" ]] && svc="$4"
[[ -n "$svc" && -f "$FIXTURES/$svc.json" ]] && { cat "$FIXTURES/$svc.json"; exit 0; }
echo "fake gcloud: no fixture for: $*" >&2; exit 1
EOF
chmod +x "$tmp/bin/gcloud"
export PATH="$tmp/bin:$PATH" FIXTURES="$tmp/fx"

# Two services: one pinned to a tagged revision at 100%, one with a 0% tagged candidate first
# (the status.traffic[0] trap) and the serving revision second.
cat > "$tmp/fx/manualleaderboardsync.json" <<'EOF'
{"status":{"traffic":[{"revisionName":"manualleaderboardsync-00012-abc","percent":100}]}}
EOF
cat > "$tmp/fx/verifyauthcode.json" <<'EOF'
{"status":{"traffic":[{"revisionName":"verifyauthcode-00020-new","percent":0,"tag":"cand"},
                      {"revisionName":"verifyauthcode-00019-xyz","percent":100}]}}
EOF
cat > "$tmp/fx/sendauthcode.json" <<'EOF'
{"status":{"traffic":[{"revisionName":"sendauthcode-00005-aaa","percent":50},
                      {"revisionName":"sendauthcode-00006-bbb","percent":50}]}}
EOF

# shellcheck source=portal-rollback.sh
source "$here/portal-rollback.sh" || { echo "FAIL: cannot source portal-rollback.sh"; exit 1; }

# 1. Capture picks the 100% revision, not traffic[0], and records fn, service, revision.
out="$tmp/rev.txt"
if portal_capture_revisions lights-out-league-prod us-central1 jhh@example.com "$out" \
     manualLeaderboardSync verifyAuthCode >"$tmp/cap.log" 2>&1; then ok; else bad "capture returned non-zero: $(cat "$tmp/cap.log")"; fi
[[ "$(awk '$1=="verifyAuthCode"{print $3}' "$out")" == "verifyauthcode-00019-xyz" ]] && ok || bad "picked wrong revision: $(cat "$out")"
[[ "$(awk '$1=="manualLeaderboardSync"{print $2}' "$out")" == "manualleaderboardsync" ]] && ok || bad "service name not lowercased: $(cat "$out")"
[[ "$(wc -l <"$out" | tr -d ' ')" == "2" ]] && ok || bad "expected 2 lines, got $(wc -l <"$out")"

# 2. A service with no 100% revision is a hard failure, and the file names the problem.
if portal_capture_revisions lights-out-league-prod us-central1 jhh@example.com "$tmp/rev2.txt" \
     sendAuthCode >"$tmp/cap2.log" 2>&1; then bad "capture should fail when no revision serves 100%"; else ok; fi
grep -q 'sendAuthCode' "$tmp/cap2.log" && ok || bad "failure message does not name the function: $(cat "$tmp/cap2.log")"

# 3. A missing service is a hard failure, not a silent skip.
if portal_capture_revisions lights-out-league-prod us-central1 jhh@example.com "$tmp/rev3.txt" \
     validateInvitationCode >/dev/null 2>&1; then bad "capture should fail on a missing service"; else ok; fi

# 4. Rollback commands: one update-traffic per captured line, exact revision, project, region, account.
cmds="$(portal_rollback_commands lights-out-league-prod us-central1 jhh@example.com "$out")"
[[ "$(grep -c 'gcloud run services update-traffic' <<<"$cmds")" == "2" ]] && ok || bad "expected 2 commands: $cmds"
grep -q -- '--to-revisions verifyauthcode-00019-xyz=100' <<<"$cmds" && ok || bad "revision missing: $cmds"
grep -q -- '--project lights-out-league-prod --region us-central1 --account jhh@example.com' <<<"$cmds" && ok || bad "flags missing: $cmds"
grep -q 'update-traffic verifyauthcode ' <<<"$cmds" && ok || bad "service name missing: $cmds"

# 5. Rollback commands for a subset (only the functions already redeployed).
cmds1="$(portal_rollback_commands lights-out-league-prod us-central1 jhh@example.com "$out" verifyAuthCode)"
[[ "$(grep -c 'update-traffic' <<<"$cmds1")" == "1" ]] && grep -q verifyauthcode <<<"$cmds1" && ok || bad "subset filter failed: $cmds1"

echo "$pass passed, $fail failed"
[[ $fail -eq 0 ]]
