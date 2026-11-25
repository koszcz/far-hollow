# 01: A less crowded build wheel

**What to build:** The build menu shows one wheel segment for each of its 22 structures. With that many segments, the player struggles to read the wheel and to find a structure. Each new spec adds more segments. The build menu needs a layout that stays readable as the list grows.

**Status:** idea

**Assets:** Probably changes the approved `hud`, which needs the owner's approval in chat. It may need category icons. Settle this during grilling.

Today the build menu lists these structures (`src/sim/structure-kind.ts`):

- Camp: campfire, lean-to, woodpile, sled, sawhorse.
- Shelter: foundation, floor, log wall, door frame, window, roof frame, roof.
- Fittings: door, shutters, fireplace, chimney.
- Furniture: chest, shelf, bed, table, stool, rain barrel.

Four ideas, which can be combined:

1. **Build add-ons from the thing they attach to.** Door, shutters, chimney, and roof each need a finished piece to go on: a door frame, a window, a fireplace, or a roof frame. They could leave the build menu and become actions on that piece, such as "Hang a door" on a door frame. This removes 4 segments. It follows `.scratch/hud-redesign/issues/04-actions-move-onto-things.md`.
2. **Group structures into categories.** The wheel first shows 4 or 5 categories, such as Camp, Shelter, Furniture, and Work. A click on a category shows a second wheel with its structures. Each wheel then has 8 segments or fewer. Building anything takes one more click.
3. **Merge variants into one segment.** Log wall, door frame, and window become one "Wall" segment. The player picks the variant while placing the blueprint.
4. **Hide or dim structures the player cannot place yet.** For example, the roof frame shows only after the first wall stands.

The session that wrote this ticket recommends ideas 1 and 2 together.

Questions for grilling:

- Which of the four ideas do we use?
- If add-ons move onto their host pieces, which ones move? Door, shutters, chimney, roof, others?
- Does an add-on still show anywhere in the build menu, so the player learns it exists?
- If we use categories, which ones, and which structure goes in each? Where do the sawhorse and the sled go?
- Does the wheel remember the last category opened?
- Does the second wheel replace the first in place, or open as an outer ring around it?
- How does the player go back from a category to the first wheel? Right-click, Escape, or a centre button?
- If variants merge, how does the player switch variant while placing, and how does the HUD show that variants exist?
- Does the craft wheel get the same treatment now, or in a later ticket?
- Does the HUD showcase at `/?asset=hud` need to show the new layout?
