// Draws trees, stumps, logs, and sticks with the code-built placeholder shapes approved in asset-manifest.json:
// "trees", "stumps", "logs", and "sticks". Felled trees fall with the code-built "chop-animation".
import * as THREE from "three";
import { LOGS_PER_TREE } from "../sim/chopping";
import { logEntities, playerEntities, stickEntities, stumpEntities, treeEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { createLogGeometry, LOG_COLOUR } from "./log-shape";

const TRUNK_COLOUR = 0x6b4a2b;
const CROWN_COLOUR = 0x2f5a2a;
const STUMP_TOP_COLOUR = 0xc9a46a;
const STICK_COLOUR = 0x8a6a45;

const TRUNK_HEIGHT_METRES = 3;
const TRUNK_RADIUS_METRES = 0.3;
const CROWN_HEIGHT_METRES = 6;
const CROWN_RADIUS_METRES = 1.6;
const STUMP_HEIGHT_METRES = 0.4;
/** Each tree is drawn between these sizes, so the forest does not look copy-pasted. */
const TREE_MIN_SCALE = 0.8;
const TREE_MAX_SCALE = 1.25;
/** Logs lie on the ground, so their middle sits this far above it. */
const LOG_REST_HEIGHT_METRES = 0.18;
const STICK_LENGTH_METRES = 0.7;
const STICK_RADIUS_METRES = 0.03;
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
  dispose(): void;
}

export function createForestMeshes(entities: EntityStore): ForestMeshes {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  function track<T extends { dispose(): void }>(item: T): T {
    disposables.push(item);
    return item;
  }

  // Trees: one batch for every trunk and one for every crown, so thousands of trees take two draw calls.
  const trees = [...treeEntities(entities)];
  const trunkGeometry = track(new THREE.CylinderGeometry(TRUNK_RADIUS_METRES * 0.8, TRUNK_RADIUS_METRES, TRUNK_HEIGHT_METRES, 6));
  trunkGeometry.translate(0, TRUNK_HEIGHT_METRES / 2, 0);
  const crownGeometry = track(new THREE.ConeGeometry(CROWN_RADIUS_METRES, CROWN_HEIGHT_METRES, 7));
  crownGeometry.translate(0, TRUNK_HEIGHT_METRES + CROWN_HEIGHT_METRES / 2 - 0.5, 0);
  const trunkMaterial = track(new THREE.MeshStandardMaterial({ color: TRUNK_COLOUR, flatShading: true }));
  const crownMaterial = track(new THREE.MeshStandardMaterial({ color: CROWN_COLOUR, flatShading: true }));
  const trunks = track(new THREE.InstancedMesh(trunkGeometry, trunkMaterial, trees.length));
  const crowns = track(new THREE.InstancedMesh(crownGeometry, crownMaterial, trees.length));

  const matrix = new THREE.Matrix4();
  const instanceOf = new Map<Entity, number>();
  trees.forEach((tree, index) => {
    instanceOf.set(tree, index);
    treeMatrix(tree.position, matrix);
    trunks.setMatrixAt(index, matrix);
    crowns.setMatrixAt(index, matrix);
  });
  trunks.computeBoundingSphere();
  crowns.computeBoundingSphere();
  group.add(trunks, crowns);

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
  const stickGeometry = track(new THREE.CylinderGeometry(STICK_RADIUS_METRES, STICK_RADIUS_METRES, STICK_LENGTH_METRES, 4));
  stickGeometry.rotateZ(Math.PI / 2);
  stickGeometry.translate(0, STICK_RADIUS_METRES, 0);
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
    if (index === undefined) return;
    // Hide this tree in the batch. Its falling copy takes over.
    matrix.makeScale(0, 0, 0);
    trunks.setMatrixAt(index, matrix);
    crowns.setMatrixAt(index, matrix);
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    startFall(tree.position);
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

  function startFall(at: Vec3): void {
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
    tree.add(new THREE.Mesh(trunkGeometry, trunkMaterial), new THREE.Mesh(crownGeometry, crownMaterial));
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
      raycaster.intersectObjects([trunks, crowns, logs, stickPickers], false, hits);
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
        const tree = trees[hit.instanceId];
        if (tree?.tree === true) return { hit: { kind: "tree", entity: tree }, distance: hit.distance };
      }
      return undefined;
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

/** A steady value from 0 to 1 for a spot, used to vary each tree's size and turn. It only affects drawing. */
function lookFor(x: number, z: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}
