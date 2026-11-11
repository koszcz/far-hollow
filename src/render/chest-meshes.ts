// Draws chests and chest blueprints: the draft "chest" asset in asset-manifest.json, built in code.
// A chest is a rough box hewn from debarked logs: a body of thick planks, with a lid of planks on top.
// Its front faces +z when it faces the default way.
// Construction has one stage per debarked log. The first builds the body, and the second puts on the lid.
// Each part fades in above its place and is set down, like the sticks of a campfire.
// A blueprint shows the parts see-through. A part whose debarked log has been delivered shows pale and half solid.
// While the player places a chest from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { blueprintEntities, chestEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { CHEST_DEPTH_METRES, CHEST_LOG_COST, CHEST_WIDTH_METRES } from "../sim/structures";
import { BUILD_FADE_SHARE, buildLift } from "./campfire-meshes";
import { DEBARKED_LOG_COLOUR, DEBARKED_LOG_CUT_COLOUR } from "./debarked-log-shape";
import type { OutlinePart } from "./hover-outline";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A part whose log has been delivered is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/** A blueprint under the mouse shows in this red where its spot is not allowed. */
const NOT_ALLOWED_COLOUR = 0xe0614f;
/** How tall the body of the chest is, in metres. */
const BODY_HEIGHT_METRES = 0.45;
/** How thick the planks of the body and the lid are, in metres. */
const PLANK_METRES = 0.06;
/** The lid reaches this far past the body on every side, in metres. */
const LID_OVERHANG_METRES = 0.02;
/** How many planks lie side by side in the lid, from front to back. */
const LID_PLANKS = 3;
/** The gap between two lid planks, in metres. */
const LID_GAP_METRES = 0.008;

/** What a click on a chest or chest blueprint landed on. */
export type ChestHit = { kind: "blueprint"; entity: Entity } | { kind: "chest"; entity: Entity };

