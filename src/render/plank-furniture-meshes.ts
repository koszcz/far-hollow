// Draws one kind of plank furniture, finished or as a blueprint, from a list of box-shaped parts in build stages.
// The model of each piece is its own asset, in its own file, which hands its parts to this file.
// FurnitureMeshes is what every piece's meshes meet, including a piece with meshes of its own. See furniture-meshes.ts.
// Each stage fades in above its place and is set down, like the parts of a chest.
// A blueprint shows the parts see-through. A stage whose planks the blueprint already has shows pale and half solid.
// While the player places the piece from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { blueprintEntities, furnitureEntities } from "../sim/entity-queries";
import type { FurnitureKind } from "../sim/structure-kind";
import { costOf, isKept } from "../sim/structures";
import { buildLift, buildOpacity, NOT_ALLOWED_COLOUR, seeThrough } from "./structure-look";
import type { OutlinePart } from "./hover-outline";
import { quarterTurnsToRadians, type QuarterTurns } from "../sim/quarter-turns";

/** The pale sawn wood of a plank, as in a pile. */
export const PLANK_WOOD_COLOUR = 0xd9b07a;
const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A stage whose planks the blueprint has is this solid, so it stands out from the stages still needed. */
const DELIVERED_OPACITY = 0.7;
/** How much darker or lighter one plank is than the next, as a share of the wood colour. */
const PLANK_SHADES = [1, 0.9, 1.05, 0.94, 0.86, 1.02, 0.97, 0.91];

/**
 * One box-shaped part: its size, the middle of it, both in metres in the piece's own space, and its colour if it is not plank wood.
 * `tilt` turns the part about the front-to-back axis, in radians, for a slanted part such as a brace.
 * `lean` turns the part about its own left-to-right axis, in radians, before `turn`. A positive lean tips its top toward its front.
 * `turn` turns the part about the vertical axis, in radians, for a part set round a circle such as a barrel stave.
 * `shade` sets how dark or light a plank part is, as a share of the wood colour. Without it, each plank takes the next shade in turn.
 */
export interface FurniturePart {
  readonly size: [number, number, number];
  readonly at: [number, number, number];
  readonly colour?: number;
  readonly tilt?: number;
  readonly lean?: number;
  readonly turn?: number;
  readonly shade?: number;
}

/** What a piece of furniture looks like. */
export interface FurnitureModel {
  readonly structure: FurnitureKind;
  /** The parts each stage of construction adds, in order. */
  readonly stages: readonly (readonly FurniturePart[])[];
  /** The box a click on the piece lands in: its size, and the middle of it, in the piece's own space. */
  readonly pickBox: { readonly size: [number, number, number]; readonly at: [number, number, number] };
}

/** What a click on the piece or its blueprint landed on. */
export type FurnitureHit = { kind: "blueprint" | "finished"; entity: Entity };

