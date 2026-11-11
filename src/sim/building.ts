import type { PlacementCheck } from "./api";
import { removeFromBackpack } from "./backpack";
import { playerEntities, setComponent, type EntityStore } from "./entities";
import { CAMPFIRE_STICK_COST, structureOf, type QuarterTurns, type StructureKind } from "./structures";
import { groundDistance, terrainHeightAt, type GroundPoint, type Valley } from "./valley";
import type { Walking } from "./walking";

export { CAMPFIRE_STICK_COST } from "./structures";

/** Building pieces snap to a square grid this wide, in metres (ADR 0002). */
export const BUILD_GRID_METRES = 1;

/** How long the player holds the build action to build a campfire, in seconds. */
export const CAMPFIRE_BUILD_SECONDS = 5;
/** A finished campfire stops the player walking within this many metres of its centre. */
const CAMPFIRE_WALK_BLOCK_RADIUS_METRES = 0.8;

/** The player walks to a spot this far from a blueprint's centre to build it, in metres. */
const BUILD_STAND_METRES = 1.5;
/** The player can build a blueprint from this far from its centre, in metres. */
const BUILD_REACH_METRES = 2.5;

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
   * Building goes on for as long as the build action is held, until the piece is finished or the sticks run out.
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
        blueprint: { piece: structure, progress: 0, sticksSpent: 0 },
        facing: { turns },
        position: { ...spot },
      });
    },
    build(blueprintId) {
      const blueprint = entities.entity(blueprintId);
      if (blueprint?.blueprint === undefined || blueprint.position === undefined) return;
      for (const player of players) {
        const dx = player.position.x - blueprint.position.x;
        const dz = player.position.z - blueprint.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > BUILD_REACH_METRES) {
          // Stand beside the blueprint on the player's side, not on top of it, so a finished piece never traps them.
          const away = distance > 0 ? { x: dx / distance, z: dz / distance } : { x: 1, z: 0 };
          walking.walkTo({
            x: blueprint.position.x + away.x * BUILD_STAND_METRES,
            z: blueprint.position.z + away.z * BUILD_STAND_METRES,
          });
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
        if (groundDistance(position, builder.position) > BUILD_REACH_METRES) {
          // The player walked as close as they could but the blueprint is out of reach.
          entities.removeComponent(builder, "buildTask");
          continue;
        }
        // Each stage needs its stick before work on it can start.
        if (blueprint.sticksSpent < stageOf(blueprint.progress) + 1) {
          if (!removeFromBackpack(builder.backpack, "stick", 1)) {
            entities.removeComponent(builder, "buildTask");
            continue;
          }
          blueprint.sticksSpent += 1;
        }
        blueprint.progress = Math.min(blueprint.sticksSpent / CAMPFIRE_STICK_COST, blueprint.progress + stepSeconds / CAMPFIRE_BUILD_SECONDS);
        if (blueprint.progress < 1) continue;
        entities.removeComponent(builder, "buildTask");
        entities.removeComponent(target, "blueprint");
        entities.addComponent(target, "campfire", { lit: false, fuelMinutes: 0 });
        entities.addComponent(target, "blocksWalking", { radius: CAMPFIRE_WALK_BLOCK_RADIUS_METRES });
      }
    },
  };
}

/** Which stage of construction a blueprint is in, from 0 to one less than its stick cost. */
export function stageOf(progress: number): number {
  // The small allowance stops rounding errors from holding a stage back at its very end.
  return Math.min(CAMPFIRE_STICK_COST - 1, Math.floor(progress * CAMPFIRE_STICK_COST + 1e-9));
}

/** The grid spot nearest to a point. */
export function snapToBuildGrid(at: GroundPoint): GroundPoint {
  return { x: Math.round(at.x / BUILD_GRID_METRES) * BUILD_GRID_METRES, z: Math.round(at.z / BUILD_GRID_METRES) * BUILD_GRID_METRES };
}
