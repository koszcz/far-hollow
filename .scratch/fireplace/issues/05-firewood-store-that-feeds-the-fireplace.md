# 05: A wood box in the cabin that the fire takes firewood from

**What to build:** The player can build a wood box inside a room and fill it with firewood. When the player adds firewood to a fireplace or campfire in the same room, the fire takes it from the wood box first, then from the backpack. The player still tends the fire by hand. The box saves them carrying firewood in the backpack.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Assets:** Decided with the owner on 2026-11-26. Add the drafts `wood-box` (an open box of planks that shows from 0 to 20 firewood, reusing the approved `firewood` shape) and `wood-box-icon` (its build menu icon, drawn in the same style as `build-icons`). Reuse `firewood`, `fireplace`, and `campfire`.

## Building a wood box

- [ ] The build menu lists the wood box. It costs 4 planks and takes 8 seconds of held build work. It needs no tool.
- [ ] A wood box is furniture. The player places it freely, and R turns it.
- [ ] The player can place a wood box only inside a room. Elsewhere the blueprint shows that it cannot go there, with the reason.
- [ ] The player can take down an empty wood box and get back all 4 planks. Taking down a wood box that holds firewood is refused, and the player is told to empty it first. Taking down its blueprint is instant.

## Filling and emptying it

- [ ] A wood box holds up to 20 firewood and nothing else.
- [ ] "Put in firewood" moves one firewood from the backpack into the box. Shift-click moves all that fit.
- [ ] "Take firewood" moves as much firewood as fits from the box into the backpack.
- [ ] Each action shows greyed, with the reason, when it cannot be done: the backpack has no firewood, the box is full, the box is empty, or the backpack has no room.
- [ ] The wood box shows how full it is.

## Adding firewood to a fire

- [ ] When the player picks "Add firewood" at a fireplace, or at a campfire on a foundation, the fire takes one firewood from a wood box in the same room. It takes from the backpack only when no wood box in that room holds firewood.
- [ ] When a room has more than one wood box, the fire takes from the one nearest to it.
- [ ] The player does not walk to the wood box. They tend the fire from beside it, as today.
- [ ] "Add firewood" is offered when a wood box in the same room or the backpack holds firewood. When neither does, it shows greyed with the reason.
- [ ] Shift-click and repeated tending work as they do today. Each piece still comes from the box first.
- [ ] A wood box never fuels a fire on its own. It does not relight a fire that is out.
- [ ] If the room breaks, for example when a wall is taken down, the wood box keeps its firewood. It serves no fire until the room is whole again.
- [ ] Sticks and bark still come only from the backpack.

## Saving and the rest

- [ ] Wood boxes, their blueprints, and the firewood in each are saved. If the save needs a new version, older saves are upgraded when loaded.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover the room rule, filling and emptying, the order the fire takes firewood in, the nearest box, a broken room, taking down, and saving.
- [ ] `GLOSSARY.md` defines the wood box and lists it under tend. This is done already.

## Comments

2026-11-26 grilling: the owner chose a new wood box over a woodpile near the fire. A box only makes sense inside the cabin. The owner also chose tending by hand over a fire that feeds itself.
