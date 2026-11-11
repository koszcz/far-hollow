// Taking down blueprints and finished building pieces, and giving back the materials in them.
import { addToBackpack, fitsInBackpack } from "./backpack";
import { BUILD_REACH_METRES, distanceOutside, footprintOf, standSpot } from "./building";
import { isOnGridSquare } from "./build-grid";
import { edgeMiddle, isEdgePiece, isEdgeTaken, squaresBeside } from "./edge-pieces";
import { blueprintEntities, campfireEntities, chestEntities, playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { standingHeightAt } from "./foundations";
import { cabinRoofOn } from "./roofs";
import { rectsOverlap } from "./structure-kind";
import { isDelivered, isFurniture, stageMaterials, structureOf, type BuildMaterial, type DeliveredMaterial, type QuarterTurns, type StructureKind } from "./structures";
import type { GroundPoint, Valley } from "./valley";
import type { Walking } from "./walking";

/** Taking a finished piece down takes this share of the time building it took. */
const TAKE_DOWN_SHARE_OF_BUILD = 0.5;
/** Materials given back on the ground are laid this far apart, in metres, so they do not overlap. */
const LAY_SPACING_METRES = 0.4;

/** The player while taking a piece down. */
type Worker = Entity & Required<Pick<Entity, "position" | "backpack">>;

/**
 * Why the player could not take a piece down.
 * `backpackFull`: the bark in it would not fit in the backpack. `holdsUpPiece`: another piece stands on it.
 * `stillHoldsSomething`: it is a chest or woodpile that still holds something.
 */
export type TakeDownRefusal = "backpackFull" | "holdsUpPiece" | "stillHoldsSomething";

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
   * Sticks that do not fit, and every debarked log, go on the ground at the worker's feet.
   */
  function takeDown(worker: Worker, piece: Entity, kind: StructureKind): void {
    const { logs, backpack } = materialsIn(piece, kind);
    entities.remove(piece);
    let laid = 0;
    const layAtFeet = (components: Entity) => {
      // Each thing laid down goes a little further to one side or the other, so they do not overlap.
      const x = worker.position.x + Math.ceil(laid / 2) * (laid % 2 === 0 ? 1 : -1) * LAY_SPACING_METRES;
      const { z } = worker.position;
      laid += 1;
      entities.add({ ...components, position: { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z } });
    };
    const barkFirst = [...backpack].sort((a, b) => Number(b === "bark") - Number(a === "bark"));
    for (const material of barkFirst) {
      if (!addToBackpack(worker.backpack, material, 1)) layAtFeet({ stick: true });
    }
    for (let i = 0; i < logs; i += 1) layAtFeet({ debarkedLog: { heading: 0 } });
  }

  /** Whether all the bark in a piece fits in the backpack. Bark never goes on the ground. */
  function barkFits(backpack: Worker["backpack"], piece: Entity, kind: StructureKind): boolean {
    const bark = materialsIn(piece, kind).backpack.filter((material) => material === "bark").length;
    return fitsInBackpack(backpack, "bark", bark);
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
      if (holdsSomething(piece)) return "stillHoldsSomething";
      let refusal: TakeDownRefusal | undefined;
      for (const player of players) {
        if (player.backpack === undefined || !barkFits(player.backpack, piece, kind)) {
          refusal = "backpackFull";
          continue;
        }
        const outside = distanceOutside(footprint, player.position);
        if (outside > BUILD_REACH_METRES || outside === 0) walking.walkTo(standSpot(footprint, piece.position, player.position));
        setComponent(entities, player, "takeDownTask", { pieceId, secondsDone: 0 });
      }
      return refusal;
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
        // Another piece may have gone onto it, or the backpack filled up, since the work started.
        if (holdsUpAnother(entities, piece, kind)) refusal = "holdsUpPiece";
        else if (holdsSomething(piece)) refusal = "stillHoldsSomething";
        else if (!barkFits(worker.backpack, piece, kind)) refusal = "backpackFull";
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
 * The materials that went into a piece: the debarked logs to lay on the ground, and each stick or piece of bark for the backpack.
 * A finished piece holds its whole cost. A blueprint holds every debarked log carried to it and the backpack materials construction has spent.
 */
export function materialsIn(piece: Entity, kind: StructureKind): { logs: number; backpack: BackpackMaterial[] } {
  const stages = stageMaterials(structureOf(kind).cost);
  const blueprint = piece.blueprint;
  const spent = blueprint === undefined ? stages : stages.slice(0, blueprint.materialsSpent);
  const backpack = spent.filter((material): material is BackpackMaterial => !isDelivered(material));
  const logs = blueprint === undefined ? stages.filter(isDelivered).length : (blueprint.delivered.debarkedLog ?? 0);
  return { logs, backpack };
}

/** A material that goes back in the backpack rather than on the ground. */
type BackpackMaterial = Exclude<BuildMaterial, DeliveredMaterial>;

/**
 * Whether another piece stands on this one, so it cannot come down yet.
 * A log wall, door frame, campfire, or chest, finished or as a blueprint, stands on the foundation under it.
 * A roof section, finished or as a blueprint, rests on every wall and door frame on the edges of its square.
 * Only finished pieces hold anything up, since nothing can be placed on a blueprint.
 */
export function holdsUpAnother(entities: EntityStore, piece: Entity, kind: StructureKind): boolean {
  const { position } = piece;
  if (piece.blueprint !== undefined || position === undefined) return false;
  if (kind === "foundation") {
    if (SIDES.some((side) => isEdgeTaken(entities, edgeMiddle(position, side)))) return true;
    // A campfire stands on the foundation if its centre is on the foundation's square.
    const campfires = [...campfireEntities(entities), ...blueprintEntities(entities).entities.filter(({ blueprint }) => blueprint.piece === "campfire")];
    if (campfires.some((fire) => isOnGridSquare(position, fire.position))) return true;
    // Furniture, such as a chest, stands on every foundation its base reaches over.
    const square = footprintOf("foundation", position, 0);
    const furniture = [
      ...chestEntities(entities).entities.map(({ position: at, facing }) => footprintOf("chest", at, facing?.turns ?? 0)),
      ...blueprintEntities(entities).entities.flatMap(({ blueprint, position: at, facing }) =>
        isFurniture(blueprint.piece) ? [footprintOf(blueprint.piece, at, facing?.turns ?? 0)] : [],
      ),
    ];
    return furniture.some((base) => rectsOverlap(square, base));
  }
  if (isEdgePiece(kind)) {
    const roofPlans = blueprintEntities(entities).entities.filter(({ blueprint }) => blueprint.piece === "roof");
    return squaresBeside(position, piece.facing?.turns ?? 0).some(
      (square) => cabinRoofOn(entities, square) !== undefined || roofPlans.some((plan) => isOnGridSquare(square, plan.position)),
    );
  }
  return false;
}

/** Whether a piece is a chest or woodpile with anything in it. It must be emptied before it comes down, so nothing in it is lost. */
export function holdsSomething(piece: Entity): boolean {
  const counts = [...Object.values(piece.chest?.contents ?? {}), ...Object.values(piece.woodpile ?? {})];
  return counts.some((count) => count > 0);
}

/** The four sides of a grid square, as `edgeMiddle` numbers them. */
const SIDES: readonly QuarterTurns[] = [0, 1, 2, 3];

/**
 * What kind of structure a piece the player can take down is: a blueprint of any structure, or a finished lean-to, foundation,
 * log wall, door frame, roof section, chest, or woodpile. Undefined for anything else, such as a finished campfire.
 */
export function pieceKindOf(piece: Entity): StructureKind | undefined {
  if (piece.blueprint !== undefined) return piece.blueprint.piece;
  if (piece.leanTo === true) return "leanTo";
  if (piece.foundation === true) return "foundation";
  if (piece.edgePiece !== undefined) return piece.edgePiece;
  if (piece.cabinRoof === true) return "roof";
  if (piece.chest !== undefined) return "chest";
  if (piece.woodpile !== undefined) return "woodpile";
  return undefined;
}
