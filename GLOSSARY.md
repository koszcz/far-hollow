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

**Bird**:
A small brown songbird that flies over the trees and lands in clearings by day. It is only there to look at. The player cannot catch or hunt it, and it flies off when the player comes close.
_Avoid_: Songbird, critter, wildlife

**Firefly**:
A small glowing insect that drifts and blinks over clearings and the river bank at night. It is only there to look at. The player cannot catch it.
_Avoid_: Glow bug, lightning bug, critter, wildlife

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

**Drink**:
The amount of water that fills thirst completely. A full pot holds 1 drink. Jugs and rain barrels count their water in drinks.
_Avoid_: Sip, serving, litre

**Clean water**:
Water that is safe to drink: river water that has boiled, or rain caught in a rain barrel. Unboiled river water is not clean.
_Avoid_: Safe water, fresh water, drinking water

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
A length of tree trunk cut from a felled tree. A small tree gives 3 logs, a mid-sized tree 4, and a big tree 5. A bigger tree takes longer to chop down.
_Avoid_: Timber, wood

**Debarked log**:
A log with its bark stripped off with a drawknife. Log walls are built from debarked logs.

**Bark**:
The material left over from debarking a log.

**Cord**:
A length of bark twisted by hand into a strong string. It ties things together, such as the sticks of a fish trap.
_Avoid_: Rope, string, twine

**Plank**:
A flat board cut from a debarked log at a sawhorse.
_Avoid_: Board, lumber

**Stone**:
A material the player gathers on the river bank and carries in the backpack. One stone weighs 2 kg. Gathering one takes a few seconds of work and needs no tool. The river bank never runs out of stone. A fireplace is built from stone.
_Avoid_: Rock, boulder

**Clay**:
A material the player digs by hand on the river bank and carries in the backpack. One clay weighs 2 kg. Digging one takes longer than gathering a stone and needs no tool. The river bank never runs out of clay.
_Avoid_: Mud, earth

**Stick**:
A small piece of dry wood the player picks up from the forest floor. Sticks are used as fuel. New sticks keep falling from the trees, so the forest floor never runs out of them.

**Deadfall**:
A few sticks that fell together and lie close under one tree. The player picks them up one at a time, like any stick.
_Avoid_: Pile, cluster, bundle

**Firewood**:
Split pieces of a log, made with the axe. Firewood is used as fuel and burns longer than sticks.

**Stump**:
What is left after a tree is felled. A sapling sprouts from it after a day, and it grows back into a full tree over 6 game days.

**Sapling**:
A small young tree, either growing from a stump or planted by the player. The player can dig one up into the backpack and plant it elsewhere. It grows into a young tree, then a full tree, over 5 game days.
_Avoid_: Seedling, sprout

**Young tree**:
The stage between a sapling and a full tree. It blocks walking but is too young to chop.

## Tools and carrying

**Tool**:
A hand-held object that lets the player do a kind of work, such as an axe, knife, steel and flint, drawknife, saw, or fishing rod. Tools never wear out.
_Avoid_: Equipment, gear

**Backpack**:
What the player carries small materials and tools in. It has a weight limit.
_Avoid_: Inventory, bag

**Backpack content**:
One kind of thing in the backpack, such as berries or the axe, together with how many there are.
_Avoid_: Item, slot

**Shoulder**:
Where the player carries a single log or debarked log, outside the backpack.
_Avoid_: Carry slot

**Hands**:
Where the player carries a single plank or stone they fetch for a blueprint, outside the backpack. The player carries one thing at a time, on the shoulder or in the hands.
_Avoid_: Carry slot, held item

**Drop**:
To put something the player carries on the ground at their feet. Anything in the backpack, on the player's shoulder, or in their hands can be dropped. Dropped things stay where they lie until the player picks them up again.
_Avoid_: Discard, throw away

**Pile**:
Dropped things of one kind lying together on the ground, such as seven sticks. Things dropped close to a pile of the same kind join it.
_Avoid_: Stack, heap, drop

**Sled**:
An object the player builds from the build menu and drags behind them to move several logs, debarked logs, or planks at once. It holds a fixed number of them. Dragging a sled slows the player, and their hands are busy until they let go.
_Avoid_: Cart, wagon, wheelbarrow

