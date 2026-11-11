# Far Hollow

A single-player survival and building game. The player has left modern society to live alone in a forest valley, gather resources, and build a camp that grows from a campfire into a log cabin.

## World

**Valley**:
The bounded wilderness where the whole game takes place. Each valley is generated from a seed and has one river running through it.
_Avoid_: Map, level, world

**Seed**:
The value that decides how a valley is laid out. The same seed always produces the same valley.

**River**:
The single source of fresh water and fish in a valley.
_Avoid_: Stream, creek

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

**Sled**:
A craftable object the player drags to carry several logs at once.

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
One structural part of a building, such as a foundation, log wall, door frame, or roof section. Building pieces snap to a grid and cost materials.
_Avoid_: Block, part, module

**Storey**:
One level of a building. A building can have up to two storeys, with stairs between them.
_Avoid_: Floor, level

**Floor**:
The building piece the player walks on inside a building.
_Avoid_: Floorboards, deck

**Blueprint**:
A see-through outline of a building piece the player has placed but not finished. It shows where the piece will go and how far along it is.
_Avoid_: Ghost, preview, plan

**Construction**:
The timed work of turning a blueprint into a finished building piece. The player can stop partway and come back later.
_Avoid_: Crafting, assembly

**Recipe**:
A known way to make something from materials. A recipe becomes available as soon as the player has the tool or work station it needs.
_Avoid_: Blueprint, schematic, unlock

**Work station**:
A built object where the player does a specific kind of processing.
_Avoid_: Bench, crafting table

**Sawhorse**:
A work station where the player cuts debarked logs into planks.

**Furniture**:
An object placed freely inside or around a building, such as a bed, table, or shelf. Furniture does not snap to the grid.
_Avoid_: Decoration, prop

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
