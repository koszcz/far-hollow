// Draws the fish on each campfire, the draft "fish-on-fire" asset in asset-manifest.json. Built in code by fishing ticket 03.
// Each fish is skewered lengthwise on a peeled stick, snout up. The stick is pushed into the ground just outside the stone
// ring and leans in over the edge of the fire, so the fish faces the flames. A campfire holds up to 3, spread round the
// ring, low enough to stay clear of the pot nested on top of the fire's sticks.
// The fish is the trout from fishing-pile-shapes.ts. It darkens from raw to cooked colours as it cooks.
import * as THREE from "three";
import { campfireEntities, type Entity, type EntityStore } from "../sim/entities";
import { cookProgress, FISH_ON_FIRE_LIMIT } from "../sim/fish-on-fire";
import { COOKED_FISH_COLOURS, FISH_THICKNESS_METRES, fishParts, RAW_FISH_COLOURS } from "./fishing-pile-shapes";

/** A peeled green stick, paler than the dead sticks on the forest floor. */
const SKEWER_COLOUR = 0xcbb48a;
const SKEWER_LENGTH_METRES = 0.8;
const SKEWER_RADIUS_METRES = 0.008;
/** The skewer's foot is pushed this deep into the ground. */
const SKEWER_SUNK_METRES = 0.05;
/** The skewer's foot stands this far from the fire's centre, just outside the stone ring. */
const SKEWER_FOOT_METRES = 0.82;
/** How far each skewer leans in over the fire from upright, in radians. */
const SKEWER_LEAN_RADIANS = 0.6;
/** The fish's middle sits this far up the skewer from its foot. The fish then reaches over the stones, short of the pot. */
const FISH_MIDDLE_ON_SKEWER_METRES = 0.5;
/** The turn round the fire of each skewer, in radians. They spread round the ring, away from where the pot hangs. */
const SLOT_ANGLES: readonly number[] = Array.from({ length: FISH_ON_FIRE_LIMIT }, (_, slot) => 0.6 + (slot * Math.PI * 2) / FISH_ON_FIRE_LIMIT);
/** A spot more than this high above the ground stands on a foundation deck. The skewers then stand on the deck. */
const ON_DECK_METRES = 0.05;

export interface FishOnFireMeshes {
  readonly group: THREE.Group;
  /** Shows each campfire's fish, and how far each has cooked. */
  update(): void;
  dispose(): void;
}

/** One skewer and its fish. The back and belly materials are its own, so each fish darkens on its own. */
interface Slot {
  readonly root: THREE.Group;
  readonly back: THREE.MeshStandardMaterial;
  readonly belly: THREE.MeshStandardMaterial;
}

