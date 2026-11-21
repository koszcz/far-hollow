import type { CampfireFuel, CampfireView, Command, Refusal } from "./api";
import { hasInBackpack, removeFromBackpack } from "./backpack";
import { toolRefusal } from "./refusals";
import { snapToGridSquare } from "./build-grid";
import { heldFireOf, heldFires, playerEntities, type EntityStore, type HeldFire } from "./entities";
import { burnt, fuelFits, fuelShare, FUEL_LIMIT_MINUTES, withFuel, type Fire } from "./fire";
import { cookProgress, isCooked } from "./fish-on-fire";
import { boilProgress } from "./pot-state";
import { isRoomHeated, roomAround } from "./rooms";
import { groundDistance, type GroundPoint } from "./ground-point";
import type { ApproachReach } from "./approach";

export { FUEL_BURN_MINUTES } from "./fire";
/** The most fuel a campfire holds, in game minutes of burning. Fuel that would go past it is not taken. */
export const CAMPFIRE_FUEL_LIMIT_MINUTES = FUEL_LIMIT_MINUTES.campfire;
/** A lit campfire or fireplace warms anyone within this many metres of its centre. */
export const CAMPFIRE_WARMTH_RADIUS_METRES = 4;

/** The player walks to a spot this far from a fire's centre to tend it, in metres. */
const TEND_STAND_METRES = 1.5;
/** The player can tend a fire from this far from its centre, in metres. */
const TEND_REACH_METRES = 2.5;

/**
 * The player tends two kinds of fire the same way: a campfire, and the fire in a fireplace. Each command names the fire by
 * the entity id of its campfire or fireplace. The rules for fuel and burning are in fire.ts.
 */
export interface Campfires {
  /**
   * Where the player walks to tend a campfire or fireplace: beside it, on their own side, since the fire blocks walking.
   * Undefined if the entity is neither.
   */
  reach(campfireId: number): ApproachReach | undefined;
  /** Puts one piece of fuel from the backpack on a campfire or fireplace within the player's reach. Does nothing if it would not fit. */
  addFuel(campfireId: number, fuel: CampfireFuel): void;
  /** Lights a campfire or fireplace within the player's reach with the steel and flint. It needs fuel. */
  light(campfireId: number): void;
  /** Why the player could not add this fuel to the campfire or fireplace, or light it, wherever they stand. */
  refusal(command: Extract<Command, { type: "addFuel" | "lightCampfire" }>): Refusal | undefined;
  /** The campfire or fireplace as the HUD shows it, or undefined if the entity is neither, finished. */
  describe(campfireId: number): CampfireView | undefined;
  /** The campfire or fireplace with this id, if it is the one nearest the player within their reach. */
  nearestInReach(campfireId: number): HeldFire | undefined;
  /** The entity id of the campfire or fireplace nearest the player that is within their reach, if any. */
  nearbyFire(): number | undefined;
  /** Burns the fuel of every lit campfire and fireplace for this many game minutes. A fire goes out when its fuel runs out. */
  burn(gameMinutes: number): void;
}

