// The first save version that held each thing. Tests use these to load a save the way an older game did.
import {
  addPiles,
  addPlanks,
  addRoofFrames,
  addSawhorses,
  blockWalkingAtChestsAndWoodpiles,
  faceRoofsForward,
  giveSawBlade,
  nameStationInNotice,
  renameNotEmptyNotice,
  scatterDroppedSticks,
  turnAwayLargeValley,
} from "./save-upgrades-v1-to-v22";
import {
  addBeds,
  addFireplaces,
  addShelves,
  addSleds,
  addStone,
  addStools,
  addTables,
  addTorches,
  approachTimedTasks,
  cookFishOnCampfires,
  cookOnFireplaces,
  giveFishingLine,
  growStumpsBack,
  layPlankRoofs,
  lightFireplaces,
  payChestsInPlanks,
  plantTorches,
  putFurnitureInOnePart,
  putPlanksOnSleds,
  startApproaches,
} from "./save-upgrades-v22-to-v42";
import {
  addChimneys,
  addClay,
  addDoors,
  addDryingRacks,
  addFishTraps,
  addFloors,
  addJournal,
  addMushroomLogs,
  addPlanting,
  addRainBarrels,
  addSaplings,
  addUnfiredJugs,
  addWallSwaps,
  addWindows,
  addWoodBoxes,
  fillJugs,
  fireJugs,
  matchGroundToTrees,
  plantBerryBushes,
  recordSnugRoomNotice,
  renameMushroomLogRefusal,
  smokeFish,
  spoilFreshFood,
  startTheYear,
} from "./save-upgrades-from-v42";
import { SAVE_UPGRADES } from "./save-upgrades";

/** The first save version in which every roof section faces the way it slopes down. */
export const ROOFS_FACE_SAVE_VERSION = SAVE_UPGRADES.indexOf(faceRoofsForward) + 2;
/** The first save version that can hold piles. */
export const PILES_SAVE_VERSION = SAVE_UPGRADES.indexOf(addPiles) + 2;
/** The first save version in which dropped sticks lie on the ground one by one, rather than in a pile. */
export const STICKS_ON_GROUND_SAVE_VERSION = SAVE_UPGRADES.indexOf(scatterDroppedSticks) + 2;
/** The first save version in which finished chests and woodpiles block walking. */
export const CHESTS_BLOCK_WALKING_SAVE_VERSION = SAVE_UPGRADES.indexOf(blockWalkingAtChestsAndWoodpiles) + 2;
/** The first save version whose notice that a chest or woodpile still holds something is called `stillHoldsSomething`. */
export const RENAMED_NOT_EMPTY_NOTICE_SAVE_VERSION = SAVE_UPGRADES.indexOf(renameNotEmptyNotice) + 2;
/** The first save version that can hold sawhorses. */
export const SAWHORSES_SAVE_VERSION = SAVE_UPGRADES.indexOf(addSawhorses) + 2;
/** The first save version in which the player has a saw blade, for crafting the saw. */
export const CRAFTING_SAVE_VERSION = SAVE_UPGRADES.indexOf(giveSawBlade) + 2;
/** The first save version that can hold planks. */
export const PLANKS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addPlanks) + 2;
/** The first save version whose notice that no log lies beside a work station names the station. */
export const NOTICES_NAME_STATION_SAVE_VERSION = SAVE_UPGRADES.indexOf(nameStationInNotice) + 2;
/** The first save version made in the 300 m valley. Older saves cannot be loaded. */
export const SMALL_VALLEY_SAVE_VERSION = SAVE_UPGRADES.indexOf(turnAwayLargeValley) + 2;

/** The first save version in which every roof section is laid on a roof frame. */
export const ROOF_FRAMES_SAVE_VERSION = SAVE_UPGRADES.indexOf(addRoofFrames) + 2;
/** The first save version that can hold sleds. */
export const SLEDS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addSleds) + 2;
/** The first save version in which a roof section is planks rather than bark. */
export const PLANK_ROOFS_SAVE_VERSION = SAVE_UPGRADES.indexOf(layPlankRoofs) + 2;
/** The first save version in which the player has a fishing line, for crafting the fishing rod. */
export const FISHING_SAVE_VERSION = SAVE_UPGRADES.indexOf(giveFishingLine) + 2;
/** The first save version that can hold cooked fish and fish on a campfire. */
export const COOKING_SAVE_VERSION = SAVE_UPGRADES.indexOf(cookFishOnCampfires) + 2;
/** The first save version in which a new chest costs planks, and a blueprint keeps the planks it has had. */
export const PLANK_CHESTS_SAVE_VERSION = SAVE_UPGRADES.indexOf(payChestsInPlanks) + 2;
/** The first save version in which a sled can carry planks. */
export const SLED_PLANKS_SAVE_VERSION = SAVE_UPGRADES.indexOf(putPlanksOnSleds) + 2;
/** The first save version that can hold shelves. */
export const SHELVES_SAVE_VERSION = SAVE_UPGRADES.indexOf(addShelves) + 2;
/** The first save version that can hold beds. */
export const BEDS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addBeds) + 2;
/** The first save version that can hold tables. */
export const TABLES_SAVE_VERSION = SAVE_UPGRADES.indexOf(addTables) + 2;
/** The first save version that can hold stools. */
export const STOOLS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addStools) + 2;
/** The first save version in which one `furniture` part marks every finished piece of furniture. */
export const FURNITURE_PART_SAVE_VERSION = SAVE_UPGRADES.indexOf(putFurnitureInOnePart) + 2;
/** The first save version in which felled trees grow back. */
export const REGROWTH_SAVE_VERSION = SAVE_UPGRADES.indexOf(growStumpsBack) + 2;
/** The first save version that can hold stone. */
export const STONE_SAVE_VERSION = SAVE_UPGRADES.indexOf(addStone) + 2;
/** The first save version that can hold fireplaces. */
export const FIREPLACES_SAVE_VERSION = SAVE_UPGRADES.indexOf(addFireplaces) + 2;
/** The first save version in which each fireplace holds a fire, with its fuel and whether it is lit. */
export const FIREPLACE_FIRES_SAVE_VERSION = SAVE_UPGRADES.indexOf(lightFireplaces) + 2;
/** The first save version that can hold torches, unlit in the backpack or lit in the player's hand. */
export const TORCHES_SAVE_VERSION = SAVE_UPGRADES.indexOf(addTorches) + 2;
/** The first save version that can hold torches planted in the ground. */
export const PLANTED_TORCHES_SAVE_VERSION = SAVE_UPGRADES.indexOf(plantTorches) + 2;
/** The first save version that can hold a pot and fish on a fireplace. */
export const FIREPLACE_COOKING_SAVE_VERSION = SAVE_UPGRADES.indexOf(cookOnFireplaces) + 2;

