# Far Hollow

Far Hollow is a single-player survival and building game for the browser. You live alone in a forest valley, gather resources, and grow your camp from a campfire into a log cabin.

The game is in early development.

## Run the game

You need Bun 1.4. Bun installs the packages and runs every tool. You do not need Node.js.

1. Install the dependencies: `bun install`
2. Start the dev server: `bun run dev`
3. Open the address that Vite prints.

## Check your changes

- `bun run test` runs the tests.
- `bun run test:e2e` runs the browser test in your installed Google Chrome. It checks that the game loads and the player can walk. Run it when you need it. The pre-commit hook does not run it.
- `bun run lint` checks code style and module boundaries.
- `bun run typecheck` checks the TypeScript types.
- `bun run build` checks the assets and builds the game into `dist/`.

## Learn the project

- `GLOSSARY.md` defines the game's terms.
- `docs/adr/` records the main design decisions.
- `.scratch/first-playable/` holds the spec and issues for the first playable version.
