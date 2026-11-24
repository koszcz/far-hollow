# 01: The player fetches each stage's material from within 10 m

**What to build:** When the player builds a blueprint, they fetch each stage's material themselves if it lies within 10 m. They walk to it, carry it to the blueprint, build that stage, and go on to the next. This replaces the rule that a blueprint takes materials lying within 2 m of it.

**Status:** resolved

**Assets:** Reuse `logs`, `debarked-log`, `pile`, `stone`, `sled`, `sled-planks`, `pick-up-animation`, and `player-build-animation`. Add a draft pose for carrying a plank or a stone in both hands. Draw the carried plank with the plank shape from `pile` and the carried stone with `stone`.

## How it works

One build command runs a loop, one stage at a time:

1. The player checks what the next stage needs. Each stage needs one material, such as one debarked log, one plank, or one stone.
2. If the player already has it, they build the stage. A plank or stone in the backpack counts. So does a needed log on their shoulder.
3. If not, they look for the nearest one within 10 m of the blueprint, measured along the walking path.
4. They walk to it, pick it up, carry it back, hand it to the blueprint, and build the stage.
5. They repeat until the piece is finished, no material is left within 10 m, or the player stops them.

## Acceptance criteria

- [x] The 2 m rule is gone. A blueprint no longer takes materials from piles or sleds by itself, however close they are.
- [x] Building uses a plank or stone from the backpack first, as today.
- [x] Otherwise, the player fetches the next stage's material if it lies within 10 m of the blueprint's edge, measured along the walking path.
- [x] Material on the far side of the river, or anywhere else the player cannot reach within a 10 m walk, does not count.
- [x] The player fetches from the nearest source first, by walking distance.
- [x] The sources are logs and debarked logs lying on the ground, plank and stone piles, and parked sleds.
- [x] A sled the player is dragging is not a source.
- [x] The player fetches only what the next stage needs: one item per trip.
- [x] A log or debarked log goes on the shoulder, as when the player carries one by hand.
- [x] A plank or stone goes in the player's hands, never in the backpack.
- [x] The player never shapes a material on the way. A blueprint that needs a debarked log never takes a plain log. A blueprint that needs a plank never takes a log.
- [x] If the player's hands are full when building starts, the game refuses and says why. Full hands mean carrying something the stage does not need, or dragging a sled.
- [x] When no material for the next stage is within 10 m, building stops and the game says what is missing, as it does today.
- [x] A click on the ground, or a plain new action, stops the loop. The blueprint keeps its progress. A fetched item still in the player's hands or on their shoulder stays there.
- [x] Building in the playground still needs nothing and fetches nothing.
- [x] The build menu and the blueprint view count materials within the 10 m walk as available.
- [x] Work stations keep their own rule for logs lying next to them. This ticket changes only building.
- [x] `GLOSSARY.md` describes fetching under **Construction**.
- [x] All player-facing text is in the strings file.
- [x] Unit tests cover:
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
- Implemented 2026-11-24. A plank or stone in the hands shares the `carrying` part with a log on the shoulder, so the player carries one thing at a time and every rule that asks for free hands, such as picking up a log or fishing, also counts a plank or stone. Dropping a plank or stone lays it in a pile. It never goes on a sled by hand.
- Full hands block building even when the next stage needs nothing kept, such as a campfire's sticks. Felling a tree puts a log on the shoulder, so the player now puts it down before building a campfire.
- When building stops because no material is left within 10 m, the game shows the same "cannot build yet" notice the build action shows when it is refused.