**Drag**:
To pull a sled behind the player as they walk. The player drags one sled at a time.
_Avoid_: Pull, tow, push

**Parked**:
Said of a sled that no one drags. The player can load, take from, and tip out only a parked sled, a work station can use the logs on a parked sled next to it, and the player can fetch from a parked sled for a blueprint.
_Avoid_: Stopped, idle, left

**Tip out**:
To unload every log and debarked log from a parked sled at once. If a woodpile is next to the sled, the logs go on the woodpile as far as it has room. The rest lie on the ground beside the sled. Planks drop in one pile beside the sled.
_Avoid_: Unload, empty, dump

## Acting

**Main action**:
The most likely action on a thing, such as chopping a tree, lighting a campfire, or eating berries. It sits at the top of the thing's action menu, and E does it.
_Avoid_: Default action, primary action, left-click action

**Use**:
To do a thing's main action. The player uses a thing by picking the top option of its action menu, by pressing E when it is the nearest thing in reach, or, for a backpack content, by pressing its number key.
_Avoid_: Interact, activate

**Reach**:
How close the player must stand to act on a thing. If the player is out of reach, they walk to the thing first, then act.
_Avoid_: Range, interaction distance

**Approach**:
The walk the player makes to get within reach of a thing or a spot, so they can act on it there.
_Avoid_: Go-to, walk-to-act, errand

**Tend**:
To add fuel to a campfire, to stack things on or take things off a woodpile, or to load, take from, or tip out a sled.
_Avoid_: Feed, refuel, manage

**Action menu**:
The list of every action a thing offers, which opens beside the pointer when the player clicks the thing. The main action sits at the top in bold, and the rest follow below. An action the player cannot do yet shows greyed, with the reason under its name.
_Avoid_: Right-click menu, context menu, radial menu, pie menu

**Action queue**:
The actions the player has lined up to do in order, at most 4, counting the one under way. Shift with a click on an action, with E, or with a number key adds an action to the end. When the action under way is finished, the next one starts. A plain click, E, or number key empties the queue and starts that action at once.
_Avoid_: Task list, job queue, command queue, to-do list

**Command rule**:
How the game handles one kind of command the player sends, such as chopping a tree: why it refuses the command, how it carries it out, and whether the player must approach first. The activity module that carries out the command owns its rule.
_Avoid_: Command handler, action rule

**Hotbar**:
The row at the bottom of the screen that shows the backpack contents, anything on the shoulder, and the sled the player drags.
_Avoid_: Inventory bar, toolbar, quick bar

**Panel**:
A box above the hotbar that shows the state of a nearby thing, such as how much fuel a campfire has. A panel only shows state. The player acts on the thing itself.
_Avoid_: Context panel, window, popup

## Food

**Forage**:
To gather wild food, such as berries and mushrooms, by hand.
_Avoid_: Harvest, pick

**Plant**:
To put a sapling or berry bush in the ground, or a mushroom on a log, so that it grows.
_Avoid_: Sow, seed, inoculate

**Berry bush**:
A bush that bears berries. The player forages its berries, and it bears again 3 days later. Wild berry bushes grow near trees. The player can dig one up into the backpack and plant it elsewhere. A planted bush bears its first berries 2 days later. A berry bush does not block walking.
_Avoid_: Shrub, berry plant

**Mushroom patch**:
A small group of wild mushrooms growing near a tree's trunk. The player forages its mushrooms, and it grows back 3 days later. The player cannot dig it up.
_Avoid_: Mushroom spot, fungus

**Mushroom log**:
A log on the ground that the player has planted a mushroom on. It bears its first mushrooms 2 days later and grows them back 3 days after each forage. It stays where it lies for good. The player cannot pick it up or build with it.
_Avoid_: Mushroom bed, fungus log

**Raw fish**:
A fish the player catches at the river with the fishing rod or takes from a fish trap. It is food the player carries in the backpack. Eating it raw makes the player sick.
_Avoid_: Trout, catch

**Cook**:
To put raw fish on a lit campfire or fireplace until it becomes cooked fish. Cooking needs no tool and no pot. A campfire or fireplace holds up to 3 fish beside the pot.
_Avoid_: Roast, grill, fry

