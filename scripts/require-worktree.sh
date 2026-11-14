#!/bin/sh
# SessionStart hook: tells Claude to move into a worktree when a session starts in the main checkout.
# Claude Code has no setting that starts every session in a worktree, so this hook asks Claude to
# call the EnterWorktree tool before it does anything else. Sessions already in a worktree see nothing.
#
# The hook reads the session's folder from the "cwd" field of its JSON input. It can't use its own
# working folder, because desktop worktree sessions run hooks in the main checkout.

cwd="$(jq -r '.cwd // empty' 2>/dev/null)"
[ -n "$cwd" ] || cwd="$PWD"

git_dir="$(git -C "$cwd" rev-parse --path-format=absolute --git-dir 2>/dev/null)" || exit 0
common_dir="$(git -C "$cwd" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || exit 0

# In a linked worktree, the git folder differs from the shared one.
[ "$git_dir" = "$common_dir" ] || exit 0

cat <<'EOF'
This session started in the main checkout of far-hollow, not in a worktree.
Every session in this repository must work in its own worktree.
Before you read, edit, or run anything else, call the EnterWorktree tool to create a new worktree.
Do not edit files in the main checkout.
EOF
