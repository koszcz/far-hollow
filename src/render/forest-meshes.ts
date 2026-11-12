// Places trees, stumps, logs, and sticks in the valley: "trees", "stumps", "logs", and "sticks" (approved) in asset-manifest.json.
// Each asset's shape lives in its own file: tree-model.ts, stump-model.ts, log-shape.ts, and stick-shape.ts.
// Felled trees fall with tree-fall.ts, part of the approved "chop-animation".
// Debarked logs, the "debarked-log" asset (approved), are built from the log shape by debarked-log-shape.ts.
// To change how one asset looks, edit its shape file. Read this file only for where and how many are drawn.
import * as THREE from "three";
import { LOGS_PER_TREE } from "../sim/chopping";
import {
  debarkedLogEntities,
  logEntities,
  playerEntities,
  stickEntities,
  stumpEntities,
  treeEntities,
  type Entity,
  type EntityStore,
  type Vec3,
} from "../sim/entities";
import { createCulledBatch, type CulledBatch, type CullViews } from "./culled-batch";
import { createDebarkedLogGeometry } from "./debarked-log-shape";
import type { OutlinePart } from "./hover-outline";
import { LOG_COLOUR, LOG_CUT_COLOUR, type LogShape } from "./log-shape";
import { createStickGeometry, STICK_COLOUR, STICK_LENGTH_METRES } from "./stick-shape";
import type { StumpShape } from "./stump-model";
import { tiltForFall } from "./tree-fall";
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

/** A stump never stands taller than this above the ground, before the tree's own size, so wide oaks leave low stumps. */
const STUMP_MAX_HEIGHT_METRES = 0.6;
/** Only trunk points this close to the ground count when measuring how wide a trunk's foot is, in metres. */
const TRUNK_FOOT_BAND_METRES = 0.4;
/** Each tree is drawn between these sizes, so the forest does not look copy-pasted. */
const TREE_MIN_SCALE = 0.8;
const TREE_MAX_SCALE = 1.25;
/** Sticks are thin, so clicks hit an invisible box this wide around each one, in metres. */
const STICK_PICK_WIDTH_METRES = 0.35;
/** Each stick's bark is up to this share lighter or darker than the others, so the floor does not look copy-pasted. */
const STICK_SHADE_SPREAD = 0.08;

/** What a click on the forest landed on. */
export type ForestHit =
  { kind: "tree"; entity: Entity } | { kind: "log"; entity: Entity } | { kind: "debarkedLog"; entity: Entity } | { kind: "stick"; entity: Entity };

export interface ForestMeshes {
  readonly group: THREE.Group;
  /** Brings stumps, logs, and falling trees up to date. `nowSeconds` is a steady real-time clock. */
  update(nowSeconds: number): void;
  /** Draws only the standing trees each camera can see. Call it once the cameras have moved for this frame. */
  cull(views: CullViews): void;
  /** What a ray from the camera hits first among standing trees, logs, debarked logs, and sticks, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: ForestHit; distance: number } | undefined;
  /** The shapes that draw a tree, log, or stick, placed in the world. Empty once it is gone. */
  outlineOf(hit: ForestHit): OutlinePart[];
  dispose(): void;
}

