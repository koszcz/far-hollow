#!/bin/sh
# Claude Code hook: formats a code file right after an agent edits or writes it.
# Without it, commits fail on the pre-commit format check and agents spend a round fixing them.
# Wired up as a PostToolUse hook in .claude/settings.json. It reads the tool call as JSON on stdin.
file="$(jq -r '.tool_input.file_path // empty')"
case "$file" in
  *.ts | *.tsx | *.js | *.mjs | *.css | *.html) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
bun fmt "$file" >/dev/null 2>&1 || true