**Cooked fish**:
Raw fish that has cooked on a lit campfire or fireplace. It is food the player carries in the backpack. It fills hunger more than raw fish and does not make the player sick. It never burns.
_Avoid_: Roast fish, grilled fish

**Snare**:
A trap the player sets to catch rabbits.

**Fish trap**:
A basket of sticks tied with cord that the player sets in the river's water. It catches one fish every several hours while the player does other things, and holds that fish until the player takes it.
_Avoid_: Weir, creel, fish pot, basket

**Bow**:
The tool the player uses to hunt deer.

## Building

**Camp**:
Everything the player has built in the valley. It has no formal boundary.
_Avoid_: Base, settlement, home zone

**Building piece**:
One structural part of a building, such as a foundation, log wall, door frame, roof frame, or roof section. Building pieces snap to a grid and cost materials.
_Avoid_: Block, part, module

**Floor**:
A building piece of 2 planks that covers one finished foundation square. The player walks on it as on the bare deck. Furniture, a campfire, or a fireplace can stand on it. A square holds one floor.
_Avoid_: Floorboards, deck

**Lean-to**:
The first shelter the player builds: a sloped roof of sticks and bark on a frame, open at the front. It is one structure, not a set of building pieces.
_Avoid_: Shack, tent, hut

**Roof frame**:
The timber skeleton of one foundation square, built on its walls before the roof. Level beams lie on the wall tops, and sloped rafters rest on the beams. The frame sets which way the roof slopes. The roof section laid on it is only planks.
_Avoid_: Truss, rafters (for the whole frame)

**Roof section**:
The planks laid on one roof frame, in overlapping rows. Only a finished roof section keeps the rain off.
_Avoid_: Roof tile, shingle

**Door**:
A building piece of 3 planks that hangs in a finished door frame. It opens by itself when the player walks through, and closes behind them. It never changes where the player can walk. A door frame with a door cannot come down.
_Avoid_: Gate, hatch

**Window**:
A building piece of 3 debarked logs on one edge of a foundation square: a log wall with an opening in it, and no glass. It blocks walking like a log wall. Shutters hang in a finished window. A window with shutters cannot come down.
_Avoid_: Window frame, opening, hole

**Shutters**:
A building piece of 2 planks that hangs in a finished window. The player opens and closes them by hand, and they stay that way until the player changes them. Finished shutters start closed. Open shutters let daylight into the room.
_Avoid_: Window panes, curtains, blinds

**Ridge**:
The top line of a roof, where two slopes that face away from each other meet.
_Avoid_: Peak, apex

**Ridge section**:
The middle roof section of a roof an odd number of squares wide. It slopes down both ways from a ridge along its middle, so the ridge is centred. The game makes one by itself: the player turns the middle frame either way.

**Gable end**:
The triangle of stacked logs that closes the space between the wall top and the roof at the end of a ridge. It comes with the roof frame, so the player never builds it on its own.
_Avoid_: Gable wall, end wall

**Valley**:
The gutter where two roof slopes meet at an inside corner, as where the roofs of an L-shaped cabin join.
_Avoid_: Gutter, inside corner

**Room**:
A set of foundation squares closed in on every side by log walls, door frames, or windows, with a roof over every square. A lit campfire in a room warms the whole room.
_Avoid_: Interior, enclosure

**Snug**:
Said of a room with a finished floor on every square, a finished door in every door frame, and closed shutters in every window. A room with no door frame or window is snug once every square has a floor. The player loses warmth to the cold in a snug room at half the usual rate, by day and by night.
_Avoid_: Sealed, insulated, finished room

**Build menu**:
The menu, opened with B, of every structure the player can build and what it costs. It shows as a wheel in the middle of the screen.
_Avoid_: Build bar, build wheel, construction menu

**Blueprint**:
A see-through outline of a building piece the player has placed but not finished. It shows where the piece will go and how far along it is.
_Avoid_: Ghost, preview, plan

**Take down**:
To remove a blueprint or a finished structure and get back the materials in it. Taking down a finished structure is timed work.
_Avoid_: Demolish, deconstruct, destroy

