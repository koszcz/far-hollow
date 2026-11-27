# 17: Add a save version only when the stored data changes

**What to build:** A new kind of thing, such as a new furniture piece, no longer adds a save version when older saves need no change. Save versions move only for real migrations.

**Status:** idea

**Blocked by:** None

**Assets:** None. This ticket changes no asset.

## Why

The architecture review on 2026-11-27 found that 33 save upgrades do nothing (`nothingToUpgrade`). The comment above the upgrade list in `src/sim/save.ts` says new kinds "no longer need a version of their own". Even so, the drying rack, the wood box, and other features each added one.

About 51 test files import a feature's own save version constant, such as `ROOFS_FACE_SAVE_VERSION`. Merges have hit conflicts over the order of these upgrades, for example "put the rain barrel save upgrade after the mushroom log one".

The grilling of ticket 10 split this out, because it touches ADR 0011 and many tests, not stored commands.

Questions for grilling:

- Why do features still add an empty upgrade? Does a test or the save check need one, for example to refuse a newer save in an older game?
- Should the empty upgrades already in the list stay, since older saves count on the version numbers?
- How should a feature test build "a save from before this kind existed" without its own version constant?
- Does this need a change to ADR 0011, or only to the comment above the upgrade list?
