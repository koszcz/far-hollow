#!/bin/sh
# Run board for the ticket skill.
#
# A ticket run implements one spec's tickets, or one ticket, with a subagent per ticket.
# The hollow pipeline panel in Herdr reads this board and shows the run as one card, with
# one line per ticket. The board lives in the main checkout at .claude/ticket-runs/<feature>/,
# which git ignores. The folder holds a file named "run" for the session that leads the run,
# and one file per ticket, named by its number, such as "07".
#
# Usage:
#   status.sh start <feature> <NN>...        Start a run here. Fails if another live session runs it.
#   status.sh phase <feature> <text>         Record what the lead session does, such as "review".
#   status.sh set <feature> <NN> <state> [note]
#                                            Record a ticket's state and a short note.
#   status.sh show <feature>                 Print the run.
#   status.sh end <feature>                  Remove the run.
#
# States: queued, waiting, building, landing, landed, failed, needs-you.
# A subagent that calls `set` from its own worktree records that worktree on its ticket.
set -eu

main="$(git rev-parse --path-format=absolute --git-common-dir)/.."
runs="$main/.claude/ticket-runs"
here="$(git rev-parse --show-toplevel)"
now="$(date '+%Y-%m-%d %H:%M:%S')"

fail() { echo "status: $1" >&2; exit 1; }
field() { sed -n "s/^$1: //p" "$2"; }

# set_field <file> <key> <value>: replace one line, then stamp the file.
set_field() {
  tmp="$1.tmp.$$"
  grep -v -e "^$2:" -e "^updated:" "$1" > "$tmp" || true
  printf '%s: %s\nupdated: %s\n' "$2" "$3" "$now" >> "$tmp"
  mv "$tmp" "$1"
}

cmd="${1:-}"
[ $# -gt 0 ] && shift
feature="${1:-}"
[ -n "$feature" ] || { sed -n '9,18p' "$0" >&2; exit 1; }
shift
dir="$runs/$feature"

case "$cmd" in
  start)
    [ $# -gt 0 ] || fail "name at least one ticket number."
    if [ -f "$dir/run" ]; then
      lead="$(field worktree "$dir/run")"
      if [ "$lead" != "$here" ] && [ -d "$lead" ]; then
        fail "the session in $lead runs '$feature' already."
      fi
      rm -rf "$dir"
    fi
    mkdir -p "$dir"
    printf 'feature: %s\nworktree: %s\nstarted: %s\nphase: starting\nupdated: %s\n' "$feature" "$here" "$now" "$now" > "$dir/run"
    for n in "$@"; do
      printf 'state: queued\nnote:\nworktree:\nupdated: %s\n' "$now" > "$dir/$n"
    done
    echo "Started the run for '$feature': $*"
    ;;
  phase)
    [ -f "$dir/run" ] || fail "no run for '$feature'. Run: status.sh start $feature <NN>..."
    set_field "$dir/run" phase "$*"
    ;;
  set)
    [ -f "$dir/run" ] || fail "no run for '$feature'."
    n="${1:-}"; state="${2:-}"
    [ -n "$n" ] && [ -n "$state" ] || fail "usage: status.sh set <feature> <NN> <state> [note]"
    shift 2
    case "$state" in
      queued|waiting|building|landing|landed|failed|needs-you) ;;
      *) fail "unknown state '$state'." ;;
    esac
    f="$dir/$n"
    [ -f "$f" ] || printf 'state: queued\nnote:\nworktree:\nupdated: %s\n' "$now" > "$f"
    set_field "$f" state "$state"
    set_field "$f" note "$*"
    [ "$here" = "$(field worktree "$dir/run")" ] || set_field "$f" worktree "$here"
    ;;
  show)
    [ -d "$dir" ] || { echo "No run for '$feature'."; exit 0; }
    for f in "$dir"/*; do
      [ -f "$f" ] || continue
      echo "--- $(basename "$f")"
      cat "$f"
    done
    ;;
  end)
    rm -rf "$dir"
    echo "Ended the run for '$feature'."
    ;;
  *)
    sed -n '9,18p' "$0" >&2
    exit 1
    ;;
esac