**Construction**:
The timed work of turning a blueprint into a finished building piece. It goes one stage at a time, and each stage uses one material. When the player lacks a stage's material, they fetch it. The player can stop partway and come back later.
_Avoid_: Crafting, assembly

**Fetch**:
During construction, to walk to the next stage's material, pick it up, carry it back, and hand it to the blueprint. The player fetches one item per trip, from the nearest source within 10 m of the blueprint's edge, measured along the walking path. Sources are logs and debarked logs lying on the ground, plank and stone piles, and parked sleds. A log goes on the shoulder, and a plank or stone goes in the hands, never in the backpack. Planks and stone in the backpack are used first. The player never shapes a material on the way, so a plain log never counts for a debarked log or a plank. Construction cannot start while the player carries something the next stage does not need.
_Avoid_: Gather, collect, haul

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
The menu, opened with C, of every recipe in the game. It shows as a wheel in the middle of the screen. Recipes the player cannot follow yet show the tool or work station they are missing.
_Avoid_: Crafting window, craft wheel, recipe book

**Work station**:
A built object where the player does a specific kind of processing.
_Avoid_: Bench, crafting table

**Sawhorse**:
A work station where the player cuts debarked logs into planks.

**Saw blade**:
The metal blade the player brings into the valley. It is a material, not a tool. The player crafts it into a saw.

**Saw**:
A bow saw: a saw blade in a wooden frame. The player needs it to cut planks at a sawhorse.

**Fishing line**:
The line and hook the player brings into the valley, wound on a small wooden winder. It is a material, not a tool. The player crafts it into a fishing rod.
_Avoid_: String, hook

**Fishing rod**:
A tool made from a fishing line tied to two sticks. The player crafts it by hand with the knife, and needs it to catch fish at the river.
_Avoid_: Pole

**Furniture**:
An object placed freely inside or around a building, such as a bed, table, or shelf. Furniture does not snap to the grid.
_Avoid_: Decoration, prop

**Chest**:
Furniture that stores small materials, tools, and food, grouped by kind. It has a weight limit. Putting things in chests is how the player keeps the camp organised.
_Avoid_: Box, crate, container, storage

**Shelf**:
Furniture that stores small materials, tools, and food, like a chest, but holds less. It stands on the ground.
_Avoid_: Rack, cupboard, bookcase

**Bedroll**:
A rolled mat the player starts the game with and carries in the backpack. The player lays it on the ground or inside a lean-to and sleeps on it. It restores fatigue more slowly than a bed.
_Avoid_: Sleeping bag, mat

**Bed**:
Furniture built from planks that the player sleeps in. It restores fatigue faster than a bedroll and becomes the respawn point when slept in.
_Avoid_: Cot, bunk

**Table**:
Furniture built from planks. Food eaten within reach of a table restores more hunger.
_Avoid_: Desk, bench

**Stool**:
Furniture built from planks that the player sits on. Sitting slowly restores fatigue while time runs at normal speed.
_Avoid_: Chair, seat

**Rain barrel**:
Furniture built from planks that catches rain and holds up to 6 drinks of clean water. It fills only while rain falls on it, so a barrel under a roof stays dry. The player drinks from it or fills the pot from it. Its water never goes bad.
_Avoid_: Water butt, cistern, tank

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
A stone building piece built from stone on one foundation square. It does everything a campfire does, and its fuel lasts longer. A lit fireplace heats the room it is in. The player can build it before the walls and roof.
_Avoid_: Hearth, stove

**Chimney**:
A stone building piece built on a finished fireplace. It rises through the roof, and the fireplace's smoke comes out of its top. It is only for looks: a fireplace heats its room the same with or without one. The player can build it before or after the roof.
_Avoid_: Flue, stack

**Unfired jug**:
A jug the player has shaped by hand from 2 clay but not yet fired. Shaping it needs no tool. The player carries it in the backpack. It cannot hold water.
_Avoid_: Raw jug, green jug

**Fire** (verb):
To harden an unfired jug on a lit campfire or fireplace until it becomes a jug. Firing takes 20 game minutes. If the fire goes out, the jug keeps its progress, and firing carries on when the fire is lit again. A campfire or fireplace fires one jug at a time, beside the pot and the fish. Taking an unfired jug off early sets its progress back to zero. A fired jug can stay on the fire for as long as the player likes, and the player takes it off by hand into the backpack.
_Avoid_: Bake, kiln

