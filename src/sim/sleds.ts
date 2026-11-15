// Loading logs and debarked logs on a parked sled, taking them off one at a time, and tipping them all out.
// Loading every plank from the backpack on a parked sled, and taking as many back as fit.
// Dragging a sled behind the player, and letting go of it.
import type { Command, Refusal, SledView } from "./api";
import { addToBackpack, countInBackpack, howManyFit, removeFromBackpack } from "./backpack";
import { distanceOutside } from "./building";
import {
  entityWith,
  playerEntities,
  setComponent,
  woodpileEntities,
  type CarriedLog,
  type Entity,
  type EntityStore,
  type SledLoad,
  type Vec3,
} from "./entities";
import { standingHeightAt } from "./foundations";
import { addToPileAt } from "./piles";
import { USE_REACH_METRES } from "./reach";
import { shoulderRefusal } from "./refusals";
import type { QuarterTurns } from "./structure-kind";
import { footprintOfEntity, SLED_LENGTH_METRES, SLED_WIDTH_METRES } from "./structures";
import type { Valley } from "./valley";
import { walkBeside, type Walking } from "./walking";
import { CARRIED_LOGS } from "./wood-and-fuel";
import { stackOnWoodpile } from "./woodpiles";

/** A sled has this many log spaces. Each holds one log, one debarked log, or PLANKS_PER_LOG_SPACE planks, in any mix. */
export const SLED_CAPACITY = 6;
/** How many planks fit in one log space on a sled. */
export const PLANKS_PER_LOG_SPACE = 4;
/** The plank pile tipped out of a sled lies this far behind the back end of the sled, in metres. */
const TIPPED_PLANKS_BEHIND_METRES = 0.5;
/**
 * The player walks to within this far of a sled's edge to use it, in metres.
 * Beside the sled's long side, that is 1.3 m from its middle, where the player has always stood.
 */
const SLED_STAND_METRES = 1.3 - SLED_WIDTH_METRES / 2;
/** A log tipped out of a sled lies this far out from the sled's side, in metres. Each further log on that side lies this much further out. */
const TIPPED_LOG_SPACING_METRES = 0.35;
/** While dragging a sled, the player walks at this fraction of their normal speed. It stacks with the slowdown from neglected needs. */
export const DRAG_SPEED = 0.7;
/** A dragged sled's middle stays this far behind the player, in metres: half its length, and a short rope. */
const DRAG_ROPE_METRES = SLED_LENGTH_METRES / 2 + 0.5;
/** A woodpile is next to a sled if its centre is within this many metres of the sled's edge. Tipping out then stacks the logs on it. */
const WOODPILE_NEXT_TO_SLED_METRES = 1.5;

export type SledEntity = Entity & Required<Pick<Entity, "sled" | "position">>;

/** A command the player carries out on a parked sled. */
type SledCommand = Extract<Command, { type: "loadSled" | "takeFromSled" | "loadPlanksOnSled" | "takePlanksFromSled" | "tipOutSled" | "dragSled" }>;

export interface Sleds {
  /** Walks the player beside a sled, if they are not already within reach of it. */
  tend(sledId: number): void;
  /** Why the player could not carry out a command on a sled, wherever they stand. */
  refusal(command: SledCommand): Refusal | undefined;
  /** Puts the log or debarked log on the player's shoulder on a sled within reach. Does nothing if the sled is full or the shoulder is empty. */
  load(sledId: number): void;
  /** Takes one log or debarked log off a sled within reach onto the player's shoulder. Does nothing if the shoulder is not free or there is none. */
  take(sledId: number, log: CarriedLog): void;
  /** Moves every plank in the backpack onto a sled within reach, as far as it has room. */
  loadPlanks(sledId: number): void;
  /** Moves as many planks off a sled within reach into the backpack as fit. Returns `backpackFull` if none fit. */
  takePlanks(sledId: number): "backpackFull" | undefined;
  /**
   * Tips everything off a sled within reach. With a woodpile next to the sled, the logs go on the woodpile as far as it has room.
   * The rest are laid on the ground beside the sled, each on its own. The planks drop in one pile behind it. A woodpile never takes planks.
   */
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
  /** Drags the dragged sled after the player, so it trails behind them. Run it after the player moves. */
  follow(): void;
}

/** Whether an entity is a finished sled. */
export function isSled(entity: Entity): entity is SledEntity {
  return entity.sled !== undefined && entity.position !== undefined;
}

/** How many of a sled's log spaces its load fills. Each plank fills a quarter of one, so the total can be a fraction. */
export function sledTotal(contents: Readonly<SledLoad>): number {
  return CARRIED_LOGS.reduce((total, log) => total + contents[log], 0) + contents.plank / PLANKS_PER_LOG_SPACE;
}

