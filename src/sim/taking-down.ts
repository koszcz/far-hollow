// Taking down blueprints and finished structures, and giving back the materials in them.
// Every structure can come down: a campfire, a lean-to, or a building piece such as a foundation, wall, roof frame, or roof section.
// A lit campfire goes out as it comes down, and any fuel still in it is lost.
import { addToBackpack } from "./backpack";
import { BUILD_REACH_METRES, distanceOutside, walkWithinReach } from "./building";
import { isOnGridSquare } from "./build-grid";
import { edgeMiddle, isEdgePiece, isEdgeTaken, squaresBeside } from "./edge-pieces";
import {
  blueprintEntities,
  cabinRoofEntities,
  campfireEntities,
  chestEntities,
  leanToEntities,
  lyingThings,
  playerEntities,
  roofFrameEntities,
  setComponent,
  type Entity,
  type EntityStore,
} from "./entities";
import { standingHeightAt } from "./foundations";
import { cabinRoofOn } from "./roofs";
import { rectsOverlap, SIDES } from "./structure-kind";
import {
  footprintOfEntity,
  isDelivered,
  isFurniture,
  isPlacedStructure,
  roofFrameOn,
  stageMaterials,
  structureKindOf,
  structureOf,
  type BuildMaterial,
  type DeliveredMaterial,
  type PlacedStructure,
  type StructureKind,
} from "./structures";
import type { GroundPoint, Valley } from "./valley";
import { cellCentre, reachableCells } from "./walk-map";
import type { Walking } from "./walking";

/** Taking a finished structure down takes this share of the time building it took. */
const TAKE_DOWN_SHARE_OF_BUILD = 0.5;
/**
 * Materials given back on the ground are laid on the walk-map squares nearest the player, up to three on each,
 * side by side at these offsets across x from the square's middle, in metres. A debarked log lies along z, as long as a square,
 * so it never reaches across a square's edge, and so never through a wall.
 */
const LAY_OFFSETS_METRES = [0, -0.3, 0.3];

/** The player while taking a structure down. */
type Worker = Entity & Required<Pick<Entity, "position" | "backpack">>;

/**
 * Why the player could not take a structure down.
 * `holdsUpPiece`: another structure stands on it. `stillHoldsSomething`: it is a chest or woodpile that still holds something, or a campfire with a pot on it.
 */
export type TakeDownRefusal = "holdsUpPiece" | "stillHoldsSomething";

export interface TakingDown {
  /**
   * Sets the player walking to a blueprint or finished structure to take it down.
   * Does nothing if the entity is not one the player can take down. Returns a refusal if another structure stands on it,
   * or if it is a chest or woodpile that still holds something, or a campfire with a pot on it.
   */
  start(structureId: number): TakeDownRefusal | undefined;
  /** Stops the player taking a structure down, or walking to do it. The structure stays as it is. */
  cancel(): void;
  /** Moves taking down on by one logic step. Run it after walking has moved the player. Returns a refusal if the work had to stop. */
  step(stepSeconds: number): TakeDownRefusal | undefined;
}

