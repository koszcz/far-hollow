# 01: Dig up and plant berry bushes

**What to build:** The player can dig up any berry bush into the backpack and plant it near camp, where it bears berries like a wild bush. See `.scratch/garden/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Assets:** Reuse `berry-bush` and `backpack-icons`. Add the draft `berry-bush-icon`.

- [x] "Dig up" sits in every berry bush's action menu. Foraging stays the main action while the bush has berries. Digging needs no tool and takes a few seconds.
- [x] Digging up a bush with berries also puts its berries in the backpack. A full backpack refuses with the reason (ADR 0008).
- [x] A dug-up bush is gone from its spot for good, including after saving and loading.
- [x] A berry bush in the backpack weighs 1 kg and stacks.
- [x] The player plants a bush from its hotbar cell, with a see-through preview, reusing the sapling planting flow.
- [x] Planting is allowed only on forest floor or a clearing, at least 1 m from any tree, stump, sapling, berry bush, structure, blueprint, or foundation square. A refused spot turns the preview red and says why.
- [x] A planted bush bears its first berries 2 days after planting, then works exactly like a wild bush.
- [x] A blueprint or foundation that would cover a berry bush is refused with the reason.
- [x] Planted bushes and their growth are saved. The save version goes up, and older saves are upgraded when loaded (ADR 0011).
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover digging up, the berries going to the backpack, planting rules, first berries after 2 days, the build refusal, and saving.

## Comments

### Grilling decisions (2026-11-22)

The first garden ticket held the questions for the whole feature. The answers are now in `.scratch/garden/spec.md`:

- The player gets a bush by digging up a wild one, like a sapling. There are no seeds.
- A planted bush or mushroom log gives the same food as its wild version, on the same 3-day cycle, with a 2-day wait first.
- A mushroom log is a loose log the player plants a mushroom on.
- Nothing needs watering.
- Bushes go on forest floor or a clearing, with 1 m spacing.
- "Garden" is only the feature name, not an area in the game.

### Implementation notes (2026-11-22)

- A planted bush is a forage spot that starts out growing its berries back, with 2 days left. Once it bears them, nothing tells it apart from a wild bush.
- "Dig up" is the main action of a bush that is growing its berries back. E never reaches such a bush, so E cannot dig one up by mistake.
- Digging up under way now records `thingId` in place of `saplingId`, and planting under way records what it plants. The save upgrade to version 49 converts both in older saves.
- A blueprint that would cover a berry bush turns red, and the placing hint says "Cannot place a Campfire here: a berry bush is in the way." for a campfire, and likewise for other structures. Most other refused spots still give no reason.
- A berry bush also keeps 1 m from a mushroom log, which says "too close to a mushroom log".
- The refusal text for unplantable ground now reads "it grows only on forest floor or in a clearing", so saplings and berry bushes share it.