/** How many more planks fit on a sled with this load. */
export function planksThatFitOnSled(contents: Readonly<SledLoad>): number {
  const logs = CARRIED_LOGS.reduce((total, log) => total + contents[log], 0);
  return Math.max(0, (SLED_CAPACITY - logs) * PLANKS_PER_LOG_SPACE - contents.plank);
}

/** How many more logs or debarked logs fit on a sled with this load. A log needs a whole log space free. */
export function logsThatFitOnSled(contents: Readonly<SledLoad>): number {
  return Math.floor(planksThatFitOnSled(contents) / PLANKS_PER_LOG_SPACE);
}

/** Puts up to `count` planks on a sled, as far as it has room. Returns how many went on. */
export function putPlanksOnSled(sled: Pick<SledEntity, "sled">, count: number): number {
  const loaded = Math.min(count, planksThatFitOnSled(sled.sled));
  sled.sled.plank += loaded;
  return loaded;
}

/** Takes one log or debarked log off a sled, if it holds one. */
export function takeOffSled(sled: Pick<SledEntity, "sled">, log: CarriedLog): void {
  if (sled.sled[log] > 0) sled.sled[log] -= 1;
}

/**
 * Lays every log and debarked log on a sled on the ground beside it, each on its own, and leaves the sled empty.
 * They alternate sides and work outwards. The planks drop in one pile behind the sled, joining a plank pile within 1 m.
 * Tipping out and taking a sled down both use it.
 */
export function layLoadBeside(entities: EntityStore, valley: Valley, sled: SledEntity): void {
  const logs: CarriedLog[] = [...Array<CarriedLog>(sled.sled.log).fill("log"), ...Array<CarriedLog>(sled.sled.debarkedLog).fill("debarkedLog")];
  const planks = sled.sled.plank;
  sled.sled.log = 0;
  sled.sled.debarkedLog = 0;
  sled.sled.plank = 0;
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
  if (planks > 0) {
    // The front of the sled leads along `along`, so the back end is the other way.
    const behind = SLED_LENGTH_METRES / 2 + TIPPED_PLANKS_BEHIND_METRES;
    addToPileAt(entities, valley.terrain, "plank", planks, { x: sled.position.x - along.x * behind, z: sled.position.z - along.z * behind });
  }
}

