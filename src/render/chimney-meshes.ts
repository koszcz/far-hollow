// Draws chimneys and chimney blueprints: the draft "chimney" asset in asset-manifest.json, built in code. Added by chimney ticket 01.
// A chimney stands on its fireplace's cap stone and rises straight up through any roof section over it. No hole is cut in the
// roof. chimney-height.ts says how tall it is, and chimney-shape.ts builds its stones.
// Construction has one stage per stone a chimney costs. Each stage fades in above its place and is set down, like the
// fireplace's stones. A blueprint shows the stones see-through, and a stone the blueprint already has shows pale and half solid.
// While the player places a chimney from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
// A chimney never hides or fades, even when the roof over the player hides.
import * as THREE from "three";
import { blueprintEntities, chimneyEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { quarterTurnsToRadians, type QuarterTurns } from "../sim/quarter-turns";
import { CHIMNEY_STONE_COST } from "../sim/structures";
import { CHIMNEY_BASE_METRES, CHIMNEY_MIDDLE, chimneyTopAt } from "./chimney-height";
import { createChimneyStageShapes, type ChimneyStageShape } from "./chimney-shape";
import type { OutlinePart } from "./hover-outline";
import { frameLayout, type FrameLayout } from "./roof-parts";
import {
  BLUEPRINT_COLOUR,
  BLUEPRINT_OPACITY,
  buildLift,
  buildOpacity,
  DELIVERED_OPACITY,
  NOT_ALLOWED_COLOUR,
  pickBlueprint,
  pickFinished,
  seeThrough,
  type BlueprintHit,
} from "./structure-look";

/** The pale grey of a stone waiting in its place. */
const DELIVERED_COLOUR = 0xb9bec2;
/** The picker is this wide and deep, in metres, a little wider than the chimney. */
const PICK_WIDTH_METRES = 0.5;
/** Heights are rounded to this many metres before shapes are built, so a chimney is not rebuilt for a tiny change. */
const HEIGHT_STEP_METRES = 0.01;

export interface ChimneyMeshes {
  readonly group: THREE.Group;
  /** Brings every chimney and chimney blueprint up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among chimney blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: BlueprintHit; distance: number } | undefined;
  /** The finished chimney a ray hits first, and how far away. */
  pickFinished(raycaster: THREE.Raycaster): { entity: Entity; distance: number } | undefined;
  /** The stones of a chimney or chimney blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: { readonly entity: Entity }): OutlinePart[];
  /** Shows a chimney blueprint under the mouse at `spot`, facing `turns`, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placing: { spot: Vec3; turns: QuarterTurns; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One stage of construction: its stones, with their own see-through copy of the stone material for fading in. */
interface Stage {
  readonly mesh: THREE.Mesh;
  readonly fading: THREE.MeshStandardMaterial;
}

/** A chimney's meshes, built for one height. */
interface Drawn {
  readonly root: THREE.Group;
  readonly top: number;
  readonly stages: Stage[];
  readonly picker: THREE.Mesh;
}

export function createChimneyMeshes(entities: EntityStore): ChimneyMeshes {
  const group = new THREE.Group();
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.92 });
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(DELIVERED_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
  /** The stage shapes for each height a chimney has been drawn at, by that height. */
  const shapesByTop = new Map<number, ChimneyStageShape[]>();
  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const chimneys = chimneyEntities(entities);
  let placing: Drawn | undefined;

  function shapesFor(top: number): ChimneyStageShape[] {
    const existing = shapesByTop.get(top);
    if (existing !== undefined) return existing;
    const shapes = createChimneyStageShapes(top);
    shapesByTop.set(top, shapes);
    return shapes;
  }

  /** How high the top of a chimney at `position` facing `turns` is drawn, rounded to HEIGHT_STEP_METRES. */
  function topOf(layout: FrameLayout, position: Vec3, turns: QuarterTurns): number {
    return Math.round(chimneyTopAt(entities, layout, position, turns) / HEIGHT_STEP_METRES) * HEIGHT_STEP_METRES;
  }

  /** Builds a chimney's meshes for a top `top` metres above the deck, every stone in the blueprint material. */
  function build(top: number, entity: Entity | undefined): Drawn {
    const root = new THREE.Group();
    const stages = shapesFor(top).map(({ geometry, middle }) => {
      const fading = stoneMaterial.clone();
      fading.transparent = true;
      const mesh = new THREE.Mesh(geometry, blueprintMaterial);
      mesh.position.set(...middle);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      return { mesh, fading };
    });
    const height = top - CHIMNEY_BASE_METRES;
    const pickGeometry = new THREE.BoxGeometry(PICK_WIDTH_METRES, height, PICK_WIDTH_METRES);
    pickGeometry.translate(CHIMNEY_MIDDLE.x, CHIMNEY_BASE_METRES + height / 2, CHIMNEY_MIDDLE.z);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    if (entity !== undefined) {
      picker.userData.entity = entity;
      root.add(picker);
      pickers.push(picker);
    }
    group.add(root);
    return { root, top, stages, picker };
  }

  function release(item: Drawn): void {
    group.remove(item.root);
    for (const stage of item.stages) stage.fading.dispose();
    item.picker.geometry.dispose();
    const at = pickers.indexOf(item.picker);
    if (at >= 0) pickers.splice(at, 1);
  }

  /** The meshes of a chimney or blueprint at `top`, rebuilt if the roof over it has changed its height. */
  function draw(entity: Entity, top: number): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined && existing.top === top) return existing;
    if (existing !== undefined) release(existing);
    const item = build(top, entity);
    drawn.set(entity, item);
    return item;
  }

  /**
   * Shows how far construction has gone. Laid stones are solid and in place, the stage being laid fades in and is set down,
   * stones the blueprint already has wait half solid, and the rest show see-through.
   */
  function showProgress(item: Drawn, entity: Entity & { position: Vec3 }, progress: number, delivered: number): void {
    const shapes = shapesFor(item.top);
    item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
    item.root.rotation.y = quarterTurnsToRadians(entity.facing?.turns ?? 0);
    const stagesDone = progress * CHIMNEY_STONE_COST;
    item.stages.forEach((stage, index) => {
      const [x, y, z] = shapes[index]?.middle ?? [0, 0, 0];
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        stage.mesh.material = index < delivered ? deliveredMaterial : blueprintMaterial;
        stage.mesh.position.set(x, y, z);
        return;
      }
      const opacity = buildOpacity(share);
      stage.fading.opacity = opacity;
      stage.mesh.material = opacity < 1 ? stage.fading : stoneMaterial;
      stage.mesh.position.set(x, y + buildLift(share), z);
    });
  }

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      const plans = blueprints.entities.filter(({ blueprint }) => blueprint.structure === "chimney");
      if (plans.length === 0 && chimneys.entities.length === 0 && drawn.size === 0) return;
      const layout = frameLayout(entities);
      for (const entity of plans) {
        const item = draw(entity, topOf(layout, entity.position, entity.facing?.turns ?? 0));
        showProgress(item, entity, entity.blueprint.progress, entity.blueprint.delivered.stone ?? 0);
        seen.add(entity);
      }
      for (const entity of chimneys) {
        const item = draw(entity, topOf(layout, entity.position, entity.facing?.turns ?? 0));
        showProgress(item, entity, 1, CHIMNEY_STONE_COST);
        seen.add(entity);
      }
      for (const [entity, item] of [...drawn]) {
        if (seen.has(entity)) continue;
        release(item);
        drawn.delete(entity);
      }
    },
    pick(raycaster) {
      return pickBlueprint(raycaster, pickers);
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
      if (shown === undefined) {
        if (placing !== undefined) placing.root.visible = false;
        return;
      }
      const top = topOf(frameLayout(entities), shown.spot, shown.turns);
      if (placing?.top !== top) {
        if (placing !== undefined) release(placing);
        placing = build(top, undefined);
      }
      placing.root.visible = true;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      const shapes = shapesFor(top);
      placing.stages.forEach((stage, index) => {
        stage.mesh.material = material;
        stage.mesh.position.set(...(shapes[index]?.middle ?? [0, 0, 0]));
      });
      placing.root.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
      placing.root.rotation.y = quarterTurnsToRadians(shown.turns);
    },
    dispose() {
      for (const item of drawn.values()) release(item);
      if (placing !== undefined) release(placing);
      for (const shapes of shapesByTop.values()) for (const { geometry } of shapes) geometry.dispose();
      for (const item of [stoneMaterial, blueprintMaterial, deliveredMaterial, notAllowedMaterial, pickMaterial]) item.dispose();
    },
  };
}
