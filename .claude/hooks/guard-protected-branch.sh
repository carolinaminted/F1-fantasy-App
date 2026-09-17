#!/bin/sh
#
# Claude Code PreToolUse guard: prod and staging are merge-only.
#
# Blocks file edits and mutating git commands while a protected branch is checked
# out, so changes have to be made on a feature branch and merged in. Exits 2 to
# reject the tool call (stderr is fed back to Claude); exits 0 to allow.
#
# Deliberately has no override env var. Humans can override the git hooks in
# .githooks/ with LOL_ALLOW_PROD_EDIT=1; agents cannot override this one.
#
# Registered in .claude/settings.json for Edit|Write|NotebookEdit|Bash.

set -u

# Add a branch here and it is protected everywhere in this script.
PROTECTED="prod staging"

is_protected() {
	for _b in $PROTECTED; do
		[ "$1" = "$_b" ] && return 0
	done
	return 1
}

block() {
	printf '%s\n' "$1" >&2
	exit 2
}

input=$(cat)
[ -n "$input" ] || exit 0

tool=$(printf '%s' "$input" | jq -r '.tool_name // ""')
cwd=$(printf '%s' "$input" | jq -r '.cwd // ""')
[ -n "$cwd" ] || cwd=$(pwd)

repo=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -n "$repo" ] || exit 0
repo=$(cd "$repo" 2>/dev/null && pwd -P) || exit 0

git_dir=$(git -C "$repo" rev-parse --absolute-git-dir 2>/dev/null) || exit 0

# A merge already in progress is, by definition, the sanctioned way onto these
# branches. Resolving conflicts means editing files and running git add/commit on
# the protected branch, so allow the whole operation through.
if [ -e "$git_dir/MERGE_HEAD" ] || [ -e "$git_dir/SQUASH_MSG" ]; then
	exit 0
fi

# Detached HEAD or a rebase yields an empty branch name; nothing to protect.
branch=$(git -C "$repo" symbolic-ref --quiet --short HEAD 2>/dev/null) || branch=""

advice_for() {
	case "$1" in
	prod)
		printf '%s' "\`prod\` is merge-only and must not be edited directly.
It only ever receives a \`staging\` commit already deployed and validated in staging.
 - Releasing? \`git checkout prod && git merge --ff-only staging && git push origin prod\`
 - Making a change? \`git checkout -b feat/... staging\`, commit there, merge into staging first."
		;;
	*)
		printf '%s' "\`staging\` is merge-only and must not be edited directly.
Make the change on a feature branch and merge it back:
  git checkout -b feat/... staging   # then commit there
  git checkout staging && git merge feat/..."
		;;
	esac
}

# ---------------------------------------------------------------------------
# Bash
# ---------------------------------------------------------------------------
if [ "$tool" = "Bash" ]; then
	cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')
	[ -n "$cmd" ] || exit 0
	# Collapse newlines/tabs so the patterns below only deal with spaces.
	cmd=$(printf '%s' "$cmd" | tr '\n\t' '  ')

	# `git`, optionally preceded by a chain operator and followed by -C <path>.
	G='(^|[;&|(]|&&|\|\|)[[:space:]]*git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?(--no-pager[[:space:]]+)?'

	matches() { printf '%s' "$cmd" | grep -Eq "$1"; }

	# --- checks that apply from ANY branch -------------------------------
	if matches "${G}push([[:space:]]|$)"; then
		if matches "${G}push[[:space:]]+(.*[[:space:]])?(-f|--force|--force-with-lease)([[:space:]]|=|$)"; then
			# Only protected branches are off limits — force-pushing a rebased
			# feature branch is normal. Names a protected branch, or pushes the
			# current branch while one is checked out, and it is off limits.
			target_protected=no
			for b in $PROTECTED; do
				if matches "[[:space:]](refs/heads/)?$b([[:space:]]|:|$)" || matches ":(refs/heads/)?$b([[:space:]]|$)"; then
					target_protected=yes
				fi
			done
			is_protected "$branch" && target_protected=yes
			if [ "$target_protected" = yes ]; then
				block "Refusing to force-push: prod and staging must only move forward by merge.
If a protected branch really has to be rewritten, do it yourself in a terminal and say why."
			fi
		fi
		for b in $PROTECTED; do
			if matches "[[:space:]][^[:space:]]*:(refs/heads/)?$b([[:space:]]|$)"; then
				block "Refusing a push that writes \`$b\` from another ref.
$(advice_for "$b")"
			fi
		done
	fi
	for b in $PROTECTED; do
		if matches "${G}branch[[:space:]]+(-[^[:space:]]*[fD][^[:space:]]*|--force|--delete)[[:space:]]+.*\b$b\b"; then
			block "Refusing to force-move or delete \`$b\`.
$(advice_for "$b")"
		fi
	done

	is_protected "$branch" || exit 0

	# --- checks that apply only ON a protected branch --------------------
	if matches "${G}(commit|add|rm|mv|rebase|cherry-pick|revert|reset|apply|am)([[:space:]]|$)" ||
		matches "${G}stash[[:space:]]+(pop|apply|drop)" ||
		matches "${G}restore([[:space:]]|$)" ||
		matches "${G}checkout[[:space:]]+(-[^[:space:]]+[[:space:]]+)*--([[:space:]]|$)"; then
		block "$(advice_for "$branch")

(\`git merge\` and a plain \`git push origin $branch\` are still allowed.)"
	fi
	exit 0
fi

# ---------------------------------------------------------------------------
# Edit / Write / NotebookEdit
# ---------------------------------------------------------------------------
is_protected "$branch" || exit 0

path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // ""')
[ -n "$path" ] || exit 0
case "$path" in
/*) ;;
*) path="$cwd/$path" ;;
esac

dir=$(dirname "$path")
base=$(basename "$path")
resolved_dir=$(cd "$dir" 2>/dev/null && pwd -P) || resolved_dir="$dir"
path="$resolved_dir/$base"

# Only the repo work tree is protected — scratchpad, ../lol-docs and ~/.claude
# stay writable so notes and docs work continue.
case "$path" in
"$repo"/*)
	block "$(advice_for "$branch")

Refused to write ${path#"$repo"/} while \`$branch\` is checked out."
	;;
esac

exit 0
