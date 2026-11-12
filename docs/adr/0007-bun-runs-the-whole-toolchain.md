---
status: accepted
---

# Bun runs the whole toolchain

Bun replaces Vite and Vitest. Bun installs the packages, checks the types with `bun check`, runs the unit tests with `bun test`, bundles the game with `Bun.build`, and serves it in development with `Bun.serve`. This updates the tool choice in ADR 0001; the rest of that ADR still applies. We chose this to try one fast tool for everything. The type check takes about 0.1 seconds instead of about 2, and the project has fewer packages to keep up to date.

## What we gave up

- **Hot swapping of Preact components.** Vite's Preact plugin updated a changed component in place and kept the game running. Bun's dev server reloads the whole page instead, so you return to the start screen.
- **`import.meta.env` for free.** Bun does not fill it in. `scripts/build.ts` sets it for the build, and `scripts/dev-env-plugin.ts` sets it for the dev server. `src/env.d.ts` declares its types.
- **Loose types in test assertions.** `bun:test` checks that the expected value of `toEqual` has the same type as the actual value. A few tests write `toEqual<unknown>(...)` where the two types differ on purpose.

## What Bun does not replace

- **Linting.** Bun 1.4.4 has no built-in linter. oxlint replaces ESLint. Its type-aware mode (`oxlint-tsgolint`) runs the typescript-eslint `strictTypeChecked` rules we used, in about a tenth of the time. `.oxlintrc.json` was converted from the old ESLint config with `@oxlint/migrate`. Two rules did not carry over, `no-dupe-args` and `no-octal`, because strict mode already forbids both. `no-unnecessary-condition` is still marked experimental in oxlint.
- **Module boundaries.** oxlint replaces dependency-cruiser. A `no-restricted-imports` override for each folder in `.oxlintrc.json` enforces the import rules from ADR 0001, ADR 0003, and ADR 0005, and `import/no-cycle` forbids circular imports. Test files are exempt, as they were before. oxlint matches the path as written in an import, while dependency-cruiser matched the file the import resolved to. Every import in this project uses a plain relative path, so the two give the same result.
- **TypeScript 7.** dependency-cruiser needed the JavaScript API of TypeScript 6, and TypeScript 7 does not publish that API yet. With dependency-cruiser gone, the project uses TypeScript 7.
- **Playwright.** Bun cannot drive a browser. Playwright now starts Bun's dev server.

## Considered options

- **Keep Vite and Vitest, and use Bun only to install and run them**: rejected for now. This project is a good place to try a smaller toolchain. If losing Preact hot swapping slows work down, we can return to Vite's dev server alone.
