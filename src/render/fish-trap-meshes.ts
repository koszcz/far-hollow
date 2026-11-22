// Draws set fish traps: the draft "fish-trap" asset in asset-manifest.json. Built in code. Added by fish-trap ticket 01.
// A set trap is the cone basket of sticks from fish-trap-shape.ts, sunk half into the river's water at the edge, its mouth facing
// upstream. When it holds a fish, a raw fish from the approved "fishing-piles" shapes lies inside it, so the player can see it.
// There are only ever a few traps, the ones the player set, so each is its own meshes rather than a batch.
import * as THREE from "three";
import { fishTrapEntities, type Entity, type EntityStore } from "../sim/entities";
import type { River } from "../sim/valley";
import { createFishTrapGeometries, CORD_COLOUR, FISH_TRAP_MOUTH_RADIUS_METRES, TRAP_STICK_COLOUR } from "./fish-trap-shape";
import { rawFishParts } from "./fishing-pile-shapes";
import type { OutlinePart } from "./hover-outline";

/** The trap sinks this far below the ground under it, in metres, so its lower half sits in the water. */
const SINK_METRES = FISH_TRAP_MOUTH_RADIUS_METRES * 0.6;
/** The fish inside lies just above the waterline, in metres above the trap's bottom, so it shows, and a little toward the narrow end. */
const FISH_LIFT_METRES = SINK_METRES + 0.01;
const FISH_ALONG_METRES = 0.05;

/** What a click on a fish trap landed on. */
export interface FishTrapHit {
  kind: "fishTrap";
  entity: Entity;
}

export interface FishTrapMeshes {
  readonly group: THREE.Group;
  /** Brings every set trap up to date with game state, including whether it holds a fish. */
  update(): void;
  /** What a ray from the camera hits first among set traps, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: FishTrapHit; distance: number } | undefined;
  /** The shapes that draw a set trap, placed in the world. Empty when it is not drawn. */
  outlineOf(entity: Entity): OutlinePart[];
  dispose(): void;
}

/** The way the river flows at the stretch nearest a spot, in radians about the vertical axis, as a heading along +z turned. */
function flowHeadingAt(river: River, spot: { x: number; z: number }): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 1; i < river.path.length; i += 1) {
    const a = river.path[i - 1];
    const b = river.path[i];
    if (a === undefined || b === undefined) continue;
    const middle = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const distance = Math.hypot(spot.x - middle.x, spot.z - middle.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = Math.atan2(b.x - a.x, b.z - a.z);
    }
  }
  return best;
}

export function createFishTrapMeshes(entities: EntityStore, river: River): FishTrapMeshes {
  const group = new THREE.Group();
  const resources = new Set<{ dispose(): void }>();
  const track = <T extends { dispose(): void }>(resource: T): T => {
    resources.add(resource);
    return resource;
  };
  const material = (color: number) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }));
  const { sticks, cord } = createFishTrapGeometries();
  track(sticks);
  track(cord);
  const stickMaterial = material(TRAP_STICK_COLOUR);
  const cordMaterial = material(CORD_COLOUR);
  const fishParts = rawFishParts(material, track);
  const query = fishTrapEntities(entities).connect();
  /** Each drawn trap, with its meshes and whether they show a fish. */
  const drawn = new Map<Entity, { holder: THREE.Group; holding: boolean }>();
  let dirty = true;
  const markDirty = () => {
    dirty = true;
  };
  query.onEntityAdded.subscribe(markDirty);
  query.onEntityRemoved.subscribe(markDirty);

  function build(entity: Entity & { position: THREE.Vector3Like; fishTrap: { holding: boolean } }): THREE.Group {
    const holder = new THREE.Group();
    holder.position.set(entity.position.x, entity.position.y - SINK_METRES, entity.position.z);
    // The trap's mouth is at -z. Turn it so the mouth faces upstream, where the fish swim in from.
    holder.rotation.y = flowHeadingAt(river, entity.position);
    for (const [geometry, partMaterial] of [
      [sticks, stickMaterial],
      [cord, cordMaterial],
    ] as const) {
      const mesh = new THREE.Mesh(geometry, partMaterial);
      mesh.castShadow = true;
      holder.add(mesh);
    }
    if (entity.fishTrap.holding) {
      for (const part of fishParts) {
        const mesh = new THREE.Mesh(part.geometry, part.material);
        mesh.position.set(0, FISH_LIFT_METRES, FISH_ALONG_METRES);
        holder.add(mesh);
      }
    }
    for (const mesh of holder.children) mesh.userData.fishTrap = entity;
    return holder;
  }

  function rebuild(): void {
    for (const { holder } of drawn.values()) group.remove(holder);
    drawn.clear();
    for (const entity of query) {
      const holder = build(entity);
      drawn.set(entity, { holder, holding: entity.fishTrap.holding });
      group.add(holder);
    }
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update() {
      // A trap that caught a fish, or had its fish taken, is drawn again.
      for (const [entity, { holding }] of drawn) if (entity.fishTrap?.holding !== holding) dirty = true;
      if (dirty) rebuild();
      dirty = false;
    },
    pick(raycaster) {
      hits.length = 0;
      raycaster.intersectObjects(
        [...drawn.values()].map(({ holder }) => holder),
        true,
        hits,
      );
      hits.sort((a, b) => a.distance - b.distance);
      for (const hit of hits) {
        const entity = hit.object.userData.fishTrap as Entity | undefined;
        if (entity !== undefined) return { hit: { kind: "fishTrap", entity }, distance: hit.distance };
      }
      return undefined;
    },
    outlineOf(entity) {
      const holder = drawn.get(entity)?.holder;
      if (holder === undefined) return [];
      holder.updateMatrixWorld(true);
      return holder.children.flatMap((child) =>
        child instanceof THREE.Mesh ? [{ geometry: child.geometry as THREE.BufferGeometry, matrix: child.matrixWorld.clone() }] : [],
      );
    },
    dispose() {
      query.disconnect();
      for (const resource of resources) resource.dispose();
    },
  };
}
