#!/bin/sh
# Lands the current worktree branch on local main, pushes main, and deletes the branch.
# Run it from a worktree with every change committed: `make land`.
#
# Several sessions land at once, so main can move while the checks run.
# Each try merges main into the branch, runs `make check`, and fast-forwards main.
# If main moved in the meantime, the fast-forward fails and the script tries again.
# On a merge conflict, it stops: resolve the conflict, commit, and run it again.
set -eu

tries=5
branch="$(git branch --show-current)"
main_checkout="$(git rev-parse --path-format=absolute --git-common-dir)/.."

fail() { echo "land: $1" >&2; exit 1; }

[ -n "$branch" ] || fail "no branch is checked out."
[ "$branch" != main ] || fail "run this from a worktree branch, not from main."
[ -z "$(git status --porcelain --untracked-files=no)" ] || fail "commit your changes first."
[ "$(git -C "$main_checkout" branch --show-current)" = main ] || fail "the main checkout is not on main."

try=1
while [ "$try" -le "$tries" ]; do
  echo "land: try $try of $tries"
  # The checks run once below, so skip the pre-merge-commit hook here.
  git merge --no-verify --no-edit main || fail "merge conflict. Resolve it, commit, and run make land again."
  make check || fail "make check failed. Fix it, commit, and run make land again."

  if git -C "$main_checkout" merge --ff-only --quiet "$branch"; then
    git -C "$main_checkout" push origin main
    # The branch is now part of main, so delete it. Git cannot delete the branch
    # this worktree has checked out, so detach the worktree at the same commit first.
    git switch --quiet --detach
    git branch -d "$branch"
    echo "land: $branch is on main, main is pushed, and the branch is deleted."
    echo "land: this worktree is now detached. For more work here, run: git switch -c <new-branch>"
    exit 0
  fi

  if git merge-base --is-ancestor main HEAD; then
    # main did not move, so the fast-forward failed for another reason,
    # such as uncommitted edits in the main checkout to files this branch changes.
    fail "could not fast-forward main in $main_checkout. Check its git status."
  fi
  echo "land: main moved while the checks ran. Trying again."
  try=$((try + 1))
done
fail "main kept moving after $tries tries. Run make land again."
