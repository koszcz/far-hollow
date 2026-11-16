// Places trees, stumps, logs, and sticks in the valley: "trees", "stumps", "logs" (approved), and "sticks" (approved) in asset-manifest.json.
// Sticks come in the four ground shapes from stick-shape.ts, one batch per shape.
// Each asset's shape lives in its own file: tree-model.ts, stump-model.ts, log-shape.ts, and stick-shape.ts.
// Trees far from the camera draw with the "far-trees" asset (approved), built in tree-far-shape.ts.
// Felled trees fall with tree-fall.ts, part of the approved "chop-animation".
// Felled trees grow back as a sapling on the stump, then a young tree: the draft "saplings" asset, built in sapling-shape.ts.
// Debarked logs, the "debarked-log" asset (approved), are built from the log shape by debarked-log-shape.ts.
// While the player saws a debarked log into planks, it is drawn lying along the sawhorse beam. Game logic keeps it on the ground.
// To change how one asset looks, edit its shape file. Read this file only for where and how many are drawn.
import * as THREE from "three";
import { MOST_LOGS_PER_TREE, treeLookAt, treeSizeAt } from "../sim/tree-size";
import type { GroundPoint } from "../sim/valley";
import { logWorkedNow } from "../sim/crafting";
import { isYoungTree, type GrowthStage } from "../sim/tree-growth";
import {
  debarkedLogEntities,
  growingTreeEntities,
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
import { BEAM_TOP_METRES } from "./sawhorse-meshes";
import { facingRadians } from "./structure-look";
import { createFarTreeShape, FAR_TREE_METRES } from "./tree-far-shape";
import type { OutlinePart } from "./hover-outline";
import { LOG_COLOUR, LOG_CUT_COLOUR, type LogShape } from "./log-shape";
import { createSaplingShapes } from "./sapling-shape";
import { createGroundStickGeometry, GROUND_STICK_SHAPE_COUNT, STICK_COLOUR, STICK_LENGTH_METRES } from "./stick-shape";
import type { StumpShape } from "./stump-model";
import { tiltForFall } from "./tree-fall";
import type { TreeShape, TreeTone } from "./tree-model";
import { addTreeSeeThrough } from "./tree-see-through";

/** The colour of each tree part in each tone. Trees are drawn in these, whatever colours the model file holds. */
export const TREE_COLOURS: Readonly<Record<"trunk" | "crown", Readonly<Record<TreeTone, number>>>> = {
  trunk: { dark: 0x6b4a2b, light: 0x7d5634 },
  crown: { dark: 0x2f5a2a, light: 0x4a7a2e },
};
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
/** A sapling's foot sinks this far into the stump's cut face, before the tree's own size, so it does not float. */
const SAPLING_SINK_METRES = 0.03;
/** Sticks are thin, so clicks hit an invisible box this wide around each one, in metres. */
const STICK_PICK_WIDTH_METRES = 0.35;
/** Each stick's bark is up to this share lighter or darker than the others, so the floor does not look copy-pasted. */
const STICK_SHADE_SPREAD = 0.08;

/** What a click on the forest landed on. */
export type ForestHit =
  { kind: "tree"; entity: Entity } | { kind: "log"; entity: Entity } | { kind: "debarkedLog"; entity: Entity } | { kind: "stick"; entity: Entity };

export interface ForestMeshes {
  readonly group: THREE.Group;
  /** Brings stumps, growing trees, logs, and falling trees up to date. `nowSeconds` is a steady real-time clock. */
  update(nowSeconds: number): void;
  /** Fades the trees between the camera and the player drawn at `player`. Pass null to fade none. */
  seeThroughTo(player: Readonly<Vec3> | null): void;
  /** Draws only the standing and growing trees each camera can see. Call it once the cameras have moved for this frame. */
  cull(views: CullViews): void;
  /**
   * What a ray from the camera hits first among standing trees, young trees, logs, debarked logs, and sticks, and how far away.
   * A young tree counts as a tree.
   * The ray passes through trees faded to show the player, so the player can reach what they can see behind them.
   */
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
  // Beyond FAR_TREE_METRES from the camera, a second batch per type draws each tree with its cheap far shape instead.
  // Shadows always come from the real shape.
  // Every tree spot gets a place in its type's batches: standing trees, and felled trees that grow back there.
  const trees = [...new Set([...treeEntities(entities), ...stumpEntities(entities), ...growingTreeEntities(entities)])];
  const trunkMaterials: Record<TreeTone, THREE.MeshStandardMaterial> = {
    dark: track(
      new THREE.MeshStandardMaterial({
        color: TREE_COLOURS.trunk.dark,
        flatShading: true,
      }),
    ),
    light: track(
      new THREE.MeshStandardMaterial({
        color: TREE_COLOURS.trunk.light,
        flatShading: true,
      }),
    ),
  };
  const crownMaterials: Record<TreeTone, THREE.MeshStandardMaterial> = {
    dark: track(
      new THREE.MeshStandardMaterial({
        color: TREE_COLOURS.crown.dark,
        flatShading: true,
      }),
    ),
    light: track(
      new THREE.MeshStandardMaterial({
        color: TREE_COLOURS.crown.light,
        flatShading: true,
      }),
    ),
  };
  const seeThrough = addTreeSeeThrough([...Object.values(trunkMaterials), ...Object.values(crownMaterials)]);
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
    const trunk = {
      geometry: shape.trunk,
      material: trunkMaterials[shape.trunkTone],
    };
    const crown = {
      geometry: shape.crown,
      material: crownMaterials[shape.crownTone],
    };
    const farShape = createFarTreeShape(shape);
    track(farShape.trunk);
    track(farShape.crown);
    const near = track(
      createCulledBatch([trunk, crown], ofType.length, true, {
        to: FAR_TREE_METRES,
      }),
    );
    const far = track(
      createCulledBatch(
        [
          { geometry: farShape.trunk, material: trunk.material },
          { geometry: farShape.crown, material: crown.material },
        ],
        ofType.length,
        false,
        { from: FAR_TREE_METRES },
      ),
    );
    const batches = [near, far];
    // A growing tree draws as a sapling on its stump, then as a young tree, near and far like a full tree.
    const growing = createSaplingShapes(shape);
    track(growing.sapling.trunk);
    track(growing.sapling.crown);
    track(growing.youngTree.trunk);
    track(growing.youngTree.crown);
    const youngFarShape = createFarTreeShape(growing.youngTree);
    track(youngFarShape.trunk);
    track(youngFarShape.crown);
    const young = {
      trunk: { geometry: growing.youngTree.trunk, material: trunk.material },
      crown: { geometry: growing.youngTree.crown, material: crown.material },
    };
    const youngNear = track(createCulledBatch([young.trunk, young.crown], ofType.length, true, { to: FAR_TREE_METRES }));
    const youngFar = track(
      createCulledBatch(
        [
          { geometry: youngFarShape.trunk, material: trunk.material },
          { geometry: youngFarShape.crown, material: crown.material },
        ],
        ofType.length,
        false,
        { from: FAR_TREE_METRES },
      ),
    );
    // Saplings are too small to see far away, or to cast much of a shadow.
    const saplings = track(
      createCulledBatch(
        [
          { geometry: growing.sapling.trunk, material: trunk.material },
          { geometry: growing.sapling.crown, material: crown.material },
        ],
        ofType.length,
        false,
        { to: FAR_TREE_METRES },
      ),
    );
    const stageBatches: Readonly<Record<Exclude<GrowthStage, "stump">, readonly CulledBatch[]>> = { sapling: [saplings], youngTree: [youngNear, youngFar] };
    ofType.forEach((tree, index) => {
      instanceOf.set(tree, index);
      if (tree.tree !== true) return;
      treeMatrix(tree.position, matrix);
      for (const batch of batches) batch.set(index, matrix);
    });
    for (const batch of [...batches, youngNear, youngFar]) {
      for (const mesh of batch.viewMeshes) treesOfMesh.set(mesh, { batch, trees: ofType });
    }
    for (const batch of [...batches, youngNear, youngFar, saplings]) {
      batch.cull();
      group.add(...batch.meshes);
    }
    return { near, batches, trunk, crown, youngNear, youngFar, young, stageBatches, growingBatches: [youngNear, youngFar, saplings] };
  });
  const allTreeBatches = treeBatches.flatMap(({ batches, growingBatches }) => [...batches, ...growingBatches]);
  const treePickTargets = treeBatches.flatMap(({ batches, youngNear, youngFar }) => [...batches, youngNear, youngFar].flatMap((batch) => batch.viewMeshes));

  // Stumps: one batch per bark tone. A tree's stump keeps the tree's size and turn, and its foot is as wide as the trunk's.
  const stumpGeometry = track(stumpShape.geometry);
  const cutMaterial = track(
    new THREE.MeshStandardMaterial({
      color: STUMP_TOP_COLOUR,
      flatShading: true,
    }),
  );
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

  // Growing trees: each shows in its type's batch for its stage. A sapling stands on its stump's cut face.
  const stumpTops = stumpFits.map((fit) => new THREE.Vector3().setFromMatrixScale(fit).y * stumpShape.height);
  const growingQuery = growingTreeEntities(entities).connect();
  /** The stage each growing tree is drawn at now, so a tree is placed again only when its stage changes. */
  const drawnStages = new Map<Entity, GrowthStage>();
  const saplingLift = new THREE.Matrix4();
  /** Shows a growing tree in the batches for `stage`, and hides it from the others. Without a stage, it hides it from all. */
  function drawStage(tree: Entity & { position: Vec3 }, stage: GrowthStage | undefined): void {
    const index = instanceOf.get(tree);
    const type = typeOf.get(tree);
    const batch = type === undefined ? undefined : treeBatches[type];
    if (index === undefined || type === undefined || batch === undefined) return;
    treeMatrix(tree.position, matrix);
    if (stage === "sapling" && tree.stump === true) matrix.multiply(saplingLift.makeTranslation(0, (stumpTops[type] ?? 0) - SAPLING_SINK_METRES, 0));
    for (const [shownAt, batches] of Object.entries(batch.stageBatches)) {
      for (const shapeBatch of batches) shapeBatch.set(index, shownAt === stage ? matrix : undefined);
    }
  }
  function updateGrowing(): void {
    for (const tree of growingQuery) {
      if (drawnStages.get(tree) === tree.growth.stage) continue;
      drawnStages.set(tree, tree.growth.stage);
      drawStage(tree, tree.growth.stage);
    }
  }
  // A tree stops growing when it is full grown, or when a foundation goes over its stump.
  growingQuery.onEntityRemoved.subscribe((tree) => {
    drawnStages.delete(tree);
    drawStage(tree, undefined);
  });

  // Logs on the ground: one batch, with room for every log the valley's trees can give.
  const logGeometry = track(logShape.geometry);
  const logMaterials = [
    track(new THREE.MeshStandardMaterial({ color: LOG_COLOUR, flatShading: true })),
    track(
      new THREE.MeshStandardMaterial({
        color: LOG_CUT_COLOUR,
        flatShading: true,
      }),
    ),
  ];
  const logCapacity = Math.max(1, trees.length * MOST_LOGS_PER_TREE);
  const logs = track(new THREE.InstancedMesh(logGeometry, logMaterials, logCapacity));
  logs.count = 0;
  logs.frustumCulled = false;
  group.add(logs);
  let logsDrawn: Entity[] = [];

  // Debarked logs on the ground: the same shape as logs, painted pale, with room for every log the valley's trees can give.
  const debarkedLogGeometry = track(createDebarkedLogGeometry(logShape.geometry));
  const debarkedLogMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      vertexColors: true,
    }),
  );
  const debarkedLogs = track(new THREE.InstancedMesh(debarkedLogGeometry, debarkedLogMaterial, logCapacity));
  debarkedLogs.count = 0;
  debarkedLogs.frustumCulled = false;
  group.add(debarkedLogs);
  let debarkedLogsDrawn: Entity[] = [];

  // Sticks on the ground: one batch per stick shape, each with room for every stick the valley starts with.
  // Taking down a structure can leave more sticks than that, so the batches grow when they run out of room.
  const stickGeometries = Array.from({ length: GROUND_STICK_SHAPE_COUNT }, (_, shape) => track(createGroundStickGeometry(shape)));
  // Each shape's length along x, so its pick box is as long as the stick.
  const stickLengths = stickGeometries.map((geometry) => {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox ?? new THREE.Box3();
    return {
      length: box.max.x - box.min.x,
      middle: (box.max.x + box.min.x) / 2,
    };
  });
  // The stick geometry carries pale cut ends as vertex colours. Each stick also gets its own shade of bark.
  const stickMaterial = track(
    new THREE.MeshStandardMaterial({
      color: STICK_COLOUR,
      flatShading: true,
      vertexColors: true,
    }),
  );
  // An invisible, wider copy of each stick that clicks are tested against, because the drawn sticks are too thin to hit.
  const stickPickGeometry = track(new THREE.BoxGeometry(STICK_LENGTH_METRES, STICK_PICK_WIDTH_METRES, STICK_PICK_WIDTH_METRES));
  const stickPickMaterial = track(new THREE.MeshBasicMaterial());
  let stickCapacity = 0;
  let sticks = stickGeometries.map((geometry) => new THREE.InstancedMesh(geometry, stickMaterial, 1));
  let stickPickers = new THREE.InstancedMesh(stickPickGeometry, stickPickMaterial, 1);
  makeRoomForSticks(Math.max(1, stickEntities(entities).size));
  let sticksDrawn: Entity[] = [];
  /** Where each drawn stick sits: its shape's batch and its place in that batch. In the same order as `sticksDrawn`. */
  let stickSlots: { shape: number; slot: number }[] = [];
  const stickShade = new THREE.Color();
  const pickMatrix = new THREE.Matrix4();
  const pickOffset = new THREE.Matrix4();

  // Falling trees: a few short-lived meshes that share the tree shapes.
  /** `axis` is what the pivot turns about to tip the tree's top the way it falls. */
  const falling: {
    pivot: THREE.Group;
    axis: THREE.Vector3;
    startSeconds: number | undefined;
  }[] = [];
  const players = playerEntities(entities);

  const standing = treeEntities(entities).connect();
  standing.onEntityRemoved.subscribe((tree) => {
    const index = instanceOf.get(tree);
    const type = typeOf.get(tree);
    const batch = type === undefined ? undefined : treeBatches[type];
    if (index === undefined || type === undefined || batch === undefined) return;
    // Hide this tree in its batch. Its falling copy takes over.
    for (const shapeBatch of batch.batches) shapeBatch.set(index, undefined);
    startFall(tree.position, type, tree.fellHeading);
  });
  // A tree that stands again, such as in the asset showcase's looping chop, shows again in its batch.
  standing.onEntityAdded.subscribe((tree) => {
    const index = instanceOf.get(tree);
    const type = typeOf.get(tree);
    const batch = type === undefined ? undefined : treeBatches[type];
    if (index === undefined || batch === undefined) return;
    treeMatrix(tree.position, matrix);
    for (const shapeBatch of batch.batches) shapeBatch.set(index, matrix);
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

  /** Starts a tree falling toward `heading`, as the simulation chose it. Without one, as in the asset showcase, the tree falls away from the player. */
  function startFall(at: Vec3, type: number, heading: number | undefined): void {
    const player = players.first;
    const awayX = heading !== undefined ? Math.sin(heading) : player ? at.x - player.position.x : 1;
    const awayZ = heading !== undefined ? Math.cos(heading) : player ? at.z - player.position.z : 0;
    const length = Math.hypot(awayX, awayZ) || 1;
    const pivot = new THREE.Group();
    pivot.position.set(at.x, at.y, at.z);
    const axis = new THREE.Vector3(awayZ / length, 0, -awayX / length);
    const tree = new THREE.Group();
    treeMatrix({ x: 0, y: 0, z: 0, sizeAt: at }, matrix);
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

  /** The log the player works on at a work station, as drawn last: lying along the station's beam. */
  let worked: { log: Entity; station: Entity } | undefined;
  /** Where a log lying at `position`, turned `heading`, is drawn: on the sawhorse beam while the player works on it. */
  function lyingSpot(entity: Entity, heading: number, position: Vec3): { entity: Entity; heading: number; position: Vec3 } {
    const station = worked?.log === entity ? worked.station : undefined;
    if (station?.position === undefined) return { entity, heading, position };
    // The beam runs along x when the station faces the default way. The log's length runs along z before it is turned.
    const beamHeading = facingRadians(station.facing?.turns ?? 0) + Math.PI / 2;
    return { entity, heading: beamHeading, position: { ...station.position, y: station.position.y + BEAM_TOP_METRES } };
  }

  /** Notes which log the player works on now. A change redraws the logs, so it moves onto the beam or back to the ground. */
  function updateWorkedLog(): void {
    const player = players.first;
    const now = player === undefined ? undefined : logWorkedNow(entities, player);
    if (now?.log === worked?.log && now?.station === worked?.station) return;
    worked = now;
    logsDirty = true;
    debarkedLogsDirty = true;
  }

  function rebuildLogs(): void {
    logsDrawn = rebuildLogBatch(
      logs,
      [...logQuery].map((log) => lyingSpot(log, log.log.heading, log.position)),
    );
  }

  function rebuildDebarkedLogs(): void {
    debarkedLogsDrawn = rebuildLogBatch(
      debarkedLogs,
      [...debarkedLogQuery].map((log) => lyingSpot(log, log.debarkedLog.heading, log.position)),
    );
  }

  /** Swaps the stick batches for bigger ones, with room for `capacity` sticks. The old batches are thrown away. */
  function makeRoomForSticks(capacity: number): void {
    for (const batch of sticks) {
      group.remove(batch);
      batch.dispose();
    }
    stickPickers.dispose();
    stickCapacity = capacity;
    sticks = stickGeometries.map((geometry) => {
      const batch = new THREE.InstancedMesh(geometry, stickMaterial, capacity);
      batch.count = 0;
      batch.frustumCulled = false;
      group.add(batch);
      return batch;
    });
    stickPickers = new THREE.InstancedMesh(stickPickGeometry, stickPickMaterial, capacity);
    stickPickers.count = 0;
  }

  function rebuildSticks(): void {
    // Double the room each time it runs out, so a few more sticks do not rebuild the batch every time.
    if (stickQuery.size > stickCapacity) makeRoomForSticks(Math.max(stickQuery.size, stickCapacity * 2));
    sticksDrawn = [];
    stickSlots = [];
    for (const batch of sticks) batch.count = 0;
    for (const stick of stickQuery) {
      // Each stick lies at its own steady angle, picked from its spot.
      logRotation.setFromAxisAngle(up, lookFor(stick.position.x, stick.position.z) * Math.PI * 2);
      logPosition.set(stick.position.x, stick.position.y, stick.position.z);
      matrix.compose(logPosition, logRotation, logScale);
      // Each stick's shape is picked from its spot too, so neighbouring sticks rarely match.
      const shape = Math.min(GROUND_STICK_SHAPE_COUNT - 1, Math.floor(lookFor(stick.position.x + 0.5, stick.position.z - 0.5) * GROUND_STICK_SHAPE_COUNT));
      const batch = sticks[shape];
      const size = stickLengths[shape];
      if (batch === undefined || size === undefined) continue;
      const slot = batch.count;
      batch.count += 1;
      batch.setMatrixAt(slot, matrix);
      // The pick box is stretched and moved along the stick to cover this shape.
      pickOffset.makeTranslation(size.middle, 0, 0).scale(new THREE.Vector3(size.length / STICK_LENGTH_METRES, 1, 1));
      pickMatrix.multiplyMatrices(matrix, pickOffset);
      stickPickers.setMatrixAt(sticksDrawn.length, pickMatrix);
      stickShade.setScalar(1 + (lookFor(stick.position.z, stick.position.x) * 2 - 1) * STICK_SHADE_SPREAD);
      batch.setColorAt(slot, stickShade);
      sticksDrawn.push(stick);
      stickSlots.push({ shape, slot });
    }
    stickPickers.count = sticksDrawn.length;
    for (const batch of sticks) {
      batch.instanceMatrix.needsUpdate = true;
      if (batch.instanceColor !== null) batch.instanceColor.needsUpdate = true;
    }
    stickPickers.instanceMatrix.needsUpdate = true;
    // Clicks test this sphere first, so it must cover the sticks as they lie now.
    stickPickers.computeBoundingSphere();
  }

  const spin = new THREE.Quaternion();
  const hits: THREE.Intersection[] = [];

  return {
    group,
    seeThroughTo(player) {
      seeThrough.setPlayer(player);
    },
    update(nowSeconds) {
      updateWorkedLog();
      updateGrowing();
      if (stumpsDirty) rebuildStumps();
      if (logsDirty) rebuildLogs();
      if (debarkedLogsDirty) rebuildDebarkedLogs();
      if (sticksDirty) rebuildSticks();
      for (const batch of allTreeBatches) batch.cull();
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
      for (const batch of allTreeBatches) batch.cull(views);
    },
    pick(raycaster) {
      hits.length = 0;
      raycaster.intersectObjects([...treePickTargets, logs, debarkedLogs, stickPickers], false, hits);
      hits.sort((a, b) => a.distance - b.distance);
      for (const hit of hits) {
        if (hit.instanceId === undefined) continue;
        if (hit.object === logs) {
          const log = logsDrawn[hit.instanceId];
          if (log?.log !== undefined)
            return {
              hit: { kind: "log", entity: log },
              distance: hit.distance,
            };
          continue;
        }
        if (hit.object === debarkedLogs) {
          const log = debarkedLogsDrawn[hit.instanceId];
          if (log?.debarkedLog !== undefined)
            return {
              hit: { kind: "debarkedLog", entity: log },
              distance: hit.distance,
            };
          continue;
        }
        if (hit.object === stickPickers) {
          const stick = sticksDrawn[hit.instanceId];
          if (stick?.stick === true)
            return {
              hit: { kind: "stick", entity: stick },
              distance: hit.distance,
            };
          continue;
        }
        const drawn = treesOfMesh.get(hit.object);
        const index = drawn?.batch.instanceHit(hit.instanceId);
        const tree = index === undefined ? undefined : drawn?.trees[index];
        if (tree === undefined || (tree.tree !== true && !isYoungTree(tree.growth)) || seeThrough.clicksPassThrough(tree.position, raycaster.ray.origin))
          continue;
        return { hit: { kind: "tree", entity: tree }, distance: hit.distance };
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
        if (index === undefined || batch === undefined) return [];
        // A young tree is outlined in its own, smaller shape.
        const young = isYoungTree(hit.entity.growth);
        if (young ? !batch.youngNear.matrixAt(index, matrix) : hit.entity.tree !== true || !batch.near.matrixAt(index, matrix)) return [];
        const at = new THREE.Matrix4().multiplyMatrices(group.matrixWorld, matrix);
        const shape = young ? batch.young : batch;
        return [
          { geometry: shape.trunk.geometry, matrix: at },
          { geometry: shape.crown.geometry, matrix: at },
        ];
      }
      if (hit.kind === "log") {
        const index = logsDrawn.indexOf(hit.entity);
        return index < 0 ? [] : [{ geometry: logGeometry, matrix: placed(logs, index) }];
      }
      if (hit.kind === "debarkedLog") {
        const index = debarkedLogsDrawn.indexOf(hit.entity);
        return index < 0
          ? []
          : [
              {
                geometry: debarkedLogGeometry,
                matrix: placed(debarkedLogs, index),
              },
            ];
      }
      const where = stickSlots[sticksDrawn.indexOf(hit.entity)];
      const batch = where === undefined ? undefined : sticks[where.shape];
      return where === undefined || batch === undefined ? [] : [{ geometry: batch.geometry, matrix: placed(batch, where.slot) }];
    },
    dispose() {
      standing.disconnect();
      stumpQuery.disconnect();
      growingQuery.disconnect();
      logQuery.disconnect();
      debarkedLogQuery.disconnect();
      stickQuery.disconnect();
      for (const item of disposables) item.dispose();
      // The stick batches are swapped when they grow, so they are not in `disposables`.
      for (const batch of sticks) batch.dispose();
      stickPickers.dispose();
    },
  };
}

const IDENTITY = new THREE.Matrix4();
const treeRotation = new THREE.Quaternion();
const treeScale = new THREE.Vector3();
const treePosition = new THREE.Vector3();
const upAxis = new THREE.Vector3(0, 1, 0);

/** The size and turn a tree is drawn with at a spot. The size comes from the simulation, since it sets how many logs the tree gives. `sizeAt` overrides the spot the size and turn come from. */
function treeMatrix(at: Vec3 & { sizeAt?: GroundPoint }, out: THREE.Matrix4): THREE.Matrix4 {
  const from = at.sizeAt ?? at;
  treeRotation.setFromAxisAngle(upAxis, treeLookAt(from.x, from.z) * Math.PI * 2);
  treeScale.setScalar(treeSizeAt(from.x, from.z));
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

/** A steady value from 0 to 1 for a spot, used to vary sticks and pick tree types. It only affects drawing. */
function lookFor(x: number, z: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}
