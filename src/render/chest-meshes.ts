// Draws chests and chest blueprints: the approved "chest" asset in asset-manifest.json, built in code.
// A chest is a rough box hewn from debarked logs: corner posts with three stacked planks in each wall, a grip on each end,
// and a lid of planks held by two battens.
// Its front faces +z when it faces the default way.
// Construction has one stage per debarked log. The first builds the body, and the second puts on the lid.
// Each part fades in above its place and is set down, like the sticks of a campfire.
// A blueprint shows the parts see-through. A part whose debarked log has been delivered shows pale and half solid.
// While the player places a chest from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { facingRadians, NOT_ALLOWED_COLOUR } from "./structure-look";
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
/** How tall the body of the chest is, in metres. */
const BODY_HEIGHT_METRES = 0.45;
/** How thick the planks of the floor and the lid are, in metres. */
const PLANK_METRES = 0.06;
/** How thick the wall planks are, in metres. */
const WALL_PLANK_METRES = 0.045;
/** How many planks are stacked in each wall, from the ground up. */
const WALL_PLANKS = 3;
/** The gap between two stacked wall planks, in metres. */
const WALL_GAP_METRES = 0.008;
/** How wide the square corner posts are, in metres. */
const POST_METRES = 0.075;
/** The end walls sit this far in from the ends of the posts, to make room for the grips. */
const END_INSET_METRES = 0.03;
/** The size of the wooden grip on each end: how far it sticks out, how tall, and how long. */
const GRIP_METRES: [number, number, number] = [END_INSET_METRES, 0.05, 0.2];
/** The lid reaches this far past the body on every side, in metres. */
const LID_OVERHANG_METRES = 0.02;
/** How many planks lie side by side in the lid, from front to back. */
const LID_PLANKS = 3;
/** The gap between two lid planks, in metres. */
const LID_GAP_METRES = 0.008;
/** The battens across the top of the lid: how wide, how tall, and how far from the middle. */
const BATTEN_WIDTH_METRES = 0.06;
const BATTEN_HEIGHT_METRES = 0.03;
const BATTEN_OFFSET_METRES = 0.27;
/** How much darker or lighter one plank is than the next, as a share of the wood colour. */
const PLANK_SHADES = [1, 0.9, 1.05, 0.94, 0.86, 1.02, 0.97, 0.91];

/** Which way the grain of a part runs. Its two cut ends face along this axis. */
type Grain = "x" | "y" | "z";

/** One wooden part: its size, the middle of it, and the way its grain runs. */
interface Part {
  readonly size: [number, number, number];
  readonly at: [number, number, number];
  readonly grain: Grain;
}

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
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; turns: number; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One stage of construction: the meshes it adds, with their own see-through copies of the wood for fading in. */
interface Stage {
  readonly root: THREE.Group;
  readonly meshes: THREE.Mesh[];
  /** The see-through wood of this stage, for disposing. */
  readonly fading: THREE.MeshStandardMaterial[];
  /** The face materials of each mesh while it fades in. */
  readonly fadingFaces: THREE.MeshStandardMaterial[][];
}

interface Drawn {
  readonly root: THREE.Group;
  readonly stages: Stage[];
  readonly picker: THREE.Mesh;
}

