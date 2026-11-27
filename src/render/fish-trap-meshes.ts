// Draws set fish traps: the approved "fish-trap" asset in asset-manifest.json. Built in code. Added by fish-trap ticket 01.
// A set trap is the woven cone basket from fish-trap-shape.ts, sunk half into the river's water at the edge, its mouth facing
// upstream. A stake driven into the bank beside its mouth holds a cord line tied to the trap's hoop. When it holds a fish, a raw
// fish from the approved "fishing-piles" shapes lies inside it, so the player can see it.
// There are only ever a few traps, the ones the player set, so each is its own meshes rather than a batch.
import * as THREE from "three";
import { type Entity, type EntityStore } from "../sim/entities";
import { fishTrapEntities } from "../sim/entity-queries";
import { nearestRiverPoint, type River } from "../sim/valley";
import {
  createFishTrapGeometries,
  createFishTrapPickGeometry,
  createFishTrapStakeGeometries,
  CORD_COLOUR,
  FISH_TRAP_MOUTH_RADIUS_METRES,
  STAKE_COLOUR,
  TRAP_STICK_COLOUR,
  WITHY_COLOUR,
} from "./fish-trap-shape";
import { rawFishParts } from "./fishing-pile-shapes";
import type { OutlinePart } from "./hover-outline";

/** The trap sinks this far below the ground under it, in metres, so its lower half sits in the water. */
const SINK_METRES = FISH_TRAP_MOUTH_RADIUS_METRES * 0.6;
/** The fish inside lies just above the waterline, in metres above the trap's bottom, so it shows, and toward the narrow end, past the funnel. It lies wholly inside the basket's pick shape, so a click on it hits the trap. */
const FISH_LIFT_METRES = SINK_METRES + 0.03;
const FISH_ALONG_METRES = 0.1;
/** The stake stands on the bank this far from the trap, away from the river, and this far upstream, beside the trap's mouth. In metres. */
const STAKE_OUT_METRES = 0.6;
const STAKE_UPSTREAM_METRES = 0.25;

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

/** Where the stake stands for a trap at a spot: on the bank, away from the river's middle line, beside the trap's mouth. */
function stakeSpot(river: River, spot: { x: number; z: number }, heading: number): { x: number; z: number } {
  const middle = nearestRiverPoint(river, spot);
  const outLength = Math.hypot(spot.x - middle.x, spot.z - middle.z) || 1;
  const out = { x: (spot.x - middle.x) / outLength, z: (spot.z - middle.z) / outLength };
  // The heading turns +z to the way the river flows, so upstream is the other way.
  return {
    x: spot.x + out.x * STAKE_OUT_METRES - Math.sin(heading) * STAKE_UPSTREAM_METRES,
    z: spot.z + out.z * STAKE_OUT_METRES - Math.cos(heading) * STAKE_UPSTREAM_METRES,
  };
}

/** One drawn trap: its holder, the meshes that draw it, its pick shapes, its own stake and line geometries, and whether it shows a fish. */
interface DrawnTrap {
  readonly holder: THREE.Group;
  /** The drawn meshes, the ones the hover outline traces. The pick shapes are kept apart from them. */
  readonly shapes: THREE.Mesh[];
  readonly pickers: THREE.Mesh[];
  readonly own: THREE.BufferGeometry[];
  readonly holding: boolean;
}

/** Draws set fish traps. `heightAt` gives the ground's height at a spot, for the stake on the bank. */
export function createFishTrapMeshes(entities: EntityStore, river: River, heightAt: (x: number, z: number) => number): FishTrapMeshes {
  const group = new THREE.Group();
  const resources = new Set<{ dispose(): void }>();
  const track = <T extends { dispose(): void }>(resource: T): T => {
    resources.add(resource);
    return resource;
  };
  const material = (color: number) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }));
  const { sticks, withy, cord } = createFishTrapGeometries();
  track(sticks);
  track(withy);
  track(cord);
  const stickMaterial = material(TRAP_STICK_COLOUR);
  const withyMaterial = material(WITHY_COLOUR);
  const cordMaterial = material(CORD_COLOUR);
  const stakeMaterial = material(STAKE_COLOUR);
  const fishParts = rawFishParts(material, track);
  // The pick shapes are never drawn. They catch clicks that pass through the gaps between the trap's thin sticks.
  const basketPick = track(createFishTrapPickGeometry());
  const pickMaterial = track(new THREE.MeshBasicMaterial({ visible: false }));
  const query = fishTrapEntities(entities).connect();
  const drawn = new Map<Entity, DrawnTrap>();
  let dirty = true;
  const markDirty = () => {
    dirty = true;
  };
  query.onEntityAdded.subscribe(markDirty);
  query.onEntityRemoved.subscribe(markDirty);

  function build(entity: Entity & { position: THREE.Vector3Like; fishTrap: { holding: boolean } }): DrawnTrap {
    const holder = new THREE.Group();
    holder.position.set(entity.position.x, entity.position.y - SINK_METRES, entity.position.z);
    // The trap's mouth is at -z. Turn it so the mouth faces upstream, where the fish swim in from.
    const heading = flowHeadingAt(river, entity.position);
    holder.rotation.y = heading;
    holder.updateMatrix();
    // The stake's foot on the bank, in the trap's own frame.
    const stakeAt = stakeSpot(river, entity.position, heading);
    const stakeFoot = new THREE.Vector3(stakeAt.x, heightAt(stakeAt.x, stakeAt.z), stakeAt.z).applyMatrix4(holder.matrix.clone().invert());
    const { stake, line, stakePick } = createFishTrapStakeGeometries(stakeFoot);
    const shapes: THREE.Mesh[] = [];
    for (const [name, geometry, partMaterial] of [
      ["sticks", sticks, stickMaterial],
      ["withy", withy, withyMaterial],
      ["cord", cord, cordMaterial],
      ["stake", stake, stakeMaterial],
      ["line", line, cordMaterial],
    ] as const) {
      const mesh = new THREE.Mesh(geometry, partMaterial);
      mesh.name = name;
      mesh.castShadow = true;
      shapes.push(mesh);
    }
    if (entity.fishTrap.holding) {
      for (const part of fishParts) {
        const mesh = new THREE.Mesh(part.geometry, part.material);
        mesh.name = "fish";
        mesh.position.set(0, FISH_LIFT_METRES, FISH_ALONG_METRES);
        shapes.push(mesh);
      }
    }
    holder.add(...shapes);
    // The pick shapes are kept apart from the drawn shapes, so the hover outline traces only the drawn shapes.
    const pickers = [basketPick, stakePick].map((geometry) => {
      const picker = new THREE.Mesh(geometry, pickMaterial);
      picker.userData.fishTrap = entity;
      holder.add(picker);
      return picker;
    });
    return { holder, shapes, pickers, own: [stake, line, stakePick], holding: entity.fishTrap.holding };
  }

  function rebuild(): void {
    for (const { holder, own } of drawn.values()) {
      group.remove(holder);
      for (const geometry of own) geometry.dispose();
    }
    drawn.clear();
    for (const entity of query) {
      const trap = build(entity);
      drawn.set(entity, trap);
      group.add(trap.holder);
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
        [...drawn.values()].flatMap(({ pickers }) => pickers),
        false,
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
      const trap = drawn.get(entity);
      if (trap === undefined) return [];
      trap.holder.updateMatrixWorld(true);
      return trap.shapes.map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld.clone() }));
    },
    dispose() {
      query.disconnect();
      for (const { own } of drawn.values()) for (const geometry of own) geometry.dispose();
      for (const resource of resources) resource.dispose();
    },
  };
}
