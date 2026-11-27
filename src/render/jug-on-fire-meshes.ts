// Draws the jug on each campfire and fireplace, part of the approved "jug" asset in asset-manifest.json. Built in code by clay
// ticket 03. The jug is the shape from jug-shape.ts.
// On a campfire, the jug stands upright on the ground against the stone ring, in the gap between two fish skewers, so the
// pot on top of the fire and the fish never get in its way. On a fireplace, it stands on the hearth at its opening, beside
// the row of fish.
// As it fires, it turns from the pale grey-brown of dried clay to the orange-brown of fired clay, and gains a faint sheen.
import * as THREE from "three";
import { type Entity, type EntityStore } from "../sim/entities";
import { campfireEntities, fireplaceEntities } from "../sim/entity-queries";
import { FISH_ON_FIRE_LIMIT } from "../sim/fish-on-fire";
import { fireProgress } from "../sim/jug-on-fire";
import { quarterTurnsToRadians } from "../sim/quarter-turns";
import { STONE_RING_RADIUS_METRES } from "./campfire-meshes";
import { createJugGeometry, FIRED_JUG_COLOUR, FIRED_JUG_ROUGHNESS, JUG_MATERIAL_OPTIONS, UNFIRED_JUG_COLOUR, UNFIRED_JUG_ROUGHNESS } from "./jug-shape";

/** The jug's middle stands this far from a campfire's centre: its belly rests against the outside of the stone ring. */
const CAMPFIRE_JUG_METRES = STONE_RING_RADIUS_METRES + 0.1;
/** The turn round the campfire where the jug stands, in radians: halfway between the first two fish skewers. */
const CAMPFIRE_JUG_ANGLE = 0.6 + Math.PI / FISH_ON_FIRE_LIMIT;
/**
 * On a fireplace, the jug's offset from the fireplace's middle across the opening and toward the front, in metres, with the
 * fireplace facing the default way. It stands beside the row of fish.
 */
const FIREPLACE_JUG: readonly [number, number] = [0.3, 0.47];
/** A spot more than this high above the ground stands on a foundation deck. The jug then stands on the deck. */
const ON_DECK_METRES = 0.05;

export interface JugOnFireMeshes {
  readonly group: THREE.Group;
  /** Shows each fire's jug, and how far it has fired. */
  update(): void;
  dispose(): void;
}

/** `groundAt` gives the height of the ground. */
export function createJugOnFireMeshes(entities: EntityStore, groundAt: (x: number, z: number) => number): JugOnFireMeshes {
  const group = new THREE.Group();
  const geometry = createJugGeometry();
  const unfired = new THREE.Color(UNFIRED_JUG_COLOUR);
  const fired = new THREE.Color(FIRED_JUG_COLOUR);
  const campfires = campfireEntities(entities);
  const fireplaces = fireplaceEntities(entities);
  /** Each fire's jug. The material is the jug's own, so each jug turns colour on its own. */
  const drawn = new Map<Entity, THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>();

  function jugOf(fire: Entity & { position: { x: number; y: number; z: number } }) {
    const existing = drawn.get(fire);
    if (existing !== undefined) return existing;
    const material = new THREE.MeshStandardMaterial({ ...JUG_MATERIAL_OPTIONS, color: UNFIRED_JUG_COLOUR, roughness: UNFIRED_JUG_ROUGHNESS });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    const { x, y, z } = fire.position;
    if (fire.fireplace !== undefined) {
      const yaw = quarterTurnsToRadians(fire.facing?.turns ?? 0);
      const [across, forward] = FIREPLACE_JUG;
      // Turn the offset with the fireplace, the same way three.js turns a child of a group turned by `yaw`.
      mesh.position.set(x + across * Math.cos(yaw) + forward * Math.sin(yaw), y, z - across * Math.sin(yaw) + forward * Math.cos(yaw));
      mesh.rotation.y = yaw;
    } else {
      const onDeck = y - groundAt(x, z) > ON_DECK_METRES;
      const jugX = x + Math.sin(CAMPFIRE_JUG_ANGLE) * CAMPFIRE_JUG_METRES;
      const jugZ = z + Math.cos(CAMPFIRE_JUG_ANGLE) * CAMPFIRE_JUG_METRES;
      mesh.position.set(jugX, onDeck ? y : groundAt(jugX, jugZ), jugZ);
      // The handle points along the ring, so the jug's belly faces the fire.
      mesh.rotation.y = CAMPFIRE_JUG_ANGLE;
    }
    group.add(mesh);
    drawn.set(fire, mesh);
    return mesh;
  }

  function forget(fire: Entity): void {
    const mesh = drawn.get(fire);
    if (mesh === undefined) return;
    group.remove(mesh);
    mesh.material.dispose();
    drawn.delete(fire);
  }

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      for (const fire of [...campfires, ...fireplaces]) {
        if (fire.jugOnFire === undefined) continue;
        seen.add(fire);
        const progress = fireProgress(fire.jugOnFire);
        const { material } = jugOf(fire);
        material.color.copy(unfired).lerp(fired, progress);
        material.roughness = UNFIRED_JUG_ROUGHNESS + (FIRED_JUG_ROUGHNESS - UNFIRED_JUG_ROUGHNESS) * progress;
      }
      for (const fire of [...drawn.keys()]) if (!seen.has(fire)) forget(fire);
    },
    dispose() {
      for (const fire of [...drawn.keys()]) forget(fire);
      geometry.dispose();
    },
  };
}
