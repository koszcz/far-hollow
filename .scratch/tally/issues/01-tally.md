# 01: The journal keeps a tally

**What to build:** The journal panel gets a second page, the tally. It counts what the player has done in the valley since the game began, such as trees felled and planks cut. The owner wants to see how much their camp has grown.

**Blocked by:** None

**Status:** ready-for-agent

**Assets:** None. The page is text only and uses the existing panel style.

## Lines

The tally shows these ten lines, in this order:

1. Trees felled: a tree comes down.
2. Logs debarked: debarking a log finishes.
3. Planks cut: a plank comes off the sawhorse.
4. Firewood split: splitting a log into firewood finishes.
5. Building pieces finished: construction of a grid piece finishes, such as a foundation, wall, door frame, window, roof frame, or roof section. A swap, such as a window in place of a wall, counts as one piece.
6. Furniture built: construction of furniture or a work station finishes.
7. Fish caught: a fish is caught with the rod, or the player takes a fish out of a fish trap.
8. Fish cooked: a fish finishes cooking on a campfire or fireplace.
9. Food preserved: a food finishes drying or smoking on a drying rack.
10. Days in the valley: the number of full days since the game began. It starts at 0.

## Acceptance criteria

- [ ] The journal panel has a "Goals | Tally" switch. J opens the panel on the page it showed last. Escape closes it.
- [ ] The tally page always shows all ten lines, in the order above, with zeros included.
- [ ] A count goes up by one each time the work finishes, never when it is planned or queued. Work the player stops partway does not count.
- [ ] A count never goes down. Using up a plank, burning firewood, or taking down a building piece changes nothing.
- [ ] "Days in the valley" comes from the clock, not from a stored count.
- [ ] No notice ever says that a count went up or reached a round number.
- [ ] Hiding the journal hides only the goal line and goal notices. The tally page still opens.
- [ ] The playground has no tally. Nothing is counted there.
- [ ] The counts are saved. The save version goes up. Older saves load with every count at 0, except "Days in the valley", which comes from the clock (ADR 0011).
- [ ] The counts are a value object: a plain type with a module of pure functions (ADR 0009).
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover each count going up, work stopped partway, a count that does not go down after a take-down, saving, an older save, and the playground.

## Out of scope

- Counts per day or per season. The tally covers the whole save only.
- Guessing older counts from the camp, such as one tree per stump. Stumps regrow and logs get used up, so a guess would be wrong.
- Notices or rewards for round numbers.

## Comments

Grilled on 2026-11-27. The owner accepted every recommended answer. The glossary entry **Tally** was added and **Journal** was updated in the same session. The word "stats" is not used because the glossary already avoids it for needs.