/** Lets the player keep logs on parked sleds. */
export function createSleds(entities: EntityStore, walking: Walking, valley: Valley): Sleds {
  const players = playerEntities(entities);
  const woodpiles = woodpileEntities(entities);

  const sledById = (sledId: number): SledEntity | undefined => entityWith(entities, sledId, "sled", "position");

  /** The player, if they stand still within reach of the sled. Reach is measured to the sled's edge, as for E. */
  function userOf(sled: SledEntity) {
    const footprint = footprintOfEntity(sled);
    for (const player of players) {
      if (player.walkPath === undefined && distanceOutside(footprint, player.position) <= USE_REACH_METRES) return player;
    }
    return undefined;
  }

  /** The woodpile next to the sled, nearest first, if any. */
  function woodpileNextTo(sled: SledEntity) {
    const footprint = footprintOfEntity(sled);
    let nearest: { woodpile: (typeof woodpiles.entities)[number]; distance: number } | undefined;
    for (const woodpile of woodpiles) {
      const distance = distanceOutside(footprint, woodpile.position);
      if (distance <= WOODPILE_NEXT_TO_SLED_METRES && (nearest === undefined || distance < nearest.distance)) nearest = { woodpile, distance };
    }
    return nearest?.woodpile;
  }

  function describe(sled: SledEntity): SledView | undefined {
    const id = entities.id(sled);
    if (id === undefined) return undefined;
    const contents = Object.freeze({ ...sled.sled });
    return Object.freeze({
      id,
      contents,
      total: sledTotal(contents),
      capacity: SLED_CAPACITY,
      logsThatFit: logsThatFitOnSled(contents),
      planksThatFit: planksThatFitOnSled(contents),
    });
  }

  /** Why the player could not carry out a command on the sled, wherever they stand. */
  function refusal(sled: SledEntity, command: SledCommand): Refusal | undefined {
    const player = players.first;
    const contents = sled.sled;
    switch (command.type) {
      case "loadSled":
        if (player?.carrying === undefined) return { kind: "noLogCarried" };
        return logsThatFitOnSled(contents) <= 0 ? { kind: "sledFull" } : undefined;
      case "takeFromSled":
        return contents[command.log] <= 0 ? { kind: "nothingToTake" } : shoulderRefusal(player);
      case "loadPlanksOnSled":
        if (player?.backpack === undefined || countInBackpack(player.backpack, "plank") <= 0) return { kind: "noContent", content: "plank" };
        return planksThatFitOnSled(contents) <= 0 ? { kind: "sledFull" } : undefined;
      case "takePlanksFromSled":
        return contents.plank <= 0 ? { kind: "nothingToTake" } : undefined;
      case "tipOutSled":
        return sledTotal(contents) <= 0 ? { kind: "nothingToTake" } : undefined;
      case "dragSled":
        // The player drags one sled at a time.
        return player?.dragging === undefined ? undefined : { kind: "letGoFirst" };
    }
  }

  /** The sled and the player standing within reach of it, if the command may be carried out now. */
  function usable(command: SledCommand) {
    const sled = sledById(command.sledId);
    const player = sled === undefined ? undefined : userOf(sled);
    if (sled === undefined || player === undefined || refusal(sled, command) !== undefined) return undefined;
    return { sled, player };
  }

  return {
    tend(sledId) {
      const sled = sledById(sledId);
      if (sled === undefined || userOf(sled) !== undefined) return;
      // Measure to the footprint's edge, as the reach check does, so the player never stops out of reach of a long sled.
      for (const player of players) walkBeside(walking, player.position, footprintOfEntity(sled), USE_REACH_METRES, SLED_STAND_METRES);
    },
    refusal(command) {
      const sled = sledById(command.sledId);
      return sled === undefined ? undefined : refusal(sled, command);
    },
    load(sledId) {
      const { sled, player } = usable({ type: "loadSled", sledId }) ?? {};
      if (sled === undefined || player?.carrying === undefined) return;
      sled.sled[player.carrying] += 1;
      entities.removeComponent(player, "carrying");
    },
    take(sledId, log) {
      const { sled, player } = usable({ type: "takeFromSled", sledId, log }) ?? {};
      if (sled === undefined || player === undefined) return;
      sled.sled[log] -= 1;
      entities.addComponent(player, "carrying", log);
    },
    loadPlanks(sledId) {
      const { sled, player } = usable({ type: "loadPlanksOnSled", sledId }) ?? {};
      if (sled === undefined || player?.backpack === undefined) return;
      removeFromBackpack(player.backpack, "plank", putPlanksOnSled(sled, countInBackpack(player.backpack, "plank")));
    },
    takePlanks(sledId) {
      const { sled, player } = usable({ type: "takePlanksFromSled", sledId }) ?? {};
      if (sled === undefined || player?.backpack === undefined) return undefined;
      const taken = howManyFit(player.backpack, "plank", sled.sled.plank);
      if (taken === 0) return "backpackFull";
      addToBackpack(player.backpack, "plank", taken);
      sled.sled.plank -= taken;
      return undefined;
    },
    tipOut(sledId) {
      const { sled } = usable({ type: "tipOutSled", sledId }) ?? {};
      if (sled === undefined) return;
      const woodpile = woodpileNextTo(sled);
      if (woodpile !== undefined) {
        for (const kind of CARRIED_LOGS) sled.sled[kind] -= stackOnWoodpile(woodpile, kind, sled.sled[kind]);
      }
      layLoadBeside(entities, valley, sled);
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
      const { player } = usable({ type: "dragSled", sledId }) ?? {};
      if (player === undefined) return;
      entities.addComponent(player, "dragging", { sledId });
    },
    letGo() {
      for (const player of [...players]) entities.removeComponent(player, "dragging");
    },
    dragged() {
      const dragged = draggedSled();
      return dragged === undefined ? undefined : describe(dragged.sled);
    },
    follow() {
      const dragged = draggedSled();
      if (dragged !== undefined) dragAfter(dragged.sled, dragged.player.position);
    },
  };

  /** The sled the player drags, and the player, or undefined if they drag none. */
  function draggedSled() {
    for (const player of players) {
      const sled = player.dragging === undefined ? undefined : sledById(player.dragging.sledId);
      if (sled !== undefined) return { sled, player };
    }
    return undefined;
  }

  /** Drags the sled straight towards `dragger` until its middle is DRAG_ROPE_METRES away, turning its runners to point at them. */
  function dragAfter(sled: SledEntity, dragger: Vec3): void {
    const dx = dragger.x - sled.position.x;
    const dz = dragger.z - sled.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= DRAG_ROPE_METRES) return;
    const x = dragger.x - (dx / distance) * DRAG_ROPE_METRES;
    const z = dragger.z - (dz / distance) * DRAG_ROPE_METRES;
    Object.assign(sled.position, { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z });
    // Turned by θ, the runners run along (cos θ, -sin θ), as for facing.
    const heading = Math.atan2(-dz, dx);
    setComponent(entities, sled, "dragHeading", heading);
    const turns = (((Math.round(-heading / (Math.PI / 2)) % 4) + 4) % 4) as QuarterTurns;
    setComponent(entities, sled, "facing", { turns });
  }
}
