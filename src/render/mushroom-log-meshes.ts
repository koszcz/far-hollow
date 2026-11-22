// Draws mushroom logs: "mushroom-log" (draft) in asset-manifest.json.
// A mushroom log is the "logs" model lying on the ground with two small "mushrooms" patches on top of it.
// It shows bare, as a plain log, while its mushrooms grow back.
// There are only ever a few mushroom logs, the ones the player planted, so each is its own meshes rather than a batch.
import * as THREE from "three";
import { mushroomLogEntities, type Entity, type EntityStore } from "../sim/entities";
import type { OutlinePart } from "./hover-outline";
import { LOG_COLOUR, LOG_CUT_COLOUR, type LogShape } from "./log-shape";
import type { MushroomsShape } from "./mushrooms-model";

/** Where each mushroom patch sits along the log from its middle, in metres, and how big it is drawn. */
const PATCHES = [
  { along: -0.22, across: 0.04, scale: 0.75, turn: 0.3 },
  { along: 0.2, across: -0.05, scale: 0.6, turn: 2.1 },
] as const;
/** The patches sink this far into the bark, in metres, so their feet do not float over its curve. */
const PATCH_SINK_METRES = 0.03;

/** What a click on a mushroom log landed on. */
export interface MushroomLogHit {
  kind: "mushroomLog";
  entity: Entity;
}

export interface MushroomLogMeshes {
  readonly group: THREE.Group;
  /** Brings every mushroom log up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among mushroom logs, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: MushroomLogHit; distance: number } | undefined;
  /** The shapes that draw a mushroom log, placed in the world. Empty when it is not drawn. */
  outlineOf(entity: Entity): OutlinePart[];
  dispose(): void;
}

/** logShape and mushroomsShape are the loaded log and mushroom patch. Their geometry is shared, so this never disposes of it. */
export function createMushroomLogMeshes(entities: EntityStore, logShape: LogShape, mushroomsShape: MushroomsShape): MushroomLogMeshes {
  const group = new THREE.Group();
  const logMaterials = [
    new THREE.MeshStandardMaterial({ color: LOG_COLOUR, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: LOG_CUT_COLOUR, flatShading: true }),
  ];
  const mushroomMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
  const query = mushroomLogEntities(entities).connect();
  const regrowing = entities.with("mushroomLog", "regrowing").connect();
  /** Each drawn mushroom log, with the meshes that draw it. */
  const drawn = new Map<Entity, THREE.Group>();
  let dirty = true;
  const markDirty = () => {
    dirty = true;
  };
  for (const watched of [query, regrowing]) {
    watched.onEntityAdded.subscribe(markDirty);
    watched.onEntityRemoved.subscribe(markDirty);
  }

  function build(entity: Entity & { position: THREE.Vector3Like; mushroomLog: { heading: number } }): THREE.Group {
    const holder = new THREE.Group();
    holder.position.set(entity.position.x, entity.position.y, entity.position.z);
    holder.rotation.y = entity.mushroomLog.heading;
    const log = new THREE.Mesh(logShape.geometry, logMaterials);
    log.position.y = logShape.restHeight;
    log.castShadow = true;
    holder.add(log);
    if (entity.regrowing === undefined) {
      // The log lies along z, so the patches go along z, on its top.
      for (const patch of PATCHES) {
        const mushrooms = new THREE.Mesh(mushroomsShape, mushroomMaterial);
        mushrooms.position.set(patch.across, logShape.restHeight * 2 - PATCH_SINK_METRES, patch.along);
        mushrooms.scale.setScalar(patch.scale);
        mushrooms.rotation.y = patch.turn;
        mushrooms.castShadow = true;
        holder.add(mushrooms);
      }
    }
    for (const mesh of holder.children) mesh.userData.mushroomLog = entity;
    return holder;
  }

  function rebuild(): void {
    for (const holder of drawn.values()) group.remove(holder);
    drawn.clear();
    for (const entity of query) {
      const holder = build(entity);
      drawn.set(entity, holder);
      group.add(holder);
    }
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update() {
      if (dirty) rebuild();
      dirty = false;
    },
    pick(raycaster) {
      hits.length = 0;
      raycaster.intersectObjects([...drawn.values()], true, hits);
      hits.sort((a, b) => a.distance - b.distance);
      for (const hit of hits) {
        const entity = hit.object.userData.mushroomLog as Entity | undefined;
        if (entity !== undefined) return { hit: { kind: "mushroomLog", entity }, distance: hit.distance };
      }
      return undefined;
    },
    outlineOf(entity) {
      const holder = drawn.get(entity);
      if (holder === undefined) return [];
      holder.updateMatrixWorld(true);
      return holder.children.flatMap((child) =>
        child instanceof THREE.Mesh ? [{ geometry: child.geometry as THREE.BufferGeometry, matrix: child.matrixWorld.clone() }] : [],
      );
    },
    dispose() {
      query.disconnect();
      regrowing.disconnect();
      for (const material of [...logMaterials, mushroomMaterial]) material.dispose();
    },
  };
}