/** Lets the player light campfires and fireplaces, and keep them fuelled. */
export function createCampfires(entities: EntityStore): Campfires {
  const players = playerEntities(entities);

  function fireById(campfireId: number): HeldFire | undefined {
    return heldFireOf(entities.entity(campfireId));
  }

  /** The player, if they stand still within reach of the fire. */
  function tenderOf({ entity }: HeldFire) {
    for (const player of players) {
      if (player.walkPath === undefined && groundDistance(entity.position, player.position) <= TEND_REACH_METRES) return player;
    }
    return undefined;
  }

  /** Puts a changed fire back on its campfire or fireplace. */
  function setFire({ entity, kind }: HeldFire, fire: Fire): void {
    entity[kind] = fire;
  }

  /** Why the player could not light the fire: it has no fuel, or they lack the steel and flint. A lit fire gives no refusal. */
  function lightRefusal({ fire }: HeldFire): Refusal | undefined {
    if (fire.lit) return undefined;
    return fire.fuelMinutes <= 0 ? { kind: "fireEmpty" } : toolRefusal(players.first, "steelAndFlint");
  }

  /** Why the player could not put one piece of this fuel on the fire: the backpack holds none, or it would not fit. */
  function fuelRefusal({ fire, kind }: HeldFire, fuel: CampfireFuel): Refusal | undefined {
    const backpack = players.first?.backpack;
    if (backpack === undefined || !hasInBackpack(backpack, fuel)) return { kind: "noContent", content: fuel };
    return fuelFits(fire, kind, fuel) ? undefined : { kind: "fireFull" };
  }

  /** Of `candidates`, the one nearest the player that is within their reach, if any. */
  function nearest<Candidate extends { readonly position: GroundPoint }>(candidates: Iterable<Candidate>): Candidate | undefined {
    let found: Candidate | undefined;
    let foundDistance = Infinity;
    for (const player of players) {
      for (const candidate of candidates) {
        const distance = groundDistance(candidate.position, player.position);
        if (distance <= TEND_REACH_METRES && distance < foundDistance) {
          found = candidate;
          foundDistance = distance;
        }
      }
    }
    return found;
  }

  function nearbyFire(): number | undefined {
    const found = nearest(heldFires(entities).map((held) => ({ held, position: held.entity.position })));
    return found === undefined ? undefined : entities.id(found.held.entity);
  }

  return {
    reach(campfireId) {
      const held = fireById(campfireId);
      if (held === undefined) return undefined;
      return { target: held.entity.position, metres: TEND_REACH_METRES, walk: { style: "beside", standMetres: TEND_STAND_METRES } };
    },
    addFuel(campfireId, fuel) {
      const held = fireById(campfireId);
      if (held === undefined) return;
      const player = tenderOf(held);
      if (player?.backpack === undefined || fuelRefusal(held, fuel) !== undefined) return;
      if (!removeFromBackpack(player.backpack, fuel, 1)) return;
      setFire(held, withFuel(held.fire, held.kind, fuel));
    },
    refusal(command) {
      const held = fireById(command.campfireId);
      if (held === undefined) return undefined;
      return command.type === "addFuel" ? fuelRefusal(held, command.fuel) : lightRefusal(held);
    },
    describe(campfireId) {
      const held = fireById(campfireId);
      if (held === undefined) return undefined;
      const { lit, fuelMinutes } = held.fire;
      const { potOnFire, fishOnFire = [] } = held.entity;
      return Object.freeze({
        id: campfireId,
        kind: held.kind,
        lit,
        fuelLeft: fuelShare(held.fire, held.kind),
        fuelMinutes,
        pot: potOnFire === undefined ? null : Object.freeze({ water: potOnFire.water, boilProgress: boilProgress(potOnFire) }),
        fish: Object.freeze(fishOnFire.map((fish) => Object.freeze({ cooked: isCooked(fish), cookProgress: cookProgress(fish) }))),
      });
    },
    light(campfireId) {
      const held = fireById(campfireId);
      if (held === undefined || held.fire.lit || tenderOf(held) === undefined || lightRefusal(held) !== undefined) return;
      setFire(held, { ...held.fire, lit: true });
    },
    nearestInReach(campfireId) {
      return nearbyFire() === campfireId ? fireById(campfireId) : undefined;
    },
    nearbyFire,
    burn(gameMinutes) {
      for (const held of heldFires(entities)) {
        if (held.fire.lit) setFire(held, burnt(held.fire, gameMinutes));
      }
    },
  };
}

/**
 * Whether a lit campfire or fireplace warms someone standing at this spot.
 * Any lit fire warms a spot close to it. A lit campfire on a foundation in a room, or a lit fireplace in a room, also warms
 * every square of that room, however far.
 */
export function isWarmedByCampfire(entities: EntityStore, at: GroundPoint): boolean {
  for (const { entity, fire } of heldFires(entities)) {
    if (fire.lit && groundDistance(entity.position, at) <= CAMPFIRE_WARMTH_RADIUS_METRES) return true;
  }
  const room = roomAround(entities, snapToGridSquare(at));
  return room !== undefined && isRoomHeated(entities, room);
}
