# Shortcuts for the Bun scripts in package.json.
# Run `make` on its own to start the dev server.

.PHONY: run test e2e check fmt fix build drafts approve shot land

run:
	bun run dev

test:
	bun run test

e2e:
	bun run test:e2e

check:
	bun run typecheck && bun run format:check && bun run lint && bun run test && bun run check:assets

# Format the code in place.
fmt:
	bun fmt

# Format the code and fix the lint errors that have a safe fix. Run it before you commit.
fix:
	bun fmt && bun run lint --fix

build:
	bun run build

# List draft assets waiting for polish.
drafts:
	bun run assets:drafts

# Set one asset's approval: make approve ID=bed STATUS=pending, or STATUS=approved after the owner approves it in chat.
approve:
	bun scripts/set-approval.ts "$(ID)" "$(STATUS)"

# Screenshot a page: make shot URL="/?asset=bed" OUT=/tmp/bed.png. For more options, run bun scripts/shot.ts.
# Compare it with an older commit: make shot URL="/?asset=bed" OUT=/tmp/bed.png ARGS="--compare HEAD".
shot:
	bun scripts/shot.ts "$(URL)" "$(OUT)" $(ARGS)

# Land this worktree's branch on main, push main, and delete the branch. Retries when other sessions land first.
land:
	sh scripts/land.sh
