import type { PlacementCheck } from "./api";
import { removeFromBackpack } from "./backpack";
import { playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { stageMaterials, structureOf, type GroundRect, type QuarterTurns, type StructureKind } from "./structures";
import { terrainHeightAt, type GroundPoint, type Valley } from "./valley";
import type { Walking } from "./walking";

export { CAMPFIRE_BUILD_SECONDS, CAMPFIRE_STICK_COST } from "./structures";

/** Building pieces snap to a square grid this wide, in metres (ADR 0002). */
export const BUILD_GRID_METRES = 1;

/** The player walks to a spot this far outside the ground a blueprint covers to build it, in metres. */
const BUILD_STAND_METRES = 0.7;
/** The player can build a blueprint from this far outside the ground it covers, in metres. */
const BUILD_REACH_METRES = 1.7;

export interface Building {
  /** Where a blueprint of `structure` facing `turns` would go if placed near `at`, and whether it is allowed there. Changes nothing. */
  checkPlacement(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): PlacementCheck;
  /**
   * Places a blueprint of `structure` facing `turns` at the grid spot nearest to `at`. Placing costs nothing.
   * Does nothing if the structure's placement rule refuses the spot.
   */
  place(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): void;
  /**
   * Starts the player building a blueprint, walking to it first if needed.
   * Building goes on for as long as the build action is held, until the piece is finished or the backpack lacks the next material.
   */
  build(blueprintId: number): void;
  /** Stops the player building, or walking to build. The blueprint keeps its progress. */
  cancel(): void;
  /** Moves construction on by one logic step. Run it after walking has moved the player. */
  step(stepSeconds: number): void;
}

/** Lets the player place blueprints and turn them into finished building pieces. */
export function createBuilding(entities: EntityStore, walking: Walking, valley: Valley): Building {
  const players = playerEntities(entities);
  const builders = entities.with("buildTask", "position", "backpack");

  function checkPlacement(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): PlacementCheck {
    const { x, z } = snapToBuildGrid(at);
    const allowed = structureOf(structure).canPlace({ entities, walkMap: walking.walkMap }, { x, z }, turns);
    return Object.freeze({ spot: Object.freeze({ x, y: terrainHeightAt(valley.terrain, x, z), z }), allowed });
  }

  return {
    checkPlacement,
    place(structure, at, turns) {
      const { spot, allowed } = checkPlacement(structure, at, turns);
      if (!allowed) return;
      entities.add({
        blueprint: { piece: structure, progress: 0, materialsSpent: 0 },
        facing: { turns },
        position: { ...spot },
      });
    },
    build(blueprintId) {
      const blueprint = entities.entity(blueprintId);
      if (blueprint?.blueprint === undefined || blueprint.position === undefined) return;
      const footprint = footprintOf(blueprint.blueprint.piece, blueprint.position, blueprint.facing?.turns ?? 0);
      for (const player of players) {
        const outside = distanceOutside(footprint, player.position);
        // A player standing on the blueprint steps off it too, so a finished piece never traps them.
        if (outside > BUILD_REACH_METRES || outside === 0) {
          // Stand just outside the blueprint on the player's side.
          walking.walkTo(standSpot(footprint, blueprint.position, player.position));
        }
        setComponent(entities, player, "buildTask", { blueprintId });
      }
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "buildTask");
    },
    step(stepSeconds) {
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const builder of [...builders]) {
        if (builder.walkPath) continue;
        const target = entities.entity(builder.buildTask.blueprintId);
        const blueprint = target?.blueprint;
        const position = target?.position;
        if (target === undefined || blueprint === undefined || position === undefined) {
          entities.removeComponent(builder, "buildTask");
          continue;
        }
        const footprint = footprintOf(blueprint.piece, position, target.facing?.turns ?? 0);
        if (distanceOutside(footprint, builder.position) > BUILD_REACH_METRES) {
          // The player walked as close as they could but the blueprint is out of reach.
          entities.removeComponent(builder, "buildTask");
          continue;
        }
        const structure = structureOf(blueprint.piece);
        const stages = stageMaterials(structure.cost);
        // Each stage needs its material before work on it can start.
        if (blueprint.materialsSpent < stageOf(blueprint.progress, stages.length) + 1) {
          const material = stages[blueprint.materialsSpent];
          if (material === undefined || !removeFromBackpack(builder.backpack, material, 1)) {
            entities.removeComponent(builder, "buildTask");
            continue;
          }
          blueprint.materialsSpent += 1;
        }
        blueprint.progress = Math.min(blueprint.materialsSpent / stages.length, blueprint.progress + stepSeconds / structure.buildSeconds);
        if (blueprint.progress < 1) continue;
        entities.removeComponent(builder, "buildTask");
        entities.removeComponent(target, "blueprint");
        const finished = structure.finish({ x: position.x, z: position.z }, target.facing?.turns ?? 0);
        for (const key of Object.keys(finished) as (keyof Entity)[]) entities.addComponent(target, key, finished[key]);
      }
    },
  };
}

/** Which stage of construction a blueprint is in, from 0 to one less than its number of stages. */
export function stageOf(progress: number, stages: number): number {
  // The small allowance stops rounding errors from holding a stage back at its very end.
  return Math.min(stages - 1, Math.floor(progress * stages + 1e-9));
}

/** The grid spot nearest to a point. */
export function snapToBuildGrid(at: GroundPoint): GroundPoint {
  return { x: Math.round(at.x / BUILD_GRID_METRES) * BUILD_GRID_METRES, z: Math.round(at.z / BUILD_GRID_METRES) * BUILD_GRID_METRES };
}

/** The ground a blueprint of `piece` covers at `at`, facing `turns`. */
function footprintOf(piece: StructureKind, at: GroundPoint, turns: QuarterTurns): GroundRect {
  return structureOf(piece).footprint({ x: at.x, z: at.z }, turns);
}

/** How far a spot lies outside a rectangle, in metres. It is 0 for a spot inside it. */
function distanceOutside(rect: GroundRect, spot: GroundPoint): number {
  const dx = Math.max(rect.min.x - spot.x, 0, spot.x - rect.max.x);
  const dz = Math.max(rect.min.z - spot.z, 0, spot.z - rect.max.z);
  return Math.hypot(dx, dz);
}

/** Where the player stands to build: just outside the blueprint, on the line from its centre towards the player. */
function standSpot(rect: GroundRect, centre: GroundPoint, player: GroundPoint): GroundPoint {
  const dx = player.x - centre.x;
  const dz = player.z - centre.z;
  const distance = Math.hypot(dx, dz);
  const away = distance > 0 ? { x: dx / distance, z: dz / distance } : { x: 1, z: 0 };
  // How far along that line the edge of the blueprint is.
  const halfX = (rect.max.x - rect.min.x) / 2;
  const halfZ = (rect.max.z - rect.min.z) / 2;
  const toEdge = Math.min(away.x === 0 ? Infinity : halfX / Math.abs(away.x), away.z === 0 ? Infinity : halfZ / Math.abs(away.z));
  const reach = toEdge + BUILD_STAND_METRES;
  return { x: centre.x + away.x * reach, z: centre.z + away.z * reach };
}
