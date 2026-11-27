import type { CampfireFuel, CampfireView, Command, Refusal } from "./api";
import { hasInBackpack, removeFromBackpack, type Backpack } from "./backpack";
import { toolRefusal } from "./refusals";
import { snapToGridSquare } from "./build-grid";
import { heldFireOf, heldFires, playerEntities, type EntityStore, type HeldFire } from "./entities";
import { burnt, fuelFits, fuelShare, FUEL_LIMIT_MINUTES, withFuel, type Fire } from "./fire";
import { cookProgress, isCooked } from "./fish-on-fire";
import { fireProgress, isFired } from "./jug-on-fire";
import { boilProgress } from "./pot-state";
import { isRoomHeated, roomAround } from "./rooms";
import { groundDistance, type GroundPoint } from "./ground-point";
import type { ApproachReach } from "./approach";
import type { CommandRules, RuleGame } from "./command-rule";
import { reachToward } from "./hand-reach";
import { tendApproach } from "./tending";
import type { WoodBoxes } from "./wood-boxes";

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
  /**
   * Puts one piece of fuel on a campfire or fireplace within the player's reach. Does nothing if it would not fit.
   * Firewood comes from the wood box nearest the fire in its room, if one holds any, and otherwise from the backpack.
   */
  addFuel(campfireId: number, fuel: CampfireFuel): void;
  /** Lights a campfire or fireplace within the player's reach with the steel and flint. It needs fuel. */
  light(campfireId: number): void;
  /** Puts out a lit campfire or fireplace within the player's reach. The fuel left in it stays, so it can be lit again. */
  putOut(campfireId: number): void;
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

/** Where a fire's next piece of fuel comes from: a wood box in the fire's room, given by its entity id, or a backpack. */
type FuelSource = { readonly from: "woodBox"; readonly woodBoxId: number } | { readonly from: "backpack"; readonly backpack: Backpack };

/** Lets the player light campfires and fireplaces, and keep them fuelled. A fire takes its firewood from `woodBoxes` first. */
export function createCampfires(entities: EntityStore, woodBoxes: WoodBoxes): Campfires {
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

  /**
   * Where the fire's next piece of this fuel comes from: for firewood, the wood box nearest the fire in its room that holds any,
   * and otherwise this backpack, if it holds the fuel. Undefined if neither holds any. Only firewood comes from a wood box.
   */
  function fuelSource({ entity }: HeldFire, fuel: CampfireFuel, backpack: Backpack | undefined): FuelSource | undefined {
    const woodBoxId = fuel === "firewood" ? woodBoxes.woodBoxFeedingFire(entity.position) : undefined;
    if (woodBoxId !== undefined) return { from: "woodBox", woodBoxId };
    return backpack !== undefined && hasInBackpack(backpack, fuel) ? { from: "backpack", backpack } : undefined;
  }

  /** Why the player could not put one piece of this fuel on the fire: neither a wood box in its room nor the backpack holds any, or it would not fit. */
  function fuelRefusal(held: HeldFire, fuel: CampfireFuel): Refusal | undefined {
    if (fuelSource(held, fuel, players.first?.backpack) === undefined) return { kind: "noContent", content: fuel };
    return fuelFits(held.fire, held.kind, fuel) ? undefined : { kind: "fireFull" };
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
      // Firewood comes from a wood box in the fire's room first. The player tends the fire from beside it, not from the box.
      const source = fuelSource(held, fuel, player.backpack);
      if (source === undefined) return;
      if (source.from === "woodBox") woodBoxes.takeOneForFire(source.woodBoxId);
      else if (!removeFromBackpack(source.backpack, fuel, 1)) return;
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
      const { potOnFire, fishOnFire = [], jugOnFire } = held.entity;
      return Object.freeze({
        id: campfireId,
        kind: held.kind,
        lit,
        fuelLeft: fuelShare(held.fire, held.kind),
        fuelMinutes,
        pot: potOnFire === undefined ? null : Object.freeze({ water: potOnFire.water, boilProgress: boilProgress(potOnFire) }),
        fish: Object.freeze(fishOnFire.map((fish) => Object.freeze({ cooked: isCooked(fish), cookProgress: cookProgress(fish) }))),
        jug: jugOnFire === undefined ? null : Object.freeze({ fired: isFired(jugOnFire), fireProgress: fireProgress(jugOnFire) }),
      });
    },
    light(campfireId) {
      const held = fireById(campfireId);
      if (held === undefined || held.fire.lit || tenderOf(held) === undefined || lightRefusal(held) !== undefined) return;
      setFire(held, { ...held.fire, lit: true });
    },
    putOut(campfireId) {
      const held = fireById(campfireId);
      if (held === undefined || !held.fire.lit || tenderOf(held) === undefined) return;
      setFire(held, { ...held.fire, lit: false });
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

/** The rules for tending a campfire: coming to it, adding fuel, lighting it, and putting it out. */
export function campfireRules(campfires: Campfires, game: RuleGame): CommandRules<"tendCampfire" | "addFuel" | "lightCampfire" | "putOutCampfire"> {
  const reach = (command: { campfireId: number }) => campfires.reach(command.campfireId);
  return {
    tendCampfire: {
      start: "fresh",
      approach: {
        reach,
        act: (command) => {
          reachToward(game.hand, game.entities, "low", command.campfireId);
        },
      },
    },
    addFuel: {
      start: "alongside",
      refusal: (command) => campfires.refusal(command),
      approach: tendApproach(game, reach, (command) => {
        campfires.addFuel(command.campfireId, command.fuel);
        return undefined;
      }),
    },
    lightCampfire: {
      start: "alongside",
      refusal: (command) => campfires.refusal(command),
      approach: tendApproach(game, reach, (command) => {
        campfires.light(command.campfireId);
        return undefined;
      }),
    },
    putOutCampfire: {
      start: "alongside",
      approach: tendApproach(game, reach, (command) => {
        campfires.putOut(command.campfireId);
        return undefined;
      }),
    },
  };
}
