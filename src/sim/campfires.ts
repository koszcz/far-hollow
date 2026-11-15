import type { CampfireFuel, CampfireView, Command, Refusal } from "./api";
import { hasInBackpack, removeFromBackpack } from "./backpack";
import { toolRefusal } from "./refusals";
import { snapToGridSquare } from "./build-grid";
import { campfireEntities, playerEntities, type Entity, type EntityStore } from "./entities";
import { cookProgress, isCooked } from "./fish-on-fire";
import { boilProgress } from "./pot-state";
import { isRoomHeated, roomAround } from "./rooms";
import { groundDistance, type GroundPoint } from "./valley";
import { walkBeside, type Walking } from "./walking";

/** How many game minutes one of each kind of fuel keeps a campfire burning. Bark burns like sticks. Firewood burns longer. */
export const FUEL_BURN_MINUTES: Readonly<Record<CampfireFuel, number>> = {
  stick: 20,
  bark: 20,
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
  /** Lights a campfire within the player's reach with the steel and flint. It needs fuel. */
  light(campfireId: number): void;
  /** Why the player could not add this fuel to the campfire, or light it, wherever they stand. */
  refusal(command: Extract<Command, { type: "addFuel" | "lightCampfire" }>): Refusal | undefined;
  /** The campfire as the HUD shows it, or undefined if the entity is not a finished campfire. */
  describe(campfireId: number): CampfireView | undefined;
  /** True if the player stands still within reach of the campfire, so they can tend it now. */
  inReach(campfireId: number): boolean;
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

  /** Why the player could not light the campfire: it has no fuel, or they lack the steel and flint. A lit fire gives no refusal. */
  function lightRefusal(campfire: CampfireEntity): Refusal | undefined {
    if (campfire.campfire.lit) return undefined;
    return campfire.campfire.fuelMinutes <= 0 ? { kind: "fireEmpty" } : toolRefusal(players.first, "steelAndFlint");
  }

  /** True if the campfire is out and the player could light it. Lighting it also needs the player within reach. */
  function canLight(campfire: CampfireEntity): boolean {
    return !campfire.campfire.lit && lightRefusal(campfire) === undefined;
  }

  /** Why the player could not put one piece of this fuel on the campfire: the backpack holds none, or it would not fit. */
  function fuelRefusal(campfire: CampfireEntity, fuel: CampfireFuel): Refusal | undefined {
    const backpack = players.first?.backpack;
    if (backpack === undefined || !hasInBackpack(backpack, fuel)) return { kind: "noContent", content: fuel };
    return campfire.campfire.fuelMinutes + FUEL_BURN_MINUTES[fuel] > CAMPFIRE_FUEL_LIMIT_MINUTES ? { kind: "fireFull" } : undefined;
  }

  return {
    tend(campfireId) {
      const campfire = campfireById(campfireId);
      if (campfire === undefined) return;
      // The player stands beside the fire on the player's side, since the fire itself blocks walking.
      for (const player of players) walkBeside(walking, player.position, campfire.position, TEND_REACH_METRES, TEND_STAND_METRES);
    },
    addFuel(campfireId, fuel) {
      const campfire = campfireById(campfireId);
      if (campfire === undefined) return;
      const player = tenderOf(campfire);
      if (player?.backpack === undefined || fuelRefusal(campfire, fuel) !== undefined) return;
      if (!removeFromBackpack(player.backpack, fuel, 1)) return;
      campfire.campfire.fuelMinutes += FUEL_BURN_MINUTES[fuel];
    },
    refusal(command) {
      const campfire = campfireById(command.campfireId);
      if (campfire === undefined) return undefined;
      return command.type === "addFuel" ? fuelRefusal(campfire, command.fuel) : lightRefusal(campfire);
    },
    describe(campfireId) {
      const campfire = campfireById(campfireId);
      if (campfire === undefined) return undefined;
      const { lit, fuelMinutes } = campfire.campfire;
      const { potOnFire, fishOnFire = [] } = campfire;
      return Object.freeze({
        id: campfireId,
        lit,
        fuelLeft: fuelMinutes / CAMPFIRE_FUEL_LIMIT_MINUTES,
        fuelMinutes,
        pot: potOnFire === undefined ? null : Object.freeze({ water: potOnFire.water, boilProgress: boilProgress(potOnFire) }),
        fish: Object.freeze(fishOnFire.map((fish) => Object.freeze({ cooked: isCooked(fish), cookProgress: cookProgress(fish) }))),
      });
    },
    light(campfireId) {
      const campfire = campfireById(campfireId);
      if (campfire !== undefined && tenderOf(campfire) !== undefined && canLight(campfire)) campfire.campfire.lit = true;
    },
    inReach(campfireId) {
      const campfire = campfireById(campfireId);
      return campfire !== undefined && tenderOf(campfire) !== undefined;
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

/**
 * Whether a lit campfire warms someone standing at this spot.
 * Any lit campfire warms a spot close to it. A lit campfire on a foundation in a room also warms every square of that room, however far.
 */
export function isWarmedByCampfire(entities: EntityStore, at: GroundPoint): boolean {
  for (const { campfire, position } of campfireEntities(entities)) {
    if (campfire.lit && groundDistance(position, at) <= CAMPFIRE_WARMTH_RADIUS_METRES) return true;
  }
  const room = roomAround(entities, snapToGridSquare(at));
  return room !== undefined && isRoomHeated(entities, room);
}