/** The meshes of one kind of furniture. */
export interface FurnitureMeshes {
  readonly group: THREE.Group;
  /** Brings every piece of this kind, and every blueprint of one, up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among these pieces and their blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: FurnitureHit; distance: number } | undefined;
  /** The parts of a piece or blueprint, placed in the world. Empty once it is gone. */
  outlineOf(entity: Entity): OutlinePart[];
  /** Shows a blueprint under the mouse with its base at `spot`, facing `turns`, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; turns: QuarterTurns; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One stage of construction: its meshes, and the see-through copies of their materials for fading in. */
interface Stage {
  readonly root: THREE.Group;
  readonly meshes: THREE.Mesh[];
  readonly solid: THREE.Material[];
  readonly fading: THREE.MeshStandardMaterial[];
}

interface Drawn {
  readonly root: THREE.Group;
  readonly stages: Stage[];
  readonly picker: THREE.Mesh;
}

/** Draws every piece of one kind of plank furniture, and every blueprint of one, from its model. */
export function createFurnitureMeshes(entities: EntityStore, model: FurnitureModel): FurnitureMeshes {
  const group = new THREE.Group();
  const stageCount = model.stages.length;
  let shadeIndex = 0;
  const geometries = model.stages.map((parts) =>
    parts.map(({ size, colour, shade: ownShade }) => {
      const geometry = new THREE.BoxGeometry(...size);
      // Plank wood varies a little from plank to plank, so the planks read apart. Other parts keep their own colour.
      const shade = ownShade ?? (colour === undefined ? (PLANK_SHADES[shadeIndex++ % PLANK_SHADES.length] ?? 1) : 1);
      const count = geometry.getAttribute("position").count;
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Array<number>(count * 3).fill(shade), 3));
      return geometry;
    }),
  );
  const pickGeometry = new THREE.BoxGeometry(...model.pickBox.size).translate(...model.pickBox.at);
  const solidByColour = new Map<number, THREE.MeshStandardMaterial>();
  const solidOf = (colour: number) => {
    let material = solidByColour.get(colour);
    if (material === undefined) {
      material = new THREE.MeshStandardMaterial({ color: colour, flatShading: true, vertexColors: true });
      solidByColour.set(colour, material);
    }
    return material;
  };
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(PLANK_WOOD_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const finished = furnitureEntities(entities);

  function addStages(root: THREE.Group): Stage[] {
    return model.stages.map((parts, stageIndex) => {
      const stageRoot = new THREE.Group();
      root.add(stageRoot);
      const solid = parts.map(({ colour }) => solidOf(colour ?? PLANK_WOOD_COLOUR));
      const fading = solid.map((material) => {
        const copy = material.clone();
        copy.transparent = true;
        return copy;
      });
      const meshes = parts.map(({ at, tilt, lean, turn }, i) => {
        const mesh = new THREE.Mesh(geometries[stageIndex]?.[i], blueprintMaterial);
        mesh.position.set(...at);
        // Turn last, so a lean tips the part toward its own front wherever it is turned.
        mesh.rotation.order = "YXZ";
        mesh.rotation.set(lean ?? 0, turn ?? 0, tilt ?? 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        stageRoot.add(mesh);
        return mesh;
      });
      return { root: stageRoot, meshes, solid, fading };
    });
  }

  const placingBlueprint = new THREE.Group();
  placingBlueprint.visible = false;
  const placingStages = addStages(placingBlueprint);
  group.add(placingBlueprint);

  function draw(entity: Entity): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const stages = addStages(root);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const result = { root, stages, picker };
    drawn.set(entity, result);
    return result;
  }

  /**
   * Shows how far construction has gone. Built stages are solid and in place, the stage being built fades in and is set down,
   * stages whose planks the blueprint has wait half solid, and the rest show see-through.
   */
  function showProgress(item: Drawn, entity: Entity & { position: Vec3 }, progress: number, ready: number): void {
    item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
    item.root.rotation.y = quarterTurnsToRadians(entity.facing?.turns ?? 0);
    const stagesDone = progress * stageCount;
    item.stages.forEach((stage, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        for (const mesh of stage.meshes) mesh.material = index < ready ? deliveredMaterial : blueprintMaterial;
        stage.root.position.y = 0;
        return;
      }
      const opacity = buildOpacity(share);
      for (const material of stage.fading) material.opacity = opacity;
      stage.meshes.forEach((mesh, i) => {
        mesh.material = (opacity < 1 ? stage.fading[i] : stage.solid[i]) ?? blueprintMaterial;
      });
      stage.root.position.y = buildLift(share);
    });
  }

  /** How many stages of a blueprint have all their planks: the share of its cost it has, in whole stages. */
  function stagesReady(entity: Entity & Required<Pick<Entity, "blueprint">>): number {
    const cost = costOf(entity, model.structure);
    const needs = cost.reduce((sum, { count }) => sum + count, 0);
    const has = cost.reduce((sum, { material }) => sum + (isKept(material) ? (entity.blueprint.delivered[material] ?? 0) : 0), 0);
    return needs === 0 ? stageCount : Math.floor((has / needs) * stageCount);
  }

  function disposeFading(stages: readonly Stage[]): void {
    for (const stage of stages) for (const material of stage.fading) material.dispose();
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    disposeFading(item.stages);
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      for (const entity of blueprints) {
        if (entity.blueprint.structure !== model.structure) continue;
        showProgress(draw(entity), entity, entity.blueprint.progress, stagesReady(entity));
        seen.add(entity);
      }
      for (const entity of finished) {
        if (entity.furniture !== model.structure) continue;
        showProgress(draw(entity), entity, 1, stageCount);
        seen.add(entity);
      }
      for (const entity of [...drawn.keys()]) if (!seen.has(entity)) forget(entity);
    },
    pick(raycaster) {
      hits.length = 0;
      raycaster.intersectObjects(pickers, false, hits);
      hits.sort((a, b) => a.distance - b.distance);
      for (const hit of hits) {
        const entity = hit.object.userData.entity as Entity | undefined;
        if (entity === undefined) continue;
        return { hit: { kind: entity.blueprint === undefined ? "finished" : "blueprint", entity }, distance: hit.distance };
      }
      return undefined;
    },
    outlineOf(entity) {
      const item = drawn.get(entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.stages.flatMap(({ meshes }) => meshes).map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPlacingBlueprint(shown) {
      placingBlueprint.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const stage of placingStages) {
        stage.root.position.y = 0;
        for (const mesh of stage.meshes) mesh.material = material;
      }
      placingBlueprint.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
      placingBlueprint.rotation.y = quarterTurnsToRadians(shown.turns);
    },
    dispose() {
      for (const item of [
        ...geometries.flat(),
        pickGeometry,
        ...solidByColour.values(),
        blueprintMaterial,
        deliveredMaterial,
        notAllowedMaterial,
        pickMaterial,
      ]) {
        item.dispose();
      }
      disposeFading(placingStages);
      for (const item of drawn.values()) disposeFading(item.stages);
    },
  };
}