**Jug**:
A fired clay vessel that holds up to 3 drinks of clean water. The player fills it by pouring in a pot of clean water, one drink per pour, so a jug never holds unsafe water. Each drink fills thirst completely. An empty jug weighs 1 kg. A jug never breaks, and a dropped jug keeps its water.
_Avoid_: Pot, crock, bottle, flask

**Torch**:
A light the player makes by hand from a stick and bark. The player carries unlit torches in the backpack. Lighting one with the steel and flint puts it in the player's hand, where it lights the ground around them for 3 game hours, then is gone. The player holds one lit torch at a time. A torch gives no warmth, and rain does not put it out. Putting it out throws it away, so a torch is never lit twice.
_Avoid_: Lantern, brand

**Planted torch**:
A lit torch the player has stood in the ground or on a foundation, at their feet. It keeps burning for the time it had left, even while the player sleeps, and lights the ground around it. It does not block walking. Picking it up puts it back in the player's hand. Two planted torches stand at least 1 m apart.
_Avoid_: Torch post, standing torch

## Guidance

**Journal**:
The player's list of suggested goals, in a fixed order, from a first campfire to a first snug room. Following it is optional, and the player can hide it.
_Avoid_: Quest log, objectives, achievements

**Goal**:
One thing the journal suggests the player do, such as lighting a campfire or building a lean-to. A goal is done the first time the player does it, and it stays done even if the player later takes the thing down.
_Avoid_: Quest, objective, task, achievement

## Weather and time

**Rain**:
Weather that falls outside winter. Being out in the rain without a roof overhead drains the player's warmth.

**Snowfall**:
Weather that falls only in winter, in place of rain.
_Avoid_: Snowstorm, blizzard

**Snow cover**:
The snow lying on the ground, trees, and roofs. It builds up over winter and melts in early spring.
_Avoid_: Snow (on its own, it is unclear whether it means the weather or the ground)

**Wind**:
The breeze that sways plants and treetops. It blows harder in the rain. It never affects the player or the camp.
_Avoid_: Breeze, gust

**Day**:
One full cycle of daylight and night in the valley.

**Season**:
One of the four parts of the year: spring, summer, autumn, and winter. All four last the same number of days. A new game starts on the first day of spring.

**Year**:
The four seasons in order. When winter ends, the next year starts with spring, and the cycle never stops.

**Winter**:
The hard season. A player who prepared shelter, firewood, and food gets through it. One who did not will collapse.

## Sound

**Ambience**:
A sound of the valley itself, such as the river, the forest, a fire, rain, birdsong, or crickets. It plays whether or not the player is working. Birdsong does not come from any bird the player can see.
_Avoid_: Background sound, environment sound

**Action sound**:
A sound the player's work or movement makes, such as chopping, sawing, building, or footsteps.
_Avoid_: Sound effect, SFX

**Volume**:
The player's single sound setting. It sets how loud every sound plays, and the player can mute it.
_Avoid_: Master volume, sound level

## Saved games

**Saved game**:
The whole state of one game, kept in a save slot so the player can continue it later.
_Avoid_: Save file, savegame, backup

**Save slot**:
One of the few places a saved game is kept. Each slot holds at most one saved game.
_Avoid_: Profile, save

**Continue**:
To go on playing the saved game in a save slot.
_Avoid_: Load, resume

**Export**:
To copy the saved game in a save slot into a file on the player's computer. The slot keeps its saved game.
_Avoid_: Download, backup, save as

**Import**:
To put the saved game from a file into a save slot, replacing whatever the slot held. Importing does not start the game. The player continues it afterwards.
_Avoid_: Load, upload, restore

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

**Asset showcase**:
One asset drawn on its own in four labelled views, or played live when it is an animation, so the owner can review it.
_Avoid_: Preview, demo page

**Asset browser**:
The page that lists every asset in the asset catalogue and shows the chosen asset's showcase beside the list.
_Avoid_: Storybook, asset gallery

**Player motion**:
An animation asset that poses the player in code, such as fishing or crafting by hand, together with its props. Each player motion lives in its own module.
_Avoid_: Player animation, player pose
