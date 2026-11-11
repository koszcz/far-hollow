// Draws trees, stumps, logs, and sticks, which are listed in asset-manifest.json as "trees", "stumps", "logs", and "sticks".
// Trees use Kenney's tree models from tree-model.ts, which the owner approved. Stumps, logs, and sticks
// are code-built drafts. Felled trees fall with the code-built "chop-animation".
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LOGS_PER_TREE } from "../sim/chopping";
import { logEntities, playerEntities, stickEntities, stumpEntities, treeEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import type { OutlinePart } from "./hover-outline";
import { createLogGeometry, LOG_COLOUR } from "./log-shape";
import type { TreeShape, TreeTone } from "./tree-model";

const TRUNK_COLOUR = 0x6b4a2b;
const LIGHT_TRUNK_COLOUR = 0x7d5634;
const CROWN_COLOUR = 0x2f5a2a;
const LIGHT_CROWN_COLOUR = 0x4a7a2e;
/** How often each tree type grows, relative to the others. Pines fill most of the valley. Unlisted types get 1. */
const TREE_TYPE_WEIGHTS: Readonly<Record<string, number>> = {
  tree_pineDefaultA: 4,
  tree_pineDefaultB: 4,
  tree_pineTallA: 3,
  tree_pineRoundA: 2,
};
const STUMP_TOP_COLOUR = 0xc9a46a;
/** Lighter than the trunks and the ground, so sticks stand out on the forest floor. */
const STICK_COLOUR = 0xb08654;

const TRUNK_RADIUS_METRES = 0.3;
const STUMP_HEIGHT_METRES = 0.4;
/** Each tree is drawn between these sizes, so the forest does not look copy-pasted. */
const TREE_MIN_SCALE = 0.8;
const TREE_MAX_SCALE = 1.25;
/** Logs lie on the ground, so their middle sits this far above it. */
const LOG_REST_HEIGHT_METRES = 0.18;
const STICK_LENGTH_METRES = 0.9;
const STICK_RADIUS_METRES = 0.05;
/** Each stick has one short side twig, so it reads as a branch and not a line. */
const TWIG_LENGTH_METRES = 0.3;
const TWIG_RADIUS_METRES = 0.03;
/** Sticks float this far above their spot, so the ground's slope does not swallow them. */
const STICK_LIFT_METRES = 0.03;
/** Sticks are thin, so clicks hit an invisible box this wide around each one, in metres. */
const STICK_PICK_WIDTH_METRES = 0.35;
/** How long a felled tree takes to hit the ground, in seconds. */
const FALL_SECONDS = 1.6;

/** What a click on the forest landed on. */
export type ForestHit = { kind: "tree"; entity: Entity } | { kind: "log"; entity: Entity } | { kind: "stick"; entity: Entity };

export interface ForestMeshes {
  readonly group: THREE.Group;
  /** Brings stumps, logs, and falling trees up to date. `nowSeconds` is a steady real-time clock. */
  update(nowSeconds: number): void;
  /** What a ray from the camera hits first among standing trees, logs, and sticks, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: ForestHit; distance: number } | undefined;
  /** The shapes that draw a tree, log, or stick, placed in the world. Empty once it is gone. */
  outlineOf(hit: ForestHit): OutlinePart[];
  dispose(): void;
}

export function createForestMeshes(entities: EntityStore, treeShapes: readonly TreeShape[]): ForestMeshes {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  function track<T extends { dispose(): void }>(item: T): T {
    disposables.push(item);
    return item;
  }

  // Trees: for each type, one batch for its trunks and one for its crowns, so thousands of trees take a few draw calls.
  const trees = [...treeEntities(entities)];
  const trunkMaterials: Record<TreeTone, THREE.MeshStandardMaterial> = {
    dark: track(new THREE.MeshStandardMaterial({ color: TRUNK_COLOUR, flatShading: true })),
    light: track(new THREE.MeshStandardMaterial({ color: LIGHT_TRUNK_COLOUR, flatShading: true })),
  };
  const crownMaterials: Record<TreeTone, THREE.MeshStandardMaterial> = {
    dark: track(new THREE.MeshStandardMaterial({ color: CROWN_COLOUR, flatShading: true })),
    light: track(new THREE.MeshStandardMaterial({ color: LIGHT_CROWN_COLOUR, flatShading: true })),
  };
  const trunkMaterial = trunkMaterials.dark;
  for (const shape of treeShapes) {
    track(shape.trunk);
    track(shape.crown);
  }

  type Tree = (typeof trees)[number];
  const typeOf = new Map<Entity, number>();
  const treesOfType: Tree[][] = treeShapes.map(() => []);
  for (const tree of trees) {
    const type = treeTypeFor(tree.position.x, tree.position.z, treeShapes);
    typeOf.set(tree, type);
    treesOfType[type]?.push(tree);
  }
  const matrix = new THREE.Matrix4();
  const instanceOf = new Map<Entity, number>();
  /** The trees each batch draws, in instance order, so a click on a batch can find its tree. */
  const treesOfBatch = new Map<THREE.Object3D, Tree[]>();
  const treeBatches = treeShapes.map((shape, type) => {
    const ofType = treesOfType[type] ?? [];
    const trunks = track(new THREE.InstancedMesh(shape.trunk, trunkMaterials[shape.trunkTone], Math.max(1, ofType.length)));
    const crowns = track(new THREE.InstancedMesh(shape.crown, crownMaterials[shape.crownTone], Math.max(1, ofType.length)));
    trunks.count = ofType.length;
    crowns.count = ofType.length;
    ofType.forEach((tree, index) => {
      instanceOf.set(tree, index);
      treeMatrix(tree.position, matrix);
      trunks.setMatrixAt(index, matrix);
      crowns.setMatrixAt(index, matrix);
    });
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();
    treesOfBatch.set(trunks, ofType);
    treesOfBatch.set(crowns, ofType);
    group.add(trunks, crowns);
    return { trunks, crowns };
  });
  const treePickTargets = treeBatches.flatMap(({ trunks, crowns }) => [trunks, crowns]);

  // Stumps: one batch. A tree's stump keeps the tree's size and turn.
  const stumpGeometry = track(new THREE.CylinderGeometry(TRUNK_RADIUS_METRES, TRUNK_RADIUS_METRES * 1.1, STUMP_HEIGHT_METRES, 6));
  stumpGeometry.translate(0, STUMP_HEIGHT_METRES / 2, 0);
  const stumpMaterials = [
    trunkMaterial,
    track(new THREE.MeshStandardMaterial({ color: STUMP_TOP_COLOUR, flatShading: true })),
    trunkMaterial,
  ];
  const stumps = track(new THREE.InstancedMesh(stumpGeometry, stumpMaterials, Math.max(1, trees.length)));
  stumps.count = 0;
  stumps.frustumCulled = false;
  group.add(stumps);

  // Logs on the ground: one batch, with room for every log the valley's trees can give.
  const logGeometry = track(createLogGeometry());
  const logMaterial = track(new THREE.MeshStandardMaterial({ color: LOG_COLOUR, flatShading: true }));
  const logCapacity = Math.max(1, trees.length * LOGS_PER_TREE);
  const logs = track(new THREE.InstancedMesh(logGeometry, logMaterial, logCapacity));
  logs.count = 0;
  logs.frustumCulled = false;
  group.add(logs);
  let logsDrawn: Entity[] = [];

  // Sticks on the ground: one batch, with room for every stick the valley starts with. No new sticks appear later.
  const stickGeometry = track(createStickGeometry());
  const stickMaterial = track(new THREE.MeshStandardMaterial({ color: STICK_COLOUR, flatShading: true }));
  const stickCapacity = Math.max(1, stickEntities(entities).size);
  const sticks = track(new THREE.InstancedMesh(stickGeometry, stickMaterial, stickCapacity));
  sticks.count = 0;
  sticks.frustumCulled = false;
  group.add(sticks);
  // An invisible, wider copy of each stick that clicks are tested against, because the drawn sticks are too thin to hit.
  const stickPickGeometry = track(new THREE.BoxGeometry(STICK_LENGTH_METRES, STICK_PICK_WIDTH_METRES, STICK_PICK_WIDTH_METRES));
  const stickPickMaterial = track(new THREE.MeshBasicMaterial());
  const stickPickers = track(new THREE.InstancedMesh(stickPickGeometry, stickPickMaterial, stickCapacity));
  stickPickers.count = 0;
  let sticksDrawn: Entity[] = [];

  // Falling trees: a few short-lived meshes that share the tree shapes.
  /** `axis` is what the pivot turns about to tip the tree's top away from the player. */
  const falling: { pivot: THREE.Group; axis: THREE.Vector3; startSeconds: number | undefined }[] = [];
  const players = playerEntities(entities);

  const standing = treeEntities(entities).connect();
  standing.onEntityRemoved.subscribe((tree) => {
    const index = instanceOf.get(tree);
    const type = typeOf.get(tree);
    const batch = type === undefined ? undefined : treeBatches[type];
    if (index === undefined || type === undefined || batch === undefined) return;
    // Hide this tree in its batch. Its falling copy takes over.
    matrix.makeScale(0, 0, 0);
    batch.trunks.setMatrixAt(index, matrix);
    batch.crowns.setMatrixAt(index, matrix);
    batch.trunks.instanceMatrix.needsUpdate = true;
    batch.crowns.instanceMatrix.needsUpdate = true;
    startFall(tree.position, type);
  });
  const stumpQuery = stumpEntities(entities).connect();
  const logQuery = logEntities(entities).connect();
  const stickQuery = stickEntities(entities).connect();
  let stumpsDirty = true;
  let logsDirty = true;
  let sticksDirty = true;
  const markStumps = () => {
    stumpsDirty = true;
  };
  const markLogs = () => {
    logsDirty = true;
  };
  stumpQuery.onEntityAdded.subscribe(markStumps);
  stumpQuery.onEntityRemoved.subscribe(markStumps);
  logQuery.onEntityAdded.subscribe(markLogs);
  logQuery.onEntityRemoved.subscribe(markLogs);
  const markSticks = () => {
    sticksDirty = true;
  };
  stickQuery.onEntityAdded.subscribe(markSticks);
  stickQuery.onEntityRemoved.subscribe(markSticks);

  function startFall(at: Vec3, type: number): void {
    const player = players.first;
    const awayX = player ? at.x - player.position.x : 1;
    const awayZ = player ? at.z - player.position.z : 0;
    const length = Math.hypot(awayX, awayZ) || 1;
    const pivot = new THREE.Group();
    pivot.position.set(at.x, at.y, at.z);
    const axis = new THREE.Vector3(awayZ / length, 0, -awayX / length);
    const tree = new THREE.Group();
    treeMatrix({ x: 0, y: 0, z: 0, look: lookFor(at.x, at.z) }, matrix);
    tree.applyMatrix4(matrix);
    const batch = treeBatches[type];
    if (batch !== undefined) tree.add(new THREE.Mesh(batch.trunks.geometry, batch.trunks.material), new THREE.Mesh(batch.crowns.geometry, batch.crowns.material));
    pivot.add(tree);
    group.add(pivot);
    falling.push({ pivot, axis, startSeconds: undefined });
  }

  function rebuildStumps(): void {
    let count = 0;
    for (const stump of stumpQuery) {
      if (count >= stumps.instanceMatrix.count) break;
      treeMatrix(stump.position, matrix);
      stumps.setMatrixAt(count, matrix);
      count += 1;
    }
    stumps.count = count;
    stumps.instanceMatrix.needsUpdate = true;
  }

  const logRotation = new THREE.Quaternion();
  const logPosition = new THREE.Vector3();
  const logScale = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  function rebuildLogs(): void {
    logsDrawn = [];
    for (const log of logQuery) {
      if (logsDrawn.length >= logCapacity) break;
      logRotation.setFromAxisAngle(up, log.log.heading);
      logPosition.set(log.position.x, log.position.y + LOG_REST_HEIGHT_METRES, log.position.z);
      matrix.compose(logPosition, logRotation, logScale);
      logs.setMatrixAt(logsDrawn.length, matrix);
      logsDrawn.push(log);
    }
    logs.count = logsDrawn.length;
    logs.instanceMatrix.needsUpdate = true;
    // Clicks test this sphere first, so it must cover the logs as they lie now.
    logs.computeBoundingSphere();
  }

  function rebuildSticks(): void {
    sticksDrawn = [];
    for (const stick of stickQuery) {
      if (sticksDrawn.length >= stickCapacity) break;
      // Each stick lies at its own steady angle, picked from its spot.
      logRotation.setFromAxisAngle(up, lookFor(stick.position.x, stick.position.z) * Math.PI * 2);
      logPosition.set(stick.position.x, stick.position.y, stick.position.z);
      matrix.compose(logPosition, logRotation, logScale);
      sticks.setMatrixAt(sticksDrawn.length, matrix);
      stickPickers.setMatrixAt(sticksDrawn.length, matrix);
      sticksDrawn.push(stick);
    }
    sticks.count = sticksDrawn.length;
    stickPickers.count = sticksDrawn.length;
    sticks.instanceMatrix.needsUpdate = true;
    stickPickers.instanceMatrix.needsUpdate = true;
    // Clicks test this sphere first, so it must cover the sticks as they lie now.
    stickPickers.computeBoundingSphere();
  }

  const spin = new THREE.Quaternion();
  const hits: THREE.Intersection[] = [];

  return {
    group,
    update(nowSeconds) {
      if (stumpsDirty) rebuildStumps();
      if (logsDirty) rebuildLogs();
      if (sticksDirty) rebuildSticks();
      stumpsDirty = false;
      logsDirty = false;
      sticksDirty = false;
      for (let i = falling.length - 1; i >= 0; i -= 1) {
        const fall = falling[i];
        if (fall === undefined) continue;
        fall.startSeconds ??= nowSeconds;
        const t = Math.min(1, (nowSeconds - fall.startSeconds) / FALL_SECONDS);
        // Speeds up as it goes, like a real tree toppling.
        spin.setFromAxisAngle(fall.axis, t * t * (Math.PI / 2));
        fall.pivot.quaternion.copy(spin);
        if (t >= 1) {
          group.remove(fall.pivot);
          falling.splice(i, 1);
        }
      }
    },
    pick(raycaster) {
      hits.length = 0;
      raycaster.intersectObjects([...treePickTargets, logs, stickPickers], false, hits);
      hits.sort((a, b) => a.distance - b.distance);
      for (const hit of hits) {
        if (hit.instanceId === undefined) continue;
        if (hit.object === logs) {
          const log = logsDrawn[hit.instanceId];
          if (log?.log !== undefined) return { hit: { kind: "log", entity: log }, distance: hit.distance };
          continue;
        }
        if (hit.object === stickPickers) {
          const stick = sticksDrawn[hit.instanceId];
          if (stick?.stick === true) return { hit: { kind: "stick", entity: stick }, distance: hit.distance };
          continue;
        }
        const tree = treesOfBatch.get(hit.object)?.[hit.instanceId];
        if (tree?.tree === true) return { hit: { kind: "tree", entity: tree }, distance: hit.distance };
      }
      return undefined;
    },
    outlineOf(hit) {
      group.updateMatrixWorld();
      const placed = (batch: THREE.InstancedMesh, index: number): THREE.Matrix4 => {
        batch.getMatrixAt(index, matrix);
        return new THREE.Matrix4().multiplyMatrices(group.matrixWorld, matrix);
      };
      if (hit.kind === "tree") {
        const index = instanceOf.get(hit.entity);
        const type = typeOf.get(hit.entity);
        const batch = type === undefined ? undefined : treeBatches[type];
        if (hit.entity.tree !== true || index === undefined || batch === undefined) return [];
        const at = placed(batch.trunks, index);
        return [{ geometry: batch.trunks.geometry, matrix: at }, { geometry: batch.crowns.geometry, matrix: at }];
      }
      if (hit.kind === "log") {
        const index = logsDrawn.indexOf(hit.entity);
        return index < 0 ? [] : [{ geometry: logGeometry, matrix: placed(logs, index) }];
      }
      const index = sticksDrawn.indexOf(hit.entity);
      return index < 0 ? [] : [{ geometry: stickGeometry, matrix: placed(sticks, index) }];
    },
    dispose() {
      standing.disconnect();
      stumpQuery.disconnect();
      logQuery.disconnect();
      stickQuery.disconnect();
      for (const item of disposables) item.dispose();
    },
  };
}

const treeRotation = new THREE.Quaternion();
const treeScale = new THREE.Vector3();
const treePosition = new THREE.Vector3();
const upAxis = new THREE.Vector3(0, 1, 0);

/** The size and turn a tree is drawn with at a spot. `look` overrides the value picked from the spot. */
function treeMatrix(at: Vec3 & { look?: number }, out: THREE.Matrix4): THREE.Matrix4 {
  const look = at.look ?? lookFor(at.x, at.z);
  treeRotation.setFromAxisAngle(upAxis, look * Math.PI * 2);
  treeScale.setScalar(TREE_MIN_SCALE + (TREE_MAX_SCALE - TREE_MIN_SCALE) * look);
  treePosition.set(at.x, at.y, at.z);
  return out.compose(treePosition, treeRotation, treeScale);
}

/** The tree type drawn at a spot, picked by TREE_TYPE_WEIGHTS. It only affects drawing. */
function treeTypeFor(x: number, z: number, shapes: readonly TreeShape[]): number {
  const weights = shapes.map((shape) => TREE_TYPE_WEIGHTS[shape.name] ?? 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  // Offset the spot, so a tree's type does not follow its size.
  let roll = lookFor(x + 31.7, z - 17.3) * total;
  for (const [type, weight] of weights.entries()) {
    roll -= weight;
    if (roll < 0) return type;
  }
  return shapes.length - 1;
}

/** A steady value from 0 to 1 for a spot, used to vary each tree's size and turn. It only affects drawing. */
function lookFor(x: number, z: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

/** A stick lying along x: a tapered branch with one twig forking off it, resting on y = 0. */
function createStickGeometry(): THREE.BufferGeometry {
  const branch = new THREE.CylinderGeometry(STICK_RADIUS_METRES * 0.7, STICK_RADIUS_METRES, STICK_LENGTH_METRES, 6);
  branch.rotateZ(Math.PI / 2);
  const twig = new THREE.CylinderGeometry(TWIG_RADIUS_METRES * 0.6, TWIG_RADIUS_METRES, TWIG_LENGTH_METRES, 5);
  // The twig starts a little past the middle and angles forward and sideways along the ground.
  twig.translate(0, TWIG_LENGTH_METRES / 2, 0);
  twig.rotateZ(-Math.PI / 2 + 0.6);
  twig.rotateX(Math.PI / 2 - 0.15);
  twig.translate(STICK_LENGTH_METRES * 0.1, 0, 0);
  const stick = mergeGeometries([branch, twig]);
  branch.dispose();
  twig.dispose();
  stick.translate(0, STICK_RADIUS_METRES + STICK_LIFT_METRES, 0);
  return stick;
}
