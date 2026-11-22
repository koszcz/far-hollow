// Draws mushroom logs: "mushroom-log" in asset-manifest.json. The owner approved the asset.
// A mushroom log is the "logs" model lying on the ground, marked as planted by pale spawn plugs, grey mould, and a patch of moss on its bark.
// When it bears mushrooms, a "mushrooms" patch stands on top and shelves of bracket fungi stick out of both sides.
// While its mushrooms grow back, it shows only the plugs, mould, and moss, so the player can still tell it from a plain log.
// There are only ever a few mushroom logs, the ones the player planted, so each is its own meshes rather than a batch.
import * as THREE from "three";
import { mushroomLogEntities, type Entity, type EntityStore } from "../sim/entities";
import type { OutlinePart } from "./hover-outline";
import { LOG_COLOUR, LOG_CUT_COLOUR, type LogShape } from "./log-shape";
import { CAP_COLOUR, STEM_COLOUR, type MushroomsShape } from "./mushrooms-model";

/** The mushroom patch on top of the log: how far along it sits from the middle, in metres, and how big it is drawn. */
const TOP_PATCH = { along: -0.24, across: 0.02, scale: 1.1, turn: 0.3 } as const;
/** The patch sinks this far into the bark, in metres, so its foot does not float over the curve. */
const PATCH_SINK_METRES = 0.04;

/**
 * Bracket fungi: half-disc shelves on the log's sides.
 * side is +1 for the log's +x side and -1 for its -x side. along is in metres from the middle.
 * height is how far up the side, from -1 at the bottom of the bark to 1 at the top. size is the shelf's reach in metres.
 */
const BRACKETS = [
  { side: 1, along: 0.06, height: 0.35, size: 0.11 },
  { side: 1, along: 0.18, height: 0.05, size: 0.09 },
  { side: 1, along: -0.04, height: -0.2, size: 0.075 },
  { side: 1, along: 0.3, height: 0.3, size: 0.07 },
  { side: -1, along: -0.02, height: 0.25, size: 0.1 },
  { side: -1, along: 0.12, height: -0.05, size: 0.08 },
  { side: -1, along: 0.26, height: 0.2, size: 0.065 },
] as const;
/** How thick each bracket shelf is, in metres. */
const BRACKET_THICKNESS_METRES = 0.022;
/** How far each bracket's colour moves from the cap colour toward the stem colour, from 0 to 1. */
const BRACKET_LIGHTEN = 0.35;
/** Brackets droop this much, in radians, as real shelf fungi do. */
const BRACKET_DROOP = 0.12;

/** Spawn plugs: pale wooden dowels in the bark. angle is around the log from its top, in radians. */
const PLUGS = [
  { along: -0.38, angle: 0.9 },
  { along: -0.12, angle: -0.8 },
  { along: 0.1, angle: 0.7 },
  { along: 0.36, angle: -0.9 },
  { along: -0.3, angle: -1.5 },
  { along: 0.24, angle: 1.5 },
] as const;
const PLUG_RADIUS_METRES = 0.026;

/** The moss patch on top of the log, at the end away from the mushroom patch. */
const MOSS = { along: 0.26, width: 0.11, length: 0.17, depth: 0.03 } as const;
const MOSS_COLOUR = 0x4f7a2a;

/**
 * Mould: grey patches of mushroom threads spreading over the bark, which show the log has taken the spawn.
 * angle is around the log from its top, in radians. width runs around the log and length runs along it, in metres.
 */