export function createChestMeshes(entities: EntityStore): ChestMeshes {
  const group = new THREE.Group();
  const width = CHEST_WIDTH_METRES;
  const depth = CHEST_DEPTH_METRES;
  // The body: a floor, a square post at each corner, three stacked planks in each wall between the posts, and a grip on each end.
  const postX = width / 2 - POST_METRES / 2;
  const postZ = depth / 2 - POST_METRES / 2;
  const wallPlankHeight = (BODY_HEIGHT_METRES - (WALL_PLANKS - 1) * WALL_GAP_METRES) / WALL_PLANKS;
  const wallPlankY = (i: number) => wallPlankHeight / 2 + i * (wallPlankHeight + WALL_GAP_METRES);
  const sideLength = width - 2 * POST_METRES + 0.01;
  const endLength = depth - 2 * POST_METRES + 0.01;
  const endX = width / 2 - END_INSET_METRES - WALL_PLANK_METRES / 2;
  const bodyParts: Part[] = [
    { size: [width - 0.04, PLANK_METRES, depth - 0.04], at: [0, PLANK_METRES / 2, 0], grain: "x" },
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz): Part => ({ size: [POST_METRES, BODY_HEIGHT_METRES, POST_METRES], at: [sx * postX, BODY_HEIGHT_METRES / 2, sz * postZ], grain: "y" })),
    ),
    ...[-1, 1].flatMap((sz) =>
      Array.from({ length: WALL_PLANKS }, (_, i): Part => ({
        size: [sideLength, wallPlankHeight, WALL_PLANK_METRES],
        at: [0, wallPlankY(i), sz * (depth / 2 - 0.012 - WALL_PLANK_METRES / 2)],
        grain: "x",
      })),
    ),
    ...[-1, 1].flatMap((sx) =>
      Array.from({ length: WALL_PLANKS }, (_, i): Part => ({ size: [WALL_PLANK_METRES, wallPlankHeight, endLength], at: [sx * endX, wallPlankY(i), 0], grain: "z" })),
    ),
    ...[-1, 1].map((sx): Part => ({
      size: GRIP_METRES,
      at: [sx * (width / 2 - END_INSET_METRES / 2), wallPlankY(WALL_PLANKS - 1), 0],
      grain: "z",
    })),
  ];
  // The lid: planks side by side with a small overhang, held together by two battens across the top.
  const lidDepth = depth + 2 * LID_OVERHANG_METRES;
  const lidPlankDepth = (lidDepth - (LID_PLANKS - 1) * LID_GAP_METRES) / LID_PLANKS;
  const lidParts: Part[] = [
    ...Array.from({ length: LID_PLANKS }, (_, i): Part => ({
      size: [width + 2 * LID_OVERHANG_METRES, PLANK_METRES, lidPlankDepth],
      at: [0, BODY_HEIGHT_METRES + PLANK_METRES / 2, -lidDepth / 2 + lidPlankDepth / 2 + i * (lidPlankDepth + LID_GAP_METRES)],
      grain: "x",
    })),
    ...[-1, 1].map((sx): Part => ({
      size: [BATTEN_WIDTH_METRES, BATTEN_HEIGHT_METRES, lidDepth - 0.03],
      at: [sx * BATTEN_OFFSET_METRES, BODY_HEIGHT_METRES + PLANK_METRES + BATTEN_HEIGHT_METRES / 2, 0],
      grain: "z",
    })),
  ];
  const stageParts = [bodyParts, lidParts];
  let shadeIndex = 0;
  /** A box for one part, coloured a little lighter or darker than its neighbours so the planks read apart. */
  function partGeometry({ size }: Part): THREE.BoxGeometry {
    const geometry = new THREE.BoxGeometry(...size);
    const shade = PLANK_SHADES[shadeIndex++ % PLANK_SHADES.length] ?? 1;
    const count = geometry.getAttribute("position").count;
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Array<number>(count * 3).fill(shade), 3));
    return geometry;
  }
  const geometries = stageParts.map((parts) => parts.map(partGeometry));
  const pickGeometry = new THREE.BoxGeometry(width, BODY_HEIGHT_METRES + PLANK_METRES, depth).translate(0, (BODY_HEIGHT_METRES + PLANK_METRES) / 2, 0);

  // Box groups are +x, -x, +y, -y, +z, -z. Each part shows its pale cut ends along its grain and its sides elsewhere.
  const woodMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true, vertexColors: true });
  const cutMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_CUT_COLOUR, flatShading: true, vertexColors: true });
  /** The six face materials of a part whose grain runs along `grain`. */
  function faceMaterials<M>(grain: Grain, side: M, cut: M): M[] {
    const axis = { x: 0, y: 1, z: 2 }[grain];
    return [0, 1, 2].flatMap((a) => (a === axis ? [cut, cut] : [side, side]));
  }
  const solidMaterials = stageParts.map((parts) => parts.map(({ grain }) => faceMaterials(grain, woodMaterial, cutMaterial)));
  const see = (color: number, opacity: number) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false });
  const blueprintMaterial = see(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = see(DEBARKED_LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = see(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const chests = chestEntities(entities);

  /** Adds the parts of every stage to `root`, all in one material. */
  function addStages(root: THREE.Group): Stage[] {
    return stageParts.map((parts, stage) => {
      const stageRoot = new THREE.Group();
      root.add(stageRoot);
      const side = woodMaterial.clone();
      const cut = cutMaterial.clone();
      side.transparent = true;
      cut.transparent = true;
      const meshes = parts.map(({ at }, i) => {
        const mesh = new THREE.Mesh(geometries[stage]?.[i], blueprintMaterial);
        mesh.position.set(...at);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        stageRoot.add(mesh);
        return mesh;
      });
      const fadingFaces = parts.map(({ grain }) => faceMaterials(grain, side, cut));
      return { root: stageRoot, meshes, fading: [side, cut], fadingFaces };
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
      stage.meshes.forEach((mesh, i) => {
        mesh.material = (opacity < 1 ? stage.fadingFaces[i] : solidMaterials[index]?.[i]) ?? blueprintMaterial;
      });
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
        if (entity.blueprint.structure !== "chest") continue;
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
      for (const item of [...geometries.flat(), pickGeometry, woodMaterial, cutMaterial, blueprintMaterial, deliveredMaterial, notAllowedMaterial, pickMaterial]) {
        item.dispose();
      }
      disposeFading(placingStages);
      for (const item of drawn.values()) disposeFading(item.stages);
    },
  };
}