/** `groundAt` gives the height of the ground. */
export function createFishOnFireMeshes(entities: EntityStore, groundAt: (x: number, z: number) => number): FishOnFireMeshes {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const track = <T extends { dispose(): void }>(made: T): T => {
    if (made instanceof THREE.BufferGeometry) geometries.push(made);
    return made;
  };
  const material = (colour: number): THREE.MeshStandardMaterial => {
    const made = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9, flatShading: true });
    materials.push(made);
    return made;
  };
  const skewerGeometry = track(new THREE.CylinderGeometry(SKEWER_RADIUS_METRES * 0.6, SKEWER_RADIUS_METRES, SKEWER_LENGTH_METRES, 5));
  skewerGeometry.translate(0, SKEWER_LENGTH_METRES / 2, 0);
  const skewerMaterial = material(SKEWER_COLOUR);
  // One fish shape for every slot. Each slot gets its own copy of the back and belly materials.
  const [body, belly, tail, eye] = fishParts(material, track, RAW_FISH_COLOURS).map((part) => {
    // The fish lies on its side with its snout to +z, its middle halfway along. Stand it up along the skewer, snout up.
    part.geometry.rotateX(-Math.PI / 2);
    return part;
  });
  if (body === undefined || belly === undefined || tail === undefined || eye === undefined) throw new Error("The fish shape has a part missing");
  const fishShape = { body: body.geometry, belly: belly.geometry, tail: tail.geometry, eye: eye.geometry, eyeMaterial: eye.material };
  const raw = { back: new THREE.Color(RAW_FISH_COLOURS.back), belly: new THREE.Color(RAW_FISH_COLOURS.belly) };
  const cooked = { back: new THREE.Color(COOKED_FISH_COLOURS.back), belly: new THREE.Color(COOKED_FISH_COLOURS.belly) };

  const campfires = campfireEntities(entities);
  const drawn = new Map<Entity, Slot[]>();

  function makeSlot(): Slot {
    const root = new THREE.Group();
    // These two are the slot's own, so forget() disposes them, not dispose().
    const back = new THREE.MeshStandardMaterial({ color: RAW_FISH_COLOURS.back, roughness: 0.9, flatShading: true });
    const bellyMaterial = new THREE.MeshStandardMaterial({ color: RAW_FISH_COLOURS.belly, roughness: 0.9, flatShading: true });
    // The skewer's foot is the root's middle. It leans toward -z, which the slot's turn points at the fire.
    const leaning = new THREE.Group();
    leaning.rotation.x = -SKEWER_LEAN_RADIANS;
    root.add(leaning);
    const skewer = new THREE.Mesh(skewerGeometry, skewerMaterial);
    skewer.castShadow = true;
    leaning.add(skewer);
    const fish = new THREE.Group();
    fish.position.y = FISH_MIDDLE_ON_SKEWER_METRES;
    // The fish's thickness runs along -z after it stands up. Centre it on the skewer, its flat side to the fire.
    fish.position.z = FISH_THICKNESS_METRES / 2;
    leaning.add(fish);
    for (const [geometry, partMaterial] of [
      [fishShape.body, back],
      [fishShape.belly, bellyMaterial],
      [fishShape.tail, back],
      [fishShape.eye, fishShape.eyeMaterial],
    ] as const) {
      const mesh = new THREE.Mesh(geometry, partMaterial);
      mesh.castShadow = true;
      fish.add(mesh);
    }
    group.add(root);
    return { root, back, belly: bellyMaterial };
  }

  function slotsOf(campfire: Entity & { position: { x: number; y: number; z: number } }): Slot[] {
    const existing = drawn.get(campfire);
    if (existing !== undefined) return existing;
    const { x, y, z } = campfire.position;
    const onDeck = y - groundAt(x, z) > ON_DECK_METRES;
    const slots = SLOT_ANGLES.map((angle) => {
      const slot = makeSlot();
      const footX = x + Math.sin(angle) * SKEWER_FOOT_METRES;
      const footZ = z + Math.cos(angle) * SKEWER_FOOT_METRES;
      slot.root.position.set(footX, (onDeck ? y : groundAt(footX, footZ)) - SKEWER_SUNK_METRES, footZ);
      // The root's +z points away from the fire, so the skewer leans in toward it.
      slot.root.rotation.y = angle;
      return slot;
    });
    drawn.set(campfire, slots);
    return slots;
  }

  function forget(campfire: Entity): void {
    for (const slot of drawn.get(campfire) ?? []) {
      group.remove(slot.root);
      slot.back.dispose();
      slot.belly.dispose();
    }
    drawn.delete(campfire);
  }

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      for (const campfire of campfires) {
        if (campfire.fishOnFire === undefined) continue;
        seen.add(campfire);
        slotsOf(campfire).forEach((slot, index) => {
          const fish = campfire.fishOnFire?.[index];
          slot.root.visible = fish !== undefined;
          if (fish === undefined) return;
          const progress = cookProgress(fish);
          slot.back.color.copy(raw.back).lerp(cooked.back, progress);
          slot.belly.color.copy(raw.belly).lerp(cooked.belly, progress);
        });
      }
      for (const campfire of [...drawn.keys()]) if (!seen.has(campfire)) forget(campfire);
    },
    dispose() {
      for (const campfire of [...drawn.keys()]) forget(campfire);
      for (const geometry of geometries) geometry.dispose();
      for (const made of materials) made.dispose();
    },
  };
}
