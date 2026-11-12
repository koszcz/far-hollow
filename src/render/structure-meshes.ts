// Draws every structure, finished or as a blueprint, and the blueprint that follows the mouse while the player places one.
// It is the one place that knows which meshes draw which structure kind, so the scene renderer and the asset showcase
// add, update, pick, outline, and dispose every structure through it alone.
import * as THREE from "three";
import type { QuarterTurns, StructureKind } from "../sim/api";
import type { Entity, EntityStore, Vec3 } from "../sim/entities";
import { createCampfireMeshes } from "./campfire-meshes";
import { createChestMeshes } from "./chest-meshes";
import { createEdgePieceMeshes } from "./edge-piece-meshes";
import { createFoundationMeshes } from "./foundation-meshes";
import type { OutlinePart } from "./hover-outline";
import { createLeanToMeshes } from "./lean-to-meshes";
import type { LogShape } from "./log-shape";
import { createRoofFrameMeshes } from "./roof-frame-meshes";
import { createRoofMeshes } from "./roof-meshes";
import { createSawhorseMeshes } from "./sawhorse-meshes";
import { createWoodpileMeshes } from "./woodpile-meshes";

/** What a click on a structure landed on: a blueprint of any structure, or a finished structure the player can act on. */
export type StructureHit = { kind: "blueprint" | "campfire" | "woodpile" | "chest" | "workStation"; entity: Entity };

/** A blueprint under the mouse that the player has not placed yet, as the build menu's placement check gives it. */
export interface PlacingBlueprint {
  readonly structure: StructureKind;
  /** The building-grid spot it snaps to, on the ground, in metres. */
  readonly spot: Readonly<Vec3>;
  readonly turns: QuarterTurns;
  /** False where its placement rule refuses the spot, so it shows as not allowed. */
  readonly allowed: boolean;
}

/** What one frame of drawing needs to know. Without `camera` and `player`, no wall fades and no roof hides. */
export interface StructureFrame {
  readonly nowSeconds: number;
  /** Where the camera is. Walls between it and the player fade out. */
  readonly camera?: Vec3;
  /** Where the player is drawn. Walls in front of them fade, and the roof above them hides. */
  readonly player?: Vec3;
}

export interface StructureMeshes {
  /** Holds every structure's meshes. Add it to the scene once, and as a shadow caster. */
  readonly group: THREE.Group;
  /** Brings every structure and blueprint up to date with game state. */
  update(frame: StructureFrame): void;
  /** What a ray from the camera hits first among blueprints and finished structures the player can act on, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: StructureHit; distance: number } | undefined;
  /** The finished lean-to, foundation, wall, door frame, roof frame, or roof section a ray meets first. The right-click menu uses it. */
  pickFinished(raycaster: THREE.Raycaster): { entity: Entity; distance: number } | undefined;
  /** The parts of what a click landed on, placed in the world. Empty once it is gone. */
  outlineOf(hit: StructureHit): OutlinePart[];
  /** Shows the blueprint under the mouse while the player places one. Undefined hides it. */
  showPlacingBlueprint(placing: PlacingBlueprint | undefined): void;
  dispose(): void;
}

/** One structure kind's part in drawing: how to outline its blueprint, and how to show it under the mouse. */
interface KindDrawing {
  outlineBlueprint(entity: Entity): OutlinePart[];
  showPlacing(placing: PlacingBlueprint | undefined): void;
}

