# 01: The player fetches each stage's material from within 10 m

**What to build:** When the player builds a blueprint, they fetch each stage's material themselves if it lies within 10 m. They walk to it, carry it to the blueprint, build that stage, and go on to the next. This replaces the rule that a blueprint takes materials lying within 2 m of it.

**Status:** ready-for-agent

**Assets:** Reuse `logs`, `debarked-log`, `pile`, `stone`, `sled`, `sled-planks`, `pick-up-animation`, and `player-build-animation`. Add a draft pose for carrying a plank or a stone in both hands. Draw the carried plank with the plank shape from `pile` and the carried stone with `stone`.

## How it works

One build command runs a loop, one stage at a time:

1. The player checks what the next stage needs. Each stage needs one material, such as one debarked log, one plank, or one stone.
2. If the player already has it, they build the stage. A plank or stone in the backpack counts. So does a needed log on their shoulder.
3. If not, they look for the nearest one within 10 m of the blueprint, measured along the walking path.
4. They walk to it, pick it up, carry it back, hand it to the blueprint, and build the stage.
5. They repeat until the piece is finished, no material is left within 10 m, or the player stops them.

## Acceptance criteria

- [ ] The 2 m rule is gone. A blueprint no longer takes materials from piles or sleds by itself, however close they are.
- [ ] Building uses a plank or stone from the backpack first, as today.
- [ ] Otherwise, the player fetches the next stage's material if it lies within 10 m of the blueprint's edge, measured along the walking path.
- [ ] Material on the far side of the river, or anywhere else the player cannot reach within a 10 m walk, does not count.
- [ ] The player fetches from the nearest source first, by walking distance.
- [ ] The sources are logs and debarked logs lying on the ground, plank and stone piles, and parked sleds.
- [ ] A sled the player is dragging is not a source.
- [ ] The player fetches only what the next stage needs: one item per trip.
- [ ] A log or debarked log goes on the shoulder, as when the player carries one by hand.
- [ ] A plank or stone goes in the player's hands, never in the backpack.
- [ ] The player never shapes a material on the way. A blueprint that needs a debarked log never takes a plain log. A blueprint that needs a plank never takes a log.
- [ ] If the player's hands are full when building starts, the game refuses and says why. Full hands mean carrying something the stage does not need, or dragging a sled.
- [ ] When no material for the next stage is within 10 m, building stops and the game says what is missing, as it does today.
- [ ] A click on the ground, or a plain new action, stops the loop. The blueprint keeps its progress. A fetched item still in the player's hands or on their shoulder stays there.
- [ ] Building in the playground still needs nothing and fetches nothing.
- [ ] The build menu and the blueprint view count materials within the 10 m walk as available.
- [ ] Work stations keep their own rule for logs lying next to them. This ticket changes only building.
- [ ] `GLOSSARY.md` describes fetching under **Construction**.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover:
  - fetching from a pile, the ground, and a parked sled
  - nearest first by walking distance
  - a pile across the river that is not counted
  - no debarking on the way
  - refusing with full hands
  - stopping when material runs out
  - stopping on a click

## Notes

- `NEARBY_MATERIALS_METRES` and `materialsNearby` in `src/sim/building.ts` hold the old 2 m rule.
- `findPathWithin` in `src/sim/pathfinding.ts` can measure the walking distance.
- A grid square is 1 m, so 10 m reaches well past any cabin.
- The river is 6 to 10 m wide. A straight-line check would reach the far bank, which is why the distance is measured along the walking path.

## Comments

- The owner settled the rules in chat on 2026-11-24. They said fetching fits the game better than the 2 m rule. They chose: measure the distance along the walking path, refuse when the hands are full, take only what the next stage needs, and never use the backpack for fetched items.
