import type { CampfireFuel } from "./api";
import { hasInBackpack, removeFromBackpack } from "./backpack";
import { campfireEntities, playerEntities, type Entity, type EntityStore } from "./entities";
import { groundDistance, type GroundPoint } from "./valley";
import type { Walking } from "./walking";


/** How many game minutes one of each kind of fuel keeps a campfire burning. Firewood burns longer than sticks. */
export const FUEL_BURN_MINUTES: Readonly<Record<CampfireFuel, number>> = {
  stick: 20,
  firewood: 90,
};
/** The most fuel a campfire holds, in game minutes of burning. Fuel that would go past it is not taken. */
export const CAMPFIRE_FUEL_LIMIT_MINUTES = 8 * 60;
/** A lit campfire warms anyone within this many metres of its centre. */
export const CAMPFIRE_WARMTH_RADIUS_METRES = 4;

/** A fire with this little fuel left, in game minutes, counts as out of fuel. */
const FUEL_EMPTY_MINUTES = 1e-6;
/** The player walks to a spot this far from a campfire's centre to tend it, in metres. */
const TEND_STAND_METRES = 1.5;
/** The player can tend a campfire from this far from its centre, in metres. */
const TEND_REACH_METRES = 2.5;

type CampfireEntity = Entity & { campfire: NonNullable<Entity["campfire"]>; position: NonNullable<Entity["position"]> };

export interface Campfires {
  /** Walks the player beside a campfire, if they are not already within reach of it. */
  tend(campfireId: number): void;
  /** Puts one piece of fuel from the backpack on a campfire within the player's reach. Does nothing if it would not fit. */
  addFuel(campfireId: number, fuel: CampfireFuel): void;
  /** Lights a campfire within the player's reach with the fire striker. It needs fuel. */
  light(campfireId: number): void;
  /** True if `light` would light the campfire now: it is out, it has fuel, and the player is within reach with a fire striker. */
  canLight(campfireId: number): boolean;
  /** The campfire nearest the player that is within their reach, if any. */
  nearby(): CampfireEntity | undefined;
  /** Burns the fuel of every lit campfire for this many game minutes. A fire goes out when its fuel runs out. */
  burn(gameMinutes: number): void;
}

/** Lets the player light campfires and keep them fuelled. */
export function createCampfires(entities: EntityStore, walking: Walking): Campfires {
  const players = playerEntities(entities);
  const campfires = campfireEntities(entities);

  function campfireById(campfireId: number): CampfireEntity | undefined {
    const entity = entities.entity(campfireId);
    if (entity?.campfire === undefined || entity.position === undefined) return undefined;
    return entity as CampfireEntity;
  }

  function withinReach(campfire: CampfireEntity, at: GroundPoint): boolean {
    return groundDistance(campfire.position, at) <= TEND_REACH_METRES;
  }

  /** The player, if they stand still within reach of the campfire. */
  function tenderOf(campfire: CampfireEntity) {
    for (const player of players) {
      if (player.walkPath === undefined && withinReach(campfire, player.position)) return player;
    }
    return undefined;
  }

  /** True if the campfire is out, has fuel, and a player within reach has a fire striker. */
  function canLight(campfire: CampfireEntity): boolean {
    if (campfire.campfire.lit || campfire.campfire.fuelMinutes <= 0) return false;
    const player = tenderOf(campfire);
    return player?.backpack !== undefined && hasInBackpack(player.backpack, "fireStriker");
  }

  return {
    tend(campfireId) {
      const campfire = campfireById(campfireId);
      if (campfire === undefined) return;
      for (const player of players) {
        const dx = player.position.x - campfire.position.x;
        const dz = player.position.z - campfire.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance <= TEND_REACH_METRES) continue;
        // Stand beside the fire on the player's side, since the fire itself blocks walking.
        walking.walkTo({
          x: campfire.position.x + (dx / distance) * TEND_STAND_METRES,
          z: campfire.position.z + (dz / distance) * TEND_STAND_METRES,
        });
      }
    },
    addFuel(campfireId, fuel) {
      const campfire = campfireById(campfireId);
      if (campfire === undefined) return;
      const player = tenderOf(campfire);
      if (player?.backpack === undefined) return;
      const fuelMinutes = campfire.campfire.fuelMinutes + FUEL_BURN_MINUTES[fuel];
      if (fuelMinutes > CAMPFIRE_FUEL_LIMIT_MINUTES) return;
      if (!removeFromBackpack(player.backpack, fuel, 1)) return;
      campfire.campfire.fuelMinutes = fuelMinutes;
    },
    canLight(campfireId) {
      const campfire = campfireById(campfireId);
      return campfire !== undefined && canLight(campfire);
    },
    light(campfireId) {
      const campfire = campfireById(campfireId);
      if (campfire !== undefined && canLight(campfire)) campfire.campfire.lit = true;
    },
    nearby() {
      let nearest: CampfireEntity | undefined;
      let nearestDistance = Infinity;
      for (const player of players) {
        for (const campfire of campfires) {
          const distance = groundDistance(campfire.position, player.position);
          if (distance <= TEND_REACH_METRES && distance < nearestDistance) {
            nearest = campfire;
            nearestDistance = distance;
          }
        }
      }
      return nearest;
    },
    burn(gameMinutes) {
      for (const { campfire } of campfires) {
        if (!campfire.lit) continue;
        campfire.fuelMinutes -= gameMinutes;
        // The small allowance stops rounding errors in the clock from leaving a sliver of fuel burning.
        if (campfire.fuelMinutes > FUEL_EMPTY_MINUTES) continue;
        campfire.fuelMinutes = 0;
        campfire.lit = false;
      }
    },
  };
}

/** Whether a lit campfire is close enough to warm someone standing at this spot. */
export function isWarmedByCampfire(entities: EntityStore, at: GroundPoint): boolean {
  for (const { campfire, position } of campfireEntities(entities)) {
    if (campfire.lit && groundDistance(position, at) <= CAMPFIRE_WARMTH_RADIUS_METRES) return true;
  }
  return false;
}
