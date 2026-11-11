// Taking down blueprints and finished building pieces, and giving back the materials in them.
import { addToBackpack } from "./backpack";
import { BUILD_REACH_METRES, distanceOutside, footprintOf, standSpot } from "./building";
import { isOnGridSquare } from "./build-grid";
import { edgeMiddle, isEdgePiece, isEdgeTaken, squaresBeside } from "./edge-pieces";
import {
  blueprintEntities, cabinRoofEntities, campfireEntities, leanToEntities, lyingThings, playerEntities, setComponent, type Entity, type EntityStore,
} from "./entities";
import { standingHeightAt } from "./foundations";
import { cabinRoofOn } from "./roofs";
import { rectsOverlap } from "./structure-kind";
import {
  isDelivered, stageMaterials, structureKindOf, structureOf, type BuildMaterial, type DeliveredMaterial, type QuarterTurns, type StructureKind,
} from "./structures";
import type { GroundPoint, Valley } from "./valley";
import { cellCentre, reachableCells } from "./walk-map";
import type { Walking } from "./walking";

/** Taking a finished piece down takes this share of the time building it took. */
const TAKE_DOWN_SHARE_OF_BUILD = 0.5;
/**
 * Materials given back on the ground are laid on the walk-map squares nearest the player, up to three on each,
 * side by side at these offsets across x from the square's middle, in metres. A debarked log lies along z, as long as a square,
 * so it never reaches across a square's edge, and so never through a wall.
 */
const LAY_OFFSETS_METRES = [0, -0.3, 0.3];

/** The player while taking a piece down. */
type Worker = Entity & Required<Pick<Entity, "position" | "backpack">>;

/** Why the player could not take a piece down: another piece stands on it. */
export type TakeDownRefusal = "holdsUpPiece";

export interface TakingDown {
  /**
   * Sets the player walking to a blueprint or finished building piece to take it down.
   * Does nothing if the entity is not one, and returns a refusal if the player cannot take it down.
   */
  start(pieceId: number): TakeDownRefusal | undefined;
  /** Stops the player taking a piece down, or walking to do it. The piece stays as it is. */
  cancel(): void;
  /** Moves taking down on by one logic step. Run it after walking has moved the player. Returns a refusal if the work had to stop. */
  step(stepSeconds: number): TakeDownRefusal | undefined;
}

