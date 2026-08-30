#!/usr/bin/env bash
#
# Rotates the staging Gmail app password held in Secret Manager.
#
# Why this exists as a script rather than a few gcloud calls: the credential must never reach
# the shell history, a process argument list, a file, or an agent transcript. It is read from a
# no-echo prompt, or from a gitignored drop file that is deleted immediately after use, and is
# piped straight to `gcloud secrets versions add --data-file=-`.
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
# Kept in step with deploy-staging.sh — both drive the same firebase-tools.
readonly FIREBASE_CLI_VERSION="15.28.1"
# The redeploy below must run from the repo root, where firebase.json lives, regardless of where
# the script was invoked from.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
# Optional drop file. Matched by the .env.* rule in .gitignore and not in its allowlist, so it
# cannot be committed. Deleted as soon as the new version is stored.
readonly PASS_FILE=".env.staging-email-pass"

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

# Two ways in. The prompt is preferred — nothing ever lands on disk. The drop file exists
# because pasting a 16-character password into a hidden prompt twice is genuinely awkward, and
# a gitignored file deleted seconds later beats the likely alternative of pasting it somewhere
# worse. Either way it never reaches argv or shell history.
if [[ -f "$PASS_FILE" ]]; then
  echo "  reading from $PASS_FILE"
  new_password="$(cat "$PASS_FILE")"
  # Tolerate an EMAIL_PASS=... line as well as a bare password.
  new_password="${new_password#EMAIL_PASS=}"
else
  echo "  no $PASS_FILE found — enter it here instead"
  echo
  # -s so it never echoes; -r so backslashes are literal.
  printf '  New app password (input hidden): '
  read -rs new_password
  echo
  printf '  Confirm: '
  read -rs confirm_password
  echo
  [[ "$new_password" == "$confirm_password" ]] || fail "the two entries did not match"
fi
echo

[[ -n "$new_password" ]] || fail "empty password"

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

# The stored copy has served its purpose. Note this is an ordinary unlink, not a secure erase —
# on a modern SSD that is the honest guarantee available, and it is why the prompt is preferred.
if [[ -f "$PASS_FILE" ]]; then
  rm -f "$PASS_FILE"
  echo "  deleted $PASS_FILE"
fi

# The secrets are declared in functions/index.js with `defineSecret`, and firebase-tools pins the
# exact version that is current at deploy time — the binding is NOT ":latest". Adding a version
# therefore changes nothing until the functions are redeployed.
#
# This must be a `firebase deploy`, not `gcloud run services update`. The latter writes the Cloud
# Run service behind the Cloud Functions v2 API's back and blanks the function's GCF record, after
# which `firebase deploy --only functions` silently stops rebuilding these two functions at all.
# That is what happened between 2026-08-26 and 2026-08-30.
echo
echo "Redeploying both email functions onto the new version..."
( cd "$REPO_ROOT" && env -u DEBUG npx --yes "firebase-tools@$FIREBASE_CLI_VERSION" deploy \
    --only functions:sendAuthCode,functions:sendPasswordResetLink \
    --project "$PROJECT" --non-interactive ) \
  || fail "could not redeploy the email functions onto the new secret version"

for svc in "${EMAIL_SERVICES[@]}"; do
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

data = json.load(sys.stdin)
template = data["spec"]["template"]

# A declared secret shows up as an opaque alias; the real path is in an annotation.
aliases = {}
annotation = template.get("metadata", {}).get("annotations", {}).get("run.googleapis.com/secrets", "")
for pair in filter(None, annotation.split(",")):
    alias, _, path = pair.partition(":")
    aliases[alias] = path.rsplit("/", 1)[-1]

for var in template["spec"]["containers"][0].get("env", []):
    ref = (var.get("valueFrom") or {}).get("secretKeyRef") or {}
    if not ref:
        if "email" in var["name"].lower() or var["name"].startswith("EMAIL_"):
            print(var["name"] + "=PLAINTEXT")
        continue
    name = aliases.get(ref.get("name", ""), ref.get("name", ""))
    version = ref.get("key", "")
    print(var["name"] + "=secret:" + name + (" version " + version if version else ""))
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
