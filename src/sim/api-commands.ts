import type { BackpackContent, Food } from "./backpack";
import type { RecipeKind } from "./recipe-kind";
import type { GroundPoint } from "./ground-point";
import type { QuarterTurns } from "./quarter-turns";
import type { FoodToHang } from "./rack-food";
import type { StructureKind } from "./structure-kind";
import type { CampfireFuel, CarriedLog, WoodpileWood } from "./wood-and-fuel";

export type Command =
  | { type: "setPaused"; paused: boolean }
  /** Walk the player to a spot on the ground, given in metres from the valley's centre. */
  | ({ type: "walkTo" } & GroundPoint)
  /** Walk the player to a standing tree and chop it down. The tree is given by its entity id. */
  | { type: "chopTree"; treeId: number }
  /**
   * Walk the player to a sapling and dig it up into the backpack. It takes a few seconds and needs no tool.
   * Digging up the sapling on a stump removes the stump for good. It is refused for a bare stump, a young or full tree,
   * and when the sapling does not fit in the backpack.
   */
  | { type: "digUpSapling"; saplingId: number }
  /**
   * Walk the player to a spot and plant a sapling from the backpack there. It takes a few seconds. It is refused when the backpack
   * holds no sapling, off forest floor and clearing, near a tree, stump, or sapling, and near a structure or blueprint.
   */
  | ({ type: "plantSapling" } & GroundPoint)
  /**
   * Walk the player to a berry bush and dig it up into the backpack, with its berries if it has any. It takes a few seconds and
   * needs no tool. The bush is gone from its spot for good. It is refused when the bush and its berries do not fit in the backpack.
   */
  | { type: "digUpBerryBush"; bushId: number }
  /**
   * Walk the player to a spot and plant a berry bush from the backpack there. It takes a few seconds. It is refused when the backpack
   * holds no berry bush, off forest floor and clearing, within 1 m of a tree, stump, sapling, or berry bush, and within 1 m of a
   * mushroom log, structure, blueprint, or foundation square.
   */
  | ({ type: "plantBerryBush" } & GroundPoint)
  /** Walk the player to a log or debarked log on the ground and shoulder it. The player carries one at a time. */
  | { type: "pickUpLog"; logId: number }
  /**
   * Walk the player to a log on the ground and strip its bark with the drawknife.
   * The log becomes a debarked log, and its bark goes in the backpack, if it all fits.
   */
  | { type: "debarkLog"; logId: number }
  /**
   * Walk the player to a plain log on the ground and plant a mushroom from the backpack on it. It takes a few seconds and needs no tool.
   * The log becomes a mushroom log where it lies. It is refused for a debarked log and when the backpack holds no mushroom.
   */
  | { type: "plantMushroom"; logId: number }
  /** Walk the player to a mushroom log, given by its entity id, and take it down. It vanishes and gives nothing back. */
  | { type: "takeDownMushroomLog"; mushroomLogId: number }
  /** Walk the player to a stick on the ground and put it in the backpack, if it fits. The stick is given by its entity id. */
  | { type: "pickUpStick"; stickId: number }
  /** Walk the player to a piece of bark on the ground and put it in the backpack, if it fits. The bark is given by its entity id. */
  | { type: "pickUpBark"; barkId: number }
  /** Walk the player to a berry bush or mushroom patch, given by its entity id, and put its food in the backpack, if it all fits. */
  | { type: "forage"; spotId: number }
  /** Eat one of this food from the backpack. It fills hunger. */
  | { type: "eat"; food: Food }
  /**
   * Split a log into firewood with the axe. The firewood goes in the backpack, if it all fits.
   * Without `logId`, the player splits the log they carry. With `logId`, they walk to that log on the ground, shoulder it, then split it.
   */
  | { type: "splitLog"; logId?: number }
  /** Lay the log or debarked log the player carries on the ground at their feet. */
  | { type: "dropLog" }
  /** Walk the player to a spot on the ground, given in metres from the valley's centre, and lay the log or debarked log they carry there. */
  | ({ type: "dropLogAt" } & GroundPoint)
  /**
   * Drop all of one kind from the backpack at the player's feet, as one pile.
   * If a pile of the same kind lies within 1 m, they join that pile instead.
   */
  | { type: "dropFromBackpack"; content: BackpackContent }
  /** Walk the player to a pile, given by its entity id, and put as many of its things in the backpack as fit. The rest stay in the pile. */
  | { type: "pickUpPile"; pileId: number }
  /**
   * Place a blueprint of a structure from the build menu at the building-grid spot nearest the given spot, in metres,
   * facing `turns` quarter turns. Furniture, such as a chest, goes at the given spot itself. Placing costs nothing. Nothing happens if the structure's placement rule refuses the spot.
   * With `thenBuild`, the player starts building it at once if they have what the first stage needs, as if they had sent build.
   */
  | ({ type: "placeBlueprint"; structure: StructureKind; turns: QuarterTurns; thenBuild?: boolean } & GroundPoint)
  /**
   * Place the blueprint of a finished host's add-on on it, given by the host's entity id, such as a door in a door frame,
   * and start building it, as build does. It is refused when the host is not finished, already holds its add-on, finished
   * or as a blueprint, or something is in the way. When the player cannot start building it, the blueprint stays and a notice says why.
   */
  | { type: "buildAddOn"; hostId: number }
  /**
   * Start building a blueprint, given by its entity id. The player walks to it first if needed.
   * Construction goes on until the player sends stopBuilding, walks away, finishes, or runs out of materials.
   */
  | { type: "build"; blueprintId: number }
  /**
   * Walk the player to a blueprint, given by its entity id, and add the debarked log on their shoulder to it.
   * Nothing is added if the blueprint already has all the debarked logs it needs.
   */
  | { type: "deliverToBlueprint"; blueprintId: number }
  /**
   * Walk the player to a blueprint or finished structure, such as a lean-to or a log wall, given by its entity id, and take it down.
   * A blueprint comes down at once. A finished structure takes timed work. The player gets back every material spent on it or carried to it.
   * Debarked logs, and any sticks or bark that do not fit in the backpack, are laid on the ground near the player, on their side of any wall.
   * Nothing happens if another structure stands on it.
   */
  | { type: "takeDown"; pieceId: number }
  /** Stop building. The blueprint keeps its progress. */
  | { type: "stopBuilding" }
  /** Walk the player beside a finished campfire, given by its entity id, so they can tend it. */
  | { type: "tendCampfire"; campfireId: number }
  /**
   * Put one stick, piece of firewood, or piece of bark on a campfire or fireplace. The player walks beside it first if needed.
   * Firewood comes from the wood box nearest the fire in the same room, if one holds any, and otherwise from the backpack.
   * Sticks and bark come from the backpack.
   */
  | { type: "addFuel"; campfireId: number; fuel: CampfireFuel }
  /** Walk the player beside a finished woodpile, given by its entity id, so they can stack wood on it or take wood off. */
  | { type: "tendWoodpile"; woodpileId: number }
  /**
   * Stack wood on a woodpile. The player walks beside it first if needed. A log or debarked log comes off the player's shoulder, one at a time.
   * Firewood comes out of the backpack: one piece, or with `all` as many as the woodpile has room for.
   */
  | { type: "stackOnWoodpile"; woodpileId: number; wood: WoodpileWood; all: boolean }
  /**
   * Take wood off a woodpile. The player walks beside it first if needed. A log or debarked log goes on the player's shoulder, if it is free.
   * Firewood goes in the backpack, as much as fits.
   */
  | { type: "takeFromWoodpile"; woodpileId: number; wood: WoodpileWood }
  /** Put the log or debarked log on the player's shoulder on a parked sled, if it has room. The player walks beside it first if needed. */
  | { type: "loadSled"; sledId: number }
  /** Take one log or debarked log off a parked sled onto the player's free shoulder. The player walks beside it first if needed. */
  | { type: "takeFromSled"; sledId: number; log: CarriedLog }
  /** Move every plank in the backpack onto a parked sled, as far as it has room. The player walks beside it first if needed. */
  | { type: "loadPlanksOnSled"; sledId: number }
  /** Move as many planks from a parked sled into the backpack as fit. The player walks beside it first if needed. */
  | { type: "takePlanksFromSled"; sledId: number }
  /**
   * Lay every log on a parked sled on the ground beside it, each on its own, and drop its planks in one pile behind it.
   * The player walks beside it first if needed.
   */
  | { type: "tipOutSled"; sledId: number }
  /** Start dragging a parked sled behind the player. The player walks beside it first if needed. They drag one sled at a time. */
  | { type: "dragSled"; sledId: number }
  /** Let go of the sled the player drags. It stays where it is, with its load. */
  | { type: "letGoOfSled" }
  /**
   * Fill a parked sled with the logs and debarked logs lying within 10 m of it, measured along the walking path.
   * The player fetches them one at a time, nearest first, until the sled is full or none are left.
   */
  | { type: "fillSled"; sledId: number }
  /** Walk the player beside a finished chest, given by its entity id, and open it. It stays open until the player walks away or does something else. */
  | { type: "openChest"; chestId: number }
  /** Move one of a kind from the backpack into the open chest, or with `all` as many of that kind as fit. Logs never go in a chest. */
  | { type: "putInChest"; chestId: number; content: BackpackContent; all: boolean }
  /** Move one of a kind from the open chest into the backpack, or with `all` as many of that kind as fit. */
  | { type: "takeFromChest"; chestId: number; content: BackpackContent; all: boolean }
  /** Light a campfire with the steel and flint. The campfire needs fuel. The player walks beside it first if needed. */
  | { type: "lightCampfire"; campfireId: number }
  /** Put out a lit campfire or fireplace. The fuel left in it stays, so it can be lit again. The player walks beside it first if needed. */
  | { type: "putOutCampfire"; campfireId: number }
  /** Take the bedroll out of the backpack and lay it on the ground at the player's feet. */
  | { type: "layBedroll" }
  /** Walk the player into a finished lean-to, given by its entity id, and lay the bedroll from the backpack across its open front, under the roof. */
  | { type: "layBedrollInLeanTo"; leanToId: number }
  /** Walk the player to a laid bedroll, given by its entity id, and put it back in the backpack. */
  | { type: "pickUpBedroll"; bedrollId: number }
  /**
   * Walk the player to a laid bedroll, given by its entity id, and sleep on it. It becomes the player's respawn point.
   * At night the player sleeps until morning. By day they sleep until fatigue is restored,
   * but a sleep that would end in the night lasts until morning.
   * Other needs change for the time slept, and a collapse cuts sleep short.
   */
  | { type: "sleep"; bedrollId: number }
  /**
   * Walk the player beside a finished bed, given by its entity id, and sleep in it, by the same rules as sleeping on a bedroll.
   * A bed restores fatigue twice as fast as a bedroll. The spot where it stands becomes the player's respawn point.
   */
  | { type: "sleepInBed"; bedId: number }
  /**
   * Walk the player beside a finished stool, given by its entity id, and sit on it. While they sit, fatigue comes back slowly
   * and time runs at normal speed. The player stands up as soon as they walk or act. Sitting does not change the respawn point.
   */
  | { type: "sitOnStool"; stoolId: number }
  /**
   * Walk the player to the riverbank nearest a spot on the river, given in metres, and drink there.
   * River water is not boiled, so drinking it fills thirst but makes the player sick.
   */
  | ({ type: "drinkFromRiver" } & GroundPoint)
  /**
   * Walk the player to the river bank nearest a spot on the river, given in metres, and fish there with the fishing rod.
   * Each cast waits a random 15 to 45 game minutes for a fish, which goes in the backpack. The player casts again until
   * they do something else or a fish gets away because the backpack is full. It is refused while they carry a log,
   * and does nothing without a fishing rod.
   */
  | ({ type: "fish" } & GroundPoint)
  /**
   * Walk the player to the river bank nearest a spot on the river, given in metres, and set a fish trap from the backpack in the
   * water at the edge on their side, at the point nearest the spot. It is a quick reach, not timed work. A set trap catches one
   * fish 6 to 12 game hours later and holds it until the player takes it. It is refused without a fish trap in the backpack,
   * while the player carries a log, or less than FISH_TRAP_SPACING_METRES from another set trap.
   */
  | ({ type: "setFishTrap" } & GroundPoint)
  /**
   * Walk the player to the bank beside a set fish trap, given by its entity id, and put the fish it holds in the backpack.
   * It needs no tool, and the trap stays set. It is refused while the trap holds no fish, or when the fish does not fit.
   */
  | { type: "takeFishFromTrap"; trapId: number }
  /**
   * Walk the player to the bank beside a set fish trap, given by its entity id, and put the trap back in the backpack.
   * It is refused while the trap holds a fish, or when the trap does not fit in the backpack.
   */
  | { type: "pickUpFishTrap"; trapId: number }
  /**
   * Walk the player into reach of a spot on the river bank or in the river, given in metres, and gather one stone there.
   * It takes 4 seconds of work and needs no tool. Stone never runs out. Nothing happens for a spot off the river bank.
   * It is refused when one more stone does not fit in the backpack.
   */
  | ({ type: "gatherStone" } & GroundPoint)
  /**
   * Walk the player into reach of a spot on the river bank or in the river, given in metres, and dig one clay there by hand.
   * It takes 6 seconds of work and needs no tool. Clay never runs out. Nothing happens for a spot off the river bank.
   * It is refused when one more clay does not fit in the backpack.
   */
  | ({ type: "digClay" } & GroundPoint)
  /** Walk the player to the riverbank nearest them and fill the empty pot with river water. */
  | { type: "fillPot" }
  /** Drink the water in the full pot. Clean water fills thirst safely. Unboiled river water makes the player sick. */
  | { type: "drinkFromPot" }
  /**
   * Pour the pot of clean water from the backpack into the fullest jug that still has room. The jug gains 1 drink and the pot is
   * left empty. It is refused when the backpack holds no pot of clean water or no jug with room.
   */
  | { type: "pourIntoJug" }
  /**
   * Drink 1 drink from the emptiest jug in the backpack that holds water. It fills thirst completely. Jugs hold only clean water,
   * so it never makes the player sick. It is refused when no jug holds water.
   */
  | { type: "drinkFromJug" }
  /**
   * Walk the player within reach of a finished rain barrel, given by its entity id, and drink from it. It takes out 1 drink and
   * fills thirst completely. Its water is clean, so it never makes the player sick. It is refused while the barrel is empty.
   */
  | { type: "drinkFromRainBarrel"; barrelId: number }
  /**
   * Walk the player within reach of a finished rain barrel, given by its entity id, and fill the empty pot from it with clean water.
   * It takes out 1 drink. It is refused while the barrel is empty or the backpack holds no empty pot.
   */
  | { type: "fillPotFromRainBarrel"; barrelId: number }
  /**
   * Walk the player within reach of a finished rain barrel, given by its entity id, and pour 1 drink from it into the fullest jug
   * in the backpack that still has room. It is refused while the barrel is empty or the backpack holds no jug with room.
   */
  | { type: "fillJugFromRainBarrel"; barrelId: number }
  /**
   * Walk the player within reach of a finished drying rack, given by its entity id, and hang one of this food from the backpack on it.
   * Berries and a mushroom dry in 6 game hours, with no fire. Raw fish smokes in 4 game hours while a lit fire is close by.
   * It is refused for cooked fish, which cannot be smoked, when the backpack holds none of the food, or when the rack already
   * holds DRYING_RACK_FOOD_LIMIT foods.
   */
  | { type: "hangOnRack"; rackId: number; food: FoodToHang }
  /**
   * Walk the player within reach of a finished drying rack, given by its entity id, and take every food off it into the backpack,
   * preserved food first, as far as they fit. The rest stay on the rack. It is refused while the rack holds no food.
   */
  | { type: "takeFoodOffRack"; rackId: number }
  /**
   * Walk the player within reach of a finished wood box, given by its entity id, and move one firewood from the backpack into it,
   * or with `all` as many as fit. It is refused while the backpack holds no firewood or the box is full.
   */
  | { type: "putInWoodBox"; woodBoxId: number; all: boolean }
  /**
   * Walk the player within reach of a finished wood box, given by its entity id, and move as much of its firewood into the
   * backpack as fits. It is refused while the box is empty or not one more firewood fits in the backpack.
   */
  | { type: "takeFromWoodBox"; woodBoxId: number }
  /** Put the full pot from the backpack on a lit campfire, to boil its water. The player walks beside it first if needed. */
  | { type: "putPotOnFire"; campfireId: number }
  /** Take the pot off a campfire and put it back in the backpack. The player walks beside it first if needed. */
  | { type: "takePotOffFire"; campfireId: number }
  /**
   * Put one raw fish from the backpack on a lit campfire. It becomes cooked fish after 8 game minutes on the lit fire.
   * Nothing happens if the fire is out or already holds 3 fish. The player walks beside it first if needed.
   */
  | { type: "cookFish"; campfireId: number }
  /**
   * Take every fish off a campfire, raw or cooked, and put them in the backpack as far as they fit. The rest stay on the fire.
   * The player walks beside it first if needed.
   */
  | { type: "takeFishOff"; campfireId: number }
  /**
   * Put one unfired jug from the backpack on a lit campfire or fireplace. It becomes a jug after 20 game minutes on the lit fire.
   * Nothing happens if the fire is out or already holds a jug. The player walks beside it first if needed.
   */
  | { type: "fireJug"; campfireId: number }
  /**
   * Take the jug off a campfire or fireplace and put it in the backpack: an empty jug once it has fired, or else an unfired jug,
   * whose firing starts again from zero. It stays on the fire if it does not fit. The player walks beside it first if needed.
   */
  | { type: "takeJugOff"; campfireId: number }
  /**
   * Start crafting a recipe, given by its name. A hand recipe is crafted where the player stands, as timed work.
   * For a station recipe, the player walks to the finished work station given by `stationId`, or without one to the nearest
   * finished station of the right kind, and works there. A blueprint is not a station.
   * It is refused, with a notice saying why, if the player lacks its tool, work station, or materials, while they carry a log,
   * if the result would not fit in the backpack once the materials it uses are taken out,
   * or if the logs a station recipe uses do not lie within STATION_GROUND_METRES of the station.
   */
  | { type: "craft"; recipe: RecipeKind; stationId?: number }
  /**
   * Light a torch from the backpack with the steel and flint. It leaves the backpack and goes in the player's hand, lit for
   * TORCH_BURN_MINUTES. It is refused without the steel and flint, or while the player already holds a lit torch.
   * Nothing happens if the backpack holds no torch.
   */
  | { type: "lightTorch" }
  /** Put out the lit torch in the player's hand. It is thrown away, since a torch is never lit twice. */
  | { type: "putOutTorch" }
  /**
   * Plant the lit torch in the player's hand in the ground at their feet, or on the foundation they stand on. It keeps the time
   * it had left, and the hand is then empty. It is refused within PLANTED_TORCH_SPACING_METRES of another planted torch.
   * Nothing happens if the player holds no lit torch.
   */
  | { type: "plantTorch" }
  /**
   * Walk the player to a planted torch, given by its entity id, and take it in their hand with the time it has left.
   * It is refused while the player already holds a lit torch.
   */
  | { type: "pickUpTorch"; torchId: number }
  /**
   * Walk the player within reach of finished shutters, given by their entity id, and open them, or close them with `open` false.
   * It takes no time. The shutters stay that way until the player changes them. It is refused once the shutters are gone.
   */
  | { type: "setShutters"; shuttersId: number; open: boolean }
  /**
   * Hide the journal, or show it again with `hidden` false. Hidden, the HUD shows no next goal and no notice says when a goal is done.
   * The journal panel still opens. It is saved with the game. It does nothing in the playground, which has no journal.
   */
  | { type: "setJournalHidden"; hidden: boolean }
  /** Jumps the valley's clock forward. Lit campfires burn their fuel and the player's needs change for the time skipped. A collapse cuts the skip short. The debug overlay sends it. */
  | { type: "skipTime"; hours: number }
  /** Jumps the valley's clock forward to when rain next starts or stops, the same way skipTime does. The debug overlay sends it. */
  | { type: "skipToRainChange" }
  /**
   * Jumps the valley's clock forward to the morning hour on day 1 of the next season, the same way skipTime does.
   * A collapse does not cut it short: the player wakes the next morning and time passes on. The debug overlay sends it.
   */
  | { type: "skipToSeason" }
  /**
   * Add an action to the end of the action queue. With an empty queue, it starts at once, as if sent on its own.
   * The queue holds at most ACTION_QUEUE_LIMIT actions, counting the one under way. When it is full, or when the game
   * would refuse the action now, nothing is added and a notice says why. A command that is never queued, such as pausing,
   * placing a blueprint, or opening a chest, runs as if sent on its own.
   */
  | { type: "queueAction"; action: ActionCommand }
  /**
   * Take the action at `index` out of the action queue, as a click on its icon does. Index 0 is the action under way:
   * cancelling it stops what the player is doing for it, and the next action starts. Nothing happens if no action is there.
   */
  | { type: "cancelQueuedAction"; index: number };

/** Every command except those that change the action queue itself: what the action queue holds. */
export type ActionCommand = Exclude<Command, { type: "queueAction" | "cancelQueuedAction" }>;

/** The most actions the action queue holds, counting the one under way. */
export const ACTION_QUEUE_LIMIT = 4;

/** Wraps a command so it goes to the end of the action queue instead of replacing it. A command that changes the queue itself stays as it is. */
export function queued(command: Command): Command {
  return command.type === "queueAction" || command.type === "cancelQueuedAction" ? command : { type: "queueAction", action: command };
}