/** Lets the player take down blueprints and finished structures, and get back what went into them. */
export function createTakingDown(entities: EntityStore, walking: Walking, valley: Valley): TakingDown {
  const players = playerEntities(entities);
  const workers = entities.with("takeDownTask", "position", "backpack");

  /**
   * Removes a structure and gives back its materials. Bark goes in the backpack first, then sticks.
   * Bark and sticks that do not fit, and every debarked log, go on the ground near the worker, on their side of any wall.
   * Anything lying on a foundation's deck drops to the ground under it.
   */
  function takeDown(worker: Worker, structure: PlacedStructure, kind: StructureKind): void {
    const { delivered, backpack } = materialsIn(structure, kind);
    entities.remove(structure);
    if (kind === "foundation") dropOffDeck(structure.position);
    const onGround: Entity[] = [];
    const barkFirst = [...backpack].sort((a, b) => Number(b === "bark") - Number(a === "bark"));
    for (const material of barkFirst) {
      if (!addToBackpack(worker.backpack, material, 1)) onGround.push({ [material]: true });
    }
    for (const material of delivered) onGround.push({ [material]: { heading: 0 } });
    const spots = laySpots(worker.position, onGround.length);
    onGround.forEach((components, i) => {
      const { x, z } = spots[i] ?? worker.position;
      entities.add({ ...components, position: { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z } });
    });
  }

  /** Where to lay `count` things near `from`: on the walk-map squares nearest it that the player can walk to, without crossing a wall. */
  function laySpots(from: GroundPoint, count: number): GroundPoint[] {
    const cells = reachableCells(walking.walkMap, from, Math.ceil(count / LAY_OFFSETS_METRES.length));
    return cells.flatMap((cell) => {
      const middle = cellCentre(walking.walkMap, cell);
      return LAY_OFFSETS_METRES.map((offset) => ({ x: middle.x + offset, z: middle.z }));
    });
  }

  /** Lowers everything lying on the foundation square with this middle to the ground, once the foundation is gone. */
  function dropOffDeck(square: GroundPoint): void {
    for (const lying of lyingThings(entities)) {
      if (isOnGridSquare(square, lying.position)) lying.position.y = standingHeightAt(entities, valley.terrain, lying.position);
    }
  }

  return {
    start(structureId) {
      const structure = entities.entity(structureId);
      const kind = structure === undefined ? undefined : takeDownKindOf(structure);
      if (structure === undefined || kind === undefined || !isPlacedStructure(structure)) return undefined;
      if (holdsUpAnother(entities, structure, kind)) return "holdsUpPiece";
      if (holdsSomething(structure)) return "stillHoldsSomething";
      const footprint = footprintOfEntity(structure);
      for (const player of players) {
        walkWithinReach(walking, footprint, structure.position, player.position);
        setComponent(entities, player, "takeDownTask", { pieceId: structureId, secondsDone: 0 });
      }
      return undefined;
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "takeDownTask");
    },
    step(stepSeconds) {
      let refusal: TakeDownRefusal | undefined;
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const worker of [...workers]) {
        if (worker.walkPath) continue;
        const structure = entities.entity(worker.takeDownTask.pieceId);
        const kind = structure === undefined ? undefined : takeDownKindOf(structure);
        // The worker may have got only as close as they could, still out of reach.
        if (
          structure === undefined ||
          kind === undefined ||
          !isPlacedStructure(structure) ||
          distanceOutside(footprintOfEntity(structure), worker.position) > BUILD_REACH_METRES
        ) {
          entities.removeComponent(worker, "takeDownTask");
          continue;
        }
        if (structure.blueprint === undefined) {
          worker.takeDownTask.secondsDone += stepSeconds;
          if (worker.takeDownTask.secondsDone < takeDownSeconds(kind)) continue;
        }
        entities.removeComponent(worker, "takeDownTask");
        // Another structure may have gone onto it, or something into it, since the work started.
        if (holdsUpAnother(entities, structure, kind)) refusal = "holdsUpPiece";
        else if (holdsSomething(structure)) refusal = "stillHoldsSomething";
        else takeDown(worker, structure, kind);
      }
      return refusal;
    },
  };
}

/** How long the player works to take down a finished structure of this kind, in seconds. A blueprint comes down at once. */
/**
 * How far the player is through taking down a finished structure, from 0 to 1, and the structure.
 * Undefined if they are not taking one down now. Walking there does not count, and a blueprint is taken down at once.
 */
export function takingDownNow(entities: EntityStore, player: Entity): { progress: number; targetId: number } | undefined {
  if (player.takeDownTask === undefined || player.walkPath !== undefined) return undefined;
  const piece = entities.entity(player.takeDownTask.pieceId);
  const kind = piece === undefined ? undefined : takeDownKindOf(piece);
  if (piece?.blueprint !== undefined || kind === undefined) return undefined;
  return { progress: Math.min(1, player.takeDownTask.secondsDone / takeDownSeconds(kind)), targetId: player.takeDownTask.pieceId };
}

export function takeDownSeconds(kind: StructureKind): number {
  return structureOf(kind).buildSeconds * TAKE_DOWN_SHARE_OF_BUILD;
}

/** The kind of a structure the player can take down: a blueprint of any structure, or any finished structure. Undefined for anything else. */
export function takeDownKindOf(entity: Entity): StructureKind | undefined {
  return structureKindOf(entity);
}

