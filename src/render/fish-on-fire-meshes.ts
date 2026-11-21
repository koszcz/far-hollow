// Draws the fish on each campfire, the approved "fish-on-fire" asset in asset-manifest.json. Built in code by fishing ticket 03.
// Each fish is skewered lengthwise on a peeled stick, snout up, with the stick's pointed tip poking out past the snout.
// The stick is pushed into the ground just outside the stone ring and leans in a little, so the fish hangs above the
// stones with its flat side to the flames. A campfire holds up to 3, spread round the ring, well below the pot nested on
// top of the fire's sticks.
// The fish is the trout from fishing-pile-shapes.ts. As it cooks, it darkens from raw to cooked colours, and the cooked
// fish's char marks show on both its flat sides.
// A fireplace's fish stand upright in a row at its opening instead. See FIREPLACE_FEET.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { campfireEntities, fireplaceEntities, type Entity, type EntityStore } from "../sim/entities";
import { cookProgress, FISH_ON_FIRE_LIMIT } from "../sim/fish-on-fire";
import { quarterTurnsToRadians } from "../sim/quarter-turns";
import { CHAR_COLOUR, charMarkPart, COOKED_FISH_COLOURS, FISH_THICKNESS_METRES, fishParts, RAW_FISH_COLOURS } from "./fishing-pile-shapes";

/** A peeled green stick, paler than the dead sticks on the forest floor. */
const SKEWER_COLOUR = 0xcbb48a;
const SKEWER_LENGTH_METRES = 0.8;
const SKEWER_RADIUS_METRES = 0.012;
/** The skewer's top is whittled to a point this long. */
const SKEWER_POINT_METRES = 0.04;
/** The skewer's foot is pushed this deep into the ground. */
const SKEWER_SUNK_METRES = 0.05;
/** The skewer's foot stands this far from the fire's centre, just outside the stone ring. */
const SKEWER_FOOT_METRES = 0.82;
/** How far each skewer leans in toward the fire from upright, in radians. */
const SKEWER_LEAN_RADIANS = 0.3;
/**
 * The fish's middle sits this far up the skewer from its foot, about 0.5 m above the ground. Its tail then hangs clear
 * above the stones, its snout well below the pot, and the skewer's tip pokes out past the snout.
 */
const FISH_MIDDLE_ON_SKEWER_METRES = 0.58;
/** The char marks start to show once a fish is this far cooked, then darken until it is done. */
const CHAR_FROM_PROGRESS = 0.3;
/** The turn round the fire of each skewer, in radians. They spread round the ring, away from where the pot hangs. */
const SLOT_ANGLES: readonly number[] = Array.from({ length: FISH_ON_FIRE_LIMIT }, (_, slot) => 0.6 + (slot * Math.PI * 2) / FISH_ON_FIRE_LIMIT);
/** A spot more than this high above the ground stands on a foundation deck. The skewers then stand on the deck. */
const ON_DECK_METRES = 0.05;
/**
 * On a fireplace, the skewers stand upright in a row just in front of its opening, on its foundation square, so the fish hang
 * at the opening with their flat sides to the fire. Added by fireplace ticket 04. These are the feet's offsets from the
 * fireplace's middle across the opening and toward the front, in metres, with the fireplace facing the default way.
 */
