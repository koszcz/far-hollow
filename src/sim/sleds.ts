// Loading logs and debarked logs on a parked sled, taking them off one at a time, and tipping them all out. Added by sled ticket 02.
// Dragging a sled behind the player, and letting go of it. Added by sled ticket 03.
import type { SledView } from "./api";
import { distanceOutside } from "./building";
import { entityWith, playerEntities, setComponent, type CarriedLog, type Entity, type EntityStore, type Vec3 } from "./entities";
import { standingHeightAt } from "./foundations";
import { USE_REACH_METRES } from "./reach";
import type { QuarterTurns } from "./structure-kind";
import { footprintOfEntity, SLED_LENGTH_METRES, SLED_WIDTH_METRES } from "./structures";
import type { Valley } from "./valley";
import { walkBeside, type Walking } from "./walking";

/** A sled holds up to this many logs and debarked logs in all, in any mix. */
export const SLED_CAPACITY = 6;
/** The player walks to a spot this far from a sled's middle to use it, in metres. */
const SLED_STAND_METRES = 1.3;
/** A log tipped out of a sled lies this far out from the sled's side, in metres. Each further log on that side lies this much further out. */
const TIPPED_LOG_SPACING_METRES = 0.35;
/** While dragging a sled, the player walks at this fraction of their normal speed. It stacks with the slowdown from neglected needs. */
export const DRAG_SPEED = 0.7;
/** A dragged sled's middle stays this far behind the player, in metres: half its length, and a short pull rope. */
const DRAG_ROPE_METRES = SLED_LENGTH_METRES / 2 + 0.5;

type SledEntity = Entity & Required<Pick<Entity, "sled" | "position">>;

export interface Sleds {
  /** Walks the player beside a sled, if they are not already within reach of it. */
  tend(sledId: number): void;
  /** Puts the log or debarked log on the player's shoulder on a sled within reach. Does nothing if the sled is full or the shoulder is empty. */
  load(sledId: number): void;
  /** Takes one log or debarked log off a sled within reach onto the player's shoulder. Does nothing if the shoulder is not free or there is none. */
  take(sledId: number, log: CarriedLog): void;
  /** Lays every log on a sled within reach on the ground beside it, each on its own. */
  tipOut(sledId: number): void;
  /** The sled as the HUD shows it, near or far, or undefined if the entity is not a finished sled. */
  describe(sledId: number): SledView | undefined;
  /** True if the player stands still within reach of the sled, so they can use it now. */
  inReach(sledId: number): boolean;
  /** Starts dragging a sled within reach behind the player. Does nothing if they already drag one. */
  drag(sledId: number): void;
  /** Lets go of the sled the player drags. It stays where it is, with its load. */
  letGo(): void;
  /** The sled the player drags, as the HUD shows it, or undefined if they drag none. */
  dragged(): SledView | undefined;
  /** Pulls the dragged sled after the player, so it trails behind them. Run it after the player moves. */
  follow(): void;
}

/** Whether a sled is parked: no player drags it. A dragged sled is not parked. */
export function isParked(entities: EntityStore, sled: Entity): boolean {
  const id = entities.id(sled);
  return playerEntities(entities).entities.every((player) => player.dragging?.sledId !== id);
}

/** How many logs and debarked logs a sled holds in all. */
export function sledTotal(contents: Readonly<Record<CarriedLog, number>>): number {
  return contents.log + contents.debarkedLog;
}