/**
 * The materials that went into a structure: each delivered material, such as a debarked log, to lay on the ground,
 * and each stick or piece of bark for the backpack.
 * A finished structure holds its whole cost. A blueprint holds every material carried to it and the backpack materials construction has spent.
 */
export function materialsIn(structure: Entity, kind: StructureKind): { delivered: DeliveredMaterial[]; backpack: BackpackMaterial[] } {
  const stages = stageMaterials(structureOf(kind).cost);
  const blueprint = structure.blueprint;
  const spent = blueprint === undefined ? stages : stages.slice(0, blueprint.materialsSpent);
  const backpack = spent.filter((material): material is BackpackMaterial => !isDelivered(material));
  if (blueprint === undefined) return { delivered: stages.filter(isDelivered), backpack };
  const carried = Object.entries(blueprint.delivered) as [DeliveredMaterial, number][];
  return { delivered: carried.flatMap(([material, count]) => Array.from({ length: count }, () => material)), backpack };
}

/** A material that goes back in the backpack rather than on the ground. */
type BackpackMaterial = Exclude<BuildMaterial, DeliveredMaterial>;

/**
 * Whether another structure stands on this one, so it cannot come down yet.
 * A log wall, door frame, campfire, roof frame, roof section, lean-to, or chest, finished or as a blueprint, stands on the foundation under it.
 * A roof frame, finished or as a blueprint, rests on every wall and door frame on the edges of its square.
 * A roof section, finished or as a blueprint, rests on the roof frame under it.
 * Only finished structures hold anything up, since nothing can be placed on a blueprint.
 */
export function holdsUpAnother(entities: EntityStore, structure: PlacedStructure, kind: StructureKind): boolean {
  if (structure.blueprint !== undefined) return false;
  if (kind === "foundation") return standsOnSquare(entities, structure.position);
  const blueprintsOf = (structureKind: StructureKind) => blueprintEntities(entities).entities.filter(({ blueprint }) => blueprint.structure === structureKind);
  if (isEdgePiece(kind)) {
    const frameBlueprints = blueprintsOf("roofFrame");
    return squaresBeside(structure.position, structure.facing?.turns ?? 0).some(
      (square) => roofFrameOn(entities, square) !== undefined || frameBlueprints.some((frame) => isOnGridSquare(square, frame.position)),
    );
  }
  if (kind === "roofFrame") {
    return cabinRoofOn(entities, structure.position) !== undefined || blueprintsOf("roof").some((roof) => isOnGridSquare(structure.position, roof.position));
  }
  return false;
}

/**
 * Whether a structure is a chest or woodpile with anything in it, or a campfire with a pot on it.
 * It must be emptied before it comes down, so nothing in it is lost.
 */
export function holdsSomething(structure: Entity): boolean {
  if (structure.potOnFire !== undefined) return true;
  const counts = [...Object.values(structure.chest?.contents ?? {}), ...Object.values(structure.woodpile ?? {})];
  return counts.some((count) => count > 0);
}

/**
 * Whether anything stands on the foundation square with this middle, finished or as a blueprint:
 * a log wall or door frame on one of its edges, a campfire whose centre is on it, or a roof frame, roof section, lean-to, or piece of furniture
 * over any of it. Furniture, such as a chest, stands on every foundation its base reaches over.
 */
function standsOnSquare(entities: EntityStore, square: GroundPoint): boolean {
  if (SIDES.some((side) => isEdgeTaken(entities, edgeMiddle(square, side)))) return true;
  const rect = structureOf("foundation").footprint(square, 0);
  const others = [
    ...campfireEntities(entities),
    ...leanToEntities(entities),
    ...roofFrameEntities(entities),
    ...cabinRoofEntities(entities),
    ...chestEntities(entities),
    ...blueprintEntities(entities),
  ];
  return others.some((other) => {
    const kind = structureKindOf(other);
    if (kind === undefined) return false;
    if (kind === "campfire") return isOnGridSquare(square, other.position);
    return (kind === "leanTo" || kind === "roofFrame" || kind === "roof" || isFurniture(kind)) && rectsOverlap(rect, footprintOfEntity(other));
  });
}
