# Shortcuts for the Bun scripts in package.json.
# Run `make` on its own to start the dev server.

.PHONY: run test e2e check build drafts

run:
	bun run dev

test:
	bun run test

e2e:
	bun run test:e2e

check:
	bun run typecheck && bun run lint && bun run test && bun run check:assets

build:
	bun run build

# List draft assets waiting for polish.
drafts:
	bun run assets:drafts
