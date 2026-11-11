// Draws foundations and foundation blueprints: the "foundation" asset in asset-manifest.json, a draft built in code.
// A foundation is a deck of debarked logs laid side by side over one building-grid square, on a leg at each corner.
// The legs reach down to the ground, so on a slope the legs on the low side are longer.
// A blueprint shows the deck and legs see-through. Each debarked log the player has delivered shows pale and half solid
// in its place, so the blueprint shows how many logs it has and how many it still needs.
// Construction has one stage per log. The legs go in when work starts. Then each log fades in above its place,
// is lowered, and set down, like the sticks of a campfire.
// While the player places a foundation from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { foundationEntities, blueprintEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { FOUNDATION_DECK_THICKNESS_METRES, foundationLegs } from "../sim/foundations";
import { FOUNDATION_LOG_COST } from "../sim/structures";
import { BUILD_FADE_SHARE, buildLift } from "./campfire-meshes";
import { DEBARKED_LOG_COLOUR } from "./debarked-log-shape";
import type { OutlinePart } from "./hover-outline";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A delivered log waiting in its place is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/** A blueprint under the mouse shows in this red where its spot is not allowed. */
const NOT_ALLOWED_COLOUR = 0xe0614f;
/** The legs are a little darker than the deck, as if cut from the heart of the log. */
const LEG_COLOUR = 0xb8966a;
const LEG_RADIUS_METRES = 0.06;
/** Each deck log is as thick as the deck. The logs lie along x, side by side across z. */
const DECK_LOG_RADIUS_METRES = FOUNDATION_DECK_THICKNESS_METRES / 2;
/** A leg shorter than this still shows, so a foundation on flat ground does not float. */
const SHORTEST_LEG_METRES = 0.02;

/** What a click on a foundation blueprint landed on. Finished foundations are walked on, not clicked. */
export type FoundationHit = { kind: "blueprint"; entity: Entity };

export interface FoundationMeshes {
  readonly group: THREE.Group;
  /** Brings every foundation and foundation blueprint up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among foundation blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: FoundationHit; distance: number } | undefined;
  /** The logs and legs of a foundation blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: FoundationHit): OutlinePart[];
  /** Shows a foundation blueprint under the mouse with its deck top at `spot`, red where it is not allowed. Undefined hides it. */
  showPreview(preview: { spot: Vec3; allowed: boolean } | undefined): void;
  dispose(): void;
}

interface Drawn {
  readonly root: THREE.Group;
  /** Each deck log, with its own see-through copy of the wood for fading in. */
  readonly logs: { mesh: THREE.Mesh; fading: THREE.MeshStandardMaterial }[];
  readonly legs: THREE.Mesh[];
  readonly picker: THREE.Mesh;
}

