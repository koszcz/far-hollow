# Far Hollow

Far Hollow is a single-player survival and building game for the browser. You live alone in a forest valley, gather resources, and grow your camp from a campfire into a log cabin.

The game is in early development.

## Run the game

You need Node.js 26 and pnpm.

1. Install the dependencies: `pnpm install`
2. Start the dev server: `pnpm dev`
3. Open the address that Vite prints.

## Check your changes

- `pnpm test` runs the tests.
- `pnpm test:e2e` runs the browser test in your installed Google Chrome. It checks that the game loads and the player can walk. Run it when you need it. The pre-commit hook does not run it.
- `pnpm lint` checks code style and module boundaries.
- `pnpm typecheck` checks the TypeScript types.
- `pnpm build` checks the assets and builds the game into `dist/`.

## Learn the project

- `GLOSSARY.md` defines the game's terms.
- `docs/adr/` records the main design decisions.
- `.scratch/first-playable/` holds the spec and issues for the first playable version.
