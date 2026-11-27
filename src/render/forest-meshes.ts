// Places trees, stumps, logs, and sticks in the valley: "trees", "stumps", "logs" (approved), and "sticks" (approved) in asset-manifest.json.
// This file ties the parts together and owns stumps, growing trees, and falling trees. The rest has its own file:
// tree-batches.ts (the batches of trees), log-meshes.ts (logs and debarked logs), stick-meshes.ts (sticks), and tree-placement.ts (where a tree is drawn).
// Each asset's shape lives in its own file: tree-model.ts, stump-model.ts, log-shape.ts, and stick-shape.ts.
// Trees far from the camera draw with the "far-trees" asset (approved), built in tree-far-shape.ts.
// Felled trees fall with tree-fall.ts, part of the approved "chop-animation".
// Felled trees grow back as a sapling on the stump, then a young tree: the approved "saplings" asset, built in sapling-shape.ts.
// Treetops, young trees, and saplings sway in the wind with wind-sway.ts. Trunks, stumps, logs, and sticks stay still.
// To change how one asset looks, edit its shape file. Read this file only for where and how many are drawn.
import * as THREE from "three";
import { isSapling, isYoungTree, type GrowthStage } from "../sim/tree-growth";
import { type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { growingTreeEntities, playerEntities, stumpEntities, treeEntities } from "../sim/entity-queries";
import { crownColour } from "./autumn-leaves";
import type { CullViews } from "./culled-batch";
import type { OutlinePart } from "./hover-outline";
import type { LogShape } from "./log-shape";
import { createLogMeshes } from "./log-meshes";
import type { SaplingModels } from "./sapling-shape";
import { createStickMeshes } from "./stick-meshes";
import type { StumpShape } from "./stump-model";
import { createTreeBatches, PLANTED_ROOM_PER_TYPE, type ForestTree } from "./tree-batches";
import { tiltForFall } from "./tree-fall";
import { standingKindOf, stumpFit, treeMatrix, treeTypeFor } from "./tree-placement";
import type { TreeShape, TreeTone } from "./tree-model";
import type { SnowCoverLook } from "./snow-cover-look";
import type { WindSway } from "./wind-sway";
import { BLUEPRINT_COLOUR, BLUEPRINT_OPACITY, NOT_ALLOWED_COLOUR, seeThrough as seeThroughMaterial } from "./structure-look";

const STUMP_TOP_COLOUR = 0xc9a46a;
/** A sapling's foot sinks this far into the stump's cut face, before the tree's own size, so it does not float. */
const SAPLING_SINK_METRES = 0.03;

/** What a click on the forest landed on. */
export interface ForestHit {
  readonly kind: "tree" | "youngTree" | "sapling" | "stump" | "log" | "debarkedLog" | "stick";
  readonly entity: Entity;
}

export interface ForestMeshes {
  readonly group: THREE.Group;
  /** Brings stumps, growing trees, logs, and falling trees up to date. `nowSeconds` is a steady real-time clock. */
  update(nowSeconds: number): void;
  /** Fades the trees between the camera and the player drawn at `player`. Pass null to fade none. */
  seeThroughTo(player: Readonly<Vec3> | null): void;
  /** Draws the broadleaf crowns, near and far, `share` of the way from summer green (0) to each type's autumn colour (1). Pines keep their green. */
  setLeafTurn(share: number): void;
  /** Draws only the standing and growing trees each camera can see. Call it once the cameras have moved for this frame. */
  cull(views: CullViews): void;
  /**
   * What a ray from the camera hits first among standing trees, young trees, saplings, stumps, logs, debarked logs, and sticks,
   * and how far away. A hit on the stump a sapling grows from counts as the sapling.
   * The ray passes through trees faded to show the player, so the player can reach what they can see behind them.
   */
  pick(raycaster: THREE.Raycaster): { hit: ForestHit; distance: number } | undefined;
  /** The shapes that draw a tree, young tree, sapling, stump, log, or stick, placed in the world. Empty once it is gone. */
  outlineOf(hit: ForestHit): OutlinePart[];
  /**
   * Shows a see-through sapling where the player would plant one, in the type and size a tree at that spot has.
   * It is red where planting is not allowed. Undefined hides it.
   */
  showPlantingSapling(planting: { readonly spot: Vec3; readonly allowed: boolean } | undefined): void;
  dispose(): void;
}

/** The loaded shapes the forest draws. */
export interface ForestShapes {
  /** Every tree type, from loadTreeShapes. */
  readonly trees: readonly TreeShape[];
  readonly saplings: SaplingModels;
  readonly stump: StumpShape;
  readonly log: LogShape;
}

/** `windSway` sways the treetops, young trees, and saplings. `snow`, if given, lays snow on the tops of their crowns, near and far. */
export function createForestMeshes(entities: EntityStore, shapes: ForestShapes, windSway: WindSway, snow?: SnowCoverLook): ForestMeshes {
  const { trees: treeShapes, stump: stumpShape, log: logShape } = shapes;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  function track<T extends { dispose(): void }>(item: T): T {
    disposables.push(item);
    return item;
  }

  // Trees: see tree-batches.ts.
  const {
    trees,
    typeOf,
    instanceOf,
    treesOfType,
    treesOfMesh,
    types: treeBatches,
    trunkMaterials,
    allMaterials,
    seeThrough,
    allTreeBatches,
    treePickTargets,
  } = createTreeBatches(entities, shapes, windSway, snow, group, track);
  const matrix = new THREE.Matrix4();

  // Stumps: one batch per bark tone. A tree's stump keeps the tree's size and turn, and its foot is as wide as the trunk's.
  const stumpGeometry = track(stumpShape.geometry);
  const cutMaterial = track(
    new THREE.MeshStandardMaterial({
      color: STUMP_TOP_COLOUR,
      flatShading: true,
    }),
  );
  const stumpFits = treeShapes.map((shape) => stumpFit(shape.trunk, stumpShape));
  // Either tone's batch has room for every tree, planted ones included, as a stump.
  const stumpCapacity = Math.max(1, trees.length + PLANTED_ROOM_PER_TYPE * treeShapes.length);
  const stumpBatches: Record<TreeTone, THREE.InstancedMesh> = {
    dark: track(new THREE.InstancedMesh(stumpGeometry, [trunkMaterials.dark, cutMaterial], stumpCapacity)),
    light: track(new THREE.InstancedMesh(stumpGeometry, [trunkMaterials.light, cutMaterial], stumpCapacity)),
  };
  /** The stump drawn at each instance of each tone's batch, so a click on one finds its entity. */
  const stumpsDrawn: Record<TreeTone, Entity[]> = { dark: [], light: [] };
  /** Where a stump is drawn, before the group's own placement. */
  function stumpMatrix(stump: Entity & { position: Vec3 }, out: THREE.Matrix4): THREE.Matrix4 {
    treeMatrix(stump.position, out);
    return out.multiply(stumpFits[typeOf.get(stump) ?? 0] ?? IDENTITY);
  }
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
  /**
   * Gives a sapling the player planted a place in its type's batches. The type comes from its spot, as for the valley's own trees.
   * It takes the place of a tree whose entity is gone, or else a free place. Without room, it is not drawn.
   */
  function placePlanted(tree: ForestTree): void {
    const type = treeTypeFor(tree.position.x, tree.position.z, treeShapes);
    const ofType = treesOfType[type];
    const batch = treeBatches[type];
    if (ofType === undefined || batch === undefined) return;
    let index = ofType.findIndex((other) => entities.id(other) === undefined);
    if (index === -1 && ofType.length < batch.capacity) index = ofType.length;
    if (index === -1) return;
    const old = ofType[index];
    if (old !== undefined) {
      instanceOf.delete(old);
      typeOf.delete(old);
    }
    ofType[index] = tree;
    instanceOf.set(tree, index);
    typeOf.set(tree, type);
  }
  // The see-through sapling that shows where the player would plant one. It takes the sapling shape of the type at its spot.
  const plantingAllowed = track(seeThroughMaterial(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY));
  const plantingRefused = track(seeThroughMaterial(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY));
  const plantingTrunk = new THREE.Mesh(undefined, plantingAllowed);
  const plantingCrown = new THREE.Mesh(undefined, plantingAllowed);
  const plantingSapling = new THREE.Group();
  plantingSapling.add(plantingTrunk, plantingCrown);
  plantingSapling.visible = false;
  plantingSapling.matrixAutoUpdate = false;
  group.add(plantingSapling);
  function showPlantingSapling(planting: { readonly spot: Vec3; readonly allowed: boolean } | undefined): void {
    const batch = planting === undefined ? undefined : treeBatches[treeTypeFor(planting.spot.x, planting.spot.z, treeShapes)];
    plantingSapling.visible = planting !== undefined && batch !== undefined;
    if (planting === undefined || batch === undefined) return;
    plantingTrunk.geometry = batch.sapling.trunk;
    plantingCrown.geometry = batch.sapling.crown;
    const material = planting.allowed ? plantingAllowed : plantingRefused;
    plantingTrunk.material = material;
    plantingCrown.material = material;
    treeMatrix(planting.spot, plantingSapling.matrix);
    plantingSapling.matrixWorldNeedsUpdate = true;
  }
  growingQuery.onEntityAdded.subscribe((tree) => {
    if (!instanceOf.has(tree)) placePlanted(tree);
  });
  // A tree stops growing when it is full grown, or when a foundation goes over its stump.
  growingQuery.onEntityRemoved.subscribe((tree) => {
    drawnStages.delete(tree);
    drawStage(tree, undefined);
  });

  // Falling trees: a few short-lived meshes that share the tree shapes.
  /** `axis` is what the pivot turns about to tip the tree's top the way it falls. */
  const falling: {
    pivot: THREE.Group;
    axis: THREE.Vector3;
    startSeconds: number | undefined;
  }[] = [];
  const players = playerEntities(entities);

  // Logs, debarked logs, and sticks on the ground: see log-meshes.ts and stick-meshes.ts.
  const logMeshes = createLogMeshes(entities, group, track, logShape, trees.length, players);
  const stickMeshes = createStickMeshes(entities, group, track);

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
  let stumpsDirty = true;
  const markStumps = () => {
    stumpsDirty = true;
  };
  stumpQuery.onEntityAdded.subscribe(markStumps);
  stumpQuery.onEntityRemoved.subscribe(markStumps);

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
    stumpsDrawn.dark = [];
    stumpsDrawn.light = [];
    for (const stump of stumpQuery) {
      // A stump is the felled tree's entity, so it keeps the tree's type.
      const type = typeOf.get(stump) ?? 0;
      const tone = treeShapes[type]?.trunkTone ?? "dark";
      const stumps = stumpBatches[tone];
      if (counts[tone] >= stumps.instanceMatrix.count) continue;
      stumps.setMatrixAt(counts[tone], stumpMatrix(stump, matrix));
      stumpsDrawn[tone].push(stump);
      counts[tone] += 1;
    }
    for (const tone of ["dark", "light"] as const) {
      stumpBatches[tone].count = counts[tone];
      stumpBatches[tone].instanceMatrix.needsUpdate = true;
      // Clicks test this sphere first, so it must cover the stumps as they stand now.
      stumpBatches[tone].computeBoundingSphere();
    }
  }

  const spin = new THREE.Quaternion();
  const hits: THREE.Intersection[] = [];

  return {
    group,
    seeThroughTo(player) {
      seeThrough.setPlayer(player);
    },
    setLeafTurn(share) {
      for (const { broadleafCrown } of allMaterials) {
        for (const { shape, material } of broadleafCrown.values()) crownColour(shape, share, material.color);
      }
    },
    update(nowSeconds) {
      logMeshes.update();
      updateGrowing();
      if (stumpsDirty) rebuildStumps();
      stickMeshes.update();
      for (const batch of allTreeBatches) batch.cull();
      stumpsDirty = false;
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
      raycaster.intersectObjects(
        [...treePickTargets, stumpBatches.dark, stumpBatches.light, logMeshes.logs, logMeshes.debarkedLogs, stickMeshes.pickers()],
        false,
        hits,
      );
      hits.sort((a, b) => a.distance - b.distance);
      for (const hit of hits) {
        if (hit.instanceId === undefined) continue;
        if (hit.object === logMeshes.logs) {
          const log = logMeshes.logAt(hit.instanceId);
          if (log?.log !== undefined)
            return {
              hit: { kind: "log", entity: log },
              distance: hit.distance,
            };
          continue;
        }
        if (hit.object === logMeshes.debarkedLogs) {
          const log = logMeshes.debarkedLogAt(hit.instanceId);
          if (log?.debarkedLog !== undefined)
            return {
              hit: { kind: "debarkedLog", entity: log },
              distance: hit.distance,
            };
          continue;
        }
        if (hit.object === stickMeshes.pickers()) {
          const stick = stickMeshes.stickAt(hit.instanceId);
          if (stick?.stick === true)
            return {
              hit: { kind: "stick", entity: stick },
              distance: hit.distance,
            };
          continue;
        }
        if (hit.object === stumpBatches.dark || hit.object === stumpBatches.light) {
          const stump = stumpsDrawn[hit.object === stumpBatches.dark ? "dark" : "light"][hit.instanceId];
          if (stump?.stump === true) return { hit: { kind: isSapling(stump.growth) ? "sapling" : "stump", entity: stump }, distance: hit.distance };
          continue;
        }
        const drawn = treesOfMesh.get(hit.object);
        const index = drawn?.batch.instanceHit(hit.instanceId);
        const tree = index === undefined ? undefined : drawn?.trees[index];
        const kind = tree === undefined ? undefined : standingKindOf(tree);
        if (tree === undefined || kind === undefined || seeThrough.clicksPassThrough(tree.position, raycaster.ray.origin)) continue;
        return { hit: { kind, entity: tree }, distance: hit.distance };
      }
      return undefined;
    },
    showPlantingSapling,
    outlineOf(hit) {
      group.updateMatrixWorld();
      if (hit.kind === "stump" || hit.kind === "sapling") {
        const index = instanceOf.get(hit.entity);
        const type = typeOf.get(hit.entity);
        const batch = type === undefined ? undefined : treeBatches[type];
        const { position } = hit.entity;
        if (position === undefined) return [];
        const parts: OutlinePart[] = [];
        if (hit.entity.stump === true) {
          const stumpAt = new THREE.Matrix4().multiplyMatrices(group.matrixWorld, stumpMatrix({ ...hit.entity, position }, matrix));
          parts.push({ geometry: stumpGeometry, matrix: stumpAt });
        }
        if (hit.kind === "sapling" && index !== undefined && batch !== undefined && batch.saplings.matrixAt(index, matrix)) {
          const at = new THREE.Matrix4().multiplyMatrices(group.matrixWorld, matrix);
          parts.push({ geometry: batch.sapling.trunk, matrix: at }, { geometry: batch.sapling.crown, matrix: at });
        }
        return parts;
      }
      if (hit.kind === "tree" || hit.kind === "youngTree") {
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
      if (hit.kind === "log") return logMeshes.outlineLog(hit.entity);
      if (hit.kind === "debarkedLog") return logMeshes.outlineDebarkedLog(hit.entity);
      return stickMeshes.outlineOf(hit.entity);
    },
    dispose() {
      standing.disconnect();
      stumpQuery.disconnect();
      growingQuery.disconnect();
      logMeshes.dispose();
      stickMeshes.dispose();
      for (const item of disposables) item.dispose();
    },
  };
}

const IDENTITY = new THREE.Matrix4();
