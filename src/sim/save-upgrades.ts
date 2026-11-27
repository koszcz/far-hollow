// The list of save upgrades, and the functions that bring a stored save up to the newest version.
import {
  addChests,
  addDeliveredMaterials,
  addForageSpots,
  addPiles,
  addPlanks,
  addRoofFrames,
  addSawhorses,
  addWoodpiles,
  blockWalkingAtChestsAndWoodpiles,
  countMaterialsSpent,
  faceRoofsForward,
  fillChests,
  giveBedroll,
  giveDrawknife,
  givePot,
  giveSawBlade,
  nameBlueprintStructure,
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

/** Turns a save of one version into the next version. It is given the save without its version number. */
export type SaveUpgrade = (save: Readonly<Record<string, unknown>>) => Record<string, unknown>;

/**
 * Every upgrade, in order. The first turns a version 1 save into version 2, the next turns version 2 into 3, and so on.
 * When a change to the game state would break older saves, add an upgrade to the end of this list.
 * No change may make an older save unplayable (ADR 0011).
 * A new kind of structure, notice, or component does not break older saves, so it needs no upgrade: the save check is built
 * from the structure catalogue and the notice table, and older code turns away a save that holds something it does not know.
 * Never remove or reorder an upgrade. Stored saves count on each version number keeping its place.
 * An upgrade uses its own fixed values, never the game's current rules, so it does the same thing however the game changes later.
 */
export const SAVE_UPGRADES: readonly SaveUpgrade[] = [
  addForageSpots,
  giveBedroll,
  givePot,
  giveDrawknife,
  countMaterialsSpent,
  addDeliveredMaterials,
  nameBlueprintStructure,
  faceRoofsForward,
  addWoodpiles,
  addChests,
  addPiles,
  fillChests,
  scatterDroppedSticks,
  blockWalkingAtChestsAndWoodpiles,
  renameNotEmptyNotice,
  addSawhorses,
  giveSawBlade,
  addPlanks,
  nameStationInNotice,
  addRoofFrames,
  turnAwayLargeValley,
  addSleds,
  layPlankRoofs,
  giveFishingLine,
  cookFishOnCampfires,
  payChestsInPlanks,
  putPlanksOnSleds,
  addShelves,
  addBeds,
  addTables,
  addStools,
  putFurnitureInOnePart,
  growStumpsBack,
  addStone,
  addFireplaces,
  lightFireplaces,
  addTorches,
  plantTorches,
  cookOnFireplaces,
  startApproaches,
  approachTimedTasks,
  addFloors,
  addDoors,
  recordSnugRoomNotice,
  addSaplings,
  addPlanting,
  addMushroomLogs,
  addRainBarrels,
  plantBerryBushes,
  renameMushroomLogRefusal,
  addClay,
  addUnfiredJugs,
  fireJugs,
  addFishTraps,
  fillJugs,
  matchGroundToTrees,
  addWindows,
  addJournal,
  startTheYear,
  addChimneys,
  addWallSwaps,
  spoilFreshFood,
  addDryingRacks,
  addWoodBoxes,
  smokeFish,
];

/** The version of the save format this code writes. */
export const SAVE_VERSION = SAVE_UPGRADES.length + 1;

/**
 * Every upgrade before the valley shrank, then the upgrade that puts furniture in one part. A save from the 1 km valley can no
 * longer be loaded, but tests still load older saves through these, to check what each older upgrade does.
 * The last upgrade gives any furniture in such a save the form the save check expects now.
 */
export const LARGE_VALLEY_UPGRADES: readonly SaveUpgrade[] = [...SAVE_UPGRADES.slice(0, SAVE_UPGRADES.indexOf(turnAwayLargeValley)), putFurnitureInOnePart];

/**
 * Brings a save up to the newest version the upgrades reach, one version at a time.
 * Returns undefined if the data is not a save, or its version is missing or newer than the upgrades know.
 */
export function upgradeSave(data: unknown, upgrades: readonly SaveUpgrade[] = SAVE_UPGRADES): Record<string, unknown> | undefined {
  const checked = checkVersion(data, upgrades);
  if (!checked.ok) return undefined;
  let upgraded = checked.save;
  for (const upgrade of upgrades.slice(checked.version - 1)) upgraded = upgrade(upgraded);
  return { version: upgrades.length + 1, ...upgraded };
}

export type VersionCheck = { ok: true; version: number; save: Record<string, unknown> } | { ok: false; reason: "notASave" | "newerVersion" };

/**
 * Splits stored data into its version and the rest of the save.
 * The data must be an object with a whole-number version, from 1 up to the newest version that `upgrades` reach.
 */
export function checkVersion(data: unknown, upgrades: readonly SaveUpgrade[]): VersionCheck {
  if (typeof data !== "object" || data === null) return { ok: false, reason: "notASave" };
  const { version, ...save } = data as Record<string, unknown>;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return { ok: false, reason: "notASave" };
  if (version > upgrades.length + 1) return { ok: false, reason: "newerVersion" };
  return { ok: true, version, save };
}