const FIREPLACE_FEET: readonly (readonly [number, number])[] = [
  [-0.15, 0.47],
  [0, 0.47],
  [0.15, 0.47],
];

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
  readonly char: THREE.MeshStandardMaterial;
  readonly charMarks: THREE.Mesh;
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
  // A straight shaft, a little thinner at the top, whittled to a point.
  const shaftLength = SKEWER_LENGTH_METRES - SKEWER_POINT_METRES;
  const topRadius = SKEWER_RADIUS_METRES * 0.75;
  const shaft = new THREE.CylinderGeometry(topRadius, SKEWER_RADIUS_METRES, shaftLength, 6).translate(0, shaftLength / 2, 0);
  const point = new THREE.ConeGeometry(topRadius, SKEWER_POINT_METRES, 6).translate(0, shaftLength + SKEWER_POINT_METRES / 2, 0);
  const skewerGeometry = track(mergeGeometries([shaft, point]));
  shaft.dispose();
  point.dispose();
  const skewerMaterial = material(SKEWER_COLOUR);
  // One fish shape for every slot. Each slot gets its own copy of the back and belly materials.
  const [body, belly, tail, eye] = fishParts(material, track, RAW_FISH_COLOURS).map((part) => {
    // The fish lies on its side with its snout to +z, its middle halfway along. Stand it up along the skewer, snout up.
    part.geometry.rotateX(-Math.PI / 2);
    return part;
  });
  if (body === undefined || belly === undefined || tail === undefined || eye === undefined) throw new Error("The fish shape has a part missing");
  // The cook turns the skewer now and then, so both flat sides char. The pile's marks lie on the fish's upper side.
  // Copy them to the lower side too, then stand them up with the fish.
  const upperMarks = charMarkPart(material, track).geometry;
  const lowerMarks = upperMarks.clone().translate(0, -FISH_THICKNESS_METRES * 0.92, 0);
  const charGeometry = track(mergeGeometries([upperMarks, lowerMarks])).rotateX(-Math.PI / 2);
  lowerMarks.dispose();
  const fishShape = { body: body.geometry, belly: belly.geometry, tail: tail.geometry, eye: eye.geometry, eyeMaterial: eye.material };
  const raw = { back: new THREE.Color(RAW_FISH_COLOURS.back), belly: new THREE.Color(RAW_FISH_COLOURS.belly) };
  const cooked = { back: new THREE.Color(COOKED_FISH_COLOURS.back), belly: new THREE.Color(COOKED_FISH_COLOURS.belly) };
  const charred = new THREE.Color(CHAR_COLOUR);

  const campfires = campfireEntities(entities);
  const fireplaces = fireplaceEntities(entities);
  const drawn = new Map<Entity, Slot[]>();

  /** Makes one skewer and its fish, leaning in toward -z by `lean` radians from upright. */
  function makeSlot(lean: number): Slot {
    const root = new THREE.Group();
    // These two are the slot's own, so forget() disposes them, not dispose().
    const back = new THREE.MeshStandardMaterial({ color: RAW_FISH_COLOURS.back, roughness: 0.9, flatShading: true });
    const bellyMaterial = new THREE.MeshStandardMaterial({ color: RAW_FISH_COLOURS.belly, roughness: 0.9, flatShading: true });
    const char = new THREE.MeshStandardMaterial({ color: CHAR_COLOUR, roughness: 0.9, flatShading: true });
    // The skewer's foot is the root's middle. It leans toward -z, which the slot's turn points at the fire.
    const leaning = new THREE.Group();
    leaning.rotation.x = -lean;
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
    const charMarks = new THREE.Mesh(charGeometry, char);
    fish.add(charMarks);
    group.add(root);
    return { root, back, belly: bellyMaterial, char, charMarks };
  }

  function slotsOf(campfire: Entity & { position: { x: number; y: number; z: number } }): Slot[] {
    const existing = drawn.get(campfire);
    if (existing !== undefined) return existing;
    const { x, y, z } = campfire.position;
    if (campfire.fireplace !== undefined) {
      const yaw = quarterTurnsToRadians(campfire.facing?.turns ?? 0);
      const slots = FIREPLACE_FEET.map(([across, forward]) => {
        const slot = makeSlot(0);
        // Turn the offset with the fireplace, the same way three.js turns a child of a group turned by `yaw`.
        const footX = x + across * Math.cos(yaw) + forward * Math.sin(yaw);
        const footZ = z - across * Math.sin(yaw) + forward * Math.cos(yaw);
        slot.root.position.set(footX, y - SKEWER_SUNK_METRES, footZ);
        // The root's +z points out of the opening, so the fish's flat side faces the fire.
        slot.root.rotation.y = yaw;
        return slot;
      });
      drawn.set(campfire, slots);
      return slots;
    }
    const onDeck = y - groundAt(x, z) > ON_DECK_METRES;
    const slots = SLOT_ANGLES.map((angle) => {
      const slot = makeSlot(SKEWER_LEAN_RADIANS);
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
      slot.char.dispose();
    }
    drawn.delete(campfire);
  }

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      for (const campfire of [...campfires, ...fireplaces]) {
        if (campfire.fishOnFire === undefined) continue;
        seen.add(campfire);
        slotsOf(campfire).forEach((slot, index) => {
          const fish = campfire.fishOnFire?.[index];
          slot.root.visible = fish !== undefined;
          if (fish === undefined) return;
          const progress = cookProgress(fish);
          slot.back.color.copy(raw.back).lerp(cooked.back, progress);
          slot.belly.color.copy(raw.belly).lerp(cooked.belly, progress);
          const charring = (progress - CHAR_FROM_PROGRESS) / (1 - CHAR_FROM_PROGRESS);
          slot.charMarks.visible = charring > 0;
          slot.char.color.copy(slot.back.color).lerp(charred, Math.min(1, charring));
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
