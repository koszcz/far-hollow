# Far Hollow: game design spec

Far Hollow is a single-player survival and building game for desktop browsers. The player has left modern society to live alone in a forest valley. They gather materials, keep their needs up, and grow their camp from a campfire into a log cabin they design themselves.

This spec records every design decision made so far. Terms in **bold** are defined in `GLOSSARY.md`. Architecture decisions are recorded in `docs/adr/`.

## First playable

The first playable proves the core loop. It includes only this:

1. The player starts at the edge of a **valley**.
2. The player walks through the forest by clicking.
3. The player chops a tree and carries the **logs**.
4. The player builds a **campfire** and keeps it fuelled.
5. The player survives one night.

Everything else in this spec comes after the first playable.

## Platform and performance

- The game runs in desktop browsers, using a keyboard plus a mouse or trackpad. Mobile is not supported.
- It must run at 60 fps or better on an Apple M1 laptop in Chrome.
- It must run at 120 fps on the built-in screen of an Apple M3 Pro laptop. That screen tops out at 120 Hz, and Chrome caps the frame rate to match.
- The frame rate is not capped on external monitors, such as 144 Hz displays.
- Game logic runs at a fixed rate. Rendering smooths movement between logic updates so motion stays fluid at high frame rates.
- Trees are drawn in batches, so the valley can hold thousands of them.
- Finished **building pieces** are merged for drawing, so very large buildings stay fast.

## Camera and controls

The camera looks down at the player from above at an angle, like an isometric game. The player can rotate it and change the angle.

| Input | What it does |
| --- | --- |
| Left-click the ground | Walk there. The player finds a path around trees, rocks, and buildings. |
| Left-click an object | Walk to it and do its main action, such as chopping a tree. |
| Shift + left-click | Add an action to the queue, such as chopping three trees in a row. |
| Right-click (no drag) | Open a radial menu of every action the object allows. |
| Left-drag | Pan the camera. |
| Q / E, or right-drag | Rotate the camera. Right-drag up and down also tilts it. |
| Scroll wheel, two-finger scroll, or pinch | Zoom. |
| Space | Snap the camera back to the player. |
| WASD or screen edges | Pan the camera when follow is off. |

- A setting decides whether the camera follows the player. It follows by default.
- Camera pitch is limited to about 20° to 75°.
- On a trackpad, a two-finger click works as a right-click.
- When the player is inside a building, that building's roof hides. Walls between the camera and the player fade out.

## World

- Each valley is generated from a **seed**. The same seed always makes the same valley.
- A valley is bounded and about 1 km².
- Each valley has one **river**.
- The player cannot reshape the terrain.
- There are no predators of any kind.

## The player's needs

- The player has four **needs**: hunger, thirst, warmth, and fatigue.
- A neglected need slows the player down.
- If needs are neglected for too long, the player has a **collapse**.
- After a collapse, the player wakes at their **respawn point** with low needs. They keep everything in their **backpack**. The rest of that **day** is lost.
- **Sickness** makes needs drain faster. It wears off over one day, and resting speeds it up.
- The player gets sick from drinking unboiled river water or eating raw meat or fish.
- Clothing does not affect warmth. Warmth comes from fire, shelter, and staying dry.

## Materials and processing

| Material | How the player gets it | Used for |
| --- | --- | --- |
| Log | Chop a tree with the axe | Debarking, firewood |
| Debarked log | Strip a log with the drawknife | Log walls, planks |
| Bark | Left over from debarking | Fuel, tinder, early lean-to roofs |
| Plank | Cut a debarked log at a **sawhorse** | Floors, furniture |
| Firewood | Split a log with the axe | Fuel |
| Stick | Pick up from the forest floor | Fuel |
| Stone | Collect from the riverbed | Fireplaces and other stonework |
| Clay | Collect from the riverbank | Building |

- Felled trees leave a **stump**. A stump slowly regrows into a tree over many days.
- The player can plant **saplings**, which grow into trees over many days.

## Tools and carrying

- The player starts with an axe, a knife, a fire striker, a bedroll, and a pot.
- The pot holds water for boiling on a campfire.
- Better tools come from crafting, such as a drawknife, saw, bow, and fishing rod.
- **Tools** never wear out.
- The backpack has a weight limit.
- The player carries logs on their shoulder, one at a time.
- A craftable **sled** lets the player drag several logs at once.

