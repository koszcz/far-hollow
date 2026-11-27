# 14: Each command has one name and one icon, shared by the action menu and the queue

**What to build:** One mapping gives each command its label and icon. The action menu and the action queue both read it.

**Status:** idea

**Blocked by:** None

**Assets:** None. This ticket changes no asset.

## Why

Each new verb gets its label and icon twice: once in the action menu (`src/app/thing-actions.ts`) and again in the 84-case switch in `src/ui/queued-actions.ts`. The two drift apart. For the wood box, the menu shows the `firewood` icon and the queue shows the `woodBox` icon. `queued-actions.ts` changed 26 times in the last 200 commits, almost all one-case additions.

ADR 0005 and ADR 0008 say the UI decides labels. This mapping stays in the UI.

## Acceptance criteria

- [ ] The action menu and the queue show the same label and icon for every command.
- [ ] The mapping is tested once. The queue tests shrink.
- [ ] `bun test` and `make check` pass.

Questions for grilling:

- Which icon is right for the wood box: `firewood` or `woodBox`? Are there other mismatches to settle?
- Should the queue keep any label of its own, such as "walk to the chest" while the player walks?