/** Lets the player take down blueprints and finished building pieces, and get back what went into them. */
export function createTakingDown(entities: EntityStore, walking: Walking, valley: Valley): TakingDown {
  const players = playerEntities(entities);
  const workers = entities.with("takeDownTask", "position", "backpack");

  /**
   * Removes a piece and gives back its materials. Bark goes in the backpack first, then sticks.
   * Bark and sticks that do not fit, and every debarked log, go on the ground near the worker, on their side of any wall.
   * Anything lying on a foundation's deck drops to the ground under it.
   */
  function takeDown(worker: Worker, piece: Entity, kind: StructureKind): void {
    const { delivered, backpack } = materialsIn(piece, kind);
    entities.remove(piece);
    if (kind === "foundation" && piece.position !== undefined) dropOffDeck(piece.position);
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

  /** Whether the worker has walked close enough to the piece to work on it. They may have got only as close as they could. */
  function isInReach(worker: Worker, position: GroundPoint, piece: Entity, kind: StructureKind): boolean {
    return distanceOutside(footprintOf(kind, position, piece.facing?.turns ?? 0), worker.position) <= BUILD_REACH_METRES;
  }

  return {
    start(pieceId) {
      const piece = entities.entity(pieceId);
      const kind = piece === undefined ? undefined : pieceKindOf(piece);
      if (piece?.position === undefined || kind === undefined) return undefined;
      const footprint = footprintOf(kind, piece.position, piece.facing?.turns ?? 0);
      if (holdsUpAnother(entities, piece, kind)) return "holdsUpPiece";
      for (const player of players) {
        const outside = distanceOutside(footprint, player.position);
        if (outside > BUILD_REACH_METRES || outside === 0) walking.walkTo(standSpot(footprint, piece.position, player.position));
        setComponent(entities, player, "takeDownTask", { pieceId, secondsDone: 0 });
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
        const piece = entities.entity(worker.takeDownTask.pieceId);
        const kind = piece === undefined ? undefined : pieceKindOf(piece);
        if (piece?.position === undefined || kind === undefined || !isInReach(worker, piece.position, piece, kind)) {
          entities.removeComponent(worker, "takeDownTask");
          continue;
        }
        if (piece.blueprint === undefined) {
          worker.takeDownTask.secondsDone += stepSeconds;
          if (worker.takeDownTask.secondsDone < takeDownSeconds(kind)) continue;
        }
        entities.removeComponent(worker, "takeDownTask");
        // Another piece may have gone onto it since the work started.
        if (holdsUpAnother(entities, piece, kind)) refusal = "holdsUpPiece";
        else takeDown(worker, piece, kind);
      }
      return refusal;
    },
  };
}

/** How long the player works to take down a finished piece of this kind, in seconds. A blueprint comes down at once. */
export function takeDownSeconds(kind: StructureKind): number {
  return structureOf(kind).buildSeconds * TAKE_DOWN_SHARE_OF_BUILD;
}

/**
 * The materials that went into a piece: each delivered material, such as a debarked log, to lay on the ground,
 * and each stick or piece of bark for the backpack.
 * A finished piece holds its whole cost. A blueprint holds every material carried to it and the backpack materials construction has spent.
 */
export function materialsIn(piece: Entity, kind: StructureKind): { delivered: DeliveredMaterial[]; backpack: BackpackMaterial[] } {
  const stages = stageMaterials(structureOf(kind).cost);
  const blueprint = piece.blueprint;
  const spent = blueprint === undefined ? stages : stages.slice(0, blueprint.materialsSpent);
  const backpack = spent.filter((material): material is BackpackMaterial => !isDelivered(material));
  if (blueprint === undefined) return { delivered: stages.filter(isDelivered), backpack };
  const carried = Object.entries(blueprint.delivered) as [DeliveredMaterial, number][];
  return { delivered: carried.flatMap(([material, count]) => Array.from({ length: count }, () => material)), backpack };
}

/** A material that goes back in the backpack rather than on the ground. */
type BackpackMaterial = Exclude<BuildMaterial, DeliveredMaterial>;

/**
 * Whether another piece stands on this one, so it cannot come down yet.
 * A log wall, door frame, campfire, roof section, or lean-to, finished or as a blueprint, stands on the foundation under it.
 * A roof section, finished or as a blueprint, rests on every wall and door frame on the edges of its square.
 * Only finished pieces hold anything up, since nothing can be placed on a blueprint.
 */
export function holdsUpAnother(entities: EntityStore, piece: Entity, kind: StructureKind): boolean {
  const { position } = piece;
  if (piece.blueprint !== undefined || position === undefined) return false;
  if (kind === "foundation") return standsOnSquare(entities, position);
  if (isEdgePiece(kind)) {
    const roofBlueprints = blueprintEntities(entities).entities.filter(({ blueprint }) => blueprint.piece === "roof");
    return squaresBeside(position, piece.facing?.turns ?? 0).some(
      (square) => cabinRoofOn(entities, square) !== undefined || roofBlueprints.some((roof) => isOnGridSquare(square, roof.position)),
    );
  }
  return false;
}

/**
 * Whether anything stands on the foundation square with this middle, finished or as a blueprint:
 * a log wall or door frame on one of its edges, a campfire whose centre is on it, or a roof section or lean-to over any of it.
 */
function standsOnSquare(entities: EntityStore, square: GroundPoint): boolean {
  if (SIDES.some((side) => isEdgeTaken(entities, edgeMiddle(square, side)))) return true;
  const rect = structureOf("foundation").footprint(square, 0);
  const others = [...campfireEntities(entities), ...leanToEntities(entities), ...cabinRoofEntities(entities), ...blueprintEntities(entities)];
  return others.some((other) => {
    const kind = structureKindOf(other);
    if (kind === "campfire") return isOnGridSquare(square, other.position);
    return (kind === "leanTo" || kind === "roof") && rectsOverlap(rect, structureOf(kind).footprint(other.position, other.facing?.turns ?? 0));
  });
}

/** The four sides of a grid square, as `edgeMiddle` numbers them. */
const SIDES: readonly QuarterTurns[] = [0, 1, 2, 3];

/**
 * What kind of structure a piece the player can take down is: a blueprint of any structure, or a finished lean-to, foundation,
 * log wall, door frame, or roof section. Undefined for anything else, such as a finished campfire.
 */
export function pieceKindOf(piece: Entity): StructureKind | undefined {
  if (piece.blueprint !== undefined) return piece.blueprint.piece;
  if (piece.leanTo === true) return "leanTo";
  if (piece.foundation === true) return "foundation";
  if (piece.edgePiece !== undefined) return piece.edgePiece;
  if (piece.cabinRoof === true) return "roof";
  return undefined;
}