export interface ChestMeshes {
  readonly group: THREE.Group;
  /** Brings every chest and chest blueprint up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among chests and chest blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: ChestHit; distance: number } | undefined;
  /** The parts of a chest or chest blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: ChestHit): OutlinePart[];
  /** Shows a chest blueprint under the mouse with its base at `spot`, facing `turns`, red where it is not allowed. Undefined hides it. */
  showPreview(preview: { spot: Vec3; turns: number; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One stage of construction: the meshes it adds, with their own see-through copies of the wood for fading in. */
interface Stage {
  readonly root: THREE.Group;
  readonly meshes: THREE.Mesh[];
  readonly fading: THREE.MeshStandardMaterial[];
}

interface Drawn {
  readonly root: THREE.Group;
  readonly stages: Stage[];
  readonly picker: THREE.Mesh;
}

/** How far round a chest facing `turns` quarter turns is drawn, in radians. Quarter turns go clockwise seen from above. */
function facingRadians(turns: number): number {
  return -turns * (Math.PI / 2);
}

export function createChestMeshes(entities: EntityStore): ChestMeshes {
  const group = new THREE.Group();
  const width = CHEST_WIDTH_METRES;
  const depth = CHEST_DEPTH_METRES;
  const bodyBoxes: { size: [number, number, number]; at: [number, number, number] }[] = [
    // The floor, then the front and back, then the two ends between them.
    { size: [width, PLANK_METRES, depth], at: [0, PLANK_METRES / 2, 0] },
    { size: [width, BODY_HEIGHT_METRES, PLANK_METRES], at: [0, BODY_HEIGHT_METRES / 2, depth / 2 - PLANK_METRES / 2] },
    { size: [width, BODY_HEIGHT_METRES, PLANK_METRES], at: [0, BODY_HEIGHT_METRES / 2, -depth / 2 + PLANK_METRES / 2] },
    { size: [PLANK_METRES, BODY_HEIGHT_METRES, depth - 2 * PLANK_METRES], at: [width / 2 - PLANK_METRES / 2, BODY_HEIGHT_METRES / 2, 0] },
    { size: [PLANK_METRES, BODY_HEIGHT_METRES, depth - 2 * PLANK_METRES], at: [-width / 2 + PLANK_METRES / 2, BODY_HEIGHT_METRES / 2, 0] },
  ];
  const lidDepth = depth + 2 * LID_OVERHANG_METRES;
  const lidPlankDepth = (lidDepth - (LID_PLANKS - 1) * LID_GAP_METRES) / LID_PLANKS;
  const lidBoxes = Array.from({ length: LID_PLANKS }, (_, i) => ({
    size: [width + 2 * LID_OVERHANG_METRES, PLANK_METRES, lidPlankDepth] as [number, number, number],
    at: [0, BODY_HEIGHT_METRES + PLANK_METRES / 2, -lidDepth / 2 + lidPlankDepth / 2 + i * (lidPlankDepth + LID_GAP_METRES)] as [number, number, number],
  }));
  const stageBoxes = [bodyBoxes, lidBoxes];
  const geometries = stageBoxes.map((boxes) => boxes.map(({ size }) => new THREE.BoxGeometry(...size)));
  const pickGeometry = new THREE.BoxGeometry(width, BODY_HEIGHT_METRES + PLANK_METRES, depth).translate(0, (BODY_HEIGHT_METRES + PLANK_METRES) / 2, 0);

  // Box groups are +x, -x, +y, -y, +z, -z. The planks show their pale cut ends along x and their sides elsewhere.
  const woodMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true });
  const cutMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_CUT_COLOUR, flatShading: true });
  const plankMaterials = [cutMaterial, cutMaterial, woodMaterial, woodMaterial, woodMaterial, woodMaterial];
  const see = (color: number, opacity: number) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false });
  const blueprintMaterial = see(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = see(DEBARKED_LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = see(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const chests = chestEntities(entities);

  /** Adds the planks of every stage to `root`, all in one material. */
  function addStages(root: THREE.Group): Stage[] {
    return stageBoxes.map((boxes, stage) => {
      const stageRoot = new THREE.Group();
      root.add(stageRoot);
      const side = woodMaterial.clone();
      const cut = cutMaterial.clone();
      side.transparent = true;
      cut.transparent = true;
      const meshes = boxes.map(({ at }, i) => {
        const mesh = new THREE.Mesh(geometries[stage]?.[i], blueprintMaterial);
        mesh.position.set(...at);
        mesh.castShadow = true;
        stageRoot.add(mesh);
        return mesh;
      });
      return { root: stageRoot, meshes, fading: [cut, cut, side, side, side, side] };
    });
  }

  const preview = new THREE.Group();
  preview.visible = false;
  const previewStages = addStages(preview);
  group.add(preview);

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
   * stages whose log has been delivered wait half solid, and the rest show see-through.
   */
  function showProgress(item: Drawn, entity: Entity & { position: Vec3 }, progress: number, delivered: number): void {
    item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
    item.root.rotation.y = facingRadians(entity.facing?.turns ?? 0);
    const stagesDone = progress * CHEST_LOG_COST;
    item.stages.forEach((stage, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        for (const mesh of stage.meshes) mesh.material = index < delivered ? deliveredMaterial : blueprintMaterial;
        stage.root.position.y = 0;
        return;
      }
      const opacity = Math.min(1, share / BUILD_FADE_SHARE);
      for (const material of stage.fading) material.opacity = opacity;
      for (const mesh of stage.meshes) mesh.material = opacity < 1 ? stage.fading : plankMaterials;
      stage.root.position.y = buildLift(share);
    });
  }

  function disposeFading(stages: readonly Stage[]): void {
    for (const stage of stages) for (const material of new Set(stage.fading)) material.dispose();
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
        if (entity.blueprint.piece !== "chest") continue;
        showProgress(draw(entity), entity, entity.blueprint.progress, entity.blueprint.delivered.debarkedLog ?? 0);
        seen.add(entity);
      }
      for (const entity of chests) {
        showProgress(draw(entity), entity, 1, CHEST_LOG_COST);
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
        if (entity?.chest !== undefined) return { hit: { kind: "chest", entity }, distance: hit.distance };
      }
      return undefined;
    },
    outlineOf(hit) {
      const item = drawn.get(hit.entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.stages.flatMap(({ meshes }) => meshes).map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPreview(shown) {
      preview.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const stage of previewStages) {
        stage.root.position.y = 0;
        for (const mesh of stage.meshes) mesh.material = material;
      }
      preview.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
      preview.rotation.y = facingRadians(shown.turns);
    },
    dispose() {
      for (const item of [...geometries.flat(), pickGeometry, woodMaterial, cutMaterial, blueprintMaterial, deliveredMaterial, notAllowedMaterial, pickMaterial]) {
        item.dispose();
      }
      disposeFading(previewStages);
      for (const item of drawn.values()) disposeFading(item.stages);
    },
  };
}