/** The first save version in which the player's walk to act on a thing is one pending approach, holding the command that started it. */
export const APPROACHES_SAVE_VERSION = SAVE_UPGRADES.indexOf(startApproaches) + 2;
/** The first save version that can hold floors. */
export const FLOORS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addFloors) + 2;

/** The first save version in which the player's walk to timed work, such as chopping, is a pending approach too. */
export const TIMED_APPROACHES_SAVE_VERSION = SAVE_UPGRADES.indexOf(approachTimedTasks) + 2;
/** The first save version that can hold doors and their blueprints. */
export const DOORS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addDoors) + 2;
/** The first save version that records whether the snug-room banner has shown. */
export const SNUG_ROOM_NOTICE_SAVE_VERSION = SAVE_UPGRADES.indexOf(recordSnugRoomNotice) + 2;
/** The first save version in which the backpack can hold saplings. */
export const SAPLINGS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addSaplings) + 2;
/** The first save version in which the player can plant saplings. */
export const PLANTING_SAVE_VERSION = SAVE_UPGRADES.indexOf(addPlanting) + 2;
/** The first save version that can hold mushroom logs. */
export const MUSHROOM_LOGS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addMushroomLogs) + 2;
/** The first save version that can hold rain barrels. */
export const RAIN_BARRELS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addRainBarrels) + 2;
/** The first save version in which the player can dig up and plant berry bushes. */
export const BERRY_BUSHES_SAVE_VERSION = SAVE_UPGRADES.indexOf(plantBerryBushes) + 2;
/** The first save version in which the refusal for a blueprint over a mushroom log is named `mushroomLogInTheWay`. */
export const MUSHROOM_LOG_REFUSAL_RENAMED_SAVE_VERSION = SAVE_UPGRADES.indexOf(renameMushroomLogRefusal) + 2;
/** The first save version that can hold clay. */
export const CLAY_SAVE_VERSION = SAVE_UPGRADES.indexOf(addClay) + 2;
/** The first save version that can hold unfired jugs. */
export const UNFIRED_JUGS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addUnfiredJugs) + 2;
/** The first save version that can hold a jug on a campfire or fireplace, and empty jugs. */
export const JUG_FIRING_SAVE_VERSION = SAVE_UPGRADES.indexOf(fireJugs) + 2;
/** The first save version that can hold cord and fish traps, in the backpack and set in the river. */
export const FISH_TRAPS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addFishTraps) + 2;
/** The first save version that can hold jugs with water in them. */
export const JUG_WATER_SAVE_VERSION = SAVE_UPGRADES.indexOf(fillJugs) + 2;
/** The first save version in which the ground follows the trees that stand for good, and saves when each change started. */
export const GROUND_CHANGES_SAVE_VERSION = SAVE_UPGRADES.indexOf(matchGroundToTrees) + 2;
/** The first save version that can hold windows and shutters, open or closed. */
export const WINDOWS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addWindows) + 2;
/** The first save version that records the journal's goals done and whether it is hidden. */
export const JOURNAL_SAVE_VERSION = SAVE_UPGRADES.indexOf(addJournal) + 2;
/** The first save version that records the day the year started on, which the season follows from. */
export const SEASONS_SAVE_VERSION = SAVE_UPGRADES.indexOf(startTheYear) + 2;
/** The first save version that can hold chimneys. */
export const CHIMNEYS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addChimneys) + 2;
/** The first save version that can hold a swap blueprint: a window or door frame blueprint on a finished log wall. */
export const WALL_SWAPS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addWallSwaps) + 2;
/** The first save version in which fresh food spoils, and the backpack, chests, shelves, and piles save when each food spoils. */
export const SPOILING_SAVE_VERSION = SAVE_UPGRADES.indexOf(spoilFreshFood) + 2;
/** The first save version that can hold drying racks, the food on them, and dried food. */
export const DRYING_RACKS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addDryingRacks) + 2;
/** The first save version that can hold raw fish smoking on a drying rack, and smoked fish. */
export const SMOKED_FISH_SAVE_VERSION = SAVE_UPGRADES.indexOf(smokeFish) + 2;

/** The first save version that can hold wood boxes and their blueprints. */
export const WOOD_BOXES_SAVE_VERSION = SAVE_UPGRADES.indexOf(addWoodBoxes) + 2;
