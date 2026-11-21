// Draws fireplaces and fireplace blueprints: the draft "fireplace" asset in asset-manifest.json, built in code.
// Added by fireplace ticket 02. A fireplace is a squat stone hearth on one foundation square: a back wall and two side walls
// round a stone floor, a stone slab across their tops, and a short chimney rising from the back.
// Its opening faces +z when it faces the default way.
// Construction has one stage per stone. Each stone fades in above its place and is set down, like the logs of a sawhorse.
// A blueprint shows the stones see-through. A stone the blueprint already has shows pale and half solid.
// While the player places a fireplace from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { blueprintEntities, fireplaceEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { FIREPLACE_STONE_COST } from "../sim/structures";
import { quarterTurnsToRadians, type QuarterTurns } from "../sim/quarter-turns";
import type { OutlinePart } from "./hover-outline";
import { buildLift, buildOpacity, NOT_ALLOWED_COLOUR, pickFinished, seeThrough } from "./structure-look";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the stones of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A stone the blueprint already has is this solid, so it stands out from the stones still needed. */
const DELIVERED_OPACITY = 0.7;
/** Three greys of river stone, matching the stone in a pile, so neighbouring stones differ a little. */
const STONE_COLOURS = [0x8a8d8f, 0x7f8386, 0x96999b] as const;
/** The pale grey of a stone waiting in its place. */
const DELIVERED_COLOUR = 0xb9bec2;
/** How high the picker reaches, in metres: to the top of the chimney. */
const PICK_HEIGHT_METRES = 1.7;

/** What a click on a fireplace blueprint landed on. A finished fireplace is found with `pickFinished`. */
export type FireplaceHit = { kind: "blueprint"; entity: Entity };

export interface FireplaceMeshes {
  readonly group: THREE.Group;
  /** Brings every fireplace and fireplace blueprint up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among fireplace blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: FireplaceHit; distance: number } | undefined;
  /** The finished fireplace a ray hits first, and how far away. */
  pickFinished(raycaster: THREE.Raycaster): { entity: Entity; distance: number } | undefined;
  /** The stones of a fireplace or fireplace blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: FireplaceHit): OutlinePart[];
  /** Shows a fireplace blueprint under the mouse at `spot`, facing `turns`, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; turns: QuarterTurns; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One stone: its size across x, up y, and along z, and where its middle is, in metres, with the fireplace facing the default way. */
interface StoneBlock {
  readonly size: readonly [number, number, number];
  readonly middle: readonly [number, number, number];
}

/** The 12 stones in the order construction lays them: two courses of walls round the hearth floor, the slab on top, then the chimney. */
const STONES: readonly StoneBlock[] = [
  { size: [0.46, 0.06, 0.5], middle: [0, 0.03, 0.1] },
  { size: [0.9, 0.3, 0.25], middle: [0, 0.15, -0.3] },
  { size: [0.22, 0.3, 0.55], middle: [-0.34, 0.15, 0.1] },
  { size: [0.22, 0.3, 0.55], middle: [0.34, 0.15, 0.1] },
  { size: [0.9, 0.3, 0.25], middle: [0, 0.45, -0.3] },
  { size: [0.22, 0.3, 0.55], middle: [-0.34, 0.45, 0.1] },
  { size: [0.22, 0.3, 0.55], middle: [0.34, 0.45, 0.1] },
  { size: [0.96, 0.14, 0.86], middle: [0, 0.67, -0.03] },
  { size: [0.6, 0.24, 0.45], middle: [0, 0.86, -0.2] },
  { size: [0.4, 0.3, 0.35], middle: [0, 1.13, -0.22] },
  { size: [0.4, 0.3, 0.35], middle: [0, 1.43, -0.22] },
  { size: [0.5, 0.08, 0.44], middle: [0, 1.62, -0.22] },
];

/** One stage of construction: its stone, with its own see-through copy of the stone material for fading in. */
interface Stage {
  readonly mesh: THREE.Mesh;
  readonly solid: THREE.MeshStandardMaterial;
  readonly fading: THREE.MeshStandardMaterial;
}

interface Drawn {
  readonly root: THREE.Group;
  readonly stages: Stage[];
  readonly picker: THREE.Mesh;
}

export function createFireplaceMeshes(entities: EntityStore): FireplaceMeshes {
  const group = new THREE.Group();
  const geometries = STONES.map(({ size }) => new THREE.BoxGeometry(...size));
  const pickGeometry = new THREE.BoxGeometry(1, PICK_HEIGHT_METRES, 1).translate(0, PICK_HEIGHT_METRES / 2, 0);
  const stoneMaterials = STONE_COLOURS.map((color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95 }));
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(DELIVERED_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const fireplaces = fireplaceEntities(entities);

  /** Adds every stone to `root`, all in the blueprint material. */
  function addStages(root: THREE.Group): Stage[] {
    return STONES.map(({ middle }, index) => {
      const solid = stoneMaterials[index % stoneMaterials.length] ?? blueprintMaterial;
      const fading = solid.clone();
      fading.transparent = true;
      const mesh = new THREE.Mesh(geometries[index], blueprintMaterial);
      mesh.position.set(...middle);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      return { mesh, solid, fading };
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
   * Shows how far construction has gone. Laid stones are solid and in place, the stone being laid fades in and is set down,
   * stones the blueprint already has wait half solid, and the rest show see-through.
   */
  function showProgress(item: Drawn, entity: Entity & { position: Vec3 }, progress: number, delivered: number): void {
    item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
    item.root.rotation.y = quarterTurnsToRadians(entity.facing?.turns ?? 0);
    const stagesDone = progress * FIREPLACE_STONE_COST;
    item.stages.forEach((stage, index) => {
      const [x, y, z] = STONES[index]?.middle ?? [0, 0, 0];
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        stage.mesh.material = index < delivered ? deliveredMaterial : blueprintMaterial;
        stage.mesh.position.set(x, y, z);
        return;
      }
      const opacity = buildOpacity(share);
      stage.fading.opacity = opacity;
      stage.mesh.material = opacity < 1 ? stage.fading : stage.solid;
      stage.mesh.position.set(x, y + buildLift(share), z);
    });
  }

  function disposeFading(stages: readonly Stage[]): void {
    for (const stage of stages) stage.fading.dispose();
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
        if (entity.blueprint.structure !== "fireplace") continue;
        showProgress(draw(entity), entity, entity.blueprint.progress, entity.blueprint.delivered.stone ?? 0);
        seen.add(entity);
      }
      for (const entity of fireplaces) {
        showProgress(draw(entity), entity, 1, FIREPLACE_STONE_COST);
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
    pickFinished(raycaster) {
      return pickFinished(raycaster, pickers);
    },
    outlineOf(hit) {
      const item = drawn.get(hit.entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.stages.map(({ mesh }) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPlacingBlueprint(shown) {
      placingBlueprint.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      placingStages.forEach((stage, index) => {
        stage.mesh.material = material;
        stage.mesh.position.set(...(STONES[index]?.middle ?? [0, 0, 0]));
      });
      placingBlueprint.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
      placingBlueprint.rotation.y = quarterTurnsToRadians(shown.turns);
    },
    dispose() {
      for (const item of [...geometries, pickGeometry, ...stoneMaterials, blueprintMaterial, deliveredMaterial, notAllowedMaterial, pickMaterial]) {
        item.dispose();
      }
      disposeFading(placingStages);
      for (const item of drawn.values()) disposeFading(item.stages);
    },
  };
}
