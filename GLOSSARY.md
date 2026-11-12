# Far Hollow

A single-player survival and building game. The player has left modern society to live alone in a forest valley, gather resources, and build a camp that grows from a campfire into a log cabin.

## World

**Valley**:
The bounded wilderness where the whole game takes place. Each valley is generated from a seed and has one river running through it.
_Avoid_: Map, level, world

**Seed**:
The value that decides how a valley is laid out. The same seed always produces the same valley.

**Playground**:
A test game for developers, opened by adding `?playground` to the address. Building there spends no materials and needs no tools. A playground game is never saved.
_Avoid_: Sandbox, creative mode

**River**:
The single source of fresh water and fish in a valley.
_Avoid_: Stream, creek

**Forest floor**:
The ground under and between the trees, covered in fallen needles and leaves.
_Avoid_: Forest ground, woodland floor

**Clearing**:
Open, grassy ground away from the trees.
_Avoid_: Meadow, field, glade

**River bank**:
The muddy, pebbly strip of ground that slopes down to the river's water.
_Avoid_: Shore, riverside, bank

**Undergrowth**:
The small plants and stones that grow or lie on the valley's ground, such as grass, ferns, flowers, and pebbles. The player cannot pick up undergrowth, and it does not block the way. The same seed always grows the same undergrowth.
_Avoid_: Foliage, ground cover, props, decoration

## The player

**Player**:
The lone person who lives in the valley. There is only ever one.
_Avoid_: Character, survivor, avatar

**Needs**:
The four body states the player must keep up: hunger, thirst, warmth, and fatigue. A neglected need slows the player down but does not kill them outright.
_Avoid_: Stats, vitals, meters

**Collapse**:
What happens when the player's needs are neglected for too long. The player wakes up again at their respawn point.
_Avoid_: Death, game over

**Sickness**:
A temporary state that makes the player's needs drain faster. The player can get sick from drinking unboiled river water or eating raw meat or fish. It wears off over a day.
_Avoid_: Illness, poison, disease

**Respawn point**:
The last bed or bedroll the player slept in. The player wakes here after a collapse.
_Avoid_: Spawn, checkpoint

## Resources

**Material**:
Anything the player gathers or processes to build or craft with, such as logs, planks, stone, or clay.
_Avoid_: Resource, item, loot

**Log**:
A length of tree trunk cut from a felled tree.
_Avoid_: Timber, wood

**Debarked log**:
A log with its bark stripped off with a drawknife. Log walls are built from debarked logs.

**Bark**:
The material left over from debarking a log.

**Plank**:
A flat board cut from a debarked log at a sawhorse.
_Avoid_: Board, lumber

**Stick**:
A small piece of dry wood the player picks up from the forest floor. Sticks are used as fuel.

**Firewood**:
Split pieces of a log, made with the axe. Firewood is used as fuel and burns longer than sticks.

**Stump**:
What is left after a tree is felled. A stump slowly regrows into a tree over many days.

**Sapling**:
A young tree the player can plant. It grows into a tree over many days.

## Tools and carrying

**Tool**:
A hand-held object that lets the player do a kind of work, such as an axe, knife, fire striker, drawknife, saw, or fishing rod. Tools never wear out.
_Avoid_: Equipment, gear

**Backpack**:
What the player carries small materials and tools in. It has a weight limit.
_Avoid_: Inventory, bag

**Drop**:
To put something the player carries on the ground at their feet. Anything in the backpack or on the player's shoulder can be dropped. Dropped things stay where they lie until the player picks them up again.
_Avoid_: Discard, throw away

**Pile**:
Dropped things of one kind lying together on the ground, such as seven sticks. Things dropped close to a pile of the same kind join it.
_Avoid_: Stack, heap, drop

**Sled**:
An object the player builds from the build menu and drags behind them to move several logs or debarked logs at once. It holds a fixed number of them. Dragging a sled slows the player, and their hands are busy until they let go.
_Avoid_: Cart, wagon, wheelbarrow

**Drag**:
To pull a sled behind the player as they walk. The player drags one sled at a time.
_Avoid_: Pull, tow, push

## Food

**Forage**:
To gather wild food, such as berries and mushrooms, by hand.
_Avoid_: Harvest, pick

**Snare**:
A trap the player sets to catch rabbits.

**Bow**:
The tool the player uses to hunt deer.

## Building

**Camp**:
Everything the player has built in the valley. It has no formal boundary.
_Avoid_: Base, settlement, home zone

**Building piece**:
One structural part of a building, such as a foundation, log wall, door frame, roof frame, or roof section. Building pieces snap to a grid and cost materials.
_Avoid_: Block, part, module

