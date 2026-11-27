// Keeps the ground following the trees that stand for good. See .scratch/forest-floor/spec.md.
// - Where the player digs up the sapling on a stump, no tree is left, so forest floor turns into clearing there.
// - Where a planted sapling becomes a full tree, clearing turns into forest floor round it.
// - A stump that is growing back still counts as a tree, so felling a tree alone changes nothing.
// Each spot's latest change lives on an entity, so it is saved with the game. groundMapNow in ground-types.ts applies them.
import { type EntityStore } from "./entities";
import { groundChangeEntities } from "./entity-queries";
import { isSameTreeSpot, startGroundChange, type GroundChange, type GroundChangeToward } from "./ground-change";
import type { GroundPoint } from "./ground-point";
import { createGroundMap, groundMapNow, type GroundMap } from "./ground-types";
import type { Valley } from "./valley";

export interface GroundChanges {
  /** A tree that counted went for good at this spot: the player dug up the sapling on its stump. */
  treeGone(spot: GroundPoint): void;
  /** A tree became a full tree at this spot. It changes the ground only if no tree counted there before, as for a planted sapling. */
  treeGrown(spot: GroundPoint): void;
  /** The ground map now, with every change applied as far as it has got. */
  mapNow(): GroundMap;
}

/** The latest change at each tree spot that has had one. */
export function groundChangesOf(entities: EntityStore): GroundChange[] {
  return groundChangeEntities(entities).entities.map((entity) => entity.groundChange);
}

/** Lets the ground follow the trees in this valley. `nowMinutes` reads the game clock. */
export function createGroundChanges(entities: EntityStore, valley: Valley, nowMinutes: () => number): GroundChanges {
  const start = createGroundMap(valley);
  const changes = groundChangeEntities(entities);

  /** The entity that holds the latest change at this spot, if the spot has had one. */
  function changeEntityAt(spot: GroundPoint) {
    return changes.entities.find((entity) => isSameTreeSpot(entity.groundChange, spot));
  }

  /** Whether a tree at this spot spreads forest floor, or will once its change is over. */
  function counts(spot: GroundPoint): boolean {
    const latest = changeEntityAt(spot)?.groundChange;
    if (latest !== undefined) return latest.toward === "forestFloor";
    return valley.trees.some((tree) => isSameTreeSpot(tree, spot));
  }

  function change(spot: GroundPoint, toward: GroundChangeToward): void {
    const entity = changeEntityAt(spot);
    const next = startGroundChange(spot, toward, nowMinutes(), entity?.groundChange);
    if (entity === undefined) entities.add({ groundChange: next });
    else entity.groundChange = next;
  }

  return {
    treeGone(spot) {
      if (counts(spot)) change(spot, "clearing");
    },
    treeGrown(spot) {
      if (!counts(spot)) change(spot, "forestFloor");
    },
    mapNow() {
      return groundMapNow(start, groundChangesOf(entities), nowMinutes());
    },
  };
}
