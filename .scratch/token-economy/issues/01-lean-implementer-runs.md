# 01: Run implementers on Sonnet, cap file length, and test from game state first

**What to build:** Three changes that make each ticket run use fewer tokens. See `.scratch/token-economy/spec.md`.

**Blocked by:** None

**Status:** ready-for-agent

**Assets:** None. This ticket changes tooling only.

## Implementers run on Sonnet

- [ ] In `.claude/skills/ticket/SKILL.md`, replace the rule "Review on Sonnet, fix on Opus" with one rule: build on Sonnet, review on Sonnet, fix on Opus. The lead passes `model: "sonnet"` to each implementer and to the code-review subagents. It passes `model: "opus"` to the fix implementer.
- [ ] The step "Build the frontier" says to pass `model: "sonnet"` next to `isolation: "worktree"`.
- [ ] No other file repeats the model rule.

## The lint step caps file length

- [ ] `.oxlintrc.json` sets the `max-lines` rule to `error` with a `max` of 1175. 1175 is the longest file today, `src/app/thing-actions.test.ts`. The longest source file is `src/sim/api.ts`, at 1155 lines.
- [ ] `bun run lint` passes on `main` with the new rule.
- [ ] A file one line over the cap fails `bun run lint`. Check this by hand, and do not commit the test file.
- [ ] A one-line comment next to the rule in `.oxlintrc.json`, or in `docs/agents/` if the config format allows no comments, says: lower the cap whenever a split brings the longest file down. Never raise it.

## The implementer brief sends the agent to game state first

- [ ] `.claude/skills/ticket/implementer.md` step 2 says: before you play the game in a browser or take a screenshot, read `docs/agents/game-testing.md`, and check behaviour through game state. Take a screenshot only for a visual result, such as a model, a texture, or the layout.
- [ ] The line points to `docs/agents/game-testing.md` and does not copy its content.

## Comments
