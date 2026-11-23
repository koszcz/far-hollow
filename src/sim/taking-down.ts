// Taking down blueprints and finished structures, and giving back the materials in them.
// Every structure can come down: a campfire, a lean-to, or a building piece such as a foundation, wall, roof frame, or roof section.
// A lit campfire goes out as it comes down, and any fuel still in it is lost. A fireplace comes down only once its fire is out
// and holds no fuel.
import type { Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { addToBackpack } from "./backpack";
import { holdsNone } from "./counts";
import { structureReach } from "./building";
import { isOnGridSquare } from "./build-grid";
import { isEdgePiece, squaresBeside } from "./edge-pieces";
import { blueprintEntities, lyingThings, playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { hasDoor } from "./doors";
import { hasShutters } from "./windows";
import { isColdAndEmpty } from "./fire";
import { standingHeightAt } from "./foundations";
import { cabinRoofOn } from "./roofs";
import { isSled, layLoadBeside } from "./sleds";
import { TAKEN_MATERIALS } from "./structure-kind";
import {
  costOf,
  isDelivered,
  isKept,
  isPlacedStructure,
  isTaken,
  roofFrameOn,
  stageMaterials,
  standsOnFoundation,
  structureKindOf,
  structureOf,
  type BuildMaterial,
  type DeliveredMaterial,
  type KeptMaterial,
  type PlacedStructure,
  type StructureKind,
  type TakenMaterial,
} from "./structures";
import type { Valley } from "./valley";
import type { GroundPoint } from "./ground-point";
import { cellCentre, reachableCells } from "./walk-map";
import type { Walking } from "./walking";
import type { CommandRules } from "./command-rule";

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
 * `holdsUpPiece`: another structure stands on it. `stillHoldsSomething`: it is a piece of furniture or woodpile that still holds something, or a campfire with a pot, fish, or jug on it.
 */
export type TakeDownRefusal = "holdsUpPiece" | "stillHoldsSomething";

export interface TakingDown {
  /**
   * Where the approach takes the player to take down a blueprint or finished structure: just outside the ground it covers.
   * Undefined if the entity is not one the player can take down.
   */
  reach(structureId: number): ApproachReach | undefined;
  /**
   * Starts the player taking down a blueprint or finished structure within reach. The approach runs it once they arrive.
   * Does nothing if the entity is not one the player can take down. The game calls it only once `refusal` passes.
   */
  start(structureId: number): void;
  /**
   * Why the player could not take a structure down now, wherever they stand: another structure stands on it,
   * or it still holds something. A campfire names the pot or the fish on it. A fireplace says when its fire is not out.
   */
  refusal(structureId: number): Refusal | undefined;
  /** Stops the player taking a structure down. The structure stays as it is. */
  cancel(): void;
  /** Moves taking down on by one logic step. Returns a refusal if the work had to stop. */
  step(stepSeconds: number): TakeDownRefusal | undefined;
}

/** Lets the player take down blueprints and finished structures, and get back what went into them. */
export function createTakingDown(entities: EntityStore, walking: Walking, valley: Valley): TakingDown {
  const players = playerEntities(entities);
  const workers = entities.with("takeDownTask", "position", "backpack");

  /**
   * Removes a structure and gives back its materials. Bark goes in the backpack first, then sticks, planks, and stone.
   * Bark and sticks that do not fit, and every debarked log, go on the ground near the worker, on their side of any wall.
   * Planks that do not fit go on the ground there as one pile, and so does stone.
   * Anything lying on a foundation's deck drops to the ground under it.
   */
  function takeDown(worker: Worker, structure: PlacedStructure, kind: StructureKind): void {
    const { delivered, backpack } = materialsIn(structure, kind);
    if (isSled(structure)) layLoadBeside(entities, valley, structure);
    entities.remove(structure);
    if (kind === "foundation") dropOffDeck(structure.position);
    const onGround: Entity[] = [];
    const barkFirst = [...backpack].sort((a, b) => Number(b === "bark") - Number(a === "bark"));
    const left: Partial<Record<TakenMaterial, number>> = {};
    for (const material of barkFirst) {
      if (addToBackpack(worker.backpack, material, 1)) continue;
      // Planks and stone have no form of their own on the ground, so the ones that do not fit lie there as one pile of each.
      if (isTaken(material)) left[material] = (left[material] ?? 0) + 1;
      else onGround.push({ [material]: true });
    }
    for (const content of TAKEN_MATERIALS) {
      const count = left[content] ?? 0;
      if (count > 0) onGround.push({ pile: { content, count } });
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

  /** The blueprint or finished structure with this id, if the player can take it down. */
  function placedPiece(structureId: number): PlacedStructure | undefined {
    const structure = entities.entity(structureId);
    if (structure === undefined || takeDownKindOf(structure) === undefined || !isPlacedStructure(structure)) return undefined;
    return structure;
  }

  return {
    reach(structureId) {
      const structure = placedPiece(structureId);
      const player = players.first;
      return structure === undefined || player === undefined ? undefined : structureReach(structure, player.position);
    },
    start(structureId) {
      if (placedPiece(structureId) === undefined) return;
      for (const player of players) setComponent(entities, player, "takeDownTask", { pieceId: structureId, secondsDone: 0 });
    },
    refusal(structureId) {
      const structure = entities.entity(structureId);
      const kind = structure === undefined ? undefined : takeDownKindOf(structure);
      if (structure === undefined || kind === undefined || !isPlacedStructure(structure)) return undefined;
      return takeDownRefusal(entities, structure, kind);
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "takeDownTask");
    },
    step(stepSeconds) {
      let refusal: TakeDownRefusal | undefined;
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const worker of [...workers]) {
        const structure = entities.entity(worker.takeDownTask.pieceId);
        const kind = structure === undefined ? undefined : takeDownKindOf(structure);
        if (structure === undefined || kind === undefined || !isPlacedStructure(structure)) {
          entities.removeComponent(worker, "takeDownTask");
          continue;
        }
        if (structure.blueprint === undefined) {
          worker.takeDownTask.secondsDone += stepSeconds;
          if (worker.takeDownTask.secondsDone < takeDownSeconds(kind)) continue;
        }
        entities.removeComponent(worker, "takeDownTask");
        // Another structure may have gone onto it, or something into it, since the work started.
        const why = takeDownRefusal(entities, structure, kind);
        if (why !== undefined) refusal = noticeOf(why);
        else takeDown(worker, structure, kind);
      }
      return refusal;
    },
  };
}

/** How long the player works to take down a finished structure of this kind, in seconds. A blueprint comes down at once. */
/**
 * How far the player is through taking down a finished structure, from 0 to 1, and the structure.
 * Undefined if they are not taking one down now. A blueprint is taken down at once.
 */
export function takingDownNow(entities: EntityStore, player: Entity): { progress: number; targetId: number } | undefined {
  if (player.takeDownTask === undefined) return undefined;
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
 * A finished structure holds its whole cost, or the cost it was placed with if that differs.
 * A blueprint holds every material it keeps, such as debarked logs carried to it and planks, and the sticks and bark construction has spent.
 */
export function materialsIn(structure: Entity, kind: StructureKind): { delivered: DeliveredMaterial[]; backpack: BackpackMaterial[] } {
  const stages = stageMaterials(costOf(structure, kind));
  const blueprint = structure.blueprint;
  if (blueprint === undefined) return { delivered: stages.filter(isDelivered), backpack: stages.filter(isBackpackMaterial) };
  const spent = stages.slice(0, blueprint.materialsSpent).filter((material) => !isKept(material));
  const kept = (Object.entries(blueprint.delivered) as [KeptMaterial, number][]).flatMap(([material, count]) => Array.from({ length: count }, () => material));
  return { delivered: kept.filter(isDelivered), backpack: [...spent, ...kept].filter(isBackpackMaterial) };
}

/** Whether a material goes back in the backpack rather than on the ground. */
function isBackpackMaterial(material: BuildMaterial): material is BackpackMaterial {
  return !isDelivered(material);
}

/** A material that goes back in the backpack rather than on the ground. */
type BackpackMaterial = Exclude<BuildMaterial, DeliveredMaterial>;

/**
 * Whether another structure stands on this one, so it cannot come down yet.
 * A log wall, door frame, floor, campfire, fireplace, roof frame, roof section, lean-to, or piece of furniture, finished or as a blueprint, stands on the foundation under it.
 * A roof frame, finished or as a blueprint, rests on every wall and door frame on the edges of its square.
 * A door, finished or as a blueprint, hangs in its door frame. Shutters in a window have a refusal of their own: see takeDownRefusal.
 * A roof section, finished or as a blueprint, rests on the roof frame under it.
 * Only finished structures hold anything up, since nothing can be placed on a blueprint.
 */
export function holdsUpAnother(entities: EntityStore, structure: PlacedStructure, kind: StructureKind): boolean {
  if (structure.blueprint !== undefined) return false;
  if (kind === "foundation") return standsOnFoundation(entities, structure.position);
  const blueprintsOf = (structureKind: StructureKind) => blueprintEntities(entities).entities.filter(({ blueprint }) => blueprint.structure === structureKind);
  if (isEdgePiece(kind)) {
    if (kind === "doorFrame" && hasDoor(entities, structure.position)) return true;
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
 * Why a structure cannot come down yet: another structure stands on it, it still holds something, or it is a fireplace whose
 * fire burns or holds fuel. Undefined if it can.
 */
function takeDownRefusal(entities: EntityStore, structure: PlacedStructure, kind: StructureKind): Refusal | undefined {
  // Shutters hang in a window, finished or as a blueprint, so they come down first. The refusal says so.
  if (kind === "window" && structure.blueprint === undefined && hasShutters(entities, structure.position)) return { kind: "takeShuttersDownFirst" };
  if (holdsUpAnother(entities, structure, kind)) return { kind: "holdsUpPiece" };
  if (structure.potOnFire !== undefined) return { kind: "potOnFire" };
  if (structure.fishOnFire !== undefined) return { kind: "fishOnFire" };
  if (structure.jugOnFire !== undefined) return { kind: "jugOnFire" };
  // A fireplace keeps its fire, so it comes down only once the fire is out and its fuel is gone. A campfire just goes out.
  if (structure.fireplace !== undefined && !isColdAndEmpty(structure.fireplace)) return { kind: "fireNotOut" };
  return holdsSomething(structure) ? { kind: "emptyFirst" } : undefined;
}

/** The notice the player sees when they try to take down a structure that refuses. */
function noticeOf(refusal: Refusal): TakeDownRefusal {
  return refusal.kind === "holdsUpPiece" || refusal.kind === "takeShuttersDownFirst" ? "holdsUpPiece" : "stillHoldsSomething";
}

/**
 * Whether a structure is a piece of furniture or woodpile with anything in it, or a campfire with a pot or fish on it.
 * It must be emptied before it comes down, so nothing in it is lost.
 * A loaded sled can come down: its logs are laid on the ground beside it first.
 */
export function holdsSomething(structure: Entity): boolean {
  if (structure.potOnFire !== undefined || structure.fishOnFire !== undefined || structure.jugOnFire !== undefined) return true;
  return !holdsNone(structure.storage?.contents ?? {}) || !holdsNone(structure.woodpile ?? {});
}

/** The rule for taking down a built piece. */
export function takingDownRules(takingDown: TakingDown): CommandRules<"takeDown"> {
  return {
    takeDown: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => takingDown.refusal(command.pieceId),
      approach: {
        reach: (command) => takingDown.reach(command.pieceId),
        act: (command) => {
          takingDown.start(command.pieceId);
        },
      },
    },
  };
}