## Food and water

- The player can **forage** berries and mushrooms.
- The player catches rabbits with a **snare**.
- The player hunts deer with a **bow**.
- The player catches fish at the river with a fishing rod.
- Meat and fish must be cooked on a campfire.
- River water must be boiled on a campfire to be safe.

## Fire and light

- Fires burn **fuel** and go out when it runs out.
- Campfires give warmth and light. The player cooks and boils water on them.
- A **fireplace** heats the room it is in.
- **Torches** can be carried or mounted. They light a small area.
- Nights are dark enough that the player needs fire. Faint moonlight keeps shapes visible.

## Building

- Building pieces snap to a grid. They include foundations, log walls, door frames, windows, floors, stairs, and roof sections.
- To build, the player places a **blueprint**, then holds the build action. The piece grows in stages with an animation.
- Materials are spent as **construction** goes on.
- The player can stop partway and come back later. Progress is saved.
- Walls need a foundation. Roofs need walls under them. There is no physics, and nothing collapses.
- Foundations grow legs down to sloped ground.
- A building can have up to two **storeys**.
- There is no limit on a building's size. A large single-storey house is allowed.
- Windows have wooden shutters. There is no glass.
- There is no tech tree. A **recipe** becomes available as soon as the player has the tool or **work station** it needs.

## Furniture and interiors

- The player crafts **furniture** and places it freely. Furniture does not snap to the grid.
- Furniture can be rotated and sits on the floor.
- Chests and shelves store materials.
- Furniture cannot be placed on top of other furniture yet.

## Weather and time

- A day lasts 24 real minutes. One game hour is one real minute.
- Sleeping skips the night.
- **Rain** is the only weather. Being out in the rain without a roof overhead drains warmth.
- There are no seasons yet.

## Starting a game and saving

- When starting a new game, the player picks a random seed or types one in.
- There are three save slots.
- The game autosaves to the browser's built-in storage (IndexedDB). There is no server.
- Each save has a version number. Older saves are upgraded step by step when loaded.
- A schema check rejects broken saves.

## Guidance

- A **journal** suggests goals such as a first fire, a first shelter, and a first cabin.
- Following the journal is optional.
- The game never ends.

## Sound

- The game has forest ambience and action sounds.
- There is no music.
- Sound is not part of the first playable.

## Visuals and assets

- The art style is low-poly and stylized.
- Third-party assets come from free packs with no usage restrictions (CC0), such as Quaternius and Kenney.
- The player model is a rigged CC0 character.
- Simple shapes are built in code.
- The owner approves every asset before it enters the game. For each one, the owner picks a specific file or asks for it to be built in code.
- An asset manifest lists every asset with its source, license, and approval status. The build fails if any asset file is not approved in the manifest.

## Language

- The game is in English only.
- All player-facing text lives in one strings file, so it can be translated later.

## Architecture and code quality

- The stack is TypeScript, Vite, and plain three.js. See ADR 0001.
- Game logic does not import three.js. Rendering only reads game state.
- Game logic is an entity-component-system built on `miniplex`. See ADR 0003.
- The UI is Preact. It only reads state and sends commands. See ADR 0005.
- TypeScript runs in strict mode.
- ESLint checks code style and common mistakes.
- `dependency-cruiser` checks that folders only import what they are allowed to.
- Bun is the package manager and the runtime for every tool. (This replaced pnpm and Node.js on 2026-11-11.)
- A pre-commit hook runs type checks, lint, and unit tests.
- There is no CI until the project has a GitHub remote.

## Testing

- Vitest covers all game logic.
- One Playwright test checks that the game loads and the player can walk.
- Playwright runs only on demand, not on every commit.

## Developer tools

- A debug overlay is off by default.
- It shows fps, entity count, and the seed.
- It can skip time forward.

## Not planned

- Predators
- Music
- Seasons
- Clothing that affects warmth
- Terrain editing
- Glass windows
- Tool wear
- Mobile support
- Multiplayer

## Open items

- **Game name**: "Far Hollow" is chosen. A Steam game called "Tales of Farhollow" already exists. No trademark search has been done. Confirm the name before any public release.
