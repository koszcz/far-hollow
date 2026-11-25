# 01: Put out a lit campfire or fireplace

**Status:** resolved

**Assets:** none. This ticket changes no asset.

**What to build:** The owner asked in chat on 2026-11-25 for a way to put a campfire out. A campfire and a fireplace offer the same actions, so both get it.

- [x] The player can put out a lit campfire or fireplace. They walk beside it if needed, and reach to the ground.
- [x] The fire keeps the fuel it has left. The player can light it again with the steel and flint.
- [x] The right-click menu lists "Put out" while the fire burns, just before "Take down". It does not show while the fire is out.
- [x] The action queue shows "Put out" with the campfire icon.
- [x] A save made while the player walks to put out a fire loads that command.
- [x] Tests cover the sim rule and the menu entry.

## Comments

The implementer chose these rules. Putting out a fire needs no tool or water, and it keeps the fuel. A pot, fish, or jug on the fire stays on it, and stops heating as when the fuel runs out.