/** Lets the player keep logs on parked sleds. */
export function createSleds(entities: EntityStore, walking: Walking, valley: Valley): Sleds {
  const players = playerEntities(entities);

  const sledById = (sledId: number): SledEntity | undefined => entityWith(entities, sledId, "sled", "position");

  /** The player, if they stand still within reach of the sled. Reach is measured to the sled's edge, as for E. */
  function userOf(sled: SledEntity) {
    const footprint = footprintOfEntity(sled);
    for (const player of players) {
      if (player.walkPath === undefined && distanceOutside(footprint, player.position) <= USE_REACH_METRES) return player;
    }
    return undefined;
  }

  /** Lays one log of each kind on the sled on the ground beside it, alternating sides and working outwards. */
  function layBeside(sled: SledEntity, logs: readonly CarriedLog[]): void {
    const turnRadians = -(sled.facing?.turns ?? 0) * (Math.PI / 2);
    // The runners run along x when the sled faces the default way. Its sides are along z.
    const along = { x: Math.cos(turnRadians), z: -Math.sin(turnRadians) };
    const across = { x: Math.sin(turnRadians), z: Math.cos(turnRadians) };
    const heading = Math.atan2(along.x, along.z);
    logs.forEach((kind, index) => {
      const side = index % 2 === 0 ? 1 : -1;
      const out = SLED_WIDTH_METRES / 2 + TIPPED_LOG_SPACING_METRES * (1 + Math.floor(index / 2));
      const x = sled.position.x + across.x * side * out;
      const z = sled.position.z + across.z * side * out;
      const position: Vec3 = { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z };
      entities.add({ [kind]: { heading }, position });
    });
  }

  function describe(sled: SledEntity): SledView | undefined {
    const id = entities.id(sled);
    if (id === undefined) return undefined;
    const contents = Object.freeze({ ...sled.sled });
    return Object.freeze({ id, contents, total: sledTotal(contents), capacity: SLED_CAPACITY });
  }

  return {
    tend(sledId) {
      const sled = sledById(sledId);
      if (sled === undefined || userOf(sled) !== undefined) return;
      for (const player of players) walkBeside(walking, player.position, sled.position, 0, SLED_STAND_METRES);
    },
    load(sledId) {
      const sled = sledById(sledId);
      const player = sled === undefined ? undefined : userOf(sled);
      if (sled === undefined || player?.carrying === undefined || sledTotal(sled.sled) >= SLED_CAPACITY) return;
      sled.sled[player.carrying] += 1;
      entities.removeComponent(player, "carrying");
    },
    take(sledId, log) {
      const sled = sledById(sledId);
      const player = sled === undefined ? undefined : userOf(sled);
      if (sled === undefined || player === undefined || player.carrying !== undefined || sled.sled[log] <= 0) return;
      sled.sled[log] -= 1;
      entities.addComponent(player, "carrying", log);
    },
    tipOut(sledId) {
      const sled = sledById(sledId);
      if (sled === undefined || userOf(sled) === undefined) return;
      const logs: CarriedLog[] = [...Array<CarriedLog>(sled.sled.log).fill("log"), ...Array<CarriedLog>(sled.sled.debarkedLog).fill("debarkedLog")];
      sled.sled.log = 0;
      sled.sled.debarkedLog = 0;
      layBeside(sled, logs);
    },
    describe(sledId) {
      const sled = sledById(sledId);
      return sled === undefined ? undefined : describe(sled);
    },
    inReach(sledId) {
      const sled = sledById(sledId);
      return sled !== undefined && userOf(sled) !== undefined;
    },
    drag(sledId) {
      const sled = sledById(sledId);
      const player = sled === undefined ? undefined : userOf(sled);
      if (player === undefined || player.dragging !== undefined) return;
      entities.addComponent(player, "dragging", { sledId });
    },
    letGo() {
      for (const player of [...players]) entities.removeComponent(player, "dragging");
    },
    dragged() {
      for (const player of players) {
        const sled = player.dragging === undefined ? undefined : sledById(player.dragging.sledId);
        if (sled !== undefined) return describe(sled);
      }
      return undefined;
    },
    follow() {
      for (const player of players) {
        const sled = player.dragging === undefined ? undefined : sledById(player.dragging.sledId);
        if (sled !== undefined) pullAfter(sled, player.position);
      }
    },
  };

  /** Pulls the sled straight towards `puller` until its middle is DRAG_ROPE_METRES away, turning its runners to point at them. */
  function pullAfter(sled: SledEntity, puller: Vec3): void {
    const dx = puller.x - sled.position.x;
    const dz = puller.z - sled.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= DRAG_ROPE_METRES) return;
    const x = puller.x - (dx / distance) * DRAG_ROPE_METRES;
    const z = puller.z - (dz / distance) * DRAG_ROPE_METRES;
    Object.assign(sled.position, { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z });
    // Turned by θ, the runners run along (cos θ, -sin θ), as for facing.
    const heading = Math.atan2(-dz, dx);
    setComponent(entities, sled, "dragHeading", heading);
    const turns = (((Math.round(-heading / (Math.PI / 2)) % 4) + 4) % 4) as QuarterTurns;
    setComponent(entities, sled, "facing", { turns });
  }
}
