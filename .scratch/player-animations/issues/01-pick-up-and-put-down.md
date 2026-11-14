# 01: Pick-up and put-down animation

**What to build:** The player bends and reaches with their hands when they pick something up or put something down. Today these actions happen instantly and the player does not move. A person picking up a stick bends at the hips and knees, closes a hand on it, and straightens with it. A person putting a thing on a woodpile or into a chest reaches out at waist height instead. The thing changes hands at the moment the hand reaches it, not before.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Assets:** Reuse `player`, `walk-animation`, and `hud`. Add the draft `pick-up-animation`.

## Which actions it covers

The low reach, to the ground, plays for these commands:

- `pickUpStick`, `pickUpBark`, `pickUpPile`, `pickUpLog`, and `pickUpBedroll`
- `forage`
- `layBedroll`
- `dropLog`, `dropLogAt`, and `dropFromBackpack`
- `deliverToBlueprint`
- `fillPot`, at the riverbank
- `addFuel` and `tendCampfire`
- `putPotOnFire` and `takePotOffFire`

The waist-height reach plays for these commands:

- `putInChest`, `takeFromChest`, and `openChest`
- `stackOnWoodpile`, `takeFromWoodpile`, and `tendWoodpile`
- `loadSled`, `takeFromSled`, and `tipOutSled`

These commands are out of scope, because each needs its own motion: `eat`, `drinkFromRiver`, `drinkFromPot`, `lightCampfire`, `dragSled`, and `letGoOfSled`.

## Acceptance criteria

- [x] Each covered command plays the reach after the player has walked into reach of the thing. The player faces the thing first.
- [x] The whole motion takes about 0.9 seconds. The hand reaches the thing about 0.4 seconds in.
- [x] The game carries out the command when the hand reaches the thing. Until then, the thing stays where it was and the backpack does not change.
- [x] A refusal, such as a full backpack, shows when the hand reaches the thing. The player then straightens empty-handed.
- [x] A new command during the motion cancels it. If the hand has not reached the thing yet, the command is not carried out.
- [x] A new command after the hand reaches the thing cuts the straightening short, so picking up several sticks in a row stays quick.
- [x] The HUD shows no progress bar for the reach. The reach does not drain fatigue.
- [x] A save made during the motion need not keep it. After loading, the command is either done or not done, never half done.
- [x] The motion reads apart from the build animation's squat and press.
- [x] The low reach can use KayKit's `PickUp` clip and the waist-height reach its `Interact` clip, both already in `barbarian.glb`. If either reads wrong, pose it in code over the idle clip, as `player-build-pose.ts` does.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover the delayed pickup, a cancel before the hand reaches the thing, and a refusal at the moment of reaching.
- [x] Check the motion in the browser as `docs/agents/game-testing.md` describes.
