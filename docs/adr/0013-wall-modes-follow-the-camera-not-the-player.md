# Wall modes follow the camera, not where the player stands

The player chooses one of three wall modes with a HUD button: walls up, cutaway, and walls down. What hides and fades depends only on the wall mode and the camera. The game no longer checks whether the player stands inside a cabin.

The first cutaway, added on 2026-11-24, hid a cabin's roof and faded its sides facing the camera only while the player stood under that cabin's roof or in its doorway. In play the owner found it "out of sync": what hid did not match what the player expected to see. On 2026-11-25 a manual button replaced it. Wall modes, as in other building games, keep that predictability and add a mode to see through every wall.

## Considered options

- **Fix the rule for being inside a cabin**: rejected. However exact the rule, the roof would still appear and disappear as the player walks, and the player cannot tell why.
- **An automatic mode beside the forced modes**: rejected. It keeps the rule that failed, and the cutaway mode already shows the inside of every cabin.

## Consequences

- The code that finds the cabin around the player, including the doorway rule, is removed with its tests.
- The game starts in the cutaway mode. Roofs show only in walls up mode.
- A wall between the camera and the player still fades in every wall mode, because the camera follows the player outside cabins too.
