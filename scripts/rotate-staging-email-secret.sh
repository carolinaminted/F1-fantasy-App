#!/usr/bin/env bash
#
# Rotates the staging Gmail app password held in Secret Manager.
#
# Why this exists as a script rather than a few gcloud calls: the credential must never reach
# the shell history, a process argument list, a file, or an agent transcript. It is read from a
# no-echo prompt and piped straight to `gcloud secrets versions add --data-file=-`.
#
# Scope is deliberately staging only. The same Gmail app password is also live in
# formula-fantasy-1 as PLAINTEXT function config, and this script does not touch that. Giving
# staging its own credential is still worth doing on its own: it stops staging sharing
# production's password, so revoking the old one later cannot take staging down with it.
#
# This script does NOT disable the previous version. Email delivery has to be confirmed first,
# or a bad paste leaves staging unable to send with no way back. Disabling is a separate,
# explicit step printed at the end.

set -Eeuo pipefail

readonly PROJECT="formula-fantasy-staging"
readonly ACCOUNT="carolinaminted@gmail.com"
readonly REGION="us-central1"
readonly PASS_SECRET="lol-staging-email-pass"
readonly USER_SECRET="lol-staging-email-user"
readonly EMAIL_SERVICES=(sendauthcode sendpasswordresetlink)

fail() { echo "Rotation aborted: $*" >&2; exit 1; }

[[ $# -eq 0 ]] || fail "this script takes no arguments — the password is read from a prompt, never argv."

command -v gcloud >/dev/null 2>&1 || fail "gcloud is not installed"

echo "Rotating $PASS_SECRET in $PROJECT"
echo
echo "  Generate a NEW Gmail app password first, at:"
echo "    https://myaccount.google.com/apppasswords"
echo
echo "  Do NOT revoke the old one yet. It is still live in formula-fantasy-1 (plaintext),"
echo "  and revoking it now would break production email for real league members."
echo

current_versions="$(gcloud secrets versions list "$PASS_SECRET" \
  --project "$PROJECT" --account "$ACCOUNT" \
  --filter="state=ENABLED" --format="value(name)" 2>/dev/null | tr '\n' ' ')"
echo "  enabled versions before rotation: ${current_versions:-none}"
echo

# -s so it never echoes; -r so backslashes are literal.
printf '  New app password (input hidden): '
read -rs new_password
echo
printf '  Confirm: '
read -rs confirm_password
echo
echo

[[ -n "$new_password" ]] || fail "empty password"
[[ "$new_password" == "$confirm_password" ]] || fail "the two entries did not match"

# Google displays app passwords as four space-separated groups; the credential itself has no
# spaces, and nodemailer will fail to authenticate if they are stored.
stripped="${new_password//[[:space:]]/}"
if [[ "$stripped" != "$new_password" ]]; then
  echo "  note: stripped whitespace (Google displays app passwords in groups of four)"
fi
[[ ${#stripped} -eq 16 ]] || echo "  warning: length is ${#stripped}, expected 16 for a Gmail app password"

printf '%s' "$stripped" | gcloud secrets versions add "$PASS_SECRET" \
  --project "$PROJECT" --account "$ACCOUNT" --data-file=- >/dev/null \
  || fail "could not add a new version of $PASS_SECRET"

new_version="$(gcloud secrets versions list "$PASS_SECRET" \
  --project "$PROJECT" --account "$ACCOUNT" \
  --filter="state=ENABLED" --sort-by=~name --limit=1 --format="value(name)")"
echo "  added $PASS_SECRET version $new_version"

unset new_password confirm_password stripped

# Both functions bind the secret as ":latest", which Cloud Run resolves when an instance starts.
# A warm instance keeps the old value, so force a new revision rather than hoping for a cold start.
echo
echo "Rolling both email functions onto the new version..."
for svc in "${EMAIL_SERVICES[@]}"; do
  gcloud run services update "$svc" \
    --project "$PROJECT" --region "$REGION" --account "$ACCOUNT" \
    --set-secrets "EMAIL_USER=${USER_SECRET}:latest,EMAIL_PASS=${PASS_SECRET}:latest" \
    --quiet >/dev/null || fail "could not roll $svc onto the new secret version"
  revision="$(gcloud run services describe "$svc" \
    --project "$PROJECT" --region "$REGION" --account "$ACCOUNT" \
    --format='value(status.latestCreatedRevisionName)')"
  echo "  $svc -> $revision"
done

echo
echo "Verifying the serving revisions reference the secret..."
for svc in "${EMAIL_SERVICES[@]}"; do
  bound="$(gcloud run services describe "$svc" \
    --project "$PROJECT" --region "$REGION" --account "$ACCOUNT" --format=json \
    | python3 -c '
import json, sys
containers = json.load(sys.stdin)["spec"]["template"]["spec"]["containers"]
for var in containers[0].get("env", []):
    ref = (var.get("valueFrom") or {}).get("secretKeyRef") or {}
    if var["name"].startswith("EMAIL_"):
        print(var["name"] + "=" + ("secret:" + ref.get("name", "") if ref else "PLAINTEXT"))
')"
  echo "$bound" | sed "s/^/  $svc /"
  grep -q 'PLAINTEXT' <<<"$bound" && fail "$svc has a plaintext EMAIL_* value"
done

cat <<EOF

Rotation applied. Version $new_version of $PASS_SECRET is now live in staging.

NEXT — do these in order, and only in this order:

  1. Send a real staging password-reset email and confirm it arrives. Until that
     succeeds, assume the new password is wrong.

  2. Only after delivery is confirmed, disable the previous version:

       gcloud secrets versions disable <old-version> \\
         --secret $PASS_SECRET --project $PROJECT --account $ACCOUNT

     Disabling is reversible (\`versions enable\`); destroying is not. Do not destroy.

  3. Do NOT revoke the old app password in Google Account yet. It is still the live
     credential in formula-fantasy-1, held there as plaintext function config.
     Revoking it now breaks production email for real league members.
EOF
