# Shortcuts for the Bun scripts in package.json.
# Run `make` on its own to start the dev server.

.PHONY: run test e2e check fmt build drafts shot land

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

build:
	bun run build

# List draft assets waiting for polish.
drafts:
	bun run assets:drafts

# Screenshot a page: make shot URL="/?asset=bed" OUT=/tmp/bed.png. For more options, run bun scripts/shot.ts.
shot:
	bun scripts/shot.ts "$(URL)" "$(OUT)" $(ARGS)

# Land this worktree's branch on main, push main, and delete the branch. Retries when other sessions land first.
land:
	sh scripts/land.sh
