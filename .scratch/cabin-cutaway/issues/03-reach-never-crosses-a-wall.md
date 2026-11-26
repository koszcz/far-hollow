# 03: Reach never crosses a wall

**What to build:** The player can act on a thing only from the same side of every wall as the thing. Today reach measures only the straight-line distance. So the player can build a fireplace, sleep in a bed, or fill a chest from outside the cabin, through the wall. After this change, a thing behind a wall is out of reach. The approach walks the player round through a door frame to the thing's side. The owner reported the problem and settled the rule in grilling on 2026-11-26.

This is not a camera problem. The walls do not need to fade more. Fireplaces and chimneys still never fade.

**Status:** ready-for-agent

**Assets:** None. Settled with the owner on 2026-11-26.

## What blocks reach

- [ ] A finished log wall or a finished window blocks reach across its edge. These are the same pieces that block walking today.
- [ ] An empty door frame does not block reach. A door frame with a door does not block it either, whether the door is open or closed.
- [ ] A blueprint or a half-built wall does not block reach.
- [ ] An edge piece never blocks reach to itself. The player can still build or use a wall, window, door frame, door, or set of shutters from either side.

## Acting on a thing behind a wall

- [ ] Every action follows the rule, including building, sleeping in a bed or on a bedroll, using a chest, and tending or cooking at a fireplace.
- [ ] When the player stands outside a cabin and acts on a thing inside it, the approach walks them in through a door frame. They act only once they stand on the thing's side of the wall.
- [ ] When the player sleeps in a bed beside a wall, the sleep animation starts on the bed's side of the wall. The player never slides through the wall into bed.
- [ ] When no way leads to the thing's side, the game refuses with the notice "You can't get to it from here." A cabin with four walls and no door frame is one example. The player does not act through the wall.
- [ ] E skips a thing behind a wall. It acts on the nearest thing in reach on the player's side.

## Tests

- [ ] Tests cover a thing behind a log wall, behind a window, beyond an empty door frame, and beyond a door frame with a door.
- [ ] Tests cover an approach from outside a cabin that walks in through the door frame.
- [ ] Tests cover the refusal for a cabin with no way in.
- [ ] Tests cover E with a nearer thing behind a wall and a further thing on the player's side.
