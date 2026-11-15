// Draws shelves and shelf blueprints: the "shelf" asset in asset-manifest.json, built in code. A rough draft.
// A shelf is a standing frame of sawn planks: two upright side planks, three shelf boards across them, and a back of planks.
// It does not show what it holds. Its front faces +z when it faces the default way.
// The model is built in two parts, each taking half of construction. The first stands up the sides with the lowest board,
// and the second adds the upper boards and the back. Each part fades in above its place and is set down, like the chest's.
// A blueprint shows the parts see-through. A part whose planks the blueprint already has shows pale and half solid: 2 planks for each part.
// While the player places a shelf from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { buildLift, buildOpacity, facingRadians, NOT_ALLOWED_COLOUR, seeThrough } from "./structure-look";
import { blueprintEntities, shelfEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { costOf, isKept, SHELF_DEPTH_METRES, SHELF_WIDTH_METRES } from "../sim/structures";
import type { OutlinePart } from "./hover-outline";

/** How many parts the shelf model is built in: the sides with the lowest board, then the upper boards and the back. */
export const SHELF_MODEL_STAGES = 2;
/** The pale sawn wood of a plank, as a plank in a pile shows it. */
const PLANK_COLOUR = 0xd9b07a;
const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A part whose planks have been delivered is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/** How tall the shelf stands, in metres. */
const HEIGHT_METRES = 1.2;
/** How thick every plank is, in metres. */
const PLANK_METRES = 0.03;
/** How high each shelf board's top is above the ground, in metres. */
const BOARD_HEIGHTS_METRES = [0.12, 0.6, 1.08];
/** How many planks stand side by side in the back. */
const BACK_PLANKS = 3;
/** The gap between two back planks, in metres. */
const BACK_GAP_METRES = 0.01;
/** How much darker or lighter one plank is than the next, as a share of the wood colour. */
const PLANK_SHADES = [1, 0.9, 1.05, 0.94, 0.86, 1.02, 0.97, 0.91];

/** One plank: its size and the middle of it. */
interface Part {
  readonly size: [number, number, number];
  readonly at: [number, number, number];
}

/** What a click on a shelf or shelf blueprint landed on. */
export type ShelfHit = { kind: "blueprint"; entity: Entity } | { kind: "shelf"; entity: Entity };

export interface ShelfMeshes {
  readonly group: THREE.Group;
  /** Brings every shelf and shelf blueprint up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among shelves and shelf blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: ShelfHit; distance: number } | undefined;
  /** The parts of a shelf or shelf blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: ShelfHit): OutlinePart[];
  /** Shows a shelf blueprint under the mouse with its base at `spot`, facing `turns`, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; turns: number; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One stage of construction: the meshes it adds, with its own see-through copy of the wood for fading in. */
interface Stage {
  readonly root: THREE.Group;
  readonly meshes: THREE.Mesh[];
  readonly fading: THREE.MeshStandardMaterial;
}

interface Drawn {
  readonly root: THREE.Group;
  readonly stages: Stage[];
  readonly picker: THREE.Mesh;
}

export function createShelfMeshes(entities: EntityStore): ShelfMeshes {
  const group = new THREE.Group();
  const width = SHELF_WIDTH_METRES;
  const depth = SHELF_DEPTH_METRES;
  const sideX = width / 2 - PLANK_METRES / 2;
  const innerWidth = width - 2 * PLANK_METRES;
  const board = (top: number): Part => ({ size: [innerWidth, PLANK_METRES, depth - PLANK_METRES], at: [0, top - PLANK_METRES / 2, PLANK_METRES / 2] });
  const sideParts: Part[] = [
    ...[-1, 1].map((sx): Part => ({ size: [PLANK_METRES, HEIGHT_METRES, depth], at: [sx * sideX, HEIGHT_METRES / 2, 0] })),
    board(BOARD_HEIGHTS_METRES[0] ?? 0),
  ];
  const backPlankWidth = (innerWidth - (BACK_PLANKS - 1) * BACK_GAP_METRES) / BACK_PLANKS;
  const upperParts: Part[] = [
    ...BOARD_HEIGHTS_METRES.slice(1).map(board),
    ...Array.from({ length: BACK_PLANKS }, (_, i): Part => ({
      size: [backPlankWidth, HEIGHT_METRES - 0.02, PLANK_METRES],
      at: [-innerWidth / 2 + backPlankWidth / 2 + i * (backPlankWidth + BACK_GAP_METRES), HEIGHT_METRES / 2, -depth / 2 + PLANK_METRES / 2],
    })),
  ];
  const stageParts = [sideParts, upperParts];
  let shadeIndex = 0;
  /** A box for one plank, coloured a little lighter or darker than its neighbours so the planks read apart. */
  function partGeometry({ size }: Part): THREE.BoxGeometry {
    const geometry = new THREE.BoxGeometry(...size);
    const shade = PLANK_SHADES[shadeIndex++ % PLANK_SHADES.length] ?? 1;
    const count = geometry.getAttribute("position").count;
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Array<number>(count * 3).fill(shade), 3));
    return geometry;
  }
  const geometries = stageParts.map((parts) => parts.map(partGeometry));
  const pickGeometry = new THREE.BoxGeometry(width, HEIGHT_METRES, depth).translate(0, HEIGHT_METRES / 2, 0);

  const woodMaterial = new THREE.MeshStandardMaterial({ color: PLANK_COLOUR, flatShading: true, vertexColors: true });
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(PLANK_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const shelves = shelfEntities(entities);

  /** Adds the planks of every stage to `root`, all in the blueprint material. */
  function addStages(root: THREE.Group): Stage[] {
    return stageParts.map((parts, stage) => {
      const stageRoot = new THREE.Group();
      root.add(stageRoot);
      const fading = woodMaterial.clone();
      fading.transparent = true;
      const meshes = parts.map(({ at }, i) => {
        const mesh = new THREE.Mesh(geometries[stage]?.[i], blueprintMaterial);
        mesh.position.set(...at);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        stageRoot.add(mesh);
        return mesh;
      });
      return { root: stageRoot, meshes, fading };
    });
  }

  const placingBlueprint = new THREE.Group();
  placingBlueprint.visible = false;
  const placingStages = addStages(placingBlueprint);
  group.add(placingBlueprint);

  function draw(entity: Entity & { position: Vec3 }): Drawn {
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
    item.root.rotation.y = facingRadians(entity.facing?.turns ?? 0);
    const stagesDone = progress * SHELF_MODEL_STAGES;
    item.stages.forEach((stage, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        for (const mesh of stage.meshes) mesh.material = index < ready ? deliveredMaterial : blueprintMaterial;
        stage.root.position.y = 0;
        return;
      }
      const opacity = buildOpacity(share);
      stage.fading.opacity = opacity;
      for (const mesh of stage.meshes) mesh.material = opacity < 1 ? stage.fading : woodMaterial;
      stage.root.position.y = buildLift(share);
    });
  }

  /** How many parts of a shelf blueprint have all their planks: the share of its cost it has, in whole parts. */
  function partsReady(entity: Entity & Required<Pick<Entity, "blueprint">>): number {
    const cost = costOf(entity, "shelf");
    const needs = cost.reduce((sum, { count }) => sum + count, 0);
    const has = cost.reduce((sum, { material }) => sum + (isKept(material) ? (entity.blueprint.delivered[material] ?? 0) : 0), 0);
    return needs === 0 ? SHELF_MODEL_STAGES : Math.floor((has / needs) * SHELF_MODEL_STAGES);
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    for (const stage of item.stages) stage.fading.dispose();
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      for (const entity of blueprints) {
        if (entity.blueprint.structure !== "shelf") continue;
        showProgress(draw(entity), entity, entity.blueprint.progress, partsReady(entity));
        seen.add(entity);
      }
      for (const entity of shelves) {
        showProgress(draw(entity), entity, 1, SHELF_MODEL_STAGES);
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
        if (entity?.blueprint !== undefined) return { hit: { kind: "blueprint", entity }, distance: hit.distance };
        if (entity?.shelf !== undefined) return { hit: { kind: "shelf", entity }, distance: hit.distance };
      }
      return undefined;
    },
    outlineOf(hit) {
      const item = drawn.get(hit.entity);
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
      placingBlueprint.rotation.y = facingRadians(shown.turns);
    },
    dispose() {
      for (const item of [...geometries.flat(), pickGeometry, woodMaterial, blueprintMaterial, deliveredMaterial, notAllowedMaterial, pickMaterial]) {
        item.dispose();
      }
      for (const stage of placingStages) stage.fading.dispose();
      for (const item of drawn.values()) for (const stage of item.stages) stage.fading.dispose();
    },
  };
}
