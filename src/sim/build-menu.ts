import type { GameView } from "./api-game-view";
import { STRUCTURES } from "./structures";
import { isAddOn, isPlacedInRows } from "./structure-kind";

/**
 * The build menu. It lists every structure but the add-ons, which the player builds from their host.
 * It never changes during a game, so every view shares one frozen copy. With instant building, every piece on the building grid is placed in rows.
 */
function buildMenuOf(instantBuilding: boolean): GameView["buildMenu"] {
  return Object.freeze(
    STRUCTURES.flatMap(({ kind, cost, tool, placement, fixedFacing }) =>
      isAddOn(kind)
        ? []
        : Object.freeze({
            structure: kind,
            cost: Object.freeze(cost.map((item) => Object.freeze({ ...item }))),
            ...(tool === undefined ? {} : { tool }),
            placement,
            ...(fixedFacing === true ? { fixedFacing } : {}),
            ...(isPlacedInRows(placement) || (instantBuilding && placement !== "anywhere") ? { inRows: true as const } : {}),
          }),
    ),
  );
}

const BUILD_MENU = buildMenuOf(false);
const INSTANT_BUILD_MENU = buildMenuOf(true);

/** The shared build menu for a game, with instant building or without. */
export function buildMenuFor(instantBuilding: boolean): GameView["buildMenu"] {
  return instantBuilding ? INSTANT_BUILD_MENU : BUILD_MENU;
}