export function createForestMeshes(entities: EntityStore, treeShapes: readonly TreeShape[], stumpShape: StumpShape, logShape: LogShape): ForestMeshes {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  function track<T extends { dispose(): void }>(item: T): T {
    disposables.push(item);
    return item;
  }

  // Trees: one culled batch per type, drawing its trunks and crowns, so thousands of trees take a few draw calls.
  // Each batch draws only the trees the camera sees, and casts shadows only from the trees inside the sun's shadow box.
  const trees = [...treeEntities(entities)];
  const trunkMaterials: Record<TreeTone, THREE.MeshStandardMaterial> = {
    dark: track(new THREE.MeshStandardMaterial({ color: TRUNK_COLOUR, flatShading: true })),
    light: track(new THREE.MeshStandardMaterial({ color: LIGHT_TRUNK_COLOUR, flatShading: true })),
  };
  const crownMaterials: Record<TreeTone, THREE.MeshStandardMaterial> = {
    dark: track(new THREE.MeshStandardMaterial({ color: CROWN_COLOUR, flatShading: true })),
    light: track(new THREE.MeshStandardMaterial({ color: LIGHT_CROWN_COLOUR, flatShading: true })),
  };
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
  /** The batch and trees behind each drawn mesh, so a click on a mesh can find its tree. */
  const treesOfMesh = new Map<THREE.Object3D, { batch: CulledBatch; trees: Tree[] }>();
  const treeBatches = treeShapes.map((shape, type) => {
    const ofType = treesOfType[type] ?? [];
    const trunk = { geometry: shape.trunk, material: trunkMaterials[shape.trunkTone] };
    const crown = { geometry: shape.crown, material: crownMaterials[shape.crownTone] };
    const batch = track(createCulledBatch([trunk, crown], ofType.length, true));
    ofType.forEach((tree, index) => {
      instanceOf.set(tree, index);
      batch.set(index, treeMatrix(tree.position, matrix));
    });
    batch.cull();
    for (const mesh of batch.viewMeshes) treesOfMesh.set(mesh, { batch, trees: ofType });
    group.add(...batch.meshes);
    return { batch, trunk, crown };
  });
  const treePickTargets = treeBatches.flatMap(({ batch }) => batch.viewMeshes);

  // Stumps: one batch per bark tone. A tree's stump keeps the tree's size and turn, and its foot is as wide as the trunk's.
  const stumpGeometry = track(stumpShape.geometry);
  const cutMaterial = track(new THREE.MeshStandardMaterial({ color: STUMP_TOP_COLOUR, flatShading: true }));
  const stumpFits = treeShapes.map((shape) => stumpFit(shape.trunk, stumpShape));
  const stumpBatches: Record<TreeTone, THREE.InstancedMesh> = {
    dark: track(new THREE.InstancedMesh(stumpGeometry, [trunkMaterials.dark, cutMaterial], Math.max(1, trees.length))),
    light: track(new THREE.InstancedMesh(stumpGeometry, [trunkMaterials.light, cutMaterial], Math.max(1, trees.length))),
  };
  for (const stumps of Object.values(stumpBatches)) {
    stumps.count = 0;
    stumps.frustumCulled = false;
    group.add(stumps);
  }

  // Logs on the ground: one batch, with room for every log the valley's trees can give.
  const logGeometry = track(logShape.geometry);
  const logMaterials = [
    track(new THREE.MeshStandardMaterial({ color: LOG_COLOUR, flatShading: true })),
    track(new THREE.MeshStandardMaterial({ color: LOG_CUT_COLOUR, flatShading: true })),
  ];
  const logCapacity = Math.max(1, trees.length * LOGS_PER_TREE);
  const logs = track(new THREE.InstancedMesh(logGeometry, logMaterials, logCapacity));
  logs.count = 0;
  logs.frustumCulled = false;
  group.add(logs);
  let logsDrawn: Entity[] = [];

  // Debarked logs on the ground: the same shape as logs, painted pale, with room for every log the valley's trees can give.
  const debarkedLogGeometry = track(createDebarkedLogGeometry(logShape.geometry));
  const debarkedLogMaterial = track(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, vertexColors: true }));
  const debarkedLogs = track(new THREE.InstancedMesh(debarkedLogGeometry, debarkedLogMaterial, logCapacity));
  debarkedLogs.count = 0;
  debarkedLogs.frustumCulled = false;
  group.add(debarkedLogs);
  let debarkedLogsDrawn: Entity[] = [];

  // Sticks on the ground: one batch, with room for every stick the valley starts with.
  // Taking down a structure can leave more sticks than that, so the batch grows when it runs out of room.
  const stickGeometry = track(createStickGeometry());
  // The stick geometry carries pale cut ends as vertex colours. Each stick also gets its own shade of bark.
  const stickMaterial = track(new THREE.MeshStandardMaterial({ color: STICK_COLOUR, flatShading: true, vertexColors: true }));
  // An invisible, wider copy of each stick that clicks are tested against, because the drawn sticks are too thin to hit.
  const stickPickGeometry = track(new THREE.BoxGeometry(STICK_LENGTH_METRES, STICK_PICK_WIDTH_METRES, STICK_PICK_WIDTH_METRES));
  const stickPickMaterial = track(new THREE.MeshBasicMaterial());
  let stickCapacity = 0;
  let sticks = new THREE.InstancedMesh(stickGeometry, stickMaterial, 1);
  let stickPickers = new THREE.InstancedMesh(stickPickGeometry, stickPickMaterial, 1);
  makeRoomForSticks(Math.max(1, stickEntities(entities).size));
  let sticksDrawn: Entity[] = [];
  const stickShade = new THREE.Color();

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
    batch.batch.set(index, undefined);
    startFall(tree.position, type);
  });
  // A tree that stands again, such as in the asset showcase's looping chop, shows again in its batch.
  standing.onEntityAdded.subscribe((tree) => {
    const index = instanceOf.get(tree);
    const type = typeOf.get(tree);
    const batch = type === undefined ? undefined : treeBatches[type];
    if (index === undefined || batch === undefined) return;
    batch.batch.set(index, treeMatrix(tree.position, matrix));
  });
  const stumpQuery = stumpEntities(entities).connect();
  const logQuery = logEntities(entities).connect();
  const debarkedLogQuery = debarkedLogEntities(entities).connect();
  const stickQuery = stickEntities(entities).connect();
  let stumpsDirty = true;
  let logsDirty = true;
  let debarkedLogsDirty = true;
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
  const markDebarkedLogs = () => {
    debarkedLogsDirty = true;
  };
  debarkedLogQuery.onEntityAdded.subscribe(markDebarkedLogs);
  debarkedLogQuery.onEntityRemoved.subscribe(markDebarkedLogs);
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
    if (batch !== undefined) tree.add(new THREE.Mesh(batch.trunk.geometry, batch.trunk.material), new THREE.Mesh(batch.crown.geometry, batch.crown.material));
    pivot.add(tree);
    group.add(pivot);
    falling.push({ pivot, axis, startSeconds: undefined });
  }

  function rebuildStumps(): void {
    const counts: Record<TreeTone, number> = { dark: 0, light: 0 };
    for (const stump of stumpQuery) {
      // A stump is the felled tree's entity, so it keeps the tree's type.
      const type = typeOf.get(stump) ?? 0;
      const tone = treeShapes[type]?.trunkTone ?? "dark";
      const stumps = stumpBatches[tone];
      if (counts[tone] >= stumps.instanceMatrix.count) continue;
      treeMatrix(stump.position, matrix);
      matrix.multiply(stumpFits[type] ?? IDENTITY);
      stumps.setMatrixAt(counts[tone], matrix);
      counts[tone] += 1;
    }
    for (const tone of ["dark", "light"] as const) {
      stumpBatches[tone].count = counts[tone];
      stumpBatches[tone].instanceMatrix.needsUpdate = true;
    }
  }

  const logRotation = new THREE.Quaternion();
  const logPosition = new THREE.Vector3();
  const logScale = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  /** Lays each log in `lying` into `batch`, and returns them in instance order. */
  function rebuildLogBatch(batch: THREE.InstancedMesh, lying: Iterable<{ entity: Entity; heading: number; position: Vec3 }>): Entity[] {
    const drawn: Entity[] = [];
    for (const { entity, heading, position } of lying) {
      if (drawn.length >= logCapacity) break;
      logRotation.setFromAxisAngle(up, heading);
      logPosition.set(position.x, position.y + logShape.restHeight, position.z);
      matrix.compose(logPosition, logRotation, logScale);
      batch.setMatrixAt(drawn.length, matrix);
      drawn.push(entity);
    }
    batch.count = drawn.length;
    batch.instanceMatrix.needsUpdate = true;
    // Clicks test this sphere first, so it must cover the logs as they lie now.
    batch.computeBoundingSphere();
    return drawn;
  }

  function rebuildLogs(): void {
    logsDrawn = rebuildLogBatch(
      logs,
      [...logQuery].map((log) => ({ entity: log, heading: log.log.heading, position: log.position })),
    );
  }

  function rebuildDebarkedLogs(): void {
    debarkedLogsDrawn = rebuildLogBatch(
      debarkedLogs,
      [...debarkedLogQuery].map((log) => ({ entity: log, heading: log.debarkedLog.heading, position: log.position })),
    );
  }

  /** Swaps the stick batches for bigger ones, with room for `capacity` sticks. The old batches are thrown away. */
  function makeRoomForSticks(capacity: number): void {
    group.remove(sticks);
    sticks.dispose();
    stickPickers.dispose();
    stickCapacity = capacity;
    sticks = new THREE.InstancedMesh(stickGeometry, stickMaterial, capacity);
    sticks.count = 0;
    sticks.frustumCulled = false;
    group.add(sticks);
    stickPickers = new THREE.InstancedMesh(stickPickGeometry, stickPickMaterial, capacity);
    stickPickers.count = 0;
  }

  function rebuildSticks(): void {
    // Double the room each time it runs out, so a few more sticks do not rebuild the batch every time.
    if (stickQuery.size > stickCapacity) makeRoomForSticks(Math.max(stickQuery.size, stickCapacity * 2));
    sticksDrawn = [];
    for (const stick of stickQuery) {
      // Each stick lies at its own steady angle, picked from its spot.
      logRotation.setFromAxisAngle(up, lookFor(stick.position.x, stick.position.z) * Math.PI * 2);
      logPosition.set(stick.position.x, stick.position.y, stick.position.z);
      matrix.compose(logPosition, logRotation, logScale);
      sticks.setMatrixAt(sticksDrawn.length, matrix);
      stickPickers.setMatrixAt(sticksDrawn.length, matrix);
      stickShade.setScalar(1 + (lookFor(stick.position.z, stick.position.x) * 2 - 1) * STICK_SHADE_SPREAD);
      sticks.setColorAt(sticksDrawn.length, stickShade);
      sticksDrawn.push(stick);
    }
    sticks.count = sticksDrawn.length;
    stickPickers.count = sticksDrawn.length;
    sticks.instanceMatrix.needsUpdate = true;
    if (sticks.instanceColor !== null) sticks.instanceColor.needsUpdate = true;
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
      if (debarkedLogsDirty) rebuildDebarkedLogs();
      if (sticksDirty) rebuildSticks();
      for (const { batch } of treeBatches) batch.cull();
      stumpsDirty = false;
      logsDirty = false;
      debarkedLogsDirty = false;
      sticksDirty = false;
      for (let i = falling.length - 1; i >= 0; i -= 1) {
        const fall = falling[i];
        if (fall === undefined) continue;
        fall.startSeconds ??= nowSeconds;
        const fallen = tiltForFall(fall.axis, nowSeconds - fall.startSeconds, spin);
        fall.pivot.quaternion.copy(spin);
        if (fallen) {
          group.remove(fall.pivot);
          falling.splice(i, 1);
        }
      }
    },
    cull(views) {
      for (const { batch } of treeBatches) batch.cull(views);
    },
    pick(raycaster) {
      hits.length = 0;
      raycaster.intersectObjects([...treePickTargets, logs, debarkedLogs, stickPickers], false, hits);
      hits.sort((a, b) => a.distance - b.distance);
      for (const hit of hits) {
        if (hit.instanceId === undefined) continue;
        if (hit.object === logs) {
          const log = logsDrawn[hit.instanceId];
          if (log?.log !== undefined) return { hit: { kind: "log", entity: log }, distance: hit.distance };
          continue;
        }
        if (hit.object === debarkedLogs) {
          const log = debarkedLogsDrawn[hit.instanceId];
          if (log?.debarkedLog !== undefined) return { hit: { kind: "debarkedLog", entity: log }, distance: hit.distance };
          continue;
        }
        if (hit.object === stickPickers) {
          const stick = sticksDrawn[hit.instanceId];
          if (stick?.stick === true) return { hit: { kind: "stick", entity: stick }, distance: hit.distance };
          continue;
        }
        const drawn = treesOfMesh.get(hit.object);
        const index = drawn?.batch.instanceHit(hit.instanceId);
        const tree = index === undefined ? undefined : drawn?.trees[index];
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
        if (hit.entity.tree !== true || index === undefined || batch === undefined || !batch.batch.matrixAt(index, matrix)) return [];
        const at = new THREE.Matrix4().multiplyMatrices(group.matrixWorld, matrix);
        return [
          { geometry: batch.trunk.geometry, matrix: at },
          { geometry: batch.crown.geometry, matrix: at },
        ];
      }
      if (hit.kind === "log") {
        const index = logsDrawn.indexOf(hit.entity);
        return index < 0 ? [] : [{ geometry: logGeometry, matrix: placed(logs, index) }];
      }
      if (hit.kind === "debarkedLog") {
        const index = debarkedLogsDrawn.indexOf(hit.entity);
        return index < 0 ? [] : [{ geometry: debarkedLogGeometry, matrix: placed(debarkedLogs, index) }];
      }
      const index = sticksDrawn.indexOf(hit.entity);
      return index < 0 ? [] : [{ geometry: stickGeometry, matrix: placed(sticks, index) }];
    },
    dispose() {
      standing.disconnect();
      stumpQuery.disconnect();
      logQuery.disconnect();
      debarkedLogQuery.disconnect();
      stickQuery.disconnect();
      for (const item of disposables) item.dispose();
      // The stick batches are swapped when they grow, so they are not in `disposables`.
      sticks.dispose();
      stickPickers.dispose();
    },
  };
}

const IDENTITY = new THREE.Matrix4();
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

/**
 * Scales the stump model so its foot is as wide as a trunk's foot, in metres.
 * The height grows with the width, up to STUMP_MAX_HEIGHT_METRES.
 */
function stumpFit(trunk: THREE.BufferGeometry, stump: StumpShape): THREE.Matrix4 {
  const position = trunk.getAttribute("position");
  let bottom = Infinity;
  for (let i = 0; i < position.count; i += 1) bottom = Math.min(bottom, position.getY(i));
  let footRadius = 0;
  for (let i = 0; i < position.count; i += 1) {
    if (position.getY(i) - bottom > TRUNK_FOOT_BAND_METRES) continue;
    footRadius = Math.max(footRadius, Math.hypot(position.getX(i), position.getZ(i)));
  }
  const across = footRadius / stump.footRadius;
  const up = Math.min(across, STUMP_MAX_HEIGHT_METRES / stump.height);
  return new THREE.Matrix4().makeScale(across, up, across);
}

/** A steady value from 0 to 1 for a spot, used to vary each tree's size and turn. It only affects drawing. */
function lookFor(x: number, z: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}
