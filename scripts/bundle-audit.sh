#!/usr/bin/env bash
#
# Audits what a deployed Lights Out League frontend actually serves.
#
# This exists because a local bundle audit does not transfer. Docker runs a fresh `npm ci` and
# resolves a slightly different dependency tree, so local and Cloud Build asset hashes never
# match. The only artifact worth auditing is the one the URL is really serving.
#
# Usage: bundle-audit.sh <url> [--expect-string <s>]
#
# Exit 0 if every check passes, 1 otherwise. Every check prints its own line either way.

set -Eeuo pipefail

url="${1:-}"
shift || true
expect_string=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expect-string) expect_string="${2:-}"; shift 2 ;;
    *) echo "bundle-audit: unsupported argument '$1'" >&2; exit 1 ;;
  esac
done

[[ -n "$url" ]] || { echo "Usage: bundle-audit.sh <url> [--expect-string <s>]" >&2; exit 1; }
url="${url%/}"

failures=0

pass() { printf '    [ok]   %s\n' "$1"; }
flunk() { printf '    [FAIL] %s\n' "$1"; failures=$((failures + 1)); }

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

echo "  Auditing $url"

status="$(curl -sS -o "$workdir/index.html" -D "$workdir/headers.txt" -w '%{http_code}' "$url/" || echo 000)"
if [[ "$status" == "200" ]]; then
  pass "HTTP 200"
else
  flunk "HTTP $status (expected 200)"
  echo "  audit aborted: the URL did not serve a page" >&2
  exit 1
fi

# Staging and prod-staging must never be indexable. nginx.conf sets this header, and the
# production build is the only one that strips it.
if grep -qi '^x-robots-tag:[[:space:]]*noindex, nofollow, noarchive' "$workdir/headers.txt"; then
  pass "X-Robots-Tag: noindex, nofollow, noarchive"
else
  flunk "X-Robots-Tag missing or wrong: $(grep -i '^x-robots-tag:' "$workdir/headers.txt" | tr -d '\r' || echo '(absent)')"
fi

# The env config is inlined into the main chunk at build time, so the chunk is what has to be
# audited — not index.html, which is nearly identical across every build mode.
main_js="$(grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' "$workdir/index.html" | head -1 || true)"
if [[ -z "$main_js" ]]; then
  flunk "could not find /assets/index-*.js in index.html"
  exit 1
fi
pass "main chunk $main_js"

curl -sS -o "$workdir/main.js" "${url}${main_js}" || { flunk "could not fetch $main_js"; exit 1; }
cat "$workdir/index.html" "$workdir/main.js" > "$workdir/all.txt"

check_present() {
  local needle="$1" label="$2"
  if grep -qF "$needle" "$workdir/all.txt"; then pass "$label"; else flunk "$label — '$needle' not found"; fi
}

check_present "formula-fantasy-1" "production Firebase project present"
check_present "PROD STAGING" "env label is PROD STAGING"
check_present "us-central1-lights-out-league-prod" "callables point at lights-out-league-prod"

# `grep` exits 1 when it finds nothing, which here is the PASSING case — without the guard
# `set -o pipefail` aborts the audit exactly when the bundle is clean.
leak_count="$( { grep -oF "formula-fantasy-staging" "$workdir/all.txt" || true; } | wc -l | tr -d ' ')"
if [[ "$leak_count" == "0" ]]; then
  pass "no staging leakage (0 occurrences of formula-fantasy-staging)"
else
  flunk "staging leakage: $leak_count occurrences of formula-fantasy-staging"
fi

# Match an ASSIGNMENT, never the bare name. The Firebase Auth SDK ships the literal string
# EMAIL_PASSWORD_PROVIDER, which matches an `EMAIL_PASS` prefix search and looks exactly like a
# leaked credential. That false positive cost real time on 2026-08-26.
if grep -qE 'EMAIL_(USER|PASS)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"']+["'"'"']' "$workdir/all.txt"; then
  flunk "possible credential ASSIGNMENT in the bundle — inspect before promoting"
else
  pass "no credential assignments in the bundle"
fi

if [[ -n "$expect_string" ]]; then
  check_present "$expect_string" "release-unique string present"
fi

echo
if [[ "$failures" -eq 0 ]]; then
  echo "  Bundle audit passed."
else
  echo "  Bundle audit FAILED: $failures check(s)." >&2
fi
exit $(( failures > 0 ? 1 : 0 ))
