// Draws sleds and sled blueprints: the draft "sled" asset in asset-manifest.json, built in code. Added by sled ticket 01.
// A sled is two log runners with their bark on, lying side by side, and four sticks laid across them.
// Its runners run along x when it faces the default way.
// Construction has one stage per material: a runner for each log, then a cross piece for each stick.
// Each part fades in above its place and is set down, like the sticks of a campfire.
// A blueprint shows the parts see-through. A runner whose log has been delivered shows pale and half solid.
// While the player places a sled from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
// It draws an empty sled. The logs it carries come later.
import * as THREE from "three";
import { buildLift, buildOpacity, facingRadians, NOT_ALLOWED_COLOUR, pickFinished, seeThrough } from "./structure-look";
import { blueprintEntities, sledEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { SLED_LENGTH_METRES, SLED_LOG_COST, SLED_STICK_COST, SLED_WIDTH_METRES } from "../sim/structures";
import { LOG_COLOUR, LOG_CUT_COLOUR } from "./log-shape";
import { STICK_COLOUR } from "./stick-shape";
import type { OutlinePart } from "./hover-outline";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A runner whose log has been delivered is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/** The radius of each runner, in metres. */
const RUNNER_RADIUS_METRES = 0.1;
/** Each runner has this many sides. */
const RUNNER_SIDES = 8;
/** The radius of each cross piece, in metres. */
const CROSS_RADIUS_METRES = 0.03;
/** Each cross piece has this many sides. */
const CROSS_SIDES = 5;
/** The cross pieces stand this far in from the ends of the runners, in metres. */
const CROSS_INSET_METRES = 0.3;

/** What a click on a sled blueprint landed on. A finished sled is found by `pickFinished`. */
export type SledHit = { kind: "blueprint"; entity: Entity };

export interface SledMeshes {
  readonly group: THREE.Group;
  /** Brings every sled and sled blueprint up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among sled blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: SledHit; distance: number } | undefined;
  /** The finished sled a ray meets first. The action menu uses it. */
  pickFinished(raycaster: THREE.Raycaster): { entity: Entity; distance: number } | undefined;
  /** The parts of a sled or sled blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: SledHit): OutlinePart[];
  /** Shows a sled blueprint under the mouse at `spot`, facing `turns`, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; turns: number; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One round part lying along x: its radius, length, sides, and middle. A runner is a log. A cross piece is a stick turned along z. */
interface Part {
  readonly radius: number;
  readonly length: number;
  readonly sides: number;
  readonly middle: THREE.Vector3;
  readonly alongZ: boolean;
}

/** One stage of construction: its mesh, with its own see-through copy of the wood for fading in. */
interface Stage {
  readonly root: THREE.Group;
  readonly mesh: THREE.Mesh;
  readonly fading: THREE.MeshStandardMaterial[];
}

interface Drawn {
  readonly root: THREE.Group;
  readonly stages: Stage[];
  readonly picker: THREE.Mesh;
}

/** The parts in the order construction lays them: a runner for each log, then a cross piece for each stick. */
function sledParts(): Part[] {
  const runnerZ = SLED_WIDTH_METRES / 2 - RUNNER_RADIUS_METRES;
  const runners = Array.from({ length: SLED_LOG_COST }, (_, i): Part => {
    const side = -1 + (2 * i) / Math.max(1, SLED_LOG_COST - 1);
    return {
      radius: RUNNER_RADIUS_METRES,
      length: SLED_LENGTH_METRES,
      sides: RUNNER_SIDES,
      middle: new THREE.Vector3(0, RUNNER_RADIUS_METRES, side * runnerZ),
      alongZ: false,
    };
  });
  const span = SLED_LENGTH_METRES - 2 * CROSS_INSET_METRES;
  const crossY = 2 * RUNNER_RADIUS_METRES + CROSS_RADIUS_METRES;
  const crosses = Array.from({ length: SLED_STICK_COST }, (_, i): Part => {
    const x = -span / 2 + (span * i) / Math.max(1, SLED_STICK_COST - 1);
    return { radius: CROSS_RADIUS_METRES, length: SLED_WIDTH_METRES, sides: CROSS_SIDES, middle: new THREE.Vector3(x, crossY, 0), alongZ: true };
  });
  return [...runners, ...crosses];
}

export function createSledMeshes(entities: EntityStore): SledMeshes {
  const group = new THREE.Group();
  const parts = sledParts();
  const geometries = parts.map(({ radius, length, sides, alongZ }) => {
    const geometry = new THREE.CylinderGeometry(radius, radius, length, sides);
    // A cylinder stands along y. Lay it along x, or along z for a cross piece.
    if (alongZ) geometry.rotateX(Math.PI / 2);
    else geometry.rotateZ(Math.PI / 2);
    return geometry;
  });
  const height = 2 * RUNNER_RADIUS_METRES + 2 * CROSS_RADIUS_METRES;
  const pickGeometry = new THREE.BoxGeometry(SLED_LENGTH_METRES, height, SLED_WIDTH_METRES).translate(0, height / 2, 0);

  // A cylinder's groups are its side, then its two ends. A runner shows bark on its side and pale cut ends.
  const barkMaterial = new THREE.MeshStandardMaterial({ color: LOG_COLOUR, flatShading: true });
  const cutMaterial = new THREE.MeshStandardMaterial({ color: LOG_CUT_COLOUR, flatShading: true });
  const stickMaterial = new THREE.MeshStandardMaterial({ color: STICK_COLOUR, flatShading: true });
  const solidMaterials = parts.map(({ alongZ }) => (alongZ ? [stickMaterial, stickMaterial, stickMaterial] : [barkMaterial, cutMaterial, cutMaterial]));
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const sleds = sledEntities(entities);

  /** Adds every part, one per stage, to `root`, all in one material. */
  function addStages(root: THREE.Group): Stage[] {
    return parts.map(({ middle }, index) => {
      const stageRoot = new THREE.Group();
      root.add(stageRoot);
      const fading = (solidMaterials[index] ?? []).map((material) => {
        const copy = material.clone();
        copy.transparent = true;
        return copy;
      });
      const mesh = new THREE.Mesh(geometries[index], blueprintMaterial);
      mesh.position.copy(middle);
      mesh.castShadow = true;
      stageRoot.add(mesh);
      return { root: stageRoot, mesh, fading };
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
   * runners whose log has been delivered wait half solid, and the rest show see-through.
   */
  function showProgress(item: Drawn, entity: Entity & { position: Vec3 }, progress: number, delivered: number): void {
    item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
    item.root.rotation.y = facingRadians(entity.facing?.turns ?? 0);
    const stagesDone = progress * parts.length;
    item.stages.forEach((stage, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        stage.mesh.material = index < Math.min(delivered, SLED_LOG_COST) ? deliveredMaterial : blueprintMaterial;
        stage.root.position.y = 0;
        return;
      }
      const opacity = buildOpacity(share);
      for (const material of stage.fading) material.opacity = opacity;
      stage.mesh.material = opacity < 1 ? stage.fading : (solidMaterials[index] ?? blueprintMaterial);
      stage.root.position.y = buildLift(share);
    });
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
        if (entity.blueprint.structure !== "sled") continue;
        showProgress(draw(entity), entity, entity.blueprint.progress, entity.blueprint.delivered.log ?? 0);
        seen.add(entity);
      }
      for (const entity of sleds) {
        showProgress(draw(entity), entity, 1, SLED_LOG_COST);
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
      for (const stage of placingStages) {
        stage.root.position.y = 0;
        stage.mesh.material = material;
      }
      placingBlueprint.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
      placingBlueprint.rotation.y = facingRadians(shown.turns);
    },
    dispose() {
      for (const item of [
        ...geometries,
        pickGeometry,
        barkMaterial,
        cutMaterial,
        stickMaterial,
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