**Storey**:
One level of a building. A building can have up to two storeys, with stairs between them.
_Avoid_: Floor, level

**Floor**:
The building piece the player walks on inside a building.
_Avoid_: Floorboards, deck

**Lean-to**:
The first shelter the player builds: a sloped roof of sticks and bark on a frame, open at the front. It is one structure, not a set of building pieces.
_Avoid_: Shack, tent, hut

**Roof frame**:
The timber skeleton of one foundation square, built on its walls before the roof. Level beams lie on the wall tops, and sloped rafters rest on the beams. The frame sets which way the roof slopes. The roof section laid on it is only bark.
_Avoid_: Truss, rafters (for the whole frame)

**Room**:
A set of foundation squares closed in on every side by log walls or door frames, with a roof over every square. A lit campfire in a room warms the whole room.
_Avoid_: Interior, enclosure

**Build menu**:
The list, opened with B, of every structure the player can build and what it costs.
_Avoid_: Build bar, construction menu

**Blueprint**:
A see-through outline of a building piece the player has placed but not finished. It shows where the piece will go and how far along it is.
_Avoid_: Ghost, preview, plan

**Construction**:
The timed work of turning a blueprint into a finished building piece. The player can stop partway and come back later.
_Avoid_: Crafting, assembly

**Recipe**:
A known way to make something from materials. A recipe becomes available as soon as the player has the tool or work station it needs. Every recipe is either a hand recipe or a station recipe.
_Avoid_: Blueprint, schematic, unlock

**Crafting**:
The timed work of following a recipe to make something that goes into the backpack. The materials are used up only when the work finishes. If the player stops partway, they lose nothing, and the work starts again from the beginning next time. Things placed in the world, such as work stations and furniture, come from construction, not crafting.
_Avoid_: Making, fabrication, assembly

**Hand recipe**:
A recipe the player can follow anywhere, using only what is in their backpack.

**Station recipe**:
A recipe the player follows while standing at a work station. Besides what is in the backpack, it can use logs lying next to the station or on a sled parked next to it.

**Craft menu**:
The list, opened with C, of every recipe in the game. Recipes the player cannot follow yet show the tool or work station they are missing.
_Avoid_: Crafting window, recipe book

**Work station**:
A built object where the player does a specific kind of processing.
_Avoid_: Bench, crafting table

**Sawhorse**:
A work station where the player cuts debarked logs into planks.

**Saw blade**:
The metal blade the player brings into the valley. It is a material, not a tool. The player crafts it into a saw.

**Saw**:
A bow saw: a saw blade in a wooden frame. The player needs it to cut planks at a sawhorse.

**Furniture**:
An object placed freely inside or around a building, such as a bed, table, or shelf. Furniture does not snap to the grid.
_Avoid_: Decoration, prop

**Chest**:
Furniture that stores small materials, tools, and food, grouped by kind. It has a weight limit. Putting things in chests is how the player keeps the camp organised.
_Avoid_: Box, crate, container, storage

**Woodpile**:
A structure the player builds to stack logs, debarked logs, and firewood. It holds a fixed number of them.
_Avoid_: Log pile, log rack, stockpile

## Fire

**Fuel**:
Any material a fire burns, such as sticks, firewood, or bark. A fire goes out when its fuel runs out.

**Campfire**:
An open fire built on the ground. It gives warmth and light, and the player cooks and boils water on it.
_Avoid_: Bonfire, fire pit

**Fireplace**:
A stone building piece built into a cabin. It heats the room it is in.
_Avoid_: Hearth, stove

**Torch**:
A carried or mounted light that lights a small area around it.

## Guidance

**Journal**:
The player's list of suggested goals, such as a first fire, a first shelter, and a first cabin. Following it is optional.
_Avoid_: Quest log, objectives, achievements

## Weather and time

**Rain**:
The only weather in the valley. Being out in the rain without a roof overhead drains the player's warmth.

**Day**:
One full cycle of daylight and night in the valley.

## Assets

**Asset**:
Anything the game shows or plays that is not game logic: a 3D model, texture, animation, sound, or the look of an on-screen interface such as the HUD. An asset is either built in code or comes from a third-party file.
_Avoid_: Art, resource, content

**Asset catalogue**:
The single list of every asset in the game, with its source, license, and whether it is a draft or approved.
_Avoid_: Asset library, asset registry

**Draft asset**:
A rough asset built in code so a feature can ship before its asset is polished. Any ticket may add one without the owner's approval. A draft stays a draft until the owner approves it.
_Avoid_: Placeholder, temp asset, stub

**Approved asset**:
An asset the owner has approved as final. Only the owner can approve an asset, and only the owner can approve a third-party file.
_Avoid_: Final asset, polished asset