/** `groundAt` gives the height of the ground at a spot, so the legs reach it. */
export function createFoundationMeshes(entities: EntityStore, groundAt: (x: number, z: number) => number): FoundationMeshes {
  const group = new THREE.Group();
  const logGeometry = new THREE.CylinderGeometry(DECK_LOG_RADIUS_METRES, DECK_LOG_RADIUS_METRES, BUILD_GRID_METRES, 8).rotateZ(Math.PI / 2);
  // One metre tall with its top at the origin, so scaling it makes a leg of any length hanging down from the deck.
  const legGeometry = new THREE.CylinderGeometry(LEG_RADIUS_METRES, LEG_RADIUS_METRES * 1.15, 1, 6).translate(0, -0.5, 0);
  const pickGeometry = new THREE.BoxGeometry(BUILD_GRID_METRES, FOUNDATION_DECK_THICKNESS_METRES * 2, BUILD_GRID_METRES);
  const woodMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true });
  const legMaterial = new THREE.MeshStandardMaterial({ color: LEG_COLOUR, flatShading: true });
  const see = (color: number, opacity: number) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false });
  const blueprintMaterial = see(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = see(DEBARKED_LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = see(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const foundations = foundationEntities(entities);

  /** Adds the deck logs and legs to `root`, all in one material. */
  function addParts(root: THREE.Group): { logs: THREE.Mesh[]; legs: THREE.Mesh[] } {
    const logs: THREE.Mesh[] = [];
    for (let i = 0; i < FOUNDATION_LOG_COST; i += 1) {
      const mesh = new THREE.Mesh(logGeometry, blueprintMaterial);
      mesh.castShadow = true;
      root.add(mesh);
      logs.push(mesh);
    }
    const legs: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i += 1) {
      const mesh = new THREE.Mesh(legGeometry, blueprintMaterial);
      mesh.castShadow = true;
      root.add(mesh);
      legs.push(mesh);
    }
    return { logs, legs };
  }

  /** Lays the deck logs side by side, `lift` metres above their places, and stretches each leg down to the ground. */
  function fit(root: THREE.Group, logs: readonly THREE.Mesh[], legs: readonly THREE.Mesh[], deck: Vec3, lifts: readonly number[] = []): void {
    root.position.set(deck.x, deck.y, deck.z);
    logs.forEach((mesh, i) => {
      const across = -BUILD_GRID_METRES / 2 + ((i + 0.5) * BUILD_GRID_METRES) / logs.length;
      mesh.position.set(0, -DECK_LOG_RADIUS_METRES + (lifts[i] ?? 0), across);
    });
    foundationLegs(deck, groundAt).forEach((leg, i) => {
      const mesh = legs[i];
      if (mesh === undefined) return;
      mesh.position.set(leg.x - deck.x, leg.top - deck.y, leg.z - deck.z);
      mesh.scale.y = Math.max(SHORTEST_LEG_METRES, leg.top - leg.bottom);
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
    const logs = parts.logs.map((mesh) => {
      const fading = woodMaterial.clone();
      fading.transparent = true;
      return { mesh, fading };
    });
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.position.y = -FOUNDATION_DECK_THICKNESS_METRES / 2;
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const result = { root, logs, legs: parts.legs, picker };
    drawn.set(entity, result);
    return result;
  }

  /**
   * Shows how far construction has gone. Built logs are solid and in place, the log being laid moves through its stage,
   * delivered logs wait half solid in their places, and the rest show see-through. The legs go in when work starts.
   */
  function showProgress(item: Drawn, deck: Vec3, progress: number, delivered: number): void {
    const stagesDone = progress * item.logs.length;
    const lifts = item.logs.map(({ mesh, fading }, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        mesh.material = index < delivered ? deliveredMaterial : blueprintMaterial;
        return 0;
      }
      fading.opacity = Math.min(1, share / BUILD_FADE_SHARE);
      mesh.material = fading.opacity < 1 ? fading : woodMaterial;
      return buildLift(share);
    });
    for (const leg of item.legs) leg.material = progress > 0 ? legMaterial : blueprintMaterial;
    fit(item.root, item.logs.map(({ mesh }) => mesh), item.legs, deck, lifts);
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    for (const { fading } of item.logs) fading.dispose();
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      for (const entity of blueprints) {
        if (entity.blueprint.piece !== "foundation") continue;
        showProgress(draw(entity), entity.position, entity.blueprint.progress, entity.blueprint.delivered.debarkedLog ?? 0);
        seen.add(entity);
      }
      for (const entity of foundations) {
        // A finished foundation is walked on, so pick skips it and clicks reach the ground under it.
        showProgress(draw(entity), entity.position, 1, FOUNDATION_LOG_COST);
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
      return [...item.logs.map(({ mesh }) => mesh), ...item.legs].map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPreview(shown) {
      preview.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const mesh of [...previewParts.logs, ...previewParts.legs]) mesh.material = material;
      fit(preview, previewParts.logs, previewParts.legs, shown.spot);
    },
    dispose() {
      for (const item of [
        logGeometry, legGeometry, pickGeometry, woodMaterial, legMaterial, blueprintMaterial, deliveredMaterial, notAllowedMaterial, pickMaterial,
      ]) {
        item.dispose();
      }
      for (const item of drawn.values()) for (const { fading } of item.logs) fading.dispose();
    },
  };
}
