// Draws cabin roof sections and their blueprints: the "roof" asset in asset-manifest.json, a draft built in code.
// A roof section covers one foundation square at the top of the walls. Debarked-log rafters run across the square,
// and strips of bark lie over them, a little past the square's edges so the sections beside it overlap.
// Construction has one stage per log, then one per strip of bark: the rafters go up first, then the bark covers them.
// A blueprint shows see-through. Each debarked log the player has delivered shows pale and half solid in its place.
// The part being built fades in above its place, is lowered, and set down, like the logs of a foundation.
// When the player stands under a cabin roof, that roof and every section joined to it hide, so the player stays in view.
// While the player places a roof from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { blueprintEntities, cabinRoofEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { roofAbove } from "../sim/roofs";
import { ROOF_BARK_COST, ROOF_LOG_COST } from "../sim/structures";
import { BUILD_FADE_SHARE, buildLift } from "./campfire-meshes";
import { DEBARKED_LOG_COLOUR } from "./debarked-log-shape";
import { EDGE_PIECE_HEIGHT_METRES } from "./edge-piece-meshes";
import type { OutlinePart } from "./hover-outline";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A delivered log waiting in its place is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/** A blueprint under the mouse shows in this red where its spot is not allowed. */
const NOT_ALLOWED_COLOUR = 0xe0614f;
/** The strips of bark take turns between these browns, like the lean-to's bark. */
const BARK_COLOURS = [0x5b3f2c, 0x6b4b34] as const;

const RAFTER_RADIUS_METRES = 0.07;
/** The bark reaches this far past each side of the square, in metres, so the sections beside it overlap. */
const BARK_OVERHANG_METRES = 0.08;
const BARK_THICKNESS_METRES = 0.04;
/** How thick the invisible slab that catches clicks on a blueprint is, in metres. */
const PICK_THICKNESS_METRES = 0.3;

/** What a click on a roof blueprint landed on. Finished roofs are not clicked. */
export type RoofHit = { kind: "blueprint"; entity: Entity };

