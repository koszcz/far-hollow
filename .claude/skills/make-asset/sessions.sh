#!/bin/sh
# Session board for the make-asset skill.
#
# Parallel make-asset sessions run in separate worktrees. This board lets each
# session see what the others are doing without pushing or pulling. It lives in
# the main checkout at .claude/asset-sessions/, which git ignores. Each running
# session owns one file there, named <asset id>.
#
# Usage:
#   sessions.sh list                    Show running sessions. Drops stale ones.
#   sessions.sh claim <id>              Claim an asset. Fails if another session has it.
#   sessions.sh step <id> <text>        Record the step this session is on.
#   sessions.sh files <id> <file>...    Record the shared files this session edits.
#   sessions.sh release <id>            Remove this session's entry.
set -eu

main="$(git rev-parse --path-format=absolute --git-common-dir)/.."
board="$main/.claude/asset-sessions"
here="$(git rev-parse --show-toplevel)"
now="$(date '+%Y-%m-%d %H:%M')"
mkdir -p "$board"

field() { sed -n "s/^$1: //p" "$2"; }

set_field() {
  tmp="$2.tmp"
  grep -v "^$1:" "$2" > "$tmp" || true
  printf '%s: %s\n' "$1" "$3" >> "$tmp"
  grep -v "^updated:" "$tmp" > "$2"
  printf 'updated: %s\n' "$now" >> "$2"
  rm -f "$tmp"
}

need_own() {
  f="$board/$1"
  [ -f "$f" ] || { echo "No entry for '$1'. Run: sessions.sh claim $1" >&2; exit 1; }
  owner="$(field worktree "$f")"
  [ "$owner" = "$here" ] || { echo "'$1' belongs to the session in $owner" >&2; exit 1; }
}

cmd="${1:-list}"
[ $# -gt 0 ] && shift

case "$cmd" in
  list)
    found=0
    for f in "$board"/*; do
      [ -f "$f" ] || continue
      wt="$(field worktree "$f")"
      if [ ! -d "$wt" ]; then
        echo "Dropped stale entry '$(basename "$f")': its worktree is gone."
        rm -f "$f"
        continue
      fi
      found=1
      echo "--- $(basename "$f")"
      cat "$f"
    done
    [ "$found" = 1 ] || echo "No other make-asset sessions are running."
    ;;
  claim)
    id="$1"
    f="$board/$id"
    if [ -f "$f" ]; then
      wt="$(field worktree "$f")"
      if [ "$wt" = "$here" ]; then echo "Already claimed by this session."; exit 0; fi
      if [ -d "$wt" ]; then
        echo "'$id' is taken by the session in $wt:" >&2
        cat "$f" >&2
        exit 1
      fi
      rm -f "$f"
    fi
    # noclobber makes the create atomic, so two sessions cannot both claim.
    if ! ( set -C; printf 'branch: asset/%s\nworktree: %s\nstarted: %s\nstep: 1 pick\nfiles:\nupdated: %s\n' \
        "$id" "$here" "$now" "$now" > "$f" ) 2>/dev/null; then
      echo "Another session claimed '$id' just now." >&2
      exit 1
    fi
    echo "Claimed '$id'."
    ;;
  step)
    id="$1"; shift
    need_own "$id"
    set_field step "$board/$id" "$*"
    ;;
  files)
    id="$1"; shift
    need_own "$id"
    set_field files "$board/$id" "$*"
    ;;
  release)
    id="$1"
    need_own "$id"
    rm -f "$board/$id"
    echo "Released '$id'."
    ;;
  *)
    sed -n '10,15p' "$0" >&2
    exit 1
    ;;
esac