/** `groundAt` gives the height of the ground. `logShape` is the loaded log model, which woodpiles stack. */
export function createStructureMeshes(entities: EntityStore, groundAt: (x: number, z: number) => number, logShape: LogShape): StructureMeshes {
  const campfires = createCampfireMeshes(entities, groundAt);
  const leanTos = createLeanToMeshes(entities);
  const foundations = createFoundationMeshes(entities, groundAt);
  const edgePieces = createEdgePieceMeshes(entities);
  const roofFrames = createRoofFrameMeshes(entities);
  const roofs = createRoofMeshes(entities);
  const woodpiles = createWoodpileMeshes(entities, logShape);
  const chests = createChestMeshes(entities);
  const sawhorses = createSawhorseMeshes(entities);
  const all = [campfires, leanTos, foundations, edgePieces, roofFrames, roofs, woodpiles, chests, sawhorses];
  const withFinishedPicks = [leanTos, foundations, edgePieces, roofFrames, roofs];

  const group = new THREE.Group();
  group.add(...all.map((meshes) => meshes.group));

  /** How each structure kind is outlined as a blueprint and shown under the mouse. TypeScript reports a kind with no entry. */
  const drawings: { readonly [Kind in StructureKind]: KindDrawing } = {
    campfire: {
      outlineBlueprint: (entity) => campfires.outlineOf({ kind: "blueprint", entity }),
      showPlacing: (placing) => {
        campfires.showPlacingBlueprint(placing);
      },
    },
    leanTo: {
      outlineBlueprint: (entity) => leanTos.outlineOf(entity),
      showPlacing: (placing) => {
        leanTos.showPlacingBlueprint(placing);
      },
    },
    foundation: {
      outlineBlueprint: (entity) => foundations.outlineOf({ kind: "blueprint", entity }),
      showPlacing: (placing) => {
        foundations.showPlacingBlueprint(placing);
      },
    },
    logWall: {
      outlineBlueprint: (entity) => edgePieces.outlineOf({ kind: "blueprint", entity }),
      showPlacing: (placing) => {
        edgePieces.showPlacingBlueprint(placing && { ...placing, structure: "logWall" });
      },
    },
    doorFrame: {
      outlineBlueprint: (entity) => edgePieces.outlineOf({ kind: "blueprint", entity }),
      showPlacing: (placing) => {
        edgePieces.showPlacingBlueprint(placing && { ...placing, structure: "doorFrame" });
      },
    },
    roofFrame: {
      outlineBlueprint: (entity) => roofFrames.outlineOf({ kind: "blueprint", entity }),
      showPlacing: (placing) => {
        roofFrames.showPlacingBlueprint(placing);
      },
    },
    roof: {
      outlineBlueprint: (entity) => roofs.outlineOf({ kind: "blueprint", entity }),
      showPlacing: (placing) => {
        roofs.showPlacingBlueprint(placing);
      },
    },
    woodpile: {
      outlineBlueprint: (entity) => woodpiles.outlineOf({ kind: "blueprint", entity }),
      showPlacing: (placing) => {
        woodpiles.showPlacingBlueprint(placing);
      },
    },
    chest: {
      outlineBlueprint: (entity) => chests.outlineOf({ kind: "blueprint", entity }),
      showPlacing: (placing) => {
        chests.showPlacingBlueprint(placing);
      },
    },
    sawhorse: {
      outlineBlueprint: (entity) => sawhorses.outlineOf({ kind: "blueprint", entity }),
      showPlacing: (placing) => {
        sawhorses.showPlacingBlueprint(placing);
      },
    },
  };

  /** Keeps whichever candidate is nearest. */
  function nearest<T extends { distance: number }>(candidates: readonly (T | undefined)[]): T | undefined {
    let found: T | undefined;
    for (const candidate of candidates) if (candidate !== undefined && (found === undefined || candidate.distance < found.distance)) found = candidate;
    return found;
  }

  return {
    group,
    update({ nowSeconds, camera, player }) {
      campfires.update(nowSeconds);
      leanTos.update();
      foundations.update();
      edgePieces.update(camera !== undefined && player !== undefined ? { camera, player } : undefined);
      // The roof above the player, and the frames under it, hide.
      roofFrames.update(player !== undefined ? { player } : undefined);
      roofs.update(player !== undefined ? { player } : undefined);
      woodpiles.update();
      chests.update();
      sawhorses.update();
    },
    pick(raycaster) {
      return nearest<{ hit: StructureHit; distance: number }>([
        campfires.pick(raycaster),
        leanTos.pick(raycaster),
        foundations.pick(raycaster),
        edgePieces.pick(raycaster),
        roofFrames.pick(raycaster),
        roofs.pick(raycaster),
        woodpiles.pick(raycaster),
        chests.pick(raycaster),
        sawhorses.pick(raycaster),
      ]);
    },
    pickFinished(raycaster) {
      return nearest(withFinishedPicks.map((meshes) => meshes.pickFinished(raycaster)));
    },
    outlineOf({ kind, entity }) {
      switch (kind) {
        case "blueprint":
          return entity.blueprint === undefined ? [] : drawings[entity.blueprint.structure].outlineBlueprint(entity);
        case "campfire":
          return campfires.outlineOf({ kind, entity });
        case "woodpile":
          return woodpiles.outlineOf({ kind, entity });
        case "chest":
          return chests.outlineOf({ kind, entity });
        case "workStation":
          // The sawhorse is the only work station so far. A later kind of station adds its meshes here.
          return sawhorses.outlineOf({ kind, entity });
      }
    },
    showPlacingBlueprint(placing) {
      // Each structure draws its own blueprint. Hide them all, then show the one being placed.
      for (const drawing of Object.values(drawings)) drawing.showPlacing(undefined);
      if (placing !== undefined) drawings[placing.structure].showPlacing(placing);
    },
    dispose() {
      for (const meshes of all) meshes.dispose();
    },
  };
}