export interface RoofMeshes {
  readonly group: THREE.Group;
  /**
   * Brings every roof section and roof blueprint up to date with game state.
   * Finished sections above the player standing at `player` hide. Without it, nothing hides.
   */
  update(view?: { player: Vec3 }): void;
  /** What a ray from the camera hits first among roof blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: RoofHit; distance: number } | undefined;
  /** The parts of a roof blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: RoofHit): OutlinePart[];
  /** Shows a roof blueprint under the mouse over the deck at `spot`, red where it is not allowed. Undefined hides it. */
  showPreview(preview: { spot: Vec3; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One part of a roof section: its shape, its finished material, and where it rests, from the middle of the deck below. */
interface PartPlan {
  readonly geometry: THREE.BufferGeometry;
  readonly wood: THREE.MeshStandardMaterial;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface Drawn {
  readonly root: THREE.Group;
  /** One part for each stage of construction, in order, each with its own see-through copy of its material for fading in. */
  readonly parts: { mesh: THREE.Mesh; fading: THREE.MeshStandardMaterial; plan: PartPlan }[];
  readonly picker: THREE.Mesh;
}

export function createRoofMeshes(entities: EntityStore): RoofMeshes {
  const group = new THREE.Group();
  // Rafters run along z, side by side across x, resting on the tops of the walls.
  const rafterGeometry = new THREE.CylinderGeometry(RAFTER_RADIUS_METRES, RAFTER_RADIUS_METRES, BUILD_GRID_METRES + 2 * BARK_OVERHANG_METRES, 7)
    .rotateX(Math.PI / 2);
  // Strips of bark run along x, side by side across z.
  const stripWidth = (BUILD_GRID_METRES + 2 * BARK_OVERHANG_METRES) / ROOF_BARK_COST;
  const barkGeometry = new THREE.BoxGeometry(BUILD_GRID_METRES + 2 * BARK_OVERHANG_METRES, BARK_THICKNESS_METRES, stripWidth * 1.1);
  const pickGeometry = new THREE.BoxGeometry(BUILD_GRID_METRES, PICK_THICKNESS_METRES, BUILD_GRID_METRES);
  const woodMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true });
  const barkMaterials = BARK_COLOURS.map((color) => new THREE.MeshStandardMaterial({ color, flatShading: true }));
  const see = (color: number, opacity: number) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false });
  const blueprintMaterial = see(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = see(DEBARKED_LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = see(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const rafterY = EDGE_PIECE_HEIGHT_METRES + RAFTER_RADIUS_METRES;
  const barkY = EDGE_PIECE_HEIGHT_METRES + 2 * RAFTER_RADIUS_METRES + BARK_THICKNESS_METRES / 2;
  /** The parts each stage adds, in order: the rafters, then the strips of bark. */
  const STAGES: readonly PartPlan[] = [
    ...Array.from({ length: ROOF_LOG_COST }, (_, i) => ({
      geometry: rafterGeometry,
      wood: woodMaterial,
      x: -BUILD_GRID_METRES / 2 + RAFTER_RADIUS_METRES + (i * (BUILD_GRID_METRES - 2 * RAFTER_RADIUS_METRES)) / Math.max(1, ROOF_LOG_COST - 1),
      y: rafterY,
      z: 0,
    })),
    ...Array.from({ length: ROOF_BARK_COST }, (_, i) => ({
      geometry: barkGeometry,
      wood: barkMaterials[i % barkMaterials.length] ?? woodMaterial,
      x: 0,
      // Each strip sits a little higher than the one before, so they overlap like shingles.
      y: barkY + i * BARK_THICKNESS_METRES * 0.25,
      z: -(BUILD_GRID_METRES / 2 + BARK_OVERHANG_METRES) + (i + 0.5) * stripWidth,
    })),
  ];

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const finished = cabinRoofEntities(entities);

  /** Adds every part of a roof section to `root`, see-through. */
  function addParts(root: THREE.Group): Drawn["parts"] {
    return STAGES.map((plan) => {
      const mesh = new THREE.Mesh(plan.geometry, blueprintMaterial);
      mesh.castShadow = true;
      mesh.position.set(plan.x, plan.y, plan.z);
      root.add(mesh);
      const fading = plan.wood.clone();
      fading.transparent = true;
      return { mesh, fading, plan };
    });
  }

  const preview = new THREE.Group();
  preview.visible = false;
  const previewParts = addParts(preview);
  group.add(preview);

  function draw(entity: Entity & { position: Vec3 }): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const parts = addParts(root);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.position.y = EDGE_PIECE_HEIGHT_METRES + PICK_THICKNESS_METRES / 2;
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const result = { root, parts, picker };
    drawn.set(entity, result);
    return result;
  }

  /**
   * Shows how far construction has gone. Built parts are solid and in place, the part being built moves through its stage,
   * rafters whose log has been delivered wait half solid in their places, and the rest show see-through.
   */
  function showProgress(item: Drawn, progress: number, delivered: number): void {
    const stagesDone = progress * item.parts.length;
    item.parts.forEach(({ mesh, fading, plan }, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        mesh.material = index < Math.min(delivered, ROOF_LOG_COST) ? deliveredMaterial : blueprintMaterial;
        mesh.position.y = plan.y;
        return;
      }
      fading.opacity = Math.min(1, share / BUILD_FADE_SHARE);
      mesh.material = fading.opacity < 1 ? fading : plan.wood;
      mesh.position.y = plan.y + buildLift(share);
    });
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    for (const { fading } of item.parts) fading.dispose();
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update(view) {
      const seen = new Set<Entity>();
      for (const entity of blueprints) {
        if (entity.blueprint.piece !== "roof") continue;
        const item = draw(entity);
        item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
        item.root.visible = true;
        showProgress(item, entity.blueprint.progress, entity.blueprint.delivered.debarkedLog ?? 0);
        seen.add(entity);
      }
      const hidden = new Set(view === undefined ? [] : roofAbove(entities, view.player));
      for (const entity of finished) {
        const item = draw(entity);
        item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
        item.root.visible = !hidden.has(entity);
        showProgress(item, 1, ROOF_LOG_COST);
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
      }
      return undefined;
    },
    outlineOf(hit) {
      const item = drawn.get(hit.entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.parts.map(({ mesh }) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPreview(shown) {
      preview.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const { mesh } of previewParts) mesh.material = material;
      preview.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
    },
    dispose() {
      for (const item of [
        rafterGeometry, barkGeometry, pickGeometry, woodMaterial, ...barkMaterials, blueprintMaterial, deliveredMaterial, notAllowedMaterial,
        pickMaterial,
      ]) {
        item.dispose();
      }
      for (const item of drawn.values()) for (const { fading } of item.parts) fading.dispose();
      for (const { fading } of previewParts) fading.dispose();
    },
  };
}
