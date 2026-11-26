// Checks that a click on a set fish trap lands on it, even through the gaps between its sticks, without a browser.
import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { createEntityStore, type Entity } from "../sim/entities";
import { generateValley, riverEdgeSpot, startSpotBeside, terrainHeightAt } from "../sim/valley";
import { createFishTrapMeshes, type FishTrapMeshes } from "./fish-trap-meshes";
import { PICK_MARGIN_METRES, STAKE_RADIUS_METRES } from "./fish-trap-shape";
import type { OutlinePart } from "./hover-outline";

const valley = generateValley(42);
const heightAt = (x: number, z: number) => terrainHeightAt(valley.terrain, x, z);
/** A ray starts this high above the trap, in metres. */
const TOP = 5;

/** A trap set at the water's edge beside the start spot, empty or holding a fish, with its meshes drawn. */
function setTrap(holding: boolean): { traps: FishTrapMeshes; trap: Entity; holder: THREE.Object3D } {
  const entities = createEntityStore();
  const bank = startSpotBeside(valley.river);
  const spot = riverEdgeSpot(valley.river, bank, bank, 0.3);
  const trap = entities.add({ fishTrap: { holding, minutesToNext: 60, draws: 1 }, position: { x: spot.x, y: heightAt(spot.x, spot.z), z: spot.z } });
  const traps = createFishTrapMeshes(entities, valley.river, heightAt);
  traps.update();
  traps.group.updateMatrixWorld(true);
  const holder = traps.group.children[0];
  if (holder === undefined) throw new Error("No trap drawn");
  return { traps, trap, holder };
}

/** A ray straight down onto a point given in the trap's own frame. */
function rayDownOnto(holder: THREE.Object3D, local: THREE.Vector3): THREE.Raycaster {
  const at = holder.localToWorld(local.clone());
  return new THREE.Raycaster(new THREE.Vector3(at.x, at.y + TOP, at.z), new THREE.Vector3(0, -1, 0));
}

/** Whether a ray meets any of the trap's drawn shapes, the ones its hover outline traces. */
function hitsDrawnShapes(parts: OutlinePart[], raycaster: THREE.Raycaster): boolean {
  return parts.some(({ geometry, matrix }) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(matrix);
    mesh.matrixWorld.copy(matrix);
    return raycaster.intersectObject(mesh, false).length > 0;
  });
}

/** How far down a ray from above a point meets the ground or riverbed. */
function groundDistance(raycaster: THREE.Raycaster): number {
  const { x, y, z } = raycaster.ray.origin;
  return y - heightAt(x, z);
}

describe("picking a set fish trap", () => {
  // The basket's middle, 40% of its length from the mouth: between two withy bands, past the inner funnel. Straight down
  // from above, the ray passes between the top two sticks and the bottom two.
  const gap = new THREE.Vector3(0, 0, -0.07);

  for (const holding of [false, true]) {
    it(`catches a ray through a gap between the sticks, before the river, ${holding ? "holding a fish" : "empty"}`, () => {
      const { traps, trap, holder } = setTrap(holding);
      const ray = rayDownOnto(holder, gap);
      if (!holding) expect(hitsDrawnShapes(traps.outlineOf(trap), ray)).toBe(false);
      const hit = traps.pick(ray);
      expect(hit?.hit.entity).toBe(trap);
      expect(hit?.distance ?? Infinity).toBeLessThan(groundDistance(ray));
      traps.dispose();
    });
  }

  it("catches a ray just past the side of the basket, inside the margin", () => {
    const { traps, trap, holder } = setTrap(false);
    // The basket is about 14 cm wide here. This ray passes 3 cm past its side.
    const ray = rayDownOnto(holder, new THREE.Vector3(0.17, 0, gap.z));
    expect(hitsDrawnShapes(traps.outlineOf(trap), ray)).toBe(false);
    expect(traps.pick(ray)?.hit.entity).toBe(trap);
    traps.dispose();
  });

  it("catches a ray just beside the stake on the bank", () => {
    const { traps, trap, holder } = setTrap(false);
    const stake = holder.getObjectByName("stake");
    if (stake === undefined) throw new Error("No stake drawn");
    const middle = new THREE.Box3().setFromObject(stake).getCenter(new THREE.Vector3());
    // A ray straight down past the stake's side, a little over half the margin out. The stake leans away from the trap, and the line runs toward it, so a
    // ray to the side, square to that line, misses both.
    const trapAt = holder.getWorldPosition(new THREE.Vector3());
    const side = new THREE.Vector3(-(middle.z - trapAt.z), 0, middle.x - trapAt.x).normalize();
    const beside = middle.clone().addScaledVector(side, STAKE_RADIUS_METRES + PICK_MARGIN_METRES * 0.6);
    const ray = new THREE.Raycaster(new THREE.Vector3(beside.x, beside.y + TOP, beside.z), new THREE.Vector3(0, -1, 0));
    expect(hitsDrawnShapes(traps.outlineOf(trap), ray)).toBe(false);
    expect(traps.pick(ray)?.hit.entity).toBe(trap);
    traps.dispose();
  });

  for (const holding of [false, true]) {
    it(`outlines only the drawn shapes, never the pick shapes, ${holding ? "holding a fish" : "empty"}`, () => {
      const { traps, trap, holder } = setTrap(holding);
      const pickShapes = new Set<THREE.BufferGeometry>();
      holder.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.Material && !child.material.visible)
          pickShapes.add(child.geometry as THREE.BufferGeometry);
      });
      expect(pickShapes.size).toBeGreaterThan(0);
      const outline = traps.outlineOf(trap);
      expect(outline.length).toBeGreaterThan(0);
      expect(outline.some(({ geometry }) => pickShapes.has(geometry))).toBe(false);
      traps.dispose();
    });
  }

  it("catches a ray onto any part of the fish it holds, before the ray reaches the fish", () => {
    const { traps, trap, holder } = setTrap(true);
    const corners: THREE.Vector3[] = [];
    holder.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || child.name !== "fish") return;
      const position = (child.geometry as THREE.BufferGeometry).getAttribute("position");
      for (let i = 0; i < position.count; i += 1) corners.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld));
    });
    expect(corners.length).toBeGreaterThan(0);
    // A ray straight down onto every corner of the fish's shapes meets the pick shape no later than the fish.
    for (const corner of corners) {
      const ray = new THREE.Raycaster(new THREE.Vector3(corner.x, corner.y + TOP, corner.z), new THREE.Vector3(0, -1, 0));
      const hit = traps.pick(ray);
      expect(hit?.hit.entity).toBe(trap);
      expect(hit?.distance ?? Infinity).toBeLessThanOrEqual(TOP);
    }
    traps.dispose();
  });

  it("misses a ray well clear of the basket and the stake", () => {
    const { traps, holder } = setTrap(false);
    expect(traps.pick(rayDownOnto(holder, new THREE.Vector3(0, 0, -1.2)))).toBeUndefined();
    traps.dispose();
  });
});
