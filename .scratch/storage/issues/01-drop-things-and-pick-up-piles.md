# 01: Drop things and pick up piles

**What to build:** The player can drop anything in the backpack onto the ground at their feet, as a pile. They can walk to a pile later and pick it back up.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Assets:** Reuse `player`, `sticks`, `firewood`, `bark`, `pot`, and `backpack-icons`. Adds the drafts `pile` and `rolled-bedroll`.

- [ ] The player can drop any kind in the backpack: tools, sticks, firewood, bark, food, the pot, and the bedroll.
- [ ] Dropping a kind drops all of that kind at once, at the player's feet, as one pile.
- [ ] Things dropped within 1 m of a pile of the same kind join that pile.
- [ ] Dropped sticks can be picked up the same way as sticks found on the forest floor.
- [ ] A pile shows how many things it holds, from one to many.
- [ ] Clicking a pile walks the player to it. The player takes as many as fit in the backpack. The rest stay in the pile.
- [ ] A dropped pot keeps what it holds. A pot of boiled water stays a pot of boiled water.
- [ ] A dropped bedroll lies rolled up. The player cannot sleep in it. Laying the bedroll still works as before.
- [ ] Dropping the log on the player's shoulder still works as before. Logs never form piles.
- [ ] Piles stay where they lie. They do not disappear, and rain has no effect on them.
- [ ] Piles are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover dropping, joining piles, partial pick-up, and saving.
