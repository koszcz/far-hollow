import { countInBackpack } from "./backpack";
import { blueprintEntities, campfireEntities, playerEntities, type EntityStore } from "./entities";
import { terrainHeightAt, type GroundPoint, type Valley } from "./valley";
import { isWalkable } from "./walk-map";
import type { Walking } from "./walking";

/** Building pieces snap to a square grid this wide, in metres (ADR 0002). */
export const BUILD_GRID_METRES = 1;

/** How many sticks a campfire costs. Construction spends one at the start of each stage. */
export const CAMPFIRE_STICK_COST = 5;
/** How long the player holds the build action to build a campfire, in seconds. */
export const CAMPFIRE_BUILD_SECONDS = 5;
/** A finished campfire stops the player walking within this many metres of its centre. */
const CAMPFIRE_WALK_BLOCK_RADIUS_METRES = 0.8;
/** Two campfires, finished or not, cannot be closer than this, in metres. */
const CAMPFIRE_MIN_SPACING_METRES = 2;

/** The player walks to a spot this far from a blueprint's centre to build it, in metres. */
const BUILD_STAND_METRES = 1.5;
/** The player can build a blueprint from this far from its centre, in metres. */
const BUILD_REACH_METRES = 2.5;

export interface Building {
  /**
   * Places a campfire blueprint at the grid spot nearest to `at`. Placing costs nothing.
   * Does nothing if the spot cannot be walked on or another campfire is too close.
   */
  placeCampfire(at: GroundPoint): void;
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
  const campfires = campfireEntities(entities);
  const blueprints = blueprintEntities(entities);

  return {
    placeCampfire(at) {
      const spot = snapToBuildGrid(at);
      if (!isWalkable(walking.walkMap, spot)) return;
      for (const other of [...campfires, ...blueprints]) {
        if (Math.hypot(other.position.x - spot.x, other.position.z - spot.z) < CAMPFIRE_MIN_SPACING_METRES) return;
      }
      entities.add({
        blueprint: { piece: "campfire", progress: 0, sticksSpent: 0 },
        position: { x: spot.x, y: terrainHeightAt(valley.terrain, spot.x, spot.z), z: spot.z },
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
        if (player.buildTask) player.buildTask = { blueprintId };
        else entities.addComponent(player, "buildTask", { blueprintId });
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
        if (Math.hypot(position.x - builder.position.x, position.z - builder.position.z) > BUILD_REACH_METRES) {
          // The player walked as close as they could but the blueprint is out of reach.
          entities.removeComponent(builder, "buildTask");
          continue;
        }
        // Each stage needs its stick before work on it can start.
        if (blueprint.sticksSpent < stageOf(blueprint.progress) + 1) {
          if (countInBackpack(builder.backpack, "stick") === 0) {
            entities.removeComponent(builder, "buildTask");
            continue;
          }
          builder.backpack.contents.stick = countInBackpack(builder.backpack, "stick") - 1;
          blueprint.sticksSpent += 1;
        }
        blueprint.progress = Math.min(blueprint.sticksSpent / CAMPFIRE_STICK_COST, blueprint.progress + stepSeconds / CAMPFIRE_BUILD_SECONDS);
        if (blueprint.progress < 1) continue;
        entities.removeComponent(builder, "buildTask");
        entities.removeComponent(target, "blueprint");
        entities.addComponent(target, "campfire", { lit: false });
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