const MOULD = [
  { along: -0.05, angle: 0.25, width: 0.07, length: 0.12 },
  { along: 0.4, angle: 1.1, width: 0.06, length: 0.08 },
  { along: 0.15, angle: -1.25, width: 0.07, length: 0.1 },
  { along: -0.22, angle: 1.7, width: 0.06, length: 0.09 },
] as const;
const MOULD_DEPTH_METRES = 0.012;
const MOULD_COLOUR = 0xa9a8a2;

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
  // A bracket draws its side and top in a lighter cap colour, so it stands out from the bark, and its underside in the stem colour.
  const capMaterial = new THREE.MeshStandardMaterial({ color: CAP_COLOUR.clone().lerp(STEM_COLOUR, BRACKET_LIGHTEN), flatShading: true });
  const gillMaterial = new THREE.MeshStandardMaterial({ color: STEM_COLOUR, flatShading: true });
  const bracketMaterials = [capMaterial, capMaterial, gillMaterial];
  const plugMaterial = new THREE.MeshStandardMaterial({ color: LOG_CUT_COLOUR, flatShading: true });
  const mossMaterial = new THREE.MeshStandardMaterial({ color: MOSS_COLOUR, flatShading: true });
  const mouldMaterial = new THREE.MeshStandardMaterial({ color: MOULD_COLOUR, flatShading: true });
  // A half disc of radius 1 reaching out along +x, with its flat edge on the z axis.
  const bracketGeometry = new THREE.CylinderGeometry(1, 0.85, BRACKET_THICKNESS_METRES, 10, 1, false, 0, Math.PI);
  const plugGeometry = new THREE.CylinderGeometry(PLUG_RADIUS_METRES, PLUG_RADIUS_METRES, 0.04, 6);
  const mossGeometry = new THREE.IcosahedronGeometry(1, 1);
  /** The log's radius, taken as how high its middle rests above the ground. */
  const logRadius = logShape.restHeight;
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
    // The log lies along z. Plugs and moss show always: they mark the log as planted.
    for (const plug of PLUGS) {
      const mesh = new THREE.Mesh(plugGeometry, plugMaterial);
      // Stand the dowel out of the bark, pointing away from the log's middle.
      mesh.position.set(logRadius * Math.sin(plug.angle), logRadius + logRadius * Math.cos(plug.angle), plug.along);
      mesh.rotation.z = -plug.angle;
      holder.add(mesh);
    }
    const moss = new THREE.Mesh(mossGeometry, mossMaterial);
    moss.position.set(0, logRadius * 2 - MOSS.depth * 0.4, MOSS.along);
    moss.scale.set(MOSS.width, MOSS.depth, MOSS.length);
    holder.add(moss);
    for (const patch of MOULD) {
      // The same lump as the moss, pressed flat against the bark at its angle around the log.
      const mesh = new THREE.Mesh(mossGeometry, mouldMaterial);
      mesh.position.set(logRadius * Math.sin(patch.angle), logRadius + logRadius * Math.cos(patch.angle), patch.along);
      mesh.rotation.z = -patch.angle;
      mesh.scale.set(patch.width, MOULD_DEPTH_METRES, patch.length);
      holder.add(mesh);
    }
    if (entity.regrowing === undefined) {
      const mushrooms = new THREE.Mesh(mushroomsShape, mushroomMaterial);
      mushrooms.position.set(TOP_PATCH.across, logRadius * 2 - PATCH_SINK_METRES, TOP_PATCH.along);
      mushrooms.scale.setScalar(TOP_PATCH.scale);
      mushrooms.rotation.y = TOP_PATCH.turn;
      mushrooms.castShadow = true;
      holder.add(mushrooms);
      for (const bracket of BRACKETS) {
        const mesh = new THREE.Mesh(bracketGeometry, bracketMaterials);
        // On a round log, a point that high up the side sits this far out from the middle.
        const out = logRadius * Math.sqrt(1 - bracket.height * bracket.height) * 0.9;
        mesh.position.set(bracket.side * out, logRadius + logRadius * bracket.height, bracket.along);
        mesh.scale.set(bracket.size, 1, bracket.size);
        mesh.rotation.set(0, bracket.side > 0 ? 0 : Math.PI, -BRACKET_DROOP);
        mesh.castShadow = true;
        holder.add(mesh);
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
      for (const material of [...logMaterials, mushroomMaterial, capMaterial, gillMaterial, plugMaterial, mossMaterial, mouldMaterial]) material.dispose();
      for (const geometry of [bracketGeometry, plugGeometry, mossGeometry]) geometry.dispose();
    },
  };
}
